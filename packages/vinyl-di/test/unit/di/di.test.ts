/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createContainer,
    CyclicDependencyError,
    externalDependencies,
    type Factories,
} from '@amazon/vinyl-di'
import {
    AbortError,
    type AnyRecord,
    Deferred,
    type Disposable,
    DisposedError,
    IllegalStateError,
    noop,
} from '@amazon/vinyl-util'
import { expectTypeExtends } from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy
import Spy = jasmine.Spy
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('di', () => {
    describe('Factories', () => {
        it('is a record type where each property is a function with one argument', () => {
            {
                expectTypeExtends<
                    {
                        readonly a: () => 1
                        readonly b: (deps: { a: number }) => 1
                        readonly c: (deps: { b: number }) => 1
                        readonly d: () => 4
                        readonly e: () => 4
                    },
                    Factories
                >(true)
                expectTypeExtends<3, Factories>(false)
                expectTypeExtends<
                    { readonly a: () => void },
                    Factories<{ a: 3 }>
                >(false)
                expectTypeExtends<{ readonly a: () => 3 }, Factories<{ a: 3 }>>(
                    true
                )
                expectTypeExtends<
                    {
                        readonly a: 3
                    },
                    Factories
                >(false)
                expectTypeExtends<
                    {
                        readonly a: (a: number, b: number) => 3
                    },
                    Factories
                >(false)
            }
        })
    })

    describe('createContainer', () => {
        it('returns an accessor object to get produced dependencies', () => {
            expect(
                createContainer({
                    a: () => 1,
                    b: () => 4,
                    c: (_: { b: number; a: number }) => 3,
                    d: () => 5,
                } as const).dependencies
            ).toEqual(
                objectContaining({
                    a: 1,
                    b: 4,
                    c: 3,
                    d: 5,
                })
            )
        })

        describe('when disposed', () => {
            it('disposes produced dependencies', () => {
                const container = createContainer({
                    a: () => ({ dispose: createSpy('dispose') }),
                    b: () => ({ dispose: createSpy('dispose') }),
                    c: () => ({ dispose: createSpy('dispose') }),
                } as const)
                const deps = container.dependencies
                const aDispose = deps.a.dispose
                const bDispose = deps.b.dispose
                const cDispose = deps.c.dispose
                container.dispose()
                expect(aDispose).toHaveBeenCalledOnceWith()
                expect(bDispose).toHaveBeenCalledOnceWith()
                expect(cDispose).toHaveBeenCalledOnceWith()
            })

            it('disposes dependencies after dependents', () => {
                const container = createContainer({
                    a: () => ({ dispose: createSpy('dispose') }),
                    b: (deps: { a: any }) => {
                        noop(deps.a) // depend on a
                        return { dispose: createSpy('dispose') }
                    },
                    c: (deps: { b: any }) => {
                        noop(deps.b) // depend on b
                        return { dispose: createSpy('dispose') }
                    },
                } as const)
                const deps = container.dependencies
                const cDispose = deps.c.dispose
                const aDispose = deps.a.dispose
                const bDispose = deps.b.dispose
                container.dispose()
                // c, b, a
                expect(cDispose).toHaveBeenCalledBefore(bDispose)
                expect(bDispose).toHaveBeenCalledBefore(aDispose)
            })

            it('throws if dependencies are accessed after disposal', () => {
                const container = createContainer({
                    a: () => ({}),
                    b: () => ({}),
                } as const)
                expect(container.dependencies.a).toBeDefined()
                container.dispose()
                expect(() => container.dependencies.a).toThrow(
                    new DisposedError()
                )
                expect(() => container.dependencies.b).toThrow(
                    new DisposedError()
                )
                expect(() => container.dispose()).toThrow(new DisposedError())
            })

            it('allows dependencies to be created during disposal, disposing them after independents', () => {
                const disposeA = createSpy('disposeA')
                const disposeB = createSpy('disposeB')
                const container = createContainer({
                    a: () => ({
                        dispose: disposeA,
                    }),
                    b: (deps: { readonly a: AnyRecord }) => ({
                        dispose() {
                            noop(deps.a)
                            disposeB()
                        },
                    }),
                } as const)
                expect(container.dependencies.b).toBeDefined()
                container.dispose()
                expect(disposeA).toHaveBeenCalledOnceWith()
                expect(disposeB).toHaveBeenCalledBefore(disposeA)
            })
        })

        it('throws a CyclicDependencyError if the dependencies are cyclical', () => {
            // Set type to any to emulate JS.
            const deps = createContainer<any>({
                a: () => 1,
                b: (deps: { c: number }) => deps.c,
                c: (deps: { a: number; b: number }) => deps.b,
            } as const).dependencies

            expect(() => deps.c).toThrowMatching(
                (e) => e instanceof CyclicDependencyError
            )
        })

        it('lazily constructs dependencies only once', () => {
            const spyA: Spy<() => 1> = createSpy().and.returnValue(1)
            const spyB: Spy<() => 'a'> = createSpy().and.returnValue('a')
            const deps = createContainer({
                a: spyA,
                b: (_: { readonly a: number }) => {
                    return spyB()
                },
            } as const).dependencies
            expect(deps.a).toBe(1)
            expect(deps.a).toBe(1)
            expect(spyA).toHaveBeenCalledTimes(1)
            expect(deps.b).toBe('a')
            expect(spyA).toHaveBeenCalledTimes(1)
            expect(spyB).toHaveBeenCalledTimes(1)
            expect(deps.b).toBe('a')
            expect(spyB).toHaveBeenCalledTimes(1)
        })

        it('provides an add disposable function for optional additional cleanup', () => {
            const d1 = createSpy('d1')
            const d2 = createSpy('d2')
            const d3 = {
                dispose: createSpy('d3'),
            }

            const container = createContainer({
                a: (_, add) => {
                    add(d1)
                    add(d2)
                    add(d3)
                    add(null)
                    add(undefined)
                    return 1
                },
            } as const)

            expect(container.dependencies.a).toBe(1)
            expect(d1).not.toHaveBeenCalled()

            container.dispose()

            expect(d1).toHaveBeenCalledTimes(1)
            expect(d2).toHaveBeenCalledTimes(1)
            expect(d3.dispose).toHaveBeenCalledTimes(1)
        })

        it('does not throw an IllegalStateError if used in enumeration outside of factory invocation', () => {
            const deps = createContainer<any>({
                a: () => 1,
            } as const).dependencies

            expect(() => Object.values(deps)).not.toThrow()
            expect(deps).toEqual(objectContaining({ a: 1 }))
        })

        it('throws an IllegalStateError if used in enumeration during factory invocation', () => {
            const deps = createContainer<any>({
                a: () => 1,
                b: (deps: { a: number }) => {
                    return { ...deps } // Cannot enumerate injector during factory construction
                },
            } as const).dependencies

            expect(() => Object.values(deps)).toThrowError(
                IllegalStateError,
                /Enumeration is not supported/
            )
        })

        it('does not attempt to redefined enumeration guard', () => {
            const deps1 = createContainer<any>({
                a: () => 1,
            } as const).dependencies

            const deps2 = createContainer<any>(
                externalDependencies(deps1)
            ).dependencies

            expect(() => Object.values(deps2)).not.toThrow()
            expect(deps2).toEqual(objectContaining({ a: 1 }))
        })

        describe('when the returned dependency is a promise', () => {
            it('on dispose aborts the promise and disposes the resolved dependency', async () => {
                const d1 = createSpy('d1')
                const d2 = createSpy('d2')
                const deferred = new Deferred<Disposable>()

                const container = createContainer({
                    a: (): Promise<Disposable> => {
                        return Promise.resolve({
                            dispose: d1,
                        })
                    },

                    b: (): Promise<42> => {
                        return Promise.resolve(42)
                    },

                    c: () => {
                        return deferred
                    },
                } as const)

                await expectAsync(container.dependencies.a).toBeResolvedTo(
                    any(Object)
                )

                const d = container.dependencies.c

                container.dispose()

                expect(d1).toHaveBeenCalledTimes(1)

                deferred.resolve({
                    dispose: d2,
                })
                await expectAsync(d).toBeRejectedWithError(AbortError)
                // expect the lazy result to dispose when it settles.
                expect(d2).toHaveBeenCalledTimes(1)
            })
        })
    })

    describe('externalDependencies', () => {
        it('creates dependency factories for provided dependencies', () => {
            const deps = {
                service: { name: 'test-service' },
                config: { port: 8080 },
                logger: { log: () => {} },
            }

            const factories = externalDependencies(deps)

            expect(typeof factories.service).toBe('function')
            expect(typeof factories.config).toBe('function')
            expect(typeof factories.logger).toBe('function')

            const mockAdd = createSpy('add')
            expect(factories.service({}, mockAdd)).toBe(deps.service)
            expect(factories.config({}, mockAdd)).toBe(deps.config)
            expect(factories.logger({}, mockAdd)).toBe(deps.logger)
        })

        it('handles empty dependency object', () => {
            const factories = externalDependencies({})

            expect(Object.keys(factories)).toEqual([])
        })

        it('preserves dependency references without cloning', () => {
            const originalObject = { data: [1, 2, 3] }
            const deps = { shared: originalObject }
            const factories = externalDependencies(deps)

            const mockAdd = createSpy('add')
            expect(factories.shared({}, mockAdd)).toBe(originalObject)
            expect(factories.shared({}, mockAdd) === originalObject).toBe(true)
        })

        it('works with various dependency types', () => {
            const deps = {
                primitive: 42,
                string: 'test',
                boolean: true,
                array: [1, 2, 3],
                object: { nested: true },
                function: () => 'result',
                null: null,
            }

            const factories = externalDependencies(deps)
            const mockAdd = createSpy('add')

            expect(factories.primitive({}, mockAdd)).toBe(42)
            expect(factories.string({}, mockAdd)).toBe('test')
            expect(factories.boolean({}, mockAdd)).toBe(true)
            expect(factories.array({}, mockAdd)).toEqual([1, 2, 3])
            expect(factories.object({}, mockAdd)).toEqual({ nested: true })
            expect(factories.function({}, mockAdd)).toBe(deps.function)
            expect(factories.null({}, mockAdd)).toBe(null)
        })

        it('integrates with dependency container without disposal', () => {
            const mockDisposable = { dispose: createSpy('dispose') }
            const deps = { disposableService: mockDisposable }
            const factories = externalDependencies(deps)

            const container = createContainer(factories)
            expect(container.dependencies.disposableService).toBe(
                mockDisposable
            )

            container.dispose()
            expect(mockDisposable.dispose).not.toHaveBeenCalled()
        })

        it('contrasts with regular dependencies that are disposed', () => {
            const ownedDisposable = { dispose: createSpy('ownedDispose') }
            const regularDisposable = { dispose: createSpy('regularDispose') }

            const factories = {
                ...externalDependencies({ owned: ownedDisposable }),
                regular: () => regularDisposable,
            }

            const container = createContainer(factories)
            expect(container.dependencies.owned).toBe(ownedDisposable)
            expect(container.dependencies.regular).toBe(regularDisposable)

            container.dispose()
            expect(ownedDisposable.dispose).not.toHaveBeenCalled()
            expect(regularDisposable.dispose).toHaveBeenCalledOnceWith()
        })

        it('creates providers that ignore dependency injection parameters', () => {
            const deps = { value: 'test' }
            const factories = externalDependencies(deps)

            const mockAdd = createSpy('add')
            // Provider should ignore deps and add parameters
            expect(factories.value({}, mockAdd)).toBe('test')
            expect(factories.value({ other: 'deps' }, mockAdd)).toBe('test')
        })

        it('lazily references values from the external dependencies object', () => {
            const deps = { value: 'initial' }
            const factories = externalDependencies(deps)

            // Change the value after creating factories
            deps.value = 'updated'

            const mockAdd = createSpy('add')
            // Should return the updated value, proving lazy evaluation
            expect(factories.value({}, mockAdd)).toBe('updated')
        })
    })
})
