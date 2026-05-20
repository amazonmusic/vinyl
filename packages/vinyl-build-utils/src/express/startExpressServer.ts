/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Express } from 'express'
import nodeHttps from 'node:https'
import nodeHttp from 'node:http'
import type { SecureContextOptions } from 'node:tls'
import { logger } from '../util/Logger'

export interface ServerHostOptions {
    /**
     * SSL/TLS options.
     */
    readonly https?:
        | {
              readonly context: SecureContextOptions

              /**
               * An SNI hostname, or wildcard (e.g. '*').
               *
               * If the SSL certificates are not present in the credentials folder, this will not be used.
               *
               * Default: 'local.maestro.amazon.dev'
               */
              readonly hostname: string

              /**
               * The port for traffic.
               * Default: 443.
               */
              readonly port?: number
          }
        | undefined
        | null

    /**
     * Settings for an HTTP server.
     * If both `https` and `http` settings are provided, both will be created.
     */
    readonly http?:
        | {
              /**
               * The port for traffic.
               * Default: 80.
               */
              readonly port?: number
          }
        | undefined
        | null

    /**
     * If true, when the address is in use, auto increment and try again.
     * Default: false
     */
    readonly addressInUseAutoIncrement?: boolean
}

export interface ServerDetails {
    /**
     * The url of the server.
     */
    readonly url: string

    /**
     * The port.
     */
    readonly port: number
}

/**
 * A ServerHandle for closing the server and accessing the http and/or https server details.
 * At least one server is guaranteed to have been created.
 */
export interface ServerHandle {
    /**
     * The http server details if it was created.
     */
    readonly http: ServerDetails | null

    /**
     * The https server details if it was created.
     */
    readonly https: ServerDetails | null

    /**
     * Stops the server from accepting new connections and keeps existing connections.
     * A promise is returned which settles on completion.
     */
    close(): Promise<void>
}

export interface CreateServerDeps {
    /**
     * The Express application.
     */
    readonly app: Express
}

/**
 * The maximum number of ports to try when auto-incrementing server ports.
 * This will only be used if `options.addressInUseAutoIncrement` is true.
 */
const MAX_ADDRESS_IN_USE_ATTEMPTS = 10

/**
 * Creates a server for the given express application and settings.
 * Returns a handle for closing.
 */
export async function startExpressServer(
    deps: CreateServerDeps,
    options: ServerHostOptions
): Promise<ServerHandle> {
    const { http, https } = options
    const { app } = deps
    let httpServer: nodeHttp.Server | null = null
    let httpsServer: nodeHttps.Server | null = null
    let httpsDetails: ServerDetails | null = null
    let httpDetails: ServerDetails | null = null
    const maxPortAttempts = options.addressInUseAutoIncrement
        ? MAX_ADDRESS_IN_USE_ATTEMPTS
        : 1

    if (https) {
        // HTTPS
        httpsServer = nodeHttps.createServer(
            (req: nodeHttp.IncomingMessage, res: nodeHttp.ServerResponse) => {
                // call Express and ignore its Promise
                void app(req, res)
            }
        )
        httpsServer.addContext(https.hostname, https.context)

        const startingPort = https.port ?? 443
        const port = await listenWithAddressIncrement(
            httpsServer,
            startingPort,
            maxPortAttempts
        )
        httpsDetails = {
            url: `https://${https.hostname}:${port}`,
            port,
        }
        logger.info(`Server listening at: ${httpsDetails.url}`)
    }

    if (http || !https) {
        // HTTP
        httpServer = nodeHttp.createServer(
            (req: nodeHttp.IncomingMessage, res: nodeHttp.ServerResponse) => {
                void app(req, res)
            }
        )

        const startingPort = http?.port ?? 80
        const port = await listenWithAddressIncrement(
            httpServer,
            startingPort,
            maxPortAttempts
        )
        httpDetails = {
            url: `http://localhost:${port}`,
            port,
        }
        logger.info(`Server listening at: ${httpDetails.url}`)
    }

    return {
        https: httpsDetails,
        http: httpDetails,
        async close() {
            await Promise.all([close(httpServer), close(httpsServer)])
            logger.info(`Stopped server`)
        },
    }
}

/**
 * Promisifies the server listen callback.
 */
function listen(server: nodeHttp.Server, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const errorHandler = (error: Error) => {
            reject(error)
        }
        server.on('error', errorHandler)
        server.listen(port, () => {
            server.removeListener('error', errorHandler)
            resolve()
        })
    })
}

async function listenWithAddressIncrement(
    server: nodeHttp.Server,
    startPort: number,
    maxAttempts: number
): Promise<number> {
    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i
        try {
            await listen(server, port)
            return port
        } catch (error: any) {
            if (i < maxAttempts - 1 && isAddressInUseError(error)) {
                logger.info(`Port ${port} in use, incrementing...`)
            } else {
                throw error
            }
        }
    }
    throw new Error('maxAttempts must be greater than 0')
}

/**
 * Promisifies the server close callback.
 */
function close(server: nodeHttp.Server | null): Promise<void> {
    if (!server) return Promise.resolve()
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error)
            else resolve()
        })
    })
}

function isAddressInUseError(error: Error): boolean {
    return 'code' in error && (error as any).code === 'EADDRINUSE'
}
