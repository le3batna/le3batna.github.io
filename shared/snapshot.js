// The shared-profile snapshot decoder: a port of
// packages/taste_core/lib/src/share/snapshot.dart (decodeSnapshotPayload and
// the fromJson checks). Keep the two in step: same limits, same rules.
//
// Link: https://le3batna.github.io/<app>/p/#<payload>, where payload =
// base64url(raw deflate(compact UTF-8 JSON)), no padding. The fragment never
// leaves the browser: this module only decodes it locally.
//
// decodePayload returns the snapshot in the shape the Dart toJson() writes
// (known fields only, empty ones left out), or throws a SnapshotError.
// An app with several kinds of item (رفّ) puts them in shelves: "h" is
// [{k: key, t: top ≤4, r: recent ≤40, s: stats} ≤8], an entry may name its
// shelf in "h" and carry "l": 1 when the owner liked it, and a list may
// carry a tag in "g".
// Lengths are counted in Unicode code points, like Dart's `runes.length`,
// except stat keys, which Dart counts in UTF-16 units (`String.length`).

import { BUY_LINK_MAX, parseBuyLink } from './buylink.js';

const MAX_PAYLOAD = 6000;
const MAX_INFLATED = 32 * 1024;
const MAX_SHELVES = 8;

/** A shelf's key (`p`, `g`, …), on a shelf or on an entry. */
const SHELF_KEY = /^[a-z0-9_-]{1,12}$/;

export class SnapshotError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SnapshotError';
  }
}

/** The payload part of a location hash ('#abc' gives 'abc'); '' when none. */
export function payloadFromHash(hash) {
  if (typeof hash !== 'string') return '';
  return hash.replace(/^#/, '').trim();
}

/**
 * Decodes and checks a payload. [app] is the app the profile must belong to
 * (null accepts any app, like the Dart default). Throws SnapshotError.
 */
export async function decodePayload(payload, app = 'raff') {
  if (typeof payload !== 'string' || payload.length === 0 || payload.length > MAX_PAYLOAD) {
    throw new SnapshotError('payload size');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) throw new SnapshotError('not base64url');
  const bytes = base64UrlDecode(payload);
  const inflated = await inflateRaw(bytes, MAX_INFLATED);
  let json;
  try {
    // fatal: malformed UTF-8 fails like Dart's utf8.decode; ignoreBOM keeps a
    // BOM in the text so JSON.parse refuses it, as Dart's jsonDecode does.
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(inflated);
    json = JSON.parse(text, markDoubles);
  } catch {
    throw new SnapshotError('not JSON');
  }
  return snapshotFromJson(json, app);
}

// ---------------------------------------------------------------- decoding

function base64UrlDecode(payload) {
  // Dart's base64Url.normalize refuses a length of 4n+1.
  if (payload.length % 4 === 1) throw new SnapshotError('not base64url');
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payload.length % 4)) % 4);
  let binary;
  try {
    binary = atob(b64);
  } catch {
    throw new SnapshotError('not base64url');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Raw-inflates [bytes], stopping as soon as the output passes [max]. */
async function inflateRaw(bytes, max) {
  let stream;
  try {
    stream = new DecompressionStream('deflate-raw');
  } catch {
    throw new SnapshotError('not deflate');
  }
  const writer = stream.writable.getWriter();
  // Errors surface on the reading side; these promises must not go unhandled.
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        reader.cancel().catch(() => {});
        throw new SnapshotError('too large once inflated');
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof SnapshotError) throw e;
    throw new SnapshotError('not deflate');
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

// Dart's jsonDecode reads `9.0` or `1e1` as a double, and the int checks
// refuse doubles. Where the browser gives the reviver the number's source
// text, such numbers are marked so the checks below refuse them too.
class JsonDouble {
  constructor(value) {
    this.value = value;
  }
}

function markDoubles(key, value, context) {
  if (typeof value === 'number' && context && typeof context.source === 'string' && /[.eE]/.test(context.source)) {
    return new JsonDouble(value);
  }
  return value;
}

// ------------------------------------------------------------------ checks

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof JsonDouble);
}

function field(json, key) {
  const v = Object.hasOwn(json, key) ? json[key] : undefined;
  return v === undefined ? null : v;
}

function runeLength(s) {
  return [...s].length;
}

function isInt(v) {
  return typeof v === 'number' && Number.isInteger(v);
}

function str(json, key, max) {
  const v = field(json, key);
  if (v === null) return null;
  if (typeof v !== 'string') throw new SnapshotError(`${key} is not text`);
  if (runeLength(v) > max) throw new SnapshotError(`${key} is longer than ${max}`);
  return v;
}

function int(json, key, min, max) {
  const v = field(json, key);
  if (v === null) return null;
  if (!isInt(v) || v < min || v > max) throw new SnapshotError(`${key} out of range`);
  return v === 0 ? 0 : v; // no -0
}

function entries(raw, max) {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) throw new SnapshotError('entries are not a list');
  if (raw.length > max) throw new SnapshotError(`more than ${max} entries`);
  return raw.map(entryFromJson);
}

function entryFromJson(json) {
  if (!isObject(json)) throw new SnapshotError('an entry is not an object');
  const shelf = str(json, 'h', 12);
  if (shelf !== null && !SHELF_KEY.test(shelf)) throw new SnapshotError('bad shelf on an entry');
  const e = {
    i: str(json, 'i', 80),
    t: str(json, 't', 80),
    s: str(json, 's', 60),
    r: int(json, 'r', 0, 10),
    g: str(json, 'g', 24),
    d: int(json, 'd', 19000101, 29991231),
    k: int(json, 'k', 0, 99),
    u: buyUrl(json),
    h: shelf,
    l: int(json, 'l', 0, 1),
  };
  if (e.i === null && e.t === null) throw new SnapshotError('an entry has no id and no title');
  const out = {};
  for (const key of ['i', 't', 's', 'r', 'g', 'd', 'k', 'u', 'h']) {
    if (e[key] !== null) out[key] = e[key];
  }
  // «أعجبني»: only a like is kept (like the Dart toJson).
  if (e.l === 1) out.l = 1;
  return out;
}

// A buy link: text, not absurdly long; kept only when it passes
// checkBuyLink (normalised), else dropped, like the Dart _buyUrl.
function buyUrl(json) {
  const v = field(json, 'u');
  if (v === null) return null;
  if (typeof v !== 'string') throw new SnapshotError('u is not text');
  if (runeLength(v) > 2 * BUY_LINK_MAX) throw new SnapshotError('u is too long');
  return parseBuyLink(v)?.url ?? null;
}

function listFromJson(json) {
  if (!isObject(json)) throw new SnapshotError('a list is not an object');
  const name = str(json, 'n', 40);
  if (name === null) throw new SnapshotError('a list has no name');
  const out = { n: name, i: entries(field(json, 'i'), 6) };
  const tag = str(json, 'g', 24);
  if (tag !== null) out.g = tag;
  return out;
}

function shelfFromJson(json) {
  if (!isObject(json)) throw new SnapshotError('a shelf is not an object');
  const key = str(json, 'k', 12);
  if (key === null || !SHELF_KEY.test(key)) throw new SnapshotError('a shelf has no key');
  const top = entries(field(json, 't'), 4);
  const recent = entries(field(json, 'r'), 40);
  const stats = statsFromJson(field(json, 's'));
  const out = { k: key };
  if (top.length) out.t = top;
  if (recent.length) out.r = recent;
  if (stats) out.s = stats;
  return out;
}

/** Stats: at most 16 keys of at most 24 UTF-16 units, ints 0-10,000,000; null when empty. */
function statsFromJson(raw) {
  const rawStats = raw ?? {};
  if (!isObject(rawStats) || Object.keys(rawStats).length > 16) throw new SnapshotError('bad stats');
  const stats = [];
  for (const [key, value] of Object.entries(rawStats)) {
    if (key.length > 24 || !isInt(value) || value < 0 || value > 10000000) throw new SnapshotError(`bad stat ${key}`);
    stats.push([key, value === 0 ? 0 : value]);
  }
  // fromEntries defines own properties, so even a "__proto__" key stays data.
  return stats.length ? Object.fromEntries(stats) : null;
}

function snapshotFromJson(json, app) {
  if (!isObject(json)) throw new SnapshotError('not an object');
  const v = field(json, 'v');
  // Dart compares with `!= 1`, where 1.0 == 1.
  if (!(v === 1 || (v instanceof JsonDouble && v.value === 1))) throw new SnapshotError(`unknown version ${v}`);
  const a = str(json, 'a', 24);
  if (a === null || (app !== null && app !== undefined && a !== app)) throw new SnapshotError(`a profile of ${a}`);
  const p = str(json, 'p', 64);
  if (p === null || !/^[A-Za-z0-9_.:-]+$/.test(p)) throw new SnapshotError('no profile id');
  const color = str(json, 'c', 6) ?? '';
  if (color.length > 0 && !/^[0-9a-fA-F]{6}$/.test(color)) throw new SnapshotError('bad colour');
  const stats = statsFromJson(field(json, 's'));
  const rawLists = field(json, 'l') ?? [];
  if (!Array.isArray(rawLists) || rawLists.length > 8) throw new SnapshotError('bad lists');
  const rawShelves = field(json, 'h') ?? [];
  if (!Array.isArray(rawShelves) || rawShelves.length > MAX_SHELVES) throw new SnapshotError('bad shelves');
  const shelves = rawShelves.map(shelfFromJson);
  if (new Set(shelves.map((s) => s.k)).size !== shelves.length) throw new SnapshotError('a shelf twice');

  const name = str(json, 'n', 40) ?? '';
  const bio = str(json, 'b', 160) ?? '';
  const emoji = str(json, 'e', 16) ?? '';
  const day = int(json, 'd', 19000101, 29991231);
  const top = entries(field(json, 't'), 4);
  const recent = entries(field(json, 'r'), 40);
  const lists = rawLists.map(listFromJson);

  // The Dart toJson() shape.
  const out = { v: 1, a, p };
  if (name) out.n = name;
  if (bio) out.b = bio;
  if (emoji) out.e = emoji;
  if (color) out.c = color;
  if (day !== null) out.d = day;
  if (top.length) out.t = top;
  if (recent.length) out.r = recent;
  if (stats) out.s = stats;
  if (lists.length) out.l = lists;
  if (shelves.length) out.h = shelves;
  return out;
}
