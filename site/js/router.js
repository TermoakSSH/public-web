// Router based on the History API.
//
// Each route declares its pattern (`/app/teams/:id`), how to load its page
// (dynamic import), the layout it uses and whether it requires a session.
// Internal links are intercepted so the page doesn't reload; since the
// server returns index.html on those routes, reloading works too.
//
// Public pages also exist under a language prefix (`/es/pricing`, see
// seo.js): the prefix is split off before matching, and the page gets the
// language in `ctx.lang` (`null` without a prefix) and the path without it
// in `ctx.basePath`.

import { splitLanguagePath } from './seo.js';

let routes = [];
let hooks = {};
let renderSeq = 0;
let cleanups = [];

/** Turns `/app/teams/:id` into a regular expression with names. */
function compile(pattern) {
  const names = [];
  const re = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\/:(\w+)(\\\?)?/g, (_, name, optional) => {
      names.push(name);
      return optional ? '(?:/([^/]+))?' : '/([^/]+)';
    })
    .replace(/\*$/, '.*');
  return { regex: new RegExp(`^${re}/?$`), names };
}

/**
 * Finds the route for a URL path: `{route, params, lang, path}`, where `lang`
 * is the language of the URL prefix (or `null`) and `path` the path without
 * it.
 */
export function match(pathname) {
  const { lang, path } = splitLanguagePath(pathname);
  for (const r of routes) {
    const m = r.compiled.regex.exec(path);
    if (m) {
      const params = {};
      r.compiled.names.forEach((n, i) => {
        if (m[i + 1] !== undefined) params[n] = decodeURIComponent(m[i + 1]);
      });
      return { route: r, params, lang, path };
    }
  }
  return null;
}

/**
 * Validates a `?next=` target: same-origin paths only (never
 * `//other.domain`, `javascript:` or absolute URLs).
 */
export function safeNext(raw, fallback = '/app') {
  if (!raw || typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  try {
    const url = new URL(raw, location.origin);
    if (url.origin !== location.origin) return fallback;
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/')) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/**
 * Navigates to another route of the web. `render: false` only changes the
 * URL (the caller renders, e.g. through a language change).
 */
export function navigate(to, { replace = false, render: draw = true } = {}) {
  const url = new URL(to, location.origin);
  if (url.origin !== location.origin) {
    location.href = to;
    return;
  }
  const target = url.pathname + url.search + url.hash;
  if (replace) history.replaceState(null, '', target);
  else history.pushState(null, '', target);
  if (draw) render();
}

/** Removes parameters from the current URL without reloading (e.g. `token`). */
export function stripQuery(...names) {
  const url = new URL(location.href);
  let changed = false;
  for (const n of names) {
    if (url.searchParams.has(n)) {
      url.searchParams.delete(n);
      changed = true;
    }
  }
  if (changed) history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

/** Renders the current route again. */
export function refresh() {
  render();
}

function runCleanups() {
  const list = cleanups;
  cleanups = [];
  for (const fn of list) {
    try {
      fn();
    } catch (e) {
      console.warn('page cleanup', e);
    }
  }
}

// Is this link handled by the router?
function isInternal(a) {
  if (!a || !a.href) return false;
  if (a.target && a.target !== '_self') return false;
  if (a.hasAttribute('download') || a.dataset.external !== undefined) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/updates/')) return false;
  // Link to an anchor on the same page: default behavior.
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return false;
  return !!match(url.pathname);
}

// The first render keeps the scroll position (the page may have been
// prerendered and scrolled before the script ran).
let firstRender = true;

async function render() {
  const seq = ++renderSeq;
  runCleanups();
  const url = new URL(location.href);
  const found = match(url.pathname) || matchNotFound(url.pathname);
  const ctx = {
    path: url.pathname,
    basePath: found ? found.path : url.pathname,
    lang: found ? found.lang : null,
    url,
    query: url.searchParams,
    params: found ? found.params : {},
    route: found ? found.route : null,
    /** Is this still the visible page? (for late responses) */
    alive: () => seq === renderSeq,
    onCleanup: (fn) => cleanups.push(fn),
  };
  try {
    await hooks.render(ctx);
  } catch (e) {
    if (seq === renderSeq && hooks.error) hooks.error(e, ctx);
    else console.error(e);
  }
  if (seq !== renderSeq) return;
  const first = firstRender;
  firstRender = false;
  // Anchor (`/#features`) or the top of the page.
  if (url.hash) {
    const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (el) {
      el.scrollIntoView();
      return;
    }
  }
  if (!first) window.scrollTo(0, 0);
}

/** The catch-all route (`*`), keeping the language of the URL. */
function matchNotFound(pathname) {
  const found = match('*');
  if (!found) return null;
  const { lang, path } = splitLanguagePath(pathname);
  return { ...found, lang, path };
}

/**
 * Starts the router.
 * - `table`: list of routes `{path, load, layout, auth, admin, nav, title}`.
 * - `render(ctx)`: renders the route (app.js does it with the right layout).
 * - `error(err, ctx)`: renders an error if loading the page fails.
 */
export function startRouter(table, callbacks) {
  routes = table.map((r) => ({ ...r, compiled: compile(r.path) }));
  hooks = callbacks;
  window.addEventListener('popstate', () => render());
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a');
    if (!isInternal(a)) return;
    e.preventDefault();
    const url = new URL(a.href, location.href);
    const same = url.pathname + url.search === location.pathname + location.search && !url.hash;
    navigate(url.pathname + url.search + url.hash, { replace: same });
  });
  render();
}
