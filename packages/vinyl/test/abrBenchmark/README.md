# ABR Benchmark Harness

A standalone benchmark for evaluating Amazon Vinyl's adaptive bitrate (ABR)
performance under various simulated network conditions. This is **not** part of
the regular benchmark suite — it runs through Puppeteer in headless Chrome and
can take up to 30 minutes for a full run.

## Running

Puppeteer is not a declared dependency (it does not install in CI). Install it
locally before running the benchmark (from the vinyl package directory):

```bash
npm install --no-save puppeteer
```

Run all scenarios (from the vinyl package directory):

```bash
npm run benchmark:abr
```

> **Tip (macOS):** prefix with `caffeinate -is` to prevent sleep during long
> runs: `caffeinate -is npm run benchmark:abr`.

The script builds the harness automatically. Additional flags (pass after `--`):

```bash
# Specific scenario
npm run benchmark:abr -- --scenario stable-high

# Specific random seed (for reproducibility)
npm run benchmark:abr -- --seed 42

# Combine
npm run benchmark:abr -- --scenario tunnel-outage --seed 12345

# Resume an interrupted run (skips any (scenario, engine, track) combos
# already in results.json)
npm run benchmark:abr -- --continue
```

## Output

Results are written to `packages/vinyl/test/abrBenchmark/results/results.json`
with per-track, per-scenario scores and a summary. The file is rewritten after
each scenario completes, so you can Ctrl-C at any point and resume with
`--continue`.

## Scoring

Each track+scenario combination is scored in the range 0–1 (displayed as 0–100).
Four independent components are computed and combined as a **weighted average**
(not multiplicatively). Each component is itself in [0, 1], where 1 is ideal.

| Component | Meaning                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| Quality   | Duration-weighted `√(bitrate / maxBandwidth)` — penalises low bitrates          |
| Rebuffer  | `1 / (1 + k · rebufferCount)` — decays with each `waiting → playing` transition |
| Stall     | `1 / (1 + k · stallSeconds)` — decays with total seconds spent rebuffering      |
| Startup   | `1 / (1 + k · startupSeconds)` — decays with time from `play()` to first frame  |

Weights are defined in `ABR_WEIGHTS` in `abrScore.ts`.

### Timeline model

Playback is recorded as an event-driven timeline. Each entry marks a state
change with a `time` in seconds from test start and the current playing
bandwidth. Between two consecutive entries the state from the earlier entry is
held — so an uninterrupted 60-second playthrough with no quality changes is just
two samples (start and end).

## Scenarios

| Name             | Description                                                           |
| ---------------- | --------------------------------------------------------------------- |
| `stable-high`    | Steady 10 Mbps, 20ms latency                                          |
| `stable-low`     | Steady 500 Kbps, 80ms latency                                         |
| `wifi-to-4g`     | Alternates between ~8 Mbps wifi and ~400 Kbps 4G (randomized phases)  |
| `outage`         | Periodic request stalls (online but no response, randomized phases)   |
| `noisy-mobile`   | 500 Kbps mean with ±50% noise, occasional dropouts and latency spikes |
| `force-rebuffer` | Sustained 40 kbps — guarantees rebuffers. **Opt-in only** (see below) |

Scenarios marked opt-in are excluded from the default "run all" set and must be
requested explicitly:

```bash
npm run benchmark:abr -- --scenario force-rebuffer
```

## Reproducibility

All randomization uses a seeded PRNG. The default seed is `1` so results are
deterministic across runs. Pass `--seed <number>` to use a different seed.
