type Call = [string, ...unknown[]];

describe('baggage merge XHR wrapper', () => {
    let calls: Call[];

    beforeEach(async () => {
        jest.resetModules();
        calls = [];
        class FakeXhr extends EventTarget {
            static readonly OPENED = 1;
            readyState = 0;
            onreadystatechange: (() => void) | null = null;
            open(...args: unknown[]) {
                calls.push(['open', ...args]);
                this.readyState = 1;
                this.onreadystatechange?.();
            }
            setRequestHeader(name: string, value: string) {
                calls.push(['setRequestHeader', name, value]);
            }
            send() {
                calls.push(['send']);
            }
            abort() {
                calls.push(['abort']);
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
});
