// Landing page #1: the trailer.
//
// A canvas title sequence played by site/shared/trailer.js: a particle field
// (each point of light is an entrant), the Address, a montage of real match
// cards and last lines pulled from the published encounters, the bracket
// collapsing round by round to sixteen points, then the title. The soundtrack
// is synthesised live with Web Audio, so there are no media files.

import { esc, fmtInt } from '../scripts/lib/util.mjs';

/** Last sentence of an encounter, if it's short enough to work on screen. */
function lastLine(md) {
  const paras = String(md)
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[*_]/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && p !== '---' && !p.startsWith('#'));
  const last = paras[paras.length - 1] || '';
  const sentences = last.match(/[^.!?]+[.!?]["”’]?/g) || [last];
  const raw = sentences[sentences.length - 1].trim();
  // dialogue doesn't stand on its own in a montage; keep narration only
  if (/["“”]/.test(raw)) return null;
  const s = raw;
  return s.length >= 12 && s.length <= 90 ? s : null;
}

export function trailerData(site) {
  const { config } = site;
  const names = [...site.characters.values()].map((c) => c.name.replace(/\s*\(.*\)$/, ''));
  const crowd = ['Crowd Member 4,112', 'Classmate (Glasses)', 'Shopkeeper', 'Villager B', 'Waiter', 'Bystander', 'Student Council Member 3', 'Soldier C', 'Female Student 1', 'Passer-by', 'Salaryman on the Platform', 'Girl at the Festival'];
  const matches = site.encounters.map((e) => {
    const [a, b] = e.slugs.map((s) => site.characters.get(s).name.replace(/\s*\(.*\)$/, ''));
    return { r: e.round, a, b, dead: e.slugs[0] === e.deadSlug ? 0 : 1 };
  });
  const quotes = site.encounters
    .map((e) => ({ q: lastLine(e.body), t: e.title, id: e.id }))
    .filter((x) => x.q);
  return {
    entrants: config.entrants,
    finalRound: config.finalRound,
    sixteen: config.sixteen,
    names: [...names, ...crowd],
    matches,
    quotes,
  };
}

export function trailerMarkup(ctx) {
  const { config } = ctx.site;
  const data = JSON.stringify(trailerData(ctx.site)).replace(/</g, '\\u003c');
  const actions = `
      <a class="btn btn-primary" href="${ctx.href('introduction/')}">Read the Introduction</a>
      <a class="btn" href="${ctx.href('archive/')}">Enter the Archive</a>
      <a class="btn" href="${ctx.href('random/')}">A random room</a>`;
  return `<div class="tr" data-trailer>
  <canvas class="tr-canvas" aria-hidden="true"></canvas>
  <div class="tr-vignette" aria-hidden="true"></div>
  <div class="tr-grain" aria-hidden="true"></div>
  <div class="tr-flash" aria-hidden="true"></div>
  <div class="tr-layer" data-layer aria-live="polite"></div>

  <section class="tr-gate" data-gate>
    <div class="gate-light" aria-hidden="true"></div>
    <div class="gate-kicker">${fmtInt(config.entrants)} entrants · ${config.finalRound} rounds · ${config.sixteen} left</div>
    <button class="gate-play" type="button" data-start="sound"><span class="gate-icon" aria-hidden="true">▶</span> Play the trailer</button>
    <button class="gate-silent" type="button" data-start="silent">watch without sound</button>
    <a class="gate-skip" href="${ctx.href('introduction/')}">or skip straight to the rules</a>
  </section>

  <section class="tr-title" data-title-card hidden>
    <div class="title-kicker">An open archive of the rooms</div>
    <h1 class="title-main">${esc(config.siteName)}</h1>
    <div class="title-sub">${esc(config.tagline)}</div>
    <p class="title-blurb">Anyone may write a room. Anyone may vote. Nobody may bring back the dead.</p>
    <nav class="title-actions">${actions}</nav>
    <button class="replay" type="button" data-replay>Replay</button>
  </section>

  <div class="tr-controls" data-controls hidden>
    <button type="button" data-sound aria-label="Sound on">Sound</button>
    <button type="button" data-pause aria-label="Pause">Pause</button>
    <div class="tr-progress" aria-hidden="true"><span data-progress></span></div>
    <button type="button" data-skip>Skip</button>
  </div>
  <a class="tr-corner" href="${ctx.href('introduction/')}">New here? Read the Introduction</a>

  <noscript><section class="tr-title tr-static">
    <h1 class="title-main">${esc(config.siteName)}</h1>
    <div class="title-sub">${esc(config.tagline)}</div>
    <nav class="title-actions">${actions}</nav>
  </section></noscript>
  <script type="application/json" id="trailer-data">${data}</script>
</div>`;
}
