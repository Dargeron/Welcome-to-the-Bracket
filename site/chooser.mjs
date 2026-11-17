// Root page while all three styles are being previewed side by side.
import { esc } from '../scripts/lib/util.mjs';

export function chooser(site, themes, fix) {
  const { config } = site;
  const sample = site.encounters[site.encounters.length - 2] || site.encounters[0];
  const sampleChar = site.characters.get('frieren') || [...site.characters.values()][0];
  const card = (t) => `<article class="ch-card ch-${t.id}">
    <div class="ch-mock" aria-hidden="true">${t.mock || ''}</div>
    <div class="ch-body">
      <h2>${esc(t.name)}</h2>
      <p class="ch-tag">${esc(t.tagline)}</p>
      <p>${esc(t.blurb)}</p>
      <ul class="ch-links">
        <li><a href="${t.id}/${fix('')}">Trailer</a></li>
        <li><a href="${t.id}/${fix('introduction/')}">Introduction</a></li>
        <li><a href="${t.id}/${fix('archive/')}">Archive</a></li>
        ${sample ? `<li><a href="${t.id}/${fix(sample.path)}">An encounter</a></li>` : ''}
        ${sampleChar ? `<li><a href="${t.id}/${fix(sampleChar.path)}">A character</a></li>` : ''}
      </ul>
    </div>
  </article>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Choose a style · ${esc(config.siteName)}</title>
<meta name="description" content="Three candidate designs for ${esc(config.siteName)}.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<style>
:root{--bg:#f3f1ec;--ink:#1d1c1a;--muted:#6b675f;--line:#d9d4c8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Inter,system-ui,sans-serif}
main{max-width:1180px;margin:0 auto;padding:48px 16px 80px}
h1{font:400 clamp(44px,8vw,88px)/.9 "Bebas Neue",Inter,sans-serif;letter-spacing:.02em;margin:0 0 8px}
.lede{max-width:720px;color:var(--muted);font-size:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin-top:36px}
.ch-card{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.ch-mock{height:210px;position:relative;overflow:hidden;border-bottom:1px solid var(--line)}
.ch-body{padding:20px 22px 24px}.ch-body h2{margin:0;font-size:24px}.ch-tag{margin:2px 0 10px;color:var(--muted);font-weight:600}
.ch-links{list-style:none;padding:0;margin:16px 0 0;display:flex;flex-wrap:wrap;gap:8px}
.ch-links a{display:inline-block;padding:6px 12px;border:1px solid var(--line);border-radius:999px;color:var(--ink);text-decoration:none;font-size:14px}
.ch-links a:hover{background:var(--ink);color:#fff}
.how{margin-top:40px;padding:20px 22px;border:1px dashed var(--line);border-radius:12px;background:#fbfaf7}
code{font-family:"IBM Plex Mono",monospace;background:#ece8df;padding:1px 6px;border-radius:4px}
/* mocks */
.m-dossier{position:absolute;inset:0;background:#f4f1ea;font-family:"IBM Plex Mono",monospace}
.m-dossier .bar{height:30px;background:#1c1b19;color:#f4f1ea;font-size:11px;padding:8px 12px;letter-spacing:.12em}
.m-dossier .side{position:absolute;top:30px;left:0;bottom:0;width:80px;border-right:1px solid #c9c2b2;padding:10px;font-size:9px;line-height:2;color:#555}
.m-dossier .doc{position:absolute;top:44px;left:96px;right:14px;border:2px solid #1c1b19;padding:10px;font-size:10px;line-height:1.7;background:#fffdf8}
.m-dossier .stamp{position:absolute;right:20px;top:80px;border:3px solid #8b1a1a;color:#8b1a1a;padding:2px 8px;font-weight:600;transform:rotate(-8deg);font-size:14px;letter-spacing:.1em}
.m-wiki{position:absolute;inset:0;background:#e9eef4;font-family:Verdana,sans-serif}
.m-wiki .bar{height:34px;background:#23395d;color:#fff;font-size:12px;padding:10px 12px;font-weight:700}
.m-wiki .tabs{display:flex;gap:4px;padding:6px 10px 0;background:#2f4b78}.m-wiki .tabs i{display:block;width:44px;height:14px;background:#4c6a9c;border-radius:4px 4px 0 0}.m-wiki .tabs i:first-child{background:#fff}
.m-wiki .page{position:absolute;top:54px;left:12px;right:12px;bottom:0;background:#fff;padding:12px;font-size:10px;color:#333}
.m-wiki .box{position:absolute;right:10px;top:10px;width:90px;height:110px;border:1px solid #a7b6cc;background:#f3f6fa}
.m-wiki .ln{height:6px;background:#dde3ea;margin:6px 110px 0 0;border-radius:3px}.m-wiki .ln.b{background:#3a6fb0;width:40px}
.m-broadcast{position:absolute;inset:0;background:#0b0b0d;color:#e9e6df;font-family:"Bebas Neue",sans-serif;display:flex;align-items:center;justify-content:center;gap:16px}
.m-broadcast .n{font-size:34px;letter-spacing:.04em}.m-broadcast .n.dead{color:#55524c;text-decoration:line-through}
.m-broadcast .x{color:#ff8a1f;font-size:18px}.m-broadcast .glow{position:absolute;width:160px;height:160px;border-radius:50%;background:radial-gradient(#ff8a1f55,transparent 70%);right:30px;top:20px}
.m-broadcast .r{position:absolute;top:16px;left:18px;font-size:14px;color:#ff8a1f;letter-spacing:.2em}
</style></head>
<body><main>
<h1>Choose a style</h1>
<p class="lede">The same archive, built three ways. Every page exists in all three, and while you browse, the switcher in the corner of each page jumps to the same page in another style.</p>
<div class="grid">${themes.map(card).join('')}</div>
<div class="how"><strong>To pick one:</strong> set <code>"defaultTheme"</code> in <code>bracket.config.json</code> to <code>"${themes.map((t) => t.id).join('"</code>, <code>"')}"</code>. The next build puts that style at the root of the site and drops the other two.</div>
</main></body></html>`;
}
