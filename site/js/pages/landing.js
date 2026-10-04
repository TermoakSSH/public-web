// Landing: headline, terminal mockup, features, steps and final call to action.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { isLoggedIn, registrationOpen } from '../session.js';
import { avatar } from '../ui.js';
import { t } from '../i18n.js';
import { localePath } from '../seo.js';

/** Main buttons depending on the state (signed in, registration open). */
function ctaButtons({ large = true } = {}) {
  const size = large ? 'btn-lg' : '';
  const primary = isLoggedIn()
    ? h('a', { class: ['btn btn-primary', size], href: '/app' }, t('common.go_to_app'), icon('arrow-right', { size: 17 }))
    : registrationOpen()
      ? h('a', { class: ['btn btn-primary', size], href: '/signup' }, t('landing.cta.sign_up_free'), icon('arrow-right', { size: 17 }))
      : h('a', { class: ['btn btn-primary', size], href: '/login' }, icon('login', { size: 17 }), t('common.sign_in'));
  const secondary = h('a', { class: ['btn btn-outline', size], href: localePath('/download') }, icon('download', { size: 17 }), t('common.download'));
  return [primary, secondary];
}

// --- Terminal mockup (HTML and CSS, no images) ---------------------------------

function prompt(cmd, { host = 'prod-web-01', path = '~' } = {}) {
  return h('div', { class: 't-line' },
    h('span', { class: 't-user' }, `ana@${host}`), h('span', { class: 't-dim' }, ':'),
    h('span', { class: 't-path' }, path), h('span', { class: 't-dim' }, '$ '),
    h('span', null, cmd));
}

function dimLine(...parts) {
  return h('div', { class: 't-line t-dim' }, parts);
}

function terminalMockup() {
  return h('div', { class: 'term-window', 'aria-hidden': 'true' },
    h('div', { class: 'term-bar' },
      h('div', { class: 'term-dots' }, h('span'), h('span'), h('span')),
      h('div', { class: 'term-tabs' },
        h('span', { class: 'term-tab is-active' }, h('span', { class: 'dot dot-live t-ok' }), 'prod-web-01'),
        h('span', { class: 'term-tab' }, h('span', { class: 'dot t-dim' }), 'db-primary'),
        h('span', { class: 'term-tab term-tab-add' }, '+')),
      h('span', { class: 'term-pill' }, icon('server', { size: 12 }), t('landing.mockup.on_server'))),
    h('div', { class: 'term-body' },
      prompt('tail -f /var/log/nginx/access.log'),
      dimLine('10.0.3.14 - - [26/sep 09:14:02] "GET /api/health" ', h('span', { class: 't-ok' }, '200')),
      dimLine('10.0.3.22 - - [26/sep 09:14:05] "POST /api/login" ', h('span', { class: 't-ok' }, '200')),
      dimLine('10.0.7.91 - - [26/sep 09:14:09] "GET /static/app.js" ', h('span', { class: 't-warn' }, '304')),
      h('div', { class: 't-line t-notice' }, icon('wifi-off', { size: 13 }), h('span', null, t('landing.mockup.reconnected'))),
      prompt('sudo systemctl status nginx --no-pager'),
      h('div', { class: 't-line' }, h('span', { class: 't-ok' }, '● '), 'nginx.service - A high performance web server'),
      dimLine('   Active: ', h('span', { class: 't-ok' }, 'active (running)'), ' since Mon 2026-09-21; 5 days ago'),
      dimLine('   Memory: 38.4M   CPU: 2min 11.402s'),
      h('div', { class: 't-ai' },
        h('div', { class: 't-ai-head' }, icon('sparkles', { size: 14 }), h('strong', null, t('landing.mockup.ai_title')), h('span', { class: 't-dim' }, t('landing.mockup.ai_waiting'))),
        h('div', { class: 't-ai-cmd' }, '$ sudo systemctl reload nginx'),
        h('div', { class: 't-ai-actions' }, h('span', { class: 't-btn t-btn-ok' }, t('landing.mockup.approve')), h('span', { class: 't-btn' }, t('landing.mockup.deny')))),
      h('div', { class: 't-line' },
        h('span', { class: 't-user' }, 'ana@prod-web-01'), h('span', { class: 't-dim' }, ':'),
        h('span', { class: 't-path' }, '~'), h('span', { class: 't-dim' }, '$ '),
        h('span', { class: 't-cursor' }))),
    h('div', { class: 'term-status' },
      h('span', null, icon('lock', { size: 12 }), 'ssh ana@prod-web-01'),
      h('span', { class: 'hide-sm' }, icon('clock', { size: 12 }), t('landing.mockup.opened')),
      h('span', { class: 'term-status-end' },
        h('span', { class: 'avatar-stack' }, avatar('Ana Ruiz', 'ana'), avatar('Luis Pérez', 'luis'), avatar('Marta Gil', 'marta')),
        t('landing.mockup.shared_with'))));
}

// --- Features --------------------------------------------------------------

// Evaluated on every render so the texts follow the current language.
function featureList() {
  return [
    {
      icon: 'server',
      key: 'persistent',
      wide: true,
      extra: () => h('div', { class: 'feature-flow' },
        h('span', { class: 'flow-chip' }, icon('laptop', { size: 15 }), t('landing.feature.persistent.laptop')),
        icon('arrow-right', { size: 15, class: 'flow-arrow' }),
        h('span', { class: 'flow-chip' }, icon('phone', { size: 15 }), t('landing.feature.persistent.phone')),
        icon('arrow-right', { size: 15, class: 'flow-arrow' }),
        h('span', { class: 'flow-chip' }, icon('monitor', { size: 15 }), t('landing.feature.persistent.desktop')),
        h('span', { class: 'flow-note' }, t('landing.feature.persistent.note'))),
    },
    { icon: 'share', key: 'sharing' },
    { icon: 'sparkles', key: 'ai' },
    { icon: 'vault', key: 'vault' },
    { icon: 'autocomplete', key: 'autocomplete' },
    {
      icon: 'laptop',
      key: 'apps',
      wide: true,
      extra: () => h('div', { class: 'os-row' },
        [['windows', 'Windows'], ['apple', 'macOS'], ['linux', 'Linux'], ['apple', 'iOS'], ['android', 'Android']].map(([ico, label]) =>
          h('span', { class: 'os-chip' }, icon(ico, { size: 16 }), label))),
    },
    { icon: 'shield-check', key: 'two_factor' },
    { icon: 'package', key: 'source' },
  ];
}

function features() {
  return h('section', { class: 'section-block', id: 'features', 'aria-labelledby': 'features-title' },
    h('div', { class: 'container' },
      h('div', { class: 'section-intro' },
        h('span', { class: 'eyebrow' }, t('landing.features.eyebrow')),
        h('h2', { id: 'features-title' }, t('landing.features.title')),
        h('p', null, t('landing.features.lead'))),
      h('div', { class: 'feature-grid' },
        featureList().map((f) => h('article', { class: ['feature', f.wide && 'feature-wide'] },
          h('span', { class: 'icon-tile' }, icon(f.icon, { size: 21 })),
          h('h3', null, t(`landing.feature.${f.key}.title`)),
          h('p', null, t(`landing.feature.${f.key}.text`)),
          f.extra ? f.extra() : null)))));
}

function steps() {
  const items = [
    ['user-plus', 'account'],
    ['download', 'download'],
    ['terminal', 'connect'],
  ];
  return h('section', { class: 'section-block', 'aria-labelledby': 'steps-title' },
    h('div', { class: 'container' },
      h('div', { class: 'section-intro' },
        h('span', { class: 'eyebrow' }, t('landing.steps.eyebrow')),
        h('h2', { id: 'steps-title' }, t('landing.steps.title'))),
      h('ol', { class: 'steps-grid' },
        items.map(([ico, key], i) => h('li', { class: 'step-card' },
          h('span', { class: 'step-index' }, String(i + 1)),
          h('span', { class: 'icon-tile' }, icon(ico, { size: 20 })),
          h('h3', null, t(`landing.step.${key}.title`)),
          h('p', null, t(`landing.step.${key}.text`)))))));
}

function ctaBand() {
  return h('section', { class: 'section-block' },
    h('div', { class: 'container' },
      h('div', { class: 'cta-band' },
        h('div', null,
          h('h2', null, t('landing.cta.title')),
          h('p', null, t('landing.cta.text'))),
        h('div', { class: 'cta-actions' }, ctaButtons({ large: true })))));
}

export function render() {
  const hero = h('section', { class: 'hero' },
    h('div', { class: 'container hero-grid' },
      h('div', { class: 'hero-copy' },
        h('a', { class: 'eyebrow-pill', href: localePath('/pricing') }, h('span', { class: 'badge badge-solid' }, t('landing.hero.badge')), t('landing.hero.pill'), icon('chevron-right', { size: 15 })),
        h('h1', { class: 'hero-title', tabindex: '-1', dataset: { pageTitle: '' } }, t('landing.hero.title'), ' ', h('span', { class: 'grad' }, t('landing.hero.title_highlight'))),
        h('p', { class: 'hero-lead' }, t('landing.hero.lead')),
        h('div', { class: 'hero-cta' }, ctaButtons()),
        h('ul', { class: 'hero-meta' },
          h('li', null, icon('check', { size: 15 }), t('landing.hero.meta.free')),
          h('li', null, icon('check', { size: 15 }), t('landing.hero.meta.platforms')),
          h('li', null, icon('check', { size: 15 }), t('landing.hero.meta.source')))),
      h('div', { class: 'hero-visual' }, terminalMockup())));
  return h('div', { class: 'landing' }, hero, features(), steps(), ctaBand());
}
