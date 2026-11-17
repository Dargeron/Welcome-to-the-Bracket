// Theme 3 — BROADCAST. Dark and cinematic: match cards, a glowing orange
// light, big condensed type, the bracket drawn as a rail of rounds.
import { esc, fmtInt } from '../../../scripts/lib/util.mjs';
import { head, scripts, bodyAttrs, crumbs, footer, navLinks } from '../../shell.mjs';

const fonts = `<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;
const pad2 = (n) => String(n).padStart(2, '0');

function shell(ctx, page, body) {
  const { config } = ctx.site;
  if (page.bare) {
    return `<!doctype html><html lang="en"><head>${head(ctx, page, { fonts })}</head>
<body ${bodyAttrs(ctx, page, 'theme-broadcast')}>${body}${ctx.c.previewSwitcher(ctx)}${scripts(ctx, page)}</body></html>`;
  }
  return `<!doctype html><html lang="en"><head>${head(ctx, page, { fonts })}</head>
<body ${bodyAttrs(ctx, page, 'theme-broadcast')}>
<a class="skip" href="#main">Skip to content</a>
<header class="bar">
  <a class="mark" href="${ctx.href('archive/')}"><span class="mark-light" aria-hidden="true"></span><span class="mark-name">${esc(config.siteName)}</span></a>
  <input type="checkbox" id="menu" class="menu-toggle"><label class="menu-label" for="menu" aria-label="Menu"><span></span><span></span></label>
  <nav class="menu" aria-label="Sections">
    ${navLinks(ctx, page, { cls: 'm-link' })}
    <a class="m-link m-random" href="${ctx.href('random/')}">Random</a>
    ${ctx.c.searchForm(ctx, 'bar-search')}
  </nav>
</header>
${page.hideNewcomer ? '' : ctx.c.newcomer(ctx)}
<main id="main" class="stage">
  ${page.crumbs ? crumbs(ctx, page, '/') : ''}
  ${body}
</main>
<footer class="foot">${footer(ctx)}</footer>
${ctx.c.previewSwitcher(ctx)}
${scripts(ctx, page)}
</body></html>`;
}

const components = {
  newcomer: (ctx) => `<aside class="newcomer" role="note"><span class="newcomer-q">First time here?</span> <span class="newcomer-a">Somebody drew you too. <a href="${ctx.href('introduction/')}">Read the rules</a> or <a href="${ctx.href('')}">watch the trailer</a>.</span></aside>`,

  encounterHero(ctx, e) {
    const C = ctx.c;
    const side = (s) => {
      const c = ctx.site.characters.get(s);
      const dead = s === e.deadSlug;
      return `<div class="fighter ${dead ? 'f-stopped' : 'f-survived'}">
        <div class="f-out">${dead ? 'Stopped' : e.round === ctx.site.config.finalRound ? 'One of the Sixteen' : 'Walked out'}</div>
        <div class="f-name">${C.charLink(ctx, s)}</div>
        <div class="f-src">${esc(c.source || '')}</div>
      </div>`;
    };
    return `<header class="match">
      <div class="match-round"><a href="${ctx.href(`rounds/${e.round}/`)}">Round ${pad2(e.round)}</a><span>/ ${ctx.site.config.finalRound}</span></div>
      <div class="match-card">${side(e.slugs[0])}<div class="match-x" aria-hidden="true">×</div>${side(e.slugs[1])}</div>
      <h1 class="match-title">${esc(e.title)}</h1>
      <div class="match-meta"><span class="mono">${esc(e.id)}</span>${C.byline(e) ? `<span>${C.byline(e)}</span>` : ''}<span>${fmtInt(e.words)} words</span>${C.reviewChip(ctx, e.votes)}</div>
    </header>`;
  },

  characterHero(ctx, c) {
    const C = ctx.c;
    return `<header class="profile profile-${c.status}">
      <div class="profile-glow" aria-hidden="true"></div>
      <div class="profile-kicker">${c.status === 'sixteen' ? 'One of the Sixteen' : c.status === 'stopped' ? `Stopped · Round ${pad2(c.deathRound)}` : 'Still in the Bracket'}</div>
      <h1 class="profile-name">${esc(c.name)}</h1>
      <div class="profile-meta">${c.source ? `<span>${esc(c.source)}</span>` : ''}${c.aliases?.length ? `<span>also ${c.aliases.map(esc).join(', ')}</span>` : ''}<span>${c.encounterCount} room${c.encounterCount === 1 ? '' : 's'} on record</span></div>
    </header>`;
  },

  encounterList: (ctx, list) => ctx.c.encounterCards(ctx, list),

  hub(ctx) {
    const s = ctx.site;
    const C = ctx.c;
    const latest = s.encounters.slice().reverse().slice(0, 9);
    return `<section class="marquee">
      <div class="marquee-glow" aria-hidden="true"></div>
      <div class="kicker">${fmtInt(s.config.entrants)} entrants · ${s.config.finalRound} rounds · ${s.config.sixteen} left</div>
      <h1 class="marquee-title">Everyone<br>But Sixteen</h1>
      <p class="lede">Every character from every anime ever made, two to a room. This is the record of the rooms, and anyone can write one.</p>
      <p class="hub-actions"><a class="btn btn-primary" href="${ctx.href('introduction/')}">The rules</a> <a class="btn" href="${ctx.href('')}">Trailer</a> <a class="btn" href="${ctx.href('founding-text/')}">Founding text</a> <a class="btn" href="${ctx.gh.newEncounter()}" rel="noopener">Write a room</a></p>
    </section>
    ${C.stats(ctx)}
    <section><h2 class="sec">Latest rooms</h2>${C.encounterCards(ctx, latest)}</section>
    <section><h2 class="sec">The Timeline</h2>${C.roundRail(ctx)}</section>
    <section><h2 class="sec">The Sixteen</h2>${C.sixteenRoster(ctx)}</section>
    <section><h2 class="sec">Wander</h2>${C.randomControls(ctx)}</section>`;
  },

  roundRail: (ctx, current) => {
    const max = Math.max(1, ...ctx.site.rounds.map((r) => r.encounters.length));
    return `<nav class="rail" aria-label="Rounds">${ctx.site.rounds
      .map(
        (r) => `<a class="rail-r ${r.round === current ? 'on' : ''} ${r.encounters.length ? 'has' : ''}" href="${ctx.href(r.path)}" title="Round ${r.round}: ${r.encounters.length} written, ${fmtInt(r.rooms)} rooms">
        <span class="rail-bar" style="--h:${r.encounters.length ? 18 + (r.encounters.length / max) * 82 : 6}%"></span>
        <span class="rail-n">${pad2(r.round)}</span><span class="rail-c">${r.encounters.length}</span></a>`
      )
      .join('')}</nav>`;
  },
};

export default {
  id: 'broadcast',
  name: 'Broadcast',
  tagline: 'The archive as a title sequence',
  blurb: 'Dark and cinematic: every encounter opens on a match card, the orange light glows, and the rounds run like a broadcast. The most dramatic of the three.',
  mock: `<div class="m-broadcast"><div class="r">ROUND 03</div><div class="glow"></div><span class="n dead">ORANGE</span><span class="x">×</span><span class="n">FRIEREN</span></div>`,
  shell,
  components,
};
