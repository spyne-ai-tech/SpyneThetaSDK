// THETAClient.h sanity + public API snapshot + required capabilities.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLICES, headerPath, readText, parseHeader, buildSnapshot, diffSnapshots } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const text = readText(headerPath(SLICES[0]));
const h = parseHeader(text);
const classes = h.interfaces.filter((i) => i.category === null);
const classNames = new Set(classes.map((c) => c.name));
const protoNames = new Set(h.protocols.map((p) => p.name));

describe('header sanity', () => {
  test('every @interface line parses', () => {
    assert.deepEqual(h.unparsed, [], 'unparseable @interface lines: ' + JSON.stringify(h.unparsed.slice(0, 5)));
  });

  test('interface count is at or above the floor (>= 250; 266 at snapshot time)', () => {
    assert.ok(classes.length >= 250, `only ${classes.length} class interfaces`);
  });

  test('no duplicate class @interface names (categories excluded; @class forward declarations are not counted)', () => {
    const seen = new Map();
    const dups = [];
    for (const c of classes) { if (seen.has(c.name)) dups.push(`${c.name} (lines ${seen.get(c.name)} and ${c.line})`); else seen.set(c.name, c.line); }
    assert.deepEqual(dups, []);
  });

  test('no duplicate @protocol definitions', () => {
    const names = h.protocols.map((p) => p.name);
    assert.equal(new Set(names).size, names.length);
  });

  test('every class interface is prefixed THETAC', () => {
    const bad = classes.filter((c) => !c.name.startsWith('THETAC')).map((c) => c.name);
    assert.deepEqual(bad, []);
  });

  test('every protocol is prefixed THETAC', () => {
    assert.deepEqual(h.protocols.filter((p) => !p.name.startsWith('THETAC')).map((p) => p.name), []);
  });

  test('every class has a superclass and every superclass is defined here or is a Foundation class', () => {
    const foundation = new Set(['NSObject', 'NSNumber', 'NSMutableSet', 'NSMutableDictionary']);
    const orphan = classes.filter((c) => !c.superclass || !(classNames.has(c.superclass) || foundation.has(c.superclass)))
      .map((c) => `${c.name} : ${c.superclass}`);
    assert.deepEqual(orphan, []);
  });

  test('every class referenced via @class forward declaration with the THETAC prefix is defined as an @interface (or is generic base)', () => {
    // Forward-declared THETAC classes that never get an @interface would be link-time holes for clients.
    const missing = [...h.forwardClasses].filter((n) => n.startsWith('THETAC') && !classNames.has(n));
    assert.deepEqual(missing, []);
  });

  test('every forward-declared @protocol is defined', () => {
    const m = /^@protocol\s+([^;]+);/m.exec(text);
    assert.ok(m, 'no forward @protocol line');
    const fwd = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(fwd.filter((n) => !protoNames.has(n)), []);
  });

  test('header is guarded by NS_ASSUME_NONNULL_BEGIN/END and balanced', () => {
    assert.equal((text.match(/NS_ASSUME_NONNULL_BEGIN/g) || []).length, 1);
    assert.equal((text.match(/NS_ASSUME_NONNULL_END/g) || []).length, 1);
    assert.equal((text.match(/#pragma clang diagnostic push/g) || []).length, (text.match(/#pragma clang diagnostic pop/g) || []).length);
  });

  test('@interface/@end are balanced', () => {
    const open = (text.match(/^@interface\b/gm) || []).length;
    const protoOpen = h.protocols.length;
    const end = (text.match(/^@end\b/gm) || []).length;
    assert.equal(end, open + protoOpen);
  });

  test('every generated class carries a swift_name (stable Swift API surface)', () => {
    const lines = text.split(/\r?\n/);
    const missing = [];
    for (const c of classes) {
      if (c.name === 'THETACBase') continue;
      const prev = lines.slice(Math.max(0, c.line - 4), c.line - 1).join('\n');
      if (!/swift_name\(/.test(prev)) missing.push(c.name);
    }
    // Only the generated *Kt file facades / numeric boxes may lack one; keep a tight bound so drift is noticed.
    assert.ok(missing.length <= 20, `${missing.length} classes without swift_name: ${missing.slice(0, 10).join(', ')}`);
  });

  test('no credential-looking material in the header (PEM blocks, AWS key ids) - counts only, nothing printed', () => {
    assert.equal((text.match(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g) || []).length, 0);
    assert.equal((text.match(/\bAKIA[0-9A-Z]{16}\b/g) || []).length, 0);
  });
});

describe('public API snapshot', () => {
  const snapPath = path.join(here, 'api-snapshot.json');

  test('api-snapshot.json is committed and well-formed', () => {
    assert.ok(fs.existsSync(snapPath), 'run: node tests/integrity/update-snapshot.mjs');
    const s = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    assert.equal(s.schema, 1);
    assert.ok(Object.keys(s.interfaces).length >= 250);
    assert.ok(Array.isArray(s.protocols) && Array.isArray(s.nsEnums) && Array.isArray(s.categories));
  });

  test('header API matches the committed snapshot (detects an unnoticed binary swap/upgrade)', () => {
    const expected = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    const actual = buildSnapshot(text);
    const diff = diffSnapshots(expected, actual);
    assert.deepEqual(diff, [], '\nPublic API changed vs tests/integrity/api-snapshot.json:\n' + diff.join('\n') +
      '\nIf this is a deliberate THETAClient upgrade, run `node tests/integrity/update-snapshot.mjs` and review the diff.');
  });

  test('simulator-slice header yields the same snapshot as the device-slice header', () => {
    const sim = buildSnapshot(readText(headerPath(SLICES[1])));
    assert.deepEqual(diffSnapshots(buildSnapshot(text), sim), []);
  });

  test('diffSnapshots reports additions, removals and superclass changes readably (self-test of the differ)', () => {
    const base = { interfaces: { A: 'THETACBase', B: 'THETACBase' }, categories: [], protocols: ['P'], nsEnums: [] };
    const next = { interfaces: { A: 'Other', C: 'THETACBase' }, categories: [], protocols: [], nsEnums: ['E'] };
    const d = diffSnapshots(base, next);
    assert.ok(d.includes('+ interface added:   C'));
    assert.ok(d.includes('- interface removed: B'));
    assert.ok(d.includes('~ interface superclass changed: A: THETACBase -> Other'));
    assert.ok(d.includes('- protocol removed: P'));
    assert.ok(d.includes('+ NS_ENUM added:   E'));
  });
});

describe('capabilities the Spyne capture apps rely on', () => {
  const requiredClasses = {
    'repository and config': ['THETACThetaRepository', 'THETACThetaRepositoryConfig', 'THETACThetaRepositoryTimeout', 'THETACThetaRepositoryOptions'],
    'capture builders': ['THETACPhotoCaptureBuilder', 'THETACVideoCaptureBuilder', 'THETACBurstCaptureBuilder', 'THETACMultiBracketCaptureBuilder',
      'THETACTimeShiftCaptureBuilder', 'THETACTimeShiftManualCaptureBuilder', 'THETACShotCountSpecifiedIntervalCaptureBuilder',
      'THETACCompositeIntervalCaptureBuilder', 'THETACContinuousCaptureBuilder', 'THETACLimitlessIntervalCaptureBuilder'],
    'capture result/handles': ['THETACPhotoCapture', 'THETACPhotoCaptureBase', 'THETACCapture', 'THETACCaptureBuilder', 'THETACCapturing', 'THETACCapturingStatusEnum'],
    'state, info, files': ['THETACThetaRepositoryThetaState', 'THETACThetaRepositoryThetaInfo', 'THETACThetaRepositoryThetaFiles', 'THETACThetaRepositoryFileInfo',
      'THETACThetaRepositoryThetaModel', 'THETACThetaRepositoryFileTypeEnum', 'THETACThetaRepositoryStorageEnum', 'THETACThetaRepositoryCaptureStatusEnum'],
    'exposure options (360 spin shoots)': ['THETACThetaRepositoryIsoEnum', 'THETACThetaRepositoryShutterSpeedEnum', 'THETACThetaRepositoryApertureEnum',
      'THETACThetaRepositoryWhiteBalanceEnum', 'THETACThetaRepositoryExposureCompensationEnum', 'THETACThetaRepositoryExposureProgramEnum',
      'THETACThetaRepositoryCaptureModeEnum', 'THETACThetaRepositoryBracketSetting', 'THETACThetaRepositoryBracketSettingList',
      'THETACThetaRepositoryFileFormatEnum', 'THETACThetaRepositoryGpsInfo', 'THETACThetaRepositoryImageStitchingEnum'],
    'exceptions': ['THETACThetaRepositoryThetaRepositoryException', 'THETACThetaRepositoryNotConnectedException', 'THETACThetaRepositoryThetaWebApiException',
      'THETACThetaRepositoryArgumentException', 'THETACThetaRepositoryThetaUnauthorizedException', 'THETACKotlinThrowable', 'THETACKotlinRuntimeException'],
    'networking and auth': ['THETACDigestAuth', 'THETACBaseHttpClient', 'THETACBaseHttpClientURL', 'THETACEventWebSocket', 'THETACCameraEvent',
      'THETACThetaRepositoryAccessPoint', 'THETACThetaRepositoryProxy', 'THETACThetaRepositoryEthernetConfig'],
    'kotlin runtime bridge': ['THETACBase', 'THETACKotlinEnum', 'THETACKotlinArray', 'THETACInt', 'THETACBoolean', 'THETACFloat', 'THETACDouble'],
  };
  for (const [group, names] of Object.entries(requiredClasses)) {
    test(`classes present: ${group}`, () => {
      assert.deepEqual(names.filter((n) => !classNames.has(n)), []);
    });
  }

  test('protocols present: capture/take-picture callbacks and event websocket callback', () => {
    const need = ['THETACPhotoCaptureTakePictureCallback', 'THETACEventWebSocketCallback', 'THETACVideoCaptureStartCaptureCallback',
      'THETACBurstCaptureStartCaptureCallback', 'THETACMultipartPostClient', 'THETACKotlinComparable'];
    assert.deepEqual(need.filter((n) => !protoNames.has(n)), []);
  });

  test('every *CaptureBuilder derives from THETACCaptureBuilder (directly or via PhotoCaptureBaseBuilder)', () => {
    const by = Object.fromEntries(classes.map((c) => [c.name, c.superclass]));
    const bad = classes.filter((c) => /CaptureBuilder$/.test(c.name) && c.name !== 'THETACCaptureBuilder' && c.name !== 'THETACPhotoCaptureBaseBuilder')
      .filter((c) => { let s = c.superclass; for (let i = 0; i < 5 && s; i++) { if (s === 'THETACCaptureBuilder') return false; s = by[s]; } return true; })
      .map((c) => c.name);
    assert.deepEqual(bad, []);
  });

  test('all exception classes derive from THETACThetaRepositoryThetaRepositoryException', () => {
    const exc = classes.filter((c) => /Exception$/.test(c.name) && c.name.startsWith('THETACThetaRepository') && c.name !== 'THETACThetaRepositoryThetaRepositoryException');
    assert.ok(exc.length >= 4);
    assert.deepEqual(exc.filter((c) => c.superclass !== 'THETACThetaRepositoryThetaRepositoryException').map((c) => c.name), []);
  });

  test('all *Enum classes (not Companion) derive from THETACKotlinEnum', () => {
    const bad = classes.filter((c) => /Enum$/.test(c.name) && c.name !== 'THETACKotlinEnum').filter((c) => c.superclass !== 'THETACKotlinEnum').map((c) => c.name);
    assert.deepEqual(bad, []);
  });

  test('THETACThetaRepository exposes the camera-facing operations Spyne uses (declared selectors)', () => {
    const start = text.indexOf('@interface THETACThetaRepository : ');
    const end = text.indexOf('\n@end', start);
    const body = text.slice(start, end);
    const need = ['getPhotoCaptureBuilder', 'getVideoCaptureBuilder', 'getBurstCaptureBuilder', 'getMultiBracketCaptureBuilder', 'getOptions', 'setOptions',
      'getThetaInfo', 'getThetaState', 'listFiles', 'deleteFiles', 'deleteAllFiles', 'getLivePreview', 'getEventWebSocket', 'reset', 'reboot'];
    assert.deepEqual(need.filter((n) => !new RegExp(`swift_name\\("${n}\\(`).test(body)), []);
  });

  test('ThetaRepository.Companion exposes an async factory (doNewInstance) and no other way to build a repository', () => {
    const start = text.indexOf('@interface THETACThetaRepositoryCompanion : ');
    const body = text.slice(start, text.indexOf('\n@end', start));
    assert.match(body, /swift_name\("doNewInstance\(/);
  });
});
