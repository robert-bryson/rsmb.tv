import { AmplifyClient, GetAppCommand, GetJobCommand, StartJobCommand } from '@aws-sdk/client-amplify';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReleasePreview } from './validate-release-preview.js';
import { assertRevision, createValidationProof, publishValidationProof } from './release-proof.js';
import { verifyPreviewRevision } from './verify-preview-revision.js';

export async function waitForBuild(client, appId, branchName, jobId, revision, { sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 180 } = {}) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const { job } = await client.send(new GetJobCommand({ appId, branchName, jobId }));
        const summary = job?.summary;
        if (summary?.commitId !== revision) throw new Error(`${branchName} built a different revision.`);
        if (summary.status === 'SUCCEED') return summary;
        if (['FAILED', 'CANCELLED'].includes(summary.status)) throw new Error(`${branchName} build ${summary.status}`);
        await sleep(10_000);
    }
    throw new Error(`${branchName} build timed out.`);
}

/** Production cannot start until the deployed preview of this revision passes. */
export async function releaseAmplify({ client, appId, revision, validate = validateReleasePreview, wait = waitForBuild, outputPath = 'release-validation.json',
    publishProof = proof => publishValidationProof({ bucket: process.env.RELEASE_VALIDATION_BUCKET, proof }),
    verifyProof = verifyPreviewRevision, readMainRevision = () => execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], { encoding: 'utf8' }).split(/\s+/)[0],
}) {
    if (!appId) throw new Error('AMPLIFY_APP_ID is required.');
    assertRevision(revision);
    const previewBranch = 'release-preview';
    const { app } = await client.send(new GetAppCommand({ appId }));
    const preview = await client.send(new StartJobCommand({ appId, branchName: previewBranch, jobType: 'RELEASE', commitId: revision }));
    await wait(client, appId, previewBranch, preview.jobSummary.jobId, revision);
    const previewOrigin = `https://${previewBranch}.${app.defaultDomain}`;
    const report = await validate({ baseURL: previewOrigin, revision, jobId: preview.jobSummary.jobId, outputPath });
    await publishProof(createValidationProof(report, preview.jobSummary.jobId));
    await verifyProof(previewOrigin, revision);
    // A newer main commit must receive its own preview validation.
    const main = await readMainRevision();
    if (main !== revision) throw new Error('Main changed during preview validation; release the newer revision through a fresh run.');
    const production = await client.send(new StartJobCommand({ appId, branchName: 'main', jobType: 'RELEASE', commitId: revision }));
    await wait(client, appId, 'main', production.jobSummary.jobId, revision);
    return { revision, previewJobId: preview.jobSummary.jobId, productionJobId: production.jobSummary.jobId };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        console.log(await releaseAmplify({ client: new AmplifyClient({ region: process.env.AWS_REGION ?? 'us-east-1' }), appId: process.env.AMPLIFY_APP_ID, revision: process.env.RELEASE_REVISION }));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
