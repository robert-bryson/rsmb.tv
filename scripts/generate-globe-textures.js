import sharp from 'sharp';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../public/basemaps/', import.meta.url));
for (const name of ['earth-night', 'earth-topology']) {
    const data = await sharp(path.join(directory, `${name}.webp`)).resize({ width: 1536 }).webp({ quality: 80 }).toBuffer();
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 12);
    const filename = `${name}-1536-${hash}.webp`;
    await fs.writeFile(path.join(directory, filename), data);
    console.log(`${filename}: ${data.length} bytes. Use this path in the Night basemap configuration.`);
}
