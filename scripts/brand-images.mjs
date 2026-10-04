#!/usr/bin/env node
// Generates the site's icons and link preview image from site/icon.svg with
// headless Chromium (Playwright), and writes them into site/:
//
//   favicon.svg                 copy of icon.svg
//   favicon.ico                 16, 32 and 48 px (PNG inside ICO)
//   apple-touch-icon.png        180 px, full-bleed background (iOS rounds it)
//   icons/icon-192.png, icons/icon-512.png
//   icons/icon-maskable-512.png full-bleed, logo inside the safe zone
//   og-image.png                1200x630 link preview (Open Graph, Twitter)
//
// The results are committed: run it again only when the logo changes.
// Needs Playwright (`playwright` or `playwright-core`, or PLAYWRIGHT_MODULE
// pointing to its folder) with its Chromium; see scripts/prerender.mjs.
//
// Usage: node scripts/brand-images.mjs

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChromium } from './playwright.mjs';

const site = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const svg = readFileSync(join(site, 'icon.svg'), 'utf8');

// The logo without the rounded tile margin: full-bleed background with the
// drawing scaled around the center (`scale` < 1 keeps it in a safe zone).
function fullBleed(scale) {
  const inner = svg
    .replace(/^[\s\S]*?<\/defs>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<rect [^>]*\/>/, '');
  const defs = /<defs>[\s\S]*?<\/defs>/.exec(svg)[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}`
    + '<rect width="512" height="512" fill="url(#bg)"/>'
    + `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${inner}</g></svg>`;
}

const dataUrl = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    font-family: "Inter", "Segoe UI", "Noto Sans", "DejaVu Sans", "Liberation Sans", Arial, sans-serif;
    background: #0e140d;
    color: #e8efe4; display: flex; align-items: center; padding: 0 88px; gap: 64px; overflow: hidden;
  }
  .logo { width: 260px; height: 260px; flex: none; filter: drop-shadow(0 24px 48px rgba(0,0,0,.45)); }
  .text { display: flex; flex-direction: column; gap: 22px; }
  .name { font-size: 104px; font-weight: 800; letter-spacing: -3px; line-height: 1; }
  .name span { color: #9fd36b; }
  .tag { font-size: 44px; font-weight: 700; line-height: 1.15; letter-spacing: -0.5px; max-width: 720px; }
  .tag span { background: linear-gradient(100deg, #9fd36b 0%, #6fbf3b 55%, #c6e39a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .meta { font-size: 27px; color: #bcc7b6; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: linear-gradient(90deg, #6fbf3b, #9fd36b, #c6e39a); }
</style></head><body>
  <img class="logo" src="${dataUrl(svg)}" alt="">
  <div class="text">
    <div class="name">Term<span>oak</span></div>
    <div class="tag">The SSH client whose <span>sessions never drop</span></div>
    <div class="meta">Windows · macOS · Linux · iOS · Android<br>Free and open source</div>
  </div>
  <div class="bar"></div>
</body></html>`;

/** PNG files inside an ICO container. */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const { browser } = await loadChromium({ required: true });
try {
  const page = await browser.newPage();
  const render = async (source, size) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent"><img src="${dataUrl(source)}" width="${size}" height="${size}" style="display:block"></body></html>`);
    await page.waitForFunction(() => document.images[0].complete);
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  mkdirSync(join(site, 'icons'), { recursive: true });
  copyFileSync(join(site, 'icon.svg'), join(site, 'favicon.svg'));
  const sizes = [16, 32, 48];
  const pngs = [];
  for (const size of sizes) pngs.push({ size, data: await render(svg, size) });
  writeFileSync(join(site, 'favicon.ico'), ico(pngs));
  writeFileSync(join(site, 'apple-touch-icon.png'), await render(fullBleed(0.92), 180));
  writeFileSync(join(site, 'icons/icon-192.png'), await render(svg, 192));
  writeFileSync(join(site, 'icons/icon-512.png'), await render(svg, 512));
  writeFileSync(join(site, 'icons/icon-maskable-512.png'), await render(fullBleed(0.76), 512));
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml);
  await page.waitForFunction(() => document.images[0].complete);
  writeFileSync(join(site, 'og-image.png'), await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }));
  console.log('Brand images written to site/');
} finally {
  await browser.close();
}
