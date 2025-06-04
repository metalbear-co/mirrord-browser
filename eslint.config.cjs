const eslintPluginTs = require('eslint-plugin-ts');

module.exports = [
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
