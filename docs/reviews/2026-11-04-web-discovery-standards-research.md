# Web discovery standards research — 2026-11-04

Date: 2026-11-04.
Reviewed baseline: `29bdb12`.
Scope: additional metadata, browser identity, syndication, author identity, and discovery protocols for rsmb.tv and the pages built by this repository.
This report records research and recommendations. It does not establish implementation, deployment, indexing, or third-party preview results.
**Evidence** describes primary specifications, service documentation, or repository behavior. **Recommendation** identifies a decision for this site.

## Recommended scope

Add browser identity through a small manifest.
Provide real PNG icons.
Declare the site's theme color.
Offer JSON Feed beside RSS.
Identify the existing GitHub profile with `rel="me"`.
Permit large search image previews.
Preserve existing indexing restrictions.
These additions fit the current static build and require no new external service.

| Candidate | Decision | Reason |
| --- | --- | --- |
| Web App Manifest, PNG icons, theme color | Add | Supplies names, icon choices, launch identity, and browser UI color |
| JSON Feed 1.1 | Add beside RSS | Offers a JSON representation of the existing public article feed |
| `rel="me"` | Add for the established GitHub identity | Expresses the author's existing public profile relationship |
| `max-image-preview:large` | Add with restriction preservation | Allows larger search thumbnails |
| Atom | Defer | Another XML feed is a lower priority while RSS already exists |
| Microformats2 | Defer until content HTML is available without JavaScript | Useful embedded semantics require the actual profile/article markup |
| oEmbed | Defer until an embedding product is designed | Requires valid embed responses and a deliberate framing policy |
| Webmention | Defer until replies or mention notifications are wanted | Requires a receiving service, verification, and abuse handling |
| Dublin Core / RDFa | Defer | No identified consumer needs another vocabulary or structured-data syntax |
| IndexNow | Defer to a publication/deployment integration | Notifications should describe content that is already publicly available |
| `llms.txt` | Defer; track as a proposal | No established requirement or demonstrated consumer need for this portfolio |

## Browser identity and icons

**Evidence.** The current [W3C Web App Manifest specification](https://www.w3.org/TR/appmanifest/) is a Working Draft with deployed implementations.
It defines names, icons, launch URL, navigation scope, and display mode.
`id` identifies the application independently of the manifest URL.
It must share the start URL's origin.
`display: "browser"` requests normal browser navigation.
The format does not itself provide offline caching.
Its registered media type is `application/manifest+json`.

**Recommendation.** Publish `/site.webmanifest`.
Link it from every generated document.
Set a stable `id`, `start_url`, and `scope` to `/`.
Provide the existing site name and a short name.
Set `lang: "en-US"`.
Include a description, background and theme colors, and same-origin icon paths.
Keep these paths root-relative.
This prevents redirected hosts or development origins from creating cross-origin launch URLs.
Avoid user identifiers and tracking queries in the launch URL.
The [manifest privacy discussion](https://www.w3.org/TR/appmanifest/#privacy-consideration-start_url-tracking) identifies persistent tracking risks.

Use `display: "browser"` for this portfolio.
Keep service workers, install prompts, offline claims, and native-app associations outside this metadata change.
Independently deployed applications need their own decisions and manifests.

**Evidence.** Google's [installation guidance](https://web.dev/articles/install-criteria) includes 192 × 192 and 512 × 512 manifest icons.
It distinguishes browser install promotion from other ways users can install sites.
These sizes are practical browser targets, rather than mandatory dimensions for every conforming manifest.
Apple's [Web Clip documentation](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html#//apple_ref/doc/uid/TP40002051-CH3-SW4) specifies PNG touch icons.

**Recommendation.** Generate actual 192- and 512-pixel PNGs from the existing vector branding.
Retain the SVG favicon and Apple PNG icon.
Provide a 48-pixel PNG browser favicon.
Declare each icon's real dimensions and type.
Use the ordinary `any` purpose for manifest icons.
A [maskable icon](https://www.w3.org/TR/appmanifest/#icon-masks) needs artwork designed for its safe area.
Do not relabel an ordinary favicon as maskable.

**Evidence.** HTML's [`theme-color`](https://html.spec.whatwg.org/multipage/semantics.html#meta-theme-color) is a suggested CSS color for surrounding browser UI.
Browsers may adjust it.
Media queries can select different values.
It is separate from the manifest's theme color.

**Recommendation.** Put the existing dark surface color in both places.
Keep this static while the site has a single dark visual theme.
Browser appearance and installation remain platform-dependent.

## JSON Feed beside RSS

**Evidence.** [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) is the format authors' published specification.
It requires `version`, `title`, and `items`.
Every item needs a stable string `id`.
It also needs at least one of `content_text` or `content_html`.
`summary` alone is insufficient.
Dates use RFC 3339.
`authors` replaces the older singular `author`.
Discovery uses `rel="alternate"` with `type="application/feed+json"`.
This is also its preferred response media type.

**Recommendation.** Generate `/feed.json` from the same published-post selection, ordering, canonical URL construction, and descriptions as [RSS](../../scripts/generate-rss.js).
Preserve RSS and its existing URL.
Initially provide summary-length `content_text` and a canonical `url`.
Explain the excerpt format in the feed description.
Include `authors`, language, feed URL, home-page URL, title, and publication dates.
Use canonical absolute `https://rsmb.tv/...` URLs as IDs consistently with existing feed identity.
Avoid synthesizing modification dates from build time.
Review ID migration before canonical collection changes.
This prevents duplicate items in readers.

Use JSON serialization for article punctuation and control characters.
Keep drafts out of both public feed files regardless of the environment producing them.
Add HTML autodiscovery.
Add an ordinary subscription link in the visible footer.
Use the new square 512-pixel PNG as the feed icon.
Use the 192-pixel PNG as the JSON Feed favicon.
Keep the separate 48-pixel PNG for browser favicon links.

**Evidence.** [Atom, RFC 4287](https://www.rfc-editor.org/rfc/rfc4287.html), is an IETF Standards Track XML syndication format.
It defines identifiers, update timestamps, authors, and content constructs.

**Recommendation.** Atom is valid future work if a consumer requests it. Its formal standardization does not by itself make a third feed representation useful here. JSON Feed supplies a different parsing interface while RSS preserves the existing subscription path.

## Author identity

**Evidence.** IANA [registers `me`](https://www.iana.org/assignments/link-relations/#link-relations-1) as a link to information about the context's author. The originating [`rel="me"` specification](https://microformats.org/wiki/rel-me) describes links between profiles of the same person and reciprocal links as identity confirmation. This is distinct from proving a legal identity.

**Recommendation.** Add `<link rel="me" href="https://github.com/robert-bryson">` to static HTML.
Append `me` to the existing GitHub profile anchors.
Retain their existing link protections.
Start with this already established account.
Do not treat project repositories or other people's profiles as author identities.
Keep the relationship consistent with the existing `Person.sameAs` data.
Adding it publishes an identity association.
Do not infer additional accounts.

**Evidence.** [Mastodon's verification documentation](https://docs.joinmastodon.org/user/profile/#link-verification) accepts `a` or `link` elements but requires the relationship directly in the fetched HTML, without JavaScript. Verification also requires an appropriate reciprocal HTTPS profile link. Its [author attribution feature](https://docs.joinmastodon.org/user/profile/#author-attribution) uses `fediverse:creator` plus an account-side domain allowlist.

**Recommendation.** Do not invent a Mastodon account.
Defer `fediverse:creator` until the account and attribution settings are known.
A future account can be added once its URL and account-side settings are known.
Adding `rel="me"` alone does not establish verification by any particular service.

## Search preview controls

**Evidence.** Google's [robots metadata specification](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) defines `max-image-preview:large` as permission for larger result previews, rather than an instruction to generate one. It does not override `noindex`. `none` means `noindex, nofollow`; conflicting restrictions resolve to the more restrictive instruction. `max-snippet:-1` leaves snippet length to Google; `max-snippet:0` is equivalent to `nosnippet`. Crawlers must be able to fetch a page to read its metadata, and other engines may interpret rules differently.

**Recommendation.** Add only `max-image-preview:large` as the new default.
Leave text and video defaults alone.
Merge robots directives with the existing restrictions.
Keep `noindex, nofollow` in development.
Keep existing exclusions for missing and draft production pages.
Restore the prior tag after navigation cleanup.
Preserve an existing `none`, `nofollow`, `nosnippet`, `noimageindex`, or narrower image-preview limit.
Do not add `index, follow` as a blanket reset.
Cover both initial HTML and React navigation.
Robots metadata controls cooperating crawlers.
It does not provide access control for drafts.

## Deferred protocols and formats

### Microformats2

**Evidence.** [Microformats2](https://microformats.org/wiki/microformats2) encodes structured data in HTML classes. [`h-card`](https://microformats.org/wiki/h-card) describes a person or organization using actual profile markup; Webmention also references [`h-entry` article semantics](https://www.w3.org/TR/webmention/#webmention-verification). These are established community specifications with independent consumers, rather than replacements for JSON-LD.

**Recommendation.** Revisit visible microformats when implementing static body rendering or a concrete IndieWeb consumer.
Use `h-card` for the About profile.
Use `h-entry` for articles.
The [current metadata architecture](../site-metadata.md) generates head metadata while bodies still need JavaScript.
Adding only React classes would give limited coverage to consumers that fetch HTML.
Do not create hidden duplicate article bodies to advertise this support.

### oEmbed

**Evidence.** [oEmbed](https://oembed.com/#section2) defines an HTTP API for an embeddable representation of a URL, with `link`, `photo`, `video`, and `rich` response types. Its [discovery rules](https://oembed.com/#section4) require links to actual oEmbed responses. Its [security guidance](https://oembed.com/#section3) discusses unsafe URLs and supplied HTML.

**Recommendation.** Current Open Graph cards solve ordinary link previews.
A `link` response could be static, but brings little new behavior here.
An interactive map embed would need a designed embed route, sizing and interaction contract, and resource budgets.
The current [response headers](../../customHttp.yml) deny framing with `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`.
Do not advertise iframe embeds while that policy remains.
Define a specific framing policy for any future embed.
Assess its third-party resource requests and viewer privacy.

### Webmention

**Evidence.** [Webmention](https://www.w3.org/TR/webmention/) is a W3C Recommendation. A receiving endpoint accepts source/target POST requests and fetches the source to verify that it links to the target. The specification covers asynchronous processing, moderation, request limits, protected-resource access, sanitization, and the visibility of republished content.

**Recommendation.** Add it only with an explicit comments or mention-notification feature.
A static `rel="webmention"` tag without a functioning receiver is incomplete.
Choose a service or backend.
Protect against requests to internal addresses.
Limit fetches and redirects.
Sanitize displayed content.
Plan deletion and reverification.
Assign moderation responsibility.
A hosted receiver also discloses source/target URLs to that provider.
Review that data flow before choosing one.

### Dublin Core and RDFa

**Evidence.** [DCMI Metadata Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) is a recommended vocabulary for resource description. [RDFa Lite 1.1](https://www.w3.org/TR/rdfa-lite/) is a W3C Recommendation for expressing structured data through HTML attributes. One is a vocabulary and the other a syntax; they are not interchangeable products.

**Recommendation.** Retain the current Schema.org JSON-LD source.
Add Dublin Core only for a named archive, catalog, or scholarly consumer.
Add RDFa only when a consumer needs data in visible markup.
Duplicating title, author, dates, and descriptions in more formats increases consistency work without an identified new behavior for this portfolio.

### IndexNow

**Evidence.** [IndexNow's protocol](https://www.indexnow.org/documentation) submits added, changed, or deleted URLs and verifies host ownership through a hosted key file. Successful submission acknowledges receipt, not indexing. Its [official site](https://www.indexnow.org/index) lists participating engines; coverage should not be assumed for every search provider.

**Recommendation.** Consider a production-only post-deployment task after a reliable public deployment signal and changed-URL list exist.
Submit canonical published URLs only after the new content and verification file are reachable.
Handle deletion separately.
Retry bounded failures.
Exclude preview URLs.
Notifications share submitted URLs with participating engines.
A metadata build is too early if deployment can fail or content is still unpublished.
Keep the sitemap regardless.

### `llms.txt`

**Evidence.** The [proposal author's site](https://llmstxt.org/) still labels `llms.txt` a proposal; the current page describes v2, modified 2026-08-10. It proposes concise Markdown guidance, links, and alternate Markdown representations. This is not evidence that every AI crawler honors it. Google's [AI search guidance](https://developers.google.com/search/docs/appearance/ai-features#best-practices) explicitly requires no additional AI text files or special markup for its AI search features.

**Recommendation.** Do not add a manually maintained portfolio summary merely to claim AI discoverability.
Revisit if a concrete agent consumer needs a generated guide to project documentation.
If adopted, generate it from public canonical content.
Exclude drafts and private information.
Label it supplemental.
It neither grants access nor replaces robots policy, canonical links, sitemaps, or readable page content.

## Delivery and validation requirements

**Evidence.** Amplify's [SPA rewrite example](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html#redirects-for-single-page-web-apps-spa) excludes named file extensions from its HTML fallback. Its [custom-header documentation](https://docs.aws.amazon.com/amplify/latest/userguide/custom-headers.html) describes repository-managed HTTP response headers. This repository's existing fallback excludes `.json` but initially omits `.webmanifest`.

**Recommendation.** Include `.webmanifest` in the asset passthrough rule.
Serve the manifest and feed with their format-specific media types.
Apply the routing change with the generated assets.
Redeploy affected hosting branches.
These are deployment prerequisites.
Source changes alone do not establish correct public responses.

Before release, verify generated home, About, project, map, and article HTML without JavaScript.
Validate JSON syntax and required feed fields.
Compare published-item sets between RSS and JSON Feed.
Verify stable item URLs.
Verify actual PNG dimensions.
Verify robots restrictions through React navigation.
Verify restoration of robots metadata after cleanup.

After deployment, request `/site.webmanifest`, `/feed.json`, and icons with GET requests.
Verify the final URLs and response headers.
Verify that these resources return their expected non-HTML bodies.
Inspect browser manifest diagnostics.
Follow host redirects to confirm same-origin launch behavior.
External profile verification and search/preview rendering require separate checks by the consuming services.
