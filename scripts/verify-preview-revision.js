import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDeploymentIdentity, assertValidationProof, assertReleaseURL, assertRevision, validationProofKey, VALIDATION_BASE_URL } from './release-proof.js';

/** Also runs inside the production build, closing a main-branch update race. */
export async function verifyPreviewRevision(baseURL, revision, fetchImpl = fetch, { validationBaseURL = process.env.RELEASE_VALIDATION_BASE_URL || VALIDATION_BASE_URL, now = Date.now() } = {}) {
    assertRevision(revision);
    const base = assertReleaseURL(baseURL, { originOnly: true });
    const url = new URL('/deployment.json', base);
    url.searchParams.set('candidate', revision);
    url.searchParams.set('t', String(Date.now()));
    const response = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Preview identity HTTP ${response.status}`);
    const deployment = await response.json();
    if (deployment.commitId !== revision || !deployment.jobId) throw new Error('Production revision has no matching deployed preview.');
    const jobId = assertDeploymentIdentity(deployment, revision);
    const validationBase = assertReleaseURL(validationBaseURL);
    if (!validationBase.pathname.endsWith('/')) validationBase.pathname += '/';
    const proofURL = new URL(validationProofKey(revision, jobId), validationBase);
    const proofResponse = await fetchImpl(proofURL, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!proofResponse.ok) throw new Error(`Preview validation proof HTTP ${proofResponse.status}`);
    assertValidationProof(await proofResponse.json(), { revision, jobId, previewOrigin: baseURL, now });
    return { revision, jobId };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const preview = process.env.RELEASE_PREVIEW_URL || (process.env.AWS_APP_ID ? `https://release-preview.${process.env.AWS_APP_ID}.amplifyapp.com` : undefined);
        await verifyPreviewRevision(preview, process.env.AWS_COMMIT_ID);
    }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
