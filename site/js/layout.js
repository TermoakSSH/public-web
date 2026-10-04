// Page layouts: public (header + footer), auth (centered card) and app
// (sidebar). The app layout is reused across routes so the sidebar is not
// re-rendered on every navigation.

import { h, clear, replace } from './dom.js';
import { icon } from './icons.js';
import { state, isLoggedIn, registrationOpen, currentUser, needsVerification, signOut, subscribe, loadMe } from './session.js';
import { navigate } from './router.js';
import { api } from './api.js';
import { avatar, badge, dropdown, toast, toastError, busy, languagePicker } from './ui.js';
import { themeSwitch, getTheme, setTheme } from './theme.js';
import { t, tx, has } from './i18n.js';
import { LEGAL_DOCS, legalPath } from './legal.js';

const root = () => document.getElementById('app');

let current = null; // {type, main, update}

function brand(href = '/') {
  return h('a', { class: 'brand', href, 'aria-label': t('layout.brand_home') },
    h('img', { src: '/assets/icon.svg', alt: '', width: 30, height: 30 }),
    h('span', { class: 'brand-name' }, 'Term', h('span', null, 'oak')));
}

function skipLink() {
  return h('a', { class: 'skip-link', href: '#content', 'data-external': '', onclick: (e) => {
    e.preventDefault();
    const main = document.getElementById('content');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
    }
  } }, t('layout.skip_to_content'));
}

// --- Public layout -----------------------------------------------------------

const publicNav = () => [
  ['/#features', t('nav.features'), 'features'],
  ['/pricing', t('nav.pricing'), 'pricing'],
  ['/download', t('nav.download'), 'download'],
];

function publicHeader(active) {
  const logged = isLoggedIn();
  const open = registrationOpen();
  const nav = publicNav();
  const menuBtn = h('button', { class: 'btn btn-ghost btn-icon nav-toggle', type: 'button', 'aria-label': t('layout.menu_open'), 'aria-expanded': 'false', 'aria-controls': 'mobile-menu' }, icon('menu', { size: 20 }));
  const actions = logged
    ? [h('a', { class: 'btn btn-primary btn-sm', href: '/app' }, t('common.go_to_app'), icon('arrow-right', { size: 15 }))]
    : [
      h('a', { class: ['btn btn-ghost btn-sm', open && 'hide-mobile'], href: '/login' }, t('common.sign_in')),
      open ? h('a', { class: 'btn btn-primary btn-sm', href: '/signup' }, h('span', { class: 'label-long' }, t('layout.sign_up_free')), h('span', { class: 'label-short' }, t('common.sign_up'))) : null,
    ];
  const mobile = h('div', { class: 'mobile-nav', id: 'mobile-menu', hidden: true },
    h('nav', { 'aria-label': t('layout.main_menu') }, nav.map(([href, label]) => h('a', { href }, label))),
    h('div', { class: 'mobile-cta' },
      logged
        ? h('a', { class: 'btn btn-primary btn-block', href: '/app' }, t('common.go_to_app'))
        : [
          h('a', { class: 'btn btn-block', href: '/login' }, t('common.sign_in')),
          open ? h('a', { class: 'btn btn-primary btn-block', href: '/signup' }, t('layout.sign_up_free')) : null,
        ]));
  const toggle = (show) => {
    mobile.hidden = !show;
    menuBtn.setAttribute('aria-expanded', String(show));
    menuBtn.setAttribute('aria-label', show ? t('layout.menu_close') : t('layout.menu_open'));
    replace(menuBtn, icon(show ? 'x' : 'menu', { size: 20 }));
  };
  menuBtn.addEventListener('click', () => toggle(mobile.hidden));
  mobile.addEventListener('click', (e) => {
    if (e.target.closest('a')) toggle(false);
  });
  const header = h('header', { class: 'site-header' },
    h('div', { class: 'container' },
      brand('/'),
      h('nav', { class: 'site-nav', 'aria-label': t('layout.main_nav') },
        nav.map(([href, label, key]) => h('a', { href, 'aria-current': key === active ? 'page' : null }, label))),
      h('div', { class: 'site-actions' }, actions, menuBtn)),
    mobile);
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mobile.hidden) {
      toggle(false);
      menuBtn.focus();
    }
  });
  return header;
}

function publicFooter() {
  const info = state.info || {};
  const support = [];
  if (info.support_email) support.push(h('li', null, h('a', { href: `mailto:${info.support_email}`, 'data-external': '' }, info.support_email)));
  if (!support.length) support.push(h('li', { class: 'faint' }, t('layout.footer.support_disabled')));
  const logged = isLoggedIn();
  return h('footer', { class: 'site-footer' },
    h('div', { class: 'container' },
      h('div', { class: 'footer-grid' },
        h('div', { class: 'footer-about' }, brand('/'), h('p', null, t('layout.footer.tagline'))),
        h('div', null, h('h3', null, t('layout.footer.product')), h('ul', null,
          h('li', null, h('a', { href: '/#features' }, t('nav.features'))),
          h('li', null, h('a', { href: '/pricing' }, t('nav.pricing'))),
          h('li', null, h('a', { href: '/download' }, t('nav.download'))))),
        h('div', null, h('h3', null, t('layout.footer.account')), h('ul', null,
          logged
            ? h('li', null, h('a', { href: '/app' }, t('layout.my_account')))
            : [
              h('li', null, h('a', { href: '/login' }, t('common.sign_in'))),
              registrationOpen() ? h('li', null, h('a', { href: '/signup' }, t('common.sign_up'))) : null,
              h('li', null, h('a', { href: '/forgot-password' }, t('layout.footer.forgot_password'))),
            ])),
        h('div', null, h('h3', null, t('layout.footer.support')), h('ul', null, support)),
        h('div', null, h('h3', null, t('layout.footer.legal')), h('ul', null,
          Object.values(LEGAL_DOCS).map((doc) => h('li', null, h('a', { href: doc.path }, t(doc.title))))))),
      h('div', { class: 'footer-bottom' },
        h('span', null,
          `© ${new Date().getFullYear()} `,
          h('a', { href: 'https://termoak.com', 'data-external': '', rel: 'noopener' }, 'Ohz Digital SL'),
          ` · ${t('layout.footer.version', { version: info.version || '—' })} · `,
          h('a', { href: 'https://github.com/TermoakSSH', 'data-external': '', rel: 'noopener' }, t('layout.footer.github'))),
        h('div', { class: 'footer-controls' }, languagePicker({ small: true }), themeSwitch()))));
}

// --- Auth layout ----------------------------------------------------------

function authShell(content) {
  const info = state.info || {};
  return h('div', { class: 'auth' },
    skipLink(),
    h('div', { class: 'auth-top' }, brand('/'), h('a', { class: 'btn btn-ghost btn-sm', href: '/' }, icon('arrow-left', { size: 15 }), t('common.back'))),
    h('main', { class: 'auth-main', id: 'content' }, content),
    h('div', { class: 'auth-bottom' },
      `Termoak ${info.version || ''}`,
      // New tab: these pages often have a half-filled form.
      ' · ', h('a', { href: legalPath('terms'), target: '_blank', rel: 'noopener' }, t('layout.auth.terms')),
      ' · ', h('a', { href: legalPath('privacy'), target: '_blank', rel: 'noopener' }, t('layout.footer.privacy')),
      ' · ', languagePicker({ small: true })));
}

// --- App layout -----------------------------------------------------------

const appNav = () => [
  ['/app', t('nav.home'), 'home', 'home'],
  ['/app/sessions', t('nav.sessions'), 'terminal', 'sessions'],
  ['/app/teams', t('nav.teams'), 'users', 'teams'],
  ['/app/account', t('nav.account'), 'user', 'account'],
];

// Name of the account's plan (`plans.<id>.name`, else the server's name).
function planName() {
  const plan = state.me && state.me.plan;
  if (!plan) return t('plans.free.name');
  return has(`plans.${plan.id}.name`) ? t(`plans.${plan.id}.name`) : plan.name || plan.id;
}

function userMenu(placement) {
  const u = currentUser() || {};
  const trigger = placement === 'up'
    ? h('button', { class: 'user-button', type: 'button' },
      avatar(u.name, u.email),
      h('span', { class: 'user-button-text' },
        h('span', { class: 'user-button-name' }, u.name || u.email || t('layout.your_account')),
        h('span', { class: 'user-button-sub' }, badge(planName(), 'accent'), h('span', null, u.email || ''))),
      icon('chevron-up-down', { size: 16 }))
    : h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': t('layout.account_menu') }, avatar(u.name, u.email, 'sm'));
  return dropdown({
    button: trigger,
    placement,
    items: () => [
      { header: u.email || '' },
      { label: t('layout.my_account'), icon: 'user', href: '/app/account' },
      { label: t('layout.menu.security'), icon: 'shield', href: '/app/account/security' },
      { label: t('layout.menu.ai'), icon: 'sparkles', href: '/app/account/ai' },
      { label: t('layout.menu.plan'), icon: 'card', href: '/app/account/plan' },
      { label: t('layout.download_apps'), icon: 'download', href: '/download' },
      { separator: true },
      { header: t('theme.title') },
      ...[['system', t('theme.system'), 'monitor'], ['dark', t('theme.dark'), 'moon'], ['light', t('theme.light'), 'sun']].map(([value, label, ico]) => ({
        label: getTheme() === value ? `${label} ✓` : label,
        icon: ico,
        onClick: () => setTheme(value),
      })),
      { separator: true },
      { label: t('common.sign_out'), icon: 'logout', danger: true, onClick: logout },
    ],
  });
}

export async function logout() {
  await signOut();
  toast(t('layout.signed_out'), 'success');
  navigate('/login');
}

function verifyBanner() {
  const u = currentUser();
  const btn = h('button', { class: 'btn btn-sm', type: 'button' }, icon('send', { size: 15 }), t('layout.verify.resend'));
  btn.addEventListener('click', () => busy(btn, async () => {
    try {
      const r = await api.post('/me/verify-email');
      toast(t('layout.verify.sent', { email: r.email }), 'success');
    } catch (e) {
      toastError(e);
    }
  }));
  return h('div', { class: 'app-banner', role: 'region', 'aria-label': t('layout.verify.title') },
    h('div', { class: 'app-banner-inner' },
      icon('mail', { size: 19 }),
      h('div', { class: 'grow' },
        h('strong', null, t('layout.verify.title')), ' ',
        tx('layout.verify.text', { email: h('strong', null, u ? u.email : '') })),
      btn));
}

function appShell() {
  const u = currentUser() || {};
  const main = h('div', { class: 'app-content', id: 'content' });
  const banner = h('div');
  const navLinks = appNav().map(([href, label, ico, key]) => h('a', { class: 'side-link', href, dataset: { nav: key } }, icon(ico, { size: 18 }), label));
  const adminLinks = u.is_admin
    ? [h('div', { class: 'side-nav-label' }, t('layout.server')), h('a', { class: 'side-link', href: '/app/admin', dataset: { nav: 'admin' } }, icon('shield-check', { size: 18 }), t('nav.admin'))]
    : [];
  const closeBtn = h('button', { class: 'btn btn-ghost btn-icon btn-sm sidebar-close', type: 'button', 'aria-label': t('layout.menu_close') }, icon('x'));
  // The user menus are re-rendered when the name or plan changes.
  const userSlot = h('div', null, userMenu('up'));
  const userSlotTop = h('div', { class: 'app-topbar-end' }, userMenu('down'));
  const sidebar = h('aside', { class: 'sidebar', id: 'sidebar', 'aria-label': t('layout.app_nav') },
    h('div', { class: 'sidebar-brand' }, brand('/app'), closeBtn),
    h('nav', { class: 'side-nav', 'aria-label': t('layout.app_nav_short') }, navLinks, adminLinks),
    h('div', { class: 'sidebar-spacer' }),
    h('div', { class: 'sidebar-promo' },
      h('strong', null, t('layout.promo.title')),
      h('span', null, t('layout.promo.text')),
      h('a', { class: 'btn btn-outline btn-sm', href: '/download' }, icon('download', { size: 15 }), t('layout.download_apps'))),
    userSlot);
  const menuBtn = h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': t('layout.menu_open'), 'aria-controls': 'sidebar', 'aria-expanded': 'false' }, icon('menu', { size: 20 }));
  const topbar = h('div', { class: 'app-topbar' }, menuBtn, brand('/app'), userSlotTop);
  const scrim = h('div', { class: 'scrim' });
  const shell = h('div', { class: 'app' }, skipLink(), sidebar, scrim, h('div', { class: 'app-main' }, topbar, banner, main));

  const setOpen = (open) => {
    shell.classList.toggle('nav-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) closeBtn.focus();
  };
  menuBtn.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));
  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  shell.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shell.classList.contains('nav-open')) {
      setOpen(false);
      menuBtn.focus();
    }
  });

  let userKey = '';
  const updateBanner = () => {
    replace(banner, needsVerification() ? verifyBanner() : null);
    const me = currentUser() || {};
    const key = `${me.name}|${me.email}|${planName()}`;
    if (userKey && key !== userKey) {
      replace(userSlot, userMenu('up'));
      replace(userSlotTop, userMenu('down'));
    }
    userKey = key;
  };
  updateBanner();
  const unsub = subscribe(updateBanner);

  // When coming back to the tab, check again if the email is still unverified.
  const onFocus = () => {
    if (needsVerification()) loadMe().catch(() => {});
  };
  window.addEventListener('focus', onFocus);

  return {
    el: shell,
    main,
    setActive(key) {
      for (const a of sidebar.querySelectorAll('.side-link')) {
        a.setAttribute('aria-current', a.dataset.nav === key ? 'page' : 'false');
        if (a.dataset.nav !== key) a.removeAttribute('aria-current');
      }
    },
    destroy() {
      unsub();
      window.removeEventListener('focus', onFocus);
    },
  };
}

/**
 * Mounts the content of a page in its layout.
 * - `type`: `public`, `auth`, `app` or `bare`.
 * - `nav`: key of the active link.
 * - `full`: in the app, full-width content (terminal).
 */
export function mount(type, content, { nav, full = false, userId } = {}) {
  const app = root();
  if (type === 'app') {
    // The sidebar is reused if the user is the same.
    if (!current || current.type !== 'app' || current.userId !== userId) {
      if (current && current.destroy) current.destroy();
      const shell = appShell();
      current = { type: 'app', userId, ...shell };
      replace(app, shell.el);
    }
    current.setActive(nav);
    current.main.classList.toggle('app-content-full', full);
    replace(current.main, content);
  } else {
    if (current && current.destroy) current.destroy();
    current = { type };
    if (type === 'public') {
      replace(app, h('div', { class: 'site' }, skipLink(), publicHeader(nav), h('main', { class: 'site-main', id: 'content' }, content), publicFooter()));
    } else if (type === 'auth') {
      replace(app, authShell(content));
    } else {
      replace(app, content);
    }
  }
  // Focus the page title for screen readers (only when navigating, not on
  // the first load).
  if (mounted) {
    const title = app.querySelector('[data-page-title]');
    if (title) title.focus({ preventScroll: true });
  }
  mounted = true;
}

let mounted = false;

/** Forces the layout to be rebuilt next time (e.g. after switching user or language). */
export function resetLayout() {
  if (current && current.destroy) current.destroy();
  current = null;
  clear(root());
}
