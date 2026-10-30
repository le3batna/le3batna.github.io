// أبيات profile viewer. It decodes the snapshot in the link's fragment
// (web/shared/snapshot.js) and draws the profile. The fragment never leaves
// the browser.
//
// Attribution is the rule this page is built around: a verse is never shown
// under the wrong poet. The link carries only ids (v:<poemId>:<index>,
// q:<poemId>, p:<poetId>), never verse text or poet names. Every verse is
// read from the poet's own data file, ../data/<poetId>.json (same origin,
// written at deploy time by apps/abyat/tool/build_library.dart --web-out),
// and shown with the poet named in that same file. When the file is
// missing, the poem or verse is not in it, or the file belongs to another
// poet, the entry is left out: there is no fallback name.
//
// Requests: only those data files, one per poet at most, all in parallel,
// and only for ids that pass the poet-id check. The profile shell renders
// before any of them arrive.
//
// Safety: decoded text and file text reach the page through textContent
// and createElement only, never as markup. The name, bio and list names
// pass through the profanity filter. Verse text comes only from the files.

import { decodePayload, payloadFromHash } from '../../shared/snapshot.js';
import { censor } from '../../shared/filter.js';

// TODO: replace with أبيات's real App Store link once its App Store record exists.
export const APP_STORE_URL = 'https://apps.apple.com/app/id6828913971';

export const APP_ID = 'abyat';

// Poet files, relative to /abyat/p/: /abyat/data/<poetId>.json.
export const DATA_BASE = '../data/';

// All text the page shows. Arabic is the default; English is used when the
// browser's language is not Arabic. {name}, {n}, {date} are filled in.
export const LABELS = {
  ar: {
    appName: 'أبيات',
    wordmark: 'أبيات',
    getApp: 'حمّل أبيات',
    pageTitle: 'أبيات {name}',
    noName: 'قارئ أبيات',
    updated: 'آخر تحديث {date}',
    top: 'أبياتي الأربعة',
    poets: 'شعرائي',
    lists: 'قوائمي',
    diary: 'آخر ما قرأت',
    stats: {
      saved: 'أبيات محفوظة',
      read: 'قراءات',
      lists: 'قوائم',
      best: 'أعلى نتيجة في المساجلة',
      chain: 'أطول سلسلة',
    },
    tags: {
      saved: 'محفوظ',
      poem: 'قصيدة كاملة',
    },
    showAll: 'عرض الكل ({n})',
    sourceHint: 'القصيدة في ويكي مصدر',
    loading: 'يُحمَّل…',
    ctaTitle: 'اقرأ وساجل واحفظ أبياتك — بدون حساب.',
    credits: 'نصوص الأبيات من ويكي مصدر العربية (CC BY-SA 4.0)، والقصائد من التراث العام.',
    introTitle: 'الشعر العربي، بيتًا بيتًا',
    introText: 'اقرأ دواوين كبار الشعراء، وتحدَّ غيرك في المساجلة، واحفظ أبياتك وشاركها برابط.',
    errorTitle: 'الرابط ناقص أو تالف',
    errorText: 'اطلب الرابط كامل مرة ثانية.',
    oldBrowserTitle: 'هذا المتصفح لا يدعم فتح الرابط',
    oldBrowserText: 'حدّث المتصفح أو افتح الرابط في متصفح أحدث.',
  },
  en: {
    appName: 'Abyat',
    wordmark: 'أبيات',
    getApp: 'Get Abyat',
    pageTitle: '{name} on Abyat',
    noName: 'An Abyat reader',
    updated: 'Updated {date}',
    top: 'My four verses',
    poets: 'My poets',
    lists: 'Lists',
    diary: 'Recently read',
    stats: {
      saved: 'Saved verses',
      read: 'Readings',
      lists: 'Lists',
      best: 'Duel best',
      chain: 'Best chain',
    },
    tags: {
      saved: 'Saved',
      poem: 'Whole poem',
    },
    showAll: 'Show all ({n})',
    sourceHint: 'The poem on Arabic Wikisource',
    loading: 'Loading…',
    ctaTitle: 'Read, duel and keep your verses — no account needed.',
    credits: 'Verse texts from Arabic Wikisource (CC BY-SA 4.0); the poems are in the public domain.',
    introTitle: 'Arabic poetry, verse by verse',
    introText: 'Read the great poets, take on others in a verse duel, and keep the lines you love. Share them with a link.',
    errorTitle: 'This link is incomplete or damaged',
    errorText: 'Ask for the link again, and copy all of it.',
    oldBrowserTitle: 'This browser can’t open the link',
    oldBrowserText: 'Update your browser, or open the link in a newer one.',
  },
};

export const STAT_KEYS = ['saved', 'read', 'lists', 'best', 'chain'];

const TOP_MAX = 4;
const POETS_MAX = 4;
const DIARY_SHOWN = 8;
// At most this many poet files for one profile (the library has 32 poets).
export const MAX_POET_FILES = 40;
// A verse for the page without a profile, read from the data like any other.
const INTRO_VERSE = { i: 'v:mutanabbi-0258:22' };

// ------------------------------------------------------------ entry ids

const POET_ID = /^[a-z0-9-]{1,40}$/;
const POET_REF = /^p:([a-z0-9-]{1,40})$/;
const POEM_REF = /^q:(([a-z0-9-]{1,40})-\d{4})$/;
// The app's VerseRef key (`<poemId>:<index>`) after the `v:` prefix.
const VERSE_REF = /^v:(([a-z0-9-]{1,40})-\d{4}):(\d{1,4})$/;

/** Whether [id] may name a poet file (checked before any URL is built). */
export function isPoetId(id) {
  return typeof id === 'string' && POET_ID.test(id);
}

/**
 * An entry id read into its parts, or null when it is not one Abyat makes:
 * `v:<poemId>:<index>` → {kind: 'verse', poetId, poemId, index},
 * `q:<poemId>` → {kind: 'poem', poetId, poemId},
 * `p:<poetId>` → {kind: 'poet', poetId}.
 * A poem id is `<poetId>-NNNN`; its poet is the id without the final `-NNNN`.
 */
export function parseEntryId(id) {
  if (typeof id !== 'string' || id.length > 80) return null;
  let m = VERSE_REF.exec(id);
  if (m) return { kind: 'verse', poetId: m[2], poemId: m[1], index: Number(m[3]) };
  m = POEM_REF.exec(id);
  if (m) return { kind: 'poem', poetId: m[2], poemId: m[1] };
  m = POET_REF.exec(id);
  if (m) return { kind: 'poet', poetId: m[1] };
  return null;
}

/** The poet id an entry id belongs to, or null for an id Abyat does not make. */
export function poetIdOf(id) {
  return parseEntryId(id)?.poetId ?? null;
}

// ------------------------------------------------------- resolving entries

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v) {
  return typeof v === 'string' && v.trim() ? v : null;
}

const WIKISOURCE = /^https:\/\/ar\.wikisource\.org\/wiki\/[^\s"'<>\\]+$/;

/** [src] when it is an Arabic Wikisource page link, else null. */
export function wikisourceUrl(src) {
  return typeof src === 'string' && src.length <= 2000 && WIKISOURCE.test(src) ? src : null;
}

function fileFor(poetFiles, poetId) {
  if (poetFiles instanceof Map) return poetFiles.get(poetId) ?? null;
  if (isObject(poetFiles) && Object.hasOwn(poetFiles, poetId)) return poetFiles[poetId];
  return null;
}

/** The poet record of [file] if, and only if, the file is [poetId]'s own. */
function poetOf(file, poetId) {
  if (!isObject(file) || !isObject(file.poet) || file.poet.id !== poetId) return null;
  const short = text(file.poet.short) ?? text(file.poet.name);
  if (!short) return null;
  return { id: poetId, short, name: text(file.poet.name) ?? short, en: text(file.poet.en) };
}

function poetName(poet, lang) {
  return lang === 'ar' ? poet.short : (poet.en ?? poet.short);
}

/**
 * A verse or poem entry resolved against the loaded poet files ([poetFiles]:
 * a Map or object of poetId → parsed file; a missing or failed file is
 * absent or null). Returns {kind, poetId, poemId, index, poet, title, sadr,
 * ajuz, src} only when the file for the id's poet is that poet's own file
 * (`poet.id` matches) and holds the poem and the verse; otherwise null.
 * For a whole poem (`q:`) the verse is its first (the مطلع). `poet` is the
 * file's short Arabic name, or its English name when [lang] is not 'ar'.
 */
export function resolveEntry(entry, poetFiles, lang = 'ar') {
  const ref = parseEntryId(isObject(entry) ? entry.i : null);
  if (!ref || ref.kind === 'poet') return null;
  const file = fileFor(poetFiles, ref.poetId);
  const poet = poetOf(file, ref.poetId);
  if (!poet || !isObject(file.poems) || !Object.hasOwn(file.poems, ref.poemId)) return null;
  const poem = file.poems[ref.poemId];
  if (!isObject(poem) || !Array.isArray(poem.v)) return null;
  const index = ref.kind === 'verse' ? ref.index : 0;
  if (index >= poem.v.length) return null;
  const verse = poem.v[index];
  if (!Array.isArray(verse) || !text(verse[0]) || typeof verse[1] !== 'string') return null;
  return {
    kind: ref.kind,
    poetId: ref.poetId,
    poemId: ref.poemId,
    index,
    poet: poetName(poet, lang),
    title: text(poem.t),
    sadr: verse[0],
    ajuz: verse[1],
    src: wikisourceUrl(poem.src),
  };
}

/**
 * A poet entry (`p:<poetId>`) resolved the same way: {poetId, name, full}
 * from the poet's own file, or null.
 */
export function resolvePoet(entry, poetFiles, lang = 'ar') {
  const ref = parseEntryId(isObject(entry) ? entry.i : null);
  if (!ref || ref.kind !== 'poet') return null;
  const poet = poetOf(fileFor(poetFiles, ref.poetId), ref.poetId);
  if (!poet) return null;
  return { poetId: ref.poetId, name: poetName(poet, lang), full: lang === 'ar' ? poet.name : (poet.en ?? poet.name) };
}

// ------------------------------------------------------- snapshot → parts

const kindOf = (entry) => parseEntryId(entry?.i)?.kind ?? null;

/**
 * What the page shows, from a decoded snapshot: the top verses (`t`), the
 * top poets (the `g: "poet"` entries of `r`), the diary (the other verse and
 * poem entries of `r`, in order) and the lists. Entries without an id Abyat
 * makes (custom text included) are dropped here.
 */
export function profileParts(snap) {
  const recent = Array.isArray(snap?.r) ? snap.r : [];
  const top = (Array.isArray(snap?.t) ? snap.t : []).filter((e) => kindOf(e) === 'verse').slice(0, TOP_MAX);
  const poets = recent.filter((e) => e.g === 'poet' && kindOf(e) === 'poet').slice(0, POETS_MAX);
  const diary = recent.filter((e) => e.g !== 'poet' && (kindOf(e) === 'verse' || kindOf(e) === 'poem'));
  const lists = (Array.isArray(snap?.l) ? snap.l : []).map((l) => ({
    name: typeof l.n === 'string' ? l.n : '',
    items: (Array.isArray(l.i) ? l.i : []).filter((e) => kindOf(e) === 'verse' || kindOf(e) === 'poem'),
  }));
  return { top, poets, diary, lists };
}

/** The poet files [parts] needs, in page order, at most MAX_POET_FILES. */
export function collectPoetIds(parts) {
  const ids = new Set();
  const all = [...parts.top, ...parts.poets, ...parts.lists.flatMap((l) => l.items), ...parts.diary];
  for (const entry of all) {
    const id = poetIdOf(entry.i);
    if (id && !ids.has(id) && ids.size < MAX_POET_FILES) ids.add(id);
  }
  return ids;
}

// ------------------------------------------------------------- loading

async function fetchPoetFile(poetId) {
  // The id is checked here, right before the URL is built from it.
  if (!isPoetId(poetId)) return null;
  try {
    const res = await fetch(DATA_BASE + poetId + '.json', { mode: 'same-origin', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) return null;
    const json = await res.json();
    return isObject(json) ? json : null;
  } catch {
    return null;
  }
}

/**
 * A loader of poet files: each poet's file is requested once at most (the
 * promise is kept, failures included); a bad id requests nothing.
 */
export function poetLoader() {
  const cache = new Map();
  return (poetId) => {
    if (!isPoetId(poetId)) return Promise.resolve(null);
    if (!cache.has(poetId)) cache.set(poetId, fetchPoetFile(poetId));
    return cache.get(poetId);
  };
}

// ------------------------------------------------------------ pure helpers

export function pickLang(language) {
  return !language || String(language).toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (m, key) => (Object.hasOwn(values, key) ? String(values[key]) : m));
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

// ------------------------------------------------------------------ state

const lang = pickLang(globalThis.navigator?.language);
const L = LABELS[lang];
const rtl = lang === 'ar';
const dateLocale = rtl ? 'ar-u-ca-gregory-nu-latn' : 'en-GB';
const numbers = new Intl.NumberFormat(rtl ? 'ar-u-nu-latn' : 'en');
const loadPoet = poetLoader();
let generation = 0;

// ------------------------------------------------------------ DOM helpers

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined && content !== null) node.textContent = content;
  return node;
}

/** An element for user text: its own direction, the page's alignment. */
function userText(tag, className, content) {
  const node = el(tag, `${className} u`, content);
  node.dir = 'auto';
  return node;
}

/** An element for Arabic text from the data (verses, titles). */
function arabic(tag, className, content) {
  const node = el(tag, className, content);
  node.lang = 'ar';
  node.dir = 'rtl';
  return node;
}

function appButton(className = 'button') {
  const a = el('a', className, L.getApp);
  a.href = APP_STORE_URL;
  a.rel = 'noopener noreferrer';
  return a;
}

function formatDay(d, options) {
  const p = parseDay(d);
  if (!p) return null;
  return new Intl.DateTimeFormat(dateLocale, { ...options, timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(p.y, p.m - 1, p.day)));
}

/** Grey bars standing in for text until a poet file arrives. */
function skeleton(className, lines) {
  const box = el('div', `sk ${className}`);
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < lines; i++) box.append(el('span', 'sk-line'));
  return box;
}

// ---------------------------------------------------- filling from files

/**
 * One render's bookkeeping: the poet ids it may load and, per poet, what to
 * do once that poet's file has settled.
 */
function context(ids) {
  return { ids, files: new Map(), slots: new Map() };
}

/** A set of slots; [done] runs once every slot in it has settled. */
function group(done) {
  return { pending: 0, done };
}

/**
 * Shows [entry] once its poet's file has settled: [settle] gets the loaded
 * files. False when the entry's poet is not loadable (nothing to show).
 */
function bind(ctx, grp, entry, settle) {
  const poetId = poetIdOf(entry?.i);
  if (!poetId || !ctx.ids.has(poetId)) return false;
  grp.pending++;
  if (!ctx.slots.has(poetId)) ctx.slots.set(poetId, []);
  ctx.slots.get(poetId).push((files) => {
    settle(files);
    if (--grp.pending === 0 && grp.done) grp.done();
  });
  return true;
}

/** Starts every poet file at once; fills each poet's slots as it arrives. */
function startLoading(ctx, gen) {
  for (const poetId of ctx.ids) {
    loadPoet(poetId).then((file) => {
      if (gen !== generation) return;
      ctx.files.set(poetId, file);
      for (const settle of ctx.slots.get(poetId) ?? []) settle(ctx.files);
    });
  }
}

// ---------------------------------------------------------- verse pieces

/** The two hemistichs: صدر then عجز (side by side on wide screens). */
function verseBlock(v, className) {
  const block = arabic('div', `verse ${className}`);
  block.append(el('p', 'sadr', v.sadr));
  if (v.ajuz) block.append(el('p', 'ajuz', v.ajuz));
  return block;
}

/** The poet's name (always) and the poem's title (small), from the file. */
function byLine(v, withPoet = true) {
  const by = el('p', 'by');
  if (withPoet) {
    const poet = el('span', 'poet', v.poet);
    poet.lang = lang;
    by.append(poet);
  }
  if (v.title) {
    const title = arabic(v.src ? 'a' : 'span', 'poem-title', v.title);
    if (v.src) {
      title.href = v.src;
      title.rel = 'noopener noreferrer';
      title.title = L.sourceHint;
    }
    by.append(title);
  }
  return by;
}

function cardContent(v) {
  return [verseBlock(v, 'hero'), byLine(v)];
}

/** A small verse or poem row: lists and the diary. */
function rowContent(v) {
  if (v.kind === 'poem') {
    const poet = el('p', 'by');
    const name = el('span', 'poet', v.poet);
    name.lang = lang;
    poet.append(name);
    return [arabic('p', 'row-poem', v.title ?? v.sadr), poet];
  }
  return [verseBlock(v, 'small'), byLine(v)];
}

// ------------------------------------------------------------------ views

function topBar(withButton) {
  const bar = el('header', 'bar');
  const mark = el('span', 'wordmark', L.wordmark);
  mark.lang = 'ar';
  bar.append(mark);
  if (withButton) bar.append(appButton('bar-get'));
  return bar;
}

function section(title, className) {
  const sec = el('section', `section ${className}`);
  sec.append(el('h2', 'section-h', title));
  return sec;
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

function header(snap) {
  const who = el('section', 'who');
  const name = censor(snap.n ?? '');
  who.append(avatar(snap), userText('h1', 'name', name || L.noName));
  if (snap.b) who.append(userText('p', 'bio', censor(snap.b)));
  const parts = snap.d !== undefined ? formatDay(snap.d, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  if (parts) who.append(el('p', 'meta', fill(L.updated, { date: parts.map((p) => p.value).join('') })));
  return { node: who, name };
}

/** The hero: verse cards, each filled from its poet's file or removed. */
function verseCards(entries, ctx, className = 'cards') {
  const list = el('ol', className);
  list.setAttribute('aria-busy', 'true');
  const grp = group(() => list.removeAttribute('aria-busy'));
  for (const entry of entries) {
    const card = el('li', 'card loading');
    card.append(el('span', 'card-n'), skeleton('sk-verse', 2));
    const bound = bind(ctx, grp, entry, (files) => {
      const v = resolveEntry(entry, files, lang);
      if (!v) {
        card.remove();
        return;
      }
      card.classList.remove('loading');
      card.replaceChildren(el('span', 'card-n'), ...cardContent(v));
    });
    if (bound) list.append(card);
  }
  return { list, grp };
}

function topSection(entries, ctx) {
  const sec = section(L.top, 'top');
  const { list, grp } = verseCards(entries, ctx);
  if (!list.children.length) return null;
  const done = grp.done;
  grp.done = () => {
    done();
    if (!list.children.length) sec.remove();
  };
  sec.append(list);
  return sec;
}

function poetsSection(entries, ctx) {
  const sec = section(L.poets, 'poets');
  const ul = el('ul', 'chips');
  const grp = group(() => {
    if (!ul.children.length) sec.remove();
  });
  for (const entry of entries) {
    const chip = el('li', 'chip loading');
    chip.append(skeleton('sk-chip', 1));
    const bound = bind(ctx, grp, entry, (files) => {
      const p = resolvePoet(entry, files, lang);
      if (!p) {
        chip.remove();
        return;
      }
      chip.classList.remove('loading');
      chip.lang = lang;
      chip.title = p.full;
      chip.replaceChildren(p.name);
    });
    if (bound) ul.append(chip);
  }
  if (!ul.children.length) return null;
  sec.append(ul);
  return sec;
}

function statsStrip(stats) {
  const keys = STAT_KEYS.filter((k) => stats && Object.hasOwn(stats, k));
  if (!keys.length) return null;
  const dl = el('dl', 'stats');
  for (const k of keys) {
    const item = el('div', 'stat');
    item.append(el('dt', 'stat-l', L.stats[k]), el('dd', 'stat-n', numbers.format(stats[k])));
    dl.append(item);
  }
  return dl;
}

/** Verse and poem rows (lists, diary); each filled or removed. */
function rows(list, entries, ctx, grp, withDays) {
  let previous = null;
  for (const entry of entries) {
    const li = el('li', 'row loading');
    if (withDays) {
      const day = el('div', 'row-day');
      const parts = entry.d !== undefined ? formatDay(entry.d, { day: 'numeric', month: rtl ? 'long' : 'short' }) : null;
      if (parts) {
        day.append(
          el('span', 'row-day-n', parts.find((p) => p.type === 'day')?.value ?? ''),
          el('span', 'row-day-m', parts.find((p) => p.type === 'month')?.value ?? ''),
        );
        if (entry.d === previous) day.classList.add('same');
      }
      previous = entry.d ?? null;
      li.append(day);
    }
    const body = el('div', 'row-body');
    body.append(skeleton('sk-row', 2));
    li.append(body);
    const bound = bind(ctx, grp, entry, (files) => {
      const v = resolveEntry(entry, files, lang);
      if (!v) {
        li.remove();
        return;
      }
      li.classList.remove('loading');
      body.replaceChildren(...rowContent(v));
      const tag = entry.g === 'saved' ? L.tags.saved : v.kind === 'poem' ? L.tags.poem : null;
      if (tag) li.append(el('span', 'tag', tag));
    });
    if (bound) list.append(li);
  }
}

function listsSection(lists, ctx) {
  const sec = section(L.lists, 'lists');
  const ul = el('ul', 'list-cards');
  for (const l of lists) {
    const li = el('li', 'list-card');
    li.append(userText('h3', 'list-name', censor(l.name)));
    const items = el('ol', 'list-rows');
    const grp = group(() => {
      if (!items.children.length) items.remove();
    });
    rows(items, l.items, ctx, grp, false);
    if (items.children.length) li.append(items);
    ul.append(li);
  }
  if (!ul.children.length) return null;
  sec.append(ul);
  return sec;
}

function diarySection(entries, ctx) {
  const sec = section(L.diary, 'diary');
  const list = el('ol', 'rows collapsed');
  list.tabIndex = -1;
  const more = el('button', 'more');
  more.type = 'button';
  const updateMore = () => {
    const n = list.children.length;
    more.textContent = fill(L.showAll, { n: numbers.format(n) });
    more.hidden = !list.classList.contains('collapsed') || n <= DIARY_SHOWN;
  };
  const grp = group(() => {
    if (!list.children.length) sec.remove();
    else updateMore();
  });
  rows(list, entries, ctx, grp, true);
  if (!list.children.length) return null;
  more.addEventListener('click', () => {
    list.classList.remove('collapsed');
    more.hidden = true;
    list.focus({ preventScroll: true });
  });
  updateMore();
  sec.append(list, more);
  return sec;
}

function callToAction() {
  const cta = el('section', 'cta');
  cta.append(el('h2', 'cta-h', L.ctaTitle), appButton('button button-bright'));
  return cta;
}

function credits() {
  return el('p', 'credits', L.credits);
}

function profileView(snap, ctx, parts) {
  const nodes = [topBar(true)];
  const { node, name } = header(snap);
  nodes.push(node);
  const top = topSection(parts.top, ctx);
  if (top) nodes.push(top);
  const poets = poetsSection(parts.poets, ctx);
  if (poets) nodes.push(poets);
  const stats = statsStrip(snap.s);
  if (stats) {
    const sec = el('section', 'section stats-section');
    sec.append(stats);
    nodes.push(sec);
  }
  if (parts.lists.length) {
    const lists = listsSection(parts.lists, ctx);
    if (lists) nodes.push(lists);
  }
  const diary = diarySection(parts.diary, ctx);
  if (diary) nodes.push(diary);
  nodes.push(callToAction(), credits());
  return { nodes, title: name ? fill(L.pageTitle, { name }) : L.appName };
}

function introView(ctx) {
  const lead = el('section', 'lead');
  lead.append(el('h1', 'lead-h', L.introTitle), el('p', 'lead-p', L.introText));
  const { list } = verseCards([INTRO_VERSE], ctx, 'cards intro-cards');
  if (list.children.length) lead.append(list);
  lead.append(appButton());
  return { nodes: [topBar(false), lead, credits()], title: L.appName };
}

function errorView(title = L.errorTitle, textLine = L.errorText) {
  const lead = el('section', 'lead');
  lead.append(el('div', 'empty-mark'), el('h1', 'lead-h', title), el('p', 'lead-p', textLine), appButton());
  return { nodes: [topBar(false), lead], title: L.appName };
}

/** Raw deflate in the browser (Safari 16.4+, Chrome 103+, Firefox 113+). */
function canInflate() {
  try {
    new DecompressionStream('deflate-raw');
    return true;
  } catch {
    return false;
  }
}

function show({ nodes, title }) {
  document.getElementById('app').replaceChildren(...nodes);
  document.title = title;
}

async function route(fromHashChange) {
  const gen = ++generation;
  if (fromHashChange) window.scrollTo(0, 0);
  const payload = payloadFromHash(location.hash);
  if (!payload) {
    const ctx = context(collectPoetIds({ top: [INTRO_VERSE], poets: [], lists: [], diary: [] }));
    show(introView(ctx));
    startLoading(ctx, gen);
    return;
  }
  if (!canInflate()) {
    show(errorView(L.oldBrowserTitle, L.oldBrowserText));
    return;
  }
  let snap;
  try {
    snap = await decodePayload(payload, APP_ID);
  } catch {
    if (gen === generation) show(errorView());
    return;
  }
  if (gen !== generation) return;
  if (snap.a !== APP_ID) {
    show(errorView());
    return;
  }
  const parts = profileParts(snap);
  const ctx = context(collectPoetIds(parts));
  show(profileView(snap, ctx, parts));
  startLoading(ctx, gen);
}

function boot() {
  document.documentElement.lang = lang;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  window.addEventListener('hashchange', () => route(true));
  route(false);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') boot();
