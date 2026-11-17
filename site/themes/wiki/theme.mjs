// Theme 2 — WIKI. A community wiki in the manner of TV Tropes / Wikipedia:
// tabs, infoboxes, portal boxes, dense cross-linking.
import { esc, fmtInt } from '../../../scripts/lib/util.mjs';
import { head, scripts, bodyAttrs, crumbs, footer, navLinks } from '../../shell.mjs';

const fonts = `<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">`;

const initials = (name) =>
  String(name)
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => [...w].find((ch) => /\p{L}/u.test(ch)))
    .join('')
    .toUpperCase() || '?';

function shell(ctx, page, body) {
  const { config } = ctx.site;
  if (page.bare) {
    return `<!doctype html><html lang="en"><head>${head(ctx, page, { fonts })}</head>
<body ${bodyAttrs(ctx, page, 'theme-wiki')}>${body}${ctx.c.previewSwitcher(ctx)}${scripts(ctx, page)}</body></html>`;
  }
  return `<!doctype html><html lang="en"><head>${head(ctx, page, { fonts })}</head>
<body ${bodyAttrs(ctx, page, 'theme-wiki')}>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <div class="topbar-in">
    <a class="logo" href="${ctx.href('archive/')}"><span class="logo-mark" aria-hidden="true">⟦●⟧</span><span><span class="logo-name">${esc(config.siteName)}</span><span class="logo-sub">${esc(config.tagline)} · the wiki anyone can write a room in</span></span></a>
    ${ctx.c.searchForm(ctx, 'top-search')}
    <div class="top-actions">
      <a class="pill" href="${ctx.href('random/')}">Random</a>
      <form class="pill-form" action="${ctx.href('random/')}" method="get"><select name="round" aria-label="Random from round" onchange="this.form.submit()"><option value="">Random by round…</option>${ctx.site.rounds.map((r) => `<option value="${r.round}">Round ${r.round}</option>`).join('')}</select></form>
      <a class="pill pill-go" href="${ctx.gh.newEncounter()}" rel="noopener">✎ Write a room</a>
    </div>
  </div>
  <nav class="tabs" aria-label="Sections"><div class="tabs-in">${navLinks(ctx, page, { cls: 'tab' })}</div></nav>
</header>
<div class="wrap">
  ${page.hideNewcomer ? '' : ctx.c.newcomer(ctx)}
  <main id="main" class="sheet">
    ${page.crumbs ? crumbs(ctx, page, '/') : ''}
    ${body}
  </main>
</div>
<footer class="foot"><div class="foot-in">${footer(ctx)}</div></footer>
${ctx.c.previewSwitcher(ctx)}
${scripts(ctx, page)}
</body></html>`;
}

function infobox(title, rows, { portrait = '', cls = '' } = {}) {
  return `<aside class="infobox ${cls}"><div class="ib-title">${title}</div>${portrait}<table>${rows
    .filter(Boolean)
    .map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`)
    .join('')}</table></aside>`;
}

const components = {
  newcomer: (ctx) => `<aside class="newcomer" role="note"><span class="newcomer-q">New to the Bracket?</span> <span class="newcomer-a">2,097,152 characters, two to a room, one walks out. <a href="${ctx.href('introduction/')}">Start with the Introduction</a> · <a href="${ctx.href('')}">watch the trailer</a></span></aside>`,

  encounterHero(ctx, e) {
    const C = ctx.c;
    const dead = ctx.site.characters.get(e.deadSlug);
    const alive = ctx.site.characters.get(e.aliveSlug);
    return `<header class="art-head"><div class="art-ns">Encounter / ${esc(e.id)}</div><h1>${esc(e.title)}</h1>
      <p class="art-sub">${C.charLink(ctx, e.slugs[0])} meets ${C.charLink(ctx, e.slugs[1])} in ${C.roundLabel(ctx, e.round)}. ${C.reviewChip(ctx, e.votes)}</p></header>
      ${infobox(esc(e.title), [
        ['Accession', esc(e.id)],
        ['Round', `${C.roundLabel(ctx, e.round)} of ${ctx.site.config.finalRound}`],
        ['Entrants', e.slugs.map((s) => `${C.charLink(ctx, s)}<div class="ib-src">${esc(ctx.site.characters.get(s).source || '')}</div>`).join('')],
        ['Stopped', `<span class="ib-dead">✝</span> ${C.charLink(ctx, dead.slug)}`],
        ['Walked out', `${C.charLink(ctx, alive.slug)}${e.round === ctx.site.config.finalRound ? ' — joined the Sixteen' : ''}`],
        e.founding ? ['Written by', 'the founding text'] : e.author && ['Written by', esc(e.author)],
        ['Filed', esc(e.submitted || '—')],
        ['Length', `${fmtInt(e.words)} words`],
        ['Status', esc(C.reviewText(ctx, e.votes))],
      ])}`;
  },

  characterHero(ctx, c) {
    const C = ctx.c;
    const portrait = `<div class="ib-portrait ib-${c.status}"><span>${esc(initials(c.name))}</span></div>`;
    return `<header class="art-head"><div class="art-ns">Character</div><h1>${esc(c.name)}</h1>
      <p class="art-sub">${c.source ? `<em>${esc(c.source)}</em> · ` : ''}${C.statusChip(ctx, c)}</p></header>
      ${infobox(esc(c.name), [
        c.aliases?.length && ['Also known as', c.aliases.map(esc).join('<br>')],
        ['Source', esc(c.source || 'Unrecorded')],
        ['Status', esc(C.statusWord(c))],
        c.deathRound != null && ['Stopped in', `${C.roundLabel(ctx, c.deathRound)} (${C.encLink(ctx, ctx.site.byId.get(c.deathId), c.deathId)})`],
        c.sixteen && ['Sixteen', c.sixteenHow === 'designated' ? 'by designation' : `won Round ${ctx.site.config.finalRound}`],
        ['Rooms on record', String(c.encounterCount)],
        ['Open rounds', c.full ? 'none' : String(c.open.length)],
      ], { portrait })}`;
  },

  characterBody(ctx, c) {
    if (c.body) return `<section class="reconstruction prose">${ctx.md(c.body)}</section>`;
    return `<section class="reconstruction empty"><div class="stub">This character entry is a <strong>stub</strong>. Nobody has written ${esc(c.name)}'s path yet; the record below is generated from the encounters. <a href="${ctx.gh.characterEntry(c.name)}" rel="noopener">You can help by writing it.</a></div></section>`;
  },

  // encounter lists become "folders" grouped by round, as on TV Tropes
  encounterList(ctx, list, { showRound = true } = {}) {
    if (!list.length) return '<p class="muted">Nothing written yet. <a href="' + ctx.gh.newEncounter() + '" rel="noopener">Be the first.</a></p>';
    if (!showRound) return ctx.c.encounterTable(ctx, list, { showRound });
    const byRound = new Map();
    for (const e of list) {
      if (!byRound.has(e.round)) byRound.set(e.round, []);
      byRound.get(e.round).push(e);
    }
    return `<div class="folders"><p class="folder-ctl"><button type="button" onclick="document.querySelectorAll('.folder').forEach(function(d){d.open=true})">Open all folders</button> <button type="button" onclick="document.querySelectorAll('.folder').forEach(function(d){d.open=false})">Close all folders</button></p>${[...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([r, es]) => `<details class="folder" open><summary>Round ${r} <span class="count">(${es.length})</span></summary><ul class="trope-list">${es
          .map(
            (e) => `<li><a class="el" href="${ctx.href(e.path)}"><strong>${esc(e.title)}</strong></a> <span class="mono muted">${esc(e.id)}</span>: ${e.slugs
              .map((s) => ctx.c.charLink(ctx, s))
              .join(' and ')}. ${ctx.c.charLink(ctx, e.deadSlug)} stopped. ${ctx.c.reviewChip(ctx, e.votes)}<div class="li-ex">${esc(e.excerpt)}</div></li>`
          )
          .join('')}</ul></details>`
      )
      .join('')}</div>`;
  },

  hub(ctx) {
    const s = ctx.site;
    const C = ctx.c;
    const featured = s.encounters.slice().sort((a, b) => (b.votes.trialMedian ?? 0) - (a.votes.trialMedian ?? 0) || b.num - a.num)[0];
    const latest = s.encounters.slice().reverse().slice(0, 6);
    const chars = [...s.characters.values()].sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="portal-welcome"><h1>Welcome to ${esc(s.config.siteName)}</h1>
      <p>The wiki of the Bracket: every character from every anime ever made, two to a room, until sixteen are left. <strong>${s.encounters.length}</strong> rooms and <strong>${s.characters.size}</strong> characters on record so far. Anyone can add one.</p>
      <p><a class="btn btn-primary" href="${ctx.href('introduction/')}">Introduction</a> <a class="btn" href="${ctx.href('founding-text/')}">Founding text</a> <a class="btn" href="${ctx.href('contribute/')}">How to contribute</a></p></div>
    <div class="portal">
      <section class="pbox pbox-feat"><h2>Featured room</h2>${featured ? `<h3><a href="${ctx.href(featured.path)}">${esc(featured.title)}</a></h3><p class="muted">${esc(featured.id)} · Round ${featured.round} · ${featured.slugs.map((x) => C.charLink(ctx, x)).join(' and ')}</p><p>${esc(featured.excerpt)} <a href="${ctx.href(featured.path)}">(Read more…)</a></p>` : ''}</section>
      <section class="pbox"><h2>The Sixteen</h2>${C.sixteenRoster(ctx)}</section>
      <section class="pbox"><h2>Recently filed</h2><ul class="trope-list">${latest.map((e) => `<li><a href="${ctx.href(e.path)}">${esc(e.title)}</a> <span class="muted">(${esc(e.id)}, Round ${e.round})</span></li>`).join('')}</ul><p><a href="${ctx.href('encounters/')}">All encounters…</a></p></section>
      <section class="pbox"><h2>Browse by round</h2>${C.roundRail(ctx)}<h2>Characters A–Z</h2><ul class="char-cloud">${chars.map((ch) => `<li>${C.charLink(ctx, ch.slug)}</li>`).join('')}</ul></section>
      <section class="pbox pbox-wide"><h2>Wander</h2>${C.randomControls(ctx)}${C.stats(ctx)}</section>
    </div>`;
  },
};

export default {
  id: 'wiki',
  name: 'Wiki',
  tagline: 'The archive as a community wiki',
  blurb: 'Bright and dense, in the manner of TV Tropes and Wikipedia: tabs, infoboxes, portal boxes and folders. Built for browsing sideways from link to link.',
  mock: `<div class="m-wiki"><div class="bar">THE BRACKET</div><div class="tabs"><i></i><i></i><i></i><i></i><i></i></div><div class="page"><b>Frieren</b><div class="box"></div><div class="ln"></div><div class="ln"></div><div class="ln b"></div><div class="ln"></div><div class="ln"></div><div class="ln"></div></div></div>`,
  shell,
  components,
};
