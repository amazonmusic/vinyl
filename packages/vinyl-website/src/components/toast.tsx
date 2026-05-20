import { jsx } from '@amazon/vinyl-tsx'
import { Icon } from '@/components/icons'

const FADE_OUT_MS = 200

const messages = <div className="toastMessages" />
const container = (
    <div className="toastContainer" hidden>
        {messages}
    </div>
)
document.body.appendChild(container)

export function toast(message: string, durationSeconds = 4) {
    const div = <div className="toastMessage">{message}</div>
    show(div, durationSeconds)
}

export function toastError(message: string, durationSeconds = 5) {
    const div = (
        <div className="toastMessage toastError">
            <Icon name="error" />
            <span>{message}</span>
        </div>
    )
    show(div, durationSeconds)
}

function show(div: HTMLElement, durationSeconds: number) {
    messages.appendChild(div)
    container.hidden = false

    setTimeout(() => {
        div.classList.add('toastHide')
        setTimeout(() => {
            div.remove()
            if (messages.children.length === 0) container.hidden = true
        }, FADE_OUT_MS)
    }, durationSeconds * 1000)
}
