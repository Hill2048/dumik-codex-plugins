#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [
  reportArg,
  framesArg = 'frames',
  outputArg = 'assets/frame-downloads.js',
  prefixArg = 'pair_',
] = process.argv.slice(2);

if (!reportArg) {
  console.error('Usage: node build_frame_download_data.mjs <report-dir> [frames-subdir] [output-subpath] [filename-prefix]');
  process.exit(1);
}

const reportDir = path.resolve(reportArg);
const framesDir = path.resolve(reportDir, framesArg);
const outputFile = path.resolve(reportDir, outputArg);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

if (!fs.existsSync(framesDir) || !fs.statSync(framesDir).isDirectory()) {
  console.error(`Frames directory not found: ${framesDir}`);
  process.exit(1);
}

const files = fs.readdirSync(framesDir)
  .filter((name) => name.startsWith(prefixArg) && allowedExtensions.has(path.extname(name).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

if (files.length === 0) {
  console.error(`No supported images found in: ${framesDir}`);
  process.exit(1);
}

const browserData = {};
for (const name of files) {
  const key = path.posix.join(framesArg.replaceAll('\\', '/'), name);
  browserData[key] = fs.readFileSync(path.join(framesDir, name)).toString('base64');
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(
  outputFile,
  `window.frameDownloadData=${JSON.stringify(browserData)};\n`,
  'utf8',
);

console.log(JSON.stringify({ images: files.length, output: outputFile }));
