// Every page on the site, independent of theme. Each returns:
//   { path, title, nav, description, body, bare?, crumbs? }
// `body` is a function of ctx so links resolve relative to the page.

import { esc, fmtInt, rangeList } from '../scripts/lib/util.mjs';
import { excerpt } from '../scripts/lib/markdown.mjs';
import { trailerMarkup } from './trailer.mjs';

function fill(ctx, md) {
  const { config } = ctx.site;
  const vars = {
    entrants: fmtInt(config.entrants),
    totalRounds: config.totalRounds,
    finalRound: config.finalRound,
    afterFinal: config.finalRound + 1,
    sixteen: config.sixteen,
    quorum: config.voting.quorum,
    threshold: config.voting.removeIfMedianBelow,
    minWords: config.encounter.minWords,
    repo: config.repo,
    repoUrl: config.repoUrl,
    roomsFinal: fmtInt(config.entrants / 2 ** config.finalRound),
    roomsFirst: fmtInt(config.entrants / 2),
  };
  return md.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function blocks(ctx, html) {
  const c = ctx.c;
  const map = {
    'rounds-table': () => c.roundsTable(ctx),
    'sixteen-roster': () => c.sixteenRoster(ctx),
    'random-controls': () => c.randomControls(ctx),
    stats: () => c.stats(ctx),
    'write-button': () => `<p><a class="btn btn-primary" href="${ctx.gh.newEncounter()}" rel="noopener">Write an encounter</a> <a class="btn" href="${ctx.gh.characterEntry('')}" rel="noopener">Write a character entry</a></p>`,
  };
  return html.replace(/<p>\{\{\s*([\w-]+)\s*\}\}<\/p>/g, (m, k) => (map[k] ? map[k]() : m));
}

function contentPage(ctx, name) {
  const page = ctx.site.content[name];
  return blocks(ctx, ctx.md(fill(ctx, page.body)));
}

export function allPages(site) {
  const pages = [];
  const { config } = site;

  // --- trailer (landing page #1) ---------------------------------------------
  pages.push({
    path: '',
    title: `${config.siteName}: ${config.tagline}`,
    nav: 'trailer',
    bare: true,
    description: config.description,
    body: (ctx) => trailerMarkup(ctx),
  });

  // --- introduction (landing page #2) ------------------------------------------
  pages.push({
    path: 'introduction/',
    title: 'Introduction',
    nav: 'introduction',
    description: 'The rules of the Bracket, and the rules of this archive.',
    hideNewcomer: true,
    body: (ctx) => `<article class="prose page-intro">${contentPage(ctx, 'introduction')}</article>`,
  });

  // --- hub ---------------------------------------------------------------------
  pages.push({
    path: 'archive/',
    title: 'The Archive',
    nav: 'archive',
    description: config.description,
    body: (ctx) => ctx.c.hub(ctx),
  });

  pages.push({
    path: 'contribute/',
    title: 'Contribute',
    nav: 'contribute',
    description: 'How to write an encounter, write a character entry, and vote.',
    body: (ctx) => `<article class="prose">${contentPage(ctx, 'contribute')}</article>`,
  });

  if (site.content['founding-text']) {
    pages.push({
      path: 'founding-text/',
      title: 'Everyone But Sixteen (founding text)',
      nav: 'archive',
      description: 'The story the archive grew from, in its original order.',
      body: (ctx) => {
        const links = site.encounters.filter((e) => e.founding).map((e) => ctx.c.encLink(ctx, e)).join(', ');
        return `<article class="prose founding"><p class="lede">This is the story the archive grew from, in its original order. Its rooms are also filed one by one: ${links}.</p>${ctx.md(site.content['founding-text'].body)}</article>`;
      },
    });
  }

  // --- encounters ---------------------------------------------------------------
  pages.push({
    path: 'encounters/',
    title: 'All encounters',
    nav: 'encounters',
    description: 'Every encounter in the archive, in order of arrival.',
    body: (ctx) => `<header class="page-head"><h1>All encounters</h1><p class="lede">${site.encounters.length} encounters, in order of arrival. Each one is a single room: two characters, one round, one who walks out.</p></header>
      ${ctx.c.roundRail(ctx)}
      ${ctx.c.encounterList(ctx, site.encounters)}
      ${ctx.c.randomControls(ctx)}`,
  });

  for (const e of site.encounters) {
    pages.push({
      path: e.path,
      title: `${e.id}: ${e.title}`,
      nav: 'encounters',
      description: `Round ${e.round}. ${e.slugs.map((s) => site.characters.get(s).name).join(' and ')}. ${excerpt(e.body, 140)}`,
      crumbs: [['Encounters', 'encounters/'], [`Round ${e.round}`, `rounds/${e.round}/`], [e.id, null]],
      body: (ctx) => `${ctx.c.encounterHero(ctx, e)}
        <article class="prose enc-body">${ctx.md(e.body)}</article>
        ${ctx.c.encounterNote(ctx, e)}
        ${ctx.c.connections(ctx, e)}
        ${ctx.c.voteWidget(ctx, e)}
        ${ctx.c.backlinks(ctx, e.path)}
        ${ctx.c.sourceLinks(ctx, e.relFile)}`,
    });
  }

  // --- characters -----------------------------------------------------------------
  const chars = [...site.characters.values()].sort((a, b) => a.name.localeCompare(b.name));
  pages.push({
    path: 'characters/',
    title: 'Characters',
    nav: 'characters',
    description: 'Everyone on record in the archive.',
    body: (ctx) => {
      const group = (title, list, blurb) =>
        list.length ? `<section class="char-group"><h2>${title} <span class="count">${list.length}</span></h2><p class="muted">${blurb}</p>${ctx.c.characterTable(ctx, list)}</section>` : '';
      return `<header class="page-head"><h1>Characters</h1><p class="lede">${chars.length} characters are on record. A character appears here as soon as one encounter mentions them; the reconstruction on their page is written afterwards, from the encounters alone.</p></header>
        ${group('The Sixteen', chars.filter((c) => c.status === 'sixteen'), `They reach the end of the Timeline. They cannot stop in any encounter.`)}
        ${group('In play', chars.filter((c) => c.status === 'in-play'), 'Alive at their last recorded room.')}
        ${group('Stopped', chars.filter((c) => c.status === 'stopped'), 'Their death is on record. No encounter may place them in a later round.')}
        <p>Want to write about someone who isn't here yet? Every character from every anime ever made is in the Bracket. <a href="${ctx.gh.newEncounter()}" rel="noopener">Write their first room.</a></p>`;
    },
  });

  for (const c of chars) {
    pages.push({
      path: c.path,
      title: c.name,
      nav: 'characters',
      description: `${c.name}${c.source ? ` (${c.source})` : ''}. ${c.status === 'stopped' ? `Stopped in Round ${c.deathRound}.` : c.status === 'sixteen' ? 'One of the Sixteen.' : 'In play.'}`,
      crumbs: [['Characters', 'characters/'], [c.name, null]],
      body: (ctx) => `${ctx.c.characterHero(ctx, c)}
        ${ctx.c.roundStrip(ctx, c)}
        ${ctx.c.characterBody(ctx, c)}
        ${ctx.c.characterHistory(ctx, c)}
        ${ctx.c.openRounds(ctx, c)}
        ${ctx.c.backlinks(ctx, c.path)}
        ${c.relFile ? ctx.c.sourceLinks(ctx, c.relFile, ` · <a href="${ctx.gh.characterEntry(c.name)}" rel="noopener">Propose a new version</a>`) : ''}`,
    });
  }

  // --- rounds ---------------------------------------------------------------------
  pages.push({
    path: 'rounds/',
    title: 'Rounds',
    nav: 'rounds',
    description: `The Timeline: Rounds 1 to ${config.finalRound}.`,
    body: (ctx) => `<header class="page-head"><h1>Rounds</h1><p class="lede">${fmtInt(config.entrants)} entrants, halved every round. The Timeline covers Rounds 1 to ${config.finalRound}; at the end of Round ${config.finalRound}, sixteen are left. What happens to them in Rounds ${config.finalRound + 1}–${config.totalRounds} is never written.</p></header>
      ${ctx.c.roundRail(ctx)}
      ${ctx.c.roundsTable(ctx)}`,
  });

  for (const r of site.rounds) {
    pages.push({
      path: r.path,
      title: `Round ${r.round}`,
      nav: 'rounds',
      description: `Round ${r.round}: ${fmtInt(r.entrants)} entrants in ${fmtInt(r.rooms)} rooms.`,
      crumbs: [['Rounds', 'rounds/'], [`Round ${r.round}`, null]],
      body: (ctx) => `${ctx.c.roundRail(ctx, r.round)}
        <header class="page-head round-head"><div class="kicker">Round ${r.round} of ${config.finalRound}</div><h1>Round ${r.round}</h1>
        <p class="lede">${fmtInt(r.entrants)} entrants walk into ${fmtInt(r.rooms)} rooms; ${fmtInt(r.rooms)} walk out.${r.round === config.finalRound ? ' Everyone who walks out of a room in this round is one of the Sixteen.' : ''} ${r.list.length} of these rooms ${r.list.length === 1 ? 'is' : 'are'} on record.</p>
        <p>${r.list.length ? `<a class="btn" href="${ctx.href(`random/?round=${r.round}`)}">Random Round ${r.round} encounter</a> ` : ''}<a class="btn" href="${ctx.gh.newEncounter({ round: r.round })}" rel="noopener">Write a Round ${r.round} room</a></p></header>
        ${ctx.c.encounterList(ctx, r.list, { showRound: false })}
        <nav class="prevnext">${r.round > 1 ? `<a href="${ctx.href(`rounds/${r.round - 1}/`)}">← Round ${r.round - 1}</a>` : '<span></span>'}${r.round < config.finalRound ? `<a href="${ctx.href(`rounds/${r.round + 1}/`)}">Round ${r.round + 1} →</a>` : '<span class="muted">The Timeline ends here.</span>'}</nav>`,
    });
  }

  // --- the Sixteen --------------------------------------------------------------------
  pages.push({
    path: 'sixteen/',
    title: 'The Sixteen',
    nav: 'sixteen',
    description: 'The sixteen who are left at the end of the Timeline.',
    body: (ctx) => `<header class="page-head"><h1>The Sixteen</h1><p class="lede">Sixteen are left. ${site.sixteen.length} of them are known. ${config.sixteen - site.sixteen.length} places are unclaimed.</p></header>
      ${ctx.c.sixteenRoster(ctx)}
      <section class="prose"><h2>How someone becomes one of the Sixteen</h2>
      <ul><li><strong>By character entry.</strong> A character entry may designate its character as one of the Sixteen, as long as places remain and the character has not stopped on record.</li>
      <li><strong>By winning Round ${config.finalRound}.</strong> Whoever walks out of a Round ${config.finalRound} room is one of the Sixteen. There are exactly ${config.sixteen} Round ${config.finalRound} rooms.</li></ul>
      <p>Once someone is one of the Sixteen, no encounter may kill them, and no two of the Sixteen can ever share a room. When all ${config.sixteen} places are taken, every Round ${config.finalRound} room has to be won by one of them.</p></section>`,
  });

  // --- deprecated ---------------------------------------------------------------------
  pages.push({
    path: 'deprecated/',
    title: 'Deprecated entries',
    nav: 'deprecated',
    description: 'Encounters removed from canon by vote.',
    body: (ctx) => `<header class="page-head"><h1>Deprecated entries</h1><p class="lede">Once an encounter has at least ${config.voting.quorum} votes, it leaves canon the moment the median of all its votes falls below ${config.voting.removeIfMedianBelow}, and is kept here. Deprecated entries bind nothing: the rounds they used are open again, and the deaths they described did not happen.</p></header>
      ${site.deprecated.length ? `<ul class="dep-list">${site.deprecated.map((e) => `<li><a href="${ctx.href(e.path)}">${esc(e.id)}: ${esc(e.title)}</a> <span class="muted">Round ${e.round} · median ${e.deprecated?.median ?? '?'}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing has been deprecated.</p>'}`,
  });

  for (const e of site.deprecated) {
    pages.push({
      path: e.path,
      title: `${e.id}: ${e.title} (deprecated)`,
      nav: 'deprecated',
      description: 'A deprecated encounter. Not canon.',
      crumbs: [['Deprecated', 'deprecated/'], [e.id, null]],
      body: (ctx) => `<div class="dep-banner"><strong>Deprecated.</strong> This encounter was removed from canon by vote${e.deprecated?.votes ? ` (${e.deprecated.votes.length} votes: ${e.deprecated.votes.join(', ')}; median ${e.deprecated.median})` : ''}. Nothing in it is binding.</div>
        <header class="page-head"><div class="kicker">${esc(e.id)} · Round ${esc(e.round)}</div><h1>${esc(e.title)}</h1><p class="muted">${e.characters.map((c) => esc(c.name)).join(' and ')} · ${esc(e.died)} stopped${e.author ? ` · by ${esc(e.author)}` : ''}</p></header>
        <article class="prose enc-body">${ctx.md(e.body)}</article>
        ${ctx.c.sourceLinks(ctx, e.relFile)}`,
    });
  }

  // --- tools -------------------------------------------------------------------------
  pages.push({
    path: 'random/',
    title: 'Random',
    nav: 'random',
    description: 'A random page from the archive.',
    body: (ctx) => `<header class="page-head"><h1 data-random-msg>Choosing a room…</h1></header>
      <noscript><p>Random pages need JavaScript. Browse <a href="${ctx.href('encounters/')}">all encounters</a> instead.</p></noscript>
      <div data-random-empty hidden><p>Nothing matches yet. That round is entirely unwritten.</p><p><a class="btn" href="${ctx.gh.newEncounter()}" rel="noopener">Write the first one</a></p></div>
      ${ctx.c.randomControls(ctx)}`,
  });

  pages.push({
    path: 'search/',
    title: 'Search',
    nav: 'search',
    description: 'Search the archive.',
    body: (ctx) => `<header class="page-head"><h1>Search</h1></header>
      <form class="search search-big" action="" method="get" role="search" data-search-form><input type="search" name="q" placeholder="A character, an encounter, a source…" aria-label="Search" autofocus><button type="submit">Search</button></form>
      <div class="search-results" data-search-results aria-live="polite"></div>
      <noscript><p>Search needs JavaScript. Browse <a href="${ctx.href('characters/')}">characters</a> or <a href="${ctx.href('encounters/')}">encounters</a>.</p></noscript>`,
  });

  pages.push({
    path: '404.html',
    file: '404.html',
    title: 'Not found',
    nav: '',
    description: 'No such page.',
    absolute: true,
    body: (ctx) => `<header class="page-head"><h1>No room here</h1><p class="lede">Nobody has written this page. That isn't the same as it not existing.</p></header>
      <p><a class="btn" href="${ctx.href('archive/')}">Back to the archive</a> <a class="btn" href="${ctx.href('random/')}">Somewhere random</a></p>`,
  });

  return pages;
}

/** Entries for the client-side search and random index. */
export function searchIndex(site) {
  const items = [];
  for (const e of site.encounters)
    items.push({ k: 'encounter', t: `${e.id}: ${e.title}`, u: e.path, r: e.round, c: e.slugs.map((s) => site.characters.get(s).name), x: e.excerpt });
  for (const c of site.characters.values())
    items.push({ k: 'character', t: c.name, u: c.path, a: c.aliases, s: c.source, st: c.status, x: excerpt(c.body, 160) });
  for (const r of site.rounds) items.push({ k: 'round', t: `Round ${r.round}`, u: r.path, r: r.round });
  for (const e of site.deprecated) items.push({ k: 'deprecated', t: `${e.id}: ${e.title} (deprecated)`, u: e.path, r: e.round, x: e.excerpt });
  items.push({ k: 'page', t: 'Introduction', u: 'introduction/' }, { k: 'page', t: 'The Sixteen', u: 'sixteen/' }, { k: 'page', t: 'Contribute', u: 'contribute/' }, { k: 'page', t: 'Founding text: Everyone But Sixteen', u: 'founding-text/' });
  return items;
}

export { rangeList };
