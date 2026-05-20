/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Express } from 'express'
import express, { static as expressStatic } from 'express'
import type { Options as ProxyOptions } from 'http-proxy-middleware'
import { createProxyMiddleware } from 'http-proxy-middleware'
import type { ServerHandle, ServerHostOptions } from './startExpressServer'
import { startExpressServer } from './startExpressServer'
import { logger } from '../util/Logger'

export interface ServerOptions extends ServerHostOptions {
    /**
     * The dist directory to serve.
     */
    readonly staticDir: string

    /**
     * Starts the server with proxy middleware.
     * The object should be key / value pairs where the key is the context and the value is ProxyOptions.
     *
     * proxy: {
     *     '/proxy': {
     *         target: 'https://music.amazon.com',
     *         pathRewrite: {
     *             '^/proxy': '',
     *         },
     *     },
     * },
     */
    readonly proxy?: {
        readonly [key: string]: ProxyOptions
    }
}

export function configureExpress(app: Express, config: ServerOptions) {
    // Serve static files. These are copied to dist in build.ts.
    app.use(expressStatic(config.staticDir))

    if (config.proxy) {
        for (const [key, options] of Object.entries(config.proxy)) {
            app.use(
                key,
                createProxyMiddleware({
                    changeOrigin: true,
                    ...options,
                })
            )
        }
    }
}

/**
 * Starts a server with the given configuration.
 *
 * @param config
 */
export function startServer(config: ServerOptions): Promise<ServerHandle> {
    logger.info('Starting server...')
    const app = express()
    configureExpress(app, config)
    return startExpressServer({ app }, config)
}
