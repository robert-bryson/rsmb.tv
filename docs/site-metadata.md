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
| `public/site.webmanifest` | Browser identity, launch URLs, colors, and icon declarations |
| `scripts/generate-site-icons.js` | Derive PNG icons from existing vector artwork |
| `scripts/feedMetadata.js` | Shared public-feed identity, canonical URLs, and post selection |
| `scripts/generate-json-feed.js` | Generate JSON Feed 1.1 summaries at `/feed.json` |

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

After you apply routing changes, redeploy the affected Amplify branch to clear cached HTML.
Amplify can skip deployment when the build files have not changed.
The `postBuild` phase writes `dist/deployment.json` with the commit ID and job ID.
The new job ID changes the build files on each run so a redeploy clears the cache.
The marker contains no credentials. Local Vite builds do not create it.
After deployment, check the public URL without JavaScript and confirm its `og:title` and `og:image` values.

Development HTML uses `noindex, nofollow`.
React retains these restrictions when a draft or missing page adds its own `noindex` rule.
RSS, JSON Feed, and sitemap files include published articles only.
React marks missing pages and posts `noindex` in production and retains existing preview rules.
Unknown paths can receive the fallback document before React identifies the missing page.

## Browser identity and discovery

Every generated HTML page links to the manifest, RSS, JSON Feed, and the established GitHub profile.
The GitHub link uses `rel="me"` and matches the About page's `Person.sameAs` identity.
This relationship alone does not prove account verification by another service.

The manifest uses root-relative identity and launch URLs. It retains normal browser navigation with `display: "browser"`.
It adds no offline cache or service worker. The existing SVG and Apple touch icons remain available.
The icon build derives 48-, 192-, and 512-pixel PNGs from `public/apple-touch-icon.svg`.
Regenerate the PNGs when the artwork changes. Declared icon dimensions must match their files.

JSON Feed 1.1 supplies summary-length `content_text`, canonical item IDs, and publication dates.
RSS and JSON Feed share their site identity, post selection, and URL construction.
Neither feed publishes development-only fields. A title edit does not change an item's ID.
Changing an article's canonical collection changes its ID; review this as a subscription migration.
`npm run build-blog-artifacts` regenerates both feeds and the browser icons without importing source documents.

Production HTML permits `max-image-preview:large`. This allows larger search previews; it does not guarantee them.
Development builds retain one `noindex, nofollow` tag. React preserves preview limits when it adds or removes `noindex`.

Before release, apply the `.webmanifest` asset exception in `infra/main.tf`.
Otherwise the SPA fallback can return HTML for the manifest.
Deploy `customHttp.yml` with the assets so the manifest uses `application/manifest+json` and the feed uses `application/feed+json`.
Both resources have a one-hour shared-cache limit and require browser revalidation.
Redeploy after routing changes, then check the resource bodies and response headers on the public host.

The [standards research](reviews/2026-11-04-web-discovery-standards-research.md) explains the chosen additions and deferred protocols.
The support applies to pages built by this repository. Independently hosted project applications need separate changes.

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
  scripts/__tests__/discoveryStandards.test.ts scripts/__tests__/amplifyConfig.test.ts \
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
