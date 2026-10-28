# Trip photo panorama research: 2026-10-27

This report records the initial design and its first verification results.
Use the [follow-up review](2026-10-27-trip-photo-review.md) for failure-state fixes and later test results.
Use the [authoring guide](../trips/TRIP-AUTHORING-README.md#panoramas) for current procedures.

## Scope and recommendation

Add an explicit panorama placement to the existing trip photo component.
A panorama should reach both page edges and retain the complete image.
The surrounding story should keep its current reading width.

Use the existing photo manifest, captions, responsive sources, loading behavior, and PhotoSwipe viewer.
Use a full-width CSS query container to calculate the panorama width.
Keep a contained fallback when the browser cannot support that layout.

The codebase analysis records the baseline before implementation.
Later sections record the implemented choices and their validation.

## Existing code and authoring path

| Area | Finding | Consequence |
| --- | --- | --- |
| [Page layout](../../src/components/Layout/Layout.tsx) | The centered `main` has `max-w-3xl` and horizontal padding. | `width: 100%` alone cannot reach the page edges. |
| [Trip CSS](../../src/index.css) | `.trip-breakout` stops at `72rem`; the hero stops at `88rem`. | The panorama needs a separate width rule. |
| [TripPhoto](../../src/features/trips/components/TripPhoto.tsx) | `TripPhotoFigure` supplies dimensions, responsive sources, captions, loading, and image failure handling. | Reuse this rendering path. |
| [Photo link](../../src/features/trips/components/TripPhotoLink.tsx) | The anchor supplies PhotoSwipe dimensions, sources, alt text, and captions. | Keep the existing viewer integration. |
| [Importer](../../scripts/sync-blogs.js) | Trip shortcodes become MDX with validated manifest references. | Add panorama syntax to this parser. |
| [MDX components](../../src/blog/MdxComponents.tsx) | `TripPhoto` is already available to imported stories. | A layout prop can support both shortcode and MDX authoring. |
| [Asset preparation](../../scripts/prepare-trip-assets.js) | Derivatives use `480`, `960`, and `1600` widths, with a hard `1600` cap. | Large displays can exceed the available image resolution. |

The [Boise manifest](../../src/content/trips/boise-2024.json) includes `boise-2024-05-12-strawberries-pano` at `1600 × 279` pixels.
Its aspect ratio is approximately `5.73:1`.
It can provide a realistic panorama fixture without a new asset.

Panorama placement belongs to the story element.
The same photo can appear in a gallery, a regular photo block, and a panorama.
A permanent panorama flag on the photo manifest would couple those uses.

## Layout options

| Approach | Benefit | Limitation | Assessment |
| --- | --- | --- | --- |
| `width: 100%` | Simple and stable. | Stops at the story column. | Suitable as a fallback. |
| Centered `100vw` | Escapes the story column with little CSS. | Automatic classic scrollbars can make it wider than the usable page. | Avoid for the primary width calculation. |
| Full-width container with `100cqw` | Uses the actual available container width. | Requires a suitable ancestor and container-unit support. | Best fit for this component change. |
| Full-width article grid | Makes narrow and wide tracks explicit. | Requires changes across the page, article, and imported content wrappers. | Better suited to a larger layout redesign. |
| JavaScript width measurement | Can use `documentElement.clientWidth`. | Adds resize handling and measurement before layout becomes correct. | Unnecessary for this layout. |

Viewport units normally assume that scrollbars do not exist.
The specification gives exceptions for unconditional root scrollbars and reserved gutters.
Changing `vw` to `dvw` does not remove that general scrollbar rule.
[CSS Values and Units Level 4](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths)

Container units measure an eligible ancestor; `cqw` represents one percent of its width.
The nearest eligible ancestor supplies that width.
Without one, the unit falls back to the small viewport dimension.
The cited specification is a Working Draft.
[CSS Containment Level 3](https://www.w3.org/TR/css-contain-3/#container-lengths)

Establish `container-type: inline-size` on a wrapper that already fills the usable page width.
Use the full-width `main` as that wrapper, with a centered content column inside it.
Do not establish this query container on the narrow story column.
Keep intermediate wrappers free from conflicting size containers.

Use `width: 100cqw` and `margin-inline: calc(50% - 50cqw)` on the panorama block.
This calculation assumes that the story column and the full-width wrapper share a horizontal center.
The current page layout meets that assumption.

Container sizing must come from layout context or explicit sizing.
Content-dependent sizing can collapse after size containment is applied.
Use `inline-size`, rather than two-axis `size`, to retain content-driven page height.
[MDN container-type](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/container-type)

Guard the enhanced width with a feature query.
Keep `width: 100%` outside that query as the fallback.
Do not hide document overflow to conceal incorrect width calculations.
[MDN @supports](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@supports)

## Preserve the whole panorama

Retain `width: 100%` and `height: auto` on the image.
Keep the manifest's intrinsic `width` and `height` attributes.
Those dimensions let the browser reserve space before the image loads.
[MDN img dimensions](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#height)

Avoid the hero's fixed aspect ratio and `object-fit: cover` rules.
`cover` clips the image when its ratio differs from the frame.
`fill` can distort an image when both frame dimensions are forced.
[MDN object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit#values)

A `5.73:1` image becomes about `68px` high at a `390px` page width.
That is expected when the complete image must remain visible.
The existing viewer supplies enlargement and touch zoom.
A taller cropped preview or horizontal scroller would require a separate product decision.

## Responsive delivery and resolution

The normal photo's `sizes` stops at `1152px`.
That value would understate a panorama's display width on larger screens.
Use `sizes="100vw"` for the panorama while retaining the existing width-based `srcSet`.
The small difference caused by a scrollbar is acceptable for resource selection.
It must not control the actual layout width.

`sizes` describes the intended image slot for source selection.
Its relative units follow media-query rules, rather than the image element's CSS context.
Do not copy `100cqw` from the layout into this attribute.
Browsers retain discretion over which candidate they fetch.
[MDN img sizes and srcset](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#sizes)

Retain lazy loading for photos below the initial viewport.
Retain the component's explicit priority option for an initially visible image.
Native loading behavior avoids another observer or image-loading library.
[web.dev browser image loading](https://web.dev/articles/browser-level-image-lazy-loading)

The current `1600px` maximum provides about `0.83` image pixels per CSS pixel at a `1920px` display width.
At device pixel ratio `2`, that density is about `0.42`.
CSS cannot recover the missing detail.

Larger derivatives must come from the selected original and appear in the manifest's `srcSet`.
Increasing only the candidate width list will not work while the hard cap remains `1600`.
Preserve ordinary photo fingerprints and avoid upscaling smaller originals.
Sharp supports `withoutEnlargement` for this purpose.
[Sharp resize options](https://sharp.pixelplumbing.com/api-resize/#resize)

Larger candidates are an asset-quality decision, separate from the layout feature.
Measure their bytes before increasing every trip photo's preparation cost.
Existing `1600px` photos remain valid and display correctly, with the resolution limit described above.

## Implemented choices

`{{trip-photo-pano:photo-id}}` expands to `<TripPhoto photoId="photo-id" layout="pano" />`.
The importer checks the photo ID against the manifest. Code examples remain literal.
The layout uses the full-width `main` query container and a centered inner content column.
Header and fixed page controls remain outside that container.
The panorama uses square edges, full-width source hints, and a focus outline inside the page edges.
It keeps the existing captions, lazy loading, image failure handling, and PhotoSwipe viewer.

Prepared sources with an oriented ratio of at least `2.5:1` receive candidates up to `3200px`, including `2400px`.
This ratio is a preparation policy, not a restriction on panorama placement.
The generator retains ordinary photo settings and fingerprints. It never enlarges smaller sources.
Existing manifests remain usable. Larger outputs require preparation, publication, and a manifest update.
The existing manifest updater and publisher already support these widths.

The browser fixture uses a synthetic `3200 × 560` panorama and covers `375`, `768`, `1440`, and `2560px` viewports.

## Accessibility and viewer behavior

Keep the existing `<figure>`, meaningful image alt text, and associated supplemental caption.
Retain the native anchor, visible keyboard focus, and image URL fallback.
Do not replace the photo with a CSS background.
Keep caption behavior available to both keyboard and touch users.

Reuse PhotoSwipe rather than creating another modal viewer.
PhotoSwipe enables Escape dismissal, focus trapping, and focus return by default.
The repository also remembers the trigger and restores its focus.
[PhotoSwipe options](https://photoswipe.com/options/#trapfocus)

A modal should receive focus when opened, contain keyboard navigation, close with Escape, and return focus when dismissed.
These requirements justify testing the viewer after the layout change.
[WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## Verification priorities

1. Test shortcode expansion and unknown photo references.
2. Confirm ordinary trip photos keep their existing width.
3. Check both panorama edges against `documentElement.clientWidth` on mobile, desktop, and wide desktop screens.
4. Check `scrollWidth` for unintended horizontal page scrolling.
5. Test a page with classic scrollbars, not only overlay scrollbars.
6. Confirm that the rendered image preserves its intrinsic aspect ratio.
7. Check responsive sources, image failures, captions, and priority loading.
8. Open the viewer with the keyboard, dismiss it with Escape, and check focus return.
9. Check the sticky header and fixed scroll-to-top control after adding the query container.
10. Confirm the authoring guide explains the syntax and current image resolution limit.

## Validation

`npm run typecheck` passed.
The seven focused Vitest files passed all `205` tests:

```bash
npx vitest run scripts/__tests__/syncBlogs.test.ts scripts/__tests__/googleDocsMdx.test.tsx scripts/__tests__/prepareTripAssets.test.ts scripts/__tests__/tripContent.test.ts src/test/tripStory.test.tsx src/test/Layout.test.tsx src/test/tripPhotoSwipe.test.tsx
```

The fixture Vite build passed. The reading browser run passed `50` cases initially.
WebKit retained its loaded image candidate after resizing, which failed the remaining source-selection assertion.
The corrected assertion checks a fresh wide-page load.
The panorama case then passed in desktop Chromium, mobile Chromium, and mobile WebKit:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- tests/trips/reading.spec.ts --workers=2
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- tests/trips/reading.spec.ts --grep panoramas --workers=2
```

Layout checks include a reserved scrollbar gutter, image proportions, both page edges, and horizontal overflow.
Viewer checks include keyboard opening, Escape dismissal, focus return, and an inset focus outline.
Asset tests cover orientation correction, the panorama ratio threshold, smaller originals, and the `3200px` output limit.
These checks used synthetic content. They did not publish assets or change the source Google Doc.
