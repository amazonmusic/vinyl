/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    getGlobalRegistry,
    type GlobalRef,
    globalRef,
    GlobalRefImpl,
    GlobalRegistry,
    IllegalStateError,
} from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining

describe('getGlobalRegistry', () => {
    describe('globalRef', () => {
        it('returns a new global reference', () => {
            expect(globalRef(() => 3)).toEqual(
                objectContaining({
                    initialized: false,
                })
            )
        })

        it('adds an initializer ref to the global registry', () => {
            const globalRegistry = getGlobalRegistry()
            const spy = createSpy().and.returnValue(3)
            const size = globalRegistry.size
            const ref = globalRef(spy)
            expect(globalRegistry.size).toBe(size + 1)
            globalRegistry.unregister(ref)
        })
    })

    describe('GlobalRefImpl', () => {
        describe('value', () => {
            it('returns the value produced by the initializer', () => {
                const ref = new GlobalRefImpl(() => 1)
                expect(ref.value).toBe(1)
                expect(ref.value).toBe(1)
            })

            it('calls the initializer only once', () => {
                const spy = createSpy().and.returnValue(1)
                const ref = new GlobalRefImpl(spy)
                expect(ref.value).toBe(1)
                expect(ref.value).toBe(1)
                expect(spy).toHaveBeenCalledTimes(1)
            })
        })

        describe('set', () => {
            describe('when already initialized', () => {
                it('throws', () => {
                    const original = new GlobalRefImpl(() => 'original')
                    original.initialize()
                    expect(() => {
                        original.set(() => 'override')
                    }).toThrowError(IllegalStateError)
                })
            })

            it('overrides the initializer', () => {
                const spy = createSpy().and.returnValue(1)
                const ref = new GlobalRefImpl(spy)
                ref.set(() => 2)
                expect(ref.value).toBe(2)
                expect(spy).not.toHaveBeenCalled()
            })

            it('provides the previous initializer for chaining', () => {
                const ref = new GlobalRefImpl(() => 1)
                const override = ref.set((original) => original() + 1)
                expect(ref.value).toBe(2)
                ref.reset()
                expect(ref.value).toBe(1)
                ref.reset()
                const override2 = override.set((original) => original() + 0.1)
                expect(ref.value).toBe(2.1)
                override2.reset()
                expect(ref.value).toBe(2.1)
            })

            describe('when reset', () => {
                it('uses the original initializer', () => {
                    const spy1 = createSpy().and.returnValue(1)
                    const spy2 = createSpy().and.returnValue(2)
                    const ref = new GlobalRefImpl(spy1)

                    ref.set(spy2)
                    expect(ref.value).toBe(2)
                    expect(spy1).not.toHaveBeenCalled()
                    ref.reset()
                    expect(ref.value).toBe(1)
                })
            })

            describe('returns a GlobalRef', () => {
                let original: GlobalRefImpl<string>
                let override: GlobalRef<string>

                beforeEach(() => {
                    original = new GlobalRefImpl(() => 'original')
                    override = original.set(() => 'override')
                })

                describe('value', () => {
                    it('returns the overridden value', () => {
                        expect(override.value).toBe('override')
                    })
                })

                describe('initialized', () => {
                    it('delegates', () => {
                        expect(override.initialized).toBeFalse()
                        original.initialize()
                        expect(override.initialized).toBeTrue()
                    })
                })

                describe('initialize', () => {
                    it('sets the initializer on the original ref', () => {
                        override.initialize()
                        expect(original.value).toBe('override')
                        original.reset()
                        override.initialize()
                        expect(original.value).toBe('override')
                    })
                })

                describe('reset', () => {
                    it('resets the original ref', () => {
                        override.reset()
                        expect(original.initialized).toBeFalse()
                        expect(original.value).toBe('override')
                        override.reset()
                        expect(original.initialized).toBeFalse()
                    })

                    it('sets the overridden initializer', () => {
                        override.reset()
                        expect(original.value).toBe('override')
                    })
                })

                describe('set', () => {
                    it('sets a new override', () => {
                        const override2 = original.set(() => 'override2')
                        expect(original.value).toBe('override2')
                        expect(override.value).toBe('override2')
                        expect(override2.value).toBe('override2')
                    })
                })
            })
        })

        describe('reset', () => {
            it('sets the ref back to its pre-initialized state', () => {
                const ref = new GlobalRefImpl(
                    createSpy().and.returnValues(1, 2, 3)
                )
                expect(ref.value).toBe(1)
                expect(ref.value).toBe(1)
                ref.reset()
                expect(ref.initialized).toBeFalse()
                expect(ref.value).toBe(2)
                ref.reset()
                expect(ref.value).toBe(3)
            })

            it('disposes disposable values', () => {
                const ref = new GlobalRefImpl(() => {
                    return {
                        dispose: createSpy('dispose'),
                    }
                })
                const d = ref.value
                ref.reset()
                expect(d.dispose).toHaveBeenCalledOnceWith()
            })
        })

        describe('initialize', () => {
            describe('when failed', () => {
                it('can be set to a new initializer', () => {
                    const ref = new GlobalRefImpl<number>(() => {
                        throw new Error('expected')
                    })
                    expect(() => ref.initialize()).toThrowError('expected')
                    ref.set(() => 3)
                    expect(ref.value).toBe(3)
                })
            })

            describe('while constructing', () => {
                it('throws an IllegalStateError', () => {
                    const ref = new GlobalRefImpl(() => {
                        ref.initialize()
                    })
                    expect(() => ref.initialize()).toThrowError(
                        IllegalStateError
                    )
                })
            })
        })
    })

    describe('GlobalRegistry', () => {
        let registry: GlobalRegistry

        beforeEach(() => {
            registry = new GlobalRegistry()
        })

        describe('register', () => {
            it('adds a global reference', () => {
                const spy1 = createSpy()
                const spy2 = createSpy()
                const spy3 = createSpy()
                registry.register(new GlobalRefImpl(spy1))
                registry.register(new GlobalRefImpl(spy2))
                registry.register(new GlobalRefImpl(spy3))
                expect(registry.size).toBe(3)
            })
        })

        describe('unregister', () => {
            it('removes an initializer', () => {
                const spy1 = createSpy().and.returnValue(1)
                const spy2 = createSpy().and.returnValue(2)
                const spy3 = createSpy().and.returnValue(3)
                const ref1 = registry.register(new GlobalRefImpl(spy1))
                const ref2 = registry.register(new GlobalRefImpl(spy2))
                const ref3 = registry.register(new GlobalRefImpl(spy3))
                registry.unregister(ref2)
                registry.unregister(ref3)
                expect(registry.size).toBe(1)
                expect(ref1.value).toBe(1)
                expect(ref2.value).toBe(2)
                expect(ref3.value).toBe(3)
                spy1.calls.reset()
                registry.reset()
                expect(ref1.initialized).toBeFalse()
                expect(ref2.initialized).toBeTrue()
                expect(ref3.initialized).toBeTrue()
            })
        })

        describe('reset', () => {
            it('resets all refs', () => {
                const factory = () => {
                    return {
                        dispose: createSpy('dispose'),
                    }
                }
                const spy1 = createSpy().and.callFake(factory)
                const spy2 = createSpy().and.callFake(factory)
                const spy3 = createSpy().and.callFake(factory)
                const ref1 = registry.register(new GlobalRefImpl(spy1))
                const ref2 = registry.register(new GlobalRefImpl(spy2))
                const ref3 = registry.register(new GlobalRefImpl(spy3))
                const v1 = ref1.value
                const v2 = ref2.value
                const v3 = ref3.value
                registry.reset()
                expect(v1.dispose).toHaveBeenCalledOnceWith()
                expect(v2.dispose).toHaveBeenCalledOnceWith()
                expect(v3.dispose).toHaveBeenCalledOnceWith()
                expect(ref1.value).not.toBe(v1)
                expect(ref2.value).not.toBe(v2)
                expect(ref3.value).not.toBe(v3)
            })
        })
    })
})
