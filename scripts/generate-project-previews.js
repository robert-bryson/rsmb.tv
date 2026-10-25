import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { projects } from '../src/content/projects.ts';
import { writeAtomically } from './atomic-write.js';

const root = fileURLToPath(new URL('../', import.meta.url));

export async function generateProjectPreviews({ repoRoot = root, projectList = projects } = {}) {
    const imageRoot = await fs.realpath(path.join(repoRoot, 'public/images'));
    const directory = path.join(imageRoot, 'previews');
    const manifest = path.join(repoRoot, 'src/content/project-previews.json');
    await fs.mkdir(directory, { recursive: true });
    if ((await fs.lstat(directory)).isSymbolicLink()) {
        throw new Error('Project preview output directory must not be a symbolic link.');
    }
    const previews = {};
    const generated = new Set();
    for (const project of projectList.filter(project => project.previewImage)) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) throw new Error(`Invalid project slug: ${project.slug}`);
        const source = project.previewImage;
        if (typeof source !== 'string' || !source.startsWith('/images/') || /[?#\\]/.test(source)) {
            throw new Error(`Invalid project preview path: ${source}`);
        }
        const sourceFile = await fs.realpath(path.resolve(repoRoot, 'public', `.${source}`));
        if (!sourceFile.startsWith(`${imageRoot}${path.sep}`)) throw new Error(`Project preview must be inside public/images: ${source}`);
        if (sourceFile === directory || sourceFile.startsWith(`${directory}${path.sep}`)) {
            throw new Error(`Project preview source cannot be inside the generated directory: ${source}`);
        }
        const input = await fs.readFile(sourceFile);
        const { width, height } = await sharp(input).metadata();
        if (!width || !height) throw new Error(`Project preview has no image dimensions: ${source}`);
        const widths = [...new Set([480, 960, 1440].map(candidate => Math.min(candidate, width)))];
        const variants = [];
        for (const size of widths) {
            const output = await sharp(input).resize({ width: size, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toBuffer();
            const fingerprint = createHash('sha256').update(output).digest('hex').slice(0, 12);
            const filename = `${project.slug}-${size}-${fingerprint}.webp`;
            generated.add(filename);
            await writeAtomically(path.join(directory, filename), output);
            variants.push({ src: `/images/previews/${filename}`, width: size });
        }
        previews[source] = {
            src: variants.find(variant => variant.width >= 960)?.src ?? variants.at(-1).src,
            srcSet: variants.map(variant => `${variant.src} ${variant.width}w`).join(', '),
            width, height,
        };
    }
    // Publish references atomically before removing assets used by the previous manifest.
    await writeAtomically(manifest, `${JSON.stringify(previews, null, 2)}\n`);
    for (const filename of await fs.readdir(directory)) {
        if (/^[a-z0-9-]+-\d+-[a-f0-9]{12}\.webp$/.test(filename) && !generated.has(filename)) {
            await fs.unlink(path.join(directory, filename));
        }
    }
    return { files: generated.size, projects: Object.keys(previews).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await generateProjectPreviews();
    console.log(`Generated ${result.files} responsive previews for ${result.projects} projects.`);
}
