#!/usr/bin/env node
// Builds the static site into _site/.
//
//   node scripts/build.mjs                    build (all themes side by side if config.defaultTheme is null)
//   node scripts/build.mjs --theme broadcast  build a single theme at the site root
//   node scripts/build.mjs --out dir          output directory (default _site)
//   node scripts/build.mjs --explicit-index   link to .../index.html (for hosts without directory indexes)
//   node scripts/build.mjs --allow-errors     build even if canon has rule violations

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PATHS } from './lib/config.mjs';
import { loadCanon, analyze } from './lib/canon.mjs';
import { buildSite, gh } from './lib/site.mjs';
import { renderMarkdown } from './lib/markdown.mjs';
import { writeFile, writeJSON, esc } from './lib/util.mjs';
import { ledgerMarkdown } from './lib/ledger.mjs';
import { C as shared } from '../site/components.mjs';
import { allPages, searchIndex } from '../site/pages.mjs';
import { hub as sharedHub } from '../site/hub.mjs';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const OUT = path.resolve(opt('--out') || PATHS.out);
const EXPLICIT = argv.includes('--explicit-index');

const canon = loadCanon();
const analysis = analyze(canon);
if (analysis.errors.length && !argv.includes('--allow-errors')) {
  console.error('Canon has rule violations; refusing to build. Run `npm run validate` (or pass --allow-errors).');
  for (const e of analysis.errors) console.error(`  - ${e.file}: ${e.message}`);
  process.exit(1);
}
const site = buildSite(canon, analysis);
const { config } = site;

const themeIds = opt('--theme') ? [opt('--theme')] : config.defaultTheme ? [config.defaultTheme] : config.themes;
const themes = [];
for (const id of themeIds) {
  const mod = await import(`../site/themes/${id}/theme.mjs`);
  themes.push(mod.default);
}
const preview = themes.length > 1;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const basePath = new URL(config.siteUrl).pathname.replace(/\/?$/, '/');

function fixFor(explicit) {
  return (p) => {
    if (!explicit) return p;
    let q = '';
    const k = p.search(/[?#]/);
    if (k >= 0) {
      q = p.slice(k);
      p = p.slice(0, k);
    }
    if (p === '' || p.endsWith('/')) p += 'index.html';
    return p + q;
  };
}

for (const theme of themes) {
  const themeOut = preview ? path.join(OUT, theme.id) : OUT;
  const components = { ...shared, hub: sharedHub, ...(theme.components || {}) };
  const pages = allPages(site);

  for (const page of pages) {
    const depth = page.file ? 0 : page.path.split('/').filter(Boolean).length;
    const root = page.absolute ? `${basePath}${preview ? `${theme.id}/` : ''}` : '../'.repeat(depth);
    const fix = fixFor(EXPLICIT && !page.absolute);
    const ctx = {
      site,
      theme,
      themes,
      preview,
      explicit: EXPLICIT,
      path: page.path,
      root,
      toRoot: preview ? root + '../' : root,
      fix,
      href: (p) => root + fix(p),
      gh: gh(config),
      c: null,
      page,
    };
    ctx.c = components;
    ctx.md = (md) =>
      renderMarkdown(md, {
        resolve: (t) => {
          const r = site.resolve(t);
          return r ? { ...r, href: ctx.href(r.path) } : null;
        },
        missing: (t) => ctx.href(`search/?q=${encodeURIComponent(t)}`),
      });
    const body = page.body(ctx);
    const html = theme.shell(ctx, page, body);
    const file = page.file ? path.join(themeOut, page.file) : path.join(themeOut, page.path, 'index.html');
    writeFile(file, html);
  }

  // assets
  const assets = path.join(themeOut, 'assets');
  fs.mkdirSync(assets, { recursive: true });
  for (const f of fs.readdirSync(path.join(PATHS.site, 'shared'))) fs.copyFileSync(path.join(PATHS.site, 'shared', f), path.join(assets, f));
  fs.writeFileSync(
    path.join(assets, 'theme.css'),
    fs.readFileSync(path.join(PATHS.site, 'base.css'), 'utf8') + '\n' + fs.readFileSync(path.join(PATHS.site, 'themes', theme.id, 'style.css'), 'utf8')
  );
  writeJSON(path.join(themeOut, 'data', 'index.json'), searchIndex(site));
  console.log(`  ✓ ${theme.name}: ${pages.length} pages → ${path.relative(ROOT, themeOut) || '.'}/`);
}

// root-level files
if (preview) {
  const { chooser } = await import('../site/chooser.mjs');
  writeFile(path.join(OUT, 'index.html'), chooser(site, themes, fixFor(EXPLICIT)));
  // GitHub Pages serves the root 404.html for every missing path.
  fs.copyFileSync(path.join(OUT, themes[0].id, '404.html'), path.join(OUT, '404.html'));
}
writeFile(path.join(OUT, '.nojekyll'), '');
writeJSON(path.join(OUT, 'ledger.json'), site.ledger);
writeFile(path.join(OUT, 'LEDGER.md'), ledgerMarkdown(site.ledger));
for (const f of ['llms.txt', 'AGENTS.md', 'SETTING.md']) {
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
}
console.log(`Built ${themes.length} theme(s) into ${path.relative(ROOT, OUT) || OUT}/${preview ? ' (style preview mode: choose one in bracket.config.json → "defaultTheme")' : ''}`);

export { esc };
