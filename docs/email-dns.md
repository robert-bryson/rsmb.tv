# Email DNS

Google Workspace sends and receives mail for `@rsmb.tv`.
Route 53 hosts the DNS zone.
[mail.tf](../infra/mail.tf) defines the mail authentication records.

## Records

| Record | Value or purpose | Owner |
| --- | --- | --- |
| MX at `rsmb.tv` | `1 smtp.google.com.` receives mail through Google | Outside Terraform |
| SPF TXT at `rsmb.tv` | `v=spf1 include:_spf.google.com ~all` authorizes Google senders | Terraform |
| DKIM TXT at `google._domainkey.rsmb.tv` | Google's domain-specific 2048-bit RSA public key | Terraform |
| DMARC TXT at `_dmarc.rsmb.tv` | `v=DMARC1; p=none; rua=mailto:robby@rsmb.tv` requests aggregate reports | Terraform |

SPF identifies permitted sending servers.
DKIM adds a signature that receivers can verify with the public key.
DMARC checks whether a passing SPF or DKIM identity aligns with the visible From domain.
It does not require both methods to pass.

The SPF `~all` result is a soft fail. It does not request rejection.
The DMARC `p=none` policy requests monitoring, not quarantine or rejection.
Review reports before you change that policy.
Verify every legitimate sender before you enable enforcement.

## Run offline checks

Use Terraform within the version range in [providers.tf](../infra/providers.tf).
CI uses Terraform 1.16.6 and the locked AWS provider.

```bash
terraform -chdir=infra init -backend=false -input=false -lockfile=readonly
terraform -chdir=infra fmt -check mail.tf tests/mail.tftest.hcl
terraform -chdir=infra validate -no-color
terraform -chdir=infra test -no-color -filter=tests/mail.tftest.hcl
npx vitest run scripts/__tests__/mailDns.test.ts
```

These commands do not apply infrastructure changes.
The test uses a mocked AWS provider. It needs no AWS credentials or remote state.
The test targets only the three mail records and their zone dependency.
The resulting targeting warning is expected. Do not use that test plan for deployment.

Assertions check record names, types, TTLs, SPF policy, and DMARC reporting.
They also check the DKIM value format and TXT string lengths.
The Vitest checks parse the public key and verify its RSA type and 2048-bit modulus.
They require the repository's Node dependencies.
They do not confirm Terraform ownership, Google signing, or mail delivery.

## Adopt existing records

The three authentication records already existed in public DNS on 2026-10-20.
DNS results do not show whether Terraform already manages a record.
Do not add `allow_overwrite` to bypass an ownership conflict.

1. Configure the `rsmbtv-admin` AWS profile required by [providers.tf](../infra/providers.tf).
2. Initialize the configured remote backend.
3. List the resource addresses in Terraform state.

```bash
terraform -chdir=infra init -input=false -lockfile=readonly
terraform -chdir=infra state list
```

4. Check for `aws_route53_record.mail_spf`, `aws_route53_record.mail_dkim`, and `aws_route53_record.mail_dmarc`.
5. Identify the hosted zone ID for `rsmb.tv`.
6. Import each existing record whose resource address is absent from state.

Replace `ZONEID` with that hosted zone ID.
Run only the imports that are necessary.
Import changes Terraform state. It does not change the DNS record.

```bash
terraform -chdir=infra import aws_route53_record.mail_spf ZONEID_rsmb.tv_TXT
terraform -chdir=infra import aws_route53_record.mail_dkim ZONEID_google._domainkey.rsmb.tv_TXT
terraform -chdir=infra import aws_route53_record.mail_dmarc ZONEID__dmarc.rsmb.tv_TXT
```

7. Run `terraform -chdir=infra plan`.
8. Compare the plan with the current DNS values.
9. Resolve unexpected changes before you apply the plan.

If a record belongs to another Terraform state, coordinate its transfer before import.
Keep one owner for each record.
If a record does not exist, review its proposed creation instead of importing it.
Do not import or replace the MX record as part of this procedure.

## Enable and verify signing

Publishing the DKIM key does not enable Gmail signing.
Google retains the private key. Store only the public key in this repository.

1. Open **Google Admin > Apps > Google Workspace > Gmail > Authenticate email**.
2. Select `rsmb.tv`.
3. Compare the public key with the published DNS record.
4. Select **Start authentication** after the DNS record is available.
5. Send a message from `@rsmb.tv` to an external mailbox.
6. Inspect the receiver's `Authentication-Results` header.

Expect `spf=pass`, `dkim=pass` with `header.d=rsmb.tv`, and `dmarc=pass`.
Use the header added by the receiving mail service, not an untrusted header supplied by the sender.
DNS results alone cannot confirm active signing.

Add future sending services to the authentication configuration before they send mail.
Verify their domain alignment before you enable DMARC enforcement.

## Rotate the DKIM key

1. Generate or obtain the replacement public key in Google Admin.
2. Use the selector and record name supplied by Google.
3. Update [mail.tf](../infra/mail.tf) with that public key.
4. Run the offline checks.
5. Review and apply the DNS change.
6. Wait for the replacement DNS value to become available.
7. Activate the matching key in Google Admin.
8. Repeat the external delivery check.

Route 53 limits each TXT string to 255 bytes.
Split a longer value into adjacent quoted strings within one record.
In the Terraform value, `\"\"` separates the strings. The provider supplies the outer quotes.
Do not create separate TXT records for the key fragments.
The checked-in key belongs to `rsmb.tv`. A domain change requires the matching Google Admin key.

## Optional transport policies

MTA-STS and TLS reporting are not configured.
An enforcing MTA-STS policy requires a working HTTPS policy endpoint.
Do not enable it through DNS records alone.
