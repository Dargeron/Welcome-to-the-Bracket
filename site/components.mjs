// Shared building blocks. Every theme gets these; a theme can replace any of
// them by exporting a function with the same name in its `components`.

import { esc, fmtInt, rangeList } from '../scripts/lib/util.mjs';

export const C = {};

// --- small pieces --------------------------------------------------------------

C.newcomer = (ctx) => `
<aside class="newcomer" role="note">
  <span class="newcomer-q">Just arrived in the Bracket?</span>
  <span class="newcomer-a">Everybody is told the rules once. <a href="${ctx.href('introduction/')}">Read the Introduction&nbsp;→</a></span>
</aside>`;

C.charLink = (ctx, slug, label) => {
  const c = ctx.site.characters.get(slug);
  if (!c) return esc(label || slug);
  const cls = ['cl', `cl-${c.status}`].join(' ');
  return `<a class="${cls}" href="${ctx.href(c.path)}">${esc(label || c.name)}</a>`;
};

/** "Written by X" / "From the founding text" */
C.byline = (e) => (e.founding ? 'From the founding text' : e.author ? `Written by ${esc(e.author)}` : '');

C.encLink = (ctx, e, label) => `<a class="el" href="${ctx.href(e.path)}">${esc(label || `${e.id}: ${e.title}`)}</a>`;

C.statusWord = (c) => (c.status === 'stopped' ? `Stopped in Round ${c.deathRound}` : c.status === 'sixteen' ? 'One of the Sixteen' : 'In play');

C.statusChip = (ctx, c) => `<span class="chip chip-${c.status}">${esc(C.statusWord(c))}</span>`;

C.reviewText = (ctx, v) => {
  const q = ctx.site.config.voting.quorum;
  if (v.status === 'founding') return 'Founding text';
  if (v.status === 'review') return `Under review · ${v.count}/${q} votes`;
  if (v.status === 'standing') return `Standing · median ${v.median} of ${v.count}`;
  return 'Deprecated';
};

C.reviewChip = (ctx, v) => `<span class="chip chip-review chip-${v.status}">${esc(C.reviewText(ctx, v))}</span>`;

C.roundLabel = (ctx, r) => `<a class="rl" href="${ctx.href(`rounds/${r}/`)}">Round ${r}</a>`;

// --- encounter pieces -----------------------------------------------------------

C.encounterHero = (ctx, e) => {
  const [a, b] = e.slugs;
  const side = (s) => {
    const c = ctx.site.characters.get(s);
    const dead = s === e.deadSlug;
    return `<div class="side ${dead ? 'side-stopped' : 'side-survived'}">
      <div class="side-name">${C.charLink(ctx, s)}</div>
      <div class="side-src">${esc(c.source || '')}</div>
      <div class="side-out">${dead ? 'Stopped' : 'Walked out'}</div>
    </div>`;
  };
  return `<header class="enc-hero">
    <div class="enc-kicker">${esc(e.id)} · ${C.roundLabel(ctx, e.round)} of ${ctx.site.config.finalRound}</div>
    <h1 class="enc-title">${esc(e.title)}</h1>
    <div class="enc-sides">${side(a)}<div class="vs">and</div>${side(b)}</div>
    <div class="enc-meta">${C.byline(e) ? `${C.byline(e)} · ` : ''}${e.submitted ? `filed ${esc(e.submitted)} · ` : ''}${e.words} words · ${C.reviewChip(ctx, e.votes)}</div>
  </header>`;
};

C.encounterNote = (ctx, e) =>
  e.note ? `<aside class="enc-note"><div class="enc-note-h">Note</div>${ctx.md(e.note)}</aside>` : '';

/** For each of the two characters: their previous and next recorded rooms. */
C.connections = (ctx, e) => {
  const rows = e.slugs.map((s) => {
    const c = ctx.site.characters.get(s);
    const rounds = Object.keys(c.rounds).map(Number).sort((x, y) => x - y);
    const prev = rounds.filter((r) => r < e.round).pop();
    const next = rounds.find((r) => r > e.round);
    const enc = (r) => ctx.site.byId.get(c.rounds[r].id);
    let before = prev
      ? `${C.roundLabel(ctx, prev)}: ${C.encLink(ctx, enc(prev))}`
      : e.round === 1
        ? '<span class="muted">This was their first room.</span>'
        : `<span class="muted">Rounds before this are unwritten.</span>`;
    let after;
    if (s === e.deadSlug) after = '<span class="muted">Stopped here.</span>';
    else if (next) after = `${C.roundLabel(ctx, next)}: ${C.encLink(ctx, enc(next))}`;
    else if (e.round === ctx.site.config.finalRound) after = `<a href="${ctx.href('sixteen/')}">Became one of the Sixteen.</a>`;
    else
      after = `<span class="muted">Round ${e.round + 1} is unwritten.</span> <a class="cta-inline" href="${ctx.gh.newEncounter({ a: c.name, round: e.round + 1 })}">Write it</a>`;
    return `<tr><th scope="row">${C.charLink(ctx, s)}</th><td>${before}</td><td>${after}</td></tr>`;
  });
  return `<section class="connections"><h2>The thread</h2>
    <table class="tbl"><thead><tr><th>Character</th><th>Room before</th><th>Room after</th></tr></thead><tbody>${rows.join('')}</tbody></table></section>`;
};

C.voteWidget = (ctx, e) => {
  const { config } = ctx.site;
  const v = e.votes;
  const btns = [];
  for (let s = config.voting.min; s <= config.voting.max; s++)
    btns.push(`<a class="vote-btn" href="${ctx.gh.vote(e.id, s)}" rel="noopener" target="_blank" aria-label="Vote ${s} out of ${config.voting.max}">${s}</a>`);
  let status;
  if (v.status === 'founding') status = `This is part of the founding text and is not subject to removal. Votes are still recorded.`;
  else if (v.status === 'review')
    status = `${v.count} of ${v.quorum} votes cast. From the ${ordinal(v.quorum)} vote on, the median of all votes is checked after every vote: if it is ever below ${config.voting.removeIfMedianBelow}, the encounter moves to the deprecated archive.`;
  else status = `In canon with a median of ${v.median} from ${v.count} votes. It is checked again after every vote and is removed if the median ever falls below ${config.voting.removeIfMedianBelow}.`;
  const tally = v.scores.length
    ? `<div class="vote-tally">${v.scores.map((s, i) => `<span class="vt" title="vote ${i + 1}">${s}</span>`).join('')}</div>`
    : '';
  return `<section class="vote" id="vote">
    <h2>Rate this encounter</h2>
    <p class="vote-status">${status}</p>
    ${tally}
    <div class="vote-row" role="group" aria-label="Score from ${config.voting.min} to ${config.voting.max}">${btns.join('')}</div>
    <p class="fine">Each button opens a pre-filled GitHub issue; press <em>Create</em> and the vote is counted automatically within a minute or two. You need a GitHub account. LLMs: see <a href="${ctx.gh.source('AGENTS.md')}">AGENTS.md</a>.</p>
  </section>`;
};

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

C.backlinks = (ctx, p) => {
  const m = ctx.site.backlinks.get(p);
  if (!m || !m.size) return '';
  return `<section class="backlinks"><h2>What links here</h2><ul>${[...m.entries()]
    .map(([from, title]) => `<li><a href="${ctx.href(from)}">${esc(title)}</a></li>`)
    .join('')}</ul></section>`;
};

C.sourceLinks = (ctx, rel, extra = '') =>
  rel
    ? `<p class="source-links fine"><a href="${ctx.gh.source(rel)}" rel="noopener">View source</a> · <a href="${ctx.gh.report(rel)}" rel="noopener">Report a problem</a>${extra}</p>`
    : '';

// --- character pieces --------------------------------------------------------------

C.roundStrip = (ctx, c) => {
  const cells = [];
  for (let r = 1; r <= ctx.site.config.finalRound; r++) {
    const rec = c.rounds[r];
    const open = c.open.find((o) => o.round === r);
    let cls, label, inner;
    if (rec) {
      cls = rec.outcome === 'stopped' ? 'rs-stopped' : 'rs-survived';
      label = `Round ${r}: ${rec.outcome === 'stopped' ? 'stopped' : 'survived'} (${rec.id})`;
      inner = `<a href="${ctx.href(`encounters/${rec.id.toLowerCase()}/`)}">${r}</a>`;
    } else if (open) {
      cls = open.mustSurvive ? 'rs-open-survive' : 'rs-open';
      label = `Round ${r}: unwritten — ${open.mustSurvive ? 'must survive' : 'may survive or stop'}`;
      inner = `<a href="${ctx.gh.newEncounter({ a: c.name, round: r })}" rel="noopener">${r}</a>`;
    } else if (c.deathRound != null && r > c.deathRound) {
      cls = 'rs-after';
      label = `Round ${r}: after they stopped`;
      inner = `<span>${r}</span>`;
    } else {
      cls = 'rs-full';
      label = `Round ${r}: every room in this round is written`;
      inner = `<span>${r}</span>`;
    }
    cells.push(`<li class="rs ${cls}" title="${esc(label)}">${inner}</li>`);
  }
  return `<figure class="round-strip-wrap"><ol class="round-strip" aria-label="Rounds 1 to ${ctx.site.config.finalRound}">${cells.join('')}</ol>
  <figcaption class="rs-legend"><span class="rs-key rs-survived"></span>survived <span class="rs-key rs-stopped"></span>stopped <span class="rs-key rs-open-survive"></span>open, must survive <span class="rs-key rs-open"></span>open, either <span class="rs-key rs-after"></span>after stopping</figcaption></figure>`;
};

C.characterHero = (ctx, c) => `<header class="char-hero">
  <div class="char-kicker">Character${c.aliases?.length ? ` · also ${c.aliases.map(esc).join(', ')}` : ''}</div>
  <h1 class="char-title">${esc(c.name)}</h1>
  <div class="char-meta">${c.source ? `<span class="char-src">${esc(c.source)}</span> · ` : ''}${C.statusChip(ctx, c)}</div>
</header>`;

C.characterHistory = (ctx, c) => {
  const rows = Object.entries(c.rounds)
    .map(([r, rec]) => [Number(r), rec])
    .sort((a, b) => a[0] - b[0])
    .map(([r, rec]) => {
      const e = ctx.site.byId.get(rec.id);
      return `<tr class="${rec.outcome === 'stopped' ? 'row-stopped' : ''}"><td>${C.roundLabel(ctx, r)}</td><td>${C.charLink(ctx, rec.opponent)}</td><td>${rec.outcome === 'stopped' ? 'Stopped' : 'Survived'}</td><td>${C.encLink(ctx, e)}</td></tr>`;
    });
  if (!rows.length) return `<section class="history"><h2>Rooms on record</h2><p class="muted">No encounter with ${esc(c.name)} has been written yet.</p></section>`;
  return `<section class="history"><h2>Rooms on record</h2><table class="tbl"><thead><tr><th>Round</th><th>Across from</th><th>Outcome</th><th>Encounter</th></tr></thead><tbody>${rows.join('')}</tbody></table></section>`;
};

C.openRounds = (ctx, c) => {
  const { config } = ctx.site;
  let text;
  if (c.full) {
    text = c.status === 'stopped' ? `${esc(c.name)} stopped in Round ${c.deathRound} and every earlier round is written. No more encounters can be written for them.` : 'Every round is written.';
  } else {
    const must = c.open.filter((o) => o.mustSurvive).map((o) => o.round);
    const either = c.open.filter((o) => !o.mustSurvive).map((o) => o.round);
    const parts = [];
    if (must.length) parts.push(`<li><strong>Round${must.length > 1 ? 's' : ''} ${rangeList(must)}</strong>: ${esc(c.name)} must be the one who walks out${c.sixteen ? ' (one of the Sixteen)' : c.deathRound != null ? ` (they stop in Round ${c.deathRound})` : ` (they are on record in Round ${c.lastRound})`}.</li>`);
    if (either.length) parts.push(`<li><strong>Round${either.length > 1 ? 's' : ''} ${rangeList(either)}</strong>: ${esc(c.name)} may survive or stop.${either.includes(config.finalRound) ? ` Surviving Round ${config.finalRound} makes them one of the Sixteen.` : ''}</li>`);
    const opts = c.open.map((o) => `<option value="${o.round}">Round ${o.round}${o.mustSurvive ? ' (must survive)' : ''}</option>`).join('');
    text = `<ul>${parts.join('')}</ul>
      <form class="write-form" action="${ctx.gh.repo}/issues/new" method="get" target="_blank">
        <input type="hidden" name="template" value="encounter.yml"><input type="hidden" name="title" value="[Encounter] ">
        <input type="hidden" name="character_a" value="${esc(c.name)}">
        <label>Write a room for ${esc(c.name)} in <select name="round">${opts}</select></label>
        <button type="submit">Start writing</button>
      </form>`;
  }
  return `<section class="open-rounds"><h2>For writers: open rounds</h2>${text}</section>`;
};

C.characterBody = (ctx, c) => {
  if (c.body) return `<section class="reconstruction"><h2 class="sr-h">Reconstruction</h2>${ctx.md(c.body)}</section>`;
  return `<section class="reconstruction empty"><p class="muted">No one has written a reconstruction of ${esc(c.name)}'s path yet. The record below is generated from the encounters.
    <a href="${ctx.gh.characterEntry(c.name)}" rel="noopener">Write the character entry</a>. Character entries describe only what published encounters show.</p></section>`;
};

// --- lists ------------------------------------------------------------------------------

C.encounterTable = (ctx, list, { showRound = true } = {}) => {
  if (!list.length) return '<p class="muted">Nothing written yet.</p>';
  return `<table class="tbl tbl-enc"><thead><tr><th>ID</th>${showRound ? '<th>Round</th>' : ''}<th>Title</th><th>Characters</th><th>Stopped</th><th>Review</th></tr></thead><tbody>${list
    .map(
      (e) => `<tr><td class="mono">${C.encLink(ctx, e, e.id)}</td>${showRound ? `<td>${C.roundLabel(ctx, e.round)}</td>` : ''}<td>${C.encLink(ctx, e, e.title)}</td><td>${e.slugs
        .map((s) => C.charLink(ctx, s))
        .join(' · ')}</td><td>${C.charLink(ctx, e.deadSlug)}</td><td>${C.reviewChip(ctx, e.votes)}</td></tr>`
    )
    .join('')}</tbody></table>`;
};

C.encounterCards = (ctx, list) => {
  if (!list.length) return '<p class="muted">Nothing written yet.</p>';
  return `<ul class="cards">${list
    .map(
      (e) => `<li class="card"><a class="card-link" href="${ctx.href(e.path)}">
      <span class="card-kicker">${esc(e.id)} · Round ${e.round}</span>
      <span class="card-title">${esc(e.title)}</span>
      <span class="card-who">${e.slugs.map((s) => `<span class="${s === e.deadSlug ? 'who-stopped' : 'who-survived'}">${esc(ctx.site.characters.get(s).name)}</span>`).join('<span class="who-and"> and </span>')}</span>
      <span class="card-ex">${esc(e.excerpt)}</span></a></li>`
    )
    .join('')}</ul>`;
};

C.encounterList = (ctx, list, opts) => C.encounterTable(ctx, list, opts);

C.characterTable = (ctx, list) => `<table class="tbl tbl-chars"><thead><tr><th>Character</th><th>Source</th><th>Status</th><th>Rooms</th><th>Open rounds</th></tr></thead><tbody>${list
  .map(
    (c) => `<tr><td>${C.charLink(ctx, c.slug)}${c.body ? '' : ' <span class="fine muted">(no entry)</span>'}</td><td class="fine">${esc(c.source || '—')}</td><td>${C.statusChip(ctx, c)}</td><td>${c.encounterCount}</td><td class="fine">${c.full ? '—' : rangeList(c.open.map((o) => o.round))}</td></tr>`
  )
  .join('')}</tbody></table>`;

C.sixteenRoster = (ctx) => {
  const { config } = ctx.site;
  const slots = [];
  for (let i = 0; i < config.sixteen; i++) {
    const s = ctx.site.sixteen[i];
    if (s) {
      const c = ctx.site.characters.get(s.slug);
      slots.push(`<li class="slot slot-filled"><span class="slot-n">${i + 1}</span>${C.charLink(ctx, s.slug)}<span class="slot-src">${esc(c.source || '')}</span><span class="slot-how">${s.how === 'designated' ? 'designated' : `won Round ${config.finalRound}`}</span></li>`);
    } else slots.push(`<li class="slot slot-empty"><span class="slot-n">${i + 1}</span><span class="slot-name">Unclaimed</span></li>`);
  }
  return `<ol class="roster">${slots.join('')}</ol>`;
};

C.roundsTable = (ctx) => `<table class="tbl tbl-rounds"><thead><tr><th>Round</th><th>Entrants</th><th>Rooms</th><th>Written</th><th></th></tr></thead><tbody>${ctx.site.rounds
  .map(
    (r) => `<tr><td>${C.roundLabel(ctx, r.round)}</td><td class="num">${fmtInt(r.entrants)}</td><td class="num">${fmtInt(r.rooms)}</td><td class="num">${r.encounters.length}</td><td>${r.encounters.length ? `<a href="${ctx.href(`random/?round=${r.round}`)}">random</a>` : ''}</td></tr>`
  )
  .join('')}<tr class="row-beyond"><td colspan="5">Rounds ${ctx.site.config.finalRound + 1}–${ctx.site.config.totalRounds}: after the Timeline. Never written.</td></tr></tbody></table>`;

C.roundRail = (ctx, current) => `<nav class="round-rail" aria-label="Rounds">${ctx.site.rounds
  .map((r) => `<a class="rr ${r.round === current ? 'rr-on' : ''} ${r.encounters.length ? 'rr-has' : ''}" href="${ctx.href(r.path)}" title="Round ${r.round}: ${r.encounters.length} written">${r.round}</a>`)
  .join('')}</nav>`;

C.randomControls = (ctx) => `<div class="random-controls">
  <a class="btn" href="${ctx.href('random/')}">Random encounter</a>
  <a class="btn" href="${ctx.href('random/?type=character')}">Random character</a>
  <form class="random-round" action="${ctx.href('random/')}" method="get"><label>Random from <select name="round">${ctx.site.rounds
    .map((r) => `<option value="${r.round}">Round ${r.round}</option>`)
    .join('')}</select></label> <button type="submit" class="btn">Go</button></form>
</div>`;

C.searchForm = (ctx, cls = '') => `<form class="search ${cls}" action="${ctx.href('search/')}" method="get" role="search"><input type="search" name="q" placeholder="Search the archive" aria-label="Search the archive"><button type="submit" aria-label="Search">⌕</button></form>`;

C.stats = (ctx) => {
  const s = ctx.site;
  return `<dl class="stats">
    <div><dt>Encounters</dt><dd>${s.encounters.length}</dd></div>
    <div><dt>Characters</dt><dd>${s.characters.size}</dd></div>
    <div><dt>The Sixteen</dt><dd>${s.sixteen.length}<small>/${s.config.sixteen}</small></dd></div>
    <div><dt>Deprecated</dt><dd>${s.deprecated.length}</dd></div>
  </dl>`;
};

C.previewSwitcher = (ctx) => {
  if (!ctx.preview) return '';
  return `<nav class="style-switch" aria-label="Style preview">
    <a href="${ctx.toRoot}index.html" title="All styles">Styles:</a>${ctx.themes
      .map((t) => `<a class="${t.id === ctx.theme.id ? 'on' : ''}" href="${ctx.toRoot}${t.id}/${ctx.fix(ctx.path)}">${esc(t.name)}</a>`)
      .join('')}
  </nav>`;
};
