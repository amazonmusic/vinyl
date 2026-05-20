/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { windowEvents } from '@/util/interaction'
import { createErrorHandler } from '@/errorHandler'
import {
    Abort,
    createDisposer,
    type Disposable,
    EventHostImpl,
    getSearchParams,
    globalRef,
    logDebug,
    LruCache,
    type Maybe,
    type MaybePromise,
    memoize,
    type MemoizedFunction,
    type ReadonlyEventHost,
    ReportableError,
    type Unsubscribe,
    ValidationError,
    withAbort,
} from '@amazon/vinyl-util'
import { startViewTransition } from '@/util/viewTransition'
import { scrollToTop } from '@/util/domUtil'

type RouteParams = Record<string, string>
export type RouteViewFactory<T extends RouteParams> = (
    params: T,
    path: string
) => MaybePromise<Element | null>

const ROUTE_CACHE_CAPACITY = 3

export type PropsFromKeys<Keys extends readonly string[]> = {
    readonly [K in Keys[number]]: string
}

const trailingSlash = /\/+$/

export interface RouterOptions {
    readonly useHashbang?: boolean
}

export interface RouterConfigureOptions {
    readonly stage: HTMLElement
    readonly routes: RouteOptions<any>[]
}

export interface RouteOptions<Keys extends readonly string[]> {
    readonly pattern: string
    readonly paramNames: Keys
    readonly factory: RouteViewFactory<PropsFromKeys<Keys>>
    readonly cacheCapacity?: number
}

interface Route {
    readonly regex: RegExp
    readonly paramNames: readonly string[]
    readonly factory: MemoizedFunction & RouteViewFactory<any>
}

export interface NavigatingEvent {
    readonly previous: string | null
    readonly current: string
    readonly defaultPrevented: boolean
    preventDefault(): void
}

class NavigatingEventImpl implements NavigatingEvent {
    defaultPrevented: boolean = false

    constructor(
        readonly previous: string | null,
        readonly current: string
    ) {}

    preventDefault(): void {
        this.defaultPrevented = true
    }
}

export interface NavigateEvent {
    readonly previous: string | null
    readonly current: string
}

interface RouterEventMap {
    readonly navigating: NavigatingEvent
    readonly navigate: NavigateEvent
}

export interface Router extends ReadonlyEventHost<RouterEventMap> {
    configure(options: RouterConfigureOptions): void
    clearRoutes(): void
    hardReload(): void
    navigateTo(path: string, pushHistory?: boolean): void
    back(): void
}

export class RouterImpl
    extends EventHostImpl<RouterEventMap>
    implements Router, Disposable
{
    get [Symbol.toStringTag](): string {
        return 'RouterImpl'
    }

    private routes: readonly Route[] | null = null
    private readonly errorHandler = createErrorHandler()

    private setStageAbort = new Abort()
    private readonly disposer = createDisposer()
    private currentPath: string | null = null
    private readonly useHashbang: boolean

    private view!: HTMLElement

    constructor(options?: RouterOptions) {
        super()
        this.useHashbang = options?.useHashbang ?? false
        this.initialize()
    }

    private initialize(): void {
        const { add } = this.disposer
        const handleStateChange = () => {
            const path = this.getWindowPath()
            this.navigateTo(path, false)
        }
        add(windowEvents.on('popstate', handleStateChange))
        history.scrollRestoration = 'manual'
    }

    configure(options: RouterConfigureOptions): void {
        this.currentPath = null
        this.view = options.stage

        const routes: Route[] = []
        for (const routeOptions of options.routes) {
            const { paramNames, pattern, cacheCapacity, factory } = routeOptions
            paramNames.forEach((paramName: any) => {
                if (!pattern.includes(`:${paramName}`))
                    throw new ValidationError(`missing :${paramName} in route`)
            })

            const regexPattern = pattern
                .replace(/\/+$/, '')
                .replace(/\/:([a-zA-Z0-9_]+)/g, `(?:/([^/]+))`)
            logDebug(this, 'registered route:', regexPattern)

            const regex = new RegExp(`^${regexPattern}/?$`)

            const route: Route = {
                regex,
                paramNames,
                factory: memoize(
                    async (params, path) =>
                        (await factory(params, path)) ?? null,
                    (_, path) => path,
                    cacheCapacity ?? ROUTE_CACHE_CAPACITY
                ),
            }
            routes.push(route)
        }
        this.routes = routes
        this.navigateTo(this.getWindowPath())
    }

    clearRoutes() {
        this.clear()
        this.clearRouteCaches()
        this.routes = null
    }

    private hasNavigated = false

    private readonly scrollPositions = new LruCache<string, number>(20)

    private saveScrollPosition() {
        const path = window.location.href
        this.scrollPositions.set(path, window.scrollY)
    }

    private restoreScrollPosition() {
        const path = window.location.href
        const y = this.scrollPositions.get(path) ?? 0
        window.scrollTo({ top: y, behavior: 'auto' })
    }

    private getWindowPath() {
        if (this.useHashbang) {
            const hash = window.location.hash
            if (hash.startsWith('#!')) {
                return hash.substring(2) || '/'
            }
            return '/'
        }
        return window.location.pathname || '/'
    }

    navigateTo(path: string, pushHistory = true) {
        if (!path.startsWith('/')) path = '/' + path
        if (this.currentPath === path) {
            logDebug(this, 'navigateTo no-op:', path)
            return
        }
        const previousPath = this.currentPath
        const event = new NavigatingEventImpl(previousPath, path)
        this.dispatch('navigating', event)
        if (event.defaultPrevented) {
            logDebug(this, 'navigateTo prevented', path)
            return
        }

        logDebug(this, 'navigateTo', path, pushHistory)
        this.saveScrollPosition()

        const isFirst = !this.hasNavigated
        this.hasNavigated = true
        this.currentPath = path

        this.dispatch('navigate', {
            previous: previousPath,
            current: this.currentPath,
        })
        if (pushHistory) {
            const url = new URL(window.location.href)
            if (this.useHashbang) {
                url.hash = '!' + path
            } else {
                url.pathname = path
            }
            const newPath = url.toString()
            history.pushState(null, '', newPath)
        }
        const doTransition = async () => {
            await this.refreshStage()
            if (pushHistory) scrollToTop()
            else this.restoreScrollPosition()
        }
        if (isFirst) doTransition().catch(this.errorHandler)
        else startViewTransition(doTransition).catch(this.errorHandler)
    }

    private clear() {
        logDebug(this, 'clear')
        this.setStage(null).catch(this.errorHandler)
        this.currentPath = null
    }

    private clearRouteCaches() {
        this.routes?.forEach((route) => route.factory.clear())
    }

    private matchRoute(
        path: string
    ): { factory: RouteViewFactory<any>; params: RouteParams } | null {
        if (!this.routes) return null
        const normalizedPath =
            path !== '/' ? path.replace(trailingSlash, '') : path
        logDebug(this, 'normalizedPath:', normalizedPath)
        for (const { regex, paramNames, factory } of this.routes) {
            const match = normalizedPath.match(regex)
            if (match) {
                const params: RouteParams = {}
                paramNames.forEach((name, i) => {
                    const value = match[i + 1] as string | undefined
                    if (value != null) {
                        params[name] = decodeURIComponent(value)
                    }
                })
                return { factory, params }
            }
        }
        return null
    }

    private async refreshStage(): Promise<void> {
        if (!this.routes) return
        const path = this.currentPath
        if (!path) {
            await this.setStage(null)
            return
        }
        const matched = this.matchRoute(path)
        if (!matched) throw new MissingRouteError(path)

        const { factory, params } = matched
        await this.setStage(() => factory(params, path))
    }

    private async setStage(
        viewFactory: Maybe<() => MaybePromise<Element | null>>
    ): Promise<void> {
        this.setStageAbort.abort()
        this.setStageAbort = new Abort()
        const abort = this.setStageAbort

        const stage = this.view
        stage.innerHTML = ''
        if (!viewFactory) return Promise.resolve()

        const view = await withAbort(Promise.resolve(viewFactory()), abort)
        if (view) {
            stage.appendChild(view)
        }
    }

    hardReload() {
        logDebug(this, 'hardReload')
        this.clear()
        this.clearRouteCaches()
        this.navigateTo(this.getWindowPath())
    }

    back() {
        if (!this.hasNavigated) {
            this.navigateTo('/')
        } else {
            history.back()
        }
    }

    dispose() {
        this.setStage(null).catch(this.errorHandler)
        this.clearRoutes()
        this.disposer.dispose()
    }
}

export const routerRef = globalRef(
    () =>
        new RouterImpl({
            useHashbang: !getSearchParams().has('useCleanRoutes'),
        })
)

export function getRouter(): Router {
    return routerRef.value
}

export function navigateTo(path: string) {
    getRouter().navigateTo(path)
}

export function onNavigate(
    handler: (event: NavigateEvent) => void
): Unsubscribe {
    return getRouter().on('navigate', handler)
}

export class MissingRouteError extends ReportableError {
    constructor(readonly path: string) {
        super(`No route registered for path: ${path}`)
    }
}

export function back() {
    getRouter().back()
}
