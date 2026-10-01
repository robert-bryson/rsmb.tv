# Blog publication

Google Sheets and Google Docs contain the source content.
The build imports published Sheet rows and converts their documents to MDX.
MDX is Markdown with React components.
The build then generates RSS, sitemap, and Open Graph files.
Git ignores these generated files.

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
| `GOOGLE_BLOG_SYNC_ON_DEV` | Set `false` to omit automatic import during development. |

## Import content

```bash
GOOGLE_BLOG_SHEET_ID=your-sheet-id npm run build-blog
```

`npm run dev` imports published posts and drafts when the Sheet is configured.
Incomplete drafts do not stop other development content.
The development panel shows the publication state, source links, and known errors.
Without Sheet configuration, development uses existing generated files.

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
It removes active HTML and restricts URL protocols.
It treats braces, angle brackets, and module statements in ordinary text as literal content.
Code blocks retain their original characters.

Use short, unique headings.
The site derives heading IDs from the heading text.
For example, `Day 1: Seattle to Boise` becomes `#day-1-seattle-to-boise`.
Repeated headings receive numeric suffixes.
Each heading links to itself and back to the table of contents.

After an importer change, regenerate local documents:

```bash
npm run sync-blogs:dev
```

Do not edit generated MDX as the content source.

## Check article navigation

The post list supports `type` and `tag` query parameters.
For example, `/posts?type=writing&tag=Maps` selects writing with the exact `Maps` tag.
Explicit tags keep their original case.
Trip facts add normalized motorcycle and region tags to the registry.

Previous and next links select adjacent articles within the same collection.
Previous selects the older article. Next selects the newer article.
The links retain the original list filter.
The return link requests restoration of the list scroll position.
Collection redirects retain query parameters, heading fragments, and navigation state.

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
The metadata includes the title, description, canonical URL, and social image.
Apply the article rewrite rules in `infra/main.tf` before production release.
The browser still renders the article body.
