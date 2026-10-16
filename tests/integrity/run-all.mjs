// Cross-version runner: `node --test tests/integrity` works on Node 18/20 (directory recursion) but not on Node 22+
// (arguments became globs). Passing explicit file paths works everywhere. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_TEST_CONTEXT) process.exit(0); // swept up by 'node --test <dir>' on old Node: do nothing
const here = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => path.join(here, f));
if (files.length === 0) { console.error('no *.test.mjs files found'); process.exit(2); }
const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
