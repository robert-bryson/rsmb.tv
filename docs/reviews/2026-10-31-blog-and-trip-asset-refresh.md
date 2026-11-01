# Blog and trip asset refresh

Review date: October 31, 2026.

The refresh imported the linked Mississippi–Wisconsin draft and processed the newly supplied July 17, 2026 recording.
The repository manifest, source inventory, local previews, and Drive copies now include that recording.

## Content import

The live Sheet contains 11 post rows: three published posts and eight drafts.
Ten source documents imported successfully. The cycling draft returned HTTP 401 and retains its development error.

Sheet row 7 now links the Mississippi–Wisconsin source Doc.
Its starter outline imports with working map and gallery references. Its description remains empty.
Route 66ish also needs a description. The three 2026 descriptions remain incomplete.

The production import used a separate output directory to preserve local draft previews.
It imported all three published posts and validated 345 distinct public asset URLs.
Every checked URL returned HTTP 200. The three public routes contained their declared tracks.

RSS and sitemap regeneration retained the three published posts and excluded drafts.
The final local registry includes all 11 rows and their current development status.

## Photo and GPS review

The review compared all seven trip folders with the previous inventory and repository manifests.
It also checked the GPS recovery archive, Downloads media candidates, and the relevant Pictures folders.
The filename comparison found one new in-scope GPX file and no new selected photographs.

| Trip | Manifest photos | Primary GPX files | Recorded miles |
| --- | ---: | ---: | ---: |
| Ocean Shores 2024 | 10 | 2 | 306 |
| Boise 2024 | 79 | 6 | 1,626 |
| Kalaloch 2024 | 25 | 3 | 450 |
| PCH 2024 | 99 | 5 | 1,641 |
| Route 66ish 2025 | 57 | 8 | 2,619 |
| Mississippi–Wisconsin 2025 | 26 | 8 | 1,344 |
| ON–QC–New England 2026 | 1 | 36 | 5,578 |
| Total | 297 | 68 | — |

All 297 primary images and 903 responsive candidates exist locally and match their declared dimensions.
Contact sheets were reviewed for visible content, orientation, and obvious corruption.
The selected sources contain no exact duplicate photo files within a manifest.
The primary GPX inputs contain no exact duplicate track geometries within a trip.
Authored photo dates match available EXIF capture dates where both exist.
Original and selected bytes match where both retain the same source filename.

Boise's three intentionally excluded duplicates remain excluded.
Its existing 162-JPG source folder remains uncurated. The two Route 66ish videos remain archived originals.
No new evidence justified adding these existing files to the photo manifests.

Every local combined route contains exactly its declared track IDs and valid line coordinates.
Existing image-size warnings remain recorded in the machine inventory.
Some older GPS exports have no per-point timestamps. Their filename dates do not establish travel dates.
The Kalaloch chronology and Boise reconstruction checks remain open in [TODO.md](../../TODO.md).

### Source date conflict

Ocean Shores has conflicting travel-date evidence.
The manifest uses February 17–20, 2024, matching the two GPX filenames.
The source photos span February 16–19 instead.
The departure ferry image records February 16 at 13:41:37, with an explicit `-08:00` offset.
The Seattle return image records February 19 at 18:13:11, also with an explicit `-08:00` offset.
The intervening beach and town photos fit that earlier window.

Both GPX exports lack per-point timestamps, so they cannot resolve the disagreement independently.
The manifest dates and original EXIF remain unchanged pending author confirmation.
The conflict is recorded in the current inventory and [TODO.md](../../TODO.md#ocean-shores-trip).

## Recovered July 17 route

The new source is `Jul_17,_2026_07_41_40.gpx`.
It exists in both the organized trip folder and `Fog of World/Import/Archive`.
Their SHA-256 hashes match:

```text
e7e78563ee4cc819ff781a921b137a6110cff0641583b2dc11e6ea0cda2d1d71
```

The recording contains 26,607 source points and runs from July 17 at 11:41:47 UTC to July 18 at 00:46:07 UTC.
Its local travel date is July 17. The recording measures 707.6 km, or approximately 440 miles.
The simplified route retains 1,953 points at the existing five-meter tolerance.
Its endpoints are approximately 18 meters and five meters from the neighboring recordings.

The existing riding-day method finds approximately 436.3 miles and 7.32 hours of qualifying movement.
The manifest therefore adds one provisional riding day.
The complete route now measures 8,976.2 km, or 5,578 recorded miles, across 36 tracks and 34 recorded dates.
The manifest retains 37 calendar-day entries and now estimates 27 riding days.
The remaining dates without recordings are July 12, August 10, and August 13.

The July 17 day references `jul-17-2026-07-41-40` and retains its selected hero gallery.
The Part 2 outline adds the day map and replaces the missing-recording prompts.
The original GPX bytes and names remain unchanged. The July 21 overlapping alternate remains outside the combined route.

## File updates

All seven local preview folders were refreshed from prepared source assets.
The 2026 folder now contains 37 GeoJSON files: one combined route and 36 individual tracks.

The Drive synchronization updated 22 files after validating their expected contents.
These include the new track, combined route, affected track-order metadata, asset report, provenance, manifest snapshot, and Part 2 outline.
The synchronization also corrected the stale Route 66ish manifest snapshot.
That snapshot now includes the repository's confirmed motorcycle, eight riding days, recorded mileage, and current hero.

Replaced Drive files were backed up under `.cache/content-refresh-2026-10-31/drive-backup/` before replacement.
Source photos, selected photos, alternate exports, Google Docs, and Sheet publication values were preserved.
Public assets were not uploaded, and no deployment was started.

The source Docs still contain earlier starter text.
In particular, the 2026 Docs retain `.json.draft` notes, and Part 2 still describes July 17 as missing.
The updated Markdown outlines are available in the repository and Drive.
The remaining source corrections and inaccessible cycling draft are recorded in [TODO.md](../../TODO.md).

## Validation

| Check | Result |
| --- | --- |
| Trip authoring, content, import, asset preparation, feed, and atlas-entry tests | 227 passed across seven files |
| Repository manifests and local route geometry | Seven manifests and 68 tracks passed |
| Local photo references and dimensions | 297 primary photos and 903 responsive candidates passed |
| Production Sheet/Docs import and public assets | Three posts and 345 URLs passed |
| Development import | 11 rows retained; ten source documents available |
| Open Graph, RSS, and sitemap generation | Passed |
| TypeScript | Passed |
| Vite development build | Passed |

Review evidence and contact sheets are retained under `.cache/content-refresh-2026-10-31/`.
Generated content and preview files remain ignored by Git.
Concurrent atlas interface changes were left untouched.
