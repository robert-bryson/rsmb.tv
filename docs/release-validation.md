# Preview validation before production

Production releases run after the CI and infrastructure checks in `.github/workflows/ci.yml`.
The release job advances `release-preview` to the candidate main revision, starts its Amplify build, waits for success, and validates its deployed URL.
Both branches use the production build command and the same app-wide rewrites and headers.
The separate `dev` branch continues to include draft content.

The validator checks:

- The exact full commit ID and Amplify job identity in `deployment.json`, before and after validation.
- Direct visits to the homepage, About, Posts, Projects, Flights, recent temperatures, state temperatures, county temperatures, and Tornado Tracks.
- JavaScript, CSS, JSON, GeoJSON, and image response types. An HTML fallback at an asset URL fails the release.
- Configured first-party response headers from `customHttp.yml`, including security policy and path-specific cache rules, on documents and requested assets.
- Decoding every responsive project-preview image, including AVIF and WebP variants.
- Temperature schemas and version 2 monthly thresholds, flight route/airport schemas, matching tornado annual summary/index contracts, and requested yearly tornado geometry.
- Application errors, failed required requests, map worker errors, and usable Flights, temperature, and tornado map startup.

The validator disables browser HTTP caching so header checks inspect network responses.
Chromium can omit HSTS when it reuses a cached worker response. A repeated-worker regression runs without fixture interception, which would otherwise hide this behavior.
The routing behavior follows the [Playwright reference](https://playwright.dev/docs/api/class-browsercontext#browser-context-route).

CI installs browser dependencies through `scripts/install-ci-browsers.sh`.
On GitHub's Ubuntu runners, it uses the primary Ubuntu archive after the Azure mirror stalled on package downloads. Package signatures remain enabled, and the installation step has a ten-minute limit.

After browser validation succeeds, the release job writes a proof to `s3://rsmbtv-temperature-data/release-validations/{full-commit-sha}/{normalized-preview-job-id}.json`.
`RELEASE_VALIDATION_BUCKET` selects that bucket in CI. The release role can write only the proof prefix; sync roles cannot write it.
The proof records the revision, preview origin, normalized Amplify job ID, validation time, and SHA-256 digest of the successful report. Leading zeroes are removed from job IDs.
Missing or failed validation does not produce a proof.

Before starting production, the workflow rechecks the deployed preview and its proof through `https://data.rsmb.tv/release-validations/`, then confirms that main still names the candidate revision.
The production build repeats the deployed-preview and proof checks before and after compilation.
Both must identify the exact revision and preview job, and the proof must be no more than 24 hours old.
A deployed preview alone cannot authorize production, including after a browser validation failure or a different build of the same revision.
`RELEASE_VALIDATION_BASE_URL` can override the public proof origin; `RELEASE_PREVIEW_URL` can override the preview origin.

The preview and production are separate builds of the same revision, with the same production configuration. Content imported from external sources can change between builds; this is not promotion of an identical artifact archive.

## Activation

The preview branch, release role, production build setting, data CORS origin, and GitHub variables were activated on 2026-11-05 after approval.
The audited repair was published for all 226 temperature archives, the station catalog, and the recent summary. The public summary serves monthly threshold version 2.
The steps below describe initial setup and the checks required for each release. Repository changes alone do not update AWS or GitHub settings.

1. Apply the infrastructure changes to create `release-preview`, disable automatic production builds, create the `rsmbtv-release` OIDC role with its scoped proof permission, and allow the preview hostname in the data bucket's CORS configuration. Preserve existing Amplify build environment values. The build guard derives the preview URL from Amplify's `AWS_APP_ID`.
2. Set repository variables `AMPLIFY_APP_ID` and `AWS_RELEASE_ROLE_ARN` using the infrastructure outputs. Confirm that the release job's `RELEASE_VALIDATION_BUCKET` selects the intended data bucket. GitHub Actions needs permission to advance the `release-preview` branch.
3. Ensure the release preview inherits the production content/data settings. Add its hostname to the browser-restricted CARTO key's allowed origins; the data bucket preview origin is already defined in Terraform.
4. Review the [backfill audit](performance/2026-11-05-temperature-full-backfill.json), including its twelve unresolved historical threshold disagreements, then publish corrected temperature data through **Sync Temperatures → repair_monthly_archives**. This reruns the strengthened repair from source archives. The release gate rejects the old unversioned summary; the version check alone does not establish historical source accuracy.
5. Run CI for the candidate main commit. Inspect its `release-validation` report, matching public proof, and both Amplify jobs. Verify that missing, expired, or mismatched proof prevents a production build.

The old production remains available if preview validation fails. Re-run CI after correcting data or hosting configuration. A failed production build requires another gated release; it does not bypass preview validation.

Manual validation:

```bash
npm run validate:release -- --base-url https://release-preview.APP_ID.amplifyapp.com --revision FULL_COMMIT_SHA --out release-validation.json
```

This command writes a report. The gated release workflow publishes the proof that authorizes production.

Run the validator's local Chromium integration tests with `npm run test:release-validation`.
The fixtures use real responsive images and intercept external requests. They check successful validation and failures in downloads, workers, headers, image decoding, page readiness, deployment identity, and map rendering.

Page-download recovery has a separate production-bundle browser check. Add `PLAYWRIGHT_WEBKIT=1` to include WebKit alongside Chromium:

```bash
npm run test:page-recovery
```

The fixture preview used by that check verifies failure behavior and layout. Hosted release validation verifies the actual Amplify rules.

The implementation follows the official [Amplify job API](https://docs.aws.amazon.com/amplify/latest/APIReference/API_StartJob.html), [build environment reference](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html), and [IAM resource model](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amplify.html).
