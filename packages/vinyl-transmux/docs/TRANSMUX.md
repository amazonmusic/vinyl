# Transmux

Converts MPEG-TS and raw ADTS segments into fragmented MP4 (fMP4) for playback
via Media Source Extensions. Zero external dependencies.

## Architecture

The package is split into three layers:

```
┌─────────────────────────────────────────────┐
│  transmux      Stateful transmuxer          │
│                (createTransmuxer)           │
├─────────────────────────────────────────────┤
│  sampleEntry   Codec-specific MP4 boxes     │
│                (mp4a/esds, avc1/avcC)       │
├──────────────────┬──────────────────────────┤
│  mp4             │  mpegts / adts           │
│  Generic fMP4    │  Demux + parse           │
│  box writer      │                          │
└──────────────────┴──────────────────────────┘
```

- **mp4** — Generic ISO BMFF box writer. Produces `ftyp`, `moov`, `moof`,
  `mdat`, and all structural sub-boxes. No codec knowledge. Configurable via
  options with sensible defaults.
- **mpegts** — MPEG Transport Stream demuxer. Parses PAT/PMT, reassembles PES
  packets, extracts PTS timestamps.
- **adts** — Audio Data Transport Stream parser. Extracts AAC frame boundaries,
  sample rates, and channel configuration.
- **sampleEntry** — Codec-specific MP4 sample entry builders. Produces `mp4a` +
  `esds` for AAC and `avc1` + `avcC` for H.264. This is the only layer with
  codec knowledge.
- **transmux** — Stateful orchestrator. Detects the input format (MPEG-TS or raw
  ADTS), demuxes, parses codec configuration, builds the fMP4 init and media
  segments.

## Usage

```typescript
import { createTransmuxer } from '@amazon/vinyl-transmux'

const transmuxer = createTransmuxer()

// For each HLS segment (ArrayBuffer of MPEG-TS or ADTS data):
const result = transmuxer.transmux(segmentData)

// result.initSegment — ftyp + moov (always returned, cached after first call)
// result.mediaSegment — moof + mdat
// result.duration — segment duration in seconds
```

The transmuxer is stateful — call `transmux()` for each segment in order. It
tracks decode timestamps, sequence numbers, and codec configuration across
calls. The init segment is generated on the first call and cached for subsequent
calls.

## Supported Formats

| Input              | Output                          | Status |
| ------------------ | ------------------------------- | ------ |
| ADTS AAC           | fMP4 audio (`mp4a`)             | ✅     |
| MPEG-TS with AAC   | fMP4 audio (`mp4a`)             | ✅     |
| MPEG-TS with H.264 | fMP4 video (`avc1`)             | ✅     |
| MPEG-TS muxed      | fMP4 video + audio (multi-trak) | ✅     |

## MP4 Box Writer

The `mp4` module is a general-purpose fMP4 box writer, usable independently of
the transmuxer:

```typescript
import {
    box,
    fullBox,
    ftyp,
    moov,
    audioTrak,
    videoTrak,
    moof,
    mdat,
    patchDataOffset,
} from '@amazon/vinyl-transmux'

// Custom ftyp
const ftypBox = ftyp({
    majorBrand: 'dash',
    compatibleBrands: ['iso6', 'mp41'],
})

// Build a moov with custom tracks
const moovBox = moov(
    audioTrak({
        trackId: 1,
        sampleRate: 44100,
        channelCount: 2,
        sampleEntry: myAudioSampleEntry,
    }),
    videoTrak({
        trackId: 2,
        width: 1920,
        height: 1080,
        sampleEntry: myVideoSampleEntry,
    })
)

// Build a media fragment
const moofBox = moof({
    sequenceNumber: 1,
    trackId: 1,
    baseDecodeTime: 0,
    samples: [
        { duration: 1024, size: 400 },
        { duration: 1024, size: 380 },
    ],
})
patchDataOffset(moofBox, moofBox.byteLength)
const mdatBox = mdat(rawMediaData)
```

## ID3 Tags

Leading ID3v2 tags (common in HLS for timed metadata) are automatically skipped
before format detection.

## H.264 SPS Parsing

The transmuxer includes a minimal H.264 SPS parser that extracts resolution and
profile information from Sequence Parameter Set NAL units. It supports Baseline,
Main, and High profiles including the chroma format and scaling matrix
extensions.
