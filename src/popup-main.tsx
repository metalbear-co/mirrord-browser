import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import { Popup } from './components/Popup';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <Popup />
        </StrictMode>
    );
}
