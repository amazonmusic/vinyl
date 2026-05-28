/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { OverviewPage } from './components/OverviewPage'
import { PlayerPage } from './components/PlayerPage'
import type { RouteOptions, PropsFromKeys } from './router/router'

export const routes: RouteOptions<any>[] = [
    {
        pattern: '/',
        paramNames: [],
        factory: () => OverviewPage(),
    },
    {
        pattern: '/player',
        paramNames: [],
        factory: () => PlayerPage(),
    },
    {
        pattern: '/docs',
        paramNames: [],
        factory: async () => {
            return (await import('./components/DocsPage')).DocsPage(null)
        },
    },
    {
        pattern: '/docs/:slug',
        paramNames: ['slug'],
        factory: async ({ slug }: PropsFromKeys<['slug']>) => {
            return (await import('./components/DocsPage')).DocsPage(slug)
        },
    },
]
