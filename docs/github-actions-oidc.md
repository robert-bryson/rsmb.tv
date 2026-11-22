# GitHub Actions AWS authentication

## Prepared configuration

Terraform uses the account's `token.actions.githubusercontent.com` OpenID Connect (OIDC) provider.
Each role trusts this repository's `main` branch and the `sts.amazonaws.com` audience.
Routine sync sessions last one hour. A full temperature archive repair can use three hours.
The release role permits two hours for preview, validation, and production builds. [GitHub OIDC setup](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

| Role | Object permissions |
| --- | --- |
| `rsmbtv-sync-temperatures` | Read and write the six named temperature JSON files, daily observations, and ACIS cache |
| `rsmbtv-sync-tornadoes` | Read, write, and delete objects under `tornadoes/` |
| `rsmbtv-sync-ski-status` | Read and write conditions manifests, reports, forecasts, and history under `ski-status/`. |
| `rsmbtv-sync-ski-driving` | Read and write the manifest and report and camera snapshots under `ski-status/driving/`. |
| `rsmbtv-release` | Read Amplify app and job status. Start `release-preview` and `main` jobs. Write proofs under `release-validations/`. |

Each sync role can list the bucket prefixes in its policy. The temperature and tornado roles can invalidate the data CloudFront distribution.
CloudFront serves the data bucket. Both ski manifests use a 60-second cache lifetime.

The temperature and tornado workflows select OIDC when their role variable is non-empty.
The legacy authentication step runs when that variable is empty. The selected authentication step must succeed before upload.
The existing IAM user and secrets remain available during the transition.

## Deploy and switch

1. Configure the Terraform AWS profile. [Provider configuration](../infra/providers.tf)
2. Check ownership of existing mail records before you review the plan. [Mail state procedure](email-dns.md#adopt-existing-records)
3. Review the plan for the workflow roles, their policies, and any other pending infrastructure changes.
4. Apply the reviewed plan through the repository's infrastructure procedure.
5. Read the `github_data_sync_role_arns` Terraform output.
6. Set `AWS_TEMPERATURE_SYNC_ROLE_ARN` to the `temperatures` ARN in repository Actions variables.
7. Set `AWS_TORNADO_SYNC_ROLE_ARN` to the `tornadoes` ARN in repository Actions variables.
8. Run the temperature and tornado workflows from `main`.
9. Confirm that each workflow uses its OIDC step. Verify the data uploads and invalidations. Verify both temperature sync modes.
10. Remove legacy authentication and credentials only after those checks pass.

### Enable ski-status sync

1. Set `AWS_SKI_STATUS_SYNC_ROLE_ARN` to the `ski-status` ARN from the Terraform output.
2. Run **Sync Ski Status** from `main`.
3. Check `manifest.json`, its report and forecast files, and the history entry in the data bucket.
4. Run the workflow again.
5. Check the archived manifest in `previousManifest`.

[Ski-status publication](../projects/ski-status/readme.md#conditions-publication)

### Enable ski driving sync

1. Set `AWS_SKI_DRIVING_SYNC_ROLE_ARN` to the `ski-driving` ARN from the Terraform output.
2. To enable Utah data, set `UDOT_API_KEY` in repository Actions secrets.
3. Run **Sync Ski Driving** from `main`.
4. Open the manifest on the public data origin. [Public manifest](https://data.rsmb.tv/ski-status/driving/manifest.json)
5. Open a report and a camera snapshot from the manifest.
6. Check provider status and freshness in **Driving coverage** on the hosted map.

[Driving publication](../projects/ski-status/readme.md#publish-driving-feeds), [Sync workflow](../.github/workflows/sync-ski-driving.yml)

### Enable the release role

Set `AWS_RELEASE_ROLE_ARN` to the `github_release_role_arn` output. Set `AMPLIFY_APP_ID` in repository Actions variables. [Release procedure](release-validation.md#activation)

The release job uses OIDC. Its `RELEASE_VALIDATION_BUCKET` value selects the data bucket.
The job writes each successful proof to `release-validations/{full-commit-sha}/{normalized-preview-job-id}.json`.
Production reads the proof from the data origin. The proof authorizes one revision and preview job for 24 hours.

The release role and its repository variables became active on November 5, 2026.
The temperature and tornado workflows still support legacy keys during migration.

Store role ARNs in repository variables. Keep private access keys in repository secrets during migration.
Keep the existing account OIDC provider. Other repositories can depend on it.

## Local verification

Run the mocked Terraform suite to check role trust and object permissions.
Run the workflow tests to check authentication step selection and credential scope.
Verify token exchange and upload permissions with a run from `main`.
