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
const ready = new Promise<void>((resolve) => {
    markReady = resolve;
});
setTimeout(markReady, CONFIG_TIMEOUT_MS);

document.addEventListener(CONFIG_EVENT, (event) => {
    entries = parseEntries((event as CustomEvent<unknown>).detail);
    markReady();
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
    await ready;

    const url = input instanceof Request ? input.url : resolveUrl(input);
    const entry = entryFor(url);

    if (entry === undefined) {
        return nativeFetch(input, init);
    }

    const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    headers.set(
        BAGGAGE_HEADER,
        mergeBaggage(headers.get(BAGGAGE_HEADER), entry)
    );

    return nativeFetch(input, { ...init, headers });
};

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
        this.pageBaggage.push(value);
    }

    override send(body?: Document | XMLHttpRequestBodyInit | null) {
        if (this.sent || this.readyState !== XMLHttpRequest.OPENED) {
            super.send(body);
            return;
        }
        this.sent = true;

        const finish = () => {
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
            super.send(body);
        };

        if (entries !== null || !this.isAsync) {
            finish();
            return;
        }

        this.pendingSend = finish;
        void ready.then(() => {
            if (this.pendingSend === finish) {
                finish();
            }
        });
    }

    override abort() {
        this.pendingSend?.();
        super.abort();
    }
}

window.XMLHttpRequest = MergingXMLHttpRequest;
