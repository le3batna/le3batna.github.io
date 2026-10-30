// Covers drawn in code for the games, movies, series and comics shelves: a
// port of apps/raff/lib/ui/covers.dart. Each item gets a cover from its own
// title, on a colour and a motif picked by a stable hash of its id (or a
// custom item's title), inside its shelf's palette, with the shelf's glyph.
// The same hash and bit fields as the app, so a friend's link shows the same
// covers in the browser. No images: inline SVG for the art, HTML text for
// the title (fonts in ../fonts/, sized in container units of the cover).
//
// Keep in step with covers.dart: hash, palettes, bit fields, motifs, glyphs,
// the title's typeface rule and where the title sits.
//
// Safety: titles reach the page through textContent only.

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The shelves' codes in a link, and the kinds they stand for. */
export const KIND_OF_CODE = { p: 'perfume', g: 'game', m: 'movie', s: 'series', c: 'comic' };

/**
 * FNV-1a (32 bits) of the UTF-16 code units of [seed]: the same number as
 * coverHash in covers.dart.
 */
export function coverHash(seed) {
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Bits [from]..[from+bits) of [h]. */
export function bits(h, from, n) {
  return (h >>> from) & ((1 << n) - 1);
}

const PAPER = '#EFE4D0';
const PAPER_INK = '#26161C';
const LIGHT_INK = '#F6ECDD';

/** Each shelf's accent and the deep tones its covers are made of. */
export const SHELF_STYLES = {
  perfume: { accent: '#D3A65A', tones: ['#3A2129'], paper: PAPER, paperInk: PAPER_INK },
  game: {
    accent: '#5FCBA9',
    tones: ['#123A3A', '#1E2F55', '#3B1D4F', '#14402E', '#4A1F24', '#2B2C3A', '#3D3417', '#0F3048'],
    paper: PAPER,
    paperInk: PAPER_INK,
  },
  movie: {
    accent: '#EB7A62',
    tones: ['#3A1218', '#1B2236', '#2E1C12', '#16302B', '#3B2A10', '#2A1730', '#112A33', '#45261C'],
    paper: PAPER,
    paperInk: PAPER_INK,
  },
  series: {
    accent: '#86A8F7',
    tones: ['#16233F', '#2A1F44', '#0F3436', '#3A1A2B', '#20302A', '#3A2E1A', '#1F2A33', '#341B1B'],
    paper: PAPER,
    paperInk: PAPER_INK,
  },
  comic: {
    accent: '#F2C14E',
    tones: ['#B8322E', '#1F4E9C', '#2E7D5B', '#6E2A86', '#D9602A', '#1B1B1F', '#0E6E7A', '#8C1F4A'],
    paper: '#F4EAD2',
    paperInk: PAPER_INK,
  },
};

// ---------------------------------------------------------------- colours

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Color.lerp: [a] to [b] by [t], per channel. */
export function lerpColor(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}

// ------------------------------------------------------------------ look

/** True when [text] has Arabic letters (its cover is set right to left). */
export function hasArabic(text) {
  for (const ch of String(text)) {
    const r = ch.codePointAt(0);
    if ((r >= 0x0600 && r <= 0x06ff) || (r >= 0x0750 && r <= 0x077f) || (r >= 0xfb50 && r <= 0xfeff)) return true;
  }
  return false;
}

/** What a cover is made of, all from the item's hash (CoverLook). */
export function coverLook(kind, seed) {
  const hash = coverHash(seed);
  const style = SHELF_STYLES[kind] ?? SHELF_STYLES.game;
  const paper = kind === 'comic' ? bits(hash, 0, 3) === 7 : bits(hash, 0, 3) === 0 && bits(hash, 3, 1) === 1;
  const background = paper ? style.paper : style.tones[bits(hash, 4, 3) % style.tones.length];
  return {
    kind,
    hash,
    style,
    paper,
    background,
    motif: bits(hash, 8, 3),
    typeface: bits(hash, 11, 2),
    titleTop: bits(hash, 13, 1) === 1,
    ink: paper ? style.paperInk : LIGHT_INK,
    shade: lerpColor(background, paper ? style.paperInk : '#FFFFFF', paper ? 0.12 : 0.13),
    accent: paper ? lerpColor(style.accent, style.paperInk, 0.35) : style.accent,
  };
}

// Average advance widths (em) of the bundled faces, measured from the font
// files, to fit a title without measuring text in the browser.
const FACES = {
  kufi: { family: 'kufi', upper: 0.71, lower: 0.534, digit: 0.529, space: 0.2, arabic: 0.58 },
  lalezar: { family: 'lalezar', upper: 0.57, lower: 0.488, digit: 0.5, space: 0.2, arabic: 0.52 },
  oswald: { family: 'oswald', upper: 0.523, lower: 0.441, digit: 0.496, space: 0.25, arabic: 0.55 },
  playfair: { family: 'playfair', upper: 0.681, lower: 0.527, digit: 0.516, space: 0.233, arabic: 0.55 },
};

/**
 * The title's type for [title] at [size] (titleStyle): face, letter
 * spacing in em, line height.
 */
export function titleStyle(look, title, size) {
  const t = look.typeface;
  let face;
  let spacing = 0;
  let height;
  if (hasArabic(title)) {
    const kufi = look.kind === 'game' ? t % 2 === 0 : t === 3;
    [face, height] = kufi ? ['kufi', 1.25] : ['lalezar', 1.3];
  } else if (look.kind === 'movie' || look.kind === 'series') {
    [face, spacing, height] = t % 2 === 0 ? ['oswald', 0.02, 1.05] : ['playfair', 0, 1.08];
  } else if (look.kind === 'comic') {
    [face, spacing, height] = ['oswald', 0.01, 1.0];
  } else {
    [face, spacing, height] = t === 3 ? ['playfair', 0, 1.08] : ['oswald', 0.03, 1.05];
  }
  return { face, spacing, height, size };
}

/** Latin poster titles are set in capitals (Oswald); serif and Arabic titles as written. */
export function titleText(look, title) {
  if (hasArabic(title)) return title;
  const serif = look.kind === 'movie' || look.kind === 'series' ? look.typeface % 2 === 1 : look.kind === 'game' && look.typeface === 3;
  return serif ? title : title.toUpperCase();
}

function charWidth(ch, face) {
  const r = ch.codePointAt(0);
  if (/\s/.test(ch)) return face.space;
  if ((r >= 0x064b && r <= 0x065f) || r === 0x0670 || (r >= 0x0610 && r <= 0x061a)) return 0; // marks
  if (r === 0x0640) return 0.3; // tatweel
  if ((r >= 0x0600 && r <= 0x06ff) || (r >= 0x0750 && r <= 0x077f) || (r >= 0xfb50 && r <= 0xfeff)) return face.arabic;
  if (ch >= 'A' && ch <= 'Z') return face.upper;
  if (ch >= 'a' && ch <= 'z') return face.lower;
  if (ch >= '0' && ch <= '9') return face.digit;
  if (r > 0x2e80) return 1; // CJK and the like
  return 0.38;
}

/** The estimated width of [text] in the units of [style].size (5% to spare). */
export function textWidth(text, style) {
  const face = FACES[style.face];
  let em = 0;
  for (const ch of text) em += charWidth(ch, face) + style.spacing;
  return em * style.size * 1.05;
}

/**
 * The largest size (and line count) at which [text] fits a box of
 * [boxW]×[boxH]: no word broken across lines, at most four lines
 * (_fitTitle). Sizes go down by a tenth from [maxSize] to [minSize].
 */
export function fitTitle(text, look, boxW, boxH, maxSize, minSize) {
  const words = text.split(/\s+/).filter(Boolean);
  let size = maxSize;
  while (size > minSize) {
    const style = titleStyle(look, text, size);
    const widths = words.map((w) => textWidth(w, style));
    if (widths.every((w) => w <= boxW)) {
      const space = textWidth(' ', style);
      let lines = words.length ? 1 : 0;
      let line = 0;
      for (const w of widths) {
        if (line > 0 && line + space + w > boxW) {
          lines++;
          line = w;
        } else {
          line += (line > 0 ? space : 0) + w;
        }
      }
      if (lines <= 4 && lines * size * style.height <= boxH) return { style, lines: Math.max(1, lines) };
    }
    size *= 0.9;
  }
  return { style: titleStyle(look, text, minSize), lines: 4 };
}

/** The cover's width / height (CoverArt.aspectOf). */
export function aspectOf(kind) {
  if (kind === 'game') return 0.8;
  if (kind === 'perfume') return 100 / 140;
  return 0.68;
}

/**
 * Where the title goes on a cover 100 units wide, for [title] drawn about
 * [px] CSS pixels wide (the smallest type size is 4px, as in the app):
 * {text, rtl, left, right, top | bottom, width, maxHeight, align, style, lines}.
 */
export function titleLayout(look, title, px = 90) {
  const kind = look.kind;
  const w = 100;
  const h = w / aspectOf(kind);
  const pad = w * 0.09;
  const start = kind === 'series' ? w * 0.15 : pad;
  let top;
  let bottom;
  if (kind === 'game') {
    top = h * 0.17;
    bottom = pad;
  } else if (kind === 'comic') {
    top = pad * 0.9;
    bottom = h * 0.16;
  } else {
    top = h * 0.16;
    bottom = pad;
  }
  const boxW = w - start - pad;
  const boxH = (h - top - bottom) * (kind === 'comic' ? 0.62 : 0.6);
  const text = titleText(look, title);
  const rtl = hasArabic(title);
  const minSize = Math.max((4 / Math.max(px, 1)) * w, w * 0.075);
  const fitted = fitTitle(text, look, boxW, boxH, w * (kind === 'comic' ? 0.25 : 0.2), minSize);
  const atTop = kind === 'comic' || (kind === 'game' && look.titleTop);
  return {
    text,
    rtl,
    // Clear of the series spine (always on the left), else the margin.
    left: start,
    right: pad,
    ...(atTop ? { top } : { bottom }),
    width: boxW,
    maxHeight: boxH,
    align: kind === 'comic' ? 'center' : rtl ? 'right' : 'left',
    style: fitted.style,
    lines: fitted.lines,
  };
}

// ------------------------------------------------------------- SVG nodes

function svgNode(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, typeof v === 'number' ? String(round(v)) : String(v));
  return node;
}

function round(v) {
  return Math.round(v * 100) / 100;
}

function add(parent, tag, attrs) {
  const node = svgNode(tag, attrs);
  parent.append(node);
  return node;
}

function rect(parent, x, y, width, height, fill, opacity) {
  return add(parent, 'rect', { x, y, width, height, fill, ...(opacity !== undefined && opacity < 1 ? { 'fill-opacity': opacity } : {}) });
}

function circle(parent, cx, cy, r, fill, opacity) {
  return add(parent, 'circle', { cx, cy, r, fill, ...(opacity !== undefined && opacity < 1 ? { 'fill-opacity': opacity } : {}) });
}

/** A rounded rect path with its own radius per corner (tl, tr, br, bl). */
function roundRectPath(x, y, w, h, [tl, tr, br, bl]) {
  return (
    `M${round(x + tl)} ${round(y)}H${round(x + w - tr)}` +
    (tr ? `A${round(tr)} ${round(tr)} 0 0 1 ${round(x + w)} ${round(y + tr)}` : '') +
    `V${round(y + h - br)}` +
    (br ? `A${round(br)} ${round(br)} 0 0 1 ${round(x + w - br)} ${round(y + h)}` : '') +
    `H${round(x + bl)}` +
    (bl ? `A${round(bl)} ${round(bl)} 0 0 1 ${round(x)} ${round(y + h - bl)}` : '') +
    `V${round(y + tl)}` +
    (tl ? `A${round(tl)} ${round(tl)} 0 0 1 ${round(x + tl)} ${round(y)}` : '') +
    'Z'
  );
}

/** The motif in the art area [rx, ry, w, h]: shapes in the cover's shade and accent. */
function motif(svg, look, rx, ry, w, h) {
  const g = add(svg, 'g', rx || ry ? { transform: `translate(${round(rx)} ${round(ry)})` } : {});
  const { shade, accent, background } = look;
  const hx = bits(look.hash, 16, 4) / 15;
  const hy = bits(look.hash, 20, 4) / 15;
  switch (look.motif) {
    case 0: {
      // Sun over a horizon.
      const cx = w * (0.35 + 0.4 * hx);
      const cy = h * (0.22 + 0.18 * hy);
      circle(g, cx, cy, w * 0.34, accent, look.paper ? 0.75 : 0.9);
      rect(g, 0, cy + w * 0.12, w, h, background);
      for (let i = 0; i < 4; i++) rect(g, 0, cy + w * 0.12 + i * w * 0.045, w, Math.max(0.6, w * 0.012), shade);
      break;
    }
    case 1: {
      // Rings.
      const cx = w * (0.2 + 0.6 * hx);
      const cy = h * (0.25 + 0.2 * hy);
      for (let i = 1; i <= 5; i++) {
        add(g, 'circle', {
          cx,
          cy,
          r: w * 0.11 * i,
          fill: 'none',
          stroke: i === 2 ? accent : shade,
          'stroke-width': Math.max(0.6, w * 0.018),
          ...(i === 2 ? { 'stroke-opacity': 0.9 } : {}),
        });
      }
      break;
    }
    case 2:
      // Bands, darker to lighter.
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        rect(g, 0, h * (0.18 + i * 0.09), w, h * 0.09, lerpColor(background, i === 2 ? accent : shade, 0.25 + 0.6 * t));
      }
      break;
    case 3: {
      // An arch.
      const aw = w * (0.46 + 0.16 * hx);
      add(g, 'path', { d: roundRectPath((w - aw) / 2, h * 0.12, aw, h * 0.62, [aw / 2, aw / 2, 0, 0]), fill: shade });
      circle(g, w / 2, h * 0.12 + aw / 2, aw * 0.16, accent);
      break;
    }
    case 4: {
      // A diagonal split.
      const y0 = h * (0.2 + 0.25 * hy);
      const y1 = h * (0.05 + 0.2 * hx);
      add(g, 'path', { d: `M0 ${round(y0)}L${round(w)} ${round(y1)}L${round(w)} ${round(h)}L0 ${round(h)}Z`, fill: shade });
      add(g, 'line', { x1: 0, y1: y0, x2: w, y2: y1, stroke: accent, 'stroke-width': Math.max(0.8, w * 0.02) });
      break;
    }
    case 5: {
      // A field of dots.
      const step = w / 7;
      for (let y = step * 0.8; y < h * 0.62; y += step) {
        for (let x = step / 2; x < w; x += step) circle(g, x, y, w * 0.022, shade);
      }
      circle(g, step * (0.5 + Math.round(6 * hx)), step * (0.8 + Math.round(3 * hy)), w * 0.05, accent);
      break;
    }
    case 6: {
      // Pinstripes, one in the accent.
      const n = 9;
      const pick = Math.round(hx * (n - 1));
      for (let i = 0; i < n; i++) {
        const x = (w * (i + 0.5)) / n;
        rect(g, x - w * 0.012, 0, w * 0.024, h * 0.66, i === pick ? accent : shade);
      }
      break;
    }
    default: {
      // A tall window of light.
      const left = w * (0.18 + 0.4 * hx);
      rect(g, left, 0, w * 0.22, h * 0.7, shade);
      rect(g, left, h * 0.7 - w * 0.02, w * 0.22, Math.max(0.8, w * 0.02), accent);
    }
  }
}

/** Comics: halftone, a burst or speed lines; then the band at the foot. */
function comicMotif(svg, look, w, h) {
  const ink = look.paper ? look.style.paperInk : '#000000';
  const hx = bits(look.hash, 16, 4) / 15;
  switch (look.motif % 3) {
    case 0: {
      // Halftone dots growing toward a corner.
      const step = w / 9;
      for (let y = h * 0.4; y < h; y += step) {
        for (let x = 0; x < w + step; x += step) {
          const t = Math.min(1.6, Math.max(0, (x / w) * (hx > 0.5 ? 1 : -1) + (y - h * 0.4) / (h * 0.6))) / 1.6;
          if (t <= 0.05) continue;
          circle(svg, x + (Math.round(y / step) % 2 === 1 ? step / 2 : 0), y, step * 0.42 * t, ink, 0.28);
        }
      }
      break;
    }
    case 1: {
      // A burst behind the middle.
      const cx = w * (0.3 + 0.4 * hx);
      const cy = h * 0.62;
      const spikes = 14;
      let d = '';
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? w * 0.42 : w * 0.3;
        const a = (i * Math.PI) / spikes;
        d += `${i === 0 ? 'M' : 'L'}${round(cx + Math.cos(a) * r)} ${round(cy + Math.sin(a) * r)}`;
      }
      d += 'Z';
      add(svg, 'path', {
        d,
        fill: look.accent,
        'fill-opacity': look.paper ? 0.45 : 0.5,
        stroke: look.accent,
        'stroke-width': Math.max(0.6, w * 0.012),
        'stroke-linejoin': 'miter',
      });
      break;
    }
    default: {
      // Speed lines from a point.
      const cx = w * (0.2 + 0.6 * hx);
      const cy = h * 0.66;
      let d = '';
      for (let i = 0; i < 28; i++) {
        const a = (i * 2 * Math.PI) / 28 + hx;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        d += `M${round(cx + dx * w * 0.12)} ${round(cy + dy * w * 0.12)}L${round(cx + dx * w * 1.2)} ${round(cy + dy * w * 1.2)}`;
      }
      add(svg, 'path', { d, stroke: ink, 'stroke-opacity': 0.3, 'stroke-width': Math.max(0.5, w * 0.012), fill: 'none' });
    }
  }
  rect(svg, 0, h * 0.86, w, h * 0.14, lerpColor(look.background, '#000000', 0.28));
}

/**
 * The shelf's small mark (paintShelfGlyph), centred on [cx, cy], about [s]
 * wide: a controller, a film frame, a screen, a speech bubble, a bottle.
 */
export function drawGlyph(parent, kind, cx, cy, s, color, opacity = 1) {
  const g = add(parent, 'g', {
    fill: 'none',
    stroke: color,
    'stroke-width': Math.max(0.6, s * 0.12),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    ...(opacity < 1 ? { opacity } : {}),
  });
  const fill = { fill: color, stroke: 'none' };
  switch (kind) {
    case 'game':
      add(g, 'rect', { x: cx - s / 2, y: cy - s * 0.3, width: s, height: s * 0.6, rx: s * 0.3 });
      add(g, 'line', { x1: cx - s * 0.3, y1: cy, x2: cx - s * 0.12, y2: cy });
      add(g, 'line', { x1: cx - s * 0.21, y1: cy - s * 0.09, x2: cx - s * 0.21, y2: cy + s * 0.09 });
      add(g, 'circle', { cx: cx + s * 0.2, cy: cy - s * 0.05, r: s * 0.055, ...fill });
      add(g, 'circle', { cx: cx + s * 0.28, cy: cy + s * 0.06, r: s * 0.055, ...fill });
      break;
    case 'movie': {
      const left = cx - s / 2;
      const top = cy - s * 0.36;
      const bottom = cy + s * 0.36;
      add(g, 'rect', { x: left, y: top, width: s, height: s * 0.72, rx: s * 0.08 });
      for (let i = 0; i < 3; i++) {
        const x = left + s * (0.22 + i * 0.28);
        add(g, 'rect', { x: x - s * 0.055, y: top + s * 0.15 - s * 0.045, width: s * 0.11, height: s * 0.09, ...fill });
        add(g, 'rect', { x: x - s * 0.055, y: bottom - s * 0.15 - s * 0.045, width: s * 0.11, height: s * 0.09, ...fill });
      }
      break;
    }
    case 'series': {
      const top = cy + s * 0.08 - s * 0.33;
      add(g, 'rect', { x: cx - s / 2, y: top, width: s, height: s * 0.66, rx: s * 0.1 });
      add(g, 'path', { d: `M${round(cx - s * 0.2)} ${round(cy - s * 0.42)}L${round(cx)} ${round(top)}L${round(cx + s * 0.2)} ${round(cy - s * 0.42)}` });
      break;
    }
    case 'comic': {
      const by = cy - s * 0.06;
      const bottom = by + s * 0.35;
      add(g, 'ellipse', { cx, cy: by, rx: s / 2, ry: s * 0.35 });
      add(g, 'path', {
        d: `M${round(cx - s * 0.18)} ${round(bottom - s * 0.08)}L${round(cx - s * 0.3)} ${round(bottom + s * 0.18)}L${round(cx + s * 0.02)} ${round(bottom - s * 0.02)}`,
      });
      break;
    }
    default: {
      // perfume
      add(g, 'rect', { x: cx - s * 0.36, y: cy + s * 0.14 - s * 0.35, width: s * 0.72, height: s * 0.7, rx: s * 0.14 });
      add(g, 'rect', { x: cx - s * 0.15, y: cy - s * 0.32 - s * 0.1, width: s * 0.3, height: s * 0.2, ...fill });
    }
  }
  return g;
}

/** The shelf's mark as a small icon (headings, chips), in the shelf's accent. */
export function glyphIcon(kind, color = (SHELF_STYLES[kind] ?? SHELF_STYLES.game).accent) {
  const svg = svgNode('svg', { viewBox: '0 0 24 24', class: 'glyph', 'aria-hidden': 'true', focusable: 'false' });
  drawGlyph(svg, kind, 12, 12, 24 * 0.86, color);
  return svg;
}

/** The cover's art (the painter): background, motif, the shelf's marks, the glyph. */
export function coverSvg(look) {
  const w = 100;
  const h = w / aspectOf(look.kind);
  const svg = svgNode('svg', { viewBox: `0 0 ${w} ${round(h)}`, class: 'cover-art', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' });
  rect(svg, 0, 0, w, h, look.background);
  switch (look.kind) {
    case 'game':
      motif(svg, look, 0, h * 0.12, w, h * 0.88);
      // The case's top band and its accent line.
      rect(svg, 0, 0, w, h * 0.12, '#0D0C11');
      rect(svg, 0, h * 0.12, w, Math.max(0.8, h * 0.008), look.style.accent);
      drawGlyph(svg, 'game', w * 0.86, h * 0.06, w * 0.075, '#EDE6DA');
      break;
    case 'series':
      motif(svg, look, 0, 0, w, h);
      // The box set's spine: a darker band with three season marks.
      rect(svg, 0, 0, w * 0.1, h, lerpColor(look.background, '#000000', 0.35));
      rect(svg, w * 0.1, 0, Math.max(0.6, w * 0.006), h, look.accent, 0.7);
      for (let i = 0; i < 3; i++) circle(svg, w * 0.05, h * (0.78 + i * 0.06), w * 0.014, look.accent, 0.85);
      drawGlyph(svg, 'series', w * 0.86, h * 0.075, w * 0.07, look.ink, 0.85);
      break;
    case 'comic':
      comicMotif(svg, look, w, h);
      drawGlyph(svg, 'comic', w * 0.87, h * 0.92, w * 0.07, look.ink, 0.9);
      break;
    default: {
      motif(svg, look, 0, 0, w, h);
      // A hairline frame, like a printed poster's margin.
      const inset = w * 0.045;
      add(svg, 'rect', {
        x: inset,
        y: inset,
        width: w - 2 * inset,
        height: h - 2 * inset,
        rx: w * 0.015,
        fill: 'none',
        stroke: look.accent,
        'stroke-opacity': 0.45,
        'stroke-width': Math.max(0.5, w * 0.006),
      });
      drawGlyph(svg, look.kind, w * 0.86, h * 0.075, w * 0.07, look.ink, 0.85);
    }
  }
  return svg;
}

const cqw = (v) => `${round(v)}cqw`;

/**
 * A cover for an item of [kind] (not perfumes: they stand as bottles):
 * [title] on it, drawn from [seed] (its catalog id, or a custom item's
 * title), about [px] CSS pixels wide.
 */
export function coverElement(kind, title, seed, px = 90) {
  const look = coverLook(kind, seed);
  const box = document.createElement('div');
  box.className = `cover cover-${kind}`;
  box.setAttribute('aria-hidden', 'true');
  box.append(coverSvg(look));
  const lay = titleLayout(look, title, px);
  const text = document.createElement('div');
  text.className = `cover-title f-${lay.style.face}`;
  text.textContent = lay.text;
  text.dir = lay.rtl ? 'rtl' : 'ltr';
  const st = text.style;
  st.setProperty('--fs', String(round(lay.style.size)));
  st.setProperty('--lines', String(lay.lines));
  st.left = cqw(lay.left);
  st.right = cqw(lay.right);
  if (lay.top !== undefined) st.top = cqw(lay.top);
  else st.bottom = cqw(lay.bottom);
  st.maxHeight = cqw(lay.maxHeight);
  st.textAlign = lay.align;
  st.letterSpacing = `${lay.style.spacing}em`;
  st.lineHeight = String(lay.style.height);
  st.color = look.ink;
  box.append(text);
  return box;
}
