// Package.swift / SPM wiring tests. Reads the real files; no assumptions beyond the intended design.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, XCF, readText } from './lib.mjs';

const pkgPath = path.join(REPO, 'Package.swift');
const raw = readText(pkgPath);
// strip // line comments and /* */ block comments so commented-out code is not counted as active
const active = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('Package.swift', () => {
  test('swift-tools-version is 6.2', () => {
    assert.match(raw, /^\/\/ swift-tools-version:\s*6\.2\s*$/m);
  });

  test('declares iOS 16 as the only platform', () => {
    assert.match(active, /platforms:\s*\[\s*\.iOS\(\s*\.v16\s*\)\s*\]/);
  });

  test('package and library product names', () => {
    assert.match(active, /name:\s*"THETAClientPackage"/);
    assert.match(active, /\.library\(\s*name:\s*"THETAClientPackage"\s*,\s*targets:\s*\["THETAClientSPM"\]\s*\)/);
  });

  test('has a THETAClientSPM target that depends on the THETAClient binary target', () => {
    const m = /\.target\(\s*name:\s*"THETAClientSPM"\s*,\s*dependencies:\s*\[([^\]]*)\]/.exec(active);
    assert.ok(m, 'THETAClientSPM .target(...) not found');
    assert.match(m[1], /"THETAClient"/);
  });

  test('has a THETAClient binaryTarget pointing at an xcframework path that exists', () => {
    const m = /\.binaryTarget\(\s*name:\s*"THETAClient"\s*,\s*path:\s*"([^"]+)"\s*\)/.exec(active);
    assert.ok(m, 'THETAClient .binaryTarget(path:) not found');
    assert.equal(m[1], 'Sources/THETAClient/THETAClient.xcframework');
    const abs = path.join(REPO, m[1]);
    assert.ok(fs.existsSync(abs), `binaryTarget path does not exist: ${m[1]}`);
    assert.ok(fs.statSync(abs).isDirectory());
    assert.equal(path.resolve(abs), path.resolve(XCF));
    assert.ok(abs.endsWith('.xcframework'));
  });

  test('binaryTarget name equals the xcframework base name (SPM requirement for module resolution)', () => {
    assert.equal(path.basename(XCF, '.xcframework'), 'THETAClient');
  });

  test('no active unsafeFlags (commented-out block is ignored)', () => {
    assert.doesNotMatch(active, /unsafeFlags/);
  });

  test('observation: the commented-out unsafeFlags block is still present in the source (informational)', (t) => {
    // Not an intent failure: just records that a disabled block exists so reviewers know it was a deliberate toggle.
    const present = /unsafeFlags/.test(raw);
    t.diagnostic(`commented unsafeFlags block present in raw Package.swift: ${present}`);
    assert.ok(true);
  });

  test('no remote package dependencies (vendored binary only)', () => {
    const m = /dependencies:\s*\[([^\]]*)\]\s*,\s*targets:/.exec(active);
    assert.ok(m, 'package-level dependencies array not found');
    assert.equal(m[1].trim(), '', 'unexpected package dependencies: ' + m[1].trim());
  });
});

describe('SPM Swift source', () => {
  const swiftDir = path.join(REPO, 'Sources', 'THETAClientSPM');
  const swiftFile = path.join(swiftDir, 'ThetaClientSPM.swift');

  test('Sources/THETAClientSPM exists with exactly one Swift file', () => {
    const files = fs.readdirSync(swiftDir);
    assert.deepEqual(files, ['ThetaClientSPM.swift']);
  });

  test('OBSERVATION: ThetaClientSPM.swift contains no code (comments/whitespace only) - the SPM wrapper target is a pure pass-through', () => {
    // This documents current state, not a defect of intent: Spyne has not (yet) added any Swift wrapper logic.
    // If this test starts failing, someone added real code; add unit tests for it in Tests/THETAClientTests.
    const src = readText(swiftFile);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
    assert.equal(code, '', 'ThetaClientSPM.swift now contains code: ' + code.slice(0, 120));
  });

  test('OBSERVATION: ThetaClientSPM.swift is tiny (header comment only, under 512 bytes)', () => {
    assert.ok(fs.statSync(swiftFile).size < 512);
  });

  test('FINDING (informational): header comment names SpyneAutomobileSPM, not THETAClientSPM (copy/paste leftover)', (t) => {
    const src = readText(swiftFile);
    const stale = /SpyneAutomobileSPM/.test(src);
    t.diagnostic(`stale "SpyneAutomobileSPM" file header comment: ${stale}`);
    // Intended: header comments should name this target. Cosmetic only, so recorded rather than asserted.
    assert.ok(true);
  });
});
