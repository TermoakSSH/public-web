// Formatting in the current language: relative dates, sizes, prices, roles,
// audit actions and detection of the visitor's system.

import { t, has, getLanguage } from './i18n.js';

// Intl formatters, rebuilt when the language changes.
const formatters = new Map();
function formatter(kind, make) {
  const key = `${kind}|${getLanguage()}`;
  if (!formatters.has(key)) formatters.set(key, make(getLanguage()));
  return formatters.get(key);
}
const rtf = () => formatter('rel', (l) => new Intl.RelativeTimeFormat(l, { numeric: 'auto' }));
const dtf = () => formatter('datetime', (l) => new Intl.DateTimeFormat(l, { dateStyle: 'medium', timeStyle: 'short' }));
const dateOnly = () => formatter('date', (l) => new Intl.DateTimeFormat(l, { dateStyle: 'long' }));

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "5 minutes ago", "yesterday", "in 3 days"... (`ms` in milliseconds). */
export function relTime(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '—';
  const diff = (Number(ms) - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return diff <= 0 ? t('time.just_now') : t('time.in_a_moment');
  for (const [unit, secs] of UNITS) {
    if (abs >= secs || unit === 'minute') {
      return rtf().format(Math.round(diff / secs), unit);
    }
  }
  return '—';
}

/** Full date and time. */
export function absTime(ms) {
  if (!ms) return '—';
  return dtf().format(new Date(Number(ms)));
}

/** Date only ("March 3, 2026"). */
export function longDate(ms) {
  if (!ms) return '—';
  return dateOnly().format(new Date(Number(ms)));
}

/** Readable duration between two instants. */
export function duration(fromMs, toMs = Date.now()) {
  const secs = Math.max(0, Math.round((toMs - fromMs) / 1000));
  if (secs < 60) return t('duration.seconds', { s: secs });
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t('duration.minutes', { m: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('duration.hours', { h: hours, m: mins % 60 });
  const days = Math.floor(hours / 24);
  return t('duration.days', { d: days, h: hours % 24 });
}

/** Readable size ("84.3 MB"). */
export function fmtSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toLocaleString(getLanguage(), { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`;
}

/** Monthly price: "Free", "€9.99" or `null` when there is no price yet. */
export function fmtPrice(cents, currency = 'EUR') {
  if (cents === null || cents === undefined) return null;
  if (Number(cents) === 0) return t('price.free');
  try {
    return new Intl.NumberFormat(getLanguage(), { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** Amount in US dollars with cents ("$1.25"), e.g. AI credit. */
export function fmtUsd(amount) {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(getLanguage(), { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} USD`;
  }
}

export const ROLE_RANK = { member: 1, admin: 2, owner: 3 };

/** Team role: owner, admin or member. */
export function roleLabel(role) {
  if (role && has(`role.${role}`)) return t(`role.${role}`);
  return role || '—';
}

/** Permission on a shared session: view, control or owner. */
export function permissionLabel(p) {
  return p && has(`permission.${p}`) ? t(`permission.${p}`) : p;
}

/** State of a server session (`state` of SessionView or `status` of SessionInfo). */
export function sessionStateInfo(state) {
  const key = typeof state === 'string' ? state : state && state.state;
  const kinds = { running: 'accent', connecting: 'info', host_offline: 'warn', failed: 'danger', closed: '' };
  if (key && key in kinds) {
    return { label: t(`session_state.${key}`), kind: kinds[key], live: key === 'running' };
  }
  return { label: key || t('session_state.unknown'), kind: '' };
}

/** Readable name of a device platform. */
export function platformLabel(p) {
  const names = {
    'desktop-windows': 'Windows',
    'desktop-macos': 'macOS',
    'desktop-linux': 'Linux',
    ios: 'iOS',
    android: 'Android',
  };
  if (names[p]) return names[p];
  if (p === 'web') return t('platform.web');
  if (p === 'cli') return t('platform.cli');
  return p || t('platform.unknown');
}

/** Icon of a device platform. */
export function platformIcon(p) {
  if (!p) return 'monitor';
  if (p === 'web') return 'globe';
  if (p === 'ios' || p === 'android') return 'phone';
  if (p === 'cli') return 'terminal';
  return 'laptop';
}

/** Readable name of an audit action (`audit.action.<action>`). */
export function actionLabel(action) {
  if (action && has(`audit.action.${action}`)) return t(`audit.action.${action}`);
  const [group, rest] = String(action || '').split('.');
  if (rest && has(`audit.group.${group}`)) return `${t(`audit.group.${group}`)}: ${rest.replace(/_/g, ' ')}`;
  return action || '—';
}

/** Visitor's operating system: `windows`, `macos`, `linux`, `ios`, `android` or `other`. */
export function detectOS() {
  const uaData = navigator.userAgentData;
  const platform = ((uaData && uaData.platform) || navigator.platform || '').toLowerCase();
  const ua = (navigator.userAgent || '').toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua) || (platform === 'macintel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (platform.startsWith('win') || /windows/.test(ua)) return 'windows';
  if (platform.startsWith('mac') || /mac os x/.test(ua)) return 'macos';
  if (platform.includes('linux') || /linux|x11/.test(ua)) return 'linux';
  return 'other';
}

const OS_NAMES = { windows: 'Windows', macos: 'macOS', linux: 'Linux', ios: 'iOS', android: 'Android' };

/** Name of an operating system (`any`: any system; `other`: "your system"). */
export function osLabel(os) {
  if (OS_NAMES[os]) return OS_NAMES[os];
  if (os === 'any') return t('os.any');
  return t('os.other');
}

/** Name of this device for the server ("Web · Chrome on macOS"). */
export function deviceName() {
  const ua = navigator.userAgent || '';
  let browser = t('platform.web');
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  const os = OS_NAMES[detectOS()] || 'web';
  return t('device.web_name', { browser, os });
}

/** Greeting depending on the time of day. */
export function greeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return t('greeting.morning');
  if (hour >= 14 && hour < 21) return t('greeting.afternoon');
  return t('greeting.evening');
}

/** Initials for the avatar. */
export function initials(name, email) {
  const base = (name || '').trim() || (email || '').split('@')[0] || '?';
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/** Stable hue (1-6) from a text, to color avatars. */
export function hue(text) {
  let n = 0;
  for (const ch of String(text || '')) n = (n * 31 + ch.codePointAt(0)) >>> 0;
  return (n % 6) + 1;
}

/** Shortens a long id for display ("3f2a…"). */
export function shortId(id) {
  const s = String(id || '');
  return s.length > 12 ? `${s.slice(0, 8)}…` : s;
}
