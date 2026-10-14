/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger, sleep } from '@amazon/vinyl-build-utils'
import { By, type WebDriver, type WebElement } from 'selenium-webdriver'
import { Command, Name } from 'selenium-webdriver/lib/command'

/**
 * The full-page prompt the test page shows before the suite runs. Clicking it with trusted input unlocks media
 * playback.
 */
export const START_PROMPT_SELECTOR = '#unlockAudioPrompt'

export interface ClickStartPromptOptions {
    /**
     * A name for log messages.
     */
    readonly name: string

    /**
     * If true, taps with a W3C touch pointer first. Element clicks on iOS Safari are synthesized in script, which
     * don't count as a user gesture.
     */
    readonly touch?: boolean

    /**
     * The number of seconds to wait for the prompt to appear, and then to be dismissed.
     * Default: 120
     */
    readonly timeout?: number
}

const PROMPT_SETTLE_MS = 10_000

type Gesture = (driver: WebDriver, prompt: WebElement) => Promise<void>

const click: Gesture = (_driver, prompt) => prompt.click()

/**
 * Taps the middle of the window with a touch pointer. The prompt fills the page, and Appium runs W3C actions on iOS
 * natively, where web element origins are unknown, so this taps window coordinates.
 */
const tap: Gesture = async (driver) => {
    const { width, height } = await driver.manage().window().getRect()
    await driver.execute(
        new Command(Name.ACTIONS).setParameter('actions', [
            {
                type: 'pointer',
                id: 'finger',
                parameters: { pointerType: 'touch' },
                actions: [
                    {
                        type: 'pointerMove',
                        origin: 'viewport',
                        x: Math.round(width / 2),
                        y: Math.round(height / 2),
                    },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 50 },
                    { type: 'pointerUp', button: 0 },
                ],
            },
        ])
    )
}

/**
 * Waits for the start prompt and dismisses it with a trusted click (or tap), retrying with the next gesture while
 * the page rejects them.
 *
 * @return false if the page never showed the prompt (it has no media to unlock).
 */
export async function clickStartPrompt(
    driver: WebDriver,
    options: ClickStartPromptOptions
): Promise<boolean> {
    const gestures = options.touch ? [tap, click] : [click]
    const deadline = Date.now() + (options.timeout ?? 120) * 1000
    let attempts = 0
    while (Date.now() < deadline) {
        const prompt = await findDisplayedPrompt(driver)
        if (!prompt) {
            if (attempts) return true
            await sleep(1)
            continue
        }
        const gesture = gestures[attempts % gestures.length]
        attempts++
        try {
            await gesture(driver, prompt)
        } catch (error) {
            logger.warn(
                `Start prompt ${gesture === tap ? 'tap' : 'click'} failed for '${options.name}':`,
                error
            )
        }
        // The page unlocks the media element before dismissing the prompt.
        const settleDeadline = Date.now() + PROMPT_SETTLE_MS
        while (
            Date.now() < settleDeadline &&
            (await findDisplayedPrompt(driver))
        )
            await sleep(0.5)
    }
    if (attempts)
        throw new Error(
            `The start prompt was not dismissed after ${attempts} gestures for '${options.name}'.`
        )
    return false
}

async function findDisplayedPrompt(
    driver: WebDriver
): Promise<WebElement | null> {
    const prompts = await driver.findElements(By.css(START_PROMPT_SELECTOR))
    if (!prompts.length) return null
    const prompt = prompts[0]
    return (await prompt.isDisplayed().catch(() => false)) ? prompt : null
}
