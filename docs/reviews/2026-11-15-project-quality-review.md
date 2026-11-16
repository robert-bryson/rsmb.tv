# Project quality review: November 15, 2026

Reviewed the pending project presentation changes against `92bf654`.
The scope includes screenshots, project copy, feature dates, social cards, image generation, tests, and current guides.
The [presentation review](2026-11-15-project-presentation-refresh.md) records source revisions and capture views.

## Findings and fixes

### P2: Social-card slugs could escape the output directory

`generateOgImages` joined unchecked slugs to output paths.
A page slug of `../outside` overwrote a file beside the output directory.
A blog slug of `../../outside` did the same.
The normal blog import validates slugs. Direct generator calls had no equivalent check.
This was a build-tool defect, not a public request handler.

The generator now checks the complete page and post lists before any output change.
It rejects unsafe slugs, duplicate slugs, missing text, invalid types, and invalid list shapes.
It rejects symbolic links for its output and blog directories.
Regression tests preserve an external sentinel file and check that invalid input creates no output directory.

### P2: Failed generation could delete or truncate published cards

The old generator deleted the blog directory before reading its registry.
Invalid JSON therefore removed existing blog cards.
It also wrote SVG and PNG files directly to their published paths.
A partial write could damage a file that the site still referenced.
Cleanup also removed unrelated files in the blog directory.

The generator now reads and validates metadata first.
It renders the complete batch before writing any file.
It uses the shared atomic writer for each SVG and PNG.
Cleanup starts after all required writes succeed. It removes only stale generated card files.
Read errors other than a missing registry now fail the command.

Tests cover invalid JSON, invalid records, failed rendering, a partial write, and output directory links.
They also check retained unrelated files, nested directories, and symbolic links.
The batch is not one transaction. Earlier successful writes can remain after a later write fails.

### P2: Tests could accept stale responsive previews

The old tests checked generator fixtures and selected page attributes.
They did not connect committed screenshots with their generated previews.
A replacement source with the same dimensions could leave old previews undetected.
Browser gallery coverage also omitted Through Routes, Bookend, Status Dashboard, Anki Artisan, and parc.

Each preview record now stores the source file's SHA-256 hash as `sourceHash`.
The manifest type requires this field. Existing consumers retain the shared `ResponsiveImage` interface.
Asset tests compare each source hash with the current file.
They check all ten galleries, three documented atlas captures, and every responsive variant.
They verify file hashes, formats, candidate widths, aspect ratios, full decoding, and unused variants.
Browser tests now cover the five omitted galleries at phone and desktop widths.

### P3: Social-card copy repeated the project catalogue

Project titles and subtitles had separate manual definitions in the generator.
Updating a project summary did not update its card definition.

Project cards now use the catalogue title and summary.
The description supplies a fallback when no summary exists.
Other page cards retain their separate definitions.
Tests require each project card to match the catalogue.
All static cards were regenerated.

### P3: One feature note used the wrong month

The new Status Dashboard notes placed separate provider sections in May.
Source commit `ca4a3354e16a9c37a35060cfc4056e46b9c4fc20` introduced those sections on April 30.
The note now appears in April.
May retains the new visible state for configured workflows without a first run.
That capability came from `eedeb78f4c922c0d7695ba06acca9c908c5866ba` on May 28.
The feature date remains May 28.

The full suite also found two old Flights metadata expectations.
They still expected 1852 × 1385 after the source changed to 1600 × 1000.
The expectations now match the source. Asset tests check the real file dimensions separately.

## Documentation and open work

The image guide now defines common capture settings once.
It explains source hashes, social-card ownership, write ordering, and failure limits.
The repository and shared-module guides link to the same rules and tests.
Revised prose uses short sentences, active verbs, and consistent terms.
Dated reports retain their original measurements. New results appear below.

`TODO.md` now places PCH source decisions with published story checks.
It removes the generic duplicate task to publish more posts.
The aborg screenshot task now requires a controlled fixture and real app output.
A separate task records the observed Through Routes expanded-profile loading label.
That external app issue remains open. Its current gallery uses the loaded compact profile.

## Validation

The new social-card regressions first produced 14 failures in the old implementation.
The fixes pass those regressions.
The first full run found the stale metadata expectations and sandbox limits on subprocess fixtures.
The final run uses four workers and permits the local subprocess fixtures.

| Check | Result |
| --- | --- |
| Focused image and presentation tests | 106 passed in six files |
| Focused statement coverage, same four modules | 93.13% before; 96.35% after |
| Focused branch coverage, same four modules | 91.04% before; 96.77% after |
| Focused function coverage | 100% before and after |
| Full unit coverage run | 3,601 passed in 245 files; four workers |
| Full coverage | Statements 87.55%; branches 83.69%; functions 85.98%; lines 89.18% |
| Python temperature tests | 18 passed |
| Project browser suite | 27 Chromium checks passed against the production build |
| Lint and TypeScript | Passed |
| Production build with current published content | Passed |
| Published trip collection | Four reports, including Down the West Coast; drafts excluded |
| Documentation links and whitespace | 287 local links passed in eight changed documents; whitespace passed |

Coverage uses the existing V8 provider. No thresholds or exclusions changed.
Focused coverage includes both image generators, `ProjectScreenshotGallery`, and `projectImages`.
Subprocess fixture execution does not count toward the parent process coverage report.
Local checks do not replace the physical-device checks in `TODO.md`.
No deployment or push ran during this review.
