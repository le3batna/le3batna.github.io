// The Arabic + English profanity filter: a line-by-line port of
// packages/taste_core/lib/src/filter/profanity_filter.dart. Keep the two in
// step; web/test/filter.test.mjs checks this port against the cases the Dart
// filter test writes (web/test/fixtures/filter-cases.json).
//
// How a text is checked, word by word (words split on spaces):
// 1. fold: lower case; Arabic diacritics and tatweel removed; أإآٱ→ا،
//    ى→ي، ة→ه، ؤ→و، ئ→ي، ک→ك، ی→ي; Latin accents removed; in a word with
//    a Latin letter, look-alike digits and signs become letters (0→o 1→i
//    3→e 4→a 5→s 7→t @→a $→s !→i); then everything that is not a letter
//    goes (so f.u.c.k is fuck);
// 2. forms: the word, with runs of 3+ letters cut to 2, and with every run
//    cut to 1 (fuuuck, كلللب); for Arabic, also without a joined particle
//    (يا وال بال فال لل ال و ب ل ف) and without a suffix (هم كم ها ين ات
//    ون ه ك), only when 3+ letters remain; for Latin, without es s ing ers
//    er ed y, when 3+ letters remain;
// 3. a hit: a form equals a plain entry or starts with a `stem*`;
// 4. single letters typed apart (ك ل ب) are joined and checked too, and
//    two-word entries are matched on consecutive words.

import { FILTER_WORDS } from './filter-words.js';

const ARABIC_PREFIXES = ['يا', 'وال', 'بال', 'فال', 'لل', 'ال', 'و', 'ب', 'ل', 'ف'];
const ARABIC_SUFFIXES = ['هم', 'كم', 'ها', 'ين', 'ات', 'ون', 'ه', 'ك'];
const LATIN_SUFFIXES = ['es', 's', 'ing', 'ers', 'er', 'ed', 'y'];

const ARABIC_FOLD = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
  'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي', 'ک': 'ك', 'ی': 'ي',
};

const LEET = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i',
};

const LATIN_ACCENT = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
  'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ñ': 'n',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ý': 'y', 'ÿ': 'y',
};

function lookup(map, c) {
  return Object.hasOwn(map, c) ? map[c] : c;
}

function isArabicMark(r) {
  return (
    r === 0x0640 || // tatweel
    (r >= 0x0610 && r <= 0x061a) ||
    (r >= 0x064b && r <= 0x065f) ||
    r === 0x0670 ||
    (r >= 0x06d6 && r <= 0x06ed)
  );
}

function isLetter(c) {
  const r = c.charCodeAt(0);
  return (r >= 0x61 && r <= 0x7a) || (r >= 0x0621 && r <= 0x064a);
}

function foldLatinAccents(s) {
  return s
    .split('')
    .map((c) => lookup(LATIN_ACCENT, c))
    .join('');
}

/** Step 1 of the filter: the folded form of one word ('' when nothing of it is a letter). */
export function foldWord(word) {
  const lower = word.toLowerCase();
  const latin = /[a-z]/.test(foldLatinAccents(lower));
  let out = '';
  for (const ch of lower) {
    const r = ch.codePointAt(0);
    if (isArabicMark(r)) continue;
    let c = ch;
    c = lookup(ARABIC_FOLD, c);
    c = lookup(LATIN_ACCENT, c);
    if (latin) c = lookup(LEET, c);
    if (isLetter(c)) out += c;
  }
  return out;
}

/** Step 2: the forms a folded word is checked in. */
function forms(key) {
  const base = new Set([key, key.replace(/(.)\1{2,}/g, '$1$1'), key.replace(/(.)\1+/g, '$1')]);
  const out = new Set(base);
  const arabic = /[ء-ي]/.test(key);
  for (const f of base) {
    if (arabic) {
      const noPrefix = new Set([f]);
      for (const p of ARABIC_PREFIXES) {
        if (f.startsWith(p) && f.length - p.length >= 3) noPrefix.add(f.substring(p.length));
      }
      for (const g of noPrefix) out.add(g);
      for (const g of noPrefix) {
        for (const s of ARABIC_SUFFIXES) {
          if (g.endsWith(s) && g.length - s.length >= 3) out.add(g.substring(0, g.length - s.length));
        }
      }
    } else {
      for (const s of LATIN_SUFFIXES) {
        if (f.endsWith(s) && f.length - s.length >= 3) out.add(f.substring(0, f.length - s.length));
      }
    }
  }
  return out;
}

class ProfanityFilter {
  constructor(words) {
    this.exact = new Set();
    this.stems = [];
    this.phrases = [];
    for (const raw of words) {
      const w = raw.trim();
      if (w.length === 0) continue;
      if (w.includes(' ')) {
        const parts = w.split(/\s+/).map(foldWord);
        if (parts.every((p) => p.length > 0)) this.phrases.push(parts);
      } else if (w.endsWith('*')) {
        const stem = foldWord(w.substring(0, w.length - 1));
        if (stem.length > 0) this.stems.push(stem);
      } else {
        const word = foldWord(w);
        if (word.length > 0) this.exact.add(word);
      }
    }
  }

  hasProfanity(text) {
    return this.hits(text).size > 0;
  }

  censor(text) {
    const hits = this.hits(text);
    if (hits.size === 0) return text;
    const toks = tokens(text);
    let out = '';
    let last = 0;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      out += text.substring(last, t.start);
      out += hits.has(i) ? '•••' : t.text;
      last = t.end;
    }
    out += text.substring(last);
    return out;
  }

  hits(text) {
    const toks = tokens(text);
    const hits = new Set();
    for (let i = 0; i < toks.length; i++) {
      if (this.matches(toks[i].key)) hits.add(i);
    }
    // Letters typed apart: ك ل ب, f u c k.
    let i = 0;
    while (i < toks.length) {
      if (toks[i].key.length !== 1) {
        i++;
        continue;
      }
      let j = i;
      while (j < toks.length && toks[j].key.length === 1) {
        j++;
      }
      if (j - i >= 2 && this.matches(toks.slice(i, j).map((t) => t.key).join(''))) {
        for (let k = i; k < j; k++) {
          hits.add(k);
        }
      }
      i = j;
    }
    // Two-word entries.
    for (const phrase of this.phrases) {
      for (let s = 0; s + phrase.length <= toks.length; s++) {
        let all = true;
        for (let k = 0; k < phrase.length; k++) {
          if (!forms(toks[s + k].key).has(phrase[k])) {
            all = false;
            break;
          }
        }
        if (all) {
          for (let k = 0; k < phrase.length; k++) {
            hits.add(s + k);
          }
        }
      }
    }
    return hits;
  }

  matches(key) {
    if (key.length === 0) return false;
    for (const form of forms(key)) {
      if (this.exact.has(form)) return true;
      for (const stem of this.stems) {
        if (form.startsWith(stem)) return true;
      }
    }
    return false;
  }
}

function tokens(text) {
  const out = [];
  for (const m of text.matchAll(/\S+/g)) {
    const t = m[0];
    out.push({ text: t, start: m.index, end: m.index + t.length, key: foldWord(t) });
  }
  return out;
}

const standard = new ProfanityFilter(FILTER_WORDS);

/** The text holds a listed word. */
export function hasProfanity(text) {
  return standard.hasProfanity(String(text ?? ''));
}

/** [text] with each offending word replaced by `•••`. Spacing is kept. */
export function censor(text) {
  return standard.censor(String(text ?? ''));
}
