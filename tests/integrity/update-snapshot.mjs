// Regenerates tests/integrity/api-snapshot.json from the device slice header.
// Run ONLY after a deliberate THETAClient binary upgrade, then review the git diff.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot, headerPath, readText, SLICES } from './lib.mjs';

// Safety: never rewrite the snapshot when this file is swept up by `node --test <dir>` on older Node versions.
if (process.env.NODE_TEST_CONTEXT) {
  console.log('update-snapshot.mjs skipped (running under node --test)');
  process.exit(0);
}

const here =path.dirname(fileURLToPath(import.meta.url));
const snap = buildSnapshot(readText(headerPath(SLICES[0])));
const out = path.join(here, 'api-snapshot.json');
fs.writeFileSync(out, JSON.stringify(snap, null, 2) + '\n');
console.log(`wrote ${out}: ${Object.keys(snap.interfaces).length} interfaces, ${snap.protocols.length} protocols, ${snap.nsEnums.length} NS_ENUM`);
