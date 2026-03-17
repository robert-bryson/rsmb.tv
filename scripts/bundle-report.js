/**
 * Reports bundle sizes after a Vite build.
 * Run: node scripts/bundle-report.js
 */

import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist', 'assets');

if (!fs.existsSync(distDir)) {
    console.error('❌ dist/assets not found — run `npm run build` first.');
    process.exit(1);
}

const files = fs.readdirSync(distDir)
    .map(name => {
        const filePath = path.join(distDir, name);
        const { size } = fs.statSync(filePath);
        return { name, size };
    })
    .sort((a, b) => b.size - a.size);

const jsFiles = files.filter(f => f.name.endsWith('.js'));
const cssFiles = files.filter(f => f.name.endsWith('.css'));

function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(2)} KB`;
}

function printSection(label, items) {
    if (items.length === 0) return;
    console.log(`\n${label}:`);
    const total = items.reduce((sum, f) => sum + f.size, 0);
    items.forEach(f => {
        const bar = '█'.repeat(Math.max(1, Math.round(f.size / total * 30)));
        console.log(`  ${f.name.padEnd(40)} ${formatSize(f.size).padStart(10)}  ${bar}`);
    });
    console.log(`  ${'Total'.padEnd(40)} ${formatSize(total).padStart(10)}`);
}

console.log('📦 Bundle Report');
console.log('─'.repeat(60));
printSection('JavaScript', jsFiles);
printSection('CSS', cssFiles);
