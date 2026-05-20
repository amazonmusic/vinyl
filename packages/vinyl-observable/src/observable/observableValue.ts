/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe, Unsubscribe } from '@amazon/vinyl-util'
import { DisposedError } from '@amazon/vinyl-util'

export interface ObservableValue<out T> {
    /**
     * Invokes a callback immediately and when data has changed.
     * @param callback
     */
    onData(callback: DataChangedCallback<T>): Unsubscribe

    /**
     * Creates a data provider transforming this data.
     */
    map<U>(transform: (value: T) => U): ObservableValue<U>

    /**
     * Returns a data provider for a property of T.
     */
    pick<K extends keyof NonNullable<T>>(prop: K): ObservableValue<Picked<T, K>>
    pick(prop: PropertyKey): ObservableValue<unknown>

    /**
     * The current value.
     */
    readonly value: T

    /**
     * Gets the current value.
     */
    getValue(): T

    /**
     * A monotonically increasing id that increments before each change notification.
     */
    readonly changeId: number
}

export type MaybeObservableValue<T> = ObservableValue<T> | T

/**
 * Given an ObservableValue<ValueType>, infers ValueType.
 */
export type InferObservableValueType<T extends ObservableValue<any>> =
    T extends ObservableValue<infer U> ? U : never

/**
 * A mutable version of a data provider.
 */
export interface MutableValue<T> extends ObservableValue<T> {
    /**
     * The current value, may be set.
     * `onData` callbacks will be invoked if value is not exactly equal to
     * the current value.
     */
    value: T

    /**
     * Sets the current value.
     */
    setValue(value: T): void

    /**
     * Creates a readonly sub-controller for a transformed value.
     *
     * @param transform Applies a transformation to a single value using a provided function and returns the result.
     * The returned sub controller will use this as its value.
     */
    map<U>(transform: (value: T) => U): ObservableValue<U>

    /**
     * Creates a writable sub-controller for a transformed value.
     *
     * @param transform Applies a transformation to a single value using a provided function and returns the result.
     * The returned sub controller will use this as its value.
     * @param setData The reverse of transform; When the sub-controller's data is set, this will convert the
     * transformed value back to what can be saved on `this` controller.
     */
    map<U>(
        transform: (value: T) => U,
        setData: (transformed: U, original: T) => T
    ): MutableValue<U>

    /**
     * Returns a data controller for a property of T.
     */
    pick<K extends keyof NonNullable<T>>(prop: K): MutableValue<Picked<T, K>>
    pick(prop: PropertyKey): MutableValue<unknown>

    /**
     * Invokes subscribers, can be used to indicate a change without setting
     * a new value.
     */
    invalidate(): void
}

export type DataChangedCallback<T> = (
    /**
     * The current value.
     */
    value: T,

    /**
     * The previous value, or undefined if this is the first time calling this callback.
     */
    previousValue: T | undefined
) => void

export type Picked<T, K extends keyof NonNullable<T>> = T extends
    | undefined
    | null
    ? NonNullable<T>[K] | undefined
    : NonNullable<T>[K]

abstract class MutableValueBase<T> implements MutableValue<T> {
    abstract value: T
    abstract readonly changeId: number

    getValue(): T {
        return this.value
    }

    setValue(value: T) {
        this.value = value
    }

    abstract onData(callback: DataChangedCallback<T>): Unsubscribe

    map<U>(
        transform: { (value: T): U },
        setData?: Maybe<(transformed: U, original: T) => T>
    ): MutableValue<U> {
        return new SubDataController<T, U>(
            this,
            transform,
            setData ?? throwSaveNotProvidedError
        )
    }

    pick<K extends keyof NonNullable<T>>(prop: K): MutableValue<Picked<T, K>> {
        return new SubDataController<T, Picked<T, K>>(
            this,
            (value: T): Picked<T, K> => {
                return (value == null ? undefined : value[prop]) as Picked<T, K>
            },
            (subValue) => {
                const current = this.value
                if (current == null) return current
                const newValue = { ...current }
                newValue[prop] = subValue!
                return newValue
            }
        )
    }

    abstract invalidate(): void
}

export class MutableValueImpl<T> extends MutableValueBase<T> {
    private _disposed = false
    private currentIndex = -1
    private n = 0
    private readonly callbacks: DataChangedCallback<T>[] = []
    private _changeId = 0

    constructor(private currentValue: T) {
        super()
    }

    get changeId(): number {
        return this._changeId
    }

    hasAnyListeners(): boolean {
        return this.callbacks.length > 0
    }

    onData(callback: DataChangedCallback<T>): Unsubscribe {
        if (this._disposed) throw new DisposedError()
        this.callbacks.push(callback)
        callback(this.currentValue, undefined)
        return () => {
            // Remove the callback.
            const index = this.callbacks.indexOf(callback)
            if (index !== -1) {
                this.callbacks.splice(index, 1)
                if (index <= this.currentIndex) this.currentIndex--
                this.n--
            }
        }
    }

    get value(): T {
        return this.currentValue
    }

    set value(value: T) {
        if (this.currentIndex !== -1) {
            throw new Error('data cannot be set from onData callback')
        }
        if (this._disposed) throw new DisposedError()
        const previousValue = this.currentValue
        if (value === previousValue) return
        this.currentValue = value
        this.notify(value, previousValue)
    }

    invalidate() {
        this.notify(this.currentValue, this.currentValue)
    }

    get disposed(): boolean {
        return this._disposed
    }

    dispose() {
        this._disposed = true
        this.callbacks.length = 0
    }

    private notify(value: T, previousValue: T) {
        this._changeId++
        this.n = this.callbacks.length
        try {
            while (this.currentIndex < this.n - 1) {
                this.callbacks[++this.currentIndex](value, previousValue)
            }
        } finally {
            this.currentIndex = -1
        }
    }
}

class SubDataController<FromType, T> extends MutableValueBase<T> {
    private needsValidation = false
    private cachedChangeId = -1
    private cachedValue: T | undefined

    constructor(
        private readonly source: MutableValue<FromType>,
        private readonly getter: (original: FromType) => T,
        private readonly setter: (
            transformed: T,
            original: FromType
        ) => FromType
    ) {
        super()
    }

    get changeId(): number {
        return this.source.changeId
    }

    private getTransformed(): T {
        const id = this.source.changeId
        if (this.cachedChangeId === id) return this.cachedValue!
        const value = this.getter(this.source.value)
        this.cachedChangeId = id
        this.cachedValue = value
        return value
    }

    get value(): T {
        return this.getTransformed()
    }

    set value(value: T) {
        this.source.value = this.setter(value, this.source.value)
    }

    onData(callback: DataChangedCallback<T>): Unsubscribe {
        let previous: T | undefined
        let firstCall = true
        return this.source.onData(() => {
            const newValue = this.getTransformed()
            if (firstCall || this.needsValidation || newValue !== previous) {
                callback(newValue, previous)
                firstCall = false
                previous = newValue
            }
        })
    }

    invalidate(): void {
        this.needsValidation = true
        this.source.invalidate()
        this.needsValidation = false
    }
}

/**
 * Returns true if the value is a ObservableValue.
 * @param value
 */
export function isObservableValue(value: any): value is ObservableValue<any> {
    if (value == null) return false
    return (
        typeof value === 'object' &&
        'onData' in value &&
        typeof value.onData === 'function'
    )
}

/**
 * Creates a data provider.
 * @param value
 */
export function data<T>(value: T): MutableValueImpl<T> {
    return new MutableValueImpl<T>(value)
}

/**
 * If the value is a ObservableValue, returns the data provider as is. Otherwise, wraps the value in
 * provider.
 *
 * @param value
 */
export function asData<T>(value: MaybeObservableValue<T>): ObservableValue<T> {
    return isObservableValue(value) ? value : data(value)
}

function throwSaveNotProvidedError(): never {
    throw new Error('data cannot be set, a `setData` function must be provided')
}

export type OnDataRequested<T> = (setData: (value: T) => void) => Unsubscribe

export class ExternalMutableValue<T> extends MutableValueBase<T> {
    private _data: MutableValueImpl<T>
    private externalDataSub: Unsubscribe | null = null

    constructor(
        currentValue: T,
        private readonly onDataRequested: OnDataRequested<T>
    ) {
        super()
        this._data = data(currentValue)
    }

    get value(): T {
        return this._data.value
    }

    get changeId(): number {
        return this._data.changeId
    }

    set value(_value: T) {
        throw new Error('set value not supported')
    }

    onData(callback: DataChangedCallback<T>): Unsubscribe {
        if (!this._data.hasAnyListeners()) {
            this.externalDataSub = this.onDataRequested((value: T): void => {
                this._data.value = value
            })
        }
        const sub = this._data.onData(callback)
        return () => {
            sub()
            if (!this._data.hasAnyListeners()) {
                this.externalDataSub?.()
                this.externalDataSub = null
            }
        }
    }

    invalidate(): void {
        throw new Error('invalidate not supported')
    }
}

/**
 * Creates a data provider that can observe an external event system when onData is called.
 *
 * @param initialValue
 * @param onDataRequested
 */
export function externalData<T>(
    initialValue: T,
    onDataRequested: (setData: (value: T) => void) => Unsubscribe
): ObservableValue<T> {
    return new ExternalMutableValue(initialValue, onDataRequested)
}
