// Mach-O validation of the real binaries. Parses headers + load commands; does not trust file sizes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SLICES, XCF, binaryPath, sliceDir, parseMachO, machoMagicKind, readText, parsePlist } from './lib.mjs';

const MB = 1024 * 1024;
const root = parsePlist(readText(path.join(XCF, 'Info.plist')));
const declared = Object.fromEntries(root.AvailableLibraries.map((l) => [l.LibraryIdentifier, l.SupportedArchitectures]));

const info = {};
for (const id of SLICES) info[id] = parseMachO(binaryPath(id));

describe('Mach-O binaries', () => {
  for (const id of SLICES) {
    describe(id, () => {
      const m = info[id];
      const simulator = id.includes('simulator');

      test('binary is non-trivial in size (> 5 MB)', () => {
        assert.ok(fs.statSync(binaryPath(id)).size > 5 * MB);
      });

      test('magic number is a valid Mach-O (thin 64-bit LE or FAT)', () => {
        assert.notEqual(machoMagicKind(binaryPath(id)), 'other');
      });

      test(simulator ? 'is a FAT binary' : 'is a thin 64-bit binary', () => {
        assert.equal(m.kind, simulator ? 'fat' : 'thin');
      });

      test('architectures in the Mach-O equal SupportedArchitectures in the xcframework plist', (t) => {
        const found = m.archs.map((a) => a.arch).sort();
        t.diagnostic(`${id}: cputypes = ${m.archs.map((a) => a.arch + '(0x' + a.cputype.toString(16) + ')').join(', ')}`);
        assert.deepEqual(found, [...declared[id]].sort());
      });

      test('no duplicate architectures', () => {
        const names = m.archs.map((a) => a.arch);
        assert.equal(new Set(names).size, names.length);
      });

      test('every arch is a dylib (MH_DYLIB) with a non-trivial slice size', () => {
        for (const a of m.archs) {
          assert.equal(a.filetype, 'dylib', `${a.arch} filetype`);
          assert.ok(a.size > 4 * MB, `${a.arch} slice size ${a.size}`);
          assert.ok(a.ncmds > 5);
        }
      });

      test('fat header cputype matches the embedded Mach-O header cputype', () => {
        for (const a of m.archs) assert.equal(a.fatCpu, a.cputype);
      });

      test('install name is @rpath/THETAClient.framework/THETAClient', () => {
        for (const a of m.archs) assert.equal(a.installName, '@rpath/THETAClient.framework/THETAClient', a.arch);
      });

      test(`LC_BUILD_VERSION platform is ${simulator ? 'ios-simulator' : 'ios'} for every arch (slice is not mislabeled)`, () => {
        for (const a of m.archs) assert.equal(a.platform, simulator ? 'ios-simulator' : 'ios', a.arch);
      });

      test('deployment target (minos) is at or below iOS 16, the package minimum', () => {
        for (const a of m.archs) {
          assert.ok(a.minos, a.arch + ' has no LC_BUILD_VERSION');
          assert.ok(a.minos[0] <= 16, `${a.arch} minos ${a.minos.join('.')}`);
        }
      });

      test('has __TEXT and __DATA segments', () => {
        for (const a of m.archs) {
          assert.ok(a.segments.includes('__TEXT'), a.arch + ' lacks __TEXT');
          assert.ok(a.segments.includes('__DATA'), a.arch + ' lacks __DATA');
        }
      });

      test('dSYM DWARF file is a valid Mach-O (thin or fat)', () => {
        const dwarf = path.join(sliceDir(id), 'dSYMs', 'THETAClient.framework.dSYM', 'Contents', 'Resources', 'DWARF', 'THETAClient');
        assert.notEqual(machoMagicKind(dwarf), 'other');
      });
    });
  }

  test('simulator slice contains BOTH arm64 and x86_64', () => {
    const archs = info['ios-arm64_x86_64-simulator'].archs.map((a) => a.arch).sort();
    assert.deepEqual(archs, ['arm64', 'x86_64']);
  });

  test('device slice contains arm64 only (no x86_64)', () => {
    assert.deepEqual(info['ios-arm64'].archs.map((a) => a.arch), ['arm64']);
  });

  test('simulator and device binaries are different files (no accidental duplicate copy)', () => {
    const a = fs.readFileSync(binaryPath(SLICES[0]));
    const b = fs.readFileSync(binaryPath(SLICES[1]));
    assert.ok(!a.equals(b));
  });

  test('simulator arm64 sub-slice is NOT byte-identical to device slice (a device build must not be passed off as simulator)', () => {
    const dev = fs.readFileSync(binaryPath(SLICES[0]));
    const simBuf = fs.readFileSync(binaryPath(SLICES[1]));
    const sa = info[SLICES[1]].archs.find((a) => a.arch === 'arm64');
    assert.ok(!dev.equals(simBuf.subarray(sa.offset, sa.offset + sa.size)));
  });
});
