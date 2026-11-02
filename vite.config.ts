import { defineConfig } from 'vite';
import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import chromeManifest from './src/manifest.json';
import { resolve } from 'path';

const browser = process.env['BROWSER'] === 'firefox' ? 'firefox' : 'chrome';

function firefoxManifest(): ManifestV3Export {
    const {
        key: _key,
        externally_connectable: _externallyConnectable,
        side_panel: sidePanel,
        background,
        ...rest
    } = chromeManifest;
    const manifest = {
        ...rest,
        permissions: rest.permissions.filter((p) => p !== 'sidePanel'),
        background: { scripts: [background.service_worker], type: 'module' },
        action: { default_title: rest.name },
        sidebar_action: {
            default_panel: sidePanel.default_path,
            default_title: rest.name,
            default_icon: rest.icons,
            open_at_install: false,
        },
        content_scripts: [
            ...rest.content_scripts,
            {
                matches: ['http://localhost/*', 'http://127.0.0.1/*'],
                js: ['src/content/pageBridge.ts'],
                run_at: 'document_start',
            },
        ],
        browser_specific_settings: {
            gecko: { id: 'mirrord@metalbear.com', strict_min_version: '128.0' },
        },
    };
    return manifest;
}

export default defineConfig({
    build: {
        outDir: browser === 'firefox' ? 'dist-firefox' : 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                config: resolve(__dirname, 'pages/config.html'),
                configure: resolve(__dirname, 'pages/configure.html'),
                popup: resolve(__dirname, 'pages/popup.html'),
                options: resolve(__dirname, 'pages/options.html'),
                applied: resolve(__dirname, 'pages/applied.html'),
            },
            output: {
                assetFileNames: '[name].[ext]',
            },
        },
    },
    plugins: [
        react(),
        crx({
            manifest:
                browser === 'firefox' ? firefoxManifest() : chromeManifest,
            browser,
        }),
    ],
});
