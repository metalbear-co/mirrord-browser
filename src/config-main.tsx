import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import '@metalbear/ui/styles.css';
import { Config } from './components/Config';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <Config />
        </StrictMode>
    );
}
