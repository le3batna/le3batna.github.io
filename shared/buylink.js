// Buy links: a port of packages/taste_core/lib/src/share/buy_link.dart
// (checkBuyLink, buyLinkWords). Keep the two in step: same list, same rules,
// same normalised output. The checks read the text itself instead of a URL
// parser, so Dart and the browser agree on every input.
//
// A shared buy link is someone else's content: https only, no URL shorteners
// (the destination must be visible), no credentials, no IP-address hosts, no
// port but 443, a plain ASCII domain with a letter TLD (punycode is shown as
// is), no spaces, control or markup characters, at most 300 characters.

import { hasProfanity } from './filter.js';

export const BUY_LINK_MAX = 300;

export const URL_SHORTENERS = [
  'bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'rb.gy', 'is.gd', 'v.gd',
  'shorturl.at', 'ow.ly', 'buff.ly', 'tiny.cc', 't.ly', 's.id', 'rebrand.ly', 'bl.ink', 'short.io',
  'shorte.st', 'adf.ly', 'lnkd.in', 'amzn.to', 'amzn.eu', 'a.co', 'fb.me', 'tr.im', 'snip.ly',
  'clck.ru', 'x.co', 'soo.gd', 'urlz.fr', 'qr.ae', 'shorturl.com', 'cli.re', 'chilp.it', 'u.to',
];

const FORBIDDEN = /[\s\x00-\x1f\x7f\\<>"`{}|^]/;
const BAD_ESCAPE = /%(?![0-9A-Fa-f]{2})/;
const SCHEME = /^([A-Za-z][A-Za-z0-9+.\-]*):([\s\S]*)$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const NUMERIC_LABEL = /^(?:0x[0-9a-f]*|[0-9]+)$/;

/**
 * Checks and normalises a buy link. Returns {link: {url, domain}} or
 * {problem: 'empty' | 'invalid' | 'notHttps' | 'credentials' | 'ipAddress' |
 * 'shortener' | 'tooLong'}.
 */
export function checkBuyLink(input) {
  if (typeof input !== 'string') return { problem: 'invalid' };
  // Dart's String.trim: Unicode whitespace, which JS trim() matches.
  const s = input.trim();
  if (!s) return { problem: 'empty' };
  if (FORBIDDEN.test(s) || BAD_ESCAPE.test(s)) return { problem: 'invalid' };

  let rest = s;
  const m = SCHEME.exec(s);
  if (m && !/^[0-9]/.test(m[2])) {
    if (m[1].toLowerCase() !== 'https') return { problem: 'notHttps' };
    rest = m[2];
    if (!rest.startsWith('//')) return { problem: 'invalid' };
  }
  if (rest.startsWith('//')) rest = rest.slice(2);

  const end = rest.search(/[/?#]/);
  let authority = end < 0 ? rest : rest.slice(0, end);
  const tail = end < 0 ? '' : rest.slice(end);
  if (authority.includes('@')) return { problem: 'credentials' };
  if (authority.startsWith('[') || (authority.match(/:/g) ?? []).length > 1) return { problem: 'ipAddress' };
  const colon = authority.indexOf(':');
  if (colon >= 0) {
    const port = authority.slice(colon + 1);
    if (port && port !== '443') return { problem: 'invalid' };
    authority = authority.slice(0, colon);
  }
  // ASCII-only lowercasing, like Dart's toLowerCase on an ASCII host; a
  // non-ASCII host fails the label check either way.
  let host = authority.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (!host) return { problem: 'invalid' };
  const labels = host.split('.');
  if (labels.every((l) => NUMERIC_LABEL.test(l))) return { problem: 'ipAddress' };
  if (host.length > 253 || labels.length < 2 || !labels.every((l) => LABEL.test(l)) || !TLD.test(labels[labels.length - 1])) {
    return { problem: 'invalid' };
  }
  for (const short of URL_SHORTENERS) {
    if (host === short || host.endsWith(`.${short}`)) return { problem: 'shortener' };
  }
  const url = `https://${host}${tail}`;
  if ([...url].length > BUY_LINK_MAX) return { problem: 'tooLong' };
  try {
    new URL(url);
  } catch {
    return { problem: 'invalid' };
  }
  return { link: { url, domain: host.startsWith('www.') ? host.slice(4) : host } };
}

/** The checked link ({url, domain}), or null. */
export function parseBuyLink(input) {
  return checkBuyLink(input).link ?? null;
}

/** The words of a URL, for the profanity filter (which reads words). */
export function buyLinkWords(url) {
  return String(url).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** False when the words of [url] hit the filter. */
export function buyLinkIsClean(url) {
  return !hasProfanity(buyLinkWords(url));
}
