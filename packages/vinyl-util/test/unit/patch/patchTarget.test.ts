/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    DisposedError,
    IllegalArgumentError,
    logPatchedEvents,
    type LogTarget,
    noop,
    type PatchedRef,
    patchTarget,
    patchTargetFromFlags,
    SignalImpl,
} from '@amazon/vinyl-util'
import {
    implementEventFakes,
    MockCustomEvent,
    MockEvent,
    mockEvent,
    MockEventTarget,
    polyfillCustomEvent,
} from '@amazon/vinyl-util/browserTestUtil'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining
import Spy = jasmine.Spy

class DetailEvent<T> extends MockEvent {
    constructor(
        type: string,
        readonly detail: T
    ) {
        super()
        this.type = type
    }
}

interface EventMap {
    eventA: DetailEvent<number>
    eventB: DetailEvent<string>
    eventC: DetailEvent<boolean>
}

class ProxyTarget extends MockEventTarget {
    propA = false
    propB = 'testB'
    readonly hasAnyListeners: () => boolean

    constructor() {
        super()
        this.hasAnyListeners = implementEventFakes(this).hasAnyListeners
    }
}

describe('patchTarget', () => {
    polyfillCustomEvent()

    it('intercepts patched properties', () => {
        const target = new ProxyTarget()

        const patched = patchTarget<ProxyTarget, EventMap>(target, () => ({
            properties: {
                propB: {
                    get() {
                        return `overridden`
                    },

                    set(value) {
                        target.propB = `${value}_overridden`
                    },
                },
            },
            dispose() {},
        })).patched

        // Not overridden
        patched.propA = true
        expect(patched.propA).toBeTrue()

        // Overridden
        expect(patched.propB).toEqual('overridden')
        // Does not change original target:
        expect(target.propB).toEqual('testB')
        patched.propB = 'test2'
        expect(target.propB).toEqual('test2_overridden')
    })

    it('redirects proxy receiver to the target', () => {
        class Foo extends MockEventTarget {
            bar = 42
            getBar() {
                return this.bar
            }
        }
        const target = new Foo()

        const patched = patchTarget(target, () => ({
            properties: {
                bar: {
                    get() {
                        return -1
                    },
                },
            },
            dispose() {},
        })).patched

        expect(patched).toBeInstanceOf(Foo)
        expect(patched.getBar()).toEqual(42)
        expect(patched.getBar.apply({ bar: 43 })).toEqual(43)
    })

    describe('removeEventListener', () => {
        it('removes handlers', () => {
            // Test fabricated, patched, and un-patched handler removal.
            const eventFabricated = new SignalImpl<Event>()
            const target = new ProxyTarget()
            const patched = patchTarget<ProxyTarget, EventMap>(target, () => ({
                eventFabricated,
                events: {
                    eventA: (event) => {
                        return event
                    },
                },
                dispose() {},
            })).patched
            const eventASpy = createSpy('eventA')
            patched.addEventListener('eventA', eventASpy)
            const eventBSpy = createSpy('eventB')
            patched.addEventListener('eventB', eventBSpy)
            const eventCSpy = createSpy('eventC')
            patched.addEventListener('eventC', eventCSpy)

            // sanity test listeners
            target.dispatchEvent(new DetailEvent('eventA', 1))
            expect(eventASpy).toHaveBeenCalledTimes(1)
            eventASpy.calls.reset()
            target.dispatchEvent(new DetailEvent('eventB', 'a'))
            expect(eventBSpy).toHaveBeenCalledTimes(1)
            eventBSpy.calls.reset()
            eventFabricated.dispatch(new DetailEvent('eventC', true))
            expect(eventCSpy).toHaveBeenCalledTimes(1)
            eventCSpy.calls.reset()

            patched.removeEventListener('eventA', eventASpy)
            patched.removeEventListener('eventB', eventBSpy)
            patched.removeEventListener('eventC', eventCSpy)

            target.dispatchEvent(new DetailEvent('eventA', 1))
            expect(eventASpy).not.toHaveBeenCalled()
            target.dispatchEvent(new DetailEvent('eventB', 'a'))
            expect(eventBSpy).not.toHaveBeenCalled()
            eventFabricated.dispatch(new DetailEvent('eventC', true))
            expect(eventCSpy).not.toHaveBeenCalled()

            expect(() => patched.removeEventListener('eventA', null)).toThrow(
                new IllegalArgumentError(
                    'only function callbacks are supported'
                )
            )

            // Should do nothing:
            patched.removeEventListener('eventD', noop)
        })
    })

    describe('addEventListener', () => {
        it('throws when callback is not a function', () => {
            const target = new ProxyTarget()
            const patched = patchTarget<ProxyTarget, EventMap>(target, () => ({
                events: {},
                dispose() {},
            })).patched
            expect(() => patched.addEventListener('eventA', null)).toThrow(
                new IllegalArgumentError(
                    'only function callbacks are supported'
                )
            )
        })

        it('respects options.once flag', () => {
            const target = new ProxyTarget()
            const patched = patchTarget<ProxyTarget, EventMap>(target, () => ({
                events: {},
                dispose() {},
            })).patched

            const eventASpy = createSpy('eventA')
            patched.addEventListener('eventA', eventASpy, { once: true })
            target.dispatchEvent(new DetailEvent('eventA', 1))
            target.dispatchEvent(new DetailEvent('eventA', 1))
            expect(eventASpy).toHaveBeenCalledTimes(1)

            const eventBSpy = createSpy('eventB')
            patched.addEventListener('eventB', eventBSpy, {})
            target.dispatchEvent(new DetailEvent('eventB', 'a'))
            target.dispatchEvent(new DetailEvent('eventB', 'a'))
            expect(eventBSpy).toHaveBeenCalledTimes(2)
        })
    })

    it('intercepts patched events', () => {
        const target = new ProxyTarget()
        let eventBCount = 0
        let eventCCount = 0
        const patched = patchTarget<ProxyTarget, EventMap>(target, () => ({
            events: {
                eventB() {
                    ++eventBCount
                    return new DetailEvent('eventB', 'overridden')
                },
                eventC(event) {
                    ++eventCCount
                    if (event.detail) return null
                    return event
                },
            },
            dispose() {},
        })).patched
        const eventASpy = createSpy('eventA')
        patched.addEventListener('eventA', eventASpy)
        const eventA2Spy = createSpy('eventA')
        patched.addEventListener('eventA', eventA2Spy)
        const eventBSpy = createSpy('eventB')
        patched.addEventListener('eventB', eventBSpy)
        const eventB2Spy = createSpy('eventB')
        patched.addEventListener('eventB', eventB2Spy)
        const eventCSpy = createSpy('eventC')
        patched.addEventListener('eventC', eventCSpy)

        target.dispatchEvent(new DetailEvent('eventA', 3))
        expect(eventASpy).toHaveBeenCalledOnceWith(
            objectContaining({
                detail: 3,
            })
        )
        expect(eventA2Spy).toHaveBeenCalledOnceWith(
            objectContaining({
                detail: 3,
            })
        )
        target.dispatchEvent(new DetailEvent('eventB', 'original')) // 1st
        expect(eventBSpy).toHaveBeenCalledOnceWith(
            objectContaining({
                detail: 'overridden',
            })
        )
        expect(eventB2Spy).toHaveBeenCalledOnceWith(
            objectContaining({
                detail: 'overridden',
            })
        )
        target.dispatchEvent(new DetailEvent('eventC', true)) // 1st
        expect(eventCSpy).not.toHaveBeenCalled()
        target.dispatchEvent(new DetailEvent('eventC', false)) // 2nd
        expect(eventCSpy).toHaveBeenCalledOnceWith(
            objectContaining({
                detail: false,
            })
        )

        // Expect that the event interceptors are called once per event
        expect(eventBCount).withContext('eventBCount').toBe(1)
        expect(eventCCount).withContext('eventCCount').toBe(2)
    })

    it('does not intercept synthetic events', () => {
        const target = new ProxyTarget()
        const eventFabricated = new SignalImpl<Event>()
        const eventAInterceptedSpy = createSpy('eventAIntercepted')
        const patched = patchTarget<ProxyTarget, EventMap>(target, () => ({
            eventFabricated,
            events: {
                eventA: eventAInterceptedSpy,
            },
            dispose() {},
        })).patched
        const eventASpy = createSpy('eventA')
        patched.addEventListener('eventA', eventASpy)

        const event = new DetailEvent('eventA', 1)
        eventFabricated.dispatch(event)
        expect(eventAInterceptedSpy).not.toHaveBeenCalled()
        expect(eventASpy).toHaveBeenCalledOnceWith(event)
    })

    it('delegates un-patched events', () => {
        const target = new ProxyTarget()
        const patched = patchTarget<ProxyTarget, EventMap>(target, () => ({
            dispose() {},
        })).patched
        const eventASpy = createSpy('eventA')
        patched.addEventListener('eventA', eventASpy)
        const eventBSpy = createSpy('eventB')
        patched.addEventListener('eventB', eventBSpy)

        target.dispatchEvent(new DetailEvent('eventA', 1))
        expect(eventASpy).toHaveBeenCalledOnceWith(
            objectContaining({
                detail: 1,
            })
        )

        target.dispatchEvent(new DetailEvent('eventB', 'a'))
        expect(eventBSpy).toHaveBeenCalledOnceWith(
            objectContaining({
                detail: 'a',
            })
        )
    })

    it('fabricates events', () => {
        const target = new ProxyTarget()
        const eventFabricated = new SignalImpl<Event>()
        const patched = patchTarget<ProxyTarget, EventMap>(target, () => ({
            eventFabricated,
            dispose() {},
        })).patched
        const eventASpy = createSpy('eventA')
        patched.addEventListener('eventA', eventASpy)
        const event = new DetailEvent('eventA', 1)
        eventFabricated.dispatch(event)
        expect(eventASpy).toHaveBeenCalledOnceWith(event)
    })

    describe('when target is not an EventTarget', () => {
        it('does not patch events', () => {
            const patchedRef = patchTarget(
                {
                    foo: 4,
                },
                () => ({
                    properties: {
                        foo: {
                            get() {
                                return 3
                            },
                        },
                    },
                    dispose() {},
                })
            )
            expect(patchedRef.patched.foo).toBe(3)
            expect(
                // @ts-expect-error Not defined
                patchedRef.patched.addEventListener
            ).toBeUndefined()
        })
    })

    describe('when patch does not have eventFabricated or patched events', () => {
        it('delegates to addEventListener and removeEventListener directly', () => {
            const target = new ProxyTarget()
            const patchedRef = patchTarget(target, () => ({
                dispose() {},
            }))
            const handler = () => {}
            patchedRef.patched.addEventListener('eventA', handler)
            expect(target.addEventListener).toHaveBeenCalledOnceWith(
                'eventA',
                handler
            )
            patchedRef.patched.removeEventListener('eventA', handler)
            expect(target.removeEventListener).toHaveBeenCalledOnceWith(
                'eventA',
                handler
            )
            expect(target.hasAnyListeners()).toBeFalse()
        })
    })

    describe('onEventSquelched', () => {
        it('is invoked when an event is squelched', () => {
            const target = new ProxyTarget()
            const patchedRef = patchTarget<ProxyTarget, EventMap>(
                target,
                () => ({
                    events: {
                        eventA() {
                            return null
                        },
                    },
                    dispose() {},
                })
            )
            const squelchedSpy = createSpy('squelchedSpy')
            patchedRef.eventSquelched.listen(squelchedSpy)
            const e = new DetailEvent('eventA', 1)
            target.dispatchEvent(e)
            expect(squelchedSpy).toHaveBeenCalledOnceWith(e)
            squelchedSpy.calls.reset()
            target.dispatchEvent(new DetailEvent('eventB', 'a'))
            expect(squelchedSpy).not.toHaveBeenCalled()
        })
    })

    describe('onEventFabricated', () => {
        it('is invoked when an event is fabricated', () => {
            const target = new ProxyTarget()
            const eventFabricated = new SignalImpl<Event>()
            const patchedRef = patchTarget<ProxyTarget, EventMap>(
                target,
                () => ({
                    eventFabricated,
                    dispose() {},
                })
            )
            const fabricatedSpy = createSpy('fabricatedSpy')
            patchedRef.eventFabricated.listen(fabricatedSpy)
            const e = new DetailEvent('eventA', 1)
            eventFabricated.dispatch(e)
            expect(fabricatedSpy).toHaveBeenCalledOnceWith(e)
            fabricatedSpy.calls.reset()
        })
    })

    describe('dispose', () => {
        let target: ProxyTarget
        let dispose: Spy
        let eventFabricated: SignalImpl<Event>
        let patchedRef: PatchedRef<ProxyTarget>

        beforeEach(() => {
            target = new ProxyTarget()
            dispose = createSpy('dispose')
            eventFabricated = new SignalImpl()
            patchedRef = patchTarget<ProxyTarget, EventMap>(target, () => ({
                eventFabricated,
                eventA() {
                    return null
                },
                dispose,
            }))
        })

        it('disposes created patch', () => {
            patchedRef.dispose()
            expect(dispose).toHaveBeenCalledOnceWith()
        })

        describe('when already disposed', () => {
            it('emits a DisposedError', () => {
                {
                    const disposable = patchTarget({}, () => ({
                        dispose() {},
                    }))
                    disposable.dispose()
                    expect(() => disposable.dispose()).toThrowError(
                        DisposedError
                    )
                }
                {
                    const disposable = patchTarget({})
                    disposable.dispose()
                    expect(() => disposable.dispose()).toThrowError(
                        DisposedError
                    )
                }
            })
        })
    })
})

describe('patchTarget with multiple patches', () => {
    polyfillCustomEvent()
    let target: ProxyTarget
    let patchedRef: PatchedRef<ProxyTarget>
    let eventFabricated: SignalImpl<Event>

    beforeEach(() => {
        target = new ProxyTarget()
        eventFabricated = new SignalImpl()
        patchedRef = patchTarget<ProxyTarget, EventMap>(
            target,

            () => ({
                properties: {
                    propA: {
                        get() {
                            return true
                        },
                    },
                },
                dispose() {},
            }),
            () => ({
                properties: {
                    propB: {
                        get() {
                            return 'b'
                        },
                    },
                },
                dispose() {},
            }),
            () => ({
                eventFabricated,
                events: {
                    eventA() {
                        const e = new MockCustomEvent()
                        e.type = 'eventA'
                        e.detail = 42
                        return e
                    },
                    eventB(event) {
                        if (event.detail === 'squelch') return null
                        return event
                    },
                },
                dispose() {},
            })
        )
    })

    it('creates a chain of proxies for all provided patches', () => {
        const patched = patchedRef.patched
        expect(patched.propA).toEqual(true)
        expect(patched.propB).toEqual('b')
        const eventASpy = createSpy('eventA')
        patched.addEventListener('eventA', eventASpy)
        target.dispatchEvent(new DetailEvent('eventA', 1))
        expect(eventASpy).toHaveBeenCalledOnceWith(
            objectContaining({
                type: 'eventA',
                detail: 42,
            })
        )
    })

    describe('onEventSquelched', () => {
        it('is invoked when an event is squelched', () => {
            const squelchedSpy = createSpy('squelchedSpy')
            patchedRef.eventSquelched.listen(squelchedSpy)
            const e = new DetailEvent('eventB', 'squelch')
            target.dispatchEvent(e)
            expect(squelchedSpy).toHaveBeenCalledOnceWith(e)
            squelchedSpy.calls.reset()
            target.dispatchEvent(new DetailEvent('eventB', 'not squelched'))
            expect(squelchedSpy).not.toHaveBeenCalled()
        })
    })

    describe('onEventFabricated', () => {
        it('is invoked when an event is fabricated', () => {
            const fabricatedSpy = createSpy('fabricatedSpy')
            patchedRef.eventFabricated.listen(fabricatedSpy)
            const e = new DetailEvent('eventA', 1)
            eventFabricated.dispatch(e)
            expect(fabricatedSpy).toHaveBeenCalledOnceWith(e)
            fabricatedSpy.calls.reset()
        })
    })

    it('disposes patches in reverse order', () => {
        const target = new ProxyTarget()
        const disposeA = createSpy('disposeA')
        const disposeB = createSpy('disposeB')
        const disposeC = createSpy('disposeC')
        const patchedRef = patchTarget(
            target,
            () => ({
                dispose: disposeA,
            }),
            () => ({
                dispose: disposeB,
            }),
            () => ({
                dispose: disposeC,
            })
        )
        patchedRef.dispose()
        expect(disposeC).toHaveBeenCalledBefore(disposeB)
        expect(disposeB).toHaveBeenCalledBefore(disposeA)
        expect(() => patchedRef.dispose()).toThrow(new DisposedError())
    })
})

describe('logPatchedEvents', () => {
    const loggerRef = useMockLogger()
    it('logs event squelched and fabricated', () => {
        loggerRef.value.debug.calls.reset()
        const eventFabricated = new SignalImpl<Event>()
        const eventSquelched = new SignalImpl<Event>()
        const target: LogTarget = { logPrefix: 'path' }
        logPatchedEvents(target, {
            eventFabricated,
            eventSquelched,
            patched: {},
            dispose() {},
        })
        eventFabricated.dispatch(mockEvent('test'))
        expect(loggerRef.value.debug).toHaveBeenCalledOnceWith(
            target,
            `'test' event fabricated`
        )
        loggerRef.value.debug.calls.reset()
        eventSquelched.dispatch(mockEvent('test2'))
        expect(loggerRef.value.debug).toHaveBeenCalledOnceWith(
            target,
            `'test2' event squelched`
        )
    })

    describe('when unsubscribe callback is invoked', () => {
        it('unsubscribes from signals', () => {
            const eventFabricated = new SignalImpl<Event>()
            const eventSquelched = new SignalImpl<Event>()
            const target: LogTarget = { logPrefix: 'path' }
            const unsub = logPatchedEvents(target, {
                eventFabricated,
                eventSquelched,
                patched: {},
                dispose() {},
            })
            unsub()
            expect(eventFabricated.empty).toBeTrue()
            expect(eventSquelched.empty).toBeTrue()
        })
    })
})

describe('patchTargetFromFlags', () => {
    const loggerRef = useMockLogger()
    it('patches the target with patches where flag was truthy', () => {
        const target = {
            a: 1,
            b: 2,
            c: 3,
        }
        loggerRef.value.debug.calls.reset()
        const patched = patchTargetFromFlags(
            target,
            {
                a: true,
                b1: false,
                b2: true,
            },
            [
                'a',
                () => ({
                    properties: {
                        a: {
                            get() {
                                return 4
                            },
                        },
                    },
                    dispose() {},
                }),
            ],
            [
                'b1',
                () => ({
                    properties: {
                        a: {
                            get() {
                                return -1
                            },
                        },
                    },
                    dispose() {},
                }),
            ],
            [
                'b2',
                () => ({
                    properties: {
                        b: {
                            get() {
                                return 5
                            },
                        },
                    },
                    dispose() {},
                }),
            ]
        ).patched

        // Note: Proxy on older versions of Chrome has strange key behavior, test properties individually:
        // The patching system may remove Proxy use to support Samsung 2017 models.
        expect(patched.a).toEqual(4)
        expect(patched.b).toEqual(5)
        expect(patched.c).toEqual(3)
        expect(loggerRef.value.debug).toHaveBeenCalledTimes(2)
    })
})
