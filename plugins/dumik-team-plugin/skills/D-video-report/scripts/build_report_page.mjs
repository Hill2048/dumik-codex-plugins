#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [reportArg, dataArg] = process.argv.slice(2);

if (!reportArg || !dataArg) {
  console.error('Usage: node build_report_page.mjs <report-dir> <report-data.json>');
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(scriptDir, '..', 'assets', 'report-template');
const reportDir = path.resolve(reportArg);
const dataFile = path.resolve(dataArg);

if (!fs.existsSync(templateDir)) {
  console.error(`Report template not found: ${templateDir}`);
  process.exit(1);
}
if (!fs.existsSync(dataFile)) {
  console.error(`Report data not found: ${dataFile}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
} catch (error) {
  console.error(`Invalid report JSON: ${error.message}`);
  process.exit(1);
}

const errors = [];
if (!data.title || typeof data.title !== 'string') errors.push('title must be a non-empty string');
if (!Array.isArray(data.shots)) errors.push('shots must be an array');

const shotIds = new Set();
for (const [index, shot] of (data.shots || []).entries()) {
  if (!shot.id || typeof shot.id !== 'string') errors.push(`shots[${index}].id is required`);
  if (shotIds.has(shot.id)) errors.push(`duplicate shot id: ${shot.id}`);
  shotIds.add(shot.id);
  if (!Number.isFinite(Number(shot.start))) errors.push(`shots[${index}].start must be a number`);
  if (!Array.isArray(shot.frames)) errors.push(`shots[${index}].frames must be an array`);
  for (const [frameIndex, frame] of (shot.frames || []).entries()) {
    if (!frame.src) errors.push(`shots[${index}].frames[${frameIndex}].src is required`);
  }
}

if (errors.length) {
  console.error(`Report data validation failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

fs.mkdirSync(reportDir, { recursive: true });
fs.cpSync(templateDir, reportDir, { recursive: true, force: true });

const safeJson = JSON.stringify(data).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const outputData = path.join(reportDir, 'assets', 'report-data.js');
fs.mkdirSync(path.dirname(outputData), { recursive: true });
fs.writeFileSync(outputData, `window.videoReportData=${safeJson};\n`, 'utf8');

console.log(JSON.stringify({
  report: path.join(reportDir, 'index.html'),
  shots: data.shots.length,
  transcriptRows: Array.isArray(data.transcript) ? data.transcript.length : 0,
}));
