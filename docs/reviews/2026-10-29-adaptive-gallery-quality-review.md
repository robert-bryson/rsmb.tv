# Adaptive gallery quality review: 2026-10-29

## Scope

The baseline is `d8b938f2179c3cd420a827860841ab7f439f5707` (`HEAD` when the review started).
The review covers the pending adaptive galleries, their tests, and adjacent photo, viewer, and article behavior.
It also checks the existing contents-panel change and Kalaloch manifest additions.
The [gallery research report](2026-10-29-adaptive-trip-galleries-research.md#acceptance-conditions) supplies the acceptance conditions.
The repository guide and documentation index supply the local standards.
No applicable `AGENTS.md` or `CLAUDE.md` was found.

This is a review of the pending changes and their integration points.
It is not a complete security audit of every project or infrastructure resource.

## Standards

The implementation has a useful separation between geometry, rendering, and viewer state.
The geometry search considers a bounded set of consecutive groups.
Its work grows linearly with photo count. It does not need image decoding or DOM measurements.
Both layouts use one ordered set of figures and viewer links.
An additional layout dependency or general pattern framework would add unnecessary maintenance here.

Two test-quality findings required correction:

1. **P3: Source selection depended on one filename.** The production test required `-960.svg` after the layout change.
   This could reject a suitable source and did not test the fallback sizing rules.
   A shared assertion now checks rendered width, device pixel ratio, and available source widths.
   Fresh-context cases cover automatic and explicit fallback sizes at phone, tablet, and desktop widths.
2. **P3: Color checks depended on Chromium's decimal precision.** Two article tests failed in desktop WebKit.
   Chromium returned hue `293.541`; WebKit returned `293.540985` for the same design token.
   The tests now resolve the expected token through each browser's computed styles.
   Keyboard checks also use Safari's link traversal shortcut on macOS.

Alt descriptions remain separate from captions. Viewer caption insertion retains literal text escaping.
Gallery expansion retains hidden links and authored photo order.
The dependency audit reported zero known vulnerabilities in the installed lockfile graph.
That result does not establish that application code has no security defects.

## Spec

Two rendering defects contradicted the full-photo acceptance conditions:

1. **P2: Hover and keyboard focus cropped photos.** The retained rule applied `scale: 1.025` inside an overflow-hidden frame.
   The outer frame still passed every ratio check while the enlarged photograph lost its edges.
   The fix removes the zoom. Captions, focus outlines, and frame feedback remain available.
2. **P2: Frame borders changed the image ratio.** The new aspect ratio applied to the frame's border box.
   A one-pixel border reduced the inner width and height by two pixels.
   For a non-square photo, `(W - 2) / (W / ratio - 2)` differs from the intrinsic ratio.
   `object-fit: cover` then cropped the discrepancy.
   The fix paints the frame edge with an external shadow and uses `object-fit: contain`.

The regression tests failed before the CSS fix.
One measured a `0.65625px` height discrepancy in image content.
The hover test measured an image extending more than four pixels beyond its frame.
Both tests pass after the correction.

The original source-selection verification was also partial.
The added cases now cover explicit fallback sizes and high-density displays.
Single-portrait tests verify article width. Touch cases verify long captions without overlapping later rows.
Classic-scrollbar checks verify the actual gallery width and horizontal page bounds.

## Documentation changes

The authoring guide now states the contents-panel default and the complete-photo behavior during interaction.
The testing guide explains image-content checks, source-resolution checks, WebKit, and local fixture execution without flight downloads.
The research report links to these later corrections instead of presenting its initial checks as final evidence.
The Kalaloch checklist now refers to each photo instead of an obsolete count.
New procedures use short sentences, active voice, and consistent terms.

## Validation

The coverage comparison uses the same measured source, compiler, and V8 provider.
Production changes after the baseline measurement affect CSS only.
Both measurements include the complete Vitest suite and its existing loaded-source scope.
Browser tests do not contribute to these coverage percentages.

| Metric | Before | After |
| --- | --- | --- |
| Statements | 80.61% (6,761 / 8,387) | 80.70% (6,769 / 8,387) |
| Branches | 74.95% (4,752 / 6,340) | 75.03% (4,757 / 6,340) |
| Functions | 78.84% (1,580 / 2,004) | 79.14% (1,586 / 2,004) |
| Lines | 82.74% (5,889 / 7,117) | 82.80% (5,893 / 7,117) |

The increase is small across the repository. The additional tests target uncovered behavior rather than duplicate implementation details.
They cover lone-portrait sizing, missing gallery photos, hero selection, viewer opening, and selection reset after manifest replacement.

Gallery layout branch coverage increased from 97.36% to 100%.
Gallery component branch coverage increased from 86.36% to 95.45%.
Hero component branch coverage increased from 60% to 80%.

| Check | Result |
| --- | --- |
| Full Vitest suite with V8 coverage | 1,619 tests passed across 111 files |
| Temperature pipeline Python suite | 17 tests passed |
| Gallery and article browser fixtures | 34 passed across desktop Chromium and desktop WebKit |
| Production trip media, contents, and JavaScript budgets | 57 passed across desktop Chromium, phone Chromium, and iPhone WebKit |
| Production application build with fixed content | Passed |
| All three source trip manifests and bundled media | Passed |
| ESLint and TypeScript | Passed |
| Dependency audit | Zero known vulnerabilities |
| Updated local documentation links and whitespace | Passed |

The production media checks include the corrected hover expectation.
The earlier test required the zoom that caused cropping. It now requires the complete image to remain visible.
No test was skipped to obtain these results.

## Limits

The checks use fixed content and synthetic image responses.
They do not verify that every public Kalaloch asset exists or that each source description is accurate.
The publication checks remain in [TODO.md](../../TODO.md#kalaloch-trip).
The full Google-backed publication build and deployment are outside this review.
The fixed-content production build checks application compilation without importing Google documents.

The initial standard browser wrapper failed while fetching flight boundaries.
Fixture checks used a separate local Vite server to remove that unrelated network dependency.
The host used Node.js `26.12.0` and preinstalled npm `11.20.0`.
The project declares npm 12.2.1. This review did not change dependencies or the lockfile.

The gallery change does not establish zero layout shift for the full client-rendered article.
