# Testing

Tests are written in Jasmine, there are Unit, Integration, and Benchmark tests.

To iterate on tests in Node, run `npm run test` or `npm run test:coverage` to
test with coverage reporting.

To iterate on tests in a browser, run `npm run start` and open the server's URL.
The page shows a "Click to start" prompt before the suite runs: the click is the
user gesture that unlocks the shared media element, which plays unmuted at a low
volume (Safari 27 ends progressive playback that starts silently without a
gesture). Jasmine can isolate to a specific test either by temporarily using
`fit` or `fdescribe` (read f for focus) in the test, or by providing a filter.

## How the tests run

Every test is a [Jasmine](https://jasmine.github.io/) spec written in
TypeScript. There are no Playwright or WebDriver tests: those tools only open
the test page and click its start prompt, and the specs run inside the page.

- **Unit tests** (`packages/*/test/unit`) run in Node through `tsx`, mocking
  browser APIs where they need them.
- **Integration tests** (`packages/*/test/integ`) play real media with a real
  player in a real browser. Suites use helpers such as `createVinylSuite` and
  `expectTrackPlays` from `@amazon/vinyl/vinylTestUtil`. The browser page
  bundles the unit tests too, so they also run on every browser and device.

A browser run works like this:

1. The package's build script bundles the specs with esbuild (type-checked by
   `tsc`) into `dist/test`, alongside Jasmine's HTML boot page.
2. An Express server (`configureExpress` in `@amazon/vinyl-browserstack`) serves
   that page and a small REST API for reporting results.
3. A driver opens the page with query parameters (below), such as `spec`,
   `seed`, `appendMode`, and `reportApi`, and clicks the start prompt:
    - `npm run start` - you, in your own browser.
    - `npm run test:integ` - Playwright launches Chromium, Firefox, WebKit, or
      the installed Chrome or Edge (through Playwright's browser channels), and
      `selenium-webdriver` drives Safari through `safaridriver`.
    - `npm run test:browserstack` - Selenium WebDriver sessions on BrowserStack,
      reaching the local server through the BrowserStack Local tunnel.
4. Jasmine runs every spec in the page. `RestApiReporter` posts progress, log
   lines, and the final result to `reportApi`, and the runner prints a summary
   and writes the logs to `integLogs/` (`bStackLogs/` on BrowserStack).

The runners run the suite once per source buffer append mode
(`appendMode=segments` and `appendMode=sequence`).

Integration tests stream test media from `assets.dev.vinyl.music.amazon.dev`.
Widevine specs get licenses from Shaka Player's public license proxy
(`cwip-shaka-proxy.appspot.com`), and are marked pending where the browser has
no Widevine CDM unless `strictDrm` is set (see below).

## Running tests from your IDE

Tests run through `tsx` and rely on the `development` Node export condition so
cross-package imports resolve to TypeScript source rather than built `dist/`
artifacts. The repo's `.npmrc` sets this automatically for any `npm run`
invocation, but IDE run configurations bypass npm and must set the equivalent
Node options manually.

Pass these options to Node:

```
--import tsx/esm --conditions=development
```

### IntelliJ IDEA / WebStorm

1. **Run** → **Edit Configurations…**
2. Select (or create) your Jasmine configuration.
3. Set **Node options** to:
    ```
    --import tsx/esm --conditions=development
    ```

To make this the default for new Jasmine configurations, edit the template under
**Edit Configurations… → Edit configuration templates… → Jasmine** and set the
same Node options.

### VS Code

Add the options to the relevant launch configuration in `.vscode/launch.json`:

```jsonc
{
    "type": "node",
    "request": "launch",
    "name": "Jasmine: current spec",
    "program": "${workspaceFolder}/node_modules/jasmine/bin/jasmine",
    "args": ["--config=${fileDirname}/jasmine.config.json"],
    "runtimeArgs": ["--import", "tsx/esm", "--conditions=development"],
    "cwd": "${fileDirname}",
    "console": "integratedTerminal",
}
```

When running tests in a browser, here are the possible queryString parameters:

- `vinylLogLevel` - one of 'verbose', 'debug', 'info', 'warn', 'error', or
  'none' (Case insensitive). Set your browser's log level to 'verbose' to see
  debug logs.
- `seed` - 'seed' - A seed for pseudo randomization. Test runs with the same
  should run their specs in the same order.
- `spec` - Should filter specs to only include tests whose full description
  contains the provided value. For example `?spec=progressive` will test any
  spec or suite with 'progressive' in the description.
- `checkAudio` - If true | 1, an AnalyzerNode is attached to the media element.
  When tests call `await assertFrequency()`. This verifies that the tone sweep
  the test assets use matches what we expect to hear from the audio playback.
- `stopOnSpecFailure` - If false, runs every spec instead of stopping at the
  first failure.

When running tests in a browser, the window must remain in the foreground. This
is in order to have consistent timeupdate events and prevent auto-pausing
audio/video.

### Local browsers

`npm run test:integ` builds the integ page and runs it in real browsers on this
machine, all at once from one server: Playwright's Chromium, Firefox, and
WebKit, and Safari through its own safaridriver session. Each start prompt is
clicked with trusted input, every spec runs, and the results (spec counts, the
seed, and each failure) are printed when all browsers finish. The command exits
non-zero if any browser failed. Each run's console logs are written to
`integLogs/`, which is safe to delete.

Install the Playwright browsers once with
`npx playwright install chromium firefox webkit`. Safari needs remote
automation: in Safari, enable Settings > Advanced > "Show features for web
developers", then Develop > "Allow Remote Automation" (or run
`safaridriver --enable`). Unavailable browsers are skipped with a message.

Safari allows one automation session at a time, and the runner quits its session
when the run ends, fails, or is interrupted. Keep Safari's window uncovered
while it runs: WebKit treats a window hidden behind other windows, minimized, or
on another Space as hidden and throttles its timers, so the runner fails Safari
as soon as its page is hidden.

Options are passed after `--` to a package's script, for example
`npm run test:integ -w @amazon/vinyl -- --browsers=chromium,safari --spec=progressive`:

- `--browsers` - a comma separated list of `chromium`, `firefox`, `webkit`,
  `safari`, `chrome`, and `msedge`. Default: `chromium,firefox,webkit,safari`.
  `chrome` and `msedge` are the installed Google Chrome and Microsoft Edge,
  which have their real CDMs, unlike Playwright's builds.
- `--strictDrm=true` - fails Widevine specs instead of marking them pending
  where the browser is expected to support Widevine (modern Chrome, Edge, and
  Firefox). Use it with `chrome` and `msedge`; Playwright's Chromium and Firefox
  have no Widevine CDM.
- `--serial` - runs the browsers one after another.
- `--headed` - shows the Playwright browser windows.
- Any other `--name=value` is added to the page's query parameters, such as
  `--spec`, `--seed`, or `--vinylLogLevel`.

### BrowserStack

To test on BrowserStack, add your BrowserStack credentials to a .env file in the
project root.

This should be in the form:

```
BROWSERSTACK_USERNAME=yourusername_aaBBccDD
BROWSERSTACK_ACCESS_KEY=ga3sa6toGyabcves586a
```

Your username and access key can be obtained by logging in and clicking the
Access Key link at the top.

The suite is served over plain HTTP through the BrowserStack Local tunnel. For
browser/device combinations that require a secure context, supply a certificate
and an SNI hostname via the run's `server.https` options (see
`ServerHostOptions` in `@amazon/vinyl-build-utils`); the test URL then resolves
to that HTTPS server instead of the HTTP one.

To run tests on BrowserStack, run `npm run test:browserstack`. The runner clicks
each page's start prompt over WebDriver, tapping it with a touch pointer on iOS,
where element clicks are synthesized in script and don't count as a user
gesture.

BrowserStack test logs can be found in the `bStackLogs` directory. This
directory is safe to delete.

### CI

- `CI` (pull requests and pushes to `main` and `hotfix/**`) runs
  `npm run release`: lint, unit tests with coverage, and the release build.
- `Integ DRM` (every merge to `main`, or on demand) runs the integration suite
  with `--strictDrm=true` in the installed Chrome and Edge on GitHub's Windows
  runner and in Chrome on its macOS runner.
- `BrowserStack` (on demand) runs the integration suite on the BrowserStack
  browsers and devices. It doesn't set `strictDrm`, so Widevine specs go pending
  where BrowserStack's browsers lack the CDM (Firefox).
