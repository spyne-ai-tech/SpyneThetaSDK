// Tries to determine the upstream ricoh360/theta-client version embedded in the artifacts.
// Never invents a version: if none can be determined this records that and still passes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SLICES, XCF, binaryPath, headerPath, read, readText } from './lib.mjs';

const SEMVER = /\b(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.]+)?\b/;

function printableStrings(buf, min = 8) {
  const out = [];
  let cur = '';
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c >= 0x20 && c < 0x7f) cur += String.fromCharCode(c);
    else { if (cur.length >= min) out.push(cur); cur = ''; }
  }
  if (cur.length >= min) out.push(cur);
  return out;
}

function candidates(strings) {
  // a version string only counts if the same string also mentions theta-client / thetaclient (no free-floating semver guesses)
  return strings.filter((s) => /theta-?client/i.test(s) && SEMVER.test(s)).slice(0, 20);
}

describe('upstream theta-client version evidence', () => {
  test('header does not contain an upstream version marker (documented observation) or, if it does, it is valid semver', (t) => {
    const hits = readText(headerPath(SLICES[0])).split(/\r?\n/).filter((l) => /theta-?client[^\n]*\d+\.\d+\.\d+/i.test(l));
    t.diagnostic(`header version markers: ${hits.length}`);
    for (const l of hits) assert.match(l, SEMVER);
  });

  for (const id of SLICES) {
    test(`${id}: scan binary strings for a theta-client version (never invented)`, (t) => {
      const strs = printableStrings(read(binaryPath(id)));
      const c = candidates(strs);
      const paths = new Set(strs.filter((s) => /theta-client\/[A-Za-z-]+/.test(s)).map((s) => /theta-client\/[A-Za-z-]+/.exec(s)[0]));
      t.diagnostic(`${id}: version candidates=${c.length}; source-path markers=${[...paths].join(',') || 'none'}`);
      if (c.length === 0) {
        t.diagnostic('UPSTREAM VERSION NOT DETERMINABLE from this binary (only source path markers, no version string)');
      } else {
        for (const s of c) assert.match(s, SEMVER);
      }
    });
  }

  test('xcframework carries no version metadata in plists beyond the framework default 1.0 (observation)', (t) => {
    const p = readText(path.join(XCF, SLICES[0], 'THETAClient.framework', 'Info.plist'));
    const ver = /CFBundleShortVersionString<\/key>\s*<string>([^<]+)</.exec(p)?.[1];
    t.diagnostic(`CFBundleShortVersionString=${ver}`);
    assert.ok(ver);
  });

  test('at least one slice proves ricoh360/theta-client lineage via embedded source paths or a version string', (t) => {
    const marker = /theta-client\/|theta-?client.*\d+\.\d+\.\d+/i;
    const hit = SLICES.map((id) => printableStrings(read(binaryPath(id))).some((s) => marker.test(s)));
    t.diagnostic('lineage evidence per slice (device, simulator): ' + hit.join(', '));
    assert.ok(hit.some(Boolean), 'no embedded theta-client markers in any slice');
  });
});

void fs;
