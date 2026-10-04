// Pricing: cards of the server's plans and frequently asked questions.

import { h, replace } from '../dom.js';
import { icon } from '../icons.js';
import { loadPlans, isLoggedIn, registrationOpen, state } from '../session.js';
import { fmtPrice } from '../format.js';
import { badge, errorState, loadingState } from '../ui.js';
import { t, has, getLanguage } from '../i18n.js';

/** Readable lines with the limits of a plan (empty if it has none). */
export function limitLines(limits = {}) {
  const lines = [];
  if (limits.max_teams != null) lines.push(t('plans.limit.teams', { count: limits.max_teams }));
  if (limits.max_team_members != null) lines.push(t('plans.limit.team_members', { count: limits.max_team_members }));
  if (limits.max_server_sessions != null) lines.push(t('plans.limit.server_sessions', { count: limits.max_server_sessions }));
  return lines;
}

/** Translated text of a plan field (`plans.<id>.name`...), or the server text. */
function planText(plan, field) {
  const key = `plans.${plan.id}.${field}`;
  return has(key) ? t(key) : plan[field] || '';
}

/** Translated feature (`plans.feature.<id>`), or the raw string. */
function featureText(feature) {
  const key = `plans.feature.${feature}`;
  return has(key) ? t(key) : feature;
}

/** Zero in the plan's currency, without decimals ("€0"). */
function zeroPrice(currency = 'EUR') {
  try {
    return new Intl.NumberFormat(getLanguage(), { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(0);
  } catch {
    return `0 ${currency}`;
  }
}

/** Card of a plan (also used in "Plan and billing"). */
export function planCard(plan, { current = false, cta = true } = {}) {
  const price = fmtPrice(plan.price_cents, plan.currency);
  const free = price !== null && Number(plan.price_cents) === 0;
  const soon = !plan.available;
  const limits = limitLines(plan.limits);
  const name = planText(plan, 'name');
  let action = null;
  if (cta) {
    if (current) {
      action = h('span', { class: 'btn btn-block', 'aria-disabled': 'true' }, icon('check', { size: 16 }), t('pricing.cta.current'));
    } else if (soon) {
      action = h('button', { class: 'btn btn-block', type: 'button', disabled: true }, t('common.coming_soon'));
    } else if (isLoggedIn()) {
      action = h('a', { class: ['btn btn-block', plan.highlight ? 'btn-primary' : ''], href: '/app' }, t('common.go_to_app'));
    } else if (registrationOpen()) {
      action = h('a', { class: ['btn btn-block', plan.highlight ? 'btn-primary' : ''], href: '/signup' }, free ? t('pricing.cta.start_free') : t('common.sign_up'));
    } else {
      action = h('a', { class: 'btn btn-block', href: '/login' }, t('common.sign_in'));
    }
  }
  return h('article', { class: ['plan-card', plan.highlight && !soon && 'is-highlight', soon && 'is-soon'], 'aria-label': t('pricing.plan_label', { name }) },
    plan.highlight && !soon ? h('span', { class: 'plan-ribbon' }, badge(t('pricing.recommended'), 'solid')) : null,
    h('div', { class: 'stack-sm' },
      h('div', { class: 'plan-name' }, name,
        soon && price !== null ? badge(t('common.coming_soon'), 'warn') : null,
        current ? badge(t('pricing.current'), 'accent', 'check') : null),
      h('p', { class: 'plan-desc' }, planText(plan, 'description'))),
    h('div', { class: 'plan-price' },
      price === null
        ? h('strong', { class: 'soon' }, t('common.coming_soon'))
        : free
          ? [h('strong', null, zeroPrice(plan.currency)), h('span', null, t('pricing.free_forever'))]
          : [h('strong', null, price), h('span', null, t('pricing.per_month'))]),
    h('ul', { class: 'plan-features' },
      (plan.features || []).map((f) => h('li', null, icon('check', { size: 16 }), h('span', null, featureText(f))))),
    h('div', { class: 'plan-limits' },
      limits.length ? limits.map((l) => h('span', null, l)) : h('span', null, t('plans.limit.none'))),
    action);
}

// Question ids: `pricing.faq.<id>.q` and `pricing.faq.<id>.a`.
const FAQ_IDS = ['free', 'ai_keys', 'pro', 'data', 'self_host'];

/** Frequently asked questions; `items` is a list of `[question, answer]`. */
export function faq(items = FAQ_IDS.map((id) => [t(`pricing.faq.${id}.q`), t(`pricing.faq.${id}.a`)])) {
  return h('div', { class: 'faq' },
    items.map(([q, a]) => h('details', null,
      h('summary', null, h('span', null, q), icon('chevron-down', { size: 18 })),
      h('p', null, a))));
}

export function render() {
  const grid = h('div', null, loadingState(t('pricing.loading')));
  const load = async () => {
    replace(grid, loadingState(t('pricing.loading')));
    try {
      const data = await loadPlans();
      const currentPlan = state.me ? state.me.user.plan : null;
      replace(grid, h('div', { class: 'plans-grid' },
        data.plans.map((p) => planCard(p, { current: currentPlan === p.id }))));
    } catch (e) {
      replace(grid, errorState(e, load));
    }
  };
  load();
  return h('div', null,
    h('section', { class: 'page-hero' },
      h('div', { class: 'container' },
        h('span', { class: 'eyebrow' }, t('pricing.eyebrow')),
        h('h1', { tabindex: '-1', dataset: { pageTitle: '' } }, t('pricing.title')),
        h('p', null, t('pricing.lead')))),
    h('div', { class: 'container' },
      grid,
      h('section', { class: 'faq-wrap', 'aria-labelledby': 'faq-title' },
        h('h2', { id: 'faq-title' }, t('pricing.faq.title')),
        faq())));
}
