// Legal documents: Terms of Use (/terms), Privacy Policy (/privacy) and
// Legal notice (/legal).
//
// The text of each one is a static file of this site,
// `legal/<lang>/<doc>.html`, in the current language or, if there is none,
// in English. It is parsed with DOMParser (which runs nothing) and rebuilt
// with an allowlist of basic tags and attributes, so the page never inserts
// raw HTML and works under the strict CSP (no inline scripts or styles).

import { h } from '../dom.js';
import { alertBox } from '../ui.js';
import { t, getLanguage } from '../i18n.js';
import { LEGAL_DOCS, LEGAL_VERSION, LEGAL_DATE, legalPath } from '../legal.js';
import { localePath } from '../seo.js';

const SOURCE = 'en';

// Tags kept as they are; anything else not in DROP is replaced by its
// content, and DROP is removed with its content.
const ALLOWED = new Set([
  'h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'br', 'hr',
  'code', 'abbr', 'small', 'blockquote', 'address', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);
const DROP = new Set([
  'script', 'style', 'template', 'noscript', 'iframe', 'frame', 'object', 'embed', 'svg', 'math',
  'link', 'meta', 'base', 'title', 'head', 'form', 'input', 'button', 'select', 'textarea',
  'img', 'picture', 'video', 'audio', 'source', 'canvas',
]);

/**
 * A link target that is safe to keep: same-site path (in the current
 * language: `/privacy` → `/es/privacy`), anchor, http(s) or mailto.
 */
function safeHref(raw) {
  const v = (raw || '').trim();
  if (v.startsWith('#')) return v;
  if (v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\')) return localePath(v);
  try {
    const url = new URL(v);
    if (['https:', 'http:', 'mailto:'].includes(url.protocol)) return url.href;
  } catch {
    /* not an absolute URL */
  }
  return null;
}

/** Copy of the allowed attributes of `src` onto `el`. */
function copyAttrs(src, el) {
  const id = src.getAttribute('id');
  if (id && /^[A-Za-z][\w-]{0,63}$/.test(id)) el.id = id;
  const tag = el.localName;
  if (tag === 'a') {
    const href = safeHref(src.getAttribute('href'));
    if (!href) return;
    el.setAttribute('href', href);
    const url = new URL(href, location.href);
    if (url.protocol === 'mailto:') {
      el.dataset.external = '';
    } else if (url.origin !== location.origin) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  } else if (tag === 'abbr') {
    const title = src.getAttribute('title');
    if (title) el.setAttribute('title', title);
  } else if (tag === 'th') {
    const scope = src.getAttribute('scope');
    if (scope === 'col' || scope === 'row') el.setAttribute('scope', scope);
  }
}

/** Rebuilds the children of a parsed node with the allowed tags only. */
function rebuild(node) {
  const out = [];
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.push(document.createTextNode(child.nodeValue));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.localName;
      if (DROP.has(tag)) continue;
      if (!ALLOWED.has(tag)) {
        out.push(...rebuild(child));
        continue;
      }
      const el = document.createElement(tag);
      copyAttrs(child, el);
      el.append(...rebuild(child));
      out.push(el);
    }
  }
  return out;
}

/** Text of a document in a language, or `null` if there is none. */
async function fetchDoc(file, lang) {
  const res = await fetch(`/assets/legal/${encodeURIComponent(lang)}/${file}.html`, {
    headers: { Accept: 'text/html' },
    credentials: 'omit',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** The document in the current language, its base language or English. */
async function loadDoc(file) {
  const lang = getLanguage();
  const tried = [...new Set([lang, lang.split('-')[0], SOURCE])];
  for (const code of tried) {
    const html = await fetchDoc(file, code);
    if (html !== null) return { html, lang: code };
  }
  throw new Error(`legal/${file}.html is missing`);
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return iso;
  }
}

/** Links between the three documents. */
function docNav(current) {
  return h('nav', { class: 'legal-nav', 'aria-label': t('legal.nav_label') },
    Object.entries(LEGAL_DOCS).map(([id, doc]) => h('a', { href: legalPath(id), 'aria-current': id === current ? 'page' : null }, t(doc.title))));
}

async function renderDoc(id, ctx) {
  const doc = LEGAL_DOCS[id];
  const { html, lang } = await loadDoc(doc.file);
  if (!ctx.alive()) return null;
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const nodes = rebuild(parsed.body);
  let title = nodes.find((n) => n.localName === 'h1');
  if (!title) {
    title = h('h1', null, t(doc.title));
    nodes.unshift(title);
  }
  title.setAttribute('tabindex', '-1');
  title.dataset.pageTitle = '';
  const meta = h('p', { class: 'legal-meta' }, t('legal.meta', { version: LEGAL_VERSION, date: formatDate(LEGAL_DATE) }));
  const fallback = lang !== getLanguage() && lang === SOURCE
    ? h('div', { class: 'legal-fallback' }, alertBox({ kind: 'info', iconName: 'globe', text: t('legal.fallback') }))
    : null;
  const article = h('article', { class: 'legal', lang }, nodes);
  // Version, date and (if any) the language notice, right after the title.
  title.after(meta);
  if (fallback) meta.after(fallback);
  return h('div', { class: 'container container-narrow legal-page' }, docNav(id), article);
}

export const terms = (ctx) => renderDoc('terms', ctx);
export const privacy = (ctx) => renderDoc('privacy', ctx);
export const legal = (ctx) => renderDoc('legal', ctx);
