# Testing

Tests are written in Jasmine, there are Unit, Integration, and Benchmark tests.

To iterate on tests in Node, run `npm run test` or `npm run test:coverage` to
test with coverage reporting.

To iterate on tests in a browser, run `npm run start`. Jasmine can isolate to a
specific test either by temporarily using `fit` or `fdescribe` (read f for
focus) in the test, or by providing a filter.

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

When running tests in a browser, the window must remain in the foreground. This
is in order to have consistent timeupdate events and prevent auto-pausing muted
audio/video.

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

For browser/device combinations that require SSL, the
[DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) Setup SSL setup must be completed.

To run tests on BrowserStack, run `npm run test:browserstack`.

BrowserStack test logs can be found in the `bStackLogs` directory. This
directory is safe to delete.
