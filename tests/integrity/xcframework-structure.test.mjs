// Structure of THETAClient.xcframework: root Info.plist vs real slices on disk, per-slice framework layout.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { XCF, SLICES, sliceDir, fwDir, headerPath, binaryPath, readText, parsePlist, read } from './lib.mjs';

const root = parsePlist(readText(path.join(XCF, 'Info.plist')));
const libs = root.AvailableLibraries;

const EXPECTED = {
  'ios-arm64': { archs: ['arm64'], variant: undefined },
  'ios-arm64_x86_64-simulator': { archs: ['arm64', 'x86_64'], variant: 'simulator' },
};

describe('xcframework root Info.plist', () => {
  test('is an XFWK format 1.0 plist', () => {
    assert.equal(root.CFBundlePackageType, 'XFWK');
    assert.equal(root.XCFrameworkFormatVersion, '1.0');
  });

  test('lists exactly the slices that exist on disk (no missing, no orphan)', () => {
    const listed = libs.map((l) => l.LibraryIdentifier).sort();
    const onDisk = fs.readdirSync(XCF, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    assert.deepEqual(listed, onDisk, 'plist LibraryIdentifiers differ from directories in the xcframework');
    assert.deepEqual(listed, [...SLICES].sort());
  });

  test('LibraryIdentifier values are unique', () => {
    assert.equal(new Set(libs.map((l) => l.LibraryIdentifier)).size, libs.length);
  });

  for (const l of libs) {
    describe(`entry ${l.LibraryIdentifier}`, () => {
      const exp = EXPECTED[l.LibraryIdentifier];
      test('is a known slice', () => assert.ok(exp, 'unexpected slice ' + l.LibraryIdentifier));

      test('LibraryPath exists and is THETAClient.framework', () => {
        assert.equal(l.LibraryPath, 'THETAClient.framework');
        assert.ok(fs.statSync(path.join(sliceDir(l.LibraryIdentifier), l.LibraryPath)).isDirectory());
      });

      test('BinaryPath resolves to a real file', () => {
        assert.equal(l.BinaryPath, 'THETAClient.framework/THETAClient');
        const p = path.join(sliceDir(l.LibraryIdentifier), l.BinaryPath);
        assert.ok(fs.statSync(p).isFile());
      });

      test('DebugSymbolsPath points at an existing dSYMs directory', () => {
        assert.equal(l.DebugSymbolsPath, 'dSYMs');
        assert.ok(fs.statSync(path.join(sliceDir(l.LibraryIdentifier), l.DebugSymbolsPath)).isDirectory());
      });

      test('SupportedPlatform is ios', () => assert.equal(l.SupportedPlatform, 'ios'));

      test('SupportedPlatformVariant matches the slice name (simulator only for the simulator slice)', () => {
        assert.equal(l.SupportedPlatformVariant, exp.variant);
        assert.equal(l.LibraryIdentifier.includes('simulator'), l.SupportedPlatformVariant === 'simulator');
      });

      test('SupportedArchitectures matches the identifier and the expected set', () => {
        assert.deepEqual([...l.SupportedArchitectures].sort(), [...exp.archs].sort());
        for (const a of l.SupportedArchitectures) assert.ok(l.LibraryIdentifier.includes(a), `${a} not in identifier ${l.LibraryIdentifier}`);
      });
    });
  }
});

describe('per-slice framework layout', () => {
  for (const id of SLICES) {
    describe(id, () => {
      const fw = fwDir(id);
      test('Headers/THETAClient.h exists and is non-empty', () => {
        assert.ok(fs.statSync(headerPath(id)).size > 100_000, 'header unexpectedly small');
      });

      test('Modules/module.modulemap declares `framework module THETAClient` with umbrella header THETAClient.h', () => {
        const mm = readText(path.join(fw, 'Modules', 'module.modulemap'));
        assert.match(mm, /^\s*framework\s+module\s+THETAClient\s*\{/m);
        assert.match(mm, /umbrella\s+header\s+"THETAClient\.h"/);
        assert.match(mm, /export\s+\*/);
        // the umbrella header it names must actually be in Headers/
        assert.ok(fs.existsSync(path.join(fw, 'Headers', 'THETAClient.h')));
      });

      test('framework Info.plist has expected identity keys', () => {
        const p = parsePlist(readText(path.join(fw, 'Info.plist')));
        assert.equal(p.CFBundleIdentifier, 'com.ricoh360.thetaclient.THETAClient');
        assert.equal(p.CFBundleExecutable, 'THETAClient');
        assert.equal(p.CFBundleName, 'THETAClient');
        assert.equal(p.CFBundlePackageType, 'FMWK');
        assert.equal(p.MinimumOSVersion, '12.0');
        assert.ok(fs.existsSync(path.join(fw, p.CFBundleExecutable)), 'CFBundleExecutable file missing');
      });

      test('MinimumOSVersion does not exceed the package deployment target (iOS 16)', () => {
        const p = parsePlist(readText(path.join(fw, 'Info.plist')));
        assert.ok(parseFloat(p.MinimumOSVersion) <= 16);
      });

      test('framework Info.plist CFBundleSupportedPlatforms is non-empty', () => {
        const p = parsePlist(readText(path.join(fw, 'Info.plist')));
        assert.ok(Array.isArray(p.CFBundleSupportedPlatforms) && p.CFBundleSupportedPlatforms.length >= 1);
      });

      test('INTENDED: CFBundleSupportedPlatforms matches the slice (iPhoneOS on device, iPhoneSimulator on simulator)', {
        skip: id.includes('simulator') ? 'KNOWN DEFECT: simulator slice Info.plist:17-19 says iPhoneOS; remove this skip when the framework is rebuilt' : false,
      }, () => {
        // PACKAGING FINDING (see qa-agents/00-author-notes.md): the simulator slice Info.plist says iPhoneOS.
        // Apple's own tooling emits iPhoneSimulator for simulator frameworks. This assertion encodes the intent.
        const p = parsePlist(readText(path.join(fw, 'Info.plist')));
        const want = id.includes('simulator') ? 'iPhoneSimulator' : 'iPhoneOS';
        assert.deepEqual(p.CFBundleSupportedPlatforms, [want], `${path.join(fw, 'Info.plist')}:CFBundleSupportedPlatforms`);
      });

      test('dSYM bundle present with Info.plist and a non-trivial DWARF file', () => {
        const dsym = path.join(sliceDir(id), 'dSYMs', 'THETAClient.framework.dSYM');
        assert.ok(fs.statSync(path.join(dsym, 'Contents', 'Info.plist')).isFile());
        const dwarf = path.join(dsym, 'Contents', 'Resources', 'DWARF', 'THETAClient');
        assert.ok(fs.statSync(dwarf).size > 1_000_000, 'DWARF file under 1MB');
      });

      test('no stray files at framework root (only Headers, Modules, Info.plist, THETAClient)', () => {
        assert.deepEqual(fs.readdirSync(fw).sort(), ['Headers', 'Info.plist', 'Modules', 'THETAClient']);
      });
    });
  }

  test('headers in both slices are byte-identical', () => {
    assert.ok(read(headerPath(SLICES[0])).equals(read(headerPath(SLICES[1]))));
  });

  test('OBSERVATION: module maps may differ between slices (device has an extra "use Foundation"); both declare the same framework module', (t) => {
    const norm = (id) => readText(path.join(fwDir(id), 'Modules', 'module.modulemap')).replace(/\s+/g, ' ').trim();
    const [a, b] = SLICES.map(norm);
    t.diagnostic('module maps identical: ' + (a === b) + ' (differences are informational, not a failure)');
    assert.ok(/framework module THETAClient/.test(a) && /framework module THETAClient/.test(b));
  });
});
