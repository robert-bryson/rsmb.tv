# Site metadata

The build writes page metadata into HTML before JavaScript runs.
React uses the same definitions during navigation. Page bodies require JavaScript.
JSON-LD is structured data for search engines.
A canonical URL identifies the preferred public address for a page.

## Sources

| Source | Purpose |
| --- | --- |
| `src/content/sitePages.json` | Public page titles, descriptions, fallback social cards, and platforms |
| `src/content/siteAliases.json` | Legacy paths and their canonical pages |
| `src/content/projects.ts` | Project descriptions, screenshots, repositories, and feature dates |
| `src/utils/pageMetadata.ts` | Shared page and article metadata |
| `src/utils/siteMetadata.ts` | Site identity, absolute URLs, and path normalization |
| `src/hooks/usePageMetadata.ts` | Apply page metadata in React |
| `scripts/pageMetadataHtml.ts` | Escape and insert metadata into HTML |
| `scripts/trip-content-plugin.ts` | Generate page and article HTML during the Vite build |
| `scripts/generate-og-images.js` | Generate 1200 × 630 PNG social cards and SVG sources |
| `scripts/generate-sitemap.js` | List public routes and published articles |

Post metadata comes from the [blog import](blog-publishing.md).
Trip manifests supply hero URLs, alt descriptions, and image dimensions.
Project pages and their application subroutes use the project's preview screenshot in Open Graph, Twitter, and JSON-LD metadata.
Screenshot dimensions come from `src/content/project-previews.json`.
Regular posts use the first image retained in the imported article body.
The importer removes unsupported elements and rejects unsafe image URLs before image selection.
Images inside code examples cannot supply an article preview.
Fragment references, such as `#heading`, cannot supply an image.
Relative image paths resolve against the canonical article URL.
The blog sync stores the image URL, alt description, and available dimensions in the post registry.
Dimensions must be positive whole numbers. Missing or invalid dimensions remain absent.
Trip heroes take priority over post images.
Pages and posts without usable images retain generated social cards.
The RSS build timestamp includes trip manifest changes.

## Schemas

| Page | JSON-LD type |
| --- | --- |
| Home | `WebSite` |
| About | `ProfilePage` with a `Person` |
| Projects | `CollectionPage` with a list of applications |
| Posts | `CollectionPage` with published articles |
| Project description | `SoftwareApplication` |
| Map or application subroute | `WebPage` with its application as `mainEntity` |
| Article | `BlogPosting` |

Each public page except Home also includes a `BreadcrumbList`.
Project metadata includes screenshots, known feature dates, technology keywords, and source repositories when available.
Do not invent prices, ratings, or reviews to satisfy search result requirements.

## Routes and indexing

The build emits `index.html` for Home and `<path>.html` for each public page and legacy path.
Each article has HTML files under both `/blog/` and `/trips/`.
Both files identify the article's current collection as canonical.

React normalizes `.html` paths and trailing slashes before it matches routes.
It maps `/index.html` to `/`.
These redirects retain query parameters, heading fragments, and navigation state. They replace the current history entry.
Legacy post indexes also retain these values when redirecting to `/posts`.
Tracking parameters and fragments remain outside canonical URLs.

Amplify must rewrite clean paths and trailing-slash paths to their generated HTML files.
The page and article rules must precede the single-page application fallback.
Article HTML-file redirects must precede generic article rewrites. Otherwise a filename can acquire a second `.html` suffix.
The local preview performs equivalent file selection.
Apply `infra/main.tf` with the HTML deployment. Otherwise direct requests can receive Home metadata.

Development HTML uses `noindex, nofollow`.
React retains these restrictions when a draft or missing page adds its own `noindex` rule.
RSS and sitemap files include published articles only.
React marks missing pages and posts `noindex, follow` in production.
Unknown paths can receive the fallback document before React identifies the missing page.

## Add or change a public page

1. Add the route to `src/App.tsx`.
2. Add its metadata to `src/content/sitePages.json`.
3. Apply that metadata with `usePageMetadata`.
4. Add the route and its source files to `STATIC_ROUTES` in `scripts/generate-sitemap.js`.
5. Add its social card to `DEFAULT_PAGES` in `scripts/generate-og-images.js`.
6. Add legacy paths to `src/content/siteAliases.json`, when needed.
7. Regenerate the metadata files. Run the checks below.

```bash
npm run build-blog-artifacts
npm run typecheck
npx vitest run scripts/__tests__/pageMetadata.test.ts scripts/__tests__/tripContent.test.ts \
  scripts/__tests__/generateFeeds.test.ts scripts/__tests__/generateOgImages.test.ts \
  src/test/routing.test.tsx src/test/useDocumentHead.test.ts
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- tests/trips/metadata.spec.ts --workers=3
```

The browser command uses fixed content. It does not import Google documents.
It checks clean paths, trailing slashes, HTML files, collection aliases, and navigation cleanup.
Image checks cover project screenshots, trip heroes, relative article images, and React metadata after navigation.
Crawler checks disable JavaScript. Separate checks verify React navigation.
See [browser setup](trips/TESTING.md#browser-setup) before the first run.

For hosting changes, also run:

```bash
terraform -chdir=infra init -backend=false -input=false -lockfile=readonly
terraform -chdir=infra fmt -check -recursive
terraform -chdir=infra validate -no-color
terraform -chdir=infra test -no-color
```

These tests use a mocked AWS provider. They do not apply infrastructure.
The rewrite test requires every public route variant before the fallback and rejects duplicate rule sources.
