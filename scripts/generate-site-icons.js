import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** Derive browser icons from the existing site artwork. */
export async function generateSiteIcons({
    sourcePath = fileURLToPath(new URL('../public/apple-touch-icon.svg', import.meta.url)),
    outputDir = fileURLToPath(new URL('../public/', import.meta.url)),
} = {}) {
    fs.mkdirSync(outputDir, { recursive: true });
    const icons = [[48, 'favicon-48.png'], [192, 'icon-192.png'], [512, 'icon-512.png']];
    await Promise.all(icons.map(([size, name]) => sharp(sourcePath, { density: 384 })
        .resize(size, size).flatten({ background: '#0a0a0a' }).png().toFile(path.join(outputDir, name))));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await generateSiteIcons();
}
