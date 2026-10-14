/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '@amazon/vinyl-build-utils'
import type * as Playwright from 'playwright'
import { Browser, Builder, type WebDriver } from 'selenium-webdriver'
import { clickStartPrompt, START_PROMPT_SELECTOR } from './clickStartPrompt'

/**
 * The browsers {@link runLocalBrowsers} can run: Playwright's Chromium, Firefox, and WebKit builds, and the
 * installed Safari through safaridriver.
 */
export type LocalBrowserName = 'chromium' | 'firefox' | 'webkit' | 'safari'

export const localBrowserNames: readonly LocalBrowserName[] = [
    'chromium',
    'firefox',
    'webkit',
    'safari',
]

export interface LocalBrowserLaunchOptions {
    /**
     * Shows the Playwright browser windows. Safari always shows its window.
     */
    readonly headed: boolean

    /**
     * Invoked with diagnostics jasmine's reporting can't see: uncaught page errors, crashes, and failed requests.
     */
    readonly log: (message: string) => void
}

/**
 * An open test page.
 */
export interface LocalBrowserPage {
    /**
     * Dismisses the start prompt with trusted input once it is shown.
     *
     * @return false if the page never showed the prompt.
     */
    clickStartPrompt(): Promise<boolean>

    close(): Promise<void>
}

/**
 * Thrown when the browser can't be launched on this machine, for a reason the user must fix outside the runner.
 */
export class LocalBrowserUnavailableError extends Error {}

/**
 * The number of seconds to wait for the start prompt to appear.
 */
const PROMPT_TIMEOUT = 120

export function openLocalBrowser(
    name: LocalBrowserName,
    url: string,
    options: LocalBrowserLaunchOptions
): Promise<LocalBrowserPage> {
    return name === 'safari'
        ? openSafari(url)
        : openPlaywright(name, url, options)
}

async function openPlaywright(
    name: Exclude<LocalBrowserName, 'safari'>,
    url: string,
    options: LocalBrowserLaunchOptions
): Promise<LocalBrowserPage> {
    let playwright: typeof Playwright
    try {
        playwright = await import('playwright')
    } catch (error) {
        throw new LocalBrowserUnavailableError(
            `Playwright is not installed; add 'playwright' as a devDependency. (${String(error)})`
        )
    }
    let browser: Playwright.Browser
    try {
        browser = await playwright[name].launch({ headless: !options.headed })
    } catch (error) {
        throw new LocalBrowserUnavailableError(
            `Could not launch Playwright ${name}; run 'npx playwright install ${name}'.\n${String(error)}`
        )
    }
    const page = await browser.newPage()
    page.on('pageerror', (error) => options.log(`[pageerror] ${String(error)}`))
    page.on('crash', () => options.log('[crash] The page crashed.'))
    page.on('requestfailed', (request) =>
        options.log(
            `[requestfailed] ${request.url()} ${request.failure()?.errorText ?? ''}`
        )
    )
    await page.goto(url)
    return {
        async clickStartPrompt() {
            const prompt = page.locator(START_PROMPT_SELECTOR)
            try {
                await prompt.waitFor({ timeout: PROMPT_TIMEOUT * 1000 })
            } catch {
                return false
            }
            await prompt.click()
            await prompt.waitFor({ state: 'hidden', timeout: 10_000 })
            return true
        },
        close: () => browser.close(),
    }
}

async function openSafari(url: string): Promise<LocalBrowserPage> {
    let driver: WebDriver
    try {
        driver = await new Builder().forBrowser(Browser.SAFARI).build()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (/remote automation/i.test(message))
            throw new LocalBrowserUnavailableError(
                "Safari's remote automation is off. Enable Safari > Settings > Advanced > " +
                    '"Show features for web developers", then Develop > "Allow Remote Automation" ' +
                    '(or run `safaridriver --enable`).'
            )
        throw new Error(`Could not start a safaridriver session: ${message}`)
    }
    try {
        await driver.get(url)
    } catch (error) {
        await driver.quit().catch(() => {})
        throw error
    }
    return {
        clickStartPrompt: () =>
            clickStartPrompt(driver, {
                name: 'safari',
                timeout: PROMPT_TIMEOUT,
            }),
        async close() {
            try {
                await driver.quit()
            } catch (error) {
                logger.warn('Could not quit the Safari session:', error)
            }
        },
    }
}
