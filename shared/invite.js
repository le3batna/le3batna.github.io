// The circle invite page, shared by أبيات (/abyat/c/) and رفّ (/raff/c/).
//
// A circle invite link looks like https://le3batna.github.io/abyat/c/#K3MQ7XD2
// (docs/specs/2026-10-31-taste-circle-server.md, section 7). With the app
// installed, iOS opens the link in the app (universal links). Without it,
// this page shows the code, how to use it and the App Store button.
//
// The code sits in the # fragment, which browsers never send to a server.
// The page reads it in the browser, makes no request at all, and writes text
// with textContent only (never markup).
//
// Typing and pasting are forgiving, like the app and the restore code: case,
// spaces, any dash and the invisible direction marks an Arabic app adds are
// ignored; O reads as 0 and I or L as 1; Arabic-Indic (٠-٩) and Persian
// (۰-۹) digits work.

/** Crockford base32: no I, L, O or U. */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 8;

/** Spaces, dashes and invisible marks: the same set as taste_sync's restore code
 * (packages/taste_sync/lib/src/restore_code.dart, `_isIgnored`). */
const IGNORED = new Set([
  0x00a0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, // spaces
  0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0xfe58, 0xfe63, 0xff0d, // dashes
  0x061c, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0xfeff, // marks
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, // embeddings
]);

function isIgnored(cp) {
  if (cp === 0x20 || cp === 0x2d || (cp >= 0x09 && cp <= 0x0d)) return true;
  return (cp >= 0x2000 && cp <= 0x200a) || IGNORED.has(cp);
}

/**
 * The canonical code (8 characters of [CODE_ALPHABET]) in [text], or null
 * when it is not a well-formed code.
 */
export function normalizeInviteCode(text) {
  if (typeof text !== 'string') return null;
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (isIgnored(cp)) continue;
    if (cp >= 0x0660 && cp <= 0x0669) {
      out += String(cp - 0x0660);
      continue;
    }
    if (cp >= 0x06f0 && cp <= 0x06f9) {
      out += String(cp - 0x06f0);
      continue;
    }
    if (cp > 0x7f) return null;
    let c = ch.toUpperCase();
    if (c === 'O') c = '0';
    else if (c === 'I' || c === 'L') c = '1';
    if (!CODE_ALPHABET.includes(c)) return null;
    out += c;
    if (out.length > CODE_LENGTH) return null;
  }
  return out.length === CODE_LENGTH ? out : null;
}

/** `XXXX-XXXX` (lay it out left to right). */
export function formatInviteCode(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** The code in a location hash (`#K3MQ7XD2`, also percent-encoded), or null. */
export function inviteCodeFromHash(hash) {
  if (typeof hash !== 'string') return null;
  let raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw.length > 200) return null;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return normalizeInviteCode(raw);
}

/** Arabic for an Arabic browser (or none), English otherwise. */
export function pickLang(language) {
  return !language || String(language).toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

/** The keys every page's LABELS table has, in both languages. */
export const LABEL_KEYS = ['docTitle', 'app', 'title', 'lead', 'codeLabel', 'copy', 'copied', 'copyFailed', 'steps', 'store', 'hint', 'bad', 'privacy'];

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Builds the page for [code] (canonical, or null for a missing or bad code)
 * and returns its nodes. [copy] writes text to the clipboard and resolves
 * true when it worked.
 */
export function buildInvite(doc, { labels, code, appStoreUrl, copy }) {
  const nodes = [];
  const bar = el(doc, 'header', 'bar');
  bar.append(el(doc, 'p', 'wordmark', labels.app));
  nodes.push(bar);

  const main = el(doc, 'main', 'invite');
  main.append(el(doc, 'h1', 'title', labels.title));
  if (code) {
    main.append(el(doc, 'p', 'lead', labels.lead));
    const box = el(doc, 'section', 'code-box');
    box.append(el(doc, 'p', 'code-label', labels.codeLabel));
    const shown = el(doc, 'p', 'code', formatInviteCode(code));
    shown.setAttribute('dir', 'ltr');
    shown.setAttribute('lang', 'en');
    box.append(shown);
    const button = el(doc, 'button', 'copy', labels.copy);
    button.setAttribute('type', 'button');
    button.addEventListener('click', async () => {
      let ok = false;
      try {
        ok = (await copy(formatInviteCode(code))) !== false;
      } catch {
        ok = false;
      }
      button.textContent = ok ? labels.copied : labels.copyFailed;
    });
    box.append(button);
    main.append(box);
    const steps = el(doc, 'ol', 'steps');
    for (const step of labels.steps) steps.append(el(doc, 'li', 'step', step));
    main.append(steps);
  } else {
    main.append(el(doc, 'p', 'bad', labels.bad));
  }
  const store = el(doc, 'a', 'store', labels.store);
  store.href = appStoreUrl;
  store.setAttribute('rel', 'noopener noreferrer');
  main.append(store);
  if (code) main.append(el(doc, 'p', 'hint', labels.hint));
  main.append(el(doc, 'p', 'privacy', labels.privacy));
  nodes.push(main);
  return nodes;
}

/** Runs the page in a browser: renders into #app and again on hashchange. */
export function startInvitePage({ labels, appStoreUrl }) {
  const lang = pickLang(globalThis.navigator?.language);
  const t = labels[lang];
  const root = document.getElementById('app');
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  document.title = t.docTitle;
  const copy = async (text) => {
    if (!globalThis.navigator?.clipboard?.writeText) return false;
    await globalThis.navigator.clipboard.writeText(text);
    return true;
  };
  const render = () => {
    const code = inviteCodeFromHash(globalThis.location?.hash ?? '');
    root.replaceChildren(...buildInvite(document, { labels: t, code, appStoreUrl, copy }));
  };
  render();
  globalThis.addEventListener?.('hashchange', render);
}
