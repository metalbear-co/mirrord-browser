import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.json';
import { resolve } from 'path';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                config: resolve(__dirname, 'pages/config.html'),
                popup: resolve(__dirname, 'pages/popup.html'),
            },
            output: {
                assetFileNames: '[name].[ext]',
            },
        },
    },
    plugins: [crx({ manifest })],
});
