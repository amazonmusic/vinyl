# Browser errata

Browser bugs that shape how Vinyl buffers and plays media, what each one looks
like, and what Vinyl does about it. Each entry names the versions it was
observed on, where the handling lives, and a deterministic test bed to check
whether it still reproduces.

When a new browser bug turns up, isolate the exact trigger with a minimal repro
that doesn't use Vinyl, find the first version that fixes it, and gate the
handling to the affected range where possible.

## WebKit: changeType() in sequence mode appends at the media time

**Affected:** WebKit (Safari 27.0, Playwright's WebKit), reproduced every run.
Not Chromium or Firefox. Unfixed on WebKit `main` as of October 2026.

**WebKit bug:** [327788](https://bugs.webkit.org/show_bug.cgi?id=327788)

**Symptom:** in `"sequence"` mode, the first media segment appended after
`SourceBuffer.changeType()` is buffered at its own media time instead of after
the buffered media. A DASH Period boundary that changes codec, whose next Period
starts later in its media timeline (e.g. stitched ad Periods), leaves a gap in
the buffered ranges and playback stalls at the boundary.

**Cause:** `changeType()` runs the
[reset parser state](https://w3c.github.io/media-source/#sourcebuffer-reset-parser-state)
algorithm, which in `"sequence"` mode sets `[[group start timestamp]]` to
`[[group end timestamp]]`, so the next coded frame continues the buffered media.
WebKit's `SourceBuffer::resetParserState`
(`Source/WebCore/Modules/mediasource/SourceBuffer.cpp`) follows an older draft
without that step. It also unsets the last decode timestamp, so the sequence
mode discontinuity check doesn't catch the jump either. Chromium
(`FrameProcessor::Reset`) and Firefox (`TrackBuffersManager::ResetParserState`)
implement the step.

**Handling:** after appending a new initialization segment to a buffer that
already holds media, `BufferingControllerImpl` sets `timestampOffset` to the end
of the buffered segment, as sequence mode would. Covered by the
`dash Period codec change integ` spec, which stalls at the boundary on WebKit
without it.

**Test bed:** `testResources/errata/mse-changetype-sequence.html` prints PASS or
FAIL in any browser, listing each step. Serve it over HTTP: it's at
`/errata/mse-changetype-sequence.html` under `npm run start` and the integ
runners, or run `python3 -m http.server` in `testResources/errata`. Opened from
`file://`, Safari never opens the MediaSource and the page reports a timeout.
The `errata` integ spec runs the same script (`mse-changetype-sequence.js`);
it's pending on WebKit while the bug reproduces.
