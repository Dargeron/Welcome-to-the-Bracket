// The rules engine. Everything that decides what is and isn't canon lives here.
//
// Canon = every file in entries/encounters/ (ordered by accession number,
// which is order of arrival) + every file in entries/characters/.
// entries/deprecated/ is kept for the record but carries no weight.

import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ROOT, loadConfig, roomsAt, entrantsAt } from './config.mjs';
import { parseFrontMatter, readDir, readJSON, nameKey, slugify, wordCount, median, pad } from './util.mjs';

export const ID_RE = /^E(\d{4,})$/;

export function normalizeId(s) {
  const m = /^\s*e[-_ ]?0*(\d+)\s*$/i.exec(String(s ?? ''));
  return m ? `E${pad(Number(m[1]))}` : null;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function parseEncounterFile(file, text = fs.readFileSync(file, 'utf8')) {
  const { data, body } = parseFrontMatter(text, rel(file));
  const chars = Array.isArray(data.characters) ? data.characters : [];
  return {
    kind: 'encounter',
    file,
    relFile: rel(file),
    id: data.id ? String(data.id) : null,
    num: data.id && ID_RE.test(String(data.id)) ? Number(ID_RE.exec(String(data.id))[1]) : null,
    title: data.title != null ? String(data.title) : '',
    round: data.round,
    characters: chars.map((c) =>
      typeof c === 'string'
        ? { name: c.trim(), source: '' }
        : { name: String(c?.name ?? '').trim(), source: String(c?.source ?? '').trim() }
    ),
    died: data.died != null ? String(data.died).trim() : '',
    author: data.author ? String(data.author) : '',
    submitted: data.submitted ? String(data.submitted instanceof Date ? data.submitted.toISOString().slice(0, 10) : data.submitted) : '',
    issue: data.issue || null,
    founding: data.founding === true,
    note: data.note ? String(data.note) : '',
    deprecated: data.deprecated || null,
    body,
    raw: data,
  };
}

export function parseCharacterFile(file, text = fs.readFileSync(file, 'utf8')) {
  const { data, body } = parseFrontMatter(text, rel(file));
  const aliases = Array.isArray(data.aliases)
    ? data.aliases.map(String)
    : data.aliases
      ? String(data.aliases).split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  return {
    kind: 'character',
    file,
    relFile: rel(file),
    name: data.name != null ? String(data.name).trim() : '',
    aliases,
    source: data.source ? String(data.source) : '',
    sixteen: data.sixteen === true,
    updated: data.updated ? String(data.updated instanceof Date ? data.updated.toISOString().slice(0, 10) : data.updated) : '',
    body,
    raw: data,
  };
}

export function loadCanon() {
  const config = loadConfig();
  const encounters = readDir(PATHS.encounters).map((f) => parseEncounterFile(f));
  const deprecated = readDir(PATHS.deprecated).map((f) => parseEncounterFile(f));
  const characters = readDir(PATHS.characters).map((f) => parseCharacterFile(f));
  const votes = {};
  if (fs.existsSync(PATHS.votes)) {
    for (const f of fs.readdirSync(PATHS.votes).filter((f) => f.endsWith('.json'))) {
      const v = readJSON(path.join(PATHS.votes, f), null);
      if (v && v.encounter) votes[v.encounter] = v;
    }
  }
  return { config, encounters, deprecated, characters, votes };
}

export function loadSubmissions() {
  return readDir(PATHS.submissions).map((f) => parseEncounterFile(f));
}

// ---------------------------------------------------------------------------
// Votes
// ---------------------------------------------------------------------------

export function voteSummary(config, enc, voteFile) {
  const votes = voteFile?.votes ?? [];
  const q = config.voting.quorum;
  const scores = votes.map((v) => v.score);
  const trial = scores.slice(0, q);
  const trialMedian = trial.length >= q ? median(trial) : null;
  let status;
  if (enc?.deprecated) status = 'deprecated';
  else if (enc?.founding) status = 'founding';
  else if (trial.length < q) status = 'review';
  else if (trialMedian < config.voting.removeIfMedianBelow) status = 'deprecated';
  else status = 'ratified';
  return {
    count: votes.length,
    quorum: q,
    scores,
    trialScores: trial,
    trialMedian,
    overallMedian: median(scores),
    status,
  };
}

// ---------------------------------------------------------------------------
// Shape checks (one file on its own)
// ---------------------------------------------------------------------------

export function checkEncounterShape(e, config, { requireId = true } = {}) {
  const errs = [];
  if (requireId) {
    if (!e.id) errs.push('missing `id` (accession number such as E0007).');
    else if (!ID_RE.test(e.id)) errs.push(`\`id\` "${e.id}" must look like E0007.`);
  }
  if (!e.title || !e.title.trim()) errs.push('missing `title`.');
  const r = e.round;
  if (!Number.isInteger(r)) errs.push('`round` must be a whole number.');
  else if (r < 1 || r > config.finalRound)
    errs.push(`\`round\` must be between 1 and ${config.finalRound} (the Timeline ends at Round ${config.finalRound}).`);
  if (e.characters.length !== 2) errs.push('`characters` must list exactly two characters.');
  e.characters.forEach((c, i) => {
    if (!c.name) errs.push(`character #${i + 1} has no name.`);
  });
  if (e.characters.length === 2 && nameKey(e.characters[0].name) === nameKey(e.characters[1].name))
    errs.push('the two characters must be different characters.');
  if (!e.died) errs.push('missing `died` (the name of the character who stopped).');
  else if (!e.characters.some((c) => nameKey(c.name) === nameKey(e.died)))
    errs.push(`\`died\` ("${e.died}") must be exactly one of the two characters.`);
  const words = wordCount(e.body);
  if (words < config.encounter.minWords)
    errs.push(`the encounter text is ${words} words; the minimum is ${config.encounter.minWords}.`);
  if (e.body.length > config.encounter.maxChars)
    errs.push(`the encounter text is longer than ${config.encounter.maxChars} characters.`);
  return errs;
}

export function checkCharacterShape(c) {
  const errs = [];
  if (!c.name) errs.push('missing `name`.');
  const expected = `${slugify(c.name)}.md`;
  if (c.name && path.basename(c.file) !== expected)
    errs.push(`file should be named \`${expected}\` (derived from the name).`);
  return errs;
}

// ---------------------------------------------------------------------------
// The analysis: replay every encounter in order of arrival.
// ---------------------------------------------------------------------------

/**
 * @param canon  result of loadCanon() (may be modified copies)
 * @returns {{errors: Array<{file:string,id?:string,message:string}>, warnings: Array, state: object}}
 */
export function analyze(canon) {
  const { config } = canon;
  const errors = [];
  const warnings = [];
  const err = (src, message) => errors.push({ file: src.relFile, id: src.id || src.name || null, message });

  // --- character registry -------------------------------------------------
  const chars = new Map(); // slug -> character state
  const keyToSlug = new Map(); // name/alias key -> slug

  function blank(slug, name) {
    return {
      slug,
      name,
      aliases: [],
      source: '',
      file: null,
      designatedSixteen: false,
      derivedSixteen: null, // encounter id that made them one of the Sixteen
      rounds: {}, // round -> { id, outcome: 'survived'|'stopped', opponent }
      deathRound: null,
      deathId: null,
      lastRound: 0,
    };
  }

  for (const c of canon.characters) {
    for (const m of checkCharacterShape(c)) err(c, m);
    if (!c.name) continue;
    const slug = slugify(c.name);
    if (chars.has(slug)) {
      err(c, `duplicate character "${c.name}" (another file already uses this name).`);
      continue;
    }
    const st = blank(slug, c.name);
    st.aliases = c.aliases;
    st.source = c.source;
    st.file = c;
    st.designatedSixteen = c.sixteen;
    chars.set(slug, st);
    for (const k of [c.name, ...c.aliases].map(nameKey)) {
      if (keyToSlug.has(k) && keyToSlug.get(k) !== slug) {
        err(c, `name or alias "${k}" is already used by "${chars.get(keyToSlug.get(k)).name}".`);
      } else keyToSlug.set(k, slug);
    }
  }

  const designated = [...chars.values()].filter((c) => c.designatedSixteen);
  if (designated.length > config.sixteen) {
    for (const c of designated.slice(config.sixteen))
      err(c.file, `there can only be ${config.sixteen} of the Sixteen; "${c.name}" would be number ${designated.indexOf(c) + 1}.`);
    designated.slice(config.sixteen).forEach((c) => (c.designatedSixteen = false));
  }

  function resolve(name, source) {
    const k = nameKey(name);
    let slug = keyToSlug.get(k);
    if (!slug) {
      slug = k;
      const st = blank(slug, name.trim());
      st.source = source || '';
      chars.set(slug, st);
      keyToSlug.set(k, slug);
    }
    const st = chars.get(slug);
    if (!st.source && source) st.source = source;
    return st;
  }

  const sixteenCount = () =>
    [...chars.values()].filter((c) => c.designatedSixteen || c.derivedSixteen).length;

  // --- rounds ----------------------------------------------------------------
  const rounds = {};
  for (let r = 1; r <= config.finalRound; r++) {
    rounds[r] = { round: r, entrants: entrantsAt(config, r), rooms: roomsAt(config, r), encounters: [] };
  }

  // --- replay encounters in arrival order -----------------------------------
  const seenIds = new Set();
  const ordered = [...canon.encounters].sort((a, b) => (a.num ?? 1e12) - (b.num ?? 1e12));
  const accepted = [];

  for (const e of ordered) {
    const shape = checkEncounterShape(e, config);
    if (e.id && seenIds.has(e.id)) shape.push(`duplicate id ${e.id}.`);
    if (e.id) seenIds.add(e.id);
    if (e.id && e.num != null) {
      const expected = new RegExp(`^${e.id}-`);
      if (!expected.test(path.basename(e.file))) shape.push(`file name should start with "${e.id}-".`);
    }
    if (shape.length) {
      shape.forEach((m) => err(e, m));
      continue;
    }

    const [a, b] = e.characters.map((c) => resolve(c.name, c.source));
    const r = e.round;
    const problems = [];
    const dead = nameKey(e.died) === nameKey(e.characters[0].name) ? a : b;
    const alive = dead === a ? b : a;

    for (const p of [a, b]) {
      if (p.rounds[r]) problems.push(`${p.name} already has a Round ${r} encounter (${p.rounds[r].id}).`);
      if (p.deathRound != null && r > p.deathRound)
        problems.push(`${p.name} stopped in Round ${p.deathRound} (${p.deathId}) and cannot appear in Round ${r}.`);
    }
    if (dead.lastRound > r)
      problems.push(`${dead.name} cannot stop in Round ${r}: they are already on record alive in Round ${dead.lastRound} (${dead.rounds[dead.lastRound].id}).`);
    if (dead.designatedSixteen || dead.derivedSixteen)
      problems.push(`${dead.name} is one of the Sixteen and cannot stop.`);
    if (rounds[r].encounters.length + 1 > rounds[r].rooms)
      problems.push(`Round ${r} only has ${rounds[r].rooms} rooms, and all of them are already written.`);
    if (r === config.finalRound && !(alive.designatedSixteen || alive.derivedSixteen) && sixteenCount() >= config.sixteen)
      problems.push(`the survivor of a Round ${r} encounter becomes one of the Sixteen, but all ${config.sixteen} places are already taken.`);

    if (problems.length) {
      problems.forEach((m) => err(e, m));
      continue;
    }

    // apply
    a.rounds[r] = { id: e.id, outcome: a === dead ? 'stopped' : 'survived', opponent: b.slug };
    b.rounds[r] = { id: e.id, outcome: b === dead ? 'stopped' : 'survived', opponent: a.slug };
    a.lastRound = Math.max(a.lastRound, r);
    b.lastRound = Math.max(b.lastRound, r);
    dead.deathRound = r;
    dead.deathId = e.id;
    if (r === config.finalRound && !alive.designatedSixteen && !alive.derivedSixteen) alive.derivedSixteen = e.id;
    rounds[r].encounters.push(e.id);
    accepted.push({ ...e, slugs: [a.slug, b.slug], deadSlug: dead.slug, aliveSlug: alive.slug });
  }

  // --- population check: nobody can be in Round r unless they fit ----------
  for (let r = 1; r <= config.finalRound; r++) {
    const knownAlive = [...chars.values()].filter(
      (c) => c.lastRound >= r || ((c.designatedSixteen || c.derivedSixteen) && c.deathRound == null)
    ).length;
    if (knownAlive > entrantsAt(config, r))
      errors.push({ file: '(canon)', id: null, message: `${knownAlive} characters are on record as alive in Round ${r}, which only holds ${entrantsAt(config, r)}.` });
  }

  // --- derived availability -------------------------------------------------
  for (const c of chars.values()) {
    c.sixteen = Boolean(c.designatedSixteen || c.derivedSixteen);
    c.sixteenHow = c.designatedSixteen ? 'designated' : c.derivedSixteen ? 'final-round' : null;
    c.encounterCount = Object.keys(c.rounds).length;
    c.open = [];
    const lastPossible = c.deathRound != null ? c.deathRound - 1 : config.finalRound;
    for (let r = 1; r <= lastPossible; r++) {
      if (c.rounds[r]) continue;
      if (rounds[r].encounters.length >= rounds[r].rooms) continue;
      const mustSurvive = c.sixteen || c.deathRound != null || r < c.lastRound;
      c.open.push({ round: r, mustSurvive });
    }
    c.status = c.deathRound != null ? 'stopped' : c.sixteen ? 'sixteen' : 'in-play';
    c.full = c.open.length === 0;
    if (c.designatedSixteen && c.deathRound != null) {
      // Guarded above, but keep the invariant explicit.
      err(c.file || { relFile: '(canon)', id: c.name }, `${c.name} is designated one of the Sixteen but stopped in Round ${c.deathRound}.`);
    }
  }

  const sixteen = [...chars.values()]
    .filter((c) => c.sixteen)
    .map((c) => ({ slug: c.slug, name: c.name, how: c.sixteenHow, via: c.derivedSixteen }));

  const nextNum = Math.max(0, ...[...canon.encounters, ...canon.deprecated].map((e) => e.num || 0)) + 1;

  return {
    errors,
    warnings,
    state: {
      config,
      characters: chars,
      keyToSlug,
      rounds,
      accepted,
      sixteen,
      nextId: `E${pad(nextNum)}`,
    },
  };
}

/** Errors that exist in `after` but not in `before` (compared by message+file). */
export function newErrors(before, after) {
  const seen = new Set(before.map((e) => `${e.file}|${e.message}`));
  return after.filter((e) => !seen.has(`${e.file}|${e.message}`));
}

/** Convenience: resolve a free-text name to a character slug using analysis state. */
export function findCharacter(state, name) {
  const slug = state.keyToSlug.get(nameKey(name));
  return slug ? state.characters.get(slug) : null;
}
