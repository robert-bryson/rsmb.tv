import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const VALIDATION_BASE_URL = 'https://data.rsmb.tv/release-validations/';
const MAX_PROOF_AGE_MS = 24 * 60 * 60 * 1000;
export const RELEASE_ROUTES = ['/', '/about', '/posts', '/projects', '/projects/flights/map?stats=0', '/projects/temperature-records/map', '/projects/temperature-records/map?view=state', '/projects/temperature-records/map?view=county', '/projects/tornado-tracks/map'];

export function assertReleaseURL(value, { originOnly = false } = {}) {
    const url = new URL(value);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
        || url.username || url.password || url.search || url.hash || (originOnly && url.pathname !== '/')) throw new Error('Use an HTTPS release URL (HTTP loopback is allowed for tests).');
    return url;
}

export function normalizeJobId(value) {
    const text = String(value);
    if (!text.length || text.length > 32 || /\D/.test(text)) throw new Error('Invalid Amplify job ID.');
    return text.replace(/^0+(?=\d)/, '');
}

export function assertRevision(revision) {
    if (typeof revision !== 'string' || revision.length !== 40 || /[^a-f0-9]/.test(revision)) throw new Error('Expected a complete Git revision.');
}

export function assertDeploymentIdentity(deployment, revision, jobId) {
    assertRevision(revision);
    if (deployment?.commitId !== revision || !deployment?.jobId) throw new Error(`Deployed revision does not match ${revision}.`);
    const deployedJobId = normalizeJobId(deployment.jobId);
    if (jobId !== undefined && deployedJobId !== normalizeJobId(jobId)) throw new Error('Preview is serving an older build of this revision.');
    return deployedJobId;
}

export function validationProofKey(revision, jobId) {
    assertRevision(revision);
    return `${revision}/${normalizeJobId(jobId)}.json`;
}

export function createValidationProof(report, jobId, now = Date.now()) {
    assertRevision(report?.revision);
    if (!Array.isArray(report.errors) || report.errors.length || !Array.isArray(report.routes) || report.routes.length !== RELEASE_ROUTES.length
        || RELEASE_ROUTES.some(route => !report.routes.includes(route))
        || !Number.isSafeInteger(report.images) || report.images < 1) throw new Error('A successful validation report is required.');
    return {
        version: 1, status: 'passed', revision: report.revision, previewJobId: normalizeJobId(jobId),
        previewOrigin: assertReleaseURL(report.baseURL, { originOnly: true }).origin, validatedAt: new Date(now).toISOString(),
        reportSha256: createHash('sha256').update(JSON.stringify(report)).digest('hex'),
    };
}

export function assertValidationProof(proof, { revision, jobId, previewOrigin, now = Date.now() }) {
    assertRevision(revision);
    const validatedAt = Date.parse(proof?.validatedAt);
    if (proof?.version !== 1 || proof.status !== 'passed' || proof.revision !== revision
        || normalizeJobId(proof.previewJobId) !== normalizeJobId(jobId) || proof.previewOrigin !== assertReleaseURL(previewOrigin, { originOnly: true }).origin
        || typeof proof.reportSha256 !== 'string' || proof.reportSha256.length !== 64 || /[^a-f0-9]/.test(proof.reportSha256) || !Number.isFinite(validatedAt)
        || validatedAt > now + 60_000 || now - validatedAt > MAX_PROOF_AGE_MS) {
        throw new Error('Preview has no current matching validation proof.');
    }
}

export async function publishValidationProof({ bucket, proof, execFile = execFileSync }) {
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket ?? '')) throw new Error('Set RELEASE_VALIDATION_BUCKET before releasing.');
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-release-proof-'));
    try {
        const filename = path.join(directory, 'validation.json');
        await fs.writeFile(filename, JSON.stringify(proof) + '\n', { flag: 'wx' });
        execFile('aws', ['s3api', 'put-object', '--bucket', bucket, '--key', `release-validations/${validationProofKey(proof.revision, proof.previewJobId)}`,
            '--body', filename, '--content-type', 'application/json', '--cache-control', 'public, max-age=86400, immutable'], { stdio: 'ignore' });
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
}
