/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    transform: {
      '^.+\\.tsx?$': [
        'ts-jest',
        {
          // solve ts-jest[config] (WARN) message TS151001
          tsconfig: 'tsconfig.json',
          esModuleInterop: true,
        },
      ],
    },
    moduleNameMapper: {
      '^image![a-zA-Z0-9$_-]+$': 'GlobalImageStub',
      '^[./a-zA-Z0-9$_-]+\\.png$': '<rootDir>/RelativeImageStub.js',
      'module_name_(.*)': '<rootDir>/substituted_module_$1.js',
      'assets/(.*)': [
        '<rootDir>/images/$1',
        '<rootDir>/photos/$1',
        '<rootDir>/recipes/$1',
      ],
    },
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: [
        // '<rootDir>/src/backend/_shared/test_lib/customMatcher/toContainItem/toContainItem.ts'
    ],
    collectCoverage: true,
    collectCoverageFrom: [
      'src/**/*.{ts,tsx}',
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/coverage/**',
      '!**/vendor/**',
    ],
    coveragePathIgnorePatterns: [
      '/node_modules/',
      '/dist/',
      '/coverage/',
      '/vendor/',
      '\\.d\\.ts$',
    ],
    coverageReporters: ['json', 'json-summary', 'lcov', 'text'],
  };