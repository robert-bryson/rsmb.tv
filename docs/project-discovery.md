# Project search and filters

Use `/projects` to search the project directory.
The directory reads local metadata. Search does not load a project application or its data.

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

## History and input

Input and results update immediately.
The URL replaces the current history entry 400ms after the last edit.
This delay combines rapid edits into one URL write.
Browsers limit the rate of history writes.
Enter and blur commit the pending query immediately.
Pass the hook's `commitQuery` function to the field's `onCommit` property.
A category link creates an entry and retains the search text.
**Clear search** removes only `q`. **Clear all filters** removes every list filter and creates an entry.
Both clear buttons return focus to the field.
Clearing all filters commits the previous draft first, so Back can restore it.
Other navigation, native Back, and unmount cancel delayed writes.
Back, Forward, and reload restore the selected entry.

The shared search hook keeps one draft of the complete parameter string.
Each mounted field receives an owner ID. A revision is the increasing number assigned to a local write.
Reconcile router state after commit, in a layout effect before paint.
React can replay an older router snapshot during an urgent input render.
That snapshot must not reset the draft or consume write records.
Each local write records its owner, revision, parameters, and navigation type.
Only an unconsumed, matching write can retain newer input during an older router commit.
Consume each pending revision separately. Earlier commits can arrive after a newer commit.
Remove a revision when it commits. Other navigation clears the pending list.
Copied navigation state cannot make another URL look like a new input write.
The same rule applies when clearing filters creates a history entry.
New text must not restore a category that the user just cleared.

Writes copy unrelated object navigation state. They remove the temporary `restoreScroll` flag.
The internal write record remains in history so that delayed clear actions can be identified.
It is not a public URL parameter or an analytics property.

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
| [`ContentSearch.tsx`](../src/components/ContentSearch.tsx) | Labels, hints, input, clearing, and keyboard focus |
| [`Projects.tsx`](../src/pages/Projects.tsx) | Counts, cards, actions, and empty states |

Posts use the same field, hook, and text helpers.
Keep post-specific matching and filters in their existing modules.
See [post search](blog-publishing.md#maintain-search-behavior) and [image delivery](image-assets.md) before changing shared behavior.

## Validation

Run the focused unit checks:

```bash
npx vitest run src/test/Projects.test.tsx src/test/projectFilters.test.ts src/test/projects.test.ts src/test/useSearchQuery.test.tsx src/test/ContentSearch.test.tsx src/test/search.test.ts src/test/blogPages.test.tsx
```

Run project and post search against fixed production content:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:page-recovery -- --grep 'project |projects search|post search'
```

The standard recovery runner includes project discovery. CI runs it in Chromium and WebKit.
Chromium checks forced-color focus. WebKit skips only cases that require unsupported emulation.
The tests check typing, category counts, history, reload, clearing, action links, accessibility, and horizontal overflow.
Map-data checks require no request while searching and a real request after **Open map**.
This second assertion verifies that the request detector works.

The search hook tests delay router commits in a controlled queue.
They check copied state, replayed state, clear actions, and newer input during earlier commits.
Tests use a controlled clock to check combined writes, explicit commits, cancellation, and the exact delay.
Browser tests also repeat twenty uninterrupted searches at each width in both engines.
They check every character, focus, the final URL, and retained country filters.
Real phone keyboards and screen readers still require the checks in [TODO.md](../TODO.md).
