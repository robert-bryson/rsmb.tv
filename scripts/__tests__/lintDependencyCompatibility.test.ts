// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

const require = createRequire(import.meta.url);
const eslintRequire = createRequire(require.resolve('eslint'));
const parserRequire = createRequire(createRequire(require.resolve('typescript-eslint')).resolve('@typescript-eslint/parser'));
const { clearCaches } = parserRequire('@typescript-eslint/typescript-estree') as { clearCaches: () => void };
const consumers = [
    { name: 'eslint', modulePath: require.resolve('eslint') },
    { name: '@eslint/config-array', modulePath: eslintRequire.resolve('@eslint/config-array') },
    { name: '@typescript-eslint/typescript-estree', modulePath: parserRequire.resolve('@typescript-eslint/typescript-estree') },
];
let directory: string;

beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-lint-compat-')); });
afterEach(async () => {
    clearCaches();
    await fs.rm(directory, { recursive: true, force: true });
});

async function write(relative: string, content: string) {
    const filename = path.join(directory, relative);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, content);
    return filename;
}

describe('lint toolchain dependency compatibility', () => {
    it.each(consumers)(
        '$name rejects optimization-level-two pattern expansion beyond the limit', ({ modulePath }) => {
            const consumerRequire = createRequire(modulePath);
            const { Minimatch } = consumerRequire('minimatch') as {
                Minimatch: new (pattern: string, options: { optimizationLevel: number; braceExpandMax: number }) => { set: unknown[] };
            };
            const pattern = Array.from({ length: 8 }, () => '**/../segment/leaf').join('/');
            expect(() => new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 16 }))
                .toThrow('optimizationLevel 2: too many patterns');
        },
    );

    it('discovers nested JS, TS, and TSX files while respecting recursive and dot-directory ignores', async () => {
        await write('src/main.js', 'unknownName();\n');
        await write('src/nested/data.ts', 'export const value: number = 1;\n');
        await write('src/nested/widget.tsx', 'export const Widget = () => <div />;\n');
        await write('src/.generated/ignored.ts', 'invalid TypeScript !!');
        await write('coverage/ignored.js', 'invalid JavaScript !!');
        await write('src/nested/excluded.test.ts', 'invalid TypeScript !!');
        const eslint = new ESLint({
            cwd: directory, overrideConfigFile: true,
            overrideConfig: [
                { ignores: ['**/.generated/**', '**/coverage/**', '**/*.test.ts'] },
                { files: ['**/*.{js,ts,tsx}'], languageOptions: { parser: tseslint.parser }, rules: { 'no-undef': 'error' } },
            ],
        });
        const results = await eslint.lintFiles(['**/*.{js,ts,tsx}']);
        expect(results.map(result => path.relative(directory, result.filePath).split(path.sep).join('/')).sort()).toEqual([
            'src/main.js', 'src/nested/data.ts', 'src/nested/widget.tsx',
        ]);
        expect(results.flatMap(result => result.messages.map(message => message.ruleId))).toEqual(['no-undef']);
    });

    it.each(['build.config.ts', '.build.config.ts'])(
        'matches allowDefaultProject patterns for %s through the TypeScript project service', async filename => {
            await write('tsconfig.json', JSON.stringify({ include: ['src/**/*.ts'] }));
            await write('src/included.ts', 'export const value = 1;\n');
            const source = 'export const config: number = 1;\n';
            const filePath = await write(filename, source);
            const parsed = tseslint.parser.parseForESLint(source, {
                filePath, tsconfigRootDir: directory, projectService: { allowDefaultProject: ['*.ts'] },
            });
            expect(parsed.services.program?.getSourceFile(filePath)).toBeDefined();
            const nested = await write('nested/outside.ts', source);
            expect(() => tseslint.parser.parseForESLint(source, {
                filePath: nested, tsconfigRootDir: directory, projectService: { allowDefaultProject: ['*.ts'] },
            })).toThrow(/not found by the project service/);
        },
    );
});
