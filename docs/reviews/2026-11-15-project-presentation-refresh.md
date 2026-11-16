# Project presentation review: November 15, 2026

Reviewed the eleven projects other than ADV Atlas after its separate screenshot refresh.
Compared portfolio descriptions, gallery images, captions, metadata, social cards, and feature notes with default-branch source and deployed applications.
Source repositories were read without changing their working trees.
Through Routes and parc needed temporary source mirrors because their local checkouts were behind the current default branch.

## Findings and changes

| Project | Source reviewed | Result |
| --- | --- | --- |
| Through Routes | `main` at `c451bd6`, November 15 | Replaced all three April captures. Updated road-profile, map-layer, route-history, unit, and export descriptions. Added November feature notes; newest represented feature is November 14. |
| Bookend | `main` at `f658947`, November 15 | Replaced the landing-page preview with the public reading dashboard, refreshed award and book details, and added a reading-profile capture. Added demo, analytics, bulk-list, catalog-search, and field-protection notes through November 15. Removed old catalog totals from captions. |
| Flights | Site source through `92bf654` | Replaced all three captures with current published data and controls. Updated recorded-duration and country-filter descriptions. Added the November 10 saved-shortcut setting. |
| Temperature Records | Site source through `92bf654` | Replaced all three March captures. Added freshness and coverage notes from November 3 and recent-record filter notes from September 3. Removed fixed daily counts from alt text. |
| Tornado Tracks | Site source through `92bf654` | Replaced all three April captures. Updated the reported-county-segment terminology, state filters, selected event, and visible comparison charts. Retained the April 29 feature date; later maintenance is not a feature release. |
| Status Dashboard | Site source through `92bf654` | Replaced all three older Watch Dashboard images with actual current Ink output and labeled sample responses. Added missing May 28 named-workflow notes and corrected the documented keyboard controls. |
| Pins of Inaccessibility | Site source through `92bf654` | Current November 13 captures, global coverage, parent navigation, context pins, layer dock, and feature notes already match the app. Retained them. |
| Route2GPX | `main` at `a2c3e54`, November 10 | November 3 screenshots and multi-format export notes remain current. The newer change adds analytics, which is excluded from the feature changelog. |
| Anki Artisan | `main` at `422842f`, May 22 | Card images and April feature notes remain representative. Updated descriptions and metadata to include CSV and Wikipedia sources, build previews, and incremental exports. Later commits are dependency maintenance. |
| aborg | `main` at `c558220`, October 12 | Checked later organizer and metadata changes. These fix existing behavior; retained the April 16 feature date and existing command documentation. The project has no gallery images. |
| parc | `main` at `a38a137`, September 29 | Archive diagnostics, provenance, scheduling notes, and the live-progress example remain representative. Retained the September feature date and current image. |

## Feature-date evidence

Dates below come from the introducing commit, not the screenshot refresh.

| Project | Commit | Capability |
| --- | --- | --- |
| Through Routes | `64b38a87c401fdf8b9752213a393c78f2647e105`, November 13 | Expanded profile inspection, full selected-road highlighting, shared layer controls, independent units |
| Through Routes | `b6c4b539932e3a76c24002f0ae2707592a0e3e2c`, November 13 | Separate scenic-stop and amenity layers |
| Through Routes | `25aa9b6026d3c655d4d9a2b1309b709374a79dee`, November 14 | Bounded route-builder undo and redo |
| Bookend | `8c03e21284dcca257fbb1fc96220f6de65503e74`, November 9 | Public reading demo |
| Bookend | `c39bdbb0f763df19e0e2554082b318119aae491b`, November 9 | Five profile analytics views, period comparisons, history links, exports |
| Bookend | `ee67eb3ac3f93472e8ddbc5a1723ca155c30c3be`, November 12 | Bulk personal-list assignment with mixed membership handling |
| Bookend | `b8388c4d55ebfc78f43d5598cc8533fa59df2e3e`, November 15 | Administrator book and author field protections |
| Bookend | `bd02ad06203be468f494cefc2555fd36a53bdf4f`, November 15 | Full-catalog links from global search |
| Flights | `f3edac438f08229b34a06db1459a04b678fe49b3`, November 10 | Saved character-shortcut setting |
| Temperature Records | `0a4bc7b253e5f0247d0187f475ab3b590d4d4479`, November 3 | Snapshot freshness and reporting-state coverage |
| Temperature Records | `d7073fb9eb6c914bd3d9e9158c10ec3a97340352`, September 3 | Recent observation filters for state, scope, and record margin |
| Status Dashboard | `ca4a3354e16a9c37a35060cfc4056e46b9c4fc20`, April 30 | Separate Amplify and GitHub sections with named workflows |
| Status Dashboard | `eedeb78f4c922c0d7695ba06acca9c908c5866ba`, May 28 | Visible status for configured workflows without a first run |

## Capture views

All web images are actual production browser captures at 1600 × 1000, with reduced motion and device scale factor one.
Dashboard images frame actual current Ink output with fixed sample provider responses at 1280 × 980.
They are labeled example data and contain no account credentials or live cost claims.

- Through Routes: Ozarks view at `mlat=37.25`, `mlng=-91.45`, `mz=9`; layer menu open; selected paved road from the In View list sorted by length, with its loaded profile.
- Bookend: `/demo`, `/demo/lists/booker-prize` in Table view, `/demo/books/george-saunders-lincoln-in-the-bardo-2017`, and `/demo/profile`.
- Flights: Atlantic overview at `lat=35&lng=-45&alt=2.2`; `airport=SEA`; `country=GB&lat=54&lng=-3&alt=1.1`. All use `anim=false&rotation=false`; captures wait for camera transitions to finish.
- Temperature Records: default recent view, `view=state`, and `view=freshness`.
- Tornado Tracks: default 2025 view; `start=2013&end=2013&lat=38.74&lng=-90.34&zoom=9&track=ncei-2013-444534`; `mode=trends` with annual count and deaths-per-100 charts in view.
- Status Dashboard: compact view, detailed build sections, and detailed resource sections after scrolling.

Responsive preview files and their manifest are regenerated after source captures are complete.
Updated social-card sources and PNGs use the same reviewed capability descriptions.
Use the [image guide](../image-assets.md#other-project-screenshot-views) for refresh requirements.

The deployed Through Routes expanded profile retained a loading label alongside its completed chart during capture.
The gallery uses the loaded compact detail panel instead. No external application source was changed.

## Validation

These results cover the first presentation pass.
The [quality review](2026-11-15-project-quality-review.md) records later fixes and final checks.

| Check | Result |
| --- | --- |
| Focused date, project-page, preview, metadata, and social-card tests | 156 passed in nine files |
| Project browser suite against the production bundle | 17 passed |
| Additional gallery checks for Through Routes, Bookend, and Status Dashboard | Six phone/desktop views passed; every image decoded at its declared dimensions; no horizontal page overflow |
| Current Ink capture with example polling responses | Passed; compact, detailed, and scrolled resource views rendered |
| Refreshed gallery image dimensions | All 19 matched their declarations |
| Responsive preview integrity | All 66 variants matched the manifest; source image dimensions matched for all 11 illustrated projects |
| Static project metadata | Seven updated project routes contained the reviewed description, screenshot, and feature date before JavaScript |
| TypeScript | Passed |
| Production bundle (`npx vite build`) | Passed |
| Documentation links and whitespace | Passed |

Changes are local. This review did not publish or deploy the portfolio.
