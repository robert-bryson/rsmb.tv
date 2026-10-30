# Trip report editorial review — October 29, 2026

The three available stories need copy edits and route and photo clarifications.
The initial snapshot also had three exact duplicate photo pairs in Boise.
The manifests, media references, and local image dimensions passed structural checks.

The findings below describe the local content before the manifest cleanup on October 29, 2026.
The initial review did not change stories, manifests, Google Docs, or the Sheet.

## Completed local corrections

The later quality review made these corrections:

- Removed Boise's three duplicate photo entries. The manifest now has 79 photos.
- Removed unused gallery definitions from all three manifests.
- Corrected the first Ocean Shores day heading ID and all three Kalaloch day heading IDs.
- Kept single portrait photos within the text column.

The remaining copy and route findings still need source corrections or author confirmation.
The counts and line references below refer to the initial snapshot. They are not current manifest counts.
See the [quality review](2026-10-29-trip-editorial-quality-review.md) for the code changes and test results.

## Coverage and source ownership

The local registry contains nine trip entries. Two are marked published, one has an available draft story, and six have no imported body or manifest.

| Report | Local status | Sources |
| --- | --- | --- |
| Going to the beach in the rain | Published; full review | [Story](../../src/content/blog/ocean-shores-2024.mdx), [manifest](../../src/content/trips/ocean-shores-2024.json), [source Google Doc](https://docs.google.com/document/d/1dEW6z_Z1HfylRlHNbRjcFFJdAA5AeVcEpVTXtx4XPT0/edit) |
| 1,600 Miles to Boise and Back | Published; full review | [Story](../../src/content/blog/boise-2024.mdx), [manifest](../../src/content/trips/boise-2024.json), [source Google Doc](https://docs.google.com/document/d/1InEIRnzsj9ed-ERYBGWnIKMTPrmSC9Ave0zYOKsBmjc/edit) |
| Like riding speeders through Endor | Unpublished; full review | [Story](../../src/content/blog/kalaloch-2024.mdx), [manifest](../../src/content/trips/kalaloch-2024.json), [source Google Doc](https://docs.google.com/document/d/1Dex7bs4H8H2V7bLzA2V0h7x4zPTUe2F4O-0ZXSpCurQ/edit) |
| Down the West Coast | Unpublished; metadata only | `pch-2024` |
| Weaving around Route 66 to St. Louis | Unpublished; metadata only | `route-66ish-2025` |
| Up the Mississippi and Wisconsin | Unpublished; metadata only | `river-wisco-2025` |
| St. Louis to the UP | Unpublished; metadata only | `on-qc-new-england-2026-part-1` |
| Canadian Shield, Boreal forest, St. Lawrence | Unpublished; metadata only | `on-qc-new-england-2026-part-2` |
| New England, Mid Atlantic, Appalachians | Unpublished; metadata only | `on-qc-new-england-2026-part-3` |

Story line numbers below refer to the generated MDX snapshot reviewed here. Make lasting prose changes in the source Google Docs; blog sync overwrites the generated files. Titles, descriptions, tags, and publication settings belong in the [source Sheet](https://docs.google.com/spreadsheets/d/1veNLJMfE21Px0JEVUoV9ClLJaDATy1DkpoWFruCPjMI/edit). Photo descriptions, day records, and stops belong in the manifests. Route corrections belong in the source route files before regeneration.

## Definite copy corrections

| Report and story line | Current wording | Suggested correction |
| --- | --- | --- |
| Ocean Shores 20; Kalaloch 86 | `Aerostitch` | `Aerostich`. This is the manufacturer's spelling; see its [Roadcrafter page](https://www.aerostich.com/pages/roadcrafter-features). |
| Ocean Shores 30 | `at one point having double back` | `at one point having to double back`, or more directly, `I had to double back once`. |
| Ocean Shores 40 | `We puttered around town for a few days; going for walks ...` | The semicolon introduces a fragment, and the activities lose parallel structure. Try: “We puttered around town for a few days, walked on the beach, and explored a little, but mostly cozied up inside, watched movies, and tended the fire.” |
| Boise 102 | `It was a short ride ... to Boise, then spent a few days ...` | Supply the subject: “I rode the short distance from Nampa to Boise, then spent a few days in meetings and work events.” |
| Boise 144 | `warming up quickly.I kept` | `warming up quickly. I kept`. |
| Boise 146 | `Western Raite Road` | Likely `Western Route Road`. The [Umatilla National Forest road inventory](https://www.fs.usda.gov/media/167297) lists Western Route, road 5300000. Confirm the intended road against the track. |
| Kalaloch 10 | `the ride though the rain forest` | `the ride through the rain forest`. |
| Kalaloch 50 | `stretching between a creek mouth to the south to rocky headlands to the north` | Use either “stretching from a creek mouth in the south to rocky headlands in the north” or “stretching between a creek mouth and rocky headlands.” |
| Kalaloch 50 | `with a breeze and faintest threat` | `with a breeze and the faintest threat`. |
| Kalaloch 58 | `a typically camping-type dinner` | `a typical camping dinner`, or name the meal if it adds something to the scene. |

## Claims and content details to reconcile

### Boise's full collection repeats three photographs

The hero offers “View all 82 photos,” but three pairs of primary images decode to identical pixels, leaving 79 distinct images. The duplicate IDs are not repeated inside the current inline galleries; the repetition is in the full collection, which includes every manifest photo.

| First photo ID | Duplicate photo ID |
| --- | --- |
| `boise-2024-05-11-butter-creek-hills` | `boise-2024-05-11-yakima-river-hills` |
| `boise-2024-05-11-blue-mountains-afternoon` | `boise-2024-05-11-blue-mountains-sunset` |
| `boise-2024-05-11-camp-moto` | `boise-2024-05-11-moto-sunset` |

Completed: kept one entry from each pair and removed the unused `highlights` gallery.
All retained inline galleries reference the remaining photos.
The snapshot also used misleading alternate names: the same scene was described as both afternoon and sunset.
The Butter Creek image had a second ID naming the Yakima River.
Sources: initial `boise-2024.json:245–341`; decoded-pixel SHA-256 comparison of the local primary image files.

### Ferry boarding: Ocean Shores 28 and Kalaloch 30

Ocean Shores says ferries “always have extra space” for motorcycles and bicycles. Kalaloch generalizes that motorcyclists do not have to book ahead like other vehicles. These read as general travel advice, although the stories establish only what happened on the crossings taken.

WSDOT describes loading subject to available space, and its Port Townsend terminal page recommends reservations for motorcycles on that route. Narrow the statements to the actual experience: “On these crossings, it was usually easy to find room for a motorcycle.” The passages about making a particular ferry and being directed to the front can remain personal observations. Sources: [WSDOT motorcycle loading information](https://wsdot.com/ferries/vesselwatch/terminaldetail.aspx?terminalid=8), [Port Townsend motorcycle reservations](https://www.wsdot.com/ferries/vesselWatch/TerminalDetail.aspx?terminalid=17).

### Boise route provenance is invisible to readers

The manifest identifies May 17, 18, and 19 tracks as `reconstructed`, but the public track names and story do not explain that distinction. The opening overview presents recorded and reconstructed tracks together. Add a short note near the overview explaining which portions were reconstructed and that their positions and distances are approximate where applicable. The original first leg also begins about 7 km in a straight line from the Seattle departure marker, so it does not record the whole departure described in the prose.

Sources: `boise-2024.json:23–47`; the current local `public/data/trips/boise-2024/geo/route.geojson`; story 30.

### Boise's overnight route boundary disagrees with the campground

The May 18 reconstruction ends, and the May 19 reconstruction begins, at `[-121.827736, 45.866683]`. The manifest's Panther Creek Campground marker is `[-121.880148, 45.819717]`, about 6.6 km away in a straight line. The tracks pass close to the campground before reaching their shared endpoint farther upstream.

The prose says the night was spent at the campground, followed by a trip up the road to the falls the next morning. Reconcile the track split with that sequence. This is a confirmed disagreement between route endpoints and the authored overnight marker; the exact intended split needs checking against the source reconstruction. Recreation.gov also distinguishes the campground from the falls, which it describes as 4.7 road miles upstream. Sources: `boise-2024.json:129–146`, story 156 and 166, [Panther Creek Campground](https://www.recreation.gov/camping/campgrounds/233103).

### Boise's May 12 barn photo needs a mountain-name check

The alt text for `boise-2024-05-12-wallowa-barn` names the Wallowa Mountains (`boise-2024.json:493`). The gallery is placed directly after the account of Sumpter, Bates, Dixie Summit, and the Strawberry Mountains near Prairie City (story 82–86). Check the original photo location and visible range. The current placement and identification need reconciliation; the review does not establish which range is visible. A generic description is preferable until confirmed.

### Nampa has no map stop

Boise's “Blue Mountains to Nampa” day includes only `camp-1` in its stops, and “Nampa to Boise” includes only `boise`. There is no Nampa stop in the manifest. The maps have route geometry, but readers cannot identify the named intermediate destination from the stop labels. Add the hotel/Nampa location as a stop shared by those two days. Source: `boise-2024.json:57–70`.

## Narrative and readability improvements

| Report and location | Issue | Suggested edit |
| --- | --- | --- |
| Ocean Shores 10 | `just enjoy ... just being` and the final explanation repeat the same premise. | Tighten the opening to the friends' idea and why it appealed to you; preserve the deliberately quiet mood. |
| Ocean Shores 22 | `had never been on two wheels` sounds literal, immediately after an account of earlier rides. | `had never taken that route by motorcycle`. |
| Ocean Shores 32 | `Cutting inland west of Shelton, the temperatures dropped` grammatically makes the temperatures do the riding. | `As I cut inland west of Shelton, the temperature dropped.` |
| Ocean Shores 52 | `It ... ended up with a beautiful skyline` leaves the subject unclear. | `The detour rewarded me with a beautiful skyline ...` |
| Ocean Shores 60 | `an accomplishment to myself to be able to actually go places` is wordy. The final gear aside is ambiguous. | `It felt like an accomplishment to go somewhere by motorcycle.` Then specify what you would bring or leave behind next time. |
| Boise 14 | `Miles to go ... but suddenly wasn't sure` is a dramatic fragment with an awkwardly missing subject. | `I still had miles to go to meet my partner at camp, and suddenly I wasn't sure I would make it.` |
| Boise 30 | Repeats anxiety about the day and trip, then uses `first time motocamping` without a smooth connection. | `I left Seattle anxious: this would be my longest motorcycle ride and my first camping trip on the bike.` |
| Boise 74 | `snowmelt` appears twice in the same paragraph. | Combine the flooded meadows, patchy snow, and road debris into a shorter progression toward the snow crossing. |
| Boise 94 | `a long day ... a challenging day` repeats, and `unfortunate ... perfectly fine` weakens the hotel detail. | Keep the specific uncertainty about daylight and the relief of arriving. |
| Boise 118 | Hells Canyon is described as uniformly 8,000 ft deep and 10 miles wide. | Make the scale more precise with `up to` or `at its deepest`. The approximate maximum figures themselves are supported by the [Forest Service description](https://www.fs.usda.gov/Internet/FSE_DOCUMENTS/stelprdb5378417.pdf). |
| Boise 138 | `could seem when you pick ... all you needed` shifts tense and joins full clauses with a comma. | `It was funny how different a road could seem on a motorcycle: all I needed was a tire's width of smooth surface.` |
| Boise 148 | One long paragraph combines scenery, handling changes, diagnosis, and the first attempt to continue. | Break at `Eventually ... notice`. Let the tire problem interrupt the scenic rhythm, echoing the opening. |
| Boise 152–154 | Successive paragraphs begin with `Eventually`; the sequence of small towns is vague. | Vary the transition and name the repair town if you remember it. That would help resolve the story's opening problem. |
| Kalaloch 10 | The opening sentence carries several locations and actions before reaching the friend's remark. | Split after the ride description so the Endor comparison gets its own sentence. |
| Kalaloch 32 | `on to the Kitsap then Olympic Peninsula` is compressed and grammatically uneven. | `onto the Kitsap Peninsula, then the Olympic Peninsula`. |
| Kalaloch 48 | `it just is a very nice place` tells the reader what the following details already show. | Cut it, or replace it with a concrete memory from that morning. |
| Kalaloch 52 | The Clearwater/Hoh route is difficult to follow in one sentence. | Break at the move onto the Hoh Mainline; name the initial road if useful. |
| Kalaloch 54 and 68 | `returned back` and `packing camp` are awkward. | `returned` and `packing up camp`. |
| Kalaloch 70 | The morning beach gallery follows the paragraph about packing and riding south. | Move it directly after the morning beach paragraph at 66 to keep photos beside the scene they illustrate. |

All three conclusions begin with the same sentence, “Overall it was a great trip.” Boise repeats the overall assessment again within that paragraph. Give each conclusion a distinct takeaway: winter comfort and confidence for Ocean Shores, what the flat tire changed about future preparation for Boise, and the experience of riding with a friend and without luggage for Kalaloch. These are suggested directions, not facts to add without the author's recollection.

Keep conversational choices such as “Absolutely bananas,” the Power Ranger comparison, and “home again, home again” where they express your voice. They do not need to be standardized away.

## Presentation and manifest cleanup

- **Unit spacing:** All three stories use subtitles such as `(136mi. / 218km.)`. A consistent `(136 mi / 219 km)` is easier to read. Ocean Shores' outbound `218 km` also differs from the local route's 219.119 km. Most other one-unit differences between miles and kilometers are ordinary effects of independent rounding and do not establish a wrong trip total. Boise's six displayed daily mileages sum to 1,625 while the manifest rounds the trip to 1,626; that difference alone is not an error.
- **Heading style:** Ocean Shores mixes title case with “The Ride Home: Ocean Shores back to Seattle”; Kalaloch predominantly uses sentence case, while Boise uses title case. Choose a convention across the collection. Also choose consistent spellings for `rainforest`/`rain forest`, `tide pools`/`tidepools`, and US/UK variants such as `traveled`/`travelled`.
- **Alt text and captions:** Of 117 still photos, only one has an authored caption. The renderer and viewer fall back to alt text. This is functional, but many photos would benefit from place names or a short anecdote instead of only a visible-content description. Ocean Shores also puts comments such as “Yup” and “It looks much nicer up there” in alt text; those would fit better in captions. Add captions selectively rather than requiring one for every photograph.
- **Heading references — completed:** Corrected Ocean Shores' first day from `day-1-seattle-to-ocean-shores` to `seattle-to-ocean-shores`. Removed the obsolete day prefixes from all three Kalaloch heading IDs. These values now match the generated headings. The application does not currently consume `days[].headingId`.
- **Internal link normalization:** Boise 20 and Kalaloch 30 link to `https://www.rsmb.tv/trips/ocean-shores-2024`. Prefer `/trips/ocean-shores-2024` to match the site's canonical host and keep local previews local. Neither URL is established to be broken by this review.
- **Unused gallery definitions — completed:** Removed Ocean Shores' `ride-home-gallery-id` and the `highlights` galleries in Boise and Kalaloch. The stories and day records did not reference these definitions. Boise's three photos outside the inline story were the duplicate copies identified above.

## Unfinished draft metadata

The six unavailable stories cannot receive a prose review from this snapshot. All six lack a Google Doc reference and the required trip manifest. Those are draft-completion tasks, not failures affecting the two published posts.

| Draft | Additional issue |
| --- | --- |
| `pch-2024` | No additional definite copy error in the available title or description. Full story and manifest are still missing. |
| `route-66ish-2025` | Description is missing; the local registry substitutes “Draft description is not available.” |
| `river-wisco-2025` | Description is missing with the same fallback. |
| New England part 1 | Description is the unfinished `Part 1 of`. “UP” could be expanded to “Upper Peninsula” for readers outside the region. |
| New England part 2 | Description is the unfinished `Part 2 of`. Title capitalization is inconsistent in `Canadian Shield, Boreal forest, St. Lawrence`; choose `boreal forest` in sentence case or `Boreal Forest` in title case. |
| New England part 3 | Description is the unfinished `Part 3 of`. Tags misspell Pennsylvania as `pennslyvania` and Indiana as `indianna`. `Mid Atlantic` would normally be `Mid-Atlantic`. |

The three New England rows have no series metadata in the local registry. When the stories become available, add a consistent series title and order so their relationship does not depend on placeholder descriptions. Check the actual itinerary before changing geography tags; the draft titles alone are not enough to infer every state visited.

## Verification and limits

- Read all three available MDX bodies, all three manifests, and metadata for all nine trip entries.
- Inspected contact sheets covering all 117 still photos, with larger views for selected details.
- Compared decoded primary-image pixels within each trip. Boise has three exact duplicate pairs; Ocean Shores and Kalaloch have none.
- All three complete manifests pass the existing schema and bundled-animation fingerprint checks. All three MDX bodies compile.
- Local route GeoJSON is valid, and every manifest track reference exists. All referenced photo, gallery, day, and animation IDs resolve.
- All 117 primary local still-photo files exist and match their manifest dimensions. Every listed responsive-image candidate also exists locally and has its declared width.
- The three reports render in Chromium at desktop and phone widths without observed horizontal overflow or page JavaScript errors. This was a reading spot check, not an exhaustive browser or accessibility audit.
- This review used existing imported content; it did not refresh or modify the Google sources. Public site/CDN availability was not established: command-line DNS lookup and the web tool could not reach the tested story URLs. Local asset checks do not prove that every CDN object is deployed.
- Track IDs containing dates different from the trip dates were not treated as chronology errors: filenames and IDs are identifiers, and the corresponding authored date fields are absent. Confirm actual travel dates from the source records before changing those IDs.
