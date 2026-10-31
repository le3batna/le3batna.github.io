// رفّ profile viewer. It decodes the snapshot in the link's fragment
// (web/shared/snapshot.js) and draws the profile shelf by shelf: perfumes,
// games, movies, series, comics, books, then the month across them, the lists, the
// layering combos and the buy links. The fragment never leaves the browser,
// and the page makes no request of its own: titles ride in the link (the
// app embeds a short title for catalog items), so no catalog is fetched.
//
// The structure mirrors the app's view of a friend's profile
// (apps/raff/lib/ui/friend_shelves.dart); the covers are a port of
// apps/raff/lib/ui/covers.dart (./covers.js); the wording is the app's
// (apps/raff/lib/ui/shelf_strings.dart, raff_strings.dart).
//
// Safety: decoded text reaches the page through textContent and
// createElement only, never as markup. Names, bios, titles, subtitles and
// list names pass through the profanity filter before they are shown. Buy
// links pass the same checks as in the app (web/shared/buylink.js); the
// button shows the shop's domain, and the link opens only from a sheet that
// shows the domain and the whole link again, with rel="noopener noreferrer
// nofollow ugc".

import { decodePayload, payloadFromHash } from '../../shared/snapshot.js';
import { censor } from '../../shared/filter.js';
import { buyLinkIsClean, parseBuyLink } from '../../shared/buylink.js';
import { KIND_OF_CODE, SHELF_STYLES, coverElement, glyphIcon } from './covers.js';
import { NO_RATING_BOOKS } from './no-rating.js';

// TODO: replace with رفّ's real App Store link once its App Store record exists.
export const APP_STORE_URL = 'https://apps.apple.com/app/id6828913497';

// All text the page shows. Arabic is the default; English is used when the
// browser's language is not Arabic. {name}, {n}, {list}, {date}, {day},
// {month} are filled in.
export const LABELS = {
  ar: {
    appName: 'رفّ',
    wordmark: 'رفّ',
    getApp: 'حمّل رفّ',
    pageTitle: 'رفّ {name}',
    noName: 'صاحب الرفّ',
    shelfTitle: { perfume: 'عطوري', game: 'ألعابي', movie: 'أفلامي', series: 'مسلسلاتي', comic: 'مانجا وكوميكس', book: 'كتبي' },
    // What an item shows when the link carries no title for it (the app
    // drops catalog titles last when a link is too long): count.<kind>.1,
    // and the shelf's name for comics.
    shelfItem: { perfume: 'عطر', game: 'لعبة', movie: 'فيلم', series: 'مسلسل', comic: 'مانجا', book: 'كتاب' },
    status: {
      perfume: { have: 'عندي', want: 'أبغاه', had: 'كان عندي' },
      game: { played: 'لعبتها', playing: 'ألعبها', want: 'أبغى ألعبها', dropped: 'تركتها' },
      movie: { watched: 'شفته', want: 'أبغى أشوفه' },
      series: { watching: 'أتابعه', finished: 'خلّصته', want: 'أبغى أتابعه', dropped: 'تركته' },
      comic: { reading: 'أقراها', read: 'قريتها', want: 'أبغى أقراها', dropped: 'تركتها' },
      book: { read: 'قريته', reading: 'أقراه', want: 'أبغى أقراه', dropped: 'تركته' },
    },
    wears: 'لبسة',
    count: {
      perfume: { one: 'عطر', two: 'عطرين', few: '{n} عطور', many: '{n} عطر' },
      game: { one: 'لعبة', two: 'لعبتين', few: '{n} ألعاب', many: '{n} لعبة' },
      movie: { one: 'فيلم', two: 'فيلمين', few: '{n} أفلام', many: '{n} فيلم' },
      series: { one: 'مسلسل', two: 'مسلسلين', few: '{n} مسلسلات', many: '{n} مسلسل' },
      comic: { one: 'عنوان مانجا', two: 'عنوانين مانجا', few: '{n} عناوين مانجا', many: '{n} عنوان مانجا' },
      book: { one: 'كتاب', two: 'كتابين', few: '{n} كتب', many: '{n} كتاب' },
    },
    monthLine: 'هالشهر: {list}',
    listJoin: '، ',
    occasions: {
      work: 'دوام',
      occasion: 'مناسبة',
      friday: 'جمعة',
      travel: 'سفر',
      outing: 'طلعة',
      home: 'بيت',
      evening: 'سهرة',
    },
    rewatch: 'إعادة',
    lists: 'قوائمي',
    combos: 'خلطاتي',
    liked: 'أعجبني',
    likedOne: 'أعجبه',
    buyTitle: 'روابط الشراء',
    buyHere: 'اشتره من هنا',
    confirmTitle: 'تفتح موقع خارجي؟',
    confirmNote: 'هذا الرابط أضافه صاحب الملف. تحقّق من الموقع قبل الشراء.',
    confirmOpen: 'افتح الموقع',
    cancel: 'إلغاء',
    stars: '{n} من 5',
    today: 'اليوم',
    yesterday: 'أمس',
    dayMonth: '{day} {month}',
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    ctaTitle: 'سوّ رفّك',
    ctaText: 'عطورك وألعابك وأفلامك ومسلسلاتك ومانجاتك وكتبك، كلها على جوالك وبدون حساب.',
    updated: 'آخر تحديث {date}',
    introTitle: 'ذوقك كله على رفّ واحد',
    introText: 'عطورك وألعابك وأفلامك ومسلسلاتك ومانجاتك وكتبك، كلها في ملف واحد تشاركه بضغطة.',
    errorTitle: 'الرابط ناقص أو تالف',
    errorText: 'اطلب رابط الرفّ كامل مرة ثانية.',
    oldBrowserTitle: 'هذا المتصفح لا يدعم فتح الرابط',
    oldBrowserText: 'حدّث المتصفح أو افتح الرابط في متصفح أحدث.',
  },
  en: {
    appName: 'Raff',
    wordmark: 'رفّ',
    getApp: 'Get Raff',
    pageTitle: '{name} on Raff',
    noName: 'A Raff shelf',
    shelfTitle: { perfume: 'Perfumes', game: 'Games', movie: 'Movies', series: 'Series', comic: 'Comics & manga', book: 'Books' },
    shelfItem: { perfume: 'Perfume', game: 'Game', movie: 'Movie', series: 'Series', comic: 'Comic', book: 'Book' },
    status: {
      perfume: { have: 'Have', want: 'Want', had: 'Used to have' },
      game: { played: 'Played', playing: 'Playing', want: 'Want to play', dropped: 'Dropped' },
      movie: { watched: 'Watched', want: 'Want to watch' },
      series: { watching: 'Watching', finished: 'Finished', want: 'Want to watch', dropped: 'Dropped' },
      comic: { reading: 'Reading', read: 'Read', want: 'Want to read', dropped: 'Dropped' },
      book: { read: 'Read', reading: 'Reading', want: 'Want to read', dropped: 'Dropped' },
    },
    wears: 'wears',
    count: {
      perfume: { one: '1 perfume', two: '2 perfumes', few: '{n} perfumes', many: '{n} perfumes' },
      game: { one: '1 game', two: '2 games', few: '{n} games', many: '{n} games' },
      movie: { one: '1 movie', two: '2 movies', few: '{n} movies', many: '{n} movies' },
      series: { one: '1 series', two: '2 series', few: '{n} series', many: '{n} series' },
      comic: { one: '1 comic', two: '2 comics', few: '{n} comics', many: '{n} comics' },
      book: { one: '1 book', two: '2 books', few: '{n} books', many: '{n} books' },
    },
    monthLine: 'This month: {list}',
    listJoin: ', ',
    occasions: {
      work: 'Work',
      occasion: 'Occasion',
      friday: 'Friday',
      travel: 'Travel',
      outing: 'Out',
      home: 'Home',
      evening: 'Evening',
    },
    rewatch: 'Rewatch',
    lists: 'My lists',
    combos: 'My combos',
    liked: 'Liked',
    likedOne: 'Liked',
    buyTitle: 'Where to buy',
    buyHere: 'Buy it here',
    confirmTitle: 'Open an external website?',
    confirmNote: 'This link was added by the profile’s owner. Check the website before buying.',
    confirmOpen: 'Open the site',
    cancel: 'Cancel',
    stars: '{n} out of 5',
    today: 'Today',
    yesterday: 'Yesterday',
    dayMonth: '{month} {day}',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ctaTitle: 'Make your own shelf',
    ctaText: 'Your perfumes, games, movies, series, comics and books, all on your phone. No account needed.',
    updated: 'Updated {date}',
    introTitle: 'Your whole taste on one shelf',
    introText: 'Your perfumes, games, movies, series, comics and books, in one profile you share in a tap.',
    errorTitle: 'This link is incomplete or damaged',
    errorText: 'Ask the shelf’s owner to send it again, and copy the whole link.',
    oldBrowserTitle: 'This browser can’t open the link',
    oldBrowserText: 'Update your browser, or open the link in a newer one.',
  },
};

/** Each shelf's statuses, in display order (ShelfKind.statuses). */
export const STATUSES = {
  perfume: ['have', 'want', 'had'],
  game: ['played', 'playing', 'want', 'dropped'],
  movie: ['watched', 'want'],
  series: ['watching', 'finished', 'want', 'dropped'],
  comic: ['reading', 'read', 'want', 'dropped'],
  book: ['read', 'reading', 'want', 'dropped'],
};

/** The list tag of a perfume layering combo (kComboListTag). */
export const COMBO_TAG = 'combo';

/** The list tag of «أعجبني», what the owner liked (kLikedListTag). */
export const LIKED_TAG = 'liked';

/** Perfume families in the app's order (PerfumeFamily), with their colours. */
export const FAMILIES = ['oud', 'amber', 'floral', 'fresh', 'woody', 'gourmand', 'musk', 'aromatic', 'leather', 'spicy'];
export const FAMILY_COLORS = {
  oud: '#5B3A29',
  amber: '#C27A2C',
  floral: '#C2607A',
  fresh: '#4F9A94',
  woody: '#7A5C3E',
  gourmand: '#9C5B3B',
  musk: '#B8A9C9',
  aromatic: '#6E8B4E',
  leather: '#4A3428',
  spicy: '#A63D2F',
};
export const UNKNOWN_FAMILY = '#8C7B6B';
const GOLD = '#D3A65A';
/** The heart of «أعجبني» (the app's kHeartColor). */
const HEART_COLOR = '#E8546A';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** About how wide (CSS px) covers are drawn where they appear. */
const COVER_PX = { top: 90, tile: 66, small: 30 };

// ------------------------------------------------------------ pure helpers

export function pickLang(language) {
  return !language || String(language).toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (m, key) => (Object.hasOwn(values, key) ? String(values[key]) : m));
}

/** A catalog id made readable: `arabian-oud-kalemat` → `Arabian Oud Kalemat`. */
export function readableId(id) {
  const words = String(id)
    .split(/[-_.:\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.length ? words.join(' ') : String(id);
}

/** `yyyymmdd` → {y, m, day}, or null when it is not a real date. */
export function parseDay(d) {
  if (!Number.isInteger(d)) return null;
  const y = Math.floor(d / 10000);
  const m = Math.floor(d / 100) % 100;
  const day = d % 100;
  const date = new Date(Date.UTC(y, m - 1, day));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== day) return null;
  return { y, m, day };
}

/** A local date as `yyyymmdd`. */
export function dayKey(date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/**
 * A day in words, like the app's formatDay: «اليوم», «أمس», «29 أكتوبر»,
 * with the year when it is not this year. '' for a bad day.
 */
export function formatDay(L, d, today = new Date()) {
  const p = parseDay(d);
  if (!p) return '';
  if (d === dayKey(today)) return L.today;
  if (d === dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))) return L.yesterday;
  const label = fill(L.dayMonth, { day: p.day, month: L.months[p.m - 1] });
  return p.y === today.getFullYear() ? label : `${label} ${p.y}`;
}

/** A 0-10 half-star rating as {full, half, empty} of five stars. */
export function starParts(r) {
  const full = Math.floor(r / 2);
  const half = r % 2;
  return { full, half, empty: 5 - full - half };
}

export function familyColor(family) {
  const key = typeof family === 'string' ? family.toLowerCase() : '';
  return Object.hasOwn(FAMILY_COLORS, key) ? FAMILY_COLORS[key] : UNKNOWN_FAMILY;
}

/**
 * A perfume's art number in a link: its bottle shape (0-5) and family
 * (shape + 6 × (family index + 1)); an old link's number is a plain shape.
 */
export function perfumeArtOf(k) {
  const a = Number.isInteger(k) && k >= 0 ? k : 0;
  const f = Math.floor(a / 6) - 1;
  return { shape: a % 6, family: f >= 0 && f < FAMILIES.length ? FAMILIES[f] : null };
}

/**
 * The shelves of a snapshot, in its order, each as {code, kind, t, r, s}.
 * Shelves this page does not know are skipped. A link made before shelves
 * (perfumes only: top-level top four, recent wears and stats) reads as the
 * perfume shelf.
 */
export function snapshotShelves(snap) {
  if (!snap?.h?.length) {
    if (!snap?.t && !snap?.r && !snap?.s) return [];
    return [{ code: 'p', kind: 'perfume', t: snap.t ?? [], r: snap.r ?? [], s: snap.s ?? {} }];
  }
  return snap.h
    .filter((s) => Object.hasOwn(KIND_OF_CODE, s.k))
    .map((s) => ({ code: s.k, kind: KIND_OF_CODE[s.k], t: s.t ?? [], r: s.r ?? [], s: s.s ?? {} }));
}

/** The layering combos (an old link's lists were all combos). */
export function snapshotCombos(snap) {
  const lists = snap?.l ?? [];
  return snap?.h?.length ? lists.filter((l) => l.g === COMBO_TAG) : lists;
}

/** The lists across shelves (قوائمي): none in an old link; never the combos or «أعجبني». */
export function snapshotLists(snap) {
  return snap?.h?.length ? (snap.l ?? []).filter((l) => l.g !== COMBO_TAG && l.g !== LIKED_TAG) : [];
}

/**
 * «أعجبني» (snapshotLiked): the link's liked list, else the liked entries
 * ("l": 1) of its shelves, top fours first, once each, tagged with their
 * shelf. Empty for a link made before likes.
 */
export function snapshotLiked(snap) {
  const list = (snap?.l ?? []).find((l) => l.g === LIKED_TAG);
  if (list) return list.i;
  const seen = new Set();
  const out = [];
  for (const shelf of snapshotShelves(snap)) {
    for (const e of [...shelf.t, ...shelf.r]) {
      const tagged = { ...e, h: e.h ?? shelf.k };
      if (e.l === 1 && !seen.has(itemKey(tagged))) {
        seen.add(itemKey(tagged));
        out.push(tagged);
      }
    }
  }
  return out;
}

/** Identifies an item across the snapshot: its shelf and id, or its own text (SnapshotEntry.itemKey). */
export function itemKey(e) {
  return `${e.h !== undefined ? `${e.h}/` : ''}${e.i !== undefined ? `i:${e.i}` : `t:${e.t}|${e.s ?? ''}`}`;
}

/**
 * The entries with a buy link, one per item (its first appearance: the top
 * fours, recent items, each shelf's (tagged with its shelf), then the
 * lists'), links that hit the filter left out first: the app's
 * censorSnapshot + snapshotBuyLinks.
 */
export function buyLinkEntries(snap) {
  const all = [
    ...(snap?.t ?? []),
    ...(snap?.r ?? []),
    ...(snap?.h ?? []).flatMap((s) => [...(s.t ?? []), ...(s.r ?? [])].map((e) => (e.h === s.k ? e : { ...e, h: s.k }))),
    ...(snap?.l ?? []).flatMap((l) => l.i ?? []),
  ];
  const seen = new Set();
  const out = [];
  for (const e of all) {
    if (typeof e?.u !== 'string' || !parseBuyLink(e.u) || !buyLinkIsClean(e.u)) continue;
    const key = itemKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** «3 أفلام», «فيلمين», «لعبة»; "3 movies" in English (countLabel). */
export function countLabel(L, kind, n) {
  const forms = L.count[kind];
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  return fill(n <= 10 ? forms.few : forms.many, { n });
}

/** «هالشهر: 3 أفلام، لعبة، عطرين» from each shelf's `month`; '' when none. */
export function monthLine(L, shelves) {
  const parts = shelves.filter((s) => statOf(s.s, 'month') > 0).map((s) => countLabel(L, s.kind, s.s.month));
  return parts.length ? fill(L.monthLine, { list: parts.join(L.listJoin) }) : '';
}

function statOf(stats, key) {
  return stats && Object.hasOwn(stats, key) && Number.isInteger(stats[key]) ? stats[key] : 0;
}

/** "40 لعبتها · 2 ألعبها": a shelf's counts in status order (ShelfHeading), and a perfume shelf's wears. */
export function countsLine(L, kind, stats) {
  const parts = STATUSES[kind].filter((st) => statOf(stats, st) > 0).map((st) => `${stats[st]} ${L.status[kind][st]}`);
  if (kind === 'perfume' && statOf(stats, 'wears') > 0) parts.push(`${stats.wears} ${L.wears}`);
  return parts.join(' · ');
}

/** A recent item's tag in words: an occasion, a rewatch, a status; '' otherwise. */
export function tagLabel(L, kind, tag) {
  if (typeof tag !== 'string') return '';
  if (kind === 'perfume') return Object.hasOwn(L.occasions, tag) ? L.occasions[tag] : '';
  if (tag === 'rewatch') return L.rewatch;
  return STATUSES[kind]?.includes(tag) ? L.status[kind][tag] : '';
}

/**
 * How an entry shows (friendEntryView, without a catalog): its shelf (the
 * entry's own, else [kind], else perfume), filtered title and subtitle,
 * and its art: a bottle's shape and colour, or a cover's seed. A catalog
 * entry without a title shows a readable form of a perfume's id, or the
 * shelf's word for an item (never a raw Wikidata id).
 */
export function entryView(L, e, kind) {
  const k = (e.h !== undefined && Object.hasOwn(KIND_OF_CODE, e.h) ? KIND_OF_CODE[e.h] : null) ?? kind ?? 'perfume';
  const subtitle = e.s !== undefined && e.s !== '' ? censor(e.s) : null;
  if (k === 'perfume') {
    const art = perfumeArtOf(e.k);
    const title = censor(e.t !== undefined ? e.t : readableId(e.i));
    return { kind: k, title, subtitle, shape: art.shape, color: familyColor(art.family) };
  }
  const title = e.t !== undefined ? censor(e.t) : L.shelfItem[k];
  return { kind: k, title, subtitle, seed: e.i ?? title };
}

/** The link's attributes on the page: never the referrer, never followed. */
export const BUY_REL = 'noopener noreferrer nofollow ugc';

// ---------------------------------------------------------------- context

/** What a render needs: the language, its labels, direction and today. */
export function viewContext(lang = pickLang(globalThis.navigator?.language), today = new Date()) {
  const L = LABELS[lang] ?? LABELS.ar;
  const rtl = lang === 'ar';
  return { lang, L, rtl, today, numbers: new Intl.NumberFormat(rtl ? 'ar-u-nu-latn' : 'en') };
}

// ------------------------------------------------------------ DOM helpers

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/** An element for user text: its own direction, page alignment. */
function userText(tag, className, text) {
  const node = el(tag, `${className} u`, text);
  node.dir = 'auto';
  return node;
}

function svgNode(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function add(parent, tag, attrs) {
  const node = svgNode(tag, attrs);
  parent.append(node);
  return node;
}

function appButton(ctx, className = 'button') {
  const a = el('a', className, ctx.L.getApp);
  a.href = APP_STORE_URL;
  a.rel = 'noopener noreferrer';
  return a;
}

/** A link to someone else's site: a new tab, never the referrer, never followed. */
function externalLink(a, url) {
  a.href = url;
  a.target = '_blank';
  a.rel = BUY_REL;
  a.referrerPolicy = 'no-referrer';
  return a;
}

// ---------------------------------------------------------------- bottles

// Our own generic bottle silhouettes (no brands), drawn in a 60×100 box:
// glass filled with the family colour, a highlight, a shade, a gold cap.
const OUTLINE = { stroke: '#F5EBDD', 'stroke-opacity': 0.24, 'stroke-width': 1 };
const HIGHLIGHT = { fill: '#FFFFFF', 'fill-opacity': 0.3 };
const SHADE = { fill: '#000000', 'fill-opacity': 0.2 };
const SHINE = { fill: '#FFFFFF', 'fill-opacity': 0.42 };
const LABEL = { fill: '#F5EBDD', 'fill-opacity': 0.13 };
const SHADOW = { fill: '#000000', 'fill-opacity': 0.42 };

const glass = (color) => ({ class: 'liquid', fill: color, ...OUTLINE });

const SHAPES = [
  // 0 classic: rectangular body, square cap
  (s, gold, color) => {
    add(s, 'ellipse', { cx: 30, cy: 97, rx: 23, ry: 2.6, ...SHADOW });
    add(s, 'rect', { x: 8, y: 31, width: 44, height: 65, rx: 5, ...glass(color) });
    add(s, 'rect', { x: 42, y: 35, width: 6, height: 57, rx: 3, ...SHADE });
    add(s, 'rect', { x: 13, y: 36, width: 5, height: 55, rx: 2.5, ...HIGHLIGHT });
    add(s, 'rect', { x: 21, y: 55, width: 18, height: 20, rx: 1.5, ...LABEL });
    add(s, 'rect', { x: 24, y: 25, width: 12, height: 7, rx: 1, fill: gold });
    add(s, 'rect', { x: 20, y: 7, width: 20, height: 19, rx: 2, fill: gold });
    add(s, 'rect', { x: 23, y: 9.5, width: 2.5, height: 14, rx: 1.25, ...SHINE });
  },
  // 1 flask: round body, short neck
  (s, gold, color) => {
    add(s, 'ellipse', { cx: 30, cy: 97, rx: 20, ry: 2.6, ...SHADOW });
    add(s, 'path', { d: 'M25 30H35V40.45A28 28 0 1 1 25 40.45Z', ...glass(color) });
    add(s, 'ellipse', { cx: 42, cy: 75, rx: 6, ry: 13, transform: 'rotate(22 42 75)', ...SHADE });
    add(s, 'ellipse', { cx: 19, cy: 60, rx: 4.5, ry: 11, transform: 'rotate(22 19 60)', ...HIGHLIGHT });
    add(s, 'rect', { x: 22, y: 25, width: 16, height: 6, rx: 2, fill: gold });
    add(s, 'rect', { x: 24, y: 11, width: 12, height: 15, rx: 2, fill: gold });
    add(s, 'rect', { x: 26.5, y: 13, width: 2, height: 11, rx: 1, ...SHINE });
  },
  // 2 tall slim
  (s, gold, color) => {
    add(s, 'ellipse', { cx: 30, cy: 97, rx: 15, ry: 2.4, ...SHADOW });
    add(s, 'rect', { x: 17, y: 27, width: 26, height: 69, rx: 4, ...glass(color) });
    add(s, 'rect', { x: 35, y: 31, width: 4.5, height: 61, rx: 2.25, ...SHADE });
    add(s, 'rect', { x: 21, y: 31, width: 4, height: 60, rx: 2, ...HIGHLIGHT });
    add(s, 'rect', { x: 23, y: 22, width: 14, height: 6, rx: 1, fill: gold });
    add(s, 'rect', { x: 21, y: 2, width: 18, height: 21, rx: 3, fill: gold });
    add(s, 'rect', { x: 23.5, y: 4.5, width: 2, height: 16, rx: 1, ...SHINE });
  },
  // 3 oud: a tall Arabian bottle, gold band, dome cap and finial
  (s, gold, color) => {
    add(s, 'ellipse', { cx: 30, cy: 97, rx: 20, ry: 2.6, ...SHADOW });
    add(s, 'path', { d: 'M12 64C12 52 22 47 24 41V35H36V41C38 47 48 52 48 64V93Q48 96 45 96H15Q12 96 12 93Z', ...glass(color) });
    add(s, 'rect', { x: 41, y: 60, width: 4, height: 32, rx: 2, ...SHADE });
    add(s, 'rect', { x: 16, y: 58, width: 4, height: 33, rx: 2, ...HIGHLIGHT });
    add(s, 'rect', { x: 12, y: 74, width: 36, height: 3, fill: gold, 'fill-opacity': 0.9 });
    add(s, 'rect', { x: 20, y: 32, width: 20, height: 4, rx: 1.5, fill: gold });
    add(s, 'path', { d: 'M21.5 33Q21.5 17 30 17Q38.5 17 38.5 33Z', fill: gold });
    add(s, 'rect', { x: 29, y: 6, width: 2, height: 12, fill: gold });
    add(s, 'circle', { cx: 30, cy: 5.5, r: 2.8, fill: gold });
    add(s, 'circle', { cx: 30, cy: 13.5, r: 1.8, fill: gold });
    add(s, 'path', { d: 'M25 30Q25 21.5 28.5 19.8', fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.45, 'stroke-width': 1.3, 'stroke-linecap': 'round' });
  },
  // 4 apothecary: squat, round stopper
  (s, gold, color) => {
    add(s, 'ellipse', { cx: 30, cy: 97, rx: 26, ry: 2.6, ...SHADOW });
    add(s, 'path', { d: 'M22 43H38V50H46Q55 50 55 59V88Q55 96 47 96H13Q5 96 5 88V59Q5 50 14 50H22Z', ...glass(color) });
    add(s, 'rect', { x: 46, y: 57, width: 4.5, height: 32, rx: 2.25, ...SHADE });
    add(s, 'rect', { x: 10, y: 56, width: 4.5, height: 33, rx: 2.25, ...HIGHLIGHT });
    add(s, 'rect', { x: 18, y: 63, width: 24, height: 17, rx: 2, ...LABEL });
    add(s, 'rect', { x: 19, y: 39, width: 22, height: 5.5, rx: 2.75, fill: gold });
    add(s, 'circle', { cx: 30, cy: 27, r: 12.5, fill: gold });
    add(s, 'circle', { cx: 25.5, cy: 22.5, r: 3.2, ...SHINE });
  },
  // 5 faceted gem
  (s, gold, color) => {
    add(s, 'ellipse', { cx: 30, cy: 97, rx: 22, ry: 2.6, ...SHADOW });
    add(s, 'path', { d: 'M30 36L52 50V82L30 96L8 82V50Z', ...glass(color) });
    add(s, 'path', { d: 'M8 50L18 55V77L8 82Z', ...HIGHLIGHT });
    add(s, 'path', { d: 'M52 50L42 55V77L52 82Z', ...SHADE });
    add(s, 'path', { d: 'M30 36L42 55H18Z', fill: '#FFFFFF', 'fill-opacity': 0.14 });
    add(s, 'path', { d: 'M18 77H42L30 96Z', fill: '#000000', 'fill-opacity': 0.12 });
    add(s, 'path', { d: 'M18 55H42V77H18Z', fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.16, 'stroke-width': 0.8 });
    add(s, 'rect', { x: 25, y: 29, width: 10, height: 8, rx: 1, fill: gold });
    add(s, 'path', { d: 'M30 7L40 17L37 30H23L20 17Z', fill: gold });
    add(s, 'path', { d: 'M30 7L33 17L30 30L27 17Z', fill: '#FFFFFF', 'fill-opacity': 0.3 });
  },
];

let svgIds = 0;

function bottle(shape, color) {
  const svg = svgNode('svg', { viewBox: '0 0 60 100', class: 'bottle', 'aria-hidden': 'true', focusable: 'false' });
  const id = `raff-gold-${++svgIds}`;
  const defs = add(svg, 'defs', {});
  const grad = add(defs, 'linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 0 });
  add(grad, 'stop', { offset: 0, 'stop-color': '#F4E2AE' });
  add(grad, 'stop', { offset: 0.45, 'stop-color': GOLD });
  add(grad, 'stop', { offset: 1, 'stop-color': '#9C7737' });
  const k = Number.isInteger(shape) && shape >= 0 && shape < SHAPES.length ? shape : 0;
  SHAPES[k](svg, `url(#${id})`, color);
  return svg;
}

/** An entry's art: its bottle, or its cover drawn about [px] wide (a book's with its author). */
function art(view, px) {
  if (view.kind === 'perfume') return bottle(view.shape, view.color);
  return coverElement(view.kind, view.title, view.seed, px, view.kind === 'book' ? view.subtitle ?? '' : '');
}

const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.1 1.8-1.9 3.3-3.1 5.4-3.1 3.6 0 5.7 3.8 4.2 7.3C19.5 16.4 12 21 12 21z';

/** [node] with the small heart of a liked entry ("l": 1), else as it is. */
function hearted(ctx, node, e) {
  if (e.l !== 1) return node;
  const wrap = el('span', 'liked');
  const badge = el('span', 'heart');
  badge.setAttribute('role', 'img');
  badge.setAttribute('aria-label', ctx.L.likedOne);
  const svg = svgNode('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
  add(svg, 'path', { d: HEART, fill: HEART_COLOR });
  badge.append(svg);
  wrap.append(node, badge);
  return wrap;
}

// ------------------------------------------------------------------ stars

const STAR = 'M12 2l2.94 6.45 7.06.82-5.24 4.87 1.42 6.88L12 17.6l-6.18 3.42 1.42-6.88L2 9.27l7.06-.82z';
const STAR_LEFT = 'M12 2L9.06 8.45 2 9.27l5.24 4.87-1.42 6.88L12 17.6z';
const STAR_RIGHT = 'M12 2l2.94 6.45 7.06.82-5.24 4.87 1.42 6.88L12 17.6z';

/** Five stars for a 1-10 rating; null for none (0 reads as "not rated"). */
function stars(ctx, r) {
  if (!Number.isInteger(r) || r <= 0) return null;
  const { full, half } = starParts(r);
  const wrap = el('span', 'stars');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', fill(ctx.L.stars, { n: ctx.numbers.format(r / 2) }));
  for (let i = 0; i < 5; i++) {
    const svg = svgNode('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    if (i < full) {
      add(svg, 'path', { d: STAR, fill: GOLD });
    } else {
      add(svg, 'path', { d: STAR, fill: 'none', stroke: GOLD, 'stroke-opacity': 0.45, 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
      // The filled half faces the filled stars: the right half in Arabic.
      if (i === full && half) add(svg, 'path', { d: ctx.rtl ? STAR_RIGHT : STAR_LEFT, fill: GOLD });
    }
    wrap.append(svg);
  }
  return wrap;
}

// ------------------------------------------------------------------ views

function topBar(ctx, withButton) {
  const bar = el('header', 'bar');
  const mark = el('span', 'wordmark', ctx.L.wordmark);
  mark.lang = 'ar';
  bar.append(mark);
  if (withButton) bar.append(appButton(ctx, 'bar-get'));
  return bar;
}

function section(title, className) {
  const sec = el('section', `section ${className}`);
  sec.append(el('h2', 'section-h', title));
  return sec;
}

/** Items standing on a shelf: in an arched niche (perfumes), or on a plain rack. */
function standing(items, className) {
  const box = el('div', className);
  const row = el('div', 'stand-row');
  row.style.setProperty('--n', String(Math.max(items.length, 1)));
  items.forEach((b, i) => {
    b.style.setProperty('--i', String(i));
    row.append(b);
  });
  box.append(row);
  return [box, el('div', 'sill')];
}

function avatar(snap) {
  const a = el('div', 'avatar');
  a.setAttribute('aria-hidden', 'true');
  if (snap.c) a.style.backgroundColor = `#${snap.c}`;
  const emoji = censor(snap.e ?? '');
  if (emoji) {
    a.append(el('span', null, emoji));
  } else {
    const first = [...censor(snap.n ?? '')][0];
    if (first) a.append(el('span', 'initial', first));
  }
  return a;
}

/** A shelf's heading: its glyph and title, and its counts. */
function shelfHeading(ctx, shelf) {
  const head = el('div', 'shelf-head');
  const h = el('h2', 'shelf-h');
  h.append(glyphIcon(shelf.kind), el('span', 'shelf-title', ctx.L.shelfTitle[shelf.kind]));
  head.append(h);
  const line = countsLine(ctx.L, shelf.kind, shelf.s);
  if (line) head.append(el('p', 'shelf-counts', line));
  return head;
}

/** A shelf's top four: on the shelf, with captions (title, subtitle, stars). */
function topFour(ctx, shelf) {
  const views = shelf.t.map((e) => entryView(ctx.L, e, shelf.kind));
  const arts = views.map((v, i) => hearted(ctx, art(v, COVER_PX.top), shelf.t[i]));
  const perfume = shelf.kind === 'perfume';
  const [box, sill] = standing(arts, perfume ? 'niche arrive' : 'rack arrive');
  const caps = el('ul', 'captions');
  caps.style.setProperty('--n', String(views.length));
  views.forEach((v, i) => {
    const cap = el('li', 'cap');
    cap.append(userText('p', 'cap-name', v.title));
    if (v.subtitle) cap.append(userText('p', 'cap-brand', v.subtitle));
    // A hadith collection or a tafsir shows no stars, whatever the link says.
    const st = shelf.kind === 'book' && NO_RATING_BOOKS.has(shelf.t[i].i) ? null : stars(ctx, shelf.t[i].r);
    if (st) cap.append(st);
    caps.append(cap);
  });
  return [box, sill, caps];
}

/** A shelf's recent items, newest first, in a strip that scrolls sideways. */
function recentStrip(ctx, shelf) {
  const ul = el('ul', 'strip');
  for (const e of shelf.r) {
    const v = entryView(ctx.L, e, shelf.kind);
    const li = el('li', `tile tile-${v.kind}`);
    const box = el('div', 'tile-art');
    box.append(hearted(ctx, art(v, COVER_PX.tile), e));
    li.append(box, userText('p', 'tile-name', v.title));
    const meta = [e.d !== undefined ? formatDay(ctx.L, e.d, ctx.today) : '', tagLabel(ctx.L, shelf.kind, e.g)].filter(Boolean).join(' · ');
    if (meta) li.append(el('p', 'tile-meta', meta));
    ul.append(li);
  }
  return ul;
}

function shelfSection(ctx, shelf) {
  const sec = el('section', `section shelf shelf-${shelf.kind}`);
  sec.style.setProperty('--accent', SHELF_STYLES[shelf.kind].accent);
  sec.append(shelfHeading(ctx, shelf));
  if (shelf.t.length) sec.append(...topFour(ctx, shelf));
  if (shelf.r.length) sec.append(recentStrip(ctx, shelf));
  return sec;
}

/** «أعجبني»: what the owner liked, across shelves, in a strip. */
function likedSection(ctx, entries) {
  const sec = section(ctx.L.liked, 'liked-section');
  const ul = el('ul', 'strip');
  for (const e of entries) {
    const v = entryView(ctx.L, e, null);
    const li = el('li', `tile tile-${v.kind}`);
    const box = el('div', 'tile-art');
    box.append(hearted(ctx, art(v, COVER_PX.tile), { ...e, l: 1 }));
    li.append(box, userText('p', 'tile-name', v.title));
    ul.append(li);
  }
  sec.append(ul);
  return sec;
}

/** Lists (قوائمي) or combos (خلطاتي): a name, the first three arts, every title. */
function listsSection(ctx, title, lists, kind, className) {
  const sec = section(title, className);
  const ul = el('ul', 'list-cards');
  for (const list of lists) {
    const li = el('li', 'list-card');
    li.append(userText('h3', 'list-name', censor(list.n)));
    const views = list.i.map((e) => entryView(ctx.L, e, kind));
    if (views.length) {
      const body = el('div', 'list-body');
      const arts = el('div', 'list-arts');
      for (const v of views.slice(0, 3)) arts.append(art(v, COVER_PX.small));
      const parts = el('p', 'list-parts u');
      views.forEach((v, i) => {
        if (i) parts.append(el('span', 'list-plus', '+'));
        parts.append(el('bdi', 'list-part', v.title));
      });
      body.append(arts, parts);
      li.append(body);
    }
    ul.append(li);
  }
  sec.append(ul);
  return sec;
}

/** The sheet a buy link opens from: the domain, the whole link, a word of caution. */
function confirmSheet(ctx, link) {
  const dialog = el('dialog', 'confirm');
  dialog.setAttribute('aria-label', ctx.L.confirmTitle);
  const box = el('div', 'confirm-box');
  const domain = el('p', 'confirm-domain', link.domain);
  domain.dir = 'ltr';
  const url = el('p', 'confirm-url', link.url);
  url.dir = 'ltr';
  box.append(domain, url);
  const open = externalLink(el('a', 'button confirm-open', ctx.L.confirmOpen), link.url);
  open.addEventListener('click', () => dialog.close());
  const cancel = el('button', 'confirm-cancel', ctx.L.cancel);
  cancel.type = 'button';
  cancel.addEventListener('click', () => dialog.close());
  dialog.append(el('h2', 'confirm-h', ctx.L.confirmTitle), box, el('p', 'confirm-note', ctx.L.confirmNote), open, cancel);
  // A tap outside the sheet closes it; a closed sheet goes away.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  return dialog;
}

function buyButton(ctx, url, host) {
  const link = parseBuyLink(url);
  if (!link) return null;
  const a = externalLink(el('a', 'buy'), link.url);
  const domain = el('span', 'buy-d', link.domain);
  domain.dir = 'ltr';
  a.append(el('span', 'buy-l', ctx.L.buyHere), domain);
  // Where the browser has <dialog>, the link opens from the sheet; elsewhere
  // it opens as is (the button already shows the whole domain).
  a.addEventListener('click', (event) => {
    const sheet = confirmSheet(ctx, link);
    if (typeof sheet.showModal !== 'function') return;
    event.preventDefault();
    host.append(sheet);
    sheet.showModal();
  });
  return a;
}

function buyLinks(ctx, entries) {
  const sec = section(ctx.L.buyTitle, 'buy-links');
  const ul = el('ul', 'buy-list');
  for (const entry of entries) {
    const button = buyButton(ctx, entry.u, sec);
    if (!button) continue;
    const v = entryView(ctx.L, entry, 'perfume');
    const li = el('li', `buy-row buy-${v.kind}`);
    const box = el('div', 'buy-art');
    box.append(art(v, COVER_PX.small));
    const text = el('div', 'buy-text');
    text.append(userText('p', 'buy-name', v.title));
    if (v.subtitle) text.append(userText('p', 'buy-brand', v.subtitle));
    li.append(box, text, button);
    ul.append(li);
  }
  sec.append(ul);
  return sec;
}

function callToAction(ctx, day) {
  const cta = el('section', 'cta');
  cta.append(el('h2', 'cta-h', ctx.L.ctaTitle), el('p', 'cta-p', ctx.L.ctaText), appButton(ctx));
  const p = parseDay(day);
  if (p) {
    const date = `${fill(ctx.L.dayMonth, { day: p.day, month: ctx.L.months[p.m - 1] })} ${p.y}`;
    cta.append(el('p', 'meta', fill(ctx.L.updated, { date })));
  }
  return cta;
}

/**
 * The profile of a decoded snapshot: header, the month across shelves,
 * every shelf in its order (liked items carry a heart), «أعجبني», lists,
 * combos, buy links, the app's button. Covers are drawn here, never loaded
 * (the page asks no other site for anything, real covers included).
 */
export function profileView(snap, ctx = viewContext()) {
  const { L } = ctx;
  const nodes = [topBar(ctx, true)];
  const who = el('section', 'who');
  const name = censor(snap.n ?? '');
  who.append(avatar(snap), userText('h1', 'name', name || L.noName));
  if (snap.b) who.append(userText('p', 'bio', censor(snap.b)));
  nodes.push(who);
  const shelves = snapshotShelves(snap);
  const month = monthLine(L, shelves);
  if (month) nodes.push(el('p', 'month', month));
  for (const shelf of shelves) nodes.push(shelfSection(ctx, shelf));
  const liked = snapshotLiked(snap);
  if (liked.length) nodes.push(likedSection(ctx, liked));
  const lists = snapshotLists(snap);
  if (lists.length) nodes.push(listsSection(ctx, L.lists, lists, null, 'lists'));
  const combos = snapshotCombos(snap);
  if (combos.length) nodes.push(listsSection(ctx, L.combos, combos, 'perfume', 'combos'));
  const links = buyLinkEntries(snap);
  if (links.length) nodes.push(buyLinks(ctx, links));
  nodes.push(callToAction(ctx, snap.d));
  return { nodes, title: name ? fill(L.pageTitle, { name }) : L.appName };
}

export function introView(ctx = viewContext()) {
  const { L } = ctx;
  const lead = el('section', 'lead');
  const items = [
    bottle(3, FAMILY_COLORS.oud),
    coverElement('game', L.shelfTitle.game, 'intro-game', COVER_PX.tile),
    bottle(1, FAMILY_COLORS.floral),
    coverElement('movie', L.shelfTitle.movie, 'intro-movie', COVER_PX.tile),
    coverElement('series', L.shelfTitle.series, 'intro-series', COVER_PX.tile),
    coverElement('comic', L.shelfItem.comic, 'intro-comic', COVER_PX.tile),
    coverElement('book', L.shelfTitle.book, 'intro-book', COVER_PX.tile),
  ];
  lead.append(...standing(items, 'niche niche-intro arrive'), el('h1', 'lead-h', L.introTitle), el('p', 'lead-p', L.introText), appButton(ctx));
  return { nodes: [topBar(ctx, false), lead], title: L.appName };
}

export function errorView(ctx = viewContext(), title = ctx.L.errorTitle, text = ctx.L.errorText) {
  const lead = el('section', 'lead');
  lead.append(...standing([], 'niche niche-empty'), el('h1', 'lead-h', title), el('p', 'lead-p', text), appButton(ctx));
  return { nodes: [topBar(ctx, false), lead], title: ctx.L.appName };
}

/** The view for a link's payload: the profile, or the damaged-link page. */
export async function viewForPayload(payload, ctx = viewContext()) {
  let snap;
  try {
    snap = await decodePayload(payload);
  } catch {
    return errorView(ctx);
  }
  return profileView(snap, ctx);
}

// ------------------------------------------------------------------ page

/** Raw deflate in the browser (Safari 16.4+, Chrome 103+, Firefox 113+). */
function canInflate() {
  try {
    new DecompressionStream('deflate-raw');
    return true;
  } catch {
    return false;
  }
}

let generation = 0;

function show({ nodes, title }) {
  document.getElementById('app').replaceChildren(...nodes);
  document.title = title;
}

async function route(ctx, fromHashChange) {
  const gen = ++generation;
  if (fromHashChange) window.scrollTo(0, 0);
  const payload = payloadFromHash(location.hash);
  if (!payload) {
    show(introView(ctx));
    return;
  }
  if (!canInflate()) {
    show(errorView(ctx, ctx.L.oldBrowserTitle, ctx.L.oldBrowserText));
    return;
  }
  const view = await viewForPayload(payload, ctx);
  if (gen === generation) show(view);
}

function boot() {
  const ctx = viewContext();
  document.documentElement.lang = ctx.lang;
  document.documentElement.dir = ctx.rtl ? 'rtl' : 'ltr';
  window.addEventListener('hashchange', () => route(viewContext(ctx.lang), true));
  route(ctx, false);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') boot();
