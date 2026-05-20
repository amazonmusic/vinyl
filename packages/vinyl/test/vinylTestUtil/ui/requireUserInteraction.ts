/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Displays a prompt awaiting user interaction, resolving after a click, keypress, or touch event.
 */
export async function requireUserInteraction(): Promise<void> {
    const audioPrompt = document.getElementById('unlockAudioPrompt')!
    audioPrompt.style.removeProperty('display')
    const body = document.body
    body.focus()

    await new Promise((resolve) => {
        const done = () => {
            body.removeEventListener('click', done)
            body.removeEventListener('keypress', done)
            body.removeEventListener('touchend', done)
            return resolve(void 0)
        }
        body.addEventListener('click', done)
        body.addEventListener('keypress', done)
        body.addEventListener('touchend', done)
    })
    audioPrompt.style.display = 'none'
}
