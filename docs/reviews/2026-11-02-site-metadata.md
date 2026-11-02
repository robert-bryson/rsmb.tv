# Site metadata audit — 2026-11-02

This report records the initial metadata change.
The [follow-up review](2026-11-02-pending-changes-quality-review.md) fixes routing and crawler restrictions and records later validation.

The site already supported JSON-LD on React pages, canonical URLs, Open Graph and
Twitter tags, RSS, robots.txt, and a generated sitemap. Post HTML already included
article metadata before JavaScript. The gaps were incomplete static page metadata,
SVG social cards, missing sitemap routes, and missing-page indexing behavior.

## Changes

- All 19 public pages now have build-time metadata. Home, About, project and post
  collections, project descriptions, maps, and standing-record ages use the same
  definitions in built HTML and React.
- Five legacy routes receive the canonical page's metadata. Both article URL
  collections retain the correct canonical story URL. Tracking parameters and
  fragments do not enter canonical URLs.
- Project JSON-LD includes author identity, screenshots, source repositories,
  technology keywords, known feature-update dates, and application platforms.
  Map pages identify their application through `mainEntity`. Breadcrumbs cover
  all public pages except Home.
- Articles include `BlogPosting`, publisher and author identity, the canonical
  `mainEntityOfPage`, publication dates, language, and breadcrumbs. Trip hero
  URLs are absolute and carry alt text and dimensions in social metadata.
- Generated social cards are 1200 × 630 PNG files with wrapped text. SVG sources
  remain available. Page cards are committed alongside their existing SVGs;
  generated post cards remain ignored and are rebuilt after content sync.
- The sitemap now includes aborg, parc, Status Dashboard, Flights Map, and the
  Temperature Records Map. RSS build timestamps include trip manifest changes.
- Missing pages and posts get `noindex, follow`. Navigation clears stale article
  metadata and noindex tags and restores pre-existing canonical links on cleanup.
  Development builds retain their existing global indexing exclusion.

## Maintenance and hosting

Add a public route to `src/content/sitePages.json`, the sitemap route sources, and
the social card definitions. Apply it through `usePageMetadata`. The route
coverage test checks these lists against `src/App.tsx`. Legacy paths belong in
`src/content/siteAliases.json`. Post metadata continues to come from the existing
Google Sheets/Docs publishing workflow.

The Amplify rules in `infra/main.tf` derive public page rewrites from the two JSON
registries, before the SPA fallback. Deploy the generated HTML and apply those
infrastructure changes together. This task prepared local source and build output;
it did not apply Terraform or deploy production.

## Validation

- All 139 Vitest files passed: 2,032 tests.
- TypeScript checking, production Vite build, metadata/feed/image generation,
  Terraform formatting, and diff whitespace checks passed.
- Chromium checked all 19 public pages, five legacy paths, and six article URLs
  against the production preview with JavaScript disabled. Canonicals, JSON-LD,
  and PNG image responses passed.
- Chromium also checked article-to-project navigation and missing-to-valid post
  navigation, including stale schema, publication tags, canonical URLs, and robots
  cleanup.
- Full Terraform validation could not run because the pinned AWS provider
  `hashicorp/aws` 6.71.0 was not cached locally. No cloud changes were made.

## Limits and primary references

This covers rsmb.tv and its project/post pages in this repository. Independently
deployed applications such as Through Routes, Bookend, and route2gpx have separate
source and deployment lifecycles and were not changed here.

Page bodies still render in the browser; this is metadata generation, not full
server rendering. Google's [JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
supports injected structured data and recommends consistent HTML canonical tags.
Its [article guide](https://developers.google.com/search/docs/appearance/structured-data/article)
describes the article properties used here.

Valid Schema.org markup does not guarantee rich results. Google's
[software rich-result requirements](https://developers.google.com/search/docs/appearance/structured-data/software-app)
include an offer and a review or rating. The portfolio does not publish those
for every app, so this change does not invent them or claim universal rich-result
eligibility. Search Console inspection and the Rich Results Test can check the
deployed pages after release.

Amplify rewrite ordering follows the [AWS redirect guidance](https://docs.aws.amazon.com/amplify/latest/userguide/redirects.html).
