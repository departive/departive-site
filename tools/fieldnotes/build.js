#!/usr/bin/env node
/*
 * FIELD NOTES — photo-story build script for departive.com
 *
 *   node tools/fieldnotes/build.js stories/<slug>/ [--force]
 *
 * Ingests stories/<slug>/story.json + the source images sitting next to it,
 * emits stories/<slug>/index.html plus optimized renditions in
 * stories/<slug>/img/ (WebP + JPG at several widths, srcset/sizes,
 * width/height attributes — no CLS, no base64).
 *
 * Deterministic, no AI. Only dependency: sharp (see package.json).
 * Schema: tools/fieldnotes/README.md
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/* ---------------------------------------------------------------- config */

const WIDTHS = [480, 960, 1600, 2400];   // candidate rendition widths
const JPG_QUALITY = 80;
const WEBP_QUALITY = 75;

const DEFAULTS = {
  bone: [242, 238, 230],   // --bone  #f2eee6 (page background)
  proseInk: [43, 36, 24],  // body copy #2b2418 — tint must keep >= 7:1 against it
  mutedInk: '#6b6252',     // --mutedInk — caption fallback
  tintMix: 0.16,           // how far a chapter tint leans from bone toward the hero
  inkContrast: 4.5,        // caption ink vs chapter tint (WCAG AA, normal text)
  tintContrast: 7.0        // prose ink vs chapter tint (comfortable long-form margin)
};

/* ------------------------------------------------------------------ args */

const args = process.argv.slice(2).filter(a => a !== '--force');
const FORCE = process.argv.includes('--force');
if (args.length !== 1) {
  console.error('usage: node tools/fieldnotes/build.js stories/<slug>/ [--force]');
  process.exit(1);
}
const storyDir = path.resolve(args[0]);
const storyPath = path.join(storyDir, 'story.json');
if (!fs.existsSync(storyPath)) {
  console.error(`no story.json in ${storyDir}`);
  process.exit(1);
}
const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
const imgDir = path.join(storyDir, 'img');
fs.mkdirSync(imgDir, { recursive: true });

/* ------------------------------------------------------- tiny EXIF reader */
/* Just enough TIFF/EXIF to pull Make, Model and DateTimeOriginal — keeps
 * the dependency surface at exactly one package (sharp). */

function parseExif(file) {
  const out = { make: null, model: null, date: null };
  let buf;
  try { buf = fs.readFileSync(file); } catch { return out; }
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return out;
  let off = 2;
  while (off + 4 < buf.length) {
    if (buf[off] !== 0xff) break;
    const marker = buf[off + 1];
    if (marker === 0xda) break;                       // start of scan — no EXIF past here
    const size = buf.readUInt16BE(off + 2);
    if (marker === 0xe1 && buf.toString('ascii', off + 4, off + 10) === 'Exif\0\0') {
      const tiff = off + 10;
      try {
        const le = buf.toString('ascii', tiff, tiff + 2) === 'II';
        const u16 = p => le ? buf.readUInt16LE(p) : buf.readUInt16BE(p);
        const u32 = p => le ? buf.readUInt32LE(p) : buf.readUInt32BE(p);
        const str = (p, n) => buf.toString('ascii', p, p + n).replace(/\0+$/, '').trim();
        const readIFD = (ifdOff, want) => {
          const found = {};
          const count = u16(tiff + ifdOff);
          for (let i = 0; i < count; i++) {
            const e = tiff + ifdOff + 2 + i * 12;
            const tag = u16(e), typ = u16(e + 2), cnt = u32(e + 4);
            const valOff = cnt * (typ === 2 ? 1 : typ === 3 ? 2 : 4) <= 4 ? e + 8 : tiff + u32(e + 8);
            if (want.includes(tag)) {
              if (typ === 2) found[tag] = str(valOff, cnt);
              else if (typ === 3) found[tag] = u16(valOff);
              else if (typ === 4) found[tag] = u32(valOff);
            }
            if (tag === 0x8769) found[0x8769] = u32(e + 8); // Exif IFD pointer
          }
          return found;
        };
        const ifd0 = readIFD(u32(tiff + 4), [0x010f, 0x0110, 0x8769]);
        out.make = ifd0[0x010f] || null;
        out.model = ifd0[0x0110] || null;
        if (ifd0[0x8769]) {
          const exif = readIFD(ifd0[0x8769], [0x9003]);
          if (exif[0x9003]) out.date = exif[0x9003];   // "YYYY:MM:DD HH:MM:SS"
        }
      } catch { /* malformed EXIF — shrug, EXIF is optional */ }
      return out;
    }
    off += 2 + size;
  }
  return out;
}

/* ------------------------------------------------------- color utilities */

const hex = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function luminance([r, g, b]) {
  const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/* Sample a hero image: overall average → background tint candidate;
 * average of the darker half of pixels → caption ink candidate. */
async function samplePalette(file) {
  const { data, info } = await sharp(file).rotate()
    .resize(48, 48, { fit: 'inside' }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i + 2 < data.length; i += info.channels) {
    px.push([data[i], data[i + 1], data[i + 2]]);
  }
  const avg = px.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map(v => v / px.length);
  const sorted = [...px].sort((a, b) => luminance(a) - luminance(b));
  const darkHalf = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 2)));
  const dark = darkHalf.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map(v => v / darkHalf.length);
  return { avg, dark };
}

/* Contrast-guarded chapter chrome: returns { tint, ink, fellBack:{tint,ink} } */
function chapterChrome({ avg, dark }) {
  const fellBack = { tint: false, ink: false };
  let tint = mix(DEFAULTS.bone, avg, DEFAULTS.tintMix);
  if (contrast(tint, DEFAULTS.proseInk) < DEFAULTS.tintContrast) {
    tint = DEFAULTS.bone; fellBack.tint = true;
  }
  let ink = dark;
  if (contrast(ink, tint) < DEFAULTS.inkContrast) {
    ink = null; fellBack.ink = true;                  // fall back to --mutedInk
  }
  return { tint: hex(tint), ink: ink ? hex(ink) : DEFAULTS.mutedInk, fellBack };
}

/* --------------------------------------------------------------- images */

/* Extension stays in the slug: story folders routinely hold original-3.JPEG
 * next to original-3.jpg — stripping extensions collides their renditions. */
const slugify = f => path.basename(f).toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function processImage(file) {
  const abs = path.join(storyDir, file);
  if (!fs.existsSync(abs)) throw new Error(`missing image: ${file}`);
  const base = slugify(file);
  const meta = await sharp(abs).metadata();
  const swap = (meta.orientation || 1) >= 5;          // EXIF rotation swaps axes
  const W = swap ? meta.height : meta.width;
  const H = swap ? meta.width : meta.height;
  const widths = WIDTHS.filter(w => w <= W);
  if (!widths.length || widths[widths.length - 1] < Math.min(W, 2400)) {
    widths.push(Math.min(W, 2400));                   // always offer the largest sane width
  }
  const outs = [];
  for (const w of widths) {
    const h = Math.round(H * w / W);
    for (const [fmt, opts] of [
      ['webp', { quality: WEBP_QUALITY, effort: 4 }],
      ['jpg', { quality: JPG_QUALITY, progressive: true, mozjpeg: true }]
    ]) {
      const name = `${base}-${w}.${fmt}`;
      const out = path.join(imgDir, name);
      if (FORCE || !fs.existsSync(out)) {
        const p = sharp(abs).rotate().resize(w);
        await (fmt === 'webp' ? p.webp(opts) : p.jpeg(opts)).toFile(out);
      }
      outs.push({ name, w, h, fmt });
    }
  }
  const exif = parseExif(abs);
  return { file, base, W, H, widths, outs, exif };
}

/* --------------------------------------------------------------- markup */

const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const SIZES = {
  cover: '100vw',
  full: '100vw',
  inset: '(min-width:1240px) 1180px, 96vw',
  pair: '(max-width:720px) 96vw, (min-width:1240px) 581px, 47vw',
  triptych: '(max-width:720px) 96vw, (min-width:1240px) 382px, 31vw'
};

function pictureFor(img, kind, { alt = '', eager = false, klass = 'media' } = {}) {
  const sizes = SIZES[kind] || SIZES.inset;
  const set = fmt => img.outs.filter(o => o.fmt === fmt).map(o => `img/${o.name} ${o.w}w`).join(', ');
  const biggestJpg = img.outs.filter(o => o.fmt === 'jpg').slice(-1)[0];
  const load = eager
    ? 'fetchpriority="high" decoding="async"'
    : 'loading="lazy" decoding="async"';
  return `<picture>
<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">
<img class="${klass}" src="img/${biggestJpg.name}" srcset="${set('jpg')}" sizes="${sizes}" width="${img.W}" height="${img.H}" alt="${escAttr(alt)}" ${load}>
</picture>`;
}

function captionHtml(entry, cls = '') {
  if (!entry || !entry.caption) return '';
  const mode = entry.mode === 'aside' ? 'aside' : 'plate';
  return `<figcaption class="cap ${mode}${cls ? ' ' + cls : ''}">${entry.caption}</figcaption>`;
}

/* Group a chapter's flow: consecutive pair/triptych entries collapse into one
 * row; quote entries pass through; full/inset stand alone. */
function groupFlow(entries) {
  const blocks = [];
  for (const e of entries) {
    if (e.quote) { blocks.push({ type: 'quote', quote: e.quote }); continue; }
    const block = (e.block || 'inset').toLowerCase();
    const last = blocks[blocks.length - 1];
    if ((block === 'pair' || block === 'triptych') && last && last.type === block &&
        last.items.length < (block === 'pair' ? 2 : 3)) {
      last.items.push(e);
    } else if (block === 'pair' || block === 'triptych') {
      blocks.push({ type: block, items: [e] });
    } else {
      blocks.push({ type: block === 'full' ? 'full' : 'inset', items: [e] });
    }
  }
  return blocks;
}

function blockHtml(block, imgs) {
  if (block.type === 'quote') {
    return `<blockquote data-reveal>${block.quote}</blockquote>`;
  }
  if (block.type === 'full') {
    const e = block.items[0]; const img = imgs.get(e.file);
    return `<figure class="fullwrap" data-reveal>
<div class="full" data-parallax style="aspect-ratio:${img.W}/${img.H}">${pictureFor(img, 'full', { alt: e.alt })}</div>
${captionHtml(e)}
</figure>`;
  }
  if (block.type === 'inset') {
    const e = block.items[0]; const img = imgs.get(e.file);
    return `<figure class="inset" data-reveal>
${pictureFor(img, 'inset', { alt: e.alt, klass: 'contained' })}
${captionHtml(e)}
</figure>`;
  }
  // pair / triptych — one shared aspect (the most-portrait member) so the row
  // lays out before a single byte of image arrives.
  const ratio = Math.min(...block.items.map(e => { const i = imgs.get(e.file); return i.W / i.H; }));
  const capEntry = [...block.items].reverse().find(e => e.caption);
  const cells = block.items.map(e =>
    `<div class="cell" style="aspect-ratio:${ratio.toFixed(4)}">${pictureFor(imgs.get(e.file), block.type, { alt: e.alt })}</div>`
  ).join('\n');
  return `<figure class="group ${block.type}" data-reveal>
<div class="grid">
${cells}
</div>
${captionHtml(capEntry, 'cap-wide')}
</figure>`;
}

/* -------------------------------------------------------------- template */

function renderPage(ctx) {
  const { story, imgs, chromeByChapter, gear, gearLine, coverImg } = ctx;
  const slug = story.slug || path.basename(storyDir);
  const desc = escAttr(String(story.standfirst || '').replace(/<[^>]+>/g, '').slice(0, 158));
  const ogImage = `https://departive.com/stories/${slug}/img/${coverImg.outs.filter(o => o.fmt === 'jpg' && o.w <= 1600).slice(-1)[0].name}`;

  const chapters = story.chapters.map((ch, i) => {
    const chrome = chromeByChapter[i];
    const flow = groupFlow(ch.images || []).map(b => blockHtml(b, imgs)).join('\n');
    return `<section class="chapter" id="ch-${i + 1}" data-chapter style="--chTint:${chrome.tint};--chInk:${chrome.ink}">
<div class="section-head" data-reveal><div class="eyebrow">${ch.number}</div><h2>${ch.title}</h2></div>
<div class="prose" data-reveal><p>${ch.paragraph}</p></div>
${flow}
</section>`;
  }).join('\n\n');

  const end = story.end || {};
  const placeDate = [end.place, end.date].filter(Boolean).join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<title>${story.title} — departive</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="#141009">
<link rel="canonical" href="https://departive.com/stories/${slug}/">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23141009'/%3E%3Ccircle cx='16' cy='16' r='4.4' fill='%23b0835a'/%3E%3C/svg%3E">
<meta property="og:type" content="article">
<meta property="og:site_name" content="departive">
<meta property="og:title" content="${escAttr(story.title)}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="https://departive.com/stories/${slug}/">
<meta property="og:image" content="${ogImage}">
<style>
:root{--accent:#b0835a;--bone:#f2eee6;--ink:#1a150d;--muted:#9e9484;--mutedInk:#6b6252;
--line:rgba(26,21,13,.12);--onDark:#ede7db;
--serif:'Instrument Serif',Georgia,'Times New Roman',serif;
--sans:'Instrument Sans',system-ui,-apple-system,sans-serif;
--mono:ui-monospace,'SF Mono',Menlo,monospace;}
*{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bone);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{display:block}
::selection{background:var(--accent);color:var(--bone)}
a{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(176,131,90,.4)}

@keyframes riseIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.reveal-on [data-reveal]{opacity:0}
.reveal-on [data-reveal].is-in{animation:riseIn 1s cubic-bezier(0.22,1,0.36,1) both}
@media(prefers-reduced-motion:reduce){.reveal-on [data-reveal]{opacity:1!important;animation:none!important}html{scroll-behavior:auto}}

/* cover */
.cover{position:relative;height:96vh;height:96svh;min-height:560px;overflow:hidden;background:#241f1a}
.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cover::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgba(20,16,9,.15),rgba(20,16,9,0) 32%,rgba(20,16,9,0) 55%,rgba(20,16,9,.74))}
.chrome{position:absolute;top:0;left:0;right:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:clamp(22px,3vw,30px) clamp(24px,5vw,56px)}
.chrome .logo{font-family:var(--sans);font-weight:500;font-size:15px;letter-spacing:.14em;color:var(--onDark);text-decoration:none;border-bottom:none;transition:letter-spacing .6s cubic-bezier(.22,1,.36,1)}
.chrome .logo:hover{letter-spacing:.24em}
.chrome .logo span{color:var(--accent)}
.chrome .back{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(237,231,219,.6);text-decoration:none;border-bottom:none;transition:color .35s ease}
.chrome .back:hover{color:var(--onDark)}
.cover-text{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:0 clamp(24px,7vw,120px) clamp(40px,7vh,84px);color:#f4efe6}
.cover-text .eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:rgba(244,239,230,.82);margin-bottom:18px}
.cover-text h1{font-family:var(--serif);font-weight:400;font-size:clamp(46px,9vw,120px);line-height:.96;letter-spacing:-.01em;margin:0}
.cover-text .sub{font-family:var(--serif);font-style:italic;font-size:clamp(18px,2.6vw,30px);color:rgba(244,239,230,.9);margin-top:12px}

/* standfirst + byline */
.byline{max-width:640px;margin:clamp(38px,6vh,64px) auto clamp(8px,3vh,22px);padding:0 24px;display:flex;align-items:center;gap:14px;font-family:var(--mono);font-size:12px;letter-spacing:.05em;color:var(--mutedInk);text-transform:uppercase}
.byline .dot{width:5px;height:5px;border-radius:50%;background:var(--accent)}
.lede{max-width:720px;margin:clamp(18px,4vh,40px) auto clamp(28px,6vh,60px);padding:0 24px}
.lede p{font-family:var(--serif);font-size:clamp(22px,3vw,30px);line-height:1.34;margin:0;color:var(--ink)}

/* chapters — tint + ink come from the hero palette, computed at build time */
.chapter{background:var(--chTint,transparent);padding:1px 0 clamp(28px,5vh,56px)}
.section-head{max-width:640px;margin:clamp(56px,9vh,104px) auto clamp(18px,3vh,28px);padding:0 24px}
.section-head .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
.section-head h2{font-family:var(--serif);font-weight:400;font-size:clamp(32px,5vw,54px);line-height:1;letter-spacing:-.01em;margin:0}
.prose{max-width:640px;margin:0 auto;padding:0 24px}
.prose p{margin:1.15em 0;color:#2b2418}

/* image blocks */
figure{margin:clamp(20px,3.4vh,34px) 0}
.cap{max-width:640px;margin:12px auto 0;padding:0 24px;font-family:var(--serif);font-style:italic;font-size:16px;color:var(--chInk,var(--mutedInk));text-align:center}
.fullwrap{margin-left:0;margin-right:0}
.full{position:relative;left:50%;margin-left:-50vw;width:100vw;max-height:96vh;overflow:hidden}
.full .media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.par-on .full .media{height:124%;top:-12%}
.inset picture{display:block}
.inset .contained{width:auto;max-width:min(1180px,100%);max-height:90vh;margin:0 auto;height:auto;padding:0 clamp(0px,2vw,24px)}
.group .grid{display:grid;gap:clamp(8px,1.4vw,18px);max-width:1180px;margin:0 auto;padding:0 clamp(0px,3vw,40px)}
.pair .grid{grid-template-columns:1fr 1fr}
.triptych .grid{grid-template-columns:1fr 1fr 1fr;gap:clamp(8px,1.2vw,16px)}
.group .cell{position:relative;overflow:hidden;background:#241f1a10}
.group .cell img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@media(max-width:720px){.pair .grid,.triptych .grid{grid-template-columns:1fr}}

blockquote{max-width:680px;margin:clamp(44px,6vh,66px) auto;padding:0 24px;font-family:var(--serif);font-size:clamp(24px,3.4vw,34px);line-height:1.3;text-align:center}
blockquote::before{content:"";display:block;width:34px;height:2px;background:var(--accent);margin:0 auto 26px}

/* end plate */
.end{max-width:640px;margin:clamp(72px,11vh,130px) auto 0;padding:0 24px clamp(60px,10vh,120px);border-top:1px solid var(--line)}
.end .sig{font-family:var(--serif);font-size:22px;margin-top:22px}
.end .foot{font-family:var(--mono);font-size:12px;letter-spacing:.05em;color:var(--muted);text-transform:uppercase;margin-top:18px;line-height:1.9}
.end .foot a{color:var(--muted);border-bottom:none;transition:color .35s ease}
.end .foot a:hover{color:var(--ink)}

/* chapter spine */
.spine{position:fixed;left:18px;top:50%;transform:translateY(-50%);height:min(46vh,420px);z-index:8;display:none}
@media(min-width:980px){.spine{display:block}}
.spine .track{position:relative;width:2px;height:100%;background:rgba(26,21,13,.1)}
.spine .fill{position:absolute;left:0;top:0;width:100%;height:0;background:var(--accent);transform-origin:top}
.spine .tick{position:absolute;left:-3px;width:8px;height:2px;background:rgba(26,21,13,.28);border-bottom:none}
.spine .tick:hover{background:var(--accent)}

.grain{position:fixed;inset:0;pointer-events:none;z-index:9999;mix-blend-mode:soft-light;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:140px 140px}
</style>
</head>
<body>

<header class="cover">
${pictureFor(coverImg, 'cover', { alt: story.cover.alt || '', eager: true, klass: 'media' })}
<div class="chrome">
<a class="logo" href="/">departive<span>.</span></a>
<a class="back" href="/">&larr; departive.com</a>
</div>
<div class="cover-text"><div class="eyebrow">${story.kicker}</div><h1>${story.title}</h1><div class="sub">${story.route}</div></div>
</header>

<div class="byline"><span class="dot"></span> By ${story.byline} &middot; shot on ${gear}</div>
<div class="lede" data-reveal><p>${story.standfirst}</p></div>

${chapters}

<div class="end" data-reveal>
<div class="sig">${end.tally || ''}</div>
<div class="foot">${gearLine}${placeDate ? ' &middot; ' + placeDate : ''}<br>${story.byline} &middot; <a href="/">departive</a></div>
</div>

<nav class="spine" aria-hidden="true"><div class="track"><div class="fill"></div></div></nav>
<div class="grain" aria-hidden="true"></div>

<script>
// Islands: reveals + FULL-image parallax + chapter spine. Self-contained.
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* scroll reveals — same pattern as the rest of the site */
  if (!reduce) {
    document.documentElement.classList.add('reveal-on');
    var els = [].slice.call(document.querySelectorAll('[data-reveal]'));
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){ if (en.isIntersecting){ en.target.classList.add('is-in'); io.unobserve(en.target); } });
      }, { rootMargin:'0px 0px -6% 0px', threshold:0.04 });
      els.forEach(function(e){ io.observe(e); });
    } else { els.forEach(function(e){ e.classList.add('is-in'); }); }
  }

  /* chapter spine — ticks at real chapter offsets, fill tracks scroll */
  var spine = document.querySelector('.spine');
  var track = spine && spine.querySelector('.track');
  var fill = spine && spine.querySelector('.fill');
  var chapters = [].slice.call(document.querySelectorAll('[data-chapter]'));
  function layoutTicks(){
    if (!track) return;
    [].slice.call(track.querySelectorAll('.tick')).forEach(function(t){ t.remove(); });
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    if (docH <= 0) return;
    chapters.forEach(function(ch, i){
      var t = document.createElement('a');
      t.className = 'tick'; t.href = '#' + ch.id; t.tabIndex = -1;
      t.style.top = Math.min(100, (ch.offsetTop / docH) * 100) + '%';
      track.appendChild(t);
    });
  }

  /* parallax on FULL blocks only — content moves at ~0.85x scroll rate */
  var pars = [];
  if (!reduce) {
    document.documentElement.classList.add('par-on');
    pars = [].slice.call(document.querySelectorAll('[data-parallax]')).map(function(fig){
      return { fig: fig, img: fig.querySelector('.media') };
    });
  }
  var ticking = false;
  function frame(){
    ticking = false;
    var vh = window.innerHeight;
    if (fill) {
      var docH = document.documentElement.scrollHeight - vh;
      var p = docH > 0 ? Math.min(1, Math.max(0, window.scrollY / docH)) : 0;
      fill.style.height = (p * 100) + '%';
    }
    for (var i = 0; i < pars.length; i++) {
      var r = pars[i].fig.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) continue;
      var progress = r.top + r.height / 2 - vh / 2;       // px from viewport centre
      var bleed = pars[i].img.offsetHeight - r.height;    // extra height available
      var ty = Math.max(-bleed/2, Math.min(bleed/2, -progress * 0.15));
      pars[i].img.style.transform = 'translate3d(0,' + ty.toFixed(1) + 'px,0)';
    }
  }
  function onScroll(){ if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', function(){ layoutTicks(); onScroll(); }, { passive:true });
  window.addEventListener('load', function(){ layoutTicks(); onScroll(); });
  layoutTicks(); frame();
})();
</script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ main */

(async () => {
  const t0 = Date.now();

  // collect every referenced file (cover + all chapter images)
  const refs = [story.cover.file];
  for (const ch of story.chapters) for (const e of ch.images || []) if (e.file) refs.push(e.file);
  const unique = [...new Set(refs)];

  const imgs = new Map();
  for (const f of unique) imgs.set(f, await processImage(f));

  // gear line: story.json override, else the most common EXIF make+model
  const models = {};
  for (const [, img] of imgs) {
    if (img.exif.model) {
      const m = `${img.exif.make || ''} ${img.exif.model}`.trim();
      models[m] = (models[m] || 0) + 1;
    }
  }
  const exifGear = Object.entries(models).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const gear = story.gear || exifGear || 'unknown gear';
  const gearLine = (story.end && story.end.gearLine) || `All photographs shot on ${gear}`;

  // EXIF capture-date range (for the log; end plate text comes from story.json)
  const dates = [...imgs.values()].map(i => i.exif.date).filter(Boolean).sort();
  if (dates.length) console.log(`EXIF dates: ${dates[0]} → ${dates[dates.length - 1]} (${dates.length}/${unique.length} images)`);
  console.log(`EXIF gear: ${exifGear || 'none found'}${story.gear ? ` (story.json overrides: ${story.gear})` : ''}`);

  // per-chapter palette (hero = first image of the chapter)
  const chromeByChapter = [];
  for (const [i, ch] of story.chapters.entries()) {
    const hero = (ch.images || []).find(e => e.file);
    if (!hero) { chromeByChapter.push({ tint: hex(DEFAULTS.bone), ink: DEFAULTS.mutedInk, fellBack: { tint: true, ink: true } }); continue; }
    const chrome = chapterChrome(await samplePalette(path.join(storyDir, hero.file)));
    chromeByChapter.push(chrome);
    const fb = [chrome.fellBack.tint && 'tint', chrome.fellBack.ink && 'ink'].filter(Boolean).join('+') || 'none';
    console.log(`palette ${ch.number.padEnd(6)} ${ch.title.padEnd(18)} tint ${chrome.tint}  ink ${chrome.ink}  fallback: ${fb}`);
  }

  const html = renderPage({ story, imgs, chromeByChapter, gear, gearLine, coverImg: imgs.get(story.cover.file) });
  const outPath = path.join(storyDir, 'index.html');
  fs.writeFileSync(outPath, html);

  const rendFiles = fs.readdirSync(imgDir);
  const rendBytes = rendFiles.reduce((a, f) => a + fs.statSync(path.join(imgDir, f)).size, 0);
  console.log(`\n${path.relative(process.cwd(), outPath)}  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB html`);
  console.log(`${rendFiles.length} renditions, ${(rendBytes / 1048576).toFixed(2)} MB  ·  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(e => { console.error(e); process.exit(1); });
