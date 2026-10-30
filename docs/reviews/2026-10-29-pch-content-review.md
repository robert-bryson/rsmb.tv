# PCH content review

Review date: October 29, 2026.
Baseline: `f6197a3c522dc36c22c435c74fd4a9acb8bbf5ae`.

## Scope

The review covers the pending PCH manifest, gallery reference, and Drive writing outline.
The manifest replaces `pch-2024.json.draft` with `pch-2024.json`.
Application code is unchanged.

Standards and specification reviews ran separately.
The specification comes from the user's image-import, gallery, and writing-outline requests.
The final request selected Markdown in the mounted Drive trip folder.

## Standards

Two documentation findings were corrected:

1. **P3: Current instructions included undated import results.**
   The original gallery guide mixed processing totals and verification claims with authoring instructions.
   `docs/README.md` requires separate current procedures and historical results.
   Completed checks now appear in this dated report.
   The gallery guide contains source locations, media references, ordering notes, and publication procedures.

2. **P3: One guide description exceeded the sentence limit.**
   The October 4 ordering sentence contained 26 words.
   The documented maximum is 25 words for descriptions.
   The guide now separates the ordering decision from its rationale.
   Seven long sentences in the Drive outline were also shortened.
   Its headings and media placements are unchanged.

No additional correctness, security, or maintainability defect was reproduced in the manifest.
No applicable Fowler code smell was found in these data changes.

## Spec

The review found no missing or incorrect requirement.

- All 99 ZIP images match their Drive original and selected copies byte for byte.
- The manifest passes the application schema.
- Its prepared filenames, dimensions, and file sizes match the Drive asset report and local preview cache.
- Each of the five daily galleries contains photos with matching capture dates.
- Every route track, gallery, and photo reference resolves.
- The outline contains writing prompts, preparation, five daily chapters, and a closing reflection.
- The outline provides no first-person trip account.
- Its chapter headings match the manifest's `headingId` values.
- Its media placements expand and compile through the existing MDX importer.
- It places 97 distinct photo IDs without repetition, including all six panorama exports.
- Two related source frames remain available as alternatives: `dscf9130` and `r003242`.

The `.json` extension permits local loading.
It does not change the Sheet's publication state.
The user did not request public asset uploads.

## Import results

The original archive is `Down the West Coast 24-1-001.zip`.
The Drive source folder is `projects/rsmb.tv/trips/pch-2024`.

The processor generated 307 WebP derivatives with fingerprinted filenames and 307 compatibility aliases.
It corrected orientation, removed embedded metadata, retained aspect ratios, and used quality 84.
Five panorama exports received widths through 3200 px.
The remaining export, `r003247-pano`, retained the standard 1600 px maximum.

The report contains 15 advisory file-size warnings across six source photos.
These warnings did not prevent processing.
The five existing route outputs retained their original contents.
Source copies and generated files passed checksum verification.

## Regression checks

The import initially depended on manual checks.
The review adds 19 offline tests in `scripts/__tests__/tripManifestAuthoring.test.ts`.
These tests require no Drive mount, Google connection, or public asset requests.

The tests check these contracts:

- All tracked trip manifests pass the production schema and match their filenames.
- Each PCH photo belongs to its dated daily gallery exactly once.
- October 4's gallery ends with the known motel arrival.
- Responsive sources use the same photo ID and fingerprint at each width.
- Width descriptors match filenames and the largest manifest source.
- The guide lists every gallery with its current photo count.
- Gallery, day-map, and panorama shortcodes expand through the importer.
- Separately placed panoramas are absent from their adjacent scene galleries.
- Invalid IDs, duplicate references, shared tracks, and inherited gallery properties fail validation.
- Shared overnight stops and overlapping galleries remain valid.

The focused coverage comparison uses `tripContent.test.ts` before the change.
The after run also includes `tripManifestAuthoring.test.ts`.
Both runs measure only `shared/tripManifestSchema.ts`.

| Metric | Before | After |
| --- | ---: | ---: |
| Statements | 58.10% | 90.54% |
| Branches | 44.06% | 77.96% |
| Functions | 83.33% | 100% |
| Lines | 60.00% | 89.23% |

These figures describe the focused suite, not repository-wide coverage.

Validation results:

- `npm test`: 112 JavaScript test files passed; 1,653 tests passed.
- The same command ran 17 Python tests; all passed.
- `npm run lint`: passed without warnings.
- `npm run typecheck`: passed.
- The Drive outline's shortcodes, heading links, and MDX compilation passed direct validation.

## Limits and source ownership

The outline remains in Drive as `pch-2024-outline.md`.
It is not a Git content source or an automated-test dependency.
The reference, manifest, tests, and this review are versioned in Git.

The Ricoh clock correction remains an inference from the route and visible scenes.
Original timestamps and capture dates are unchanged.
Repeated Fujifilm coordinates do not establish new stop locations.

The review did not check public CDN availability or run a live Google import.
It did not change UI behavior, so browser checks were not repeated.
Use [TODO.md](../../TODO.md#pch-2024-trip) for the remaining publication work.

Standards: two P3 findings, both corrected; the main issue was mixed instructions and historical results.
Spec: zero findings.
