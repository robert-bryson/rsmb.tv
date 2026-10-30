# Adaptive trip galleries research: 2026-10-29

## Recommendation

Use justified rows as the default layout. Each row fills its available width and retains each photo's intrinsic aspect ratio.
Add a small set of two-row collage patterns when the photo ratios and story order support them.
Use the article column for a gallery containing one portrait.
Keep standalone `TripPhoto` placements and explicit panoramas under their existing author controls.

The research sections describe the design options. The final section records implementation and verification.
The external references below are primary sources, checked on the report date.
No applicable `AGENTS.md` was found in the repository or its ancestor directories.

## Repository constraints

| Area | Current behavior | Design consequence |
| --- | --- | --- |
| [Gallery](../../src/features/trips/components/TripGallery.tsx) | Uses two equal columns, then three at `640px`. Most frames have a forced `4:3` ratio. | Intrinsic dimensions must replace fixed crop geometry. |
| [Photo renderer](../../src/features/trips/components/TripPhoto.tsx) | Supplies dimensions, responsive sources, failure handling, captions, and viewer links. | Reuse `TripPhotoFigure`. |
| [Photo schema](../../shared/tripManifestSchema.ts) | Requires positive intrinsic width and height. | Layout does not require image decoding or DOM measurement. |
| [Page layout](../../src/components/Layout/Layout.tsx) | Uses a `48rem` outer column with `3rem` total horizontal padding. | The maximum text-body width is `45rem`, normally `720px`. |
| [Trip CSS](../../src/index.css) | Breakout media stops at `72rem`. A page query container excludes classic scrollbars. | Retain existing breakout calculations for grouped galleries. |
| [Story provider](../../src/features/trips/TripStoryProvider.tsx) | Collects viewer links in document order. | Preserve photo order and one link per photo. |
| [Authoring guide](../trips/TRIP-AUTHORING-README.md#galleries) | Shows nine photos initially, with hidden links for later entries. | Preserve expansion, hidden entries, captions, and viewer order. |

The manifests contain useful mixed-orientation fixtures.
Kalaloch's `2024-06-23-ferry` pairs ratios `0.75` and approximately `1.333`.
Ocean Shores' `day-one-gallery-id` starts with a portrait, followed by two landscapes.
Boise's `workdays-in-boise` places a portrait between two landscapes.
Boise also has long galleries, so the design needs more than small-count templates.
These observations come from the [local manifests](../../src/content/trips/).

## Approach comparison

| Approach | Preserves full photos | Fills a rectangle | Story-order implications | Fit here |
| --- | --- | --- | --- | --- |
| Justified rows | Yes, with unconstrained row heights. | Each row reaches both edges. | Contiguous row groups retain order. | Best baseline. |
| Equal-width masonry | Yes, if heights follow ratios. | Fills columns; the bottom usually remains uneven. | Shortest-column placement can complicate visual reading order. | Does not satisfy the paired-photo width requirement. |
| Balanced columns | Yes. | Can balance overall height. | Column grouping can conflict with expected row reading. | Less suitable for chronological story groups. |
| Fixed grid with spanning tiles | Usually needs cropping. | Yes. | Explicit placement can change visual order. | Use only when geometry follows ratios. |
| Aspect-aware two-row collage | Yes, with solved dimensions. | Yes, including gaps. | Candidate patterns must retain a clear encounter order. | Useful enhancement for small groups. |

Flickr's layout utility accepts dimensions or ratios and returns geometry.
It exposes row height, spacing, widow, and breakout controls.
Its defaults should not be treated as a lossless guarantee.
The source can clamp edge-case row heights, which changes item ratios and requires cropping or padding.
See [Flickr's documentation](https://flickr.github.io/justified-layout/) and [row implementation](https://github.com/flickr/justified-layout/blob/main/lib/row.js).

React Photo Album offers rows, columns, and masonry components.
Its row controls include target height, minimum and maximum photo counts, and a single-row height cap.
It is a credible alternative if general album features become necessary.
For this change, a small geometry module avoids adapting the existing captions, PhotoSwipe links, and source format.
The dependency choice is an inference from the local integration work.
See [React Photo Album documentation](https://react-photo-album.com/documentation).

Native masonry remains an evolving CSS Grid Level 3 feature.
The current specification describes `grid-lanes` and a tolerance for selecting the least-filled lane.
It does not turn masonry into a rectangle with equal row edges.
The browser vendor's guide recommends progressive enhancement and notes possible visual-order differences.
See [CSS Grid Level 3](https://www.w3.org/TR/css-grid-3/) and [WebKit's Grid Lanes guide](https://gridlanes.webkit.org/).

## Exact two-photo layout

Let `rᵢ = widthᵢ / heightᵢ`, `W` be the available photo width, and `g` be the gap.
For a row of `n` photos:

```text
H = (W - (n - 1)g) / Σrᵢ
wᵢ = H × rᵢ
```

These equations are direct geometry, rather than a library-specific algorithm.
They give equal image heights and exactly consume the available row width.
For two photos, widths therefore follow `r₁:r₂`.
This differs from comparing intrinsic pixel widths, which can reflect resolution rather than shape.

At `W = 1152px` and `g = 12px`, the Kalaloch pair receives approximately `410.4px` and `729.6px`.
Both images are approximately `547.2px` high.
Two equal landscapes receive equal widths without special handling.

CSS can perform the final proportional distribution.
Use zero minimum track sizes, or `min-width: 0` for flex items.
Normalize proportional weights so each is at least `1`.
Both Grid and Flexbox can leave free space unused when their factors sum below `1`.
See [Grid flexible lengths](https://www.w3.org/TR/css-grid-2/#fr-unit) and [Flexbox flexibility](https://www.w3.org/TR/css-flexbox-1/#flex-flex-grow-factor).

Keep borders outside the ratio calculation, or use an inset shadow.
Otherwise, equal outer-frame heights can differ slightly from equal image heights.
Keep full image content visible; an existing hover scale also clips edges temporarily.
`object-fit: cover` preserves image proportions but clips content when frame proportions differ.
See [CSS Images object fitting](https://www.w3.org/TR/css-images-3/#the-object-fit).

## Filled two-row patterns

Evaluate a bounded set of candidates instead of assigning a pattern from photo count alone.

1. Split consecutive photos into two justified rows, such as `2 + 2`, `2 + 3`, or `3 + 2`.
2. Consider a portrait beside two stacked landscape groups.
3. Reject candidates with tiny tiles, excessive height, or confusing encounter order.
4. Prefer a collage only when it improves the photo dimensions. Otherwise, retain justified rows.

For a three-photo example, a portrait can sit beside two landscapes without cropping.
The landscape heights need not match each other.
A forced `50% / 50%` split would only work for particular ratios.

The following equations solve one portrait beside two individual images.
Here `p` is the portrait ratio and `a`, `b` are the other ratios:

```text
T = 1/a + 1/b
H = ((W - g)T + g) / (1 + pT)
portraitWidth = pH
otherColumnWidth = W - g - portraitWidth
topHeight = otherColumnWidth / a
bottomHeight = otherColumnWidth / b
```

Thus `topHeight + g + bottomHeight = H`.
For larger supporting groups, subtract each row's internal gaps before applying its summed ratios.
The gap terms matter: replacing a stack with its gap-free combined ratio does not align edges exactly.

Keep the authored order as the canonical sequence.
For `[portrait, landscape, landscape]`, a portrait on the left is straightforward.
For `[landscape, portrait, landscape]`, a portrait on the right can retain a top-left, top-right, bottom-left sequence.
An initial implementation can restrict collages to a leading portrait for a simpler encounter order.
Do not move a convenient portrait from elsewhere in the gallery to improve packing.
Avoid dense placement that backfills earlier gaps.
CSS placement changes neither speech order nor normal keyboard traversal.
See [Grid reordering and accessibility](https://www.w3.org/TR/css-grid-2/#order-accessibility).

For longer galleries, choose consecutive row groups with a small partition search.
Score sensible tile widths, row heights, and final-row balance.
One to three images per wide row and one to two per narrow row are reasonable initial bounds.
Give extreme panoramas a separate row when the adjacent images would become too small.
Prefer fewer special cases over a general collage optimizer.
The nine-photo collapsed group and expanded group can be planned separately.

## Responsive layout and stability

Use a deterministic layout plan derived from dimensions and a small number of width classes.
Let CSS determine the actual widths within each class.
Retain one photo element per manifest entry.
Avoid switching topology after mount based on `window.innerWidth` or decoded image dimensions.
One flat figure list can carry CSS geometry for both width classes.
Explicit row positions and computed widths allow different plans without duplicate viewer links or resize-driven React state.

Start with the repository's `640px` breakpoint, then verify real tile sizes.
Allow two-photo rows on phones when both tiles remain readable.
Flatten larger collages into ordered rows or individual images when a supporting tile becomes too narrow.
A rigid two-row requirement on every phone would conflict with readable photos.
This breakpoint policy is a proposed starting point, not a measured result.

Apply the article width to lone portraits through normal content flow.
Do not apply the `72rem` breakout to those figures.
Landscape singletons can retain the media width, and explicit panoramas can retain their separate placement.
Avoid a viewport-only width cap: it would exceed the body width on phones because the body has larger side padding.

Keep intrinsic `width` and `height` attributes and reserve each frame's ratio before loading.
A ratio affects automatic sizing; setting both dimensions independently can defeat it.
See [CSS preferred aspect ratios](https://www.w3.org/TR/css-sizing-4/#aspect-ratio).
The existing failure placeholder must occupy the same planned frame as the successful image.

Known dimensions prevent image-load shifts, but they do not guarantee a shift-free measured gallery.
React Photo Album documents that its default SSR output is empty.
An assumed container width can still change layout after hydration.
Its zero-CLS option prerenders multiple layouts and selects with container queries, increasing markup and hydration work.
This supports CSS-selected deterministic plans here.
See [React Photo Album's SSR guidance](https://react-photo-album.com/documentation#server-side-rendering-ssr).

This repository currently mounts the app through [client React rendering](../../src/main.tsx).
Trip blocks also load lazily through [Suspense](../../src/blog/TripMdxBlocks.tsx).
Gallery geometry alone cannot guarantee zero CLS for the entire page.

## Captions and responsive sources

The current captions overlay images for fine pointers and occupy document flow on touch devices.
Caption height is not part of the image's aspect ratio.
A spanning collage must not stretch photos to absorb differing caption lengths.
Use ordered rows when in-flow captions prevent a clean collage.
Check touch tablets as well as narrow phones.
Match the collage condition to the existing overlay condition: `(hover: hover) and (pointer: fine)`.

Replace fixed `376px` and equal-column `sizes` hints with the actual proportional image slots.
The formula is `slot = (galleryWidth - rowGaps) × ratioShare` for ordinary rows.
Collage hints must also account for their column share.
Use the `45rem` body limit for lone portraits.

Lazy images can use `sizes="auto, ...fallback sizes..."`.
The browser then uses the rendered width when supported and permitted.
Retain explicit fallback hints for older engines and eager images.
Percentages are not valid source-size values; CSS container context does not transfer directly into `sizes`.
Keep explicit dimensions when using `auto`.
See [HTML image source-size rules](https://html.spec.whatwg.org/multipage/images.html#sizes-attributes).

Keep the existing derivatives initially.
Inspect `currentSrc` on fresh loads at different device pixel ratios after the layout changes.
Source selection remains the browser's decision, so assert suitable resolution bounds rather than one exact filename.
Larger layout slots may reveal existing resolution limits; CSS cannot restore missing detail.

## Acceptance conditions

- A mixed pair fills the gallery width, shares one image height, and preserves both intrinsic ratios.
- Equal-ratio pairs retain equal widths.
- Three-, four-, five-, and six-photo examples produce filled rows or a suitable two-row collage.
- Unusual ratios fall back cleanly without distortion, hidden photos, or automatic reordering.
- A lone portrait matches the text column at phone and desktop widths.
- Image frames retain their dimensions before loading and after a failed request.
- Captions remain readable and correctly associated on keyboard, pointer, and touch interfaces.
- Viewer sequence, hidden links, expansion reset, and focus return retain their existing behavior.
- Classic scrollbars produce no horizontal page overflow.
- Responsive image hints track actual tile widths at mobile, desktop, and high pixel densities.

Use the real mixed galleries above and synthetic equal-ratio, extreme-ratio, failed-image, and long-caption fixtures.
Geometry tests should allow subpixel rounding and should inspect image frames separately from captions.

## Implementation and verification

The [subsequent quality review](2026-10-29-adaptive-gallery-quality-review.md) corrects image cropping missed by the initial frame measurements.
Use that review for the final image-content checks and coverage comparison.

The implementation uses a small geometry module without additional dependencies.
It evaluates consecutive rows of up to three photos on desktop and two on touch or narrow screens.
Desktop candidates can place a leading portrait beside two landscape rows.
The score considers image heights, narrow tiles, and the total number of rows.
It keeps the authored order and isolates panoramas at ratios of at least `2.5:1`.

Both layout plans share the same figures and viewer links.
CSS selects the plan without measuring images or replacing elements during resizing.
Exact gutter terms determine each frame's width and position.
Lazy images use automatic sizes with explicit proportional fallbacks.
Single-portrait galleries omit the breakout and inherit the actual article width.
Standalone photo placements retain their author-selected behavior.

The first real-photo check exposed an overly tall arrangement for six photos.
The revised score selects a two-row composition for the Boise warehouse group.
At a `1440px` viewport, that gallery measures `1152 × 464.2px`.
Its portrait spans both rows; two landscapes sit above three landscapes.
All six real images loaded successfully during the visual check.

| Check | Result |
| --- | --- |
| Focused geometry, story, viewer, and recovery unit tests | 57 passed across four files |
| New gallery browser cases | Seven passed in Chromium and seven in desktop WebKit |
| Production trip gallery, caption, viewer, and budget checks | 24 passed across desktop Chromium, phone Chromium, and iPhone WebKit |
| Viewport geometry | Checked from `320px` through `1440px` |
| Touch captions | Checked at phone and tablet widths |
| TypeScript, focused ESLint, and whitespace checks | Passed |
| Production application build with fixed trip content | Passed |

These checks cover proportional pairs, two-row patterns, single portraits, panorama rows, expansion, failure frames, and focus during resizing.
They also retain the existing viewer captions, reduced-motion behavior, and responsive image selection.
The work did not import Google documents or deploy the site.
The checks do not establish zero CLS for the complete client-rendered article.
