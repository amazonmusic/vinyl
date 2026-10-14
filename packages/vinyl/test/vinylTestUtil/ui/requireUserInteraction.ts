/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Displays a full-page prompt, resolving after a click or key press.
 *
 * @param onInteraction If provided, invoked from within the click or key event handler, so that it may start media
 * playback or resume an AudioContext. If its promise rejects, the error is logged and the prompt remains until the
 * next interaction.
 */
export async function requireUserInteraction(
    onInteraction?: () => Promise<void>
): Promise<void> {
    const prompt = document.getElementById('unlockAudioPrompt')!
    prompt.style.removeProperty('display')
    prompt.querySelector('button')?.focus()

    await new Promise<void>((resolve) => {
        let handling = false
        const handler = (event: Event) => {
            if (handling) return
            handling = true
            const result = onInteraction?.() ?? Promise.resolve()
            result
                .then(() => {
                    prompt.removeEventListener('click', handler)
                    document.removeEventListener('keydown', handler)
                    resolve()
                })
                .catch((error: unknown) => {
                    console.warn(
                        `The ${event.type} (isTrusted: ${event.isTrusted}) was not accepted as a user gesture; ` +
                            'interact again.',
                        error
                    )
                })
                .finally(() => {
                    handling = false
                })
        }
        prompt.addEventListener('click', handler)
        document.addEventListener('keydown', handler)
    })
    prompt.style.display = 'none'
}
