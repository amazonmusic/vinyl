/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Invariant, ValidationError } from '@amazon/vinyl-util'
import { stringifyForPrint, substitute } from '@amazon/vinyl-util'

/**
 * Represents a validation failure.
 */
export interface ValidationErrorMessage {
    readonly message: string
    readonly path: readonly string[]
}

export interface ValidationOptions {
    /**
     * If true, collect all validation errors.
     * Default: false
     */
    readonly all?: boolean
}

/**
 * A Validator can assert that an input matches this validator's schema.
 */
export interface Validator<Output extends Input, in Input = unknown> {
    /**
     * Enforces T is in an invariant position.
     * This prevents a validator with more strict rules is assigned to a less strict type, which
     * can cause unexpected validation errors.
     */
    __type?: Invariant<Output>

    /**
     * A short description of the validator.
     */
    readonly description: string

    /**
     * Returns true if the input is valid according to this validator.
     *
     * @param input
     */
    readonly isValid: (input: Input) => input is Output

    /**
     * Validates the provided input, returning a list of error messages, or an empty array if the
     * input passes this validator.
     *
     * @param input The input to validate.
     * @param options Validation options.
     * @param path The current field path to this validator.
     * @return Returns an array of validation failures. If `options.all` is not true, only the
     * first error will be returned.
     */
    readonly validate: (
        input: Input,
        options?: ValidationOptions,
        path?: readonly string[]
    ) => readonly ValidationErrorMessage[]

    /**
     * Validates the given input, asserting that the input is type `T`.
     * If the input is not valid, a {@link ValidationError} will be thrown.
     *
     * @param input The input to validate.
     * @param origin The error origin. `ErrorOrigin.API` by default.
     * @param path The current field path to this validator.
     * @return Returns the input, cast as the validated type T
     */
    readonly assert: (
        input: Input,
        origin?: string,
        path?: readonly string[]
    ) => asserts input is Output
}

/**
 * @private
 */
const validatorLocale = {
    /**
     * The expectation template string with the following replacement tokens:
     *
     * `{expected}` - The expected description.
     * `{actual}` - The actual value.
     * `{path}` - The path, dot separated.
     */
    template: 'Expected: {expected}, but was: {actual}. At: {path}',
}

/**
 * Creates a message string for a ValidationErrorMessage based on the input and its expectation.
 *
 * @param expectationMessage
 * @param input
 * @param path
 * @param inputStringify
 */
export function createValidationExpectationMessage<Input>(
    expectationMessage: string,
    input: Input,
    path: readonly string[],
    inputStringify: (input: Input) => string = (input) =>
        stringifyForPrint(input, 500)
): string {
    return substitute(validatorLocale.template, {
        expected: expectationMessage,
        actual: inputStringify(input),
        path: path.join('.'),
    })
}

/**
 * Creates a new basic validator.
 *
 * For a deep validator which has sub-fields, use {@link createDeepValidator}.
 *
 * @param expectationMessage The message to use to describe what is expected. This will be used in
 * the error message template.
 * @param isValid Returns true if the given input is valid.
 * @param inputStringify Stringifies the input for use as the actual `{actual}` token in the validation
 * expectation template. Default is `stringifyForPrint` with a 500 character max length.
 */
export function createValidator<Output extends Input, Input = unknown>(
    expectationMessage: string,
    isValid: (input: Input) => boolean,
    inputStringify: (input: Input) => string = (input) =>
        stringifyForPrint(input, 500)
): Validator<Output, Input> {
    return {
        description: expectationMessage,

        isValid(input: Input): input is Output {
            return isValid(input)
        },

        validate(
            input: Input,
            _?: ValidationOptions,
            path: readonly string[] = []
        ): readonly ValidationErrorMessage[] {
            if (!isValid(input)) {
                return [
                    {
                        message: createValidationExpectationMessage(
                            expectationMessage,
                            input,
                            path,
                            inputStringify
                        ),
                        path,
                    },
                ]
            }
            return []
        },

        assert: (
            input: Input,
            origin?: string,
            path: readonly string[] = []
        ): asserts input is Output => {
            if (!isValid(input)) {
                throw new ValidationError(
                    createValidationExpectationMessage(
                        expectationMessage,
                        input,
                        path,
                        inputStringify
                    ),
                    origin,
                    path
                )
            }
        },
    }
}

/**
 * Creates a new deep validator.
 *
 * For a shallow validator which validates one value, use {@link createValidator}.
 *
 * @param description Describes the validator.
 * @param validate Returns an array of validation failures.
 */
export function createDeepValidator<Output extends Input, Input = unknown>(
    description: string,
    validate: (
        input: Input,
        options: ValidationOptions,
        path: readonly string[]
    ) => readonly ValidationErrorMessage[]
): Validator<Output, Input> {
    return {
        description,

        isValid(input: Input): input is Output {
            return validate(input, { all: false }, []).length === 0
        },

        validate(
            input: Input,
            options?: ValidationOptions,
            path: readonly string[] = []
        ): readonly ValidationErrorMessage[] {
            return validate(input, options ?? { all: false }, path)
        },

        assert: (
            input: Input,
            origin?: string,
            path: readonly string[] = []
        ): asserts input is Output => {
            const errors = validate(input, { all: false }, path)
            if (errors.length) {
                const error = errors[0]
                throw new ValidationError(error.message, origin, error.path)
            }
        },
    }
}
