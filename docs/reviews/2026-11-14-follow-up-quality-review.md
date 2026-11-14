# Follow-up quality review — November 14, 2026

## Scope and result

This review starts at `4686589` and covers the four local commits after `620c25c`.
The working tree was clean at the start.
The review checked dashboard capture, chapter navigation, trip summaries, gallery changes, tests, and active documentation.
Earlier dated reports retain their original measurements.

Five reliability defects required changes.
The original unit suite passed 3,290 tests.
Before correction, the regression set failed 24 tests across four files.
Two additional decoder regressions also failed before their correction.
One existing test had approved incorrect stderr encoding behavior.
Aggregate coverage had missed these boundary conditions.

## Validation

All checks below passed after the corrections.
The [measurement record](../performance/2026-11-14-follow-up-quality-review.json) contains counts, commands, and file-level coverage.

| Check | Before | After |
| --- | --- | --- |
| Complete unit suite | 3,290 tests | 3,326 tests across 228 files |
| Line coverage | 88.69% | 88.74% |
| Branch coverage | 83.08% | 83.16% |
| Statement coverage | 87.00% | 87.05% |
| Function coverage | 85.46% | 85.46% |
| Chapter and article browser checks | — | 52 passed in Chromium and WebKit |
| Built trip navigation checks | — | 9 passed across three browser profiles |
| Lint | — | Passed |
| Application and script TypeScript checks | — | Passed |
| Dependency audit | — | Zero reported vulnerabilities |

The changes add 36 unit cases and one browser case, run in both engines.
Event-log line and branch coverage remain at 100% with stronger contract checks.
Contents-navigation line coverage reaches 100%.
The complete suite uses two workers to limit concurrent build load.
Browser setup uses temporary local configuration and a WebKit library wrapper.
Repository test configuration is unchanged.

## Medium: invalid intervals bypassed polling limits

The watcher used `parseInt` without checking the complete input.
`--interval 300seconds` became `300`, and `--interval 60.5` became `60`.
Invalid values could reach the configuration as `NaN`.
Large valid numbers could also overflow a panel timer after its multiplier was applied.

Node changes a `NaN` or overflowing delay into a 1ms interval.
This could repeatedly start provider requests despite the configured minimum intervals.
The behavior is specified in the [Node timer documentation](https://nodejs.org/api/timers.html#setintervalcallback-delay-args).

The watcher now converts the complete numeric value.
It rejects missing values before installing output capture.
The configuration rejects nonpositive or nonfinite values.
Every scaled panel delay must fit within Node's supported millisecond range.
Tests include decimal input, malformed input, missing values, overflow, and a valid value near the limit.

## Medium: repeated events were evicted in the wrong order

An event's repeat count and time changed without updating its position in the store.
Capacity eviction still removed the first array element.
An event repeated a moment earlier could therefore disappear before an older event.

Repeated events now move to the most recent position.
Their identity and occurrence count remain stable.
Previously returned snapshots retain their original values.
A capacity regression fills the store, repeats its oldest entry, and adds another event.
The repeated event must remain. The next-oldest event must be removed.

## Medium: provider errors bypassed message checks

Console output passed through length and ANSI checks.
Provider failures called `addEvent` directly and skipped those checks.
The twenty-event capacity therefore did not bound retained message sizes.
Empty messages and terminal formatting could also enter the event panel directly.

The event store now applies the same checks to every producer.
It removes ANSI sequences, omits empty messages, and shortens long messages before deduplication.
Truncation preserves complete Unicode characters.
Tests cover direct provider errors, repeated normalized messages, empty output, and a character crossing the truncation boundary.

## Medium: stderr capture changed valid binary input

The interceptor applied a string encoding option to binary chunks.
Node applies this option to string input.
The [Node stream contract](https://nodejs.org/api/stream.html#writablewritechunk-encoding-callback) also permits typed arrays and DataView input.

The corrected writer encodes string chunks and preserves each binary view's exact byte range.
It reads the resulting bytes as UTF-8 terminal text.
A streaming decoder preserves characters divided between writes.
Callbacks still complete asynchronously, including when a message is omitted.

Tests cover hexadecimal and Base64 strings, Unicode text, Buffer input, typed arrays, nonzero byte offsets, and DataView input.
Session cleanup also releases pending decoder state.
The real-Ink integration check retains the original console levels and restores capture after exit.

## Medium: fragment correction could override reader input

Chapter compaction can move an earlier heading after a fragment jump.
The contents component corrects the target position during a few animation frames.
It did not stop when the reader began another action during those frames.
A correction could move the story back after a wheel, touch, pointer, or keyboard action.

Reader input now cancels the pending correction immediately.
The input listeners exist only while correction work remains.
Stable layout, changed targets, the retry limit, and unmount all release those listeners.
Unit tests cover each input type, changed content, bounded corrections, and cleanup.
A browser regression interrupts the first fragment scroll before its next measurement.
Both Chromium and WebKit preserve the reader's new position.

## Other reviewed changes

The motorcycle label uses the trip's tag and retains the existing card destination.
Missing trip facts produce no extra separator.
Writing posts retain their own metadata rules.
The PCH gallery contracts retain the selected photos and the twelve-photo collapse threshold.
Chapter animations retain enlarged-text, reduced-motion, short-screen, and print behavior.

## Documentation and remaining work

The dashboard guide now defines interval validation, event recency, shared message checks, and binary capture behavior.
The trip testing guide includes reader input during fragment correction.
The TODO list separates phone reading checks from photo performance measurements.
Provider-response and cost-cache tasks retain their own acceptance conditions.
Revised instructions use short sentences, active voice, and consistent terms.

Hosted release checks and physical-device measurements remain in [TODO.md](../../TODO.md).
Source-date corrections still require the site owner's evidence.
The [measurement record](../performance/2026-11-14-follow-up-quality-review.json) contains test and coverage results.
