import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintPluginTS from '@typescript-eslint/eslint-plugin';
import parserTS from '@typescript-eslint/parser';
import * as customLinter from './src/setup/linter';

/**
 * 🎯 basic eslint configuration
 * @type {import("eslint").Linter.FlatConfig[]}
 */
export default [
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: parserTS,
            parserOptions: {
                project: './tsconfig.eslint.json', // avoid tslint errors
                ecmaVersion: 2020,
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': eslintPluginTS,
            prettier: eslintPluginPrettier,
            'robertz-linter': customLinter,
        },
        rules: {
            'no-console': 'error',
            'prettier/prettier': ['error'],
            indent: ['error', 4, { SwitchCase: 1 }],
            '@typescript-eslint/no-unused-vars': ['warn'],
            // custom rules
            'robertz-linter/robertz-jsdoc-format': 'warn',
            'object-shorthand': ['error', 'always'],
        },
    },
];
