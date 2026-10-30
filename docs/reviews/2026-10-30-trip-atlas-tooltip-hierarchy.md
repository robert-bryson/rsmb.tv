# Trip atlas tooltip hierarchy: 2026-10-30

## Recommendation

Keep the trip-report title first and its start month/year directly below it.
Left-align both lines to the same inset inside the route-color border.
Keep the date smaller and muted, with a small gap separating it from the title.
Let long titles wrap above the date.

This is a recommendation for this atlas: hovering primarily identifies a route and report; the date supplies supporting context.
It is an inference from that task and the guidance below, not a universal rule that dates must follow titles.
The current presentation is sound.

## Primary-source evidence

- Google's official Material Compose documentation supports rich tooltips with an optional title and informational text. Its example separates those roles; the official implementation places the title before supporting text in a vertical column. This establishes a relevant title-first pattern, without prescribing where a trip date belongs. [Android Developers: rich tooltip](https://developer.android.com/develop/ui/compose/components/tooltip#display-a-rich-tooltip), [AndroidX implementation](https://android.googlesource.com/platform/frameworks/support/+/e42756c681033003da3719e052ee9f5adce8c643/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/Tooltip.kt)
- IBM recommends flush-left typography for readability and organization, and aligning copy with other copy even inside containers. It also demonstrates distinguishing titles and subtitles through weight, contrast, or scale. These support a shared left edge and a quieter date. [IBM Design Language: Type basics](https://www.ibm.com/design/language/typography/type-basics/)
- NHS guidance recommends left alignment for English, explaining that a consistent edge helps people using magnification find the next line or item. Its heading guidance also allows captions above or below headings when describing a larger section or group. Supporting context can therefore legitimately precede a title in another task. [NHS typography: text alignment](https://service-manual.nhs.uk/design-system/styles/typography#text-alignment), [headings with captions](https://service-manual.nhs.uk/design-system/styles/typography#headings-with-captions)
- Fluent describes tooltip content as supplemental and contextual, and recommends limiting it to essentials. It does not specify date placement. [Fluent 2: Tooltip](https://fluent2.microsoft.design/components/web/react/core/tooltip/usage)

These are design-system guidance and implementation precedents.
They are not comparative user research proving one month/year arrangement performs best in this atlas.

## Placement tradeoffs for this popup

| Choice | Assessment |
| --- | --- |
| Date below, left aligned | Recommended. Preserves the report-first reading order and connects the date to a wrapping title through one shared edge. |
| Date above, left aligned | Plausible for a chronology-first timeline or when the year is the main grouping cue. Here it puts supporting context before the route's identifying text. |
| Date below, right aligned | Visually separates the date from the title's starting edge. A short date beneath a long wrapping title has no useful comparison column to justify that separation. |
| Date beside the title on the right | Reserves scarce horizontal space and makes long titles wrap sooner. More suitable for wider repeated rows with stable metadata columns. |

These tradeoffs are design judgments for the narrow, variable-title popup.
A short single-line date is not inherently unreadable when right aligned; the shared left edge offers the clearer relationship here.

## Implementation

The [shared tooltip](../../src/features/trips/tripMapTooltip.ts) already appends title then subtitle.
The [atlas](../../src/features/trips/atlas/TripAtlasMap.tsx) supplies the trip start month/year.
Before this adjustment, the [styles](../../src/index.css) distinguished the approximately 14px title from its 12px muted date with a 2px gap.

Preserve that order and type hierarchy for short and wrapped titles.
Make the intended alignment explicit with `text-align: start` on the safe DOM content wrapper; this gives the English interface a shared left edge while following writing direction.
Use a 4px title/date gap from the repository's spacing scale.
That spacing is a project choice, not a source-mandated measurement.
No date reordering, right-hand column, or additional content is warranted by this research.
Visual checks verified a single-line title and a constrained two-line title, including a centered parent context.
Both dates remained below their titles, with a shared text starting edge and a 4px gap between blocks.
Validation passed 80 focused unit tests, TypeScript, changed-file ESLint, and ten browser checks across desktop Chromium, phone Chromium, and iPhone WebKit.
Two hover-only phone cases were skipped.
