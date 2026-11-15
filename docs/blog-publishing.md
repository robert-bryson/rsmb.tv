# Blog publication

Google Sheets and Google Docs contain the source content.
The build imports published Sheet rows and converts their documents to MDX.
MDX is Markdown with React components.
The build then generates RSS, JSON Feed, sitemap, and Open Graph files.
Git ignores the imported registry, MDX, feeds, sitemap, and article cards.

## Configure the Sheet

Use one row per post in the `Blog Posts` tab.

| Column | Required | Value |
| --- | --- | --- |
| `slug` | No | URL identifier. The importer derives it from the title if empty. |
| `title` | Yes | Public title |
| `date` | Yes | `YYYY-MM-DD` or `M/D/YYYY` |
| `description` | Yes | Short preview text |
| `tags` | Yes | Comma-separated or pipe-separated tags. The value can be empty. |
| `google_doc_id` | Yes | Document ID or Google Docs URL |
| `published` | Yes | `true`, `yes`, `y`, `1`, or `published` to publish |
| `format` | No | `trip` for trip reports. Leave empty for writing. |
| `trip_id` | For trips | Manifest ID in `src/content/trips/` |
| `drive_folder_url` | No | Google Drive folder URL for the development panel |
| `series_id` | No | Series ID with lowercase letters, numbers, and hyphens |
| `series_title` | With series ID | Public series title |
| `series_order` | With series ID | Positive integer for this post |

Make the Sheet and documents accessible through their public export URLs.
The importer does not authenticate to private Google documents.

Set `GOOGLE_BLOG_SHEET_ID` in `.env.local` for local work.
Set it separately in AWS Amplify for production builds.
GitHub Actions variables do not configure Amplify.

| Variable | Function |
| --- | --- |
| `GOOGLE_BLOG_SHEET_NAME` | Select the Sheet tab. Default: `Blog Posts`. |
| `GOOGLE_BLOG_REPLACE_ALL` | Replace the generated registry. Keep the default value, `true`. |

## Import content

```bash
GOOGLE_BLOG_SHEET_ID=your-sheet-id npm run build-blog
```

`npm run dev` imports the latest published posts and drafts on every startup when the Sheet is configured.
`npm run sync-blogs:dev` refreshes both while the local server is running; Vite reloads the content automatically.
Development imports always include drafts, even if a local environment file still sets `GOOGLE_BLOG_SYNC_ON_DEV=false`.
Incomplete drafts do not stop other development content.
The development panel shows the publication state, source links, and known errors.
Without Sheet configuration, development uses existing generated files.
Hosted development builds also include these previews. Their HTML pages use `noindex, nofollow`.
RSS, JSON Feed, and sitemap files exclude unpublished rows in every build mode.
These files use production URLs. A preview must not advertise an unpublished production article.

The programmatic `previewSlug` option also marks its requested draft with `development.published: false`.
It retains the draft's local MDX for review. Public discovery files and production page registries omit that draft.
Both preview modes retain source links, document readiness, validated manifest status, and local trip asset counts.
The normal production CLI does not request a single-draft preview.

Production includes only published rows.
Post slugs must be unique. Trip posts must contain a manifest ID.
Slugs and manifest IDs must use lowercase letters, numbers, and hyphens.
The build stops if a published post has no MDX file.

For trip assets and manifest checks, use the [trip authoring guide](trips/TRIP-AUTHORING-README.md).
`build-blog` does not prepare or upload trip assets.

## Write the document

Use Heading 2 and Heading 3 for sections.
Use Subtitle for supporting text directly below a heading.
Subtitles have no heading ID or table-of-contents entry.
Use Normal text for paragraphs.

The importer retains lists, links, images, code blocks, emphasis, highlights, and tables.
It also retains first-line paragraph indents and leading tabs.
Use the Google Docs first-line indent setting for consistent paragraph formatting.
Wrapped lines stay aligned with the text column.
Conflicting exported class rules follow stylesheet order.
It removes active HTML and restricts URL protocols.
It treats braces, angle brackets, and module statements in ordinary text as literal content.
Code blocks retain their original characters.

Trip shortcodes expand only in separate Normal text paragraphs.
Shortcodes in sentences, headings, lists, blockquotes, tables, and code examples remain literal text.
Use the [trip shortcode table](trips/TRIP-AUTHORING-README.md#shortcodes) for supported forms.

Use short, unique headings.
Trip tables of contents show only the main chapters.
Level-one body headings define chapters when present. Otherwise, level-two headings define chapters.
Subheadings retain their direct section links.
The site derives heading IDs from the heading text.
For example, `Day 1: Seattle to Boise` becomes `#day-1-seattle-to-boise`.
Repeated headings receive numeric suffixes.
The contents list marks the first visible heading in the reading area.
Partial visibility updates retain other headings that remain in that area.
If no heading is visible, the list retains the last current location.
Each heading links to itself and back to the table of contents.
Click heading text to open its section link.
If a heading contains an authored link, that link keeps its destination. Use the adjacent `#` for the section link.

After an importer change, regenerate local documents:

```bash
npm run sync-blogs:dev
```

Do not edit generated MDX as the content source.

## Check article navigation

The post list supports `q`, `type`, `tag`, `country`, and `region` query parameters.
The `q` value contains the search text.
Search reads titles, summaries, tags, country names and codes, region names, and series titles.
Each search word must occur in this metadata. A word can match part of another word.
Case, accents, and punctuation do not change the match.
An empty search, or punctuation alone, adds no keyword restriction.
Search does not load article bodies or trip manifests.
For example, `/posts?type=trips&q=british+columbia` searches trip metadata for both words.
Use country and region filters when you need an exact geographic selection.

Use **Search site** in the top navigation for full-text searches across posts, projects, and other pages.
It searches article bodies and photo captions as well as titles and summaries.
See the [site search guide](site-search.md) for index generation and keyboard behavior.

The post list retains type, tag, and geographic filters. Existing `q` links remain supported and display their query beside the count.
Filter and article links retain the query. Type links clear tag and geographic selections.
**Clear all filters** resets every list filter and focuses the Posts heading.
Back, Forward, reload, and the article return link retain the selected filter URL.

For example, `/posts?type=writing&tag=Maps` selects writing with the exact `Maps` tag.
Topical tags keep their original case. Motorcycle facts add normalized tags, such as `honda-cb500x`.
The registry separates countries and regions from topical tags.
It recognizes US state and Canadian province names in Sheet tags, including posts without manifests.
Trip manifests supply country groups for other regions.
For example, `/posts?country=CA&region=british-columbia` selects posts about British Columbia.
Combine a `tag` with geographic filters to narrow the results.
The Regions filter groups places by country and shows matching post counts for the selected post type.
Each country initially shows as many regions as fit on its row, starting with the most-used regions.
Select **See all** to expand the remaining regions.
Existing geographic tag links, such as `/posts?tag=us`, remain supported.
An exact topical tag takes priority over a geographic alias.
For example, a `Japan` topic remains selectable when another post has JP geography.
For ambiguous geographic aliases, country codes take priority, followed by region names, then country names.
This order does not depend on publication dates.
Use `country` and `region` for new geographic links.
Country codes accept lowercase input. Region names accept spaces and mixed case.
Generated links use uppercase country codes and lowercase region names with hyphens.

Previous and next links select adjacent articles within the same collection.
Previous selects the older article. Next selects the newer article.
The links retain the original list filter.
The return link requests restoration of the list scroll position.
Collection redirects retain query parameters, heading fragments, and navigation state.

### Maintain search behavior

The header search uses a separate text index. See [site search](site-search.md) for sources, controls, and extraction rules.
Search and article generation share publication rules in `scripts/post-registry.ts`.
Keep build metadata types in `src/content/postMetadata.ts`.
Build tools must not import the browser's virtual article loaders to obtain these types.

The page list still uses `postSearch.ts`, `postFilters.ts`, and `useSearchQuery.ts` for legacy query links and filter navigation.
Use `URLSearchParams` to encode query values. Keep collection filters separate from the shared header field.
Filter analytics send only the feature name and a result-count bucket; they do not send search text.
See the [analytics contract](umami-analytics.md#event-contract).

Run the focused unit checks:

```bash
npx vitest run src/test/siteSearch.test.ts src/test/SiteSearch.test.tsx scripts/__tests__/siteSearch.test.ts src/test/postSearch.test.ts src/test/postFilters.test.ts src/test/blogPages.test.tsx src/test/mdxComponents.test.tsx
```

Run browser checks against fixed production content:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:page-recovery -- --grep 'site search|post filters|reading page /posts'
```

The browser cases check full-body matches, project and page results, lazy index loading, keyboard controls, clearing, and draft exclusion.
Filter cases retain coverage for history, reload, and article return links. Searching does not load article body modules; opening a result can load its destination.
Chromium checks the focus outline in forced-color mode.
Both engines scan search results for accessibility errors.
Use the [browser setup](../README.md#testing-notes) before these checks.

## Start a content deployment

A Google Doc edit does not deploy the site.
A new Amplify build must import the change.

1. Open **Hosting > Build settings** in the Amplify application.
2. Create an incoming webhook for the production branch.
3. Store the webhook URL in a private location.
4. Call the webhook after content review.

Anyone with the webhook URL can start a build.
The webhook starts the build. Amplify environment variables control the import.

The build writes article metadata into HTML files for both collection paths.
The metadata includes the title, description, canonical URL, social image, publication date, `BlogPosting`, and breadcrumbs.
Ordinary posts use the first retained article image with a usable URL.
The importer rejects unsafe URLs and fragment references before image selection.
Relative image paths resolve against the canonical article URL.
Trip reports use the manifest hero with its alt description and dimensions.
Posts without a usable image use generated PNG social cards.
See [site metadata](site-metadata.md) for image sources and validation commands.
Apply the page and article rewrite rules in `infra/main.tf` before production release.
The browser still renders the article body.
