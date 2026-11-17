// Parses GitHub issue bodies produced by the issue forms in
// .github/ISSUE_TEMPLATE/ (or written by hand / by an LLM in the same shape):
//
//   ### Field label
//
//   value
//
// Field labels are matched loosely, so small wording differences are fine.

import { parseFrontMatter } from './util.mjs';
import { parseEncounterFile } from './canon.mjs';

const FIELD_ALIASES = {
  title: ['title', 'encounter title', 'title of the encounter'],
  round: ['round', 'tournament round'],
  character_a: ['character a', 'first character', 'character a name'],
  source_a: ['character a source', 'source a', 'source of character a', 'character a anime'],
  character_b: ['character b', 'second character', 'character b name'],
  source_b: ['character b source', 'source b', 'source of character b', 'character b anime'],
  died: ['who died', 'died', 'who stopped', 'stopped', 'which character died'],
  author: ['author', 'byline', 'author byline'],
  text: ['text', 'encounter', 'encounter text', 'the encounter', 'story'],
  note: ['note', 'authors note', 'author note'],
  encounter: ['encounter id', 'encounter', 'id'],
  score: ['score', 'vote', 'score 1 10', 'your score'],
  comment: ['comment', 'review', 'comment optional', 'review optional'],
  name: ['name', 'character name', 'character'],
  aliases: ['aliases', 'other names'],
  source: ['source', 'anime', 'source anime'],
  sixteen: ['sixteen', 'designate as one of the sixteen', 'one of the sixteen'],
  reconstruction: ['reconstruction', 'character entry', 'entry text', 'text'],
};

function norm(s) {
  return String(s).toLowerCase().replace(/['’]/g, '').replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function parseSections(body) {
  const out = {};
  const src = String(body || '').replace(/\r\n/g, '\n');
  const parts = src.split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const label = nl < 0 ? part : part.slice(0, nl);
    let value = nl < 0 ? '' : part.slice(nl + 1).trim();
    if (value === '_No response_' || value === 'None') value = '';
    out[norm(label)] = value;
  }
  return out;
}

export function field(sections, key, kind) {
  const aliases = FIELD_ALIASES[key] || [key];
  // Prefer the most specific alias match.
  for (const a of aliases) if (sections[norm(a)] !== undefined) return sections[norm(a)];
  return undefined;
}

/** If the body contains a whole entry file (front matter + text), return it. */
export function embeddedFile(body) {
  const src = String(body || '').replace(/\r\n/g, '\n');
  const fenced = /```(?:markdown|md)?\n(---\n[\s\S]*?\n---\n[\s\S]*?)```/.exec(src);
  if (fenced) return fenced[1];
  if (/^---\n[\s\S]*?\n---\n/.test(src.trimStart())) return src.trimStart();
  return null;
}

export function kindOf(issue) {
  const t = String(issue.title || '').toLowerCase();
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name).toLowerCase());
  if (t.startsWith('[vote]') || labels.includes('vote')) return 'vote';
  if (t.startsWith('[encounter]') || labels.includes('encounter')) return 'encounter';
  if (t.startsWith('[character]') || labels.includes('character')) return 'character';
  return null;
}

function unfence(s) {
  const m = /^```[a-z]*\n([\s\S]*?)\n```$/.exec(String(s || '').trim());
  return m ? m[1] : String(s || '');
}

export function encounterDraftFromIssue(issue) {
  const login = issue.user?.login || 'unknown';
  const file = embeddedFile(issue.body);
  if (file) {
    const d = parseEncounterFile('submission.md', file);
    return { ...d, author: d.author || login };
  }
  const s = parseSections(issue.body);
  const a = (field(s, 'character_a') || '').trim();
  const b = (field(s, 'character_b') || '').trim();
  let died = (field(s, 'died') || '').trim();
  if (/^(character\s*)?a$/i.test(died)) died = a;
  if (/^(character\s*)?b$/i.test(died)) died = b;
  const roundRaw = (field(s, 'round') || '').replace(/[^0-9]/g, '');
  let title = (field(s, 'title') || '').trim();
  if (!title) title = String(issue.title || '').replace(/^\[encounter\]\s*/i, '').trim();
  return {
    kind: 'encounter',
    id: null,
    title,
    round: roundRaw ? Number(roundRaw) : NaN,
    characters: [
      { name: a, source: (field(s, 'source_a') || '').trim() },
      { name: b, source: (field(s, 'source_b') || '').trim() },
    ],
    died,
    author: (field(s, 'author') || '').trim() || login,
    note: (field(s, 'note') || '').trim(),
    body: unfence(field(s, 'text') || ''),
  };
}

export function characterDraftFromIssue(issue) {
  const file = embeddedFile(issue.body);
  if (file) {
    const { data, body } = parseFrontMatter(file);
    return {
      name: String(data.name || ''),
      aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : [],
      source: String(data.source || ''),
      sixteen: data.sixteen === true,
      explicitSixteen: data.sixteen !== undefined,
      body,
    };
  }
  const s = parseSections(issue.body);
  let name = (field(s, 'name') || '').trim();
  if (!name) name = String(issue.title || '').replace(/^\[character\]\s*/i, '').trim();
  const sixteenRaw = field(s, 'sixteen') || '';
  return {
    name,
    aliases: (field(s, 'aliases') || '').split(',').map((x) => x.trim()).filter(Boolean),
    source: (field(s, 'source') || '').trim(),
    sixteen: /- \[x\]/i.test(sixteenRaw) || /^(yes|true)$/i.test(sixteenRaw.trim()),
    explicitSixteen: false,
    body: unfence(field(s, 'reconstruction') || ''),
  };
}

export function voteFromIssue(issue) {
  const s = parseSections(issue.body);
  let id = (field(s, 'encounter') || '').trim();
  let score = (field(s, 'score') || '').trim();
  // Title fallback: "[Vote] E0004 — 7"
  const t = /\[vote\]\s*(E[-\s]?\d+)\D+(\d{1,2})\b/i.exec(issue.title || '');
  if (!id && t) id = t[1];
  if (!score && t) score = t[2];
  return {
    id,
    score: (/\d+/.exec(score) || [''])[0],
    comment: (field(s, 'comment') || '').trim(),
    voter: issue.user?.login || 'anonymous',
    issue: issue.number,
  };
}
