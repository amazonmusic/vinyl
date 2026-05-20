/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process'

const ESC = '\x1b['

/**
 * ANSI escape codes
 * https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797
 */
export const ansi = {
    cursorLeft: ESC + 'G',
    eraseLine: ESC + '2K',
    cursorUp: (count: number = 1): string => `${ESC}${count}A`,
    cursorDown: (count: number = 1): string => `${ESC}${count}B`,

    eraseLines(count: number): string {
        if (!count) return ''
        let clear = ''
        for (let i = 0; i < count; i++) {
            clear += ansi.eraseLine
            if (i < count - 1) clear += ansi.cursorUp()
        }
        clear += ansi.cursorLeft
        return clear
    },

    // Colors
    red: ESC + '31m',
    green: ESC + '32m',
    yellow: ESC + '33m',
    resetColor: ESC + '0m',
} as const

/**
 * Returns the number of log lines a message will occupy.
 * @param message
 */
export function calculateLogLines(message: string): number {
    const columns = process.stdout.columns
    // Split the message by newline characters to handle explicit new lines
    const lines = message.split('\n')
    let totalLines = 0
    lines.forEach((line) => {
        // If the line is empty, count the line break.
        totalLines += Math.ceil(line.length / columns) || 1
    })
    return totalLines
}

const percentFormatter = new Intl.NumberFormat(undefined, {
    style: 'percent',
})

export function progressBar(percent: number, width: number = 50): string {
    const percentStr = percentFormatter.format(percent)
    const n = Math.floor(Math.min(Math.max(percent + 0.001, 0), 1) * width)
    // Show the angle bracket up until 100%
    const remainingStr = n < width ? `>${' '.repeat(width - n - 1)}` : ''
    return `[${'='.repeat(n)}${remainingStr}] ${percentStr}`
}
