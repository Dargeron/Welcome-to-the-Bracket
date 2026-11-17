// Pieces every theme's page shell uses: <head>, scripts, nav model, footer.
import { esc } from '../scripts/lib/util.mjs';

export function head(ctx, page, { fonts = '', extra = '' } = {}) {
  const { config } = ctx.site;
  const title = page.path === '' ? page.title : `${page.title} · ${config.siteName}`;
  const canonical = config.siteUrl.replace(/\/?$/, '/') + (page.file || page.path);
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description || config.description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(page.description || config.description)}">
<meta property="og:type" content="website">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><path d='M10 4H5v24h5M22 4h5v24h-5' fill='none' stroke='%23ff8a1f' stroke-width='3'/><circle cx='16' cy='16' r='3' fill='%23ff8a1f'/></svg>`).replace(/%2523/g, '%23')}">
<link rel="alternate" type="application/json" title="Ledger" href="${ctx.toRoot}ledger.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<link rel="stylesheet" href="${ctx.root}assets/theme.css">
${extra}`;
}

export function scripts(ctx, page) {
  return page.bare && page.path === ''
    ? `<script src="${ctx.root}assets/trailer.js" defer></script>`
    : `<script src="${ctx.root}assets/app.js" defer></script>`;
}

export function bodyAttrs(ctx, page, cls = '') {
  return `class="${esc([`page-${(page.nav || 'none')}`, page.bare ? 'is-bare' : '', cls].filter(Boolean).join(' '))}" data-root="${esc(ctx.root)}"${ctx.explicit ? ' data-explicit' : ''}`;
}

export const NAV = [
  ['archive', 'Archive', 'archive/'],
  ['introduction', 'Introduction', 'introduction/'],
  ['encounters', 'Encounters', 'encounters/'],
  ['characters', 'Characters', 'characters/'],
  ['rounds', 'Rounds', 'rounds/'],
  ['sixteen', 'The Sixteen', 'sixteen/'],
  ['deprecated', 'Deprecated', 'deprecated/'],
  ['contribute', 'Contribute', 'contribute/'],
];

export function navLinks(ctx, page, { cls = '', items = NAV } = {}) {
  return items
    .map(([key, label, p]) => `<a class="${cls} ${page.nav === key ? 'on' : ''}" href="${ctx.href(p)}"${page.nav === key ? ' aria-current="page"' : ''}>${esc(label)}</a>`)
    .join('');
}

export function crumbs(ctx, page, sep = '/') {
  if (!page.crumbs) return '';
  return `<nav class="crumbs" aria-label="Breadcrumb"><a href="${ctx.href('archive/')}">Archive</a>${page.crumbs
    .map(([label, p]) => ` <span class="sep">${sep}</span> ${p ? `<a href="${ctx.href(p)}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`}`)
    .join('')}</nav>`;
}

export function footer(ctx) {
  const { config } = ctx.site;
  return `<p>${esc(config.siteName)} is an open, collaborative fiction archive. Characters belong to their creators; the rooms belong to whoever wrote them.</p>
  <p><a href="${ctx.href('introduction/')}">Introduction</a> · <a href="${ctx.href('contribute/')}">Contribute</a> · <a href="${ctx.href('founding-text/')}">Founding text</a> · <a href="${ctx.href('')}">Trailer</a> · <a href="${ctx.toRoot}ledger.json">ledger.json</a> · <a href="${ctx.toRoot}llms.txt">llms.txt</a> · <a href="${ctx.gh.repo}" rel="noopener">GitHub</a></p>`;
}
