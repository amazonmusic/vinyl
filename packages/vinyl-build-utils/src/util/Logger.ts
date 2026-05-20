/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ansi, calculateLogLines } from './console'
import process from 'node:process'

export enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR,
}

/**
 * A simple console logger that allows for a sticky footer for progress reporting.
 */
export class Logger {
    level = LogLevel.INFO

    private stickyLines = 0
    private stickyMessage: string | null = null

    /**
     * Sets a sticky footer.
     * This should not be used in a CI environment, logging to files does not support ANSI cursor codes.
     *
     * @param message The message to fix to the tail of the console. A newline character will be appended.
     */
    sticky(message?: string | null) {
        this.eraseSticky()
        if (message != null) {
            this.stickyMessage = message + '\n'
            this.stickyLines = calculateLogLines(this.stickyMessage)
            this.writeSticky()
        } else {
            this.stickyMessage = null
            this.stickyLines = 0
        }
    }

    /**
     * Clears the sticky message.
     */
    clearSticky() {
        this.sticky(null)
    }

    private eraseSticky(): void {
        if (this.stickyMessage != null) {
            process.stdout.write(ansi.eraseLines(this.stickyLines))
        }
    }

    private writeSticky() {
        if (this.stickyMessage != null) {
            process.stdout.write(this.stickyMessage)
        }
    }

    debug(...messages: any[]) {
        this.log(LogLevel.DEBUG, ...messages)
    }

    info(...messages: any[]) {
        this.log(LogLevel.INFO, ...messages)
    }

    warn(...messages: any[]) {
        this.log(LogLevel.WARN, ...messages)
    }

    error(...messages: any[]) {
        this.log(LogLevel.ERROR, ...messages)
    }

    log(level: LogLevel, ...messages: any[]): void {
        if (this.level > level) return
        this.eraseSticky()
        switch (level) {
            case LogLevel.DEBUG:
                console.log(...messages)
                break
            case LogLevel.INFO:
                console.info(...messages)
                break
            case LogLevel.WARN:
                console.warn(...messages)
                break
            case LogLevel.ERROR:
                console.error(...messages)
                break
        }
        this.writeSticky()
    }
}

export const logger = new Logger()
