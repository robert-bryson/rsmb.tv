# Project directory and filters

Use the `/projects` directory to browse categories and open project descriptions, maps, demos, or source code.
Use [site search](site-search.md) in the top navigation to search content across the site.
Existing keyword URLs continue to filter this directory.

## Filter URLs

| Parameter | Accepted values | Default |
| --- | --- | --- |
| `q` | Search text | Empty |
| `category` | `maps`, `apps`, `tools` | All projects |

For example, `/projects?category=maps&q=python` selects maps that contain the word `python`.
Unknown category values select all projects. Category values are case-sensitive.
Use `createProjectsUrl` to build links. Pass named options and let `URLSearchParams` encode the text.
Reserved characters cannot add another filter or a fragment.

Search checks names, slugs, descriptions, summaries, category labels, and technologies.
Every search word must match. Words can occur in different fields or within longer words.
Case, accents, and punctuation do not change a match. Non-Latin letters remain searchable.
Empty text and punctuation alone add no search restriction.
Results retain the order in the project registry.

Each category count includes the current search text. It ignores the selected category.
Each category link exposes its count as an accessible description.
The result count compares the visible projects with the complete directory.
An empty directory shows **No projects yet.**
An unsuccessful search shows **No projects match these filters.**

## Existing query links

Existing `/projects?q=...` links continue filtering project metadata.
The count displays the active query so that it does not silently hide projects.
Category links retain the query. Back, Forward, and reload restore the selected filters.
**Clear all filters** clears the query and category, creates a history entry, and focuses the page heading.
The header field always searches the whole site, independently of directory filters.

The shared `useSearchQuery` hook still handles filter URL state and preserves unrelated object navigation state.
Its delayed input API remains covered by its focused unit tests.

## Project actions

The main card opens the project description.
**Open map** opens an internal map through React Router.
**Live demo** and **Source** open external sites in separate tabs.
External links include `noopener noreferrer` and an accessible new-tab description.
Action links are siblings of the description link. Never place one link inside another link.

Keep demo URLs under `/projects/` or use HTTPS.
Keep source URLs on GitHub. Do not add URLs with credentials.
Registry tests parse these URLs and check their origins and schemes.
Project metadata is maintained in the repository. The directory does not accept user-supplied destinations.

Each action sends one `project-link-click` event with the project, destination, and placement.
Search text and selected categories do not enter that event.
See the [analytics contract](umami-analytics.md#event-contract).

## Code ownership

| File | Responsibility |
| --- | --- |
| [`projects.ts`](../src/content/projects.ts) | Project metadata and category labels |
| [`projectFilters.ts`](../src/content/projectFilters.ts) | Matching, category parsing, and encoded URLs |
| [`search.ts`](../src/utils/search.ts) | Shared text normalization and query replacement |
| [`useSearchQuery.ts`](../src/hooks/useSearchQuery.ts) | Draft parameters, write ownership, and history |
| [`Projects.tsx`](../src/pages/Projects.tsx) | Counts, cards, actions, and empty states |

Posts and Projects use the same header search and retain their own filter URL helpers.
Keep post-specific matching and filters in their existing modules.
See [post search](blog-publishing.md#maintain-search-behavior) and [image delivery](image-assets.md) before changing shared behavior.

## Validation

Run the focused unit checks:

```bash
npx vitest run src/test/Projects.test.tsx src/test/projectFilters.test.ts src/test/projects.test.ts src/test/useSearchQuery.test.tsx src/test/ContentSearch.test.tsx src/test/searchTransition.test.tsx
```

Run project and post search against fixed production content:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:page-recovery -- --grep 'project |projects search|site search|post filters'
```

The standard recovery runner includes project discovery. CI runs it in Chromium and WebKit.
Chromium checks forced-color focus. WebKit skips only cases that require unsupported emulation.
The tests check header search, category counts, history, reload, clearing, action links, accessibility, and horizontal overflow.
Map-data checks require no request while browsing search results and a real request after selecting the map.
This second assertion verifies that the request detector works.

The search hook tests delay router commits in a controlled queue.
They check copied state, replayed state, clear actions, and newer input during earlier commits.
Tests use a controlled clock to check combined writes, explicit commits, cancellation, and the exact delay.
Real phone keyboards and screen readers still require the checks in [TODO.md](../TODO.md).
