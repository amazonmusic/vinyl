/*
 * Copyright (c) 2024. Amazon.com, Inc. or its affiliates. All rights reserved.
 */

import tseslint from 'typescript-eslint'
import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import customRules from './buildSrc/lint/index.mjs'
import licenseHeader from 'eslint-plugin-license-header'

export default tseslint.config(
    {
        plugins: {
            ['@typescript-eslint']: tseslint.plugin,
            ['custom-rules']: customRules,
            ['license-header']: licenseHeader,
        },
    },
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/tsdocs/**',
            '**/*.js',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    eslintConfigPrettier,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            sourceType: 'module',
            parserOptions: {
                projectService: true,
                project: ['**/tsconfig.json'],
            },
        },
        settings: {
            jsdoc: {
                mode: 'typescript',
            },
        },
        rules: {
            'custom-rules/no-self-import': 'error',
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/no-base-to-string': 'off',
            '@typescript-eslint/no-confusing-void-expression': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-invalid-void-type': 'off', // https://github.com/typescript-eslint/typescript-eslint/issues/8807
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-redundant-type-constituents': 'off',
            '@typescript-eslint/no-return-await': 'off',
            '@typescript-eslint/no-unnecessary-condition': [
                'error',
                {
                    allowConstantLoopConditions: true,
                },
            ],
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            '@typescript-eslint/restrict-plus-operands': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-constant-condition': [
                'error',
                {
                    checkLoops: false,
                },
            ],
        },
    },
    {
        files: ['**/*.ts'],
        ignores: ['**/index.ts'],
        rules: {
            'license-header/header': [
                'error',
                [
                    '/*',
                    ' * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.',
                    ' * SPDX-License-Identifier: Apache-2.0',
                    ' */',
                ],
            ],
        },
    },
    {
        files: ['**/*.test.ts'],
        rules: {
            '@typescript-eslint/no-extraneous-class': 'off',
            '@typescript-eslint/no-redundant-type-constituents': 'off',
            '@typescript-eslint/no-useless-constructor': 'off',
            '@typescript-eslint/unbound-method': 'off',
        },
    }
)
