import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** URL/file-safe slug. Keeps letters from any script so non-Latin names still work. */
export function slugify(s) {
  const slug = String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'unnamed';
}

/** Normalised key used to match names and aliases case-insensitively. */
export function nameKey(s) {
  return slugify(s);
}

export function parseFrontMatter(text, file = '(input)') {
  const src = String(text).replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src);
  if (!m) return { data: {}, body: src, hasFrontMatter: false };
  let data;
  try {
    data = yaml.load(m[1]) || {};
  } catch (e) {
    throw new Error(`${file}: front matter is not valid YAML: ${e.message.split('\n')[0]}`);
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${file}: front matter must be a YAML mapping.`);
  }
  return { data, body: m[2].replace(/^\n+/, ''), hasFrontMatter: true };
}

export function stringifyFrontMatter(data, body) {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const fm = yaml.dump(clean, { lineWidth: 100, noRefs: true, quotingType: '"' });
  return `---\n${fm}---\n\n${String(body).trim()}\n`;
}

export function readDir(dir, ext = '.md') {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(ext) && !f.startsWith('_') && f.toLowerCase() !== 'readme.md')
    .sort()
    .map((f) => path.join(dir, f));
}

export function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export function wordCount(md) {
  return String(md || '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/[#>*_`~\-\[\]()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function pad(n, w = 4) {
  return String(n).padStart(w, '0');
}

export function fmtInt(n) {
  return Number(n).toLocaleString('en-US');
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** "Rounds 2–5, 7, 9–16" */
export function rangeList(nums) {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(i === j ? `${s[i]}` : `${s[i]}–${s[j]}`);
    i = j;
  }
  return parts.join(', ');
}
