import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';
import manifest from './manifest';

// The source root is the shared core package; only the manifest and target differ
// between Chrome and Firefox. Output is emitted into this package's own dist/.
export default defineConfig({
    root: resolve(__dirname, '../core'),
    build: {
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,
    },
    plugins: [
        react(),
        webExtension({
            manifest: () => manifest,
            browser: 'firefox',
            additionalInputs: ['pages/config.html', 'pages/configure.html'],
            disableAutoLaunch: true,
        }),
    ],
});
