// Shared helpers for the integrity tests. Zero dependencies. Not a test file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const XCF = path.join(REPO, 'Sources', 'THETAClient', 'THETAClient.xcframework');
export const SLICES = ['ios-arm64', 'ios-arm64_x86_64-simulator'];
export const sliceDir = (id) => path.join(XCF, id);
export const fwDir = (id) => path.join(XCF, id, 'THETAClient.framework');
export const headerPath = (id) => path.join(fwDir(id), 'Headers', 'THETAClient.h');
export const binaryPath = (id) => path.join(fwDir(id), 'THETAClient');
export const read = (p) => fs.readFileSync(p);
export const readText = (p) => fs.readFileSync(p, 'utf8');
export const sha256 = (p) => crypto.createHash('sha256').update(read(p)).digest('hex');

// ---------------------------------------------------------------- plist (XML)
export function parsePlist(xml) {
  const re = /<(\/?)(plist|dict|array|key|string|integer|real)(\/?)>|<(true|false)\s*\/>|([^<]+)/g;
  const toks = [];
  let m;
  const body = xml.replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '');
  while ((m = re.exec(body))) {
    if (m[5] !== undefined) { if (m[5].trim() !== '') toks.push({ t: 'text', v: m[5].trim() }); continue; }
    if (m[4]) { toks.push({ t: m[4] }); continue; }
    toks.push({ t: m[2], close: m[1] === '/', self: m[3] === '/' });
  }
  let i = 0;
  const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  function value() {
    const tk = toks[i++];
    if (tk.t === 'true') return true;
    if (tk.t === 'false') return false;
    if (tk.t === 'dict') {
      const o = {};
      while (!(toks[i].t === 'dict' && toks[i].close)) {
        i++; // <key>
        const k = unescape(toks[i++].v); i++; // key text, </key>
        o[k] = value();
      }
      i++; return o;
    }
    if (tk.t === 'array') {
      const a = [];
      while (!(toks[i].t === 'array' && toks[i].close)) a.push(value());
      i++; return a;
    }
    if (tk.t === 'string' || tk.t === 'integer' || tk.t === 'real') {
      if (tk.self) return '';
      let v = '';
      if (toks[i].t === 'text') v = unescape(toks[i++].v);
      i++; // closing tag
      return tk.t === 'string' ? v : Number(v);
    }
    throw new Error('plist: unexpected token ' + JSON.stringify(tk));
  }
  while (toks[i].t !== 'dict' && toks[i].t !== 'array') i++;
  return value();
}

// ---------------------------------------------------------------- Mach-O
export const CPU = { 0x01000007: 'x86_64', 0x0100000c: 'arm64', 0x0200000c: 'arm64_32', 7: 'i386', 12: 'arm' };
export const PLATFORM = { 1: 'macos', 2: 'ios', 3: 'tvos', 4: 'watchos', 6: 'maccatalyst', 7: 'ios-simulator' };
export const FILETYPE = { 1: 'object', 2: 'execute', 6: 'dylib', 8: 'bundle', 10: 'dsym' };

function parseThin(b, off) {
  const magic = b.readUInt32LE(off);
  if (magic !== 0xfeedfacf) throw new Error('not a thin 64-bit little-endian Mach-O at offset ' + off + ' magic=0x' + magic.toString(16));
  const cputype = b.readUInt32LE(off + 4);
  const filetype = b.readUInt32LE(off + 12);
  const ncmds = b.readUInt32LE(off + 16);
  let p = off + 32;
  const info = { cputype, arch: CPU[cputype] ?? 'unknown', filetype: FILETYPE[filetype] ?? filetype, ncmds, platform: null, minos: null, installName: null, segments: [] };
  for (let n = 0; n < ncmds; n++) {
    const cmd = b.readUInt32LE(p), size = b.readUInt32LE(p + 4);
    if (size < 8) throw new Error('corrupt load command');
    if (cmd === 0x32) { // LC_BUILD_VERSION
      info.platform = PLATFORM[b.readUInt32LE(p + 8)] ?? b.readUInt32LE(p + 8);
      const v = b.readUInt32LE(p + 12);
      info.minos = [v >> 16, (v >> 8) & 0xff, v & 0xff];
    } else if (cmd === 0xd) { // LC_ID_DYLIB
      info.installName = b.slice(p + 24, p + size).toString('latin1').replace(/\0[\s\S]*$/, '');
    } else if (cmd === 0x19) { // LC_SEGMENT_64
      info.segments.push(b.slice(p + 8, p + 24).toString('latin1').replace(/\0+$/, ''));
    }
    p += size;
  }
  return info;
}

/** Returns { kind: 'thin'|'fat', archs: [{arch, offset, size, ...macho info}], fileSize } */
export function parseMachO(file) {
  const b = read(file);
  if (b.length < 32) throw new Error('file too small to be Mach-O: ' + b.length);
  if (b.readUInt32BE(0) === 0xcafebabe) {
    const n = b.readUInt32BE(4);
    if (n < 1 || n > 8) throw new Error('implausible fat arch count ' + n);
    const archs = [];
    for (let i = 0; i < n; i++) {
      const o = 8 + 20 * i;
      const offset = b.readUInt32BE(o + 8), size = b.readUInt32BE(o + 12);
      if (offset + size > b.length) throw new Error('fat arch #' + i + ' extends past end of file');
      const fatCpu = b.readUInt32BE(o);
      const thin = parseThin(b, offset);
      archs.push({ ...thin, offset, size, fatCpu });
    }
    return { kind: 'fat', archs, fileSize: b.length };
  }
  const thin = parseThin(b, 0);
  return { kind: 'thin', archs: [{ ...thin, offset: 0, size: b.length, fatCpu: thin.cputype }], fileSize: b.length };
}

export function machoMagicKind(file) {
  const b = read(file);
  const be = b.readUInt32BE(0), le = b.readUInt32LE(0);
  if (be === 0xcafebabe) return 'fat';
  if (le === 0xfeedfacf) return 'thin64';
  return 'other';
}

// ---------------------------------------------------------------- header
const IFACE = /^@interface\s+(\w+)\s*(<[^>]*>)?\s*(?:\(\s*(\w*)\s*\))?\s*(?::\s*(\w+)\s*(<.*>)?)?\s*(<[^>]*>)?\s*$/;

export function parseHeader(text) {
  const interfaces = []; // {name, superclass, category, line}
  const unparsed = [];
  const protocols = [];
  const forwardClasses = new Set();
  const nsEnums = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((ln, idx) => {
    const lineNo = idx + 1;
    if (ln.startsWith('@interface')) {
      const m = IFACE.exec(ln.trimEnd());
      if (!m) { unparsed.push({ line: lineNo, text: ln }); return; }
      interfaces.push({ name: m[1], category: m[3] !== undefined ? m[3] : null, superclass: m[4] ?? null, line: lineNo });
    } else if (/^@protocol\s+\w+/.test(ln) && !/[,;]\s*$/.test(ln)) {
      protocols.push({ name: /^@protocol\s+(\w+)/.exec(ln)[1], line: lineNo });
    } else if (ln.startsWith('@class ')) {
      ln.replace(/^@class\s+/, '').replace(/;\s*$/, '').split(',').forEach((s) => {
        const n = /^\s*(\w+)/.exec(s); if (n) forwardClasses.add(n[1]);
      });
    }
    const e = /NS_(?:CLOSED_)?(?:ENUM|OPTIONS)\s*\(\s*[\w\s]+,\s*(\w+)\s*\)/.exec(ln);
    if (e) nsEnums.push({ name: e[1], line: lineNo });
    const te = /^typedef\s+enum\b[^{]*\{?.*\}\s*(\w+)\s*;/.exec(ln);
    if (te) nsEnums.push({ name: te[1], line: lineNo });
  });
  return { interfaces, unparsed, protocols, forwardClasses, nsEnums, lineCount: lines.length };
}

export function buildSnapshot(headerText) {
  const h = parseHeader(headerText);
  const classes = h.interfaces.filter((i) => i.category === null);
  const cats = h.interfaces.filter((i) => i.category !== null);
  const interfaces = {};
  for (const c of classes.sort((a, b) => a.name.localeCompare(b.name))) interfaces[c.name] = c.superclass;
  return {
    _comment: 'Public Objective-C API surface of THETAClient.h. Regenerate with: node tests/integrity/update-snapshot.mjs (only after a deliberate binary upgrade, and review the diff).',
    schema: 1,
    interfaces,
    categories: cats.map((c) => `${c.name} (${c.category})`).sort(),
    protocols: h.protocols.map((p) => p.name).sort(),
    nsEnums: h.nsEnums.map((p) => p.name).sort(),
  };
}

/** Readable diff between two snapshots. Returns array of lines (empty = equal). */
export function diffSnapshots(expected, actual) {
  const out = [];
  const cmpList = (label, a, b) => {
    const sa = new Set(a), sb = new Set(b);
    for (const x of b) if (!sa.has(x)) out.push(`+ ${label} added:   ${x}`);
    for (const x of a) if (!sb.has(x)) out.push(`- ${label} removed: ${x}`);
  };
  cmpList('interface', Object.keys(expected.interfaces), Object.keys(actual.interfaces));
  for (const k of Object.keys(expected.interfaces)) {
    if (k in actual.interfaces && expected.interfaces[k] !== actual.interfaces[k]) {
      out.push(`~ interface superclass changed: ${k}: ${expected.interfaces[k]} -> ${actual.interfaces[k]}`);
    }
  }
  cmpList('category', expected.categories, actual.categories);
  cmpList('protocol', expected.protocols, actual.protocols);
  cmpList('NS_ENUM', expected.nsEnums, actual.nsEnums);
  return out;
}
