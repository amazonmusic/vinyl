/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Type-safety utility
 */

/**
 * Distributes the value types of an array into a union.
 */
export type Flatten<T> = T extends readonly any[] ? T[number] : T

/**
 * Property keys of an object that do not map to functions.
 */
export type NonFunctionPropertyNames<T> = {
    [K in keyof T]: T[K] extends (...args: any) => any ? never : K
}[keyof T]

/**
 * All primitive types.
 */
export type Primitive =
    | bigint
    | boolean
    | number
    | string
    | symbol
    | null
    | undefined

/**
 * An empty object, safer than using `object` type.
 */
export type AnyRecord = Record<never, any>

/**
 * never, with a message to help explain the problem.
 * https://github.com/microsoft/TypeScript/issues/33098
 */
export type Never<Message extends string> = [never, Message]

/**
 * A type representing any type of function.
 */
export type Fun = (...args: any[]) => any

/**
 * Enforces that the type represents data that can be serialized via JSON.stringify.
 */
export type JsonCompatible<T> = unknown extends T
    ? never
    : T extends bigint | symbol | Fun
      ? never
      : T extends
              | boolean
              | number
              | string
              | null
              | undefined
              | { toJSON(): any }
        ? T
        : T extends readonly any[]
          ? readonly JsonCompatible<T[number]>[]
          : {
                [P in keyof T]: JsonCompatible<T[P]>
            }

/**
 * A compile-time check that the given value/array/object is serializable via JSON.stringify.
 *
 * A value is serializable if any of these are true:
 * - It is an object with a toJSON() function
 * - It is an object with only serializable members.
 * - It is an array with only serializable elements.
 * - It is type boolean, string, number, null, or undefined.
 */
export function jsonCompatible<T>(value: JsonCompatible<T>): T {
    return value as T
}

/**
 * An object whose properties are all optional, and all sub-properties are optional.
 * Note: does not convert array or tuple elements to Partial.
 */
export type PartialDeep<T> = T extends Fun | Primitive
    ? T
    : T extends object
      ? {
            [P in keyof T]?: PartialDeep<T[P]>
        }
      : T

/**
 * Defines specific properties of T that are not required.
 */
export type PickPartial<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Possible values `typeof` operator may return.
 */
export type Typeof =
    | 'bigint'
    | 'boolean'
    | 'function'
    | 'number'
    | 'object'
    | 'string'
    | 'symbol'
    | 'undefined'

/**
 * Given a possible result from `typeof`, provides the type to the matched value.
 */
export type FromTypeof<T extends Typeof> = T extends 'bigint'
    ? bigint
    : T extends 'boolean'
      ? boolean
      : T extends 'function'
        ? Fun
        : T extends 'number'
          ? number
          : T extends 'object'
            ? object | null
            : T extends 'string'
              ? string
              : T extends 'symbol'
                ? symbol
                : T extends 'undefined'
                  ? undefined
                  : any

/**
 * Extracts values from T which extends type U.
 */
export type ExtractValues<T, U> = Pick<
    T,
    {
        [P in keyof T]: T[P] extends U ? P : never
    }[keyof T]
>

/**
 * Excludes values from T which extends type U.
 */
export type ExcludeValues<T, U> = Pick<
    T,
    {
        [P in keyof T]: T[P] extends U ? never : P
    }[keyof T]
>

export type Maybe<T> = T | undefined | null

/**
 * Infers the element type from an Array type.
 */
export type ElementType<T extends readonly any[]> =
    T extends ReadonlyArray<infer E> ? E : never

/**
 * Infers the element type from a Set type.
 */
export type SetElementType<T extends ReadonlySet<any>> =
    T extends ReadonlySet<infer E> ? E : never

/**
 * Enforces type T to be in an invariant position.
 * For example `Invariant<Square>` cannot be assigned to type `Invariant<Polygon>` or vice versa.
 *
 * This should be used when an interface with type parameter T needs strict invariance in addition to what the
 * compiler can infer from use.
 *
 * {@link https://en.wikipedia.org/wiki/Covariance_and_contravariance_(computer_science)}
 */
export type Invariant<T> = T &
    Required<T> &
    ((input: T & Required<T>) => T & Required<T>)

export function invariant<T>(): Invariant<T> {
    return undefined as any
}

/**
 * Enforces type T to be in a covariant position.
 * For example `Invariant<Square>` can be assigned to type `Invariant<Polygon>` but not vice versa.
 *
 * This should be used when an interface with type parameter T does not explicitly use T in an
 * output position, but the interface implies `out T`.
 */
export type Covariant<T> = () => T

export function covariant<T>(): Covariant<T> {
    return undefined as any
}

/**
 * Enforces type T to be in a covariant position.
 * For example `Invariant<Polygon>` can be assigned to type `Invariant<Square>` but not vice versa.
 *
 * This should be used when an interface with type parameter T does not explicitly use T in an
 * input position, but the interface implies `in T`.
 */
export type Contravariant<T> = (input: T) => void

export function contravariant<T>(): Contravariant<T> {
    return undefined as any
}

/**
 * A type which may either be a direct instance of T or a promise that resolves to T.
 */
export type MaybePromise<T> = PromiseLike<T> | T

/**
 * Deeply excludes all keys from T extending K.
 */
export type OmitDeep<T, K extends keyof any> = Omit<
    {
        [P in keyof T]: T[P] extends Primitive ? T[P] : OmitDeep<T[P], K>
    },
    K
>

/**
 * Make properties of T extending K optional.
 */
export type Optional<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>

/**
 * Make properties of T extending K optional, recursively.
 */
export type OptionalDeep<T, K extends keyof any> = Optional<
    {
        [P in keyof T]: T[P] extends Primitive ? T[P] : OptionalDeep<T[P], K>
    },
    K & keyof T
>

/**
 * true if T extends never, otherwise false
 */
export type IsNever<T> = [T] extends [never] ? true : false

/**
 * true if T extends any, otherwise false
 */
export type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * Determines whether a property `P` of object type `U` is declared as optional.
 *
 * This checks whether the `{}` type (an empty object) is assignable to
 * `Pick<U, P>`. In TypeScript, this is true only when `P` is marked optional
 * using the `?` modifier in the type definition.
 *
 * Importantly, this detects *actual optionality* rather than checking whether
 * the property's type includes `undefined`. For example:
 *
 * ```ts
 * type A = { x?: string };               // optional
 * type B = { x: string | undefined };    // required but allows undefined
 *
 * IsPropertyOptional<A, "x"> // true
 * IsPropertyOptional<B, "x"> // false
 * ```
 *
 * @template U - The object type containing the property.
 * @template P - The key of the property to test.
 * @returns `true` if `P` is an optional property, otherwise `false`.
 */
export type IsPropertyOptional<U, P extends keyof U> =
    AnyRecord extends Pick<U, P> ? true : false

/**
 * A type that equals true if Left and Right are loosely equal, that is, that Left extends Right
 * and Right extends Left.
 * This will always equal true or false, and never the union `true | false`
 */
export type Equal<Left, Right> = [Left] extends [Right]
    ? [Right] extends [Left]
        ? true
        : false
    : false

/**
 * A type that equals true if Left and Right are strictly equal.
 * Works with complex objects, readonly, and optional modifiers.
 * Works with method input arguments.
 * This will always equal true or false, and never the union `true | false`
 */
export type StrictEqual<Left, Right> =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    (<T>() => T extends Left ? 0 : 1) extends <T>() => T extends Right ? 0 : 1
        ? Equal<Left, Right>
        : false
