# GitHub Actions AWS authentication

## Prepared configuration

The account already has the `token.actions.githubusercontent.com` OIDC provider. Terraform reuses its ARN and defines four workflow roles.
The role trust requires this repository's `main` branch and the `sts.amazonaws.com` audience. Routine sync sessions last one hour. The temperature workflow requests three hours for a full archive repair. The production release role permits two hours for preview, validation, and production builds.
See the [GitHub AWS OIDC guide](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).

| Role | Object permissions |
| --- | --- |
| `rsmbtv-sync-temperatures` | Read and write the six named temperature JSON files, daily observations, and ACIS cache |
| `rsmbtv-sync-tornadoes` | Read, write, and delete objects under `tornadoes/` |
| `rsmbtv-sync-ski-status` | Read and write objects under `ski-status/` |
| `rsmbtv-release` | Read Amplify app/job status, start `release-preview` and `main` jobs, and write validation proofs only under `release-validations/*` |

Each sync role can list its configured bucket prefixes. The temperature and tornado roles can invalidate the data CloudFront distribution.
The ski-status manifest has a short cache lifetime. The release role can write under `release-validations/` only.
All four roles use the public data bucket.

The temperature and tornado workflows select OIDC when their role variable is non-empty.
The legacy authentication step runs only when that variable is empty. A failed OIDC step does not fall back to legacy keys.
The existing IAM user and secrets remain available during the transition.

## Deploy and switch

1. Configure the Terraform AWS profile described in [providers.tf](../infra/providers.tf).
2. Follow the existing [mail state ownership checks](email-dns.md#adopt-existing-records) before reviewing the full infrastructure plan.
3. Review the plan for the workflow roles, their policies, and any other pending infrastructure changes.
4. Apply the reviewed plan through the repository's infrastructure procedure.
5. Read the `github_data_sync_role_arns` Terraform output.
6. Set `AWS_TEMPERATURE_SYNC_ROLE_ARN` to the `temperatures` ARN in repository Actions variables.
7. Set `AWS_TORNADO_SYNC_ROLE_ARN` to the `tornadoes` ARN in repository Actions variables.
8. Run the temperature and tornado workflows from `main`. Confirm that each uses its OIDC step.
9. Verify the generated data, uploads, and invalidations. Verify both recent and full temperature sync modes.
10. Remove legacy authentication and credentials only after those checks pass.

### Enable ski-status sync

1. Set `AWS_SKI_STATUS_SYNC_ROLE_ARN` to the `ski-status` ARN from the Terraform output.
2. Run **Sync Ski Status** from `main`.
3. Check `manifest.json`, its linked report and forecast files, and the history entry in the data bucket.
4. Run the workflow again. Check the archived manifest in `previousManifest`.

[Ski-status publication](../projects/ski-status/readme.md#conditions-publication)

Activate the production release role separately through the [release guide](release-validation.md#activation).
Set `AWS_RELEASE_ROLE_ARN` from `github_release_role_arn` and set `AMPLIFY_APP_ID` in repository Actions variables.
The release job requires OIDC and has no legacy-key fallback.
Its `RELEASE_VALIDATION_BUCKET` environment value selects the data bucket for successful validation proofs.
The release job writes each proof to `release-validations/{full-commit-sha}/{normalized-preview-job-id}.json`. Production reads the proof through the data CDN.
The proof expires for release authorization after 24 hours and cannot authorize another revision or preview build.
The release role and its repository variables became active on 2026-11-05. The temperature and tornado migrations remain pending. Their workflows still support legacy keys.
Mocked tests do not establish live role access. A successful gated release verifies the release role through GitHub's token exchange and the scoped Amplify/S3 operations.

Store role ARNs in repository variables. Keep private access keys in repository secrets during migration.
Keep the existing account OIDC provider. Other repositories can depend on it.

## Local verification

The mocked Terraform suite verifies trust restrictions and project object permissions without AWS calls.
The workflow tests verify mutually exclusive authentication steps and the absence of raw credentials in data-step environments.
These checks do not verify token exchange or production upload permissions. The workflow runs above provide that verification.
