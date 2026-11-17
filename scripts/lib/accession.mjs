// Accession = deciding whether a new piece of writing gets into canon.
// Pure functions: they take a canon object and return a new one plus the files
// to write. The CLI (scripts/intake.mjs) and the GitHub workflows do the I/O.

import path from 'node:path';
import { PATHS } from './config.mjs';
import { analyze, newErrors, checkEncounterShape, findCharacter, normalizeId, voteSummary } from './canon.mjs';
import { slugify, nameKey, stringifyFrontMatter, today } from './util.mjs';

function withEncounter(canon, entry) {
  return { ...canon, encounters: [...canon.encounters, entry] };
}

/**
 * Try to accept an encounter draft (an object shaped like parseEncounterFile's
 * output; `id` is ignored and assigned here).
 */
export function tryAccept(canon, draft, { date = today(), extra = {} } = {}) {
  const before = analyze(canon);
  const { config } = canon;
  const { state } = before;

  // Normalise names to the canonical spelling of existing characters.
  const characters = draft.characters.map((c) => {
    const known = c.name ? findCharacter(state, c.name) : null;
    return known
      ? { name: known.name, source: known.source ? '' : c.source }
      : { name: c.name, source: c.source };
  });
  let died = draft.died;
  const diedMatch = draft.characters.findIndex((c) => nameKey(c.name) === nameKey(draft.died));
  if (diedMatch >= 0) died = characters[diedMatch].name;

  const id = state.nextId;
  const num = Number(id.slice(1));
  const fileName = `${id}-${slugify(draft.title).slice(0, 60)}.md`;
  const filePath = path.join(PATHS.encounters, fileName);

  const data = {
    id,
    title: draft.title.trim(),
    round: draft.round,
    characters: characters.map((c) => (c.source ? { name: c.name, source: c.source } : { name: c.name })),
    died,
    author: draft.author || undefined,
    submitted: date,
    ...extra,
    note: draft.note || undefined,
  };
  const body = draft.body.trim();
  const text = stringifyFrontMatter(data, body);

  const entry = {
    ...draft,
    kind: 'encounter',
    id,
    num,
    file: filePath,
    relFile: `entries/encounters/${fileName}`,
    characters,
    died,
    submitted: date,
    body,
    founding: false,
    deprecated: null,
  };

  const shape = checkEncounterShape(entry, config);
  if (shape.length) return { ok: false, reasons: shape };

  const next = withEncounter(canon, entry);
  const after = analyze(next);
  const introduced = newErrors(before.errors, after.errors);
  if (introduced.length) return { ok: false, reasons: introduced.map((e) => e.message) };
  return { ok: true, entry, canon: next, filePath, text };
}

/**
 * Create or update a character entry.
 * @param draft {name, aliases[], source, sixteen, body}
 */
export function tryCharacter(canon, draft, { date = today() } = {}) {
  const reasons = [];
  if (!draft.name || !draft.name.trim()) reasons.push('A character entry needs a name.');
  if (!draft.body || !draft.body.trim()) reasons.push('A character entry needs some text (the reconstruction).');
  if (reasons.length) return { ok: false, reasons };

  const before = analyze(canon);
  const known = findCharacter(before.state, draft.name);
  const name = known ? known.name : draft.name.trim();
  const slug = slugify(name);
  const existing = canon.characters.find((c) => slugify(c.name) === slug);

  if (existing?.sixteen && draft.sixteen === false && draft.explicitSixteen)
    reasons.push(`${name} is already one of the Sixteen; that designation cannot be removed by an edit.`);
  const sixteen = Boolean(existing?.sixteen || draft.sixteen);
  if (reasons.length) return { ok: false, reasons };

  const aliases = [...new Set([...(existing?.aliases || []), ...(draft.aliases || [])].map((a) => a.trim()).filter(Boolean))].filter(
    (a) => nameKey(a) !== nameKey(name)
  );
  const source = draft.source?.trim() || existing?.source || known?.source || '';
  const filePath = path.join(PATHS.characters, `${slug}.md`);
  const data = { name, aliases: aliases.length ? aliases : undefined, source: source || undefined, sixteen, updated: date };
  const text = stringifyFrontMatter(data, draft.body.trim());
  const entry = {
    kind: 'character',
    file: filePath,
    relFile: `entries/characters/${slug}.md`,
    name,
    aliases,
    source,
    sixteen,
    updated: date,
    body: draft.body.trim(),
  };
  const next = { ...canon, characters: [...canon.characters.filter((c) => slugify(c.name) !== slug), entry] };
  const after = analyze(next);
  const introduced = newErrors(before.errors, after.errors);
  if (introduced.length) return { ok: false, reasons: introduced.map((e) => e.message) };
  return { ok: true, entry, canon: next, filePath, text, created: !existing };
}

/**
 * Record a vote. Returns the new vote file contents and, when the vote
 * completes the quorum with a median under the threshold, a deprecation.
 */
export function tryVote(canon, { id: rawId, score: rawScore, voter, issue, comment, date = new Date().toISOString() }) {
  const { config } = canon;
  const id = normalizeId(rawId);
  if (!id) return { ok: false, reasons: [`"${rawId}" is not an encounter id (expected something like E0007).`] };
  const score = Number(String(rawScore ?? '').trim());
  if (!Number.isInteger(score) || score < config.voting.min || score > config.voting.max)
    return { ok: false, reasons: [`The score must be a whole number from ${config.voting.min} to ${config.voting.max}.`] };

  if (canon.deprecated.some((e) => e.id === id))
    return { ok: false, reasons: [`${id} has already been deprecated by vote; it no longer takes votes.`] };
  const enc = canon.encounters.find((e) => e.id === id);
  if (!enc) return { ok: false, reasons: [`There is no encounter ${id} in canon.`] };

  const current = canon.votes[id] || { encounter: id, votes: [] };
  const vote = { score, voter: voter || 'anonymous', at: date };
  if (issue) vote.issue = issue;
  if (comment) vote.comment = String(comment).slice(0, 2000);
  const updated = { encounter: id, votes: [...current.votes, vote] };

  const beforeStatus = voteSummary(config, enc, current).status;
  const after = voteSummary(config, enc, updated);
  const deprecate = beforeStatus === 'review' && after.status === 'deprecated';
  return {
    ok: true,
    id,
    encounter: enc,
    voteFile: updated,
    votePath: path.join(PATHS.votes, `${id}.json`),
    summary: after,
    deprecate,
  };
}

/** File text for an encounter moved into entries/deprecated/. */
export function deprecatedText(enc, summary, date = today()) {
  const data = {
    ...enc.raw,
    deprecated: { date, median: summary.trialMedian, votes: summary.trialScores },
  };
  return stringifyFrontMatter(data, enc.body);
}
