// Loads bracket.config.json and derives every number the rules depend on.
// Nothing about round counts is hard-coded anywhere else: change `entrants`
// or `sixteen` here and the validator, the ledger and the site all follow.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const PATHS = {
  config: path.join(ROOT, 'bracket.config.json'),
  encounters: path.join(ROOT, 'entries', 'encounters'),
  characters: path.join(ROOT, 'entries', 'characters'),
  deprecated: path.join(ROOT, 'entries', 'deprecated'),
  submissions: path.join(ROOT, 'submissions'),
  rejected: path.join(ROOT, 'submissions', 'rejected'),
  votes: path.join(ROOT, 'votes'),
  content: path.join(ROOT, 'content'),
  site: path.join(ROOT, 'site'),
  out: path.join(ROOT, '_site'),
};

function log2Exact(n, label) {
  const l = Math.log2(n);
  if (!Number.isInteger(l) || l < 1) {
    throw new Error(`bracket.config.json: "${label}" must be a power of two (got ${n}).`);
  }
  return l;
}

export function loadConfig() {
  const raw = JSON.parse(fs.readFileSync(PATHS.config, 'utf8'));
  const totalRounds = log2Exact(raw.entrants, 'entrants');
  const sixteenExp = log2Exact(raw.sixteen, 'sixteen');
  // The Timeline is every round up to and including the one that leaves
  // exactly `sixteen` entrants alive. 2,097,152 = 2^21 and 16 = 2^4, so the
  // Timeline is Rounds 1..17. Rounds 18..21 happen after the Timeline ends
  // and are never written.
  const finalRound = totalRounds - sixteenExp;
  if (finalRound < 1) throw new Error('bracket.config.json: "sixteen" must be smaller than "entrants".');
  const [owner, repoName] = String(raw.repo || '').split('/');
  return {
    ...raw,
    owner,
    repoName,
    totalRounds,
    finalRound,
    repoUrl: `https://github.com/${raw.repo}`,
  };
}

/** How many entrants walk into Round r. */
export function entrantsAt(config, r) {
  return config.entrants / 2 ** (r - 1);
}

/** How many rooms exist in Round r. */
export function roomsAt(config, r) {
  return config.entrants / 2 ** r;
}
