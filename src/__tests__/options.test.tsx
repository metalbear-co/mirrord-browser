import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock chrome.storage.local
const chromeStore: Record<string, unknown> = {};
const mockChromeStorage = {
    get: jest.fn((keys: string | string[]) => {
        const result: Record<string, unknown> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
            if (k in chromeStore) result[k] = chromeStore[k];
        }
        return Promise.resolve(result);
    }),
    set: jest.fn((items: Record<string, unknown>) => {
        Object.assign(chromeStore, items);
        return Promise.resolve();
    }),
    remove: jest.fn((keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) delete chromeStore[k];
        return Promise.resolve();
    }),
};

Object.defineProperty(globalThis, 'chrome', {
    value: {
        storage: { local: mockChromeStorage },
        runtime: { openOptionsPage: jest.fn() },
    },
    writable: true,
});

// Must import after chrome mock is set up
import { Options } from '../options';

describe('Options page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        for (const key of Object.keys(chromeStore)) delete chromeStore[key];
    });

    it('renders toggle in "on" state by default', async () => {
        render(<Options />);

        const toggle = await screen.findByRole('switch');
        expect(toggle).toBeInTheDocument();
        expect(toggle).toHaveAttribute('data-state', 'checked');
    });

    it('renders toggle in "off" state when opted out', async () => {
        chromeStore['analytics_opt_out'] = true;

        render(<Options />);

        const toggle = await screen.findByRole('switch');
        expect(toggle).toHaveAttribute('data-state', 'unchecked');
    });

    it('toggling off writes analytics_opt_out: true to storage', async () => {
        render(<Options />);

        const toggle = await screen.findByRole('switch');
        fireEvent.click(toggle);

        await waitFor(() => {
            expect(mockChromeStorage.set).toHaveBeenCalledWith({
                analytics_opt_out: true,
            });
        });
    });

    it('toggling back on removes the flag from storage', async () => {
        chromeStore['analytics_opt_out'] = true;

        render(<Options />);

        const toggle = await screen.findByRole('switch');
        expect(toggle).toHaveAttribute('data-state', 'unchecked');

        fireEvent.click(toggle);

        await waitFor(() => {
            expect(mockChromeStorage.remove).toHaveBeenCalledWith(
                'analytics_opt_out'
            );
        });
    });
});
