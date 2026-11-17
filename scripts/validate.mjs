#!/usr/bin/env node
// Checks that the whole archive obeys the rules of the Bracket.
//
//   node scripts/validate.mjs                 validate canon
//   node scripts/validate.mjs --submissions   also dry-run everything in submissions/
//
// Exit code 1 if anything is wrong.

import { loadCanon, analyze, loadSubmissions } from './lib/canon.mjs';
import { tryAccept } from './lib/accession.mjs';

const args = process.argv.slice(2);
const canon = loadCanon();
const { errors, state } = analyze(canon);

let failed = false;
if (errors.length) {
  failed = true;
  console.error(`✗ Canon has ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e.file}${e.id ? ` (${e.id})` : ''}: ${e.message}`);
} else {
  console.log(
    `✓ Canon is consistent: ${state.accepted.length} encounters, ${state.characters.size} characters, ` +
      `${state.sixteen.length}/${canon.config.sixteen} of the Sixteen named, Timeline = Rounds 1–${canon.config.finalRound}.`
  );
}

if (args.includes('--submissions')) {
  const subs = loadSubmissions();
  if (!subs.length) console.log('  (no files in submissions/)');
  let working = canon;
  for (const s of subs) {
    const res = tryAccept(working, s);
    if (res.ok) {
      console.log(`✓ ${s.relFile} would be accepted as ${res.entry.id}.`);
      working = res.canon;
    } else {
      failed = true;
      console.error(`✗ ${s.relFile} would be rejected:`);
      for (const m of res.reasons) console.error(`  - ${m}`);
    }
  }
}

process.exit(failed ? 1 : 0);
