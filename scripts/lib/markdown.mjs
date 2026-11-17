// Markdown → HTML, with [[wiki links]] and no raw HTML (entries come from the
// public, so anything that looks like a tag is shown as text).

import { Marked } from 'marked';
import { esc, slugify } from './util.mjs';

export const WIKILINK_RE = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g;

/** Every [[target]] mentioned in a markdown string. */
export function wikiTargets(md) {
  const out = [];
  for (const m of String(md || '').matchAll(WIKILINK_RE)) out.push(m[1].trim());
  return out;
}

/**
 * @param {string} md
 * @param {object} opts
 * @param {(target:string)=>({href:string,type:string,title?:string}|null)} opts.resolve
 * @param {(target:string)=>string} opts.missing  href for a link with no page yet
 */
export function renderMarkdown(md, { resolve, missing }) {
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading(token) {
        let text = this.parser.parseInline(token.tokens);
        let id;
        const m = /\s*\{#([\w-]+)\}\s*$/.exec(text);
        if (m) {
          id = m[1];
          text = text.slice(0, m.index);
        } else id = slugify(token.text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a));
        return `<h${token.depth} id="${esc(id)}">${text}</h${token.depth}>\n`;
      },
      html(token) {
        return esc(typeof token === 'string' ? token : token.raw ?? token.text ?? '');
      },
      link(token) {
        const href = String(token.href || '');
        if (/^\s*javascript:/i.test(href)) return esc(token.text);
        const ext = /^https?:\/\//i.test(href);
        const inner = this.parser.parseInline(token.tokens);
        return `<a href="${esc(href)}"${token.title ? ` title="${esc(token.title)}"` : ''}${ext ? ' rel="noopener" target="_blank"' : ''}>${inner}</a>`;
      },
      image(token) {
        // Images are allowed only over https, and are shown as plain figures.
        const href = String(token.href || '');
        if (!/^https:\/\//i.test(href)) return esc(token.text);
        return `<img src="${esc(href)}" alt="${esc(token.text)}" loading="lazy">`;
      },
    },
    extensions: [
      {
        name: 'wikilink',
        level: 'inline',
        start(src) {
          const i = src.indexOf('[[');
          return i < 0 ? undefined : i;
        },
        tokenizer(src) {
          const m = /^\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/.exec(src);
          if (m) return { type: 'wikilink', raw: m[0], target: m[1].trim(), label: (m[2] ?? m[1]).trim() };
          return undefined;
        },
        renderer(t) {
          const r = resolve(t.target);
          if (r) {
            return `<a class="wl wl-${r.type}" href="${esc(r.href)}"${r.title ? ` title="${esc(r.title)}"` : ''}>${esc(t.label)}</a>`;
          }
          return `<a class="wl wl-missing" href="${esc(missing(t.target))}" title="No entry yet: ${esc(t.target)}">${esc(t.label)}</a>`;
        },
      },
    ],
  });
  return marked.parse(String(md || ''));
}

/** Plain text excerpt for previews and meta descriptions. */
export function excerpt(md, n = 200) {
  const text = String(md || '')
    .replace(WIKILINK_RE, (_, t, l) => l || t)
    .replace(/^#+\s.*$/gm, '')
    .replace(/[*_`>#]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^---$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > n ? text.slice(0, n).replace(/\s+\S*$/, '') + '…' : text;
}
