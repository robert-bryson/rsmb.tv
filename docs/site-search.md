# Site search

Use **Search site** in the top navigation to search reading pages, projects, maps, and articles.
The field is independent of the filters on Posts and Projects.

## Matching and controls

Every search word must match. Words can occur in different fields or within longer words.
Search ignores case, accents, repeated words, and punctuation.
Title matches rank ahead of matches in descriptions, technologies, and body text.
Each result has a title, content type, and short excerpt.
Matching words are highlighted. Empty queries do not display results.

Use Up and Down to move between results.
Enter opens the first result from the field. Enter on a focused result opens that result.
Escape closes the list and returns focus to the field.
Clear empties the field and retains focus.
Opening a result clears the search.
In the current tab, it also moves to the first visible matching passage and focuses that passage.
The match stays clear of the site navigation and sticky trip heading.
Supported browsers highlight the matched text without changing the article markup.
An exact phrase takes priority. Otherwise, the jump prefers a passage with all search words, then the first matching word.
When only metadata matches, the page opens at its normal starting position.
Search does not open hidden controls or photo viewers to reveal a match.
Back and Forward restore the reader's position instead of repeating the jump.
Editing collection or atlas filters removes the old landing request and retains the caller's navigation context.
Composed text input retains its own arrow and Enter keys until composition ends.
Modified arrow keys retain their browser or operating system behavior.

The text index loads when the field receives focus.
Concurrent requests share one promise. A failed request can be retried with **Try again**.
Focusing or hovering a result does not prepare its article, map application, or data.
Selecting the result loads its destination.
Opening a result stores the query in that tab's browser navigation state.
It is not added to the URL or analytics events.
Copied result URLs and results opened in a new tab open at the normal page position.
The jump waits for lazy article text and briefly corrects delayed layout changes.
Scrolling, touching, clicking, or pressing a key stops that correction immediately.
Article loading placeholders use `data-search-pending` so temporary titles cannot trigger an early match.

## Index sources

Vite generates a separate JavaScript module with plain text records.
It reads these sources without executing articles:

- Page metadata in `src/content/sitePages.json`.
- Registered page files and their imported React components.
- Project descriptions, summaries, technologies, and change notes.
- Public article slugs, dates, and imported MDX bodies, including code examples, image descriptions, and captions.
- Trip places, photo captions, and motorcycle names from manifests.

Run `npm run sync-blogs:dev` to refresh imported content while developing.
Changes to watched article, manifest, metadata, and component files reload the index.

The parser reads literal text and known text properties.
It accepts static string expressions, template strings, and literal string arrays.
It does not evaluate expressions or render pages to extract dynamic runtime data.
Keep descriptive text in these sources when adding a page.
Add an extraction test when introducing another content form.

Import paths, link destinations, asset URLs, styles, and arbitrary configuration properties are excluded.
Source links in the development panel are also excluded.
An authored URL remains searchable when it is visible article text or a code example.

## Publication rules

Search and page generation use the same post registry reader.
It checks unique slugs and safe post and trip identifiers.
Production rejects a missing registry or a trip without a manifest ID.
Production excludes unpublished metadata and bodies.
Local and hosted development previews include drafts with a **Draft** label.
Unavailable bodies are skipped in development.
Country entries can omit their region list.
The `trip-test` build uses fixed article fixtures.

Preview content is available to anyone who can access that preview.
Keep private notes out of publicly hosted preview sources.
See [blog publication](blog-publishing.md) for Sheet configuration and source ownership.

## Code ownership

| File | Responsibility |
| --- | --- |
| [`SiteSearch.tsx`](../src/components/Layout/SiteSearch.tsx) | Input, result list, composition, keyboard controls, and navigation |
| [`siteSearch.ts`](../src/content/siteSearch.ts) | Matching, ranking, and excerpts |
| [`siteSearchIndex.ts`](../src/navigation/siteSearchIndex.ts) | Lazy index loading through the shared module loader |
| [`siteSearchMatch.ts`](../src/navigation/siteSearchMatch.ts) | Navigation state, visible passage selection, and original text ranges |
| [`SearchMatch.tsx`](../src/components/SearchMatch.tsx) | Lazy destination text, passage focus, highlighting, scroll clearance, and cancellation |
| [`site-search-plugin.ts`](../scripts/site-search-plugin.ts) | Text extraction, build output, and development updates |
| [`post-registry.ts`](../scripts/post-registry.ts) | Shared publication filtering and reference checks |
| [`postMetadata.ts`](../src/content/postMetadata.ts) | Build and browser metadata types without virtual loaders |

Use [project filters](project-discovery.md) and [post filters](blog-publishing.md#check-article-navigation) for older `q` links.

## Validation

Run the focused unit checks:

```bash
npx vitest run src/test/siteSearch.test.ts src/test/SiteSearch.test.tsx src/test/siteSearchIndex.test.ts src/test/siteSearchMatch.test.ts src/test/SearchMatch.test.tsx src/test/ScrollToTop.test.tsx src/test/RouteOrientation.test.tsx scripts/__tests__/siteSearch.test.ts scripts/__tests__/tripContent.test.ts
```

Run the production browser checks:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:page-recovery -- --grep 'site search|site navigation|project search defers'
```

The browser cases check full-body matches, draft exclusion, index retries, navigation, focus, accessibility, and responsive spacing.
Landing cases check lazy trip text, article formatting, deep project text, repeated searches on one page, and history positions.
For a current-content check, search for **Avenue of the Giants** and open the PCH trip result.
Confirm that the linked phrase is highlighted below the sticky chapter heading and receives keyboard focus.
At 200% text size, the result panel must fit below the navigation and keep its final result reachable.
They verify that result browsing leaves map data unloaded and that selecting the map requests its data.
Chromium also checks focus in forced colors.
Use the [browser setup](../README.md#testing-notes) before running these checks.
Track physical keyboard and screen-reader checks in [TODO.md](../TODO.md).
