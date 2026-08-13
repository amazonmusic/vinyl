import { jsx } from '@amazon/vinyl-tsx'
import type { ObservableValue } from '@amazon/vinyl-observable'
import { combineData, data } from '@amazon/vinyl-observable'
import { clamp, createDisposer, type Unsubscribe } from '@amazon/vinyl-util'
import { windowEvents } from '../util/interaction'
import type { AdBreakInfo, SeekRange } from '@amazon/vinyl'

export interface ScrubBarProps {
    readonly currentTimePercent$: ObservableValue<number>
    readonly fetchedTimePercent$: ObservableValue<number>
    readonly adBreaks$: ObservableValue<readonly AdBreakInfo[]>
    readonly seekRange$: ObservableValue<SeekRange | null>
    readonly onSeekStart?: (percent: number) => void

    /**
     * A callback for the seek command; expected to return a promise that
     * settles when the seek has completed.
     */
    readonly onSeek: (percent: number) => Promise<void>
}

export function ScrubBar(props: ScrubBarProps) {
    const scrubbing$ = data(false)
    const scrubPercent$ = data(0)
    // Only count seeking state initiated from this scrub bar
    // Use the internal scrubPercent$ until the seek completes.
    const seeking$ = data(false)

    const scrubBarPercentCss$ = combineData({
        seeking: seeking$,
        scrubbing: scrubbing$,
        scrubPercent: scrubPercent$,
        currentTimePercent: props.currentTimePercent$,
    }).map(({ seeking, scrubbing, scrubPercent, currentTimePercent }) => {
        return toPercentCss(
            seeking || scrubbing ? scrubPercent : currentTimePercent
        )
    })

    const adMarkers$ = combineData({
        adBreaks: props.adBreaks$,
        seekRange: props.seekRange$,
    }).map(({ adBreaks, seekRange }) => {
        if (!seekRange || seekRange.end <= 0 || !isFinite(seekRange.end))
            return []
        const duration = seekRange.end - seekRange.start
        if (duration <= 0) return []
        return adBreaks.map((b) => {
            // Pre/post-rolls sit at the timeline edges rather than spanning
            // content time, so they render as a 3px pin at the start/end — not
            // a duration-scaled band (which would stretch a long postroll
            // across most of the bar).
            if (b.placement === 'preroll') {
                return { left: '0%', width: '3px' }
            }
            if (b.placement === 'postroll') {
                return { left: 'calc(100% - 3px)', width: '3px' }
            }
            // Midroll: a band scaled by the break's duration, positioned at its
            // start time. When the duration is unknown, fall back to a 3px pin.
            const leftPct = clamp(
                (b.startTime - seekRange.start) / duration,
                0,
                1
            )
            const width =
                b.duration != null && b.duration > 0
                    ? toPercentCss(clamp(b.duration / duration, 0, 1 - leftPct))
                    : '3px'
            return { left: toPercentCss(leftPct), width }
        })
    })

    const bar = (
        <div
            className="progressBarHit"
            onmousedown={(e: MouseEvent) => {
                scrubbing$.value = true
                const pct = updateScrub(e.clientX)
                props.onSeekStart?.(pct)
            }}
            ontouchstart={(e: TouchEvent) => {
                scrubbing$.value = true
                const pct = updateScrub(e.touches[0].clientX)
                props.onSeekStart?.(pct)
            }}
        >
            <div className="progressBarFills">
                <div className="progressBarTrack" />
                <div
                    className="progressBarPrefetched"
                    style={{
                        width: props.fetchedTimePercent$.map(toPercentCss),
                    }}
                />
                <div
                    className="progressBarAdMarkers"
                    onConnect={(el) => {
                        return adMarkers$.onData((markers) => {
                            el.replaceChildren(
                                ...markers.map((m) => (
                                    <div
                                        className="progressBarAdMarker"
                                        style={{
                                            left: m.left,
                                            width: m.width,
                                        }}
                                    />
                                ))
                            )
                        })
                    }}
                />
                <div
                    className="progressFill"
                    style={{ width: scrubBarPercentCss$ }}
                />
                <div
                    className="progressHandle"
                    style={{ left: scrubBarPercentCss$ }}
                />
            </div>
        </div>
    )

    function getScrubPercent(clientX: number): number {
        const rect = bar.getBoundingClientRect()
        return clamp((clientX - rect.left) / rect.width, 0, 1)
    }

    function updateScrub(clientX: number): number {
        const pct = getScrubPercent(clientX)
        scrubPercent$.value = pct
        return pct
    }

    let windowSubs: Unsubscribe | null = null
    scrubbing$.onData((value) => {
        windowSubs?.()
        windowSubs = null
        if (!value) return

        const { add, dispose } = createDisposer()
        windowSubs = dispose

        add(windowEvents.on('mousemove', (e) => updateScrub(e.clientX)))
        add(
            windowEvents.on('touchmove', (e) =>
                updateScrub(e.touches[0].clientX)
            )
        )

        function seekTo(clientX: number): void {
            seeking$.value = true
            scrubbing$.value = false
            void props.onSeek(getScrubPercent(clientX)).finally(() => {
                seeking$.value = false
            })
        }

        add(
            windowEvents.on('mouseup', (e) => {
                seekTo(e.clientX)
            })
        )
        add(
            windowEvents.on('touchend', (e) => {
                if (e.touches.length === 0 && e.changedTouches.length > 0) {
                    seekTo(e.changedTouches[0].clientX)
                }
            })
        )
    })

    return bar
}

function toPercentCss(pct: number): string {
    return `${pct * 100}%`
}
