#!/usr/bin/env node
// Regenerates LEDGER.md and ledger.json at the repository root.
import path from 'node:path';
import { loadCanon, analyze } from './lib/canon.mjs';
import { buildLedger, ledgerMarkdown } from './lib/ledger.mjs';
import { ROOT } from './lib/config.mjs';
import { writeFile, writeJSON } from './lib/util.mjs';

const canon = loadCanon();
const analysis = analyze(canon);
if (analysis.errors.length) {
  console.error('Canon has problems; run `npm run validate` for details. Writing the ledger anyway.');
}
const ledger = buildLedger(canon, analysis);
writeJSON(path.join(ROOT, 'ledger.json'), ledger);
writeFile(path.join(ROOT, 'LEDGER.md'), ledgerMarkdown(ledger));
console.log(`Ledger written: ${ledger.encounters.length} encounters, ${ledger.characters.length} characters.`);
