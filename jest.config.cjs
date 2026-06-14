module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(svg|png|jpg|jpeg|gif)$':
            '<rootDir>/packages/core/src/__mocks__/fileMock.js',
        '^webextension-polyfill$':
            '<rootDir>/packages/core/src/__mocks__/webextension-polyfill.ts',
    },
    roots: ['<rootDir>/packages/core/src'],
    testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};
