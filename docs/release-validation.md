# Preview validation before production

Production releases run after the CI and infrastructure checks in `.github/workflows/ci.yml`.
The release job advances `release-preview` to the candidate revision from `main`.
It starts the Amplify build. It validates the deployed URL after a successful build.
Both branches use the production build command and the same app-wide rewrites and headers.
The `dev` branch includes draft content.
The release job uses the full Git history to check that it can advance the preview branch by fast-forward.
A divergent preview branch stops the release.

Check the CI and release jobs after a push.
Then compare the pushed commit with `https://www.rsmb.tv/deployment.json`.
That file identifies the build currently served by production.
If CI fails, the workflow skips the release job. The previous deployment continues to serve requests.

## Browser checks

The validator checks the deployed site.

- It requests `deployment.json` directly at the start and end. Both responses must give the same commit ID and Amplify job ID. A redirect fails the check.
- It opens the homepage, About, Posts, Projects, Flights, the temperature maps, Tornado Tracks, and ski-status directly.
- It checks the response type for JavaScript, CSS, JSON, GeoJSON, and images. An HTML response at an asset URL fails the check.
- It checks the response headers for documents and requested assets against `customHttp.yml`.
- It decodes each responsive project preview, including AVIF and WebP images.
- It checks the temperature schemas and monthly threshold version. It checks flight routes and airports. It compares the tornado annual summary with the index. It checks the requested yearly tornado geometry.
- It checks for page errors, failed requests for required files, and worker errors. It checks that the Flights, temperature, and tornado maps start.
- It downloads the ski terrain archive. It checks the SHA-256 checksum against the terrain index. It checks the `206` status, `Content-Range` header, and bytes for each range request.
- It turns on **Ski terrain** at Heavenly. It opens the Heavenly Gondola and Cloud 9 tooltips. It records the range count in `skiTerrainRanges`.

The validator disables browser HTTP caching. The header checks inspect network responses.
Chromium can omit HTTP Strict Transport Security (HSTS) when it reuses a cached worker response.
The test for repeated worker loads uses a fixture server with direct HTTP requests. [Playwright route reference](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)

CI installs browser dependencies through `scripts/install-ci-browsers.sh`.
GitHub's Ubuntu runners use the primary Ubuntu archive. The installation checks package signatures and has a ten-minute limit.

## Release proof

After browser validation succeeds, the release job writes a proof to `s3://rsmbtv-temperature-data/release-validations/{full-commit-sha}/{normalized-preview-job-id}.json`.
`RELEASE_VALIDATION_BUCKET` selects that bucket in CI. IAM limits the release role's write access to the proof prefix.
The proof records the revision, preview origin, job ID, validation time, and SHA-256 digest of the successful report.
The validator removes leading zeroes from the job ID. The release job requires this ID to match `previewJobId` in the report.

Before production, the workflow reads the deployment record from Amplify.
It reads the proof from `https://data.rsmb.tv/release-validations/`.
It confirms that `main` still names the candidate revision.
The production build repeats the deployed-preview and proof checks before and after compilation.
The deployment and proof must identify the same revision and preview job. The proof must be 24 hours old or less.
A redirect from the deployment record or proof URL stops production.
Set `RELEASE_VALIDATION_BASE_URL` to override the public proof location. Set `RELEASE_PREVIEW_URL` to override the preview origin.

The preview and production build the same revision with the same production settings.
The ski asset checksums fix the asset versions for that revision. Other external content can change between builds.

## Ski-status build assets

Set `SKI_ASSETS_BASE_URL` at app level in Amplify before the first ski-status build.
Use an HTTPS mirror with the versioned runtime files for the candidate revision.
Amplify uses this mirror when the NAS files are unavailable.
The build checks each SHA-256 checksum. A missing file, a file over its size limit, or a checksum error stops the build.
Follow the asset procedure to prepare the mirror. [Ski-status asset procedure](../projects/ski-status/readme.md#release-assets)
Apply the Terraform rewrite before you validate the hosted preview. It lets Amplify serve the `.pmtiles` archive as a data file. [Rewrite configuration](../infra/main.tf), [AWS rewrite rules](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html#redirects-for-single-page-web-apps-spa)

## Activation

The site activated the preview branch, release role, production build setting, data origin, and GitHub variables on 2026-11-05.
The November repair updated 226 temperature archives, the station catalog, and the recent summary. The public summary uses monthly threshold version 2.

1. Apply the release infrastructure. It creates `release-preview` and the `rsmbtv-release` OpenID Connect (OIDC) role. It disables automatic production builds. It adds the preview hostname to the data bucket's cross-origin resource sharing (CORS) rules. Keep the Amplify build variables. The build guard uses `AWS_APP_ID` to find the preview URL.
2. Set `AMPLIFY_APP_ID` and `AWS_RELEASE_ROLE_ARN` from the infrastructure outputs. Check that `RELEASE_VALIDATION_BUCKET` points to the data bucket. Give GitHub Actions permission to advance `release-preview`.
3. Check that the preview uses the production content and data settings. Add the preview origin to the CARTO browser key's allowed origins. Terraform defines the data bucket's preview origin.
4. Review the twelve open historical threshold differences in the backfill audit. Publish corrected data through **Sync Temperatures → repair_monthly_archives**. This job reads the original archives. The release validator requires monthly threshold version 2. [Backfill audit](performance/2026-11-05-temperature-full-backfill.json)
5. Run CI for the candidate commit on `main`. Inspect the `release-validation` report. Check the public proof and both Amplify jobs. Verify that production stops when the proof is missing, expired, or for a different build.

The previous production deployment serves requests if preview validation fails. Correct the data or hosting configuration. Run CI again. A failed production build requires a new gated release.

## Run local checks

To inspect a hosted candidate from a local checkout, run the browser validator with its revision.

```bash
npm run validate:release -- --base-url https://release-preview.APP_ID.amplifyapp.com --revision FULL_COMMIT_SHA --out release-validation.json
```

This command writes a report. It pins the preview job from the first successful identity check.
The gated release workflow publishes the proof that authorizes production.

Run `npm run test:release-validation` to test the validator in Chromium.
The fixtures use real responsive images. They supply controlled responses for external requests.
They cover downloads, workers, headers, image decoding, page readiness, deployment identity, and map rendering.

Run the browser check for page-download recovery on the production bundle. Add `PLAYWRIGHT_WEBKIT=1` to include WebKit.

```bash
npm run test:page-recovery
```

The fixture preview tests recovery and layout. Hosted release validation checks the Amplify rules.
The layout checks include project cards and search results at 200% text size.
They wait for the page body and use a wider font to detect overflow beyond the search panel.
The November 15 report records the failed layout check and its repair. [Layout evidence](performance/2026-11-15-search-layout-release.json)

The workflow uses the Amplify job API and its build variables. [Job API](https://docs.aws.amazon.com/amplify/latest/APIReference/API_StartJob.html), [Build variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html), [IAM resources](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amplify.html)
