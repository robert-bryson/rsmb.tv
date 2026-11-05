// @vitest-environment node
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { assertDeploymentIdentity, assertReleaseURL, assertRevision, assertValidationProof, createValidationProof, normalizeJobId, publishValidationProof, RELEASE_ROUTES, validationProofKey } from '../release-proof.js';
import { verifyPreviewRevision } from '../verify-preview-revision.js';
import { releaseAmplify, waitForBuild } from '../release-amplify.js';

const revision = 'a'.repeat(40);
const baseURL = 'https://release-preview.example.amplifyapp.com';
const now = Date.parse('2026-11-05T12:00:00Z');
const report = () => ({ revision, baseURL, routes: [...RELEASE_ROUTES], images: 58, errors: [] });
const proof = () => createValidationProof(report(), '0001', now);

describe('release validation proofs', () => {
    it('normalizes job IDs and rejects malformed identities', () => {
        expect(normalizeJobId('00000012')).toBe('12');
        expect(validationProofKey(revision, '0001')).toBe(`${revision}/1.json`);
        for (const invalid of ['', '1/2', '1\n', undefined, '-1', '1'.repeat(33)]) expect(() => normalizeJobId(invalid)).toThrow('job ID');
        for (const invalid of [undefined, 'a'.repeat(39), `${revision}\n`, 'G'.repeat(40)]) expect(() => assertRevision(invalid)).toThrow('revision');
        expect(() => assertDeploymentIdentity({ commitId: revision, jobId: 'oops' }, revision)).toThrow('job ID');
    });
    it('requires a complete successful browser report', () => {
        const value = proof();
        expect(value).toMatchObject({ version: 1, status: 'passed', revision, previewJobId: '1', previewOrigin: baseURL });
        expect(value.reportSha256).toMatch(/^[a-f0-9]{64}$/);
        for (const bad of [{ ...report(), errors: ['error'] }, { ...report(), routes: ['/'] }, { ...report(), routes: Array(9).fill('/') }, { ...report(), images: 0 }]) {
            expect(() => createValidationProof(bad, '1', now)).toThrow('successful validation');
        }
    });
    it('binds a proof to revision, job, origin, report digest, and a bounded age', () => {
        const options = { revision, jobId: '1', previewOrigin: baseURL, now };
        expect(() => assertValidationProof(proof(), options)).not.toThrow();
        for (const patch of [{ version: 2 }, { status: 'failed' }, { revision: 'b'.repeat(40) }, { previewJobId: '2' }, { previewOrigin: 'https://other.example' }, { reportSha256: 'x'.repeat(64) }, { validatedAt: 'not a date' }, { validatedAt: new Date(now - 86_400_001).toISOString() }, { validatedAt: new Date(now + 60_001).toISOString() }]) {
            expect(() => assertValidationProof({ ...proof(), ...patch }, options)).toThrow('validation proof');
        }
    });
    it.each(['http://preview.example', 'ftp://127.0.0.1', 'https://user:pass@preview.example', 'https://preview.example/?token=x', 'https://preview.example/#x'])('rejects unsafe release URLs: %s', url => {
        expect(() => assertReleaseURL(url)).toThrow('HTTPS');
    });
    it('permits HTTPS paths for proof roots and HTTP loopback fixtures', () => {
        expect(assertReleaseURL('http://127.0.0.1:1234').origin).toBe('http://127.0.0.1:1234');
        expect(assertReleaseURL('https://data.example/release-validations/').pathname).toBe('/release-validations/');
        expect(() => assertReleaseURL('https://example/path', { originOnly: true })).toThrow('HTTPS');
    });
    it('publishes only the proof prefix and removes the temporary file', async () => {
        let body = '';
        const execFile = vi.fn((_command: string, args: string[]) => {
            expect(args.slice(0, 6)).toEqual(['s3api', 'put-object', '--bucket', 'rsmbtv-temperature-data', '--key', `release-validations/${revision}/1.json`]);
            body = args[args.indexOf('--body') + 1];
            expect(JSON.parse(readFileSync(body, 'utf8'))).toEqual(proof());
        });
        await publishValidationProof({ bucket: 'rsmbtv-temperature-data', proof: proof(), execFile });
        expect(execFile).toHaveBeenCalledOnce();
        expect(existsSync(body)).toBe(false);
        await expect(publishValidationProof({ bucket: '', proof: proof(), execFile })).rejects.toThrow('RELEASE_VALIDATION_BUCKET');
    });
    it('removes temporary proof files after a failed upload', async () => {
        let body = '';
        await expect(publishValidationProof({ bucket: 'rsmbtv-temperature-data', proof: proof(), execFile: (_command: string, args: string[]) => {
            body = args[args.indexOf('--body') + 1];
            throw new Error('upload failed');
        } })).rejects.toThrow('upload failed');
        expect(existsSync(body)).toBe(false);
    });
    it('the production guard requires the exact deployed job proof', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ commitId: revision, jobId: '00001' })))
            .mockResolvedValueOnce(new Response(JSON.stringify(proof())));
        await expect(verifyPreviewRevision(baseURL, revision, fetchImpl, { now, validationBaseURL: 'https://data.example/proofs' })).resolves.toEqual({ revision, jobId: '1' });
        expect(String(fetchImpl.mock.calls[1][0])).toBe(`https://data.example/proofs/${revision}/1.json`);
        const mismatch = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ commitId: revision, jobId: '2' })))
            .mockResolvedValueOnce(new Response(JSON.stringify(proof())));
        await expect(verifyPreviewRevision(baseURL, revision, mismatch, { now })).rejects.toThrow('validation proof');
    });
});

describe('release orchestration', () => {
    function fixture() {
        const events: string[] = [];
        const client = { send: vi.fn(async (command) => {
            const branch = command.input.branchName;
            events.push(branch ?? 'app');
            return branch ? { jobSummary: { jobId: branch === 'main' ? '2' : '1' } } : { app: { defaultDomain: 'example.amplifyapp.com' } };
        }) };
        return { events, options: { client, appId: 'app', revision, wait: vi.fn(async () => { events.push('wait'); }), validate: vi.fn(async () => { events.push('validate'); return report(); }), publishProof: vi.fn(async () => { events.push('publish'); }), verifyProof: vi.fn(async () => { events.push('verify'); }), readMainRevision: vi.fn(() => { events.push('main-head'); return revision; }) } };
    }
    it('requires successful validation and published proof before production starts', async () => {
        const { events, options } = fixture();
        await expect(releaseAmplify(options)).resolves.toEqual({ revision, previewJobId: '1', productionJobId: '2' });
        expect(events).toEqual(['app', 'release-preview', 'wait', 'validate', 'publish', 'verify', 'main-head', 'main', 'wait']);
    });
    it('rejects malformed input before calling AWS', async () => {
        const { options } = fixture();
        await expect(releaseAmplify({ ...options, revision: `${revision}\n` })).rejects.toThrow('revision');
        await expect(releaseAmplify({ ...options, appId: '' })).rejects.toThrow('AMPLIFY_APP_ID');
        expect(options.client.send).not.toHaveBeenCalled();
    });
    it.each(['publishProof', 'verifyProof'] as const)('does not release when %s fails', async method => {
        const { events, options } = fixture();
        options[method].mockRejectedValue(new Error('proof failure'));
        await expect(releaseAmplify(options)).rejects.toThrow('proof failure');
        expect(events).not.toContain('main');
    });
    it('blocks a concurrent main revision change', async () => {
        const { events, options } = fixture();
        options.readMainRevision.mockReturnValue('b'.repeat(40));
        await expect(releaseAmplify(options)).rejects.toThrow('Main changed');
        expect(events).not.toContain('main');
    });
    it.each(['FAILED', 'CANCELLED'])('blocks terminal preview status %s', async status => {
        const client = { send: vi.fn().mockResolvedValue({ job: { summary: { commitId: revision, status } } }) };
        await expect(waitForBuild(client, 'app', 'release-preview', '1', revision)).rejects.toThrow(status);
    });
});
