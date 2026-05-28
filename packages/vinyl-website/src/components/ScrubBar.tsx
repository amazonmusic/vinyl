import { jsx } from '@amazon/vinyl-tsx'
import type { ObservableValue } from '@amazon/vinyl-observable'
import { combineData, data } from '@amazon/vinyl-observable'
import { clamp, createDisposer, type Unsubscribe } from '@amazon/vinyl-util'
import { windowEvents } from '../util/interaction'

export interface ScrubBarProps {
    readonly currentTimePercent$: ObservableValue<number>
    readonly fetchedTimePercent$: ObservableValue<number>
    readonly seeking$: ObservableValue<boolean>
    readonly onSeekStart?: (percent: number) => void
    readonly onSeek: (percent: number) => void
}

export function ScrubBar(props: ScrubBarProps) {
    const scrubbing$ = data(false)
    const scrubPercent$ = data(0)

    const scrubBarPercentCss$ = combineData({
        scrubbing: scrubbing$,
        scrubPercent: scrubPercent$,
        currentTimePercent: props.currentTimePercent$,
        seeking: props.seeking$,
    }).map(({ scrubbing, scrubPercent, currentTimePercent, seeking }) => {
        return toPercentCss(
            scrubbing || seeking ? scrubPercent : currentTimePercent
        )
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

        add(
            windowEvents.on('mouseup', (e) => {
                scrubbing$.value = false
                props.onSeek(getScrubPercent(e.clientX))
            })
        )
        add(
            windowEvents.on('touchend', (e) => {
                if (e.touches.length === 0 && e.changedTouches.length > 0) {
                    scrubbing$.value = false
                    props.onSeek(getScrubPercent(e.changedTouches[0].clientX))
                }
            })
        )
    })

    return bar
}

function toPercentCss(pct: number): string {
    return `${pct * 100}%`
}
