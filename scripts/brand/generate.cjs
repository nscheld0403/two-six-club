/* eslint-disable @typescript-eslint/no-require-imports -- Node build script (CommonJS) */
// The Two Six Club brand assets: pure-vector SVGs (Cinzel text converted to
// paths with opentype.js, laurel drawn procedurally) plus PNG app icons.
//
//   node scripts/brand/generate.cjs            -> SVGs in public/brand + src/app/icon.svg
//   node scripts/brand/generate.cjs --png      -> also PNG icons (needs Playwright)
//
// Approved home-screen icon: option C ("26 / CLUB" in a double frame).
const fs = require("fs");
const path = require("path");
const opentype = require("opentype.js");

const ROOT = path.join(__dirname, "../..");
const FONT_DIR = path.join(ROOT, "node_modules/@fontsource/cinzel/files");
const cinzel = (w) => opentype.parse(new Uint8Array(fs.readFileSync(path.join(FONT_DIR, `cinzel-latin-${w}-normal.woff`))).buffer);
const C700 = cinzel(700);
const C600 = cinzel(600);

const BG = "#0D0D0E";
const INK = "#F5F4F0";

/** Text as a centred SVG path. Returns {d, width}. */
function text(font, str, size, cx, baseline, tracking = 0) {
  const glyphs = font.stringToGlyphs(str);
  const scale = size / font.unitsPerEm;
  let width = 0;
  glyphs.forEach((g, i) => {
    width += g.advanceWidth * scale + (i < glyphs.length - 1 ? tracking : 0);
  });
  let x = cx - width / 2;
  let d = "";
  glyphs.forEach((g) => {
    d += g.getPath(x, baseline, size).toPathData(2);
    x += g.advanceWidth * scale + tracking;
  });
  return { d, width };
}

/** Visual bounds of a text path, for vertical centring. */
function textBox(font, str, size) {
  const p = font.getPath(str, 0, 0, size);
  const bb = p.getBoundingBox();
  return { top: bb.y1, bottom: bb.y2, height: bb.y2 - bb.y1 };
}

/** One laurel branch: leaves along a quadratic curve, mirrored by `side` (-1 left, 1 right). */
function branch({ cx, baseY, span, rise, leaves, leafLen, leafW, side, stroke }) {
  // Curve from bottom centre outward and up.
  const p0 = { x: cx - side * span * 0.1, y: baseY + rise * 0.06 };
  const p1 = { x: cx + side * span * 0.72, y: baseY + rise * 0.12 };
  const p2 = { x: cx + side * span, y: baseY - rise };
  const at = (t) => ({
    x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
    y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
  });
  const tan = (t) => ({
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  });
  let out = `<path d="M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} Q${p1.x.toFixed(1)} ${p1.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="${stroke}" stroke-linecap="round"/>`;
  const leaf = (l, w) => `M0 0 C${(w * 0.62).toFixed(1)} ${(-l * 0.2).toFixed(1)} ${(w * 0.5).toFixed(1)} ${(-l * 0.75).toFixed(1)} 0 ${(-l).toFixed(1)} C${(-w * 0.5).toFixed(1)} ${(-l * 0.75).toFixed(1)} ${(-w * 0.62).toFixed(1)} ${(-l * 0.2).toFixed(1)} 0 0Z`;
  for (let i = 0; i < leaves; i++) {
    const t = 0.2 + (i / (leaves - 1)) * 0.74;
    const p = at(t);
    const v = tan(t);
    const ang = (Math.atan2(v.y, v.x) * 180) / Math.PI + 90; // leaf axis along tangent
    const shrink = 1 - t * 0.25;
    const l = leafLen * shrink;
    const w = leafW * shrink;
    // pair of leaves: one above (outer) and one below (inner) the stem
    for (const s of [-1, 1]) {
      const rot = ang + s * 34;
      out += `<path transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${rot.toFixed(1)})" d="${leaf(l, w)}" fill="${INK}"/>`;
    }
  }
  // tip leaf
  const tip = at(1);
  const tv = tan(1);
  const ta = (Math.atan2(tv.y, tv.x) * 180) / Math.PI + 90;
  out += `<path transform="translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)}) rotate(${ta.toFixed(1)})" d="${leaf(leafLen * 0.62, leafW * 0.62)}" fill="${INK}"/>`;
  return out;
}

function laurel(opts) {
  return branch({ ...opts, side: -1 }) + branch({ ...opts, side: 1 });
}

function rule(x1, x2, y, w) {
  return `<rect x="${x1}" y="${(y - w / 2).toFixed(1)}" width="${x2 - x1}" height="${w}" fill="${INK}"/>`;
}

const svg = (body, bg = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${bg ? `<rect width="1024" height="1024" fill="${BG}"/>` : ""}${body}</svg>\n`;

// ---------------------------------------------------------------- A: 26 + laurel
function optionA(scale = 1) {
  const size = 470 * scale;
  const box = textBox(C700, "26", size);
  const centreY = 512 - 70 * scale;
  const baseline = centreY - (box.top + box.bottom) / 2;
  const t = text(C700, "26", size, 512, baseline, -6 * scale);
  const lau = laurel({
    cx: 512,
    baseY: baseline + 190 * scale,
    span: 290 * scale,
    rise: 150 * scale,
    leaves: 7,
    leafLen: 66 * scale,
    leafW: 34 * scale,
    stroke: 8 * scale,
  });
  return `<path d="${t.d}" fill="${INK}"/>${lau}`;
}

// --------------------------------------------- B: stacked THE / TWO SIX / CLUB
function optionB() {
  const frame =
    `<rect x="92" y="92" width="840" height="840" rx="70" fill="none" stroke="${INK}" stroke-width="10"/>` +
    `<rect x="122" y="122" width="780" height="780" rx="48" fill="none" stroke="${INK}" stroke-width="4"/>`;
  const the = text(C700, "THE", 74, 512, 362, 18);
  const two = text(C700, "TWO SIX", 142, 512, 540, 0);
  const club = text(C700, "CLUB", 92, 512, 672, 30);
  const lineY1 = 336;
  const lineY2 = 640;
  const rules =
    rule(232, 512 - the.width / 2 - 34, lineY1, 7) +
    rule(512 + the.width / 2 + 34, 792, lineY1, 7) +
    rule(232, 512 - club.width / 2 - 34, lineY2, 7) +
    rule(512 + club.width / 2 + 34, 792, lineY2, 7);
  const lau = laurel({ cx: 512, baseY: 800, span: 200, rise: 70, leaves: 6, leafLen: 40, leafW: 21, stroke: 5 });
  return frame + `<path d="${the.d + two.d + club.d}" fill="${INK}"/>` + rules + lau;
}

// ------------------------------------------------------------ C: 26 / CLUB, framed
function optionC() {
  const frame =
    `<rect x="92" y="92" width="840" height="840" rx="70" fill="none" stroke="${INK}" stroke-width="10"/>` +
    `<rect x="122" y="122" width="780" height="780" rx="48" fill="none" stroke="${INK}" stroke-width="4"/>`;
  const n = text(C700, "26", 400, 512, 560, -4);
  const club = text(C700, "CLUB", 112, 512, 742, 34);
  const rules = rule(212, 512 - club.width / 2 - 40, 704, 8) + rule(512 + club.width / 2 + 40, 812, 704, 8);
  return frame + `<path d="${n.d + club.d}" fill="${INK}"/>` + rules;
}

// ------------------------------------------------- Horizontal wordmark (welcome)
function wordmark() {
  // viewBox 0 0 1200 760, transparent
  const the = text(C700, "THE", 92, 600, 150, 26);
  const two = text(C700, "TWO SIX", 236, 600, 390, 4);
  const club = text(C700, "CLUB", 118, 600, 540, 44);
  const est = text(C600, "ESTABLISHED 2026", 42, 600, 606, 14);
  const rules =
    rule(250, 600 - the.width / 2 - 40, 118, 8) +
    rule(600 + the.width / 2 + 40, 950, 118, 8) +
    rule(250, 600 - club.width / 2 - 44, 498, 8) +
    rule(600 + club.width / 2 + 44, 950, 498, 8);
  const lau = laurel({ cx: 600, baseY: 770, span: 330, rise: 110, leaves: 8, leafLen: 50, leafW: 26, stroke: 6 });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="The Two Six Club, established 2026"><path d="${the.d + two.d + club.d + est.d}" fill="${INK}"/>${rules}${lau}</svg>\n`;
}

const brandDir = path.join(ROOT, "public/brand");
fs.mkdirSync(brandDir, { recursive: true });
const files = {
  "public/brand/icon.svg": svg(optionC()),
  // Android/Chrome "maskable": content inside the 80% safe zone.
  "public/brand/icon-maskable.svg": svg(`<g transform="translate(512 512) scale(0.72) translate(-512 -512)">${optionC()}</g>`),
  "public/brand/wordmark.svg": wordmark(),
  "public/brand/alt-26-laurel.svg": svg(optionA()),
  "public/brand/alt-stacked.svg": svg(optionB()),
  "src/app/icon.svg": svg(optionC()),
};
for (const [rel, data] of Object.entries(files)) fs.writeFileSync(path.join(ROOT, rel), data);
console.log("wrote", Object.keys(files).join(", "));

if (process.argv.includes("--png")) {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
  const pngs = [
    ["public/brand/icon.svg", "src/app/apple-icon.png", 180],
    ["public/brand/icon.svg", "public/icons/icon-192.png", 192],
    ["public/brand/icon.svg", "public/icons/icon-512.png", 512],
    ["public/brand/icon-maskable.svg", "public/icons/icon-maskable-512.png", 512],
  ];
  (async () => {
    const browser = await chromium.launch();
    for (const [src, dest, size] of pngs) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      const markup = fs.readFileSync(path.join(ROOT, src), "utf8");
      await page.setContent(`<html><body style="margin:0;background:${BG}"><div style="width:${size}px;height:${size}px">${markup.replace("<svg ", `<svg style="width:${size}px;height:${size}px;display:block" `)}</div></body></html>`);
      fs.mkdirSync(path.dirname(path.join(ROOT, dest)), { recursive: true });
      await page.screenshot({ path: path.join(ROOT, dest), clip: { x: 0, y: 0, width: size, height: size } });
      await page.close();
      console.log("png", dest, size);
    }
    await browser.close();
  })();
}
