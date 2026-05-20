import { jsx } from '@amazon/vinyl-tsx'
import type { ObservableValue } from '@amazon/vinyl-observable'
import { Icon } from '@/components/icons'

export interface VolumeControlProps {
    readonly muted$: ObservableValue<boolean>
    readonly volume$: ObservableValue<number>
    readonly onMutedChange: (muted: boolean) => void
    readonly onVolumeChange: (volume: number) => void
}

export function VolumeControl(props: VolumeControlProps) {
    const slider = (
        <input
            className="volumeSlider"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={String(props.volume$.value)}
            style={{
                '--volume': props.volume$.map(toPercentCss),
            }}
            oninput={() => {
                const vol = parseFloat(slider.value)
                props.onVolumeChange(vol)
            }}
        />
    ) as HTMLInputElement

    props.volume$.onData((vol) => {
        if (parseFloat(slider.value) !== vol) slider.value = String(vol)
        slider.style.setProperty('--volume', `${vol * 100}%`)
    })

    return (
        <div className="volumeControl">
            <button
                className="transportBtn"
                title="Mute"
                onclick={() => props.onMutedChange(!props.muted$.value)}
            >
                <span visible={props.muted$.map((m) => !m)}>
                    <Icon name="volume_up" />
                </span>
                <span visible={props.muted$}>
                    <Icon name="volume_off" />
                </span>
            </button>
            {slider}
        </div>
    )
}

function toPercentCss(pct: number): string {
    return `${pct * 100}%`
}
