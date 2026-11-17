#!/usr/bin/env node
// Turns submissions into canon.
//
//   node scripts/intake.mjs check <draft.md>            dry run: would this encounter be accepted?
//   node scripts/intake.mjs issue <event.json> [--result out.json]
//                                                         process a GitHub issue (encounter / vote / character)
//   node scripts/intake.mjs submissions [--result out.json]
//                                                         accession every draft in submissions/ (PR route)
//
// Writes files in the working tree; committing is left to the caller.

import fs from 'node:fs';
import path from 'node:path';
import { loadCanon, parseEncounterFile, loadSubmissions } from './lib/canon.mjs';
import { tryAccept, tryCharacter, tryVote, deprecatedText } from './lib/accession.mjs';
import { kindOf, encounterDraftFromIssue, characterDraftFromIssue, voteFromIssue } from './lib/issue.mjs';
import { PATHS } from './lib/config.mjs';
import { writeFile, writeJSON, stringifyFrontMatter, slugify } from './lib/util.mjs';

const [cmd, arg, ...rest] = process.argv.slice(2);
const resultPath = (() => {
  const i = process.argv.indexOf('--result');
  return i > 0 ? process.argv[i + 1] : null;
})();

function finish(result) {
  if (resultPath) writeJSON(resultPath, result);
  console.log(result.message);
  process.exit(0);
}

function siteUrl(config, p) {
  return config.siteUrl.replace(/\/?$/, '/') + p;
}

function bullet(list) {
  return list.map((m) => `- ${m}`).join('\n');
}

const FOOTER = '\n\n---\n_This reply was written automatically by the Bracket intake workflow._';

// ---------------------------------------------------------------------------

if (cmd === 'check') {
  if (!arg) {
    console.error('usage: node scripts/intake.mjs check <draft.md>');
    process.exit(2);
  }
  const canon = loadCanon();
  const draft = parseEncounterFile(path.resolve(arg));
  const res = tryAccept(canon, draft);
  if (res.ok) {
    console.log(`✓ Would be accepted as ${res.entry.id} (Round ${res.entry.round}: ${res.entry.characters.map((c) => c.name).join(' vs ')}; ${res.entry.died} stops).`);
    process.exit(0);
  }
  console.error('✗ Would be rejected:\n' + bullet(res.reasons));
  process.exit(1);
}

// ---------------------------------------------------------------------------

if (cmd === 'issue') {
  const event = JSON.parse(fs.readFileSync(arg, 'utf8'));
  const issue = event.issue;
  const kind = kindOf(issue);
  const canon = loadCanon();
  const { config } = canon;

  if (!kind) finish({ kind: null, ok: false, skip: true, message: 'Not a Bracket submission; ignoring.' });

  if (kind === 'encounter') {
    const draft = encounterDraftFromIssue(issue);
    const res = tryAccept(canon, draft, { extra: { issue: issue.number } });
    if (!res.ok) {
      finish({
        kind,
        ok: false,
        message:
          `Thank you for writing this. It can't enter the archive as submitted:\n\n${bullet(res.reasons)}\n\n` +
          `Check the character's page on the site (or \`LEDGER.md\`) to see which rounds are still open, then open a new issue. ` +
          `Your text is preserved in this issue, so you can copy it.` +
          FOOTER,
      });
    }
    writeFile(res.filePath, res.text);
    const e = res.entry;
    const url = siteUrl(config, `encounters/${e.id.toLowerCase()}/`);
    finish({
      kind,
      ok: true,
      id: e.id,
      commitMessage: `Accession ${e.id}: ${e.title} (Round ${e.round}) — closes #${issue.number}`,
      message:
        `Accepted as **${e.id}: ${e.title}**, Round ${e.round}. ${e.characters.map((c) => c.name).join(' and ')} met; **${e.died}** stopped.\n\n` +
        `It will appear at ${url} within a few minutes. From its ${config.voting.quorum}th vote on, it stays in the archive ` +
        `only while the median of all its votes is ${config.voting.removeIfMedianBelow} or higher.` +
        FOOTER,
    });
  }

  if (kind === 'character') {
    const draft = characterDraftFromIssue(issue);
    const res = tryCharacter(canon, draft);
    if (!res.ok) finish({ kind, ok: false, message: `This character entry can't be filed:\n\n${bullet(res.reasons)}` + FOOTER });
    writeFile(res.filePath, res.text);
    const url = siteUrl(config, `characters/${slugify(res.entry.name)}/`);
    finish({
      kind,
      ok: true,
      commitMessage: `${res.created ? 'Create' : 'Update'} character entry: ${res.entry.name} — closes #${issue.number}`,
      message:
        `${res.created ? 'Created' : 'Updated'} the character entry for **${res.entry.name}**${res.entry.sixteen ? ' (one of the Sixteen)' : ''}. ` +
        `It will appear at ${url} within a few minutes.\n\nReminder: character entries only describe what published encounters show. ` +
        `They never add events of their own.` +
        FOOTER,
    });
  }

  if (kind === 'vote') {
    const v = voteFromIssue(issue);
    const res = tryVote(canon, v);
    if (!res.ok) finish({ kind, ok: false, message: `This vote couldn't be counted:\n\n${bullet(res.reasons)}` + FOOTER });
    writeJSON(res.votePath, res.voteFile);
    const s = res.summary;
    let message = `Counted: **${v.score}/10** for **${res.id}: ${res.encounter.title}**. `;
    let commitMessage = `Vote ${v.score} for ${res.id} — closes #${issue.number}`;
    if (res.deprecate) {
      const dest = path.join(PATHS.deprecated, path.basename(res.encounter.file));
      writeFile(dest, deprecatedText(res.encounter, s));
      fs.rmSync(res.encounter.file);
      message +=
        `With ${s.count} votes (${s.scores.join(', ')}) the median is now **${s.median}**, under ${config.voting.removeIfMedianBelow}, ` +
        `so ${res.id} has been moved to the deprecated archive. Its rounds are open again.`;
      commitMessage = `Deprecate ${res.id} by vote (median ${s.median} of ${s.count}) — closes #${issue.number}`;
    } else if (s.status === 'review') {
      message += `${s.count} of ${config.voting.quorum} votes are in. From the ${config.voting.quorum}th vote on, the encounter is removed whenever the median of all its votes is under ${config.voting.removeIfMedianBelow}.`;
    } else if (s.status === 'standing') {
      message += `With ${s.count} votes the median is **${s.median}**, so ${res.id} stays in canon for now. It is checked again after every vote.`;
    } else {
      message += `Your score is recorded.`;
    }
    finish({ kind, ok: true, id: res.id, commitMessage, message: message + FOOTER });
  }
}

// ---------------------------------------------------------------------------

if (cmd === 'submissions') {
  let canon = loadCanon();
  const subs = loadSubmissions();
  const accepted = [];
  const rejected = [];
  for (const s of subs) {
    const res = tryAccept(canon, s, { date: s.submitted || undefined });
    if (res.ok) {
      writeFile(res.filePath, res.text);
      fs.rmSync(s.file);
      canon = res.canon;
      accepted.push(`${res.entry.id} ${res.entry.title}`);
    } else {
      const dest = path.join(PATHS.rejected, path.basename(s.file));
      writeFile(dest, stringifyFrontMatter({ ...s.raw, rejected: res.reasons }, s.body));
      fs.rmSync(s.file);
      rejected.push(`${s.relFile}: ${res.reasons.join(' ')}`);
    }
  }
  const message = subs.length
    ? `Accessioned ${accepted.length}, rejected ${rejected.length}.\n${accepted.map((a) => '✓ ' + a).join('\n')}\n${rejected.map((r) => '✗ ' + r).join('\n')}`.trim()
    : 'No submissions to process.';
  finish({
    kind: 'submissions',
    ok: true,
    changed: subs.length > 0,
    commitMessage: `Accession from submissions/: ${accepted.length} accepted, ${rejected.length} rejected`,
    message,
  });
}

console.error('usage: node scripts/intake.mjs <check|issue|submissions> ...');
process.exit(2);
