const eslintPluginTs = require('eslint-plugin-ts');

module.exports = [
    {
        // Build tooling and generated output aren't part of the app tsconfig project, so
        // typed linting can't resolve them; skip them.
        ignores: [
            'node_modules/**',
            '**/dist/**',
            '.pnpm-store/**',
            'packages/*/vite.config.ts',
            'packages/*/manifest.ts',
        ],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: require('@typescript-eslint/parser'),
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        plugins: {
            ts: eslintPluginTs,
        },
        rules: {
            semi: ['error', 'always'],
            quotes: ['error', 'single'],
        },
    },
];
