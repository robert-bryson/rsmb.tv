# Status dashboard

The terminal dashboard shows service health, deployments, workflow runs, and costs.
Start it with `npm run watch`.
Use `npm run watch -- --help` to list command options.

## Controls

| Key | Action |
| --- | --- |
| `q` | Quit |
| `h` | Switch between compact and detailed views |
| `e` | Clear the event log |
| `c` | Clear resolved incidents |
| `↑` or `k` | Scroll up |
| `↓` or `j` | Scroll down |

AWS Amplify deployments and GitHub Actions appear separately.
Configured workflows remain visible before their first run.
Review old or unknown results before treating a service as healthy.

Ink supplies the terminal dimensions and handles resize events.
If the output stream has no dimensions, Ink detects the host terminal size.
If detection fails, Ink uses 80 columns and 24 rows.

## Refresh intervals

`--interval` sets the base refresh interval in seconds. Decimal values are allowed.
Each panel keeps its minimum refresh interval and applies its configured multiplier.
The base value must be positive and finite.
Each scaled delay must fit within 2,147,483,647 milliseconds.
Invalid values stop startup before output capture or provider polling starts.
This prevents Node.js from converting an invalid delay into a 1ms timer.

## Event log

The log retains the latest 20 distinct events.
Each event has a time, level, source, message, and occurrence count.
The levels are `error`, `warn`, and `info`.
An identical level, source, and message increases the existing event's count.
It also updates that event's time and moves it to the most recent position.
When a new event exceeds capacity, the log removes the event with the oldest occurrence.
Updates create a new event object. Previously returned snapshots retain their values.

An event expires ten minutes after its latest occurrence.
Expiry runs when a reader mounts and at each two-second poll.
It does not require another event.
Readers render only when the store revision changes.
Each reader releases its polling timer when it unmounts.

Event expiry and incident retention are separate rules.
Clearing the event log does not clear incidents.

## Output capture

Console capture prevents provider messages from corrupting the terminal display.
The watcher disables Ink's console patch because the event log already owns capture.
This keeps console messages in the log and preserves their levels.
It uses Node.js formatting for errors, circular objects, numeric values, and format arguments.
All event sources use the same message checks, including direct provider errors.
Messages exclude ANSI terminal sequences.
Messages longer than 200 characters are shortened without splitting a Unicode character.
Empty messages and Octokit HTTP debug lines are omitted.

Captured stderr writes retain their asynchronous completion callbacks.
String chunks use their supplied encoding, or UTF-8 by default.
Binary chunks ignore that encoding option, as Node.js requires.
Buffers, typed arrays, and DataView inputs keep their original byte ranges.
The captured bytes are read as UTF-8 terminal text.
A streaming decoder preserves characters divided between writes.
Cleanup flushes incomplete bytes and releases the decoder state.
The capture function returns a cleanup function.
The watcher calls cleanup after Ink exits, including after a failure.
Cleanup restores the original console functions and stderr writer.
It also stops the performance-buffer timer, so that timer cannot keep the watcher running after quit.

## Code and tests

| File | Responsibility |
| --- | --- |
| [`aws-watch.tsx`](../scripts/aws-watch.tsx) | Read options, start Ink, and release output capture |
| [`App.tsx`](../scripts/dashboard/App.tsx) | Arrange panels and handle keyboard input |
| [`useEventLog.tsx`](../scripts/dashboard/useEventLog.tsx) | Store, expire, capture, and render events |
| [`useIncidentLog.tsx`](../scripts/dashboard/useIncidentLog.tsx) | Track service incidents and recovery |
| [`buildModel.ts`](../scripts/dashboard/buildModel.ts) | Classify deployment and workflow results |
| [`buildFetchers.ts`](../scripts/dashboard/buildFetchers.ts) | Read deployment and workflow providers |

Run the dashboard tests without provider access:

```bash
npx vitest run scripts/dashboard/__tests__ scripts/__tests__/awsWatch.test.tsx scripts/__tests__/awsWatchIntegration.test.tsx
```

Tests use fixed times, provider responses, and terminal streams.
They cover event capacity, recency, expiry, duplicate counts, formatting, byte ranges, callbacks, rendering, and timer cleanup.
Interval checks include malformed values, decimal values, and scaled timer overflow.
The watcher integration test mounts real Ink with synthetic terminal streams.
It checks capture, message levels, output isolation, and restoration after exit.
Use [TODO.md](../TODO.md#dashboard-checks) for the remaining provider and cost-cache tests.
