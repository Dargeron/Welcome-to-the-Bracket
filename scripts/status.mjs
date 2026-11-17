#!/usr/bin/env node
// Answers "what can I still write?"
//
//   node scripts/status.mjs                 summary of the whole Bracket
//   node scripts/status.mjs "Frieren"       one character: record + open rounds
//   node scripts/status.mjs --round 3       one round: what's been written
//   node scripts/status.mjs --open          every character that still has open rounds

import { loadCanon, analyze, findCharacter } from './lib/canon.mjs';
import { rangeList, fmtInt } from './lib/util.mjs';

const args = process.argv.slice(2);
const canon = loadCanon();
const { state, errors } = analyze(canon);
const { config } = canon;
if (errors.length) console.warn(`(warning: canon has ${errors.length} problem(s); run npm run validate)\n`);

function describe(c) {
  const lines = [];
  const status = c.status === 'stopped' ? `stopped in Round ${c.deathRound} (${c.deathId})` : c.status === 'sixteen' ? `ONE OF THE SIXTEEN (${c.sixteenHow})` : 'in play';
  lines.push(`${c.name}${c.source ? ` — ${c.source}` : ''}`);
  lines.push(`  status: ${status}`);
  lines.push(`  character entry: ${c.file ? c.file.relFile : 'none yet'}`);
  for (let r = 1; r <= config.finalRound; r++) {
    const rec = c.rounds[r];
    const open = c.open.find((o) => o.round === r);
    let cell;
    if (rec) cell = `${rec.id}  ${rec.outcome === 'stopped' ? 'STOPPED' : 'survived'} vs ${state.characters.get(rec.opponent).name}`;
    else if (open) cell = open.mustSurvive ? 'open — must survive' : 'open — may survive or stop';
    else if (c.deathRound != null && r > c.deathRound) cell = '(after their death)';
    else cell = '(round is full)';
    lines.push(`  R${String(r).padStart(2)}: ${cell}`);
  }
  return lines.join('\n');
}

if (args[0] === '--round') {
  const r = Number(args[1]);
  const round = state.rounds[r];
  if (!round) {
    console.error(`Round must be 1–${config.finalRound}.`);
    process.exit(1);
  }
  console.log(`Round ${r}: ${fmtInt(round.entrants)} entrants, ${fmtInt(round.rooms)} rooms, ${round.encounters.length} written.`);
  for (const id of round.encounters) {
    const e = state.accepted.find((x) => x.id === id);
    console.log(`  ${id}  ${e.title} — ${e.characters.map((c) => c.name).join(' vs ')}; ${e.died} stopped`);
  }
} else if (args[0] === '--open') {
  for (const c of [...state.characters.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    if (c.full) continue;
    const either = c.open.filter((o) => !o.mustSurvive).map((o) => o.round);
    const must = c.open.filter((o) => o.mustSurvive).map((o) => o.round);
    console.log(`${c.name}: ${must.length ? `R${rangeList(must)} must survive` : ''}${must.length && either.length ? '; ' : ''}${either.length ? `R${rangeList(either)} either` : ''}`);
  }
} else if (args.length) {
  const c = findCharacter(state, args.join(' '));
  if (!c) {
    console.log(`"${args.join(' ')}" is not on record yet. Every round from 1 to ${config.finalRound} is open for them (unless the Sixteen are full and you want them to win Round ${config.finalRound}).`);
  } else console.log(describe(c));
} else {
  console.log(`The Bracket — ${fmtInt(config.entrants)} entrants, Timeline Rounds 1–${config.finalRound}.`);
  console.log(`Encounters: ${state.accepted.length} · Characters on record: ${state.characters.size} · Next id: ${state.nextId}`);
  console.log(`The Sixteen (${state.sixteen.length}/${config.sixteen}): ${state.sixteen.map((s) => s.name).join(', ') || 'none yet'}`);
  console.log('\nTry: npm run status -- "Frieren"   |   npm run status -- --round 3   |   npm run status -- --open');
}
