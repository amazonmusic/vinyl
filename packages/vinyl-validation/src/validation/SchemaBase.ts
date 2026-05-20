/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IllegalArgumentError, invariant, type Maybe } from '@amazon/vinyl-util'
import { andValidators } from './andValidators'
import type {
    ValidationErrorMessage,
    ValidationOptions,
    Validator,
} from './Validator'
import type {
    PropertyValidator,
    PropertyValidatorOptions,
    PropertyValidatorWithOptions,
} from './PropertyValidator'

const requiredValidationOptions = {
    optional: false,
} as const satisfies PropertyValidatorOptions

/**
 * A base class for validation state.
 * Provides methods for chaining.
 *
 * Subclasses should not override constructors.
 */
export abstract class SchemaBase<T>
    implements PropertyValidator<T, { readonly optional: false }>
{
    __type = invariant<T>()

    private readonly validator: Validator<T>
    private _options = requiredValidationOptions

    get options() {
        return this._options
    }

    /**
     * Constructs the first link in a schema chain.
     *
     * @param currentValidator
     */
    constructor(currentValidator: Validator<any, any>)

    /**
     * Constructs linking to the given previous schema.
     *
     * @param currentValidator
     * @param previousSchema
     * @param operation
     */
    constructor(
        currentValidator: Validator<any, any>,
        previousSchema: SchemaBase<any>,
        operation: (
            validatorA: Validator<any>,
            validatorB: Validator<any, any>
        ) => Validator<T>
    )

    constructor(
        private readonly currentValidator: Validator<any, any>,
        private readonly previousSchema?: Maybe<SchemaBase<any>>,
        private readonly operation?: Maybe<
            (
                validatorA: Validator<any>,
                validatorB: Validator<any, any>
            ) => Validator<T>
        >
    ) {
        this.validator =
            operation == null
                ? currentValidator
                : operation(previousSchema!, currentValidator)
    }

    get description(): string {
        return this.validator.description
    }

    readonly assert: (
        input: unknown,
        origin?: string,
        path?: readonly string[]
    ) => asserts input is T = (input, origin?, path?): asserts input is T => {
        this.validator.assert(input, origin, path)
    }

    readonly isValid: (input: unknown) => input is T = (
        input: unknown
    ): input is T => this.validator.isValid(input)

    readonly validate = (
        input: unknown,
        options?: ValidationOptions,
        path?: readonly string[]
    ): readonly ValidationErrorMessage[] =>
        this.validator.validate(input, options, path)

    /**
     * Clones this schema, transforming all validators with the given mutator.
     *
     * @param transform A transformer which takes an existing validator in the chain and returns
     * a new one. Validators should be considered to be immutable; transform should not change the
     * input but instead return a new validator.
     */
    protected clone(
        transform: (validator: Validator<any>) => Validator<any> = (v) => v
    ): any {
        const cloned = this.operation
            ? this.self(
                  transform(this.currentValidator),
                  this.previousSchema!.clone(transform),
                  this.operation
              )
            : this.self(transform(this.currentValidator))
        cloned._options = this._options
        return cloned
    }

    protected self(current: Validator<any, any>): any

    protected self(
        currentValidator: Validator<any, any>,
        previousSchema: SchemaBase<any> | undefined,
        operation:
            | ((
                  validatorA: Validator<any>,
                  validatorB: Validator<any, any>
              ) => Validator<T>)
            | undefined
    ): any

    protected self(
        current: Validator<any, any>,
        previous?: SchemaBase<any>,
        operation?: (
            validatorA: Validator<any>,
            validatorB: Validator<any, any>
        ) => Validator<T> | undefined
    ): any {
        if (this.constructor.length > 3) {
            throw new IllegalArgumentError(
                'constructor should have at most three required arguments'
            )
        }
        return new (this.constructor as any)(current, previous, operation)
    }

    /**
     * Constructs a new schema with a validator chaining the current validator with the
     * provided next in an AND operation.
     *
     * @param nextValidator The validator to run after the current.
     * @return Returns a new Schema instance the same class with a new validator chaining the
     * current validator with the given next in an AND operation.
     */
    protected chain(nextValidator: Validator<any, any>): any {
        return this.self(nextValidator, this, andValidators)
    }

    optional(): PropertyValidatorWithOptions<
        this,
        T,
        { readonly optional: true }
    > {
        const cloned = this.clone()
        cloned._options = {
            ...cloned.options,
            optional: true,
        }
        return cloned
    }

    required(): PropertyValidatorWithOptions<
        this,
        T,
        { readonly optional: false }
    > {
        const cloned = this.clone()
        cloned._options = {
            ...cloned.options,
            optional: false,
        }
        return cloned
    }
}
