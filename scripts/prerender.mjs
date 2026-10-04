#!/usr/bin/env node
// Build step for search engines and link previews, run on a built copy of
// the site (never on site/ itself):
//
// 1. sitemap.xml: every public page of seo.json in every language, with its
//    hreflang alternates and the date of its last change (git).
// 2. prerendered/: the static HTML of every public page in every language
//    (`prerendered/pricing.html`, `prerendered/es/pricing.html`,
//    `prerendered/index.html`, `prerendered/es/index.html`...), rendered by
//    the site itself in headless Chromium. The Termoak server serves them at
//    their paths instead of index.html (see server docs/DEPLOYMENT.md): the
//    HTML has the content, the head tags and the JSON-LD, plus the normal
//    scripts, and app.js takes over without a visible change.
// 3. index.html gets `noindex`: once every public page is prerendered, the
//    plain shell only answers the other paths (sign-in, the app, not found).
//
// Step 1 needs only Node. Steps 2 and 3 need Playwright and its Chromium
// (see scripts/playwright.mjs); without them they are skipped with a
// warning. A page that fails to render is an error (nothing is written).
//
// The pages are rendered at the real origin (seo.json `origin`, e.g.
// https://termoak.com) with every request answered from the directory, so no
// local server is needed and nothing leaves the machine except the API
// calls (/api/...), which go to PRERENDER_API (https://termoak.com by
// default; `none` answers them with placeholders): the pricing and download
// pages show the real plans and versions of the time of the build.
//
// Usage: node scripts/prerender.mjs <dir>
// Environment: PRERENDER_API, SKIP_PRERENDER=1 (sitemap only), and the
// Playwright variables of scripts/playwright.mjs.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, rmSync, renameSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadChromium } from './playwright.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dirArg = process.argv[2];
if (!dirArg) {
  console.error('usage: node scripts/prerender.mjs <built site dir>');
  process.exit(2);
}
const dir = resolve(dirArg);
if (!existsSync(join(dir, 'index.html')) || !existsSync(join(dir, 'seo.json'))) {
  console.error(`error: ${dir} has no index.html or seo.json`);
  process.exit(1);
}
if (realpathSync(dir) === realpathSync(join(repo, 'site'))) {
  console.error('error: run it on a copy of the site (scripts/build.sh), not on site/ itself');
  process.exit(1);
}

const seo = JSON.parse(readFileSync(join(dir, 'seo.json'), 'utf8'));
const origin = seo.origin.replace(/\/$/, '');
const langs = Object.entries(seo.languages).map(([code, l]) => ({ code, prefix: l.prefix || '' }));
const defaultLang = seo.default_language;

/** Path of a page in a language: `/es/pricing`, `/es/`, `/pricing`. */
function pagePath(path, prefix) {
  if (!prefix) return path;
  return path === '/' ? `${prefix}/` : prefix + path;
}

const warn = (msg) => console.warn(`warning: ${msg}`);

// --- 1. sitemap.xml ------------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);

/** Date (YYYY-MM-DD) of the last commit that touched any of these site files. */
function lastChange(files) {
  try {
    const out = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%cs', '--', ...files.map((f) => `site/${f}`)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : today;
  } catch {
    return today;
  }
}

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function sitemap() {
  const urls = [];
  for (const [path, page] of Object.entries(seo.pages)) {
    const alternates = [
      ...langs.map((l) => [l.code, origin + pagePath(path, l.prefix)]),
      ['x-default', origin + pagePath(path, langs.find((l) => l.code === defaultLang).prefix)],
    ];
    for (const l of langs) {
      const files = [...(page.files || []), `locales/${l.code}.json`, 'seo.json'].map((f) => f.replace('{lang}', l.code));
      urls.push([
        '  <url>',
        `    <loc>${xml(origin + pagePath(path, l.prefix))}</loc>`,
        `    <lastmod>${lastChange(files)}</lastmod>`,
        ...(page.priority ? [`    <priority>${xml(page.priority)}</priority>`] : []),
        ...alternates.map(([code, href]) => `    <xhtml:link rel="alternate" hreflang="${xml(code)}" href="${xml(href)}"/>`),
        '  </url>',
      ].join('\n'));
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

writeFileSync(join(dir, 'sitemap.xml'), sitemap());
console.log(`sitemap.xml: ${Object.keys(seo.pages).length * langs.length} URLs`);

// --- 2. Prerendered pages --------------------------------------------------------

if (process.env.SKIP_PRERENDER === '1') {
  warn('SKIP_PRERENDER=1: pages not prerendered');
  process.exit(0);
}
const { browser, reason } = await loadChromium();
if (!browser) {
  warn(`${reason}: pages not prerendered (the site works without them, but search engines get an empty page)`);
  process.exit(0);
}

// The shell, without the head tags that js/seo.js manages (also those of a
// previous run).
const shell = readFileSync(join(dir, 'index.html'), 'utf8')
  .replace(/<(?:meta|link)\b[^>]*\sdata-seo\b[^>]*>\n?/g, '')
  .replace(/<script\b[^>]*\sdata-seo\b[^>]*>[\s\S]*?<\/script>\n?/g, '');
for (const needle of ['<html lang="', '<title>', '<div id="app">', '<div id="toasts"']) {
  if (!shell.includes(needle)) {
    console.error(`error: index.html has no ${needle}`);
    process.exit(1);
  }
}

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** A file of the directory, or null (never outside it). */
function siteFile(name) {
  if (!name || name.split('/').some((p) => !p || p === '.' || p === '..') || name.includes('\\') || name.includes('\0')) return null;
  const full = join(dir, name);
  if (!full.startsWith(dir + sep)) return null;
  try {
    if (!statSync(full).isFile()) return null;
    return { body: readFileSync(full), type: TYPES[extname(full).toLowerCase()] || 'application/octet-stream' };
  } catch {
    return null;
  }
}

/** `/assets/locales.json`, as the server generates it: every translation file. */
function localesIndex() {
  let files = [];
  try {
    files = readdirSync(join(dir, 'locales'));
  } catch {
    /* none */
  }
  const list = [];
  for (const file of files) {
    if (!/^[A-Za-z0-9-]{1,16}\.json$/.test(file)) continue;
    const code = file.slice(0, -5);
    let name = code;
    try {
      name = JSON.parse(readFileSync(join(dir, 'locales', file), 'utf8'))['language.name'] || code;
    } catch {
      /* keep the code */
    }
    list.push({ code, name });
  }
  list.sort((a, b) => (a.code !== 'en') - (b.code !== 'en') || a.code.localeCompare(b.code));
  return JSON.stringify(list);
}

// API answers: from PRERENDER_API, else placeholders.
const apiBase = (process.env.PRERENDER_API || 'https://termoak.com').replace(/\/$/, '');
const apiCache = new Map();
let apiWarned = false;
const STUBS = {
  '/api/v1/info': { name: 'Termoak', registration: 'open', version: null, features: {}, support_email: null },
  '/api/v1/plans': { default: 'free', plans: [] },
};

async function apiAnswer(url) {
  const key = url.pathname + url.search;
  if (apiCache.has(key)) return apiCache.get(key);
  let answer = null;
  if (apiBase !== 'none') {
    try {
      const res = await fetch(apiBase + key, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      answer = { status: res.status, body: await res.text() };
    } catch (e) {
      if (!apiWarned) warn(`${apiBase} did not answer (${e.message}): placeholder API data`);
      apiWarned = true;
    }
  }
  if (!answer) {
    const stub = STUBS[url.pathname];
    answer = stub
      ? { status: 200, body: JSON.stringify(stub) }
      : { status: 404, body: JSON.stringify({ error: { code: 'not_found', message: 'not found' } }) };
  }
  apiCache.set(key, answer);
  return answer;
}

const shellForBrowser = shell.replace(/\{\{VERSION\}\}/g, 'prerender');

async function answer(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (url.origin !== origin) return route.abort();
  const headers = { 'content-security-policy': CSP, 'x-content-type-options': 'nosniff' };
  if (url.pathname.startsWith('/api/')) {
    if (req.method() !== 'GET') return route.fulfill({ status: 405, headers, body: '' });
    const a = await apiAnswer(url);
    return route.fulfill({ status: a.status, headers, contentType: 'application/json', body: a.body });
  }
  if (url.pathname === '/assets/locales.json') {
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: localesIndex() });
  }
  if (url.pathname.startsWith('/assets/')) {
    const f = siteFile(decodeURIComponent(url.pathname.slice('/assets/'.length)));
    if (!f) return route.fulfill({ status: 404, headers, body: '' });
    return route.fulfill({ status: 200, headers, contentType: f.type, body: f.body });
  }
  const root = siteFile(decodeURIComponent(url.pathname.slice(1)));
  if (root && !url.pathname.endsWith('.html') && url.pathname !== '/') {
    return route.fulfill({ status: 200, headers, contentType: root.type, body: root.body });
  }
  // Any page: the shell, which the site renders.
  return route.fulfill({ status: 200, headers, contentType: 'text/html; charset=utf-8', body: shellForBrowser });
}

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Renders one page and returns its HTML. */
async function renderPage(path, lang) {
  const url = origin + pagePath(path, lang.prefix);
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
    // No operating system: the download page shows its generic version.
    userAgent: 'Mozilla/5.0 (compatible; TermoakPrerender/1.0)',
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'platform', { get: () => '' });
    Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
    Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 0 });
  });
  await context.route('**/*', answer);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const text = m.text();
      // The public site alone has no js/ext.js (the web app adds it).
      if (/ext\.js|404 \(\)|status of 404/.test(text)) return;
      errors.push(`console: ${text}`);
    }
  });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction((canonical) => {
      const link = document.querySelector('link[rel="canonical"][data-seo]');
      return link && link.href === canonical
        && document.querySelector('#app [data-page-title]')
        && !document.querySelector('#app .loading');
    }, url, { timeout: 20000 });
    if (page.url() !== url) throw new Error(`redirected to ${page.url()}`);
    const out = await page.evaluate(() => {
      const app = document.getElementById('app');
      // Form state lives in properties: copy it to the attributes.
      for (const el of app.querySelectorAll('input, textarea')) {
        if (el.type === 'checkbox' || el.type === 'radio') el.toggleAttribute('checked', el.checked);
        else if (el.localName === 'textarea') el.textContent = el.value;
        else el.setAttribute('value', el.value);
      }
      for (const o of app.querySelectorAll('option')) o.toggleAttribute('selected', o.selected);
      return {
        app: app.innerHTML,
        head: [...document.head.querySelectorAll('[data-seo]')].map((e) => e.outerHTML),
        title: document.title,
        lang: document.documentElement.lang,
        h1: (app.querySelector('h1') || {}).textContent || '',
      };
    });
    if (out.lang !== lang.code) throw new Error(`rendered in "${out.lang}"`);
    if (!out.h1.trim()) throw new Error('no <h1>');
    if (errors.length) throw new Error(errors.join('; '));
    return shell
      .replace(/<html lang="[^"]*">/, `<html lang="${out.lang}">`)
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeText(out.title)}</title>\n${out.head.join('\n')}`)
      .replace(/<div id="app">[\s\S]*?(?=<div id="toasts")/, `<div id="app" data-prerendered="">${out.app}</div>\n`)
      // The page has its content: no "needs JavaScript" notice.
      .replace(/<noscript>[\s\S]*?<\/noscript>\n?/, '');
  } finally {
    await context.close();
  }
}

const tmp = join(dir, 'prerendered.tmp');
rmSync(tmp, { recursive: true, force: true });
let failed = 0;
try {
  for (const path of Object.keys(seo.pages)) {
    for (const lang of langs) {
      const urlPath = pagePath(path, lang.prefix);
      const rel = urlPath === '/' ? 'index.html' : urlPath.endsWith('/') ? `${urlPath.slice(1)}index.html` : `${urlPath.slice(1)}.html`;
      try {
        const html = await renderPage(path, lang);
        mkdirSync(dirname(join(tmp, rel)), { recursive: true });
        writeFileSync(join(tmp, rel), html);
        console.log(`prerendered ${urlPath} → prerendered/${rel} (${Math.round(html.length / 1024)} KB)`);
      } catch (e) {
        console.error(`error: ${urlPath}: ${e.message}`);
        failed++;
      }
    }
  }
} finally {
  await browser.close();
}
if (failed) {
  rmSync(tmp, { recursive: true, force: true });
  console.error(`error: ${failed} pages failed to prerender`);
  process.exit(1);
}
rmSync(join(dir, 'prerendered'), { recursive: true, force: true });
renameSync(tmp, join(dir, 'prerendered'));

// --- 3. The shell is not indexed -------------------------------------------------

writeFileSync(join(dir, 'index.html'), shell.replace(/(<\/title>\n)/, '$1<meta name="robots" content="noindex" data-seo>\n'));
console.log('index.html: noindex (it only answers the pages that are not prerendered)');
