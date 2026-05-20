/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs'
import type { CopySyncOptions } from 'fs'
import path from 'path'

export interface CopyFilesOptions {
    /**
     * The paths in files will be copied maintaining the relative path from here.
     */
    readonly src: string

    /**
     * The destination directory.
     */
    readonly dest: string

    /**
     * Function to filter copied files/directories. Return
     * `true` to copy the item, `false` to ignore it.
     */
    readonly filter?: (source: string, destination: string) => boolean

    /**
     * If false, an error will not be thrown if the src does not exist.
     */
    readonly required?: boolean

    /**
     * If true, changes to the source will cause the build to repeat.
     */
    readonly watch?: boolean

    /**
     * If true, logs debug messages.
     */
    readonly debug?: boolean
}

/**
 * Recursively copies files and directories from one location to another.
 * Optionally watches matching files for changes.
 */
export function copyFiles(options: CopyFilesOptions) {
    const copyOptions: CopySyncOptions = {
        preserveTimestamps: true,
        recursive: true,
        force: true,
        errorOnExist: false,
    }
    if (options.filter) copyOptions.filter = options.filter
    if (fs.existsSync(options.src)) {
        if (options.debug)
            console.log(`copy: '${options.src}' to '${options.dest}'`)
        fs.cpSync(options.src, options.dest, copyOptions)
    } else {
        if (options.required !== false) {
            throw new Error(`copy: source '${options.src}' does not exist`)
        }
        return
    }
    if (options.watch) {
        fs.watch(options.src, { recursive: true }, (_, filename) => {
            if (filename == null) return
            const src = path.join(options.src, filename)
            const dest = path.join(options.dest, filename)

            if (!fs.existsSync(src)) {
                if (fs.existsSync(dest)) {
                    fs.rmSync(dest, {
                        recursive: true,
                    })
                    if (options.debug)
                        console.log(`copy: deleted '${options.dest}'`)
                }
            } else {
                if (options.filter && !options.filter(src, dest)) return
                if (options.debug) console.log(`copy: ${src} to '${dest}'`)
                fs.cpSync(src, dest, copyOptions)
            }
        })
    }
}
