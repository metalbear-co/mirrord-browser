const tseslint = require('typescript-eslint');
const eslintPluginTs = require('eslint-plugin-ts');

module.exports = tseslint.config(
    {
        ignores: [
            'dist',
            'node_modules',
            'playwright-report',
            'test-results',
            'pnpm-lock.yaml',
        ],
    },
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: __dirname,
            },
        },
        plugins: {
            ts: eslintPluginTs,
        },
        rules: {
            semi: ['error', 'always'],
            quotes: ['error', 'single'],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/no-confusing-void-expression': [
                'error',
                { ignoreArrowShorthand: true },
            ],
            '@typescript-eslint/restrict-template-expressions': [
                'error',
                { allowNumber: true },
            ],
            'no-console': ['error', { allow: ['warn', 'error'] }],
            eqeqeq: ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-magic-numbers': 'off',
            '@typescript-eslint/no-magic-numbers': [
                'error',
                {
                    ignore: [0, 1, -1, 2, 100],
                    ignoreArrayIndexes: true,
                    ignoreDefaultValues: true,
                    ignoreEnums: true,
                    ignoreReadonlyClassProperties: true,
                    enforceConst: true,
                },
            ],
        },
    },
    {
        files: [
            '**/__tests__/**',
            '**/*.test.ts',
            '**/*.test.tsx',
            '**/*.spec.ts',
            '**/*.spec.tsx',
            'e2e/**',
        ],
        rules: {
            '@typescript-eslint/no-magic-numbers': 'off',
            'no-console': 'off',
        },
    },
    {
        files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
        extends: [tseslint.configs.disableTypeChecked],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-magic-numbers': 'off',
            'no-console': 'off',
        },
    }
);
