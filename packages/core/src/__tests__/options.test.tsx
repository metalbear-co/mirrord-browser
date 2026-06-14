import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// chrome.storage.local is backed by the shared webextension-polyfill mock installed on the
// global by jest.setup.ts.
import { Options } from '../options';

describe('Options page', () => {
    it('renders toggle in "on" state by default', async () => {
        render(<Options />);

        const toggle = await screen.findByRole('switch');
        expect(toggle).toBeInTheDocument();
        expect(toggle).toHaveAttribute('data-state', 'checked');
    });

    it('renders toggle in "off" state when opted out', async () => {
        await chrome.storage.local.set({ analytics_opt_out: true });

        render(<Options />);

        const toggle = await screen.findByRole('switch');
        expect(toggle).toHaveAttribute('data-state', 'unchecked');
    });

    it('toggling off writes analytics_opt_out: true to storage', async () => {
        render(<Options />);

        const toggle = await screen.findByRole('switch');
        fireEvent.click(toggle);

        await waitFor(() => {
            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                analytics_opt_out: true,
            });
        });
    });

    it('toggling back on removes the flag from storage', async () => {
        await chrome.storage.local.set({ analytics_opt_out: true });

        render(<Options />);

        const toggle = await screen.findByRole('switch');
        expect(toggle).toHaveAttribute('data-state', 'unchecked');

        fireEvent.click(toggle);

        await waitFor(() => {
            expect(chrome.storage.local.remove).toHaveBeenCalledWith(
                'analytics_opt_out'
            );
        });
    });
});
