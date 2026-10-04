// Search engines, link previews and language URLs of the public pages.
//
// `seo.json` (one file for the browser and the build) lists the public pages
// with their title and description in each language, the languages that have
// their own URLs (English at `/pricing`, Spanish at `/es/pricing`...), the
// preview image and the structured data (JSON-LD). This module:
// - splits and builds the language URLs (`/es/pricing` ↔ `/pricing` + `es`);
// - fills the `<head>` of every page: title, description, canonical URL,
//   `hreflang` alternates, Open Graph and Twitter tags, JSON-LD, and
//   `noindex` on the pages that are not public (sign-in, app, not found).
//
// Every tag it manages carries `data-seo`, so it can replace them on each
// navigation; scripts/prerender.mjs copies the same tags into the static
// HTML of each page, so both always match.

import { getLanguage } from './i18n.js';

let data = null;

/** Loads `seo.json`. Without it there are no language URLs or head tags. */
export async function loadSeo(version = '') {
  try {
    const res = await fetch(`/assets/seo.json?v=${encodeURIComponent(version)}`, { headers: { Accept: 'application/json' }, credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    console.warn('seo.json', e);
    data = null;
  }
  return data;
}

const defaultLanguage = () => (data && data.default_language) || 'en';

/** URL prefix of a language (`/es`), `''` for the default one, or `null` if it has no URLs. */
function prefixOf(code) {
  if (!data || !code) return code === defaultLanguage() ? '' : null;
  const l = data.languages && data.languages[code];
  return l ? l.prefix || '' : null;
}

/** Languages with their own URLs: `[code, prefix]`. */
function urlLanguages() {
  return data && data.languages ? Object.entries(data.languages).map(([code, l]) => [code, l.prefix || '']) : [];
}

/**
 * Splits the language prefix off a path: `/es/pricing` → `{lang: 'es',
 * path: '/pricing'}`, `/es` → `{lang: 'es', path: '/'}`, `/pricing` →
 * `{lang: null, path: '/pricing'}`.
 */
export function splitLanguagePath(pathname) {
  for (const [code, prefix] of urlLanguages()) {
    if (!prefix) continue;
    if (pathname === prefix || pathname === `${prefix}/`) return { lang: code, path: '/' };
    if (pathname.startsWith(`${prefix}/`)) return { lang: code, path: pathname.slice(prefix.length) };
  }
  return { lang: null, path: pathname };
}

/** Is this (unprefixed) path a public page with a URL per language? */
export function isLocalizedPath(path) {
  return !!(data && data.pages && Object.prototype.hasOwnProperty.call(data.pages, path));
}

/**
 * The URL of a public page in a language (the current one by default):
 * `localePath('/pricing', 'es')` → `/es/pricing`, `localePath('/#features',
 * 'es')` → `/es/#features`. Other paths (and languages without their own
 * URLs) are returned as they are.
 */
export function localePath(href, code = getLanguage()) {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href;
  const cut = href.search(/[?#]/);
  const path = cut < 0 ? href : href.slice(0, cut);
  const rest = cut < 0 ? '' : href.slice(cut);
  const base = splitLanguagePath(path).path;
  if (!isLocalizedPath(base)) return href;
  const prefix = prefixOf(code);
  if (prefix === null) return base + rest;
  return (prefix ? (base === '/' ? `${prefix}/` : prefix + base) : base) + rest;
}

/** A value of seo.json in a language: `{en: ..., es: ...}` objects are picked. */
function pick(value, lang) {
  if (Array.isArray(value)) return value.map((v) => pick(v, lang));
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const langs = data.languages || {};
    if (keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(langs, k))) {
      return pick(value[lang] ?? value[defaultLanguage()], lang);
    }
    return Object.fromEntries(keys.map((k) => [k, pick(value[k], lang)]));
  }
  return value;
}

function absolute(path) {
  return data.origin.replace(/\/$/, '') + path;
}

function tag(name, attrs, text) {
  const el = document.createElement(name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  }
  el.setAttribute('data-seo', '');
  if (text !== undefined) el.textContent = text;
  return el;
}

const meta = (attr, key, content) => tag('meta', { [attr]: key, content });

/** JSON for a `<script>` element (no `</script>` can appear in it). */
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Head tags of a page.
 * - `path`: the page without language prefix (`/pricing`), or `null` for a
 *   page that is not public (sign-in, app, not found): only `noindex` and
 *   the generic description.
 * - `lang`: language of the page (a language without its own URLs gets the
 *   default language's tags).
 *
 * Public pages also get their `document.title`; the others keep the one set
 * by app.js.
 */
export function updateHead({ path = null, lang = getLanguage() } = {}) {
  const head = document.head;
  for (const el of head.querySelectorAll('[data-seo]')) el.remove();
  if (!data) {
    if (!path) head.append(meta('name', 'robots', 'noindex'));
    return;
  }
  const page = path && isLocalizedPath(path) ? data.pages[path] : null;
  const pageLang = data.languages[lang] ? lang : defaultLanguage();
  const tags = [];
  if (!page) {
    tags.push(meta('name', 'robots', 'noindex'));
    tags.push(meta('name', 'description', pick(data.default.description, lang)));
    head.append(...tags);
    return;
  }
  const title = pick(page.title, pageLang);
  const description = pick(page.description, pageLang);
  const url = absolute(localePath(path, pageLang));
  if (pageLang === lang) document.title = title;
  tags.push(meta('name', 'description', description));
  tags.push(tag('link', { rel: 'canonical', href: url }));
  for (const [code] of urlLanguages()) {
    tags.push(tag('link', { rel: 'alternate', hreflang: code, href: absolute(localePath(path, code)) }));
  }
  tags.push(tag('link', { rel: 'alternate', hreflang: 'x-default', href: absolute(localePath(path, defaultLanguage())) }));
  tags.push(meta('property', 'og:type', page.og_type || 'website'));
  tags.push(meta('property', 'og:site_name', data.site_name));
  tags.push(meta('property', 'og:title', title));
  tags.push(meta('property', 'og:description', description));
  tags.push(meta('property', 'og:url', url));
  tags.push(meta('property', 'og:locale', data.languages[pageLang].og_locale));
  for (const [code, l] of Object.entries(data.languages)) {
    if (code !== pageLang) tags.push(meta('property', 'og:locale:alternate', l.og_locale));
  }
  const image = data.image;
  if (image) {
    tags.push(meta('property', 'og:image', absolute(image.path)));
    tags.push(meta('property', 'og:image:type', image.type));
    tags.push(meta('property', 'og:image:width', image.width));
    tags.push(meta('property', 'og:image:height', image.height));
    tags.push(meta('property', 'og:image:alt', pick(image.alt, pageLang)));
  }
  tags.push(meta('name', 'twitter:card', data.twitter_card || 'summary'));
  tags.push(meta('name', 'twitter:title', title));
  tags.push(meta('name', 'twitter:description', description));
  if (image) {
    tags.push(meta('name', 'twitter:image', absolute(image.path)));
    tags.push(meta('name', 'twitter:image:alt', pick(image.alt, pageLang)));
  }
  const graph = (page.structured_data || [])
    .map((id) => data.structured_data && data.structured_data[id])
    .filter(Boolean)
    .map((node) => pick(node, pageLang));
  if (graph.length) {
    tags.push(tag('script', { type: 'application/ld+json' }, scriptJson({ '@context': 'https://schema.org', '@graph': graph })));
  }
  head.append(...tags);
}
