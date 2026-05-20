# Testing

Tests are written in Jasmine, there are Unit, Integration, and Benchmark tests.

To iterate on tests in Node, run `npm run test` or `npm run test:coverage` to
test with coverage reporting.

To iterate on tests in a browser, run `npm run start`. Jasmine can isolate to a
specific test either by temporarily using `fit` or `fdescribe` (read f for
focus) in the test, or by providing a filter.

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
