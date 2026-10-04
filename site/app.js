// Entry point of the Termoak website.
//
// Loads the server information and the translations, starts the router and
// renders each page in its layout. Pages are loaded on demand (dynamic
// import) from js/pages/.
//
// This is the public site (TermoakSSH/public-web): landing, pricing,
// downloads and the legal documents. On termoak.com it is deployed together with the web app
// (sign-in, the signed-in app and the administration, TermoakSSH/web), which
// adds its pages through js/ext.js: see loadExtension().
//
// The public pages (those in seo.json) also exist in Spanish under /es/ and
// may come prerendered from the build (scripts/prerender.mjs): the HTML
// already has the page, and the first render replaces it with an identical
// one without showing a loading screen in between (`hydrating`).

import { h } from './js/dom.js';
import { api, onAuthLost } from './js/api.js';
import { state, loadInfo, loadMe, isLoggedIn, emit, subscribe, onExternalSignOut } from './js/session.js';
import { startRouter, navigate, safeNext, refresh } from './js/router.js';
import { mount, resetLayout } from './js/layout.js';
import { applyTheme } from './js/theme.js';
import { toast, loadingState, emptyState, capitalize } from './js/ui.js';
import { icon } from './js/icons.js';
import { t, errorText, initI18n, addLocaleBundle, setLanguage, onLanguageChange, savedLanguage, matchLanguage, getLanguage } from './js/i18n.js';
import { loadSeo, updateHead, isLocalizedPath, localePath, splitLanguagePath } from './js/seo.js';

applyTheme();

const page = (file, name = 'render') => ({ load: () => import(`./js/pages/${file}`), export: name });

// Routes of the web. `layout`: public | auth | app | bare. `title`: key of
// the page title. The ones listed in seo.json are public pages, with a URL
// per language and their own head tags.
const ROUTES = [
  { path: '/', ...page('landing.js'), layout: 'public', nav: 'home' },
  { path: '/pricing', ...page('pricing.js'), layout: 'public', nav: 'pricing', title: 'title.pricing' },
  { path: '/download', ...page('download.js'), layout: 'public', nav: 'download', title: 'title.download' },
  { path: '/terms', ...page('legal.js', 'terms'), layout: 'public', title: 'title.terms' },
  { path: '/privacy', ...page('legal.js', 'privacy'), layout: 'public', title: 'title.privacy' },
  { path: '/legal', ...page('legal.js', 'legal'), layout: 'public', title: 'title.legal' },
];

// Last route: anything else.
const NOT_FOUND = { path: '*', notFound: true, layout: 'public', title: 'title.not_found' };

function notFound() {
  return h('div', { class: 'container' },
    emptyState({
      iconName: 'search',
      title: t('not_found.title'),
      text: t('not_found.text'),
      action: h('a', { class: 'btn btn-primary', href: isLoggedIn() ? '/app' : '/' }, t('common.back_home')),
    }));
}

// Version of the assets (the `?v=` that index.html puts on them).
function assetVersion() {
  const link = document.querySelector('link[rel="icon"]');
  const m = link && /[?&]v=([^&]+)/.exec(link.getAttribute('href') || '');
  return m ? m[1] : '';
}

function addStylesheet(href) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${href}?v=${encodeURIComponent(assetVersion())}`;
    link.onload = link.onerror = () => resolve();
    document.head.append(link);
  });
}

/**
 * Optional extension: the web app (TermoakSSH/web), deployed on top of this
 * site, provides js/ext.js with its routes (`routes`, in the format of
 * ROUTES), its stylesheets (`styles`) and its translation bundles
 * (`localeBundles`: locales/<bundle>/<lang>.json). Without it, only the
 * public pages exist.
 */
async function loadExtension() {
  let ext;
  try {
    ext = await import('./js/ext.js');
  } catch {
    return null;
  }
  for (const bundle of ext.localeBundles || []) addLocaleBundle(bundle);
  await Promise.all((ext.styles || []).map(addStylesheet));
  return ext;
}

/** The site's routes, the extension's and the catch-all. */
function routeTable(ext) {
  return [...ROUTES, ...((ext && ext.routes) || []), NOT_FOUND]
    .map((r) => (r.notFound ? { ...r, load: async () => ({ render: notFound }) } : r));
}

function forbidden() {
  return emptyState({
    iconName: 'lock',
    title: t('forbidden.title'),
    text: t('forbidden.text'),
    action: h('a', { class: 'btn', href: '/app' }, t('common.back_home')),
  });
}

/** Sets the document title (an already translated text, or none for the default). */
function setTitle(title) {
  document.title = title ? t('title.format', { title }) : t('title.default');
}

// The page came prerendered: until the first page is mounted, keep it on
// screen instead of a loading indicator.
const prerendered = document.getElementById('app').hasAttribute('data-prerendered');
let hydrating = prerendered;

function loginRedirect(ctx) {
  navigate(`/login?next=${encodeURIComponent(ctx.path + ctx.url.search)}`, { replace: true });
}

async function renderRoute(ctx) {
  const r = ctx.route;
  const localized = !r.notFound && isLocalizedPath(r.path);
  // The language of the URL (`/es/...`) wins.
  if (ctx.lang && ctx.lang !== getLanguage()) {
    await setLanguage(ctx.lang, { save: false, quiet: true });
    if (!ctx.alive()) return;
  }
  // Public pages go to the URL of the current language (`/pricing` →
  // `/es/pricing` for someone who reads Spanish); other pages have no
  // language prefix (`/es/login` → `/login`, in Spanish).
  if (!r.notFound) {
    const target = localized ? localePath(ctx.basePath) : ctx.basePath;
    if (target !== ctx.path) {
      navigate(target + ctx.url.search + ctx.url.hash, { replace: true });
      return;
    }
  }
  // Pages only for signed-out visitors (login, sign-up).
  if (r.guest && isLoggedIn()) {
    navigate(safeNext(ctx.query.get('next')), { replace: true });
    return;
  }
  if (r.auth) {
    if (!isLoggedIn()) {
      loginRedirect(ctx);
      return;
    }
    if (!state.me) {
      try {
        await loadMe();
      } catch (e) {
        if (!isLoggedIn()) {
          loginRedirect(ctx);
          return;
        }
        throw e;
      }
    }
    if (!ctx.alive()) return;
  }
  setTitle(r.title ? t(r.title) : null);
  updateHead({ path: localized ? ctx.basePath : null });
  ctx.setTitle = setTitle;
  const opts = { nav: r.nav, full: r.full, userId: state.me ? state.me.user.id : null };
  if (r.admin && !(state.me && state.me.user.is_admin)) {
    mount(r.layout, forbidden(), opts);
    return;
  }
  const mod = await r.load();
  if (!ctx.alive()) return;
  const result = mod[r.export || 'render'](ctx);
  if (result instanceof Promise) {
    // If the page is slow, show an indicator in the meantime.
    const timer = setTimeout(() => {
      if (ctx.alive() && !hydrating) mount(r.layout, loadingState(), opts);
    }, 150);
    const content = await result.finally(() => clearTimeout(timer));
    if (!ctx.alive() || !content) return;
    mount(r.layout, content, opts);
  } else if (result) {
    mount(r.layout, result, opts);
  }
}

function renderError(err, ctx) {
  // Network failures (e.g. leaving the page in the middle of a request) are
  // already explained on screen.
  if (!(err && err.code === 'network')) console.error(err);
  const layout = ctx.route ? ctx.route.layout : 'public';
  mount(layout === 'bare' ? 'auth' : layout, h('div', { class: 'container' },
    emptyState({
      iconName: 'alert',
      title: t('page_error.title'),
      text: capitalize(errorText(err)),
      action: h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, icon('refresh', { size: 15 }), t('common.reload')),
    })), { nav: ctx.route && ctx.route.nav, userId: state.me ? state.me.user.id : null });
}

// The session stopped being valid (refresh token expired or revoked).
onAuthLost(() => {
  const inApp = location.pathname.startsWith('/app');
  const here = location.pathname + location.search;
  state.me = null;
  if (inApp) {
    toast(t('error.session_expired'), 'error');
    resetLayout();
    navigate(`/login?next=${encodeURIComponent(here)}`, { replace: true });
  }
  emit();
});

// Signed out in another tab.
onExternalSignOut(() => {
  if (location.pathname.startsWith('/app')) {
    toast(t('app.signed_out_elsewhere'), 'info');
    resetLayout();
    navigate('/login', { replace: true });
  }
});

// Language changed (picker or account): re-render the page and, if it was
// the person's choice, save it in the account (used for emails).
let routerStarted = false;
onLanguageChange((lang, { save }) => {
  if (save && isLoggedIn()) {
    api.patch('/me', { locale: lang })
      .then(() => {
        if (state.me && state.me.user) state.me.user.locale = lang;
      })
      .catch((e) => console.warn('locale', e));
  }
  if (routerStarted) {
    resetLayout();
    refresh();
  }
});

// Without an explicit choice in this browser, the account's language wins
// (e.g. after signing in), except on a page whose URL has a language.
subscribe(() => {
  const locale = state.me && state.me.user && state.me.user.locale;
  if (!locale || savedLanguage() || splitLanguagePath(location.pathname).lang) return;
  const lang = matchLanguage(locale);
  if (lang && lang !== getLanguage()) setLanguage(lang, { save: false }).catch(() => {});
});

async function boot() {
  const app = document.getElementById('app');
  const [ext] = await Promise.all([loadExtension(), loadSeo(assetVersion())]);
  const urlLang = splitLanguagePath(location.pathname).lang;
  // With a session, the account (and its language) is loaded at the same
  // time as the server information.
  const me = isLoggedIn() && !savedLanguage() && !urlLang ? loadMe().catch(() => null) : Promise.resolve(null);
  try {
    await Promise.all([
      me.then((account) => initI18n(account && account.user ? account.user.locale : null, urlLang)),
      loadInfo(),
    ]);
  } catch (e) {
    // A prerendered page stays readable without the server.
    if (prerendered) {
      console.warn('boot', e);
      return;
    }
    await initI18n(null, urlLang).catch(() => {});
    app.replaceChildren(h('div', { class: 'boot' },
      h('div', { class: 'stack center' },
        h('img', { src: '/assets/icon.svg', alt: '', width: 56, height: 56, class: 'boot-logo' }),
        h('p', null, t('boot.unreachable')),
        h('p', { class: 'muted small' }, capitalize(errorText(e))),
        h('div', null, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, t('common.retry'))))));
    return;
  }
  routerStarted = true;
  startRouter(routeTable(ext), {
    render: async (ctx) => {
      try {
        await renderRoute(ctx);
      } finally {
        // Mounted (or failed): from now on, the usual loading indicator.
        if (ctx.alive()) hydrating = false;
      }
    },
    error: renderError,
  });
}

boot();
