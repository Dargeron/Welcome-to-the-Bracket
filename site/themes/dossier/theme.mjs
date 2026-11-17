// Theme 1 — DOSSIER. Clinical archive in the manner of SCP: typed records,
// a filing sidebar, stamps.
import { esc } from '../../../scripts/lib/util.mjs';
import { head, scripts, bodyAttrs, crumbs, footer } from '../../shell.mjs';

const fonts = `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap" rel="stylesheet">`;

const recId = (id) => String(id).replace(/^E/, 'E-');
const pad2 = (n) => String(n).padStart(2, '0');

function sidebar(ctx, page) {
  const link = (key, label, p) => `<li><a class="${page.nav === key ? 'on' : ''}" href="${ctx.href(p)}">${esc(label)}</a></li>`;
  return `<nav class="sidebar" aria-label="Archive">
    <div class="sb-group"><div class="sb-h">Orientation</div><ul>
      ${link('introduction', 'Introduction', 'introduction/')}
      ${link('trailer', 'Trailer', '')}
      <li><a href="${ctx.href('founding-text/')}">Founding text</a></li>
    </ul></div>
    <div class="sb-group"><div class="sb-h">Records</div><ul>
      ${link('archive', 'Archive index', 'archive/')}
      ${link('encounters', 'Room records', 'encounters/')}
      ${link('characters', 'Subject files', 'characters/')}
      ${link('sixteen', 'The Sixteen', 'sixteen/')}
      ${link('deprecated', 'Deprecated', 'deprecated/')}
    </ul></div>
    <div class="sb-group"><div class="sb-h">${page.nav === 'rounds' ? '<a class="on" href="' + ctx.href('rounds/') + '">Rounds</a>' : `<a href="${ctx.href('rounds/')}">Rounds</a>`}</div>
      <div class="sb-rounds">${ctx.site.rounds.map((r) => `<a class="${r.encounters.length ? 'has' : ''} ${ctx.path === r.path ? 'on' : ''}" href="${ctx.href(r.path)}" title="Round ${r.round}: ${r.encounters.length} on record">${pad2(r.round)}</a>`).join('')}</div>
    </div>
    <div class="sb-group"><div class="sb-h">Tools</div><ul>
      ${link('random', 'Random record', 'random/')}
      <li><a href="${ctx.href('random/?type=character')}">Random subject</a></li>
      ${link('search', 'Search', 'search/')}
      ${link('contribute', 'Contribute', 'contribute/')}
    </ul></div>
    <a class="sb-file" href="${ctx.gh.newEncounter()}" rel="noopener">+ File a room record</a>
  </nav>`;
}

function shell(ctx, page, body) {
  const { config } = ctx.site;
  if (page.bare) {
    return `<!doctype html><html lang="en"><head>${head(ctx, page, { fonts })}</head>
<body ${bodyAttrs(ctx, page, 'theme-dossier')}>${body}${ctx.c.previewSwitcher(ctx)}${scripts(ctx, page)}</body></html>`;
  }
  return `<!doctype html><html lang="en"><head>${head(ctx, page, { fonts })}</head>
<body ${bodyAttrs(ctx, page, 'theme-dossier')}>
<a class="skip" href="#main">Skip to content</a>
<header class="masthead">
  <a class="brand" href="${ctx.href('archive/')}">
    <span class="sigil" aria-hidden="true">[<i></i>]</span>
    <span class="brand-text"><span class="brand-name">${esc(config.siteName)}</span><span class="brand-sub">Archive of Rooms · ${esc(config.tagline)}</span></span>
  </a>
  ${ctx.c.searchForm(ctx, 'mast-search')}
  <input type="checkbox" id="nav-toggle" class="nav-toggle"><label for="nav-toggle" class="nav-toggle-label">Index</label>
</header>
<div class="frame">
  ${sidebar(ctx, page)}
  <main id="main">
    ${page.hideNewcomer ? '' : ctx.c.newcomer(ctx)}
    ${crumbs(ctx, page, '›')}
    ${body}
  </main>
</div>
<footer class="foot">${footer(ctx)}</footer>
${ctx.c.previewSwitcher(ctx)}
${scripts(ctx, page)}
</body></html>`;
}

const components = {
  newcomer: (ctx) => `<aside class="newcomer" role="note"><span class="newcomer-q">Notice to new arrivals</span>
    <span class="newcomer-a">You were told the rules once. If you have forgotten them, <a href="${ctx.href('introduction/')}">read the Introduction</a> before opening any record.</span></aside>`,

  encounterHero(ctx, e) {
    const C = ctx.c;
    const [a, b] = e.slugs.map((s) => ctx.site.characters.get(s));
    const occ = (c) => `${C.charLink(ctx, c.slug)}${c.source ? ` <span class="muted">— ${esc(c.source)}</span>` : ''}`;
    const dead = ctx.site.characters.get(e.deadSlug);
    const alive = ctx.site.characters.get(e.aliveSlug);
    const stamp = { founding: 'Founding', review: 'Under review', ratified: 'Ratified', deprecated: 'Deprecated' }[e.votes.status];
    return `<header class="record">
      <div class="record-top"><span>Room record</span><span class="rec-id">${recId(e.id)}</span></div>
      <h1 class="record-title">${esc(e.title)}</h1>
      <div class="stamp stamp-${e.votes.status}" aria-hidden="true">${esc(stamp)}</div>
      <table class="record-fields">
        <tr><th>Round</th><td>${C.roundLabel(ctx, e.round)} <span class="muted">(${pad2(e.round)} of ${ctx.site.config.finalRound})</span></td></tr>
        <tr><th>Occupant A</th><td>${occ(a)}</td></tr>
        <tr><th>Occupant B</th><td>${occ(b)}</td></tr>
        <tr><th>Outcome</th><td><strong>${C.charLink(ctx, dead.slug)} stopped.</strong> ${C.charLink(ctx, alive.slug)} ${e.round === ctx.site.config.finalRound ? 'became one of the Sixteen' : `proceeded to Round ${e.round + 1}`}.</td></tr>
        <tr><th>Filed</th><td>${e.founding ? 'Founding text, ' : e.author ? `${esc(e.author)}, ` : ''}${esc(e.submitted || '—')} · ${e.words} words</td></tr>
        <tr><th>Review</th><td>${esc(C.reviewText(ctx, e.votes))}</td></tr>
      </table>
    </header>
    <div class="record-rule"><span>Account follows</span></div>`;
  },

  characterHero(ctx, c) {
    const C = ctx.c;
    const stamp = c.status === 'sixteen' ? 'One of the Sixteen' : c.status === 'stopped' ? `Stopped · R${pad2(c.deathRound)}` : 'In play';
    return `<header class="record subject">
      <div class="record-top"><span>Subject file</span><span class="rec-id">${esc(c.slug.toUpperCase())}</span></div>
      <h1 class="record-title">${esc(c.name)}</h1>
      <div class="stamp stamp-${c.status}" aria-hidden="true">${esc(stamp)}</div>
      <table class="record-fields">
        ${c.aliases?.length ? `<tr><th>Also known as</th><td>${c.aliases.map(esc).join(', ')}</td></tr>` : ''}
        <tr><th>Source</th><td>${esc(c.source || 'Unrecorded')}</td></tr>
        <tr><th>Status</th><td>${esc(C.statusWord(c))}${c.sixteenHow === 'final-round' ? ` (won Round ${ctx.site.config.finalRound})` : ''}</td></tr>
        <tr><th>Rooms on record</th><td>${c.encounterCount} of a possible ${c.deathRound ?? ctx.site.config.finalRound}</td></tr>
        ${c.updated ? `<tr><th>File updated</th><td>${esc(c.updated)}</td></tr>` : ''}
      </table>
    </header>`;
  },

  roundLabel: (ctx, r) => `<a class="rl" href="${ctx.href(`rounds/${r}/`)}">Round ${String(r).padStart(2, '0')}</a>`,
};

export default {
  id: 'dossier',
  name: 'Dossier',
  tagline: 'The archive as a filing system',
  blurb: 'Clinical and typed, in the manner of SCP: room records and subject files, a filing sidebar, rubber stamps. The fiction reads as evidence.',
  mock: `<div class="m-dossier"><div class="bar">THE BRACKET · ARCHIVE OF ROOMS</div><div class="side">INTRODUCTION<br>ROOM RECORDS<br>SUBJECT FILES<br>THE SIXTEEN<br>ROUNDS</div><div class="doc">ROOM RECORD E-0004<br>ROUND 03 · OCCUPANTS 2<br>OUTCOME: ORANGE STOPPED</div><div class="stamp">RATIFIED</div></div>`,
  shell,
  components,
};
