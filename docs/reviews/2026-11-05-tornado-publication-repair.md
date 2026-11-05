# Tornado publication and build repair: November 5, 2026

## Cause

Amplify build 424 failed for commit `f8c7185`.
The dependency installation succeeded. The publication check failed before application compilation.
`trend-index.json` returned HTTP 403 because the object was absent from the production bucket.
The frontend was pushed before its new data dependency was published.

The failing command was `npm run verify-tornado-publication`.
An S3 listing confirmed zero objects at the required key.
The previous successful deployment, `b031e4b`, remained live.
The [failed build](https://us-east-1.console.aws.amazon.com/amplify/home#/d38ki8k4lanh8s/main/424) records the same error.

## Repair

The repair generated the index from the existing public production tracks with the committed shared aggregate builder.
It checked each year's record count and compared every aggregate metric with the published annual summary.
The annual summary was checked again after generation to detect a concurrent publication change.

| Validation | Result |
| --- | ---: |
| Published years | 77 |
| Source county segments | 80,221 |
| Aggregate groups | 9,553 |
| JSON bytes | 1,218,145 |
| All published annual metrics | Exact match |

Only the missing index was uploaded.
A conditional S3 write refused to overwrite an existing object.
The upload used the existing JSON content type and one-hour cache policy.
The repair invalidated only `/tornadoes/trend-index.json`.
It retained the private bucket policy and the frontend publication check.

## Workflow changes

The data workflow now validates its generated publication before uploading it.
It requests configured CloudFront invalidation, then validates the public publication.
The public check tries at most six times, with ten seconds between attempts, while cached responses expire.
The public check verifies that the browser can read matching annual summaries and aggregates.
A workflow cannot report success when only its local output is valid.

The project guide now states the release order: publish data, verify public access, then release the frontend.
It also lists the index in the generated archive layout.

## Regression checks

New tests check the publication sequence and execute the actual verification shell commands with npm and timer stubs.
They verify immediate success, recovery after transient failures, and failure after all six attempts.
Successful checks stop immediately. Persistent failures return a nonzero exit status.
The release checker also has an explicit HTTP 403 regression case.

Before the workflow change, two regression cases failed.
All 140 final focused tests passed.
The focused suite covers workflow configuration, publication validation, aggregate correctness, and the tornado generator.

## Release verification

The original publication check now passes through the public CDN.
The public index digest matches the validated upload:
`8abe266d1d3f679504a6d2918eed4ce038cdbb9f5eb7f0cd2e2e25a3b05167ad`.
ESLint and TypeScript checks also pass.

After Amplify completes, verify `deployment.json` and repeat the three live feature checks.
Use the same phone, CPU, and network conditions as the earlier production measurements.

The [project guide](../../projects/tornado-tracks/readme.md#release-order) contains the current procedure.
The [initial responsiveness report](2026-11-05-responsiveness-improvements.md) retains the original local measurements.
