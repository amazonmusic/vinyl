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

Options are passed after `--` to a package's script, for example
`npm run test:integ -w @amazon/vinyl -- --browsers=chromium,safari --spec=progressive`:

- `--browsers` - a comma separated list of `chromium`, `firefox`, `webkit`, and
  `safari`.
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
