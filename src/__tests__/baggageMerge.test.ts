type Call = [string, ...unknown[]];

describe('baggage merge XHR wrapper', () => {
    let calls: Call[];

    beforeEach(async () => {
        jest.resetModules();
        const log: Call[] = [];
        calls = log;
        class FakeXhr extends EventTarget {
            static readonly OPENED = 1;
            readyState = 0;
            onreadystatechange: (() => void) | null = null;
            open(...args: unknown[]) {
                log.push(['open', ...args]);
                this.readyState = 1;
                this.onreadystatechange?.();
            }
            setRequestHeader(name: string, value: string) {
                log.push(['setRequestHeader', name, value]);
            }
            send(body?: unknown) {
                log.push(body === undefined ? ['send'] : ['send', body]);
            }
            abort() {
                log.push(['abort']);
            }
        }
        window.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
        window.fetch = jest.fn();
        await import('../content/baggageMerge');
    });

    const publish = (entries: unknown) =>
        document.dispatchEvent(
            new CustomEvent('mirrord-baggage-config', {
                detail: JSON.stringify(entries),
            })
        );

    it('merges baggage set by an OPENED handler once config arrives', async () => {
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = () => {
            if (xhr.readyState === XMLHttpRequest.OPENED) {
                xhr.setRequestHeader('baggage', 'early=1');
                xhr.send();
            }
        };
        xhr.open('GET', 'https://api.example.com/x');
        expect(calls.map(([name]) => name)).toEqual(['open']);

        publish([{ value: 'mirrord-session=k1', filters: ['|'] }]);
        await Promise.resolve();

        expect(calls.slice(1)).toEqual([
            ['setRequestHeader', 'baggage', 'early=1,mirrord-session=k1'],
            ['send'],
        ]);
    });

    it('sends then aborts when aborted before config arrives', async () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/x');
        xhr.send();
        xhr.abort();

        publish([{ value: 'mirrord-session=k1', filters: ['|'] }]);
        await Promise.resolve();

        expect(calls.slice(1)).toEqual([['send'], ['abort']]);
    });

    it('rejects a second send while the first is waiting for config', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/x');
        xhr.send();

        expect(() => xhr.send()).toThrow('already being sent');
    });

    it('sends the body as it was when send() was called', async () => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.example.com/x');
        const params = new URLSearchParams({ credential: 'first' });
        xhr.send(params);
        params.set('credential', 'second');

        publish([{ value: 'mirrord-session=k1', filters: ['|'] }]);
        await Promise.resolve();

        const [, sent] = calls.find(([name]) => name === 'send') ?? [];
        expect(String(sent)).toBe('credential=first');
    });

    it('waits for fresh config after a back/forward cache restore', async () => {
        publish([{ value: 'mirrord-session=k1', filters: ['|'] }]);
        window.dispatchEvent(
            new PageTransitionEvent('pageshow', { persisted: true })
        );

        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/x');
        xhr.send();
        expect(calls.map(([name]) => name)).toEqual(['open']);

        publish([]);
        await Promise.resolve();

        expect(calls.slice(1)).toEqual([['send']]);
    });
});
