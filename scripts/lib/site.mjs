// Builds the in-memory model of the website from canon: every page's data,
// link resolution for [[wiki links]], and "what links here".

import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './config.mjs';
import { voteSummary, normalizeId } from './canon.mjs';
import { wikiTargets, excerpt } from './markdown.mjs';
import { slugify, nameKey, wordCount, parseFrontMatter } from './util.mjs';
import { buildLedger } from './ledger.mjs';

const SPECIAL = {
  introduction: 'introduction/',
  intro: 'introduction/',
  rules: 'introduction/',
  'the-rules': 'introduction/',
  contribute: 'contribute/',
  'how-to-contribute': 'contribute/',
  'writing-guide': 'contribute/#writing',
  reviewing: 'contribute/#reviewing',
  sixteen: 'sixteen/',
  'the-sixteen': 'sixteen/',
  archive: 'archive/',
  'founding-text': 'founding-text/',
  'everyone-but-sixteen': 'founding-text/',
  trailer: '',
  ledger: 'ledger/',
  deprecated: 'deprecated/',
  rounds: 'rounds/',
  characters: 'characters/',
  encounters: 'encounters/',
  random: 'random/',
};

export function buildSite(canon, analysis) {
  const { config } = canon;
  const { state } = analysis;
  const ledger = buildLedger(canon, analysis);

  const encounters = state.accepted
    .slice()
    .sort((a, b) => a.num - b.num)
    .map((e) => ({
      ...e,
      slug: e.id.toLowerCase(),
      path: `encounters/${e.id.toLowerCase()}/`,
      votes: voteSummary(config, e, canon.votes[e.id]),
      voteList: canon.votes[e.id]?.votes ?? [],
      words: wordCount(e.body),
      excerpt: excerpt(e.body.replace(/^\*[^*]+\*\s*---/s, ''), 220),
    }));

  const deprecated = canon.deprecated
    .slice()
    .sort((a, b) => (a.num || 0) - (b.num || 0))
    .map((e) => ({
      ...e,
      slug: (e.id || 'unknown').toLowerCase(),
      path: `deprecated/${(e.id || 'unknown').toLowerCase()}/`,
      voteList: canon.votes[e.id]?.votes ?? [],
      excerpt: excerpt(e.body, 220),
    }));

  const characters = new Map();
  for (const c of state.characters.values()) {
    characters.set(c.slug, {
      ...c,
      path: `characters/${c.slug}/`,
      body: c.file?.body || '',
      updated: c.file?.updated || '',
      relFile: c.file?.relFile || null,
    });
  }

  const byId = new Map(encounters.map((e) => [e.id, e]));
  const depById = new Map(deprecated.map((e) => [e.id, e]));
  const byTitle = new Map(encounters.map((e) => [nameKey(e.title), e]));

  function resolve(target) {
    const t = String(target).trim();
    const id = normalizeId(t);
    if (id && byId.has(id)) {
      const e = byId.get(id);
      return { path: e.path, type: 'encounter', title: `${e.id}: ${e.title}` };
    }
    if (id && depById.has(id)) {
      const e = depById.get(id);
      return { path: e.path, type: 'deprecated', title: `${e.id}: ${e.title} (deprecated)` };
    }
    const rm = /^(?:round\s*|r)(\d{1,2})$/i.exec(t);
    if (rm && Number(rm[1]) >= 1 && Number(rm[1]) <= config.finalRound) {
      return { path: `rounds/${Number(rm[1])}/`, type: 'round', title: `Round ${Number(rm[1])}` };
    }
    const k = nameKey(t);
    if (SPECIAL[k] !== undefined) return { path: SPECIAL[k], type: 'page', title: t };
    const slug = state.keyToSlug.get(k);
    if (slug && characters.has(slug)) {
      const c = characters.get(slug);
      return { path: c.path, type: 'character', title: c.name };
    }
    if (byTitle.has(k)) {
      const e = byTitle.get(k);
      return { path: e.path, type: 'encounter', title: `${e.id}: ${e.title}` };
    }
    return null;
  }

  // What links here
  const backlinks = new Map();
  const addBack = (fromTitle, fromPath, md) => {
    for (const t of wikiTargets(md)) {
      const r = resolve(t);
      if (!r || r.path === fromPath) continue;
      if (!backlinks.has(r.path)) backlinks.set(r.path, new Map());
      backlinks.get(r.path).set(fromPath, fromTitle);
    }
  };
  for (const e of encounters) addBack(`${e.id}: ${e.title}`, e.path, e.body + '\n' + (e.note || ''));
  for (const c of characters.values()) if (c.body) addBack(c.name, c.path, c.body);

  // Static content pages from content/*.md
  const content = {};
  for (const name of ['introduction', 'contribute', 'founding-text']) {
    const f = path.join(PATHS.content, `${name}.md`);
    if (fs.existsSync(f)) {
      const { data, body } = parseFrontMatter(fs.readFileSync(f, 'utf8'));
      content[name] = { ...data, body };
    }
  }

  const rounds = Object.values(state.rounds).map((r) => ({
    ...r,
    path: `rounds/${r.round}/`,
    list: r.encounters.map((id) => byId.get(id)),
  }));

  return {
    config,
    ledger,
    state,
    encounters,
    deprecated,
    characters,
    rounds,
    sixteen: state.sixteen,
    byId,
    resolve,
    backlinks,
    content,
    errors: analysis.errors,
  };
}

// --- GitHub links ------------------------------------------------------------

function q(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

export function gh(config) {
  const base = config.repoUrl;
  return {
    repo: base,
    newEncounter: ({ a, round, b } = {}) =>
      `${base}/issues/new?${q({ template: 'encounter.yml', title: '[Encounter] ', character_a: a, character_b: b, round })}`,
    vote: (id, score) =>
      `${base}/issues/new?${q({ template: 'vote.yml', title: `[Vote] ${id} — ${score}`, encounter: id, score })}`,
    characterEntry: (name) =>
      `${base}/issues/new?${q({ template: 'character.yml', title: `[Character] ${name || ''}`, name })}`,
    source: (rel) => `${base}/blob/${config.branch}/${rel}`,
    edit: (rel) => `${base}/edit/${config.branch}/${rel}`,
    report: (title) => `${base}/issues/new?${q({ title: `[Report] ${title}` })}`,
    issues: `${base}/issues`,
  };
}

export { slugify };
