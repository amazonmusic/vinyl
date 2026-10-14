/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Test bed: MSE changeType() in "sequence" mode.
 *
 * changeType() runs the reset parser state algorithm, which in "sequence" mode sets [[group start timestamp]] to
 * [[group end timestamp]] (https://w3c.github.io/media-source/#sourcebuffer-reset-parser-state), so the next media
 * segment is appended right after the buffered media whatever its timestamps. This appends two 2 s segments, changes
 * type to another codec, then appends a segment whose media time is 38 s. Per the spec the buffer is [0, 6]. WebKit
 * leaves it at [0, 4] and [38, 40]: https://bugs.webkit.org/show_bug.cgi?id=327788
 *
 * Used by testResources/errata/mse-changetype-sequence.html and the vinyl errata integ spec.
 */
;(function () {
    var BASE =
        'https://assets.dev.vinyl.music.amazon.dev/dash/vinyl_ad_breaks_av/segments/'
    var FIRST = {
        dir: BASE + 'libx264_640x360_30fps_600k/',
        type: 'video/mp4; codecs="avc1.64001e"',
    }
    var SECOND = {
        dir: BASE + 'libx264_1280x720_30fps_1500k/',
        type: 'video/mp4; codecs="avc1.64001f"',
    }

    var STEP_TIMEOUT_MS = 15000

    /** Rejects if the promise doesn't settle in time, so a stalled step is reported rather than hanging. */
    function step(onStep, name, promise) {
        onStep(name)
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () {
                reject(
                    new Error(
                        'timed out after ' +
                            STEP_TIMEOUT_MS / 1000 +
                            ' s: ' +
                            name
                    )
                )
            }, STEP_TIMEOUT_MS)
            promise.then(
                function (value) {
                    clearTimeout(timer)
                    resolve(value)
                },
                function (error) {
                    clearTimeout(timer)
                    reject(error)
                }
            )
        })
    }

    function fetchBuffer(url) {
        return fetch(url).then(function (response) {
            if (!response.ok) throw new Error(response.status + ' ' + url)
            return response.arrayBuffer()
        })
    }

    function append(sourceBuffer, data) {
        return new Promise(function (resolve, reject) {
            function done() {
                sourceBuffer.removeEventListener('error', fail)
                resolve()
            }
            function fail() {
                sourceBuffer.removeEventListener('updateend', done)
                reject(new Error('append error'))
            }
            sourceBuffer.addEventListener('updateend', done, { once: true })
            sourceBuffer.addEventListener('error', fail, { once: true })
            sourceBuffer.appendBuffer(data)
        })
    }

    function ranges(sourceBuffer) {
        var result = []
        for (var i = 0; i < sourceBuffer.buffered.length; i++) {
            result.push([
                Math.round(sourceBuffer.buffered.start(i) * 100) / 100,
                Math.round(sourceBuffer.buffered.end(i) * 100) / 100,
            ])
        }
        return result
    }

    /**
     * Resolves to { supported, contiguous, before, after, timestampOffset }.
     * `contiguous` is true when the browser follows the spec. Rejects if a step times out.
     *
     * @param onStep Called with the name of each step as it starts.
     */
    window.runChangeTypeSequenceRepro = async function (onStep) {
        onStep = onStep || function () {}
        if (
            typeof MediaSource === 'undefined' ||
            !('changeType' in SourceBuffer.prototype) ||
            !MediaSource.isTypeSupported(FIRST.type) ||
            !MediaSource.isTypeSupported(SECOND.type)
        ) {
            return { supported: false }
        }
        var buffers = await step(
            onStep,
            'fetch segments',
            Promise.all([
                fetchBuffer(FIRST.dir + 'init.mp4'),
                fetchBuffer(FIRST.dir + 'part_1.m4s'),
                fetchBuffer(FIRST.dir + 'part_2.m4s'),
                fetchBuffer(SECOND.dir + 'init.mp4'),
                fetchBuffer(SECOND.dir + 'part_20.m4s'),
            ])
        )
        var mediaSource = new MediaSource()
        var media = document.createElement('video')
        var url = URL.createObjectURL(mediaSource)
        media.muted = true
        media.src = url
        try {
            await step(
                onStep,
                'sourceopen',
                new Promise(function (resolve) {
                    mediaSource.addEventListener('sourceopen', resolve, {
                        once: true,
                    })
                })
            )
            var sourceBuffer = mediaSource.addSourceBuffer(FIRST.type)
            sourceBuffer.mode = 'sequence'
            await step(
                onStep,
                'append ' + FIRST.type + ' init',
                append(sourceBuffer, buffers[0])
            )
            await step(
                onStep,
                'append part_1',
                append(sourceBuffer, buffers[1])
            )
            await step(
                onStep,
                'append part_2',
                append(sourceBuffer, buffers[2])
            )
            var before = ranges(sourceBuffer)
            onStep('changeType(' + SECOND.type + ')')
            sourceBuffer.changeType(SECOND.type)
            await step(
                onStep,
                'append ' + SECOND.type + ' init',
                append(sourceBuffer, buffers[3])
            )
            await step(
                onStep,
                'append part_20',
                append(sourceBuffer, buffers[4])
            )
            var after = ranges(sourceBuffer)
            return {
                supported: true,
                contiguous: after.length === 1 && after[0][0] === before[0][0],
                before: before,
                after: after,
                timestampOffset:
                    Math.round(sourceBuffer.timestampOffset * 100) / 100,
            }
        } finally {
            media.removeAttribute('src')
            media.load()
            URL.revokeObjectURL(url)
        }
    }
})()
