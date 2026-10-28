# Documentation

Use this index to find current instructions and dated reviews.
Use [TODO.md](../TODO.md) for incomplete work.

## Current instructions

| Document | Use |
| --- | --- |
| [Repository guide](../README.md) | Install, develop, test, and build the site |
| [Blog publication](blog-publishing.md) | Configure the Sheet and import documents |
| [Email DNS](email-dns.md) | Adopt and test mail records, enable signing, and verify delivery |
| [GitHub Actions OIDC](github-actions-oidc.md) | Deploy workflow roles and retire long-lived AWS credentials |
| [Trip authoring](trips/TRIP-AUTHORING-README.md) | Prepare, check, and publish trip content |
| [Trip template](trips/TRIP-STORY-TEMPLATE.md) | Start a trip document |
| [Temperature methodology](../projects/temperature-records/methodology.md) | Check the historical temperature data |
| [Ride Ledger design](../projects/ride-ledger/readme.md) | Review the proposed application and open decisions |

## Reviews

Each report describes the repository at its stated date. Test results apply only to that review.
An older finding can be corrected by a later change.

| Date | Report |
| --- | --- |
| 2026-10-28 | [Trip state ownership and recovery review](reviews/2026-10-28-trip-state-and-recovery.md) |
| 2026-10-27 | [Panorama review and photo failure fixes](reviews/2026-10-27-trip-photo-review.md) |
| 2026-10-27 | [Trip photo panorama research](reviews/2026-10-27-trip-photo-panorama-research.md) |
| 2026-10-27 | [Trip map interaction review](reviews/2026-10-27-trip-map-interaction-review.md) |
| 2026-10-27 | [Trip map review and regression fixes](reviews/2026-10-27-trip-map-review.md) |
| 2026-10-27 | [Trip day map research](reviews/2026-10-27-trip-day-map-research.md) |
| 2026-10-25 | [CI and failure-path review](reviews/2026-10-25-ci-and-failure-paths.md) |
| 2026-10-24 | [Critical review and regression fixes](reviews/2026-10-24-critical-review.md) |
| 2026-10-24 | [Live performance and build follow-up](reviews/2026-10-24-performance-follow-up.md) |
| 2026-10-24 | [Repository quality, performance, and security audit](reviews/2026-10-24-repository-audit.md) |
| 2026-10-20 | [Project changelog review](reviews/2026-10-20-project-changelogs.md) |
| 2026-10-20 | [Recent changes and mail DNS review](reviews/2026-10-20-recent-changes-and-mail-dns.md) |
| 2026-10-08 | [Trip map selection review](reviews/2026-10-08-trip-map-selection.md) |
| 2026-10-07 | [Trip browser budget review](reviews/2026-10-07-trip-browser-budget.md) |
| 2026-10-07 | [Dashboard and dependency review](reviews/2026-10-07-dashboard-and-dependencies.md) |
| 2026-10-01 | [Trip registry and manifest review](reviews/2026-10-01-trip-registry-and-manifests.md) |
| 2026-10-01 | [Gallery and flight data review](reviews/2026-10-01-gallery-and-flight-data.md) |
| 2026-10-01 | [Trip assets, galleries, and follow-up review](reviews/2026-10-01-trip-assets-and-galleries.md#follow-up-review) |
| 2026-10-01 | [Pending changes review](reviews/2026-10-01-pending-changes.md) |
| 2026-10-01 | [Trip implementation](reviews/2026-10-01-trip-report-implementation.md) |
| 2026-10-01 | [Initial trip audit](reviews/2026-10-01-trip-report-audit.md) |
| 2026-09-30 | [Post rendering](reviews/2026-09-30-post-rendering.md) |

## Writing rules

Use [ASD-STE100](https://www.asd-ste100.org/) for technical documentation.
Use short sentences, active voice, and one instruction per sentence.
Use no more than 20 words in an instruction. Use no more than 25 words in a description.
Use one term for each concept. Keep commands, identifiers, and product names exact.
Define technical terms when readers need them.
Keep current procedures separate from historical results.
Record each incomplete task once in `TODO.md`. Link to detailed acceptance conditions when necessary.
Use these rules for all repository documentation.
Use exact software names as technical terms.
Keep an alt description separate from a photo caption.
An alt description states the visible content. A caption can supply other information.
