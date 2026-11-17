// The ledger: the current state of the Bracket, derived entirely from canon.
// Written to LEDGER.md (for reading) and ledger.json (for tools) at the repo
// root, and to the published site. Never edit either by hand.

import { voteSummary } from './canon.mjs';
import { fmtInt, rangeList, slugify } from './util.mjs';

export function buildLedger(canon, analysis) {
  const { config } = canon;
  const { state } = analysis;
  const chars = [...state.characters.values()].sort((a, b) => a.name.localeCompare(b.name));

  const characters = chars.map((c) => ({
    name: c.name,
    slug: c.slug,
    aliases: c.aliases,
    source: c.source || null,
    status: c.status, // 'in-play' | 'stopped' | 'sixteen'
    sixteen: c.sixteen ? c.sixteenHow : null,
    stoppedInRound: c.deathRound,
    stoppedIn: c.deathId,
    encounters: Object.entries(c.rounds)
      .map(([r, v]) => ({ round: Number(r), id: v.id, outcome: v.outcome, opponent: state.characters.get(v.opponent)?.name }))
      .sort((a, b) => a.round - b.round),
    openRounds: c.open.map((o) => ({ round: o.round, mustSurvive: o.mustSurvive })),
    full: c.full,
    hasEntry: Boolean(c.file),
    url: `characters/${c.slug}/`,
  }));

  const encounters = state.accepted
    .slice()
    .sort((a, b) => a.num - b.num)
    .map((e) => {
      const vs = voteSummary(config, e, canon.votes[e.id]);
      return {
        id: e.id,
        title: e.title,
        round: e.round,
        characters: e.characters.map((c) => state.characters.get(slugify(c.name))?.name ?? c.name),
        stopped: state.characters.get(e.deadSlug).name,
        survived: state.characters.get(e.aliveSlug).name,
        author: e.author || null,
        submitted: e.submitted || null,
        review: { status: vs.status, votes: vs.count, quorum: vs.quorum, median: vs.trialMedian },
        file: e.relFile,
        url: `encounters/${e.id.toLowerCase()}/`,
      };
    });

  const rounds = Object.values(state.rounds).map((r) => ({
    round: r.round,
    entrants: r.entrants,
    rooms: r.rooms,
    written: r.encounters.length,
    encounters: r.encounters,
  }));

  return {
    generated: 'Derived from entries/ by scripts/ledger.mjs. Do not edit by hand.',
    rules: {
      entrants: config.entrants,
      totalRounds: config.totalRounds,
      timeline: { firstRound: 1, finalRound: config.finalRound },
      sixteen: config.sixteen,
      maxEncountersPerCharacter: config.finalRound,
      voting: config.voting,
    },
    nextEncounterId: state.nextId,
    sixteen: {
      named: state.sixteen.length,
      open: config.sixteen - state.sixteen.length,
      members: state.sixteen.map((s) => ({ name: s.name, how: s.how, via: s.via })),
    },
    characters,
    encounters,
    rounds,
    deprecated: canon.deprecated.map((e) => ({ id: e.id, title: e.title, round: e.round, file: e.relFile, median: e.deprecated?.median ?? null })),
  };
}

function openText(c) {
  if (c.full) return '— (full)';
  const either = c.openRounds.filter((o) => !o.mustSurvive).map((o) => o.round);
  const survive = c.openRounds.filter((o) => o.mustSurvive).map((o) => o.round);
  const parts = [];
  if (survive.length) parts.push(`${rangeList(survive)} (must survive)`);
  if (either.length) parts.push(`${rangeList(either)} (either)`);
  return parts.join('; ');
}

export function ledgerMarkdown(ledger) {
  const L = [];
  const R = ledger.rules;
  L.push('# Ledger of the Bracket');
  L.push('');
  L.push('> **Generated file.** This is the current state of the archive, derived from `entries/` by `scripts/ledger.mjs`.');
  L.push('> It is rebuilt automatically after every accepted change. Do not edit it by hand.');
  L.push('');
  L.push(`- Entrants: **${fmtInt(R.entrants)}** (${R.totalRounds} rounds in total)`);
  L.push(`- The Timeline: **Rounds 1–${R.timeline.finalRound}**. The survivors of Round ${R.timeline.finalRound} are the Sixteen.`);
  L.push(`- Encounters in canon: **${ledger.encounters.length}** · Characters on record: **${ledger.characters.length}** · Deprecated: **${ledger.deprecated.length}**`);
  L.push(`- Next accession number: **${ledger.nextEncounterId}**`);
  L.push('');
  L.push(`## The Sixteen (${ledger.sixteen.named} named, ${ledger.sixteen.open} unclaimed)`);
  L.push('');
  L.push('| # | Name | How |');
  L.push('|---|------|-----|');
  for (let i = 0; i < R.sixteen; i++) {
    const m = ledger.sixteen.members[i];
    L.push(m ? `| ${i + 1} | ${m.name} | ${m.how === 'designated' ? 'designated by character entry' : `won Round ${R.timeline.finalRound} (${m.via})`} |` : `| ${i + 1} | _unclaimed_ | |`);
  }
  L.push('');
  L.push('## Characters');
  L.push('');
  L.push('Open rounds are rounds with no encounter yet. **must survive** = the character is already on record alive later (or is one of the Sixteen), so in that round they must be the one who walks out. **either** = they may survive or stop.');
  L.push('');
  L.push('| Character | Status | On record | Open rounds |');
  L.push('|-----------|--------|-----------|-------------|');
  for (const c of ledger.characters) {
    const status = c.status === 'stopped' ? `stopped in R${c.stoppedInRound} (${c.stoppedIn})` : c.status === 'sixteen' ? '**one of the Sixteen**' : 'in play';
    const rec = c.encounters.map((e) => `R${e.round} ${e.id} ${e.outcome === 'stopped' ? '✝' : '✓'} vs ${e.opponent}`).join('<br>') || '—';
    L.push(`| ${c.name}${c.hasEntry ? '' : ' _(no entry yet)_'} | ${status} | ${rec} | ${openText(c)} |`);
  }
  L.push('');
  L.push('## Encounters (in order of arrival)');
  L.push('');
  L.push('| ID | Round | Title | Characters | Stopped | Review |');
  L.push('|----|-------|-------|------------|---------|--------|');
  for (const e of ledger.encounters) {
    const rv = e.review.status === 'review' ? `under review (${e.review.votes}/${e.review.quorum})` : e.review.status === 'ratified' ? `ratified (median ${e.review.median})` : e.review.status;
    L.push(`| [${e.id}](${e.file}) | ${e.round} | ${e.title} | ${e.characters.join(' vs ')} | ${e.stopped} | ${rv} |`);
  }
  L.push('');
  L.push('## Rounds');
  L.push('');
  L.push('| Round | Entrants | Rooms | Written |');
  L.push('|-------|----------|-------|---------|');
  for (const r of ledger.rounds) L.push(`| ${r.round} | ${fmtInt(r.entrants)} | ${fmtInt(r.rooms)} | ${r.written}${r.encounters.length ? ` (${r.encounters.join(', ')})` : ''} |`);
  L.push('');
  L.push('## Deprecated');
  L.push('');
  if (!ledger.deprecated.length) L.push('_None._');
  for (const d of ledger.deprecated) L.push(`- [${d.id}](${d.file}) ${d.title} (Round ${d.round}), median ${d.median}`);
  L.push('');
  return L.join('\n');
}
