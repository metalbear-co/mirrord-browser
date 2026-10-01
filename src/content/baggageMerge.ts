import {
    BAGGAGE_HEADER,
    entryForUrl,
    mergeBaggage,
    parseEntries,
    type BaggageEntry,
} from '../baggage';

const CONFIG_EVENT = 'mirrord-baggage-config';
const CONFIG_TIMEOUT_MS = 1000;

let entries: BaggageEntry[] | null = null;
let markReady: () => void = () => undefined;
let ready: Promise<void> = Promise.resolve();

function awaitConfig() {
    entries = null;
    ready = new Promise<void>((resolve) => {
        markReady = resolve;
        setTimeout(resolve, CONFIG_TIMEOUT_MS);
    });
}

awaitConfig();

document.addEventListener(CONFIG_EVENT, (event) => {
    entries = parseEntries((event as CustomEvent<unknown>).detail);
    markReady();
});

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        awaitConfig();
    }
});

function resolveUrl(url: string | URL): string | undefined {
    try {
        return new URL(url, document.baseURI).href;
    } catch {
        return undefined;
    }
}

function entryFor(url: string | undefined): string | undefined {
    return url === undefined ? undefined : entryForUrl(url, entries ?? []);
}

const nativeFetch = window.fetch.bind(window);

window.fetch = async (input, init) => {
    const request = new Request(input, init);
    await ready;

    const entry = entryFor(request.url);
    if (entry !== undefined) {
        request.headers.set(
            BAGGAGE_HEADER,
            mergeBaggage(request.headers.get(BAGGAGE_HEADER), entry)
        );
    }
    return nativeFetch(request);
};

type XhrBody = Document | XMLHttpRequestBodyInit | null | undefined;

/** Native XHR reads the body at `send()`, so a deferred send must not see later mutations. */
function snapshotBody(body: XhrBody): XhrBody {
    if (body instanceof URLSearchParams) {
        return new URLSearchParams(body);
    }
    if (body instanceof FormData) {
        const copy = new FormData();
        body.forEach((value, key) => {
            copy.append(key, value);
        });
        return copy;
    }
    if (body instanceof ArrayBuffer) {
        return body.slice(0);
    }
    if (ArrayBuffer.isView(body)) {
        return new Uint8Array(
            body.buffer.slice(
                body.byteOffset,
                body.byteOffset + body.byteLength
            )
        );
    }
    if (body instanceof Document) {
        return body.cloneNode(true) as Document;
    }
    return body;
}

type OpenArgs = [
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
];

class MergingXMLHttpRequest extends XMLHttpRequest {
    private requestUrl: string | undefined;
    private pageBaggage: string[] = [];
    private sent = false;
    private isAsync = true;
    private pendingSend: (() => void) | null = null;

    override open(...args: OpenArgs) {
        const [, url, async = true] = args;
        const previous = {
            requestUrl: this.requestUrl,
            pageBaggage: this.pageBaggage,
            sent: this.sent,
            isAsync: this.isAsync,
            pendingSend: this.pendingSend,
        };
        this.requestUrl = resolveUrl(url);
        this.pageBaggage = [];
        this.sent = false;
        this.pendingSend = null;
        this.isAsync = async;
        try {
            super.open(...(args as Parameters<XMLHttpRequest['open']>));
        } catch (error) {
            Object.assign(this, previous);
            throw error;
        }
    }

    override setRequestHeader(name: string, value: string) {
        if (
            this.sent ||
            this.readyState !== XMLHttpRequest.OPENED ||
            name.toLowerCase() !== BAGGAGE_HEADER
        ) {
            super.setRequestHeader(name, value);
            return;
        }
        const validated = new Headers();
        try {
            validated.set(BAGGAGE_HEADER, value);
        } catch {
            throw new DOMException(
                `Failed to execute setRequestHeader on XMLHttpRequest: '${value}' is not a valid HTTP header field value.`,
                'SyntaxError'
            );
        }
        this.pageBaggage.push(validated.get(BAGGAGE_HEADER) ?? '');
    }

    override send(body?: XhrBody) {
        if (this.pendingSend !== null) {
            throw new DOMException(
                'Failed to execute send on XMLHttpRequest: the request is already being sent.',
                'InvalidStateError'
            );
        }
        if (this.sent || this.readyState !== XMLHttpRequest.OPENED) {
            super.send(body);
            return;
        }
        this.sent = true;

        const finish = (payload: XhrBody) => {
            this.pendingSend = null;
            const page =
                this.pageBaggage.length > 0
                    ? this.pageBaggage.join(', ')
                    : null;
            const entry = entryFor(this.requestUrl);
            const baggage =
                entry === undefined ? page : mergeBaggage(page, entry);
            if (baggage !== null) {
                super.setRequestHeader(BAGGAGE_HEADER, baggage);
            }
            super.send(payload);
        };

        if (entries !== null || !this.isAsync) {
            finish(body);
            return;
        }

        const payload = snapshotBody(body);
        const pending = () => finish(payload);
        this.pendingSend = pending;
        void ready.then(() => {
            if (this.pendingSend === pending) {
                pending();
            }
        });
    }

    override abort() {
        this.pendingSend?.();
        super.abort();
    }
}

window.XMLHttpRequest = MergingXMLHttpRequest;
