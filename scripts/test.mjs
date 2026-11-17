#!/usr/bin/env node
// Tests for the rules engine, run against synthetic canons (not the real archive).
//   node scripts/test.mjs

import assert from 'node:assert/strict';
import { analyze, voteSummary } from './lib/canon.mjs';
import { tryAccept, tryCharacter, tryVote } from './lib/accession.mjs';
import { loadConfig } from './lib/config.mjs';
import { encounterDraftFromIssue, voteFromIssue, characterDraftFromIssue } from './lib/issue.mjs';

const config = loadConfig();
const WORDS = Array.from({ length: config.encounter.minWords + 5 }, (_, i) => `word${i}`).join(' ');
let n = 0;

function enc(id, round, a, b, died, extra = {}) {
  const num = Number(id.slice(1));
  return {
    kind: 'encounter', file: `/x/${id}-t.md`, relFile: `entries/encounters/${id}-t.md`, id, num, title: `T${id}`, round,
    characters: [{ name: a, source: '' }, { name: b, source: '' }], died, author: 't', body: WORDS, founding: false, deprecated: null, raw: {}, ...extra,
  };
}
function chr(name, sixteen = false) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return { kind: 'character', file: `/x/${slug}.md`, relFile: `entries/characters/${slug}.md`, name, aliases: [], source: '', sixteen, body: 'x' };
}
function canon(encounters = [], characters = [], votes = {}) {
  return { config, encounters, characters, deprecated: [], votes };
}
function draft(round, a, b, died) {
  return { title: 'Draft', round, characters: [{ name: a, source: 'S' }, { name: b, source: 'S' }], died, author: 't', body: WORDS };
}
function test(name, fn) {
  try {
    fn();
    n++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}

console.log(`Rules engine (Timeline = Rounds 1–${config.finalRound}, ${config.sixteen} Sixteen)`);

test('derives the Timeline from the entrant count', () => {
  assert.equal(config.totalRounds, 20);
  assert.equal(config.finalRound, 16);
});

test('an empty archive is consistent', () => {
  assert.deepEqual(analyze(canon()).errors, []);
});

test('accepts a first encounter and assigns E0001', () => {
  const r = tryAccept(canon(), draft(1, 'A', 'B', 'B'));
  assert.ok(r.ok, r.reasons?.join());
  assert.equal(r.entry.id, 'E0001');
});

test('one room per round per character', () => {
  const c = canon([enc('E0001', 3, 'A', 'B', 'B')]);
  const r = tryAccept(c, draft(3, 'A', 'C', 'C'));
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(), /already has a Round 3/);
});

test('death is final: no appearance after stopping', () => {
  const c = canon([enc('E0001', 4, 'A', 'B', 'A')]);
  assert.equal(tryAccept(c, draft(5, 'A', 'C', 'C')).ok, false);
  assert.ok(tryAccept(c, draft(2, 'A', 'C', 'C')).ok, 'earlier rounds remain open (A must survive them)');
});

test('cannot kill someone already on record alive later', () => {
  const c = canon([enc('E0001', 9, 'A', 'B', 'B')]);
  const r = tryAccept(c, draft(4, 'A', 'C', 'A'));
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(), /alive in Round 9/);
});

test('a character can die only once', () => {
  const c = canon([enc('E0001', 2, 'A', 'B', 'A')]);
  assert.equal(tryAccept(c, draft(1, 'A', 'C', 'A')).ok, false);
});

test('the Sixteen cannot stop', () => {
  const c = canon([], [chr('Johan', true)]);
  assert.equal(tryAccept(c, draft(3, 'Johan', 'X', 'Johan')).ok, false);
  assert.ok(tryAccept(c, draft(3, 'Johan', 'X', 'X')).ok);
});

test('two of the Sixteen cannot share a room', () => {
  const c = canon([], [chr('Johan', true), chr('Frieren', true)]);
  assert.equal(tryAccept(c, draft(5, 'Johan', 'Frieren', 'Frieren')).ok, false);
});

test('final-round survivor becomes one of the Sixteen', () => {
  const c = canon([enc('E0001', config.finalRound, 'A', 'B', 'B')]);
  const { state, errors } = analyze(c);
  assert.deepEqual(errors, []);
  assert.equal(state.characters.get('a').sixteen, true);
  assert.equal(state.characters.get('a').sixteenHow, 'final-round');
});

test('no new Sixteen once all places are taken', () => {
  const chars = Array.from({ length: config.sixteen }, (_, i) => chr(`S${i}`, true));
  const c = canon([], chars);
  assert.equal(tryAccept(c, draft(config.finalRound, 'New', 'Other', 'Other')).ok, false);
  assert.ok(tryAccept(c, draft(config.finalRound, 'S0', 'Other', 'Other')).ok);
});

test('designating a seventeenth Sixteen is rejected', () => {
  const chars = Array.from({ length: config.sixteen }, (_, i) => chr(`S${i}`, true));
  const r = tryCharacter(canon([], chars), { name: 'One More', sixteen: true, body: 'x' });
  assert.equal(r.ok, false);
});

test('cannot designate as Sixteen someone who has stopped', () => {
  const c = canon([enc('E0001', 2, 'A', 'B', 'A')]);
  const r = tryCharacter(c, { name: 'A', sixteen: true, body: 'x' });
  assert.equal(r.ok, false);
});

test('Sixteen designation cannot be removed by an edit', () => {
  const c = canon([], [chr('Johan', true)]);
  const r = tryCharacter(c, { name: 'Johan', sixteen: false, explicitSixteen: true, body: 'y' });
  assert.equal(r.ok, false);
});

test('the final round has only 16 rooms', () => {
  const F = config.finalRound;
  const es = Array.from({ length: 16 }, (_, i) => enc(`E${String(i + 1).padStart(4, '0')}`, F, `W${i}`, `L${i}`, `L${i}`));
  const c = canon(es);
  assert.deepEqual(analyze(c).errors, []);
  const r = tryAccept(c, draft(F, 'W0', 'Z', 'Z'));
  assert.equal(r.ok, false);
});

test('rounds outside the Timeline are rejected', () => {
  assert.equal(tryAccept(canon(), draft(config.finalRound + 1, 'A', 'B', 'B')).ok, false);
  assert.equal(tryAccept(canon(), draft(0, 'A', 'B', 'B')).ok, false);
});

test('`died` must be one of the two', () => {
  assert.equal(tryAccept(canon(), draft(1, 'A', 'B', 'C')).ok, false);
});

test('names match case-insensitively and via aliases', () => {
  const j = { ...chr('Johan Liebert'), aliases: ['Johan'] };
  const c = canon([enc('E0001', 1, 'Johan Liebert', 'Anpanman', 'Anpanman')], [j]);
  const r = tryAccept(c, draft(1, 'johan', 'X', 'X'));
  assert.equal(r.ok, false, 'Johan already has a Round 1');
  const r2 = tryAccept(c, draft(2, 'JOHAN', 'X', 'X'));
  assert.ok(r2.ok);
  assert.equal(r2.entry.characters[0].name, 'Johan Liebert');
});

test('order of arrival: the later conflicting entry is the one flagged', () => {
  const c = canon([enc('E0001', 3, 'A', 'B', 'B'), enc('E0002', 3, 'A', 'C', 'C')]);
  const { errors } = analyze(c);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].id, 'E0002');
});

test('open rounds: must-survive before last appearance, either after', () => {
  const { state } = analyze(canon([enc('E0001', 5, 'A', 'B', 'B')]));
  const a = state.characters.get('a');
  assert.deepEqual(a.open.filter((o) => o.mustSurvive).map((o) => o.round), [1, 2, 3, 4]);
  assert.equal(a.open.find((o) => o.round === 6).mustSurvive, false);
  const b = state.characters.get('b');
  assert.deepEqual(b.open.map((o) => o.round), [1, 2, 3, 4]);
  assert.ok(b.open.every((o) => o.mustSurvive));
});

test('voting: nothing is decided before the 5th vote', () => {
  const e = enc('E0001', 1, 'A', 'B', 'B');
  let c = canon([e]);
  let res;
  for (const s of [1, 1, 1, 1]) {
    res = tryVote(c, { id: 'E0001', score: s, voter: 'v' });
    c = { ...c, votes: { E0001: res.voteFile } };
  }
  assert.equal(res.summary.status, 'review');
  assert.equal(res.deprecate, false);
});

test('voting: at the 5th vote, a median under 5 deprecates', () => {
  const e = enc('E0001', 1, 'A', 'B', 'B');
  let c = canon([e]);
  let res;
  for (const s of [3, 4, 9, 2, 6]) {
    res = tryVote(c, { id: 'E0001', score: s, voter: 'v' });
    c = { ...c, votes: { E0001: res.voteFile } };
  }
  assert.equal(res.summary.median, 4);
  assert.equal(res.deprecate, true);
});

test('voting: median exactly 5 stays standing', () => {
  const e = enc('E0001', 1, 'A', 'B', 'B');
  const votes = { E0001: { encounter: 'E0001', votes: [5, 5, 1, 9, 2].map((score) => ({ score })) } };
  assert.equal(voteSummary(config, e, votes.E0001).status, 'standing');
});

test('voting: a standing entry is deprecated as soon as a later vote pulls the median under 5', () => {
  const e = enc('E0001', 1, 'A', 'B', 'B');
  let c = canon([e], [], { E0001: { encounter: 'E0001', votes: [6, 6, 6, 6, 6].map((score) => ({ score })) } });
  let res;
  for (let i = 0; i < 4; i++) {
    res = tryVote(c, { id: 'E0001', score: 1 });
    c = { ...c, votes: { E0001: res.voteFile } };
    assert.equal(res.deprecate, false, `still standing after ${res.summary.count} votes (median ${res.summary.median})`);
  }
  res = tryVote(c, { id: 'E0001', score: 1 }); // 5 ones, 5 sixes → median 3.5
  assert.equal(res.summary.median, 3.5);
  assert.equal(res.deprecate, true);
});

test('founding entries are never deprecated', () => {
  const e = enc('E0001', 1, 'A', 'B', 'B', { founding: true });
  const votes = { E0001: { encounter: 'E0001', votes: [1, 1, 1, 1].map((score) => ({ score })) } };
  const r = tryVote(canon([e], [], votes), { id: 'E0001', score: 1 });
  assert.equal(r.deprecate, false);
});

test('votes are validated', () => {
  const c = canon([enc('E0001', 1, 'A', 'B', 'B')]);
  assert.equal(tryVote(c, { id: 'E0001', score: 11 }).ok, false);
  assert.equal(tryVote(c, { id: 'E0001', score: 'seven' }).ok, false);
  assert.equal(tryVote(c, { id: 'E0099', score: 7 }).ok, false);
  assert.ok(tryVote(c, { id: 'e1', score: '7' }).ok, 'ids are normalised');
});

test('parses an encounter issue from the issue form', () => {
  const body = `### Title\n\nThe Test\n\n### Character A\n\nFrieren\n\n### Character A source\n\n_No response_\n\n### Character B\n\nSaitama\n\n### Character B source\n\nOne-Punch Man\n\n### Round\n\n4\n\n### Who died\n\nB\n\n### Author\n\n_No response_\n\n### The encounter\n\n${WORDS}\n\n### Author's note\n\nhello\n\n### Rules\n\n- [X] ok`;
  const d = encounterDraftFromIssue({ title: '[Encounter] The Test', body, user: { login: 'someone' }, number: 3 });
  assert.equal(d.title, 'The Test');
  assert.equal(d.round, 4);
  assert.equal(d.characters[1].name, 'Saitama');
  assert.equal(d.died, 'Saitama');
  assert.equal(d.author, 'someone');
  assert.equal(d.note, 'hello');
  assert.ok(d.body.startsWith('word0'));
});

test('parses an encounter issue that embeds a whole entry file', () => {
  const body = 'Here it is:\n\n```markdown\n---\ntitle: Embedded\nround: 2\ncharacters:\n  - name: A\n  - name: B\ndied: A\n---\n\n' + WORDS + '\n```\n';
  const d = encounterDraftFromIssue({ title: '[Encounter] x', body, user: { login: 'llm' } });
  assert.equal(d.title, 'Embedded');
  assert.equal(d.round, 2);
  assert.equal(d.died, 'A');
});

test('parses votes from the form and from the title', () => {
  const v = voteFromIssue({ title: '[Vote] E0004 — 7', body: '### Encounter ID\n\nE0004\n\n### Score (1–10)\n\n8\n\n### Comment (optional)\n\n_No response_', user: { login: 'u' }, number: 9 });
  assert.equal(v.id, 'E0004');
  assert.equal(v.score, '8');
  const t = voteFromIssue({ title: '[Vote] E0004 — 7', body: '', user: { login: 'u' } });
  assert.equal(t.score, '7');
});

test('parses a character issue with the Sixteen box ticked', () => {
  const d = characterDraftFromIssue({ title: '[Character] Blank', body: '### Name\n\nBlank\n\n### Aliases\n\nKuuhaku, 『　』\n\n### Source\n\nNo Game No Life\n\n### Designate as one of the Sixteen\n\n- [X] This character is one of the Sixteen.\n\n### Reconstruction\n\nText.' });
  assert.equal(d.name, 'Blank');
  assert.deepEqual(d.aliases, ['Kuuhaku', '『　』']);
  assert.equal(d.sixteen, true);
});

console.log(process.exitCode ? '\nSome tests failed.' : `\nAll ${n} tests passed.`);
