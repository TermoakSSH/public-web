// Downloads: detects the visitor's system, highlights its app and lists the
// rest (desktop apps, server and CLI). Desktop, server and CLI are released
// separately, each with its own version. If the server does not publish
// releases (404), it says so and shows the address to connect the app to.

import { h, replace } from '../dom.js';
import { icon } from '../icons.js';
import { api } from '../api.js';
import { detectOS, fmtSize, osLabel } from '../format.js';
import { alertBox, badge, copyField, errorState, loadingState } from '../ui.js';
import { t } from '../i18n.js';

const DESKTOP = ['windows', 'macos', 'linux'];
const OS_ICON = { windows: 'windows', macos: 'apple', linux: 'linux', any: 'package' };
// Preferred installer extension of each system.
const PREFERRED = { windows: /\.exe$/i, macos: /\.dmg$/i, linux: /\.appimage$/i };

function archLabel(name, short = false) {
  const n = name.toLowerCase();
  if (n.includes('universal')) return short ? 'Universal' : t('download.arch.universal');
  if (/aarch64|arm64/.test(n)) return 'ARM64';
  if (/x86_64|amd64|x64/.test(n)) return 'x86_64';
  return '';
}

function formatLabel(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.exe')) return t('download.format.installer', { ext: '.exe' });
  if (n.endsWith('.msi')) return t('download.format.installer', { ext: '.msi' });
  if (n.endsWith('.dmg')) return t('download.format.image', { ext: '.dmg' });
  if (n.endsWith('.appimage')) return 'AppImage';
  if (n.endsWith('.apk')) return 'APK';
  if (n.endsWith('.deb')) return t('download.format.package', { ext: '.deb' });
  if (n.endsWith('.rpm')) return t('download.format.package', { ext: '.rpm' });
  if (n.endsWith('.tar.gz') || n.endsWith('.tgz')) return t('download.format.archive', { ext: '.tar.gz' });
  if (n.endsWith('.zip')) return t('download.format.archive', { ext: '.zip' });
  return t('download.format.file');
}

/** Main installer of a system (or the first one there is). */
function primaryFile(files, os) {
  const apps = files.filter((f) => f.os === os && f.kind === 'app');
  return apps.find((f) => PREFERRED[os] && PREFERRED[os].test(f.name)) || apps[0] || null;
}

/** What a server or CLI binary is. */
function toolLabel(f) {
  if (f.kind === 'cli') return 'CLI';
  // Old releases (termoak-vX.Y.Z-…) shipped the server and the CLI together.
  return /^termoak-v\d/i.test(f.name) ? t('download.tool.server_cli') : t('download.tool.server');
}

function fileRow(f) {
  const arch = archLabel(f.name, true);
  const os = f.os && f.os !== 'any' ? osLabel(f.os) : null;
  const tool = f.kind === 'server' || f.kind === 'cli';
  const title = tool ? [toolLabel(f), os, arch].filter(Boolean).join(' · ') : [formatLabel(f.name), arch].filter(Boolean).join(' · ');
  return h('li', { class: 'file-row' },
    icon(f.kind === 'server' ? 'server' : f.kind === 'cli' ? 'terminal' : 'package', { size: 16, class: 'faint' }),
    h('div', { class: 'file-info' },
      h('span', { class: 'file-title' }, title),
      h('span', { class: 'file-name', title: f.name }, f.name)),
    h('span', { class: 'file-size' }, fmtSize(f.size)),
    h('a', { class: 'btn btn-sm btn-icon', href: f.url, 'data-external': '', 'aria-label': t('download.file_aria', { name: f.name }), title: t('common.download') }, icon('download', { size: 16 })));
}

/** Published Android APK, if any. */
function androidApk(files) {
  return files.find((f) => f.os === 'android' && /\.apk$/i.test(f.name)) || null;
}

/** Published iOS IPA, if any. */
function iosIpa(files) {
  return files.find((f) => f.os === 'ios' && /\.ipa$/i.test(f.name)) || null;
}

function featured(os, files, version, components) {
  const apk = os === 'android' ? androidApk(files) : os === 'ios' ? iosIpa(files) : null;
  const file = DESKTOP.includes(os) ? primaryFile(files, os) : apk;
  const mobile = os === 'ios' || os === 'android';
  if (apk) version = components[os] ? components[os].version : version;
  const label = osLabel(os);
  let actions;
  if (file) {
    actions = [
      h('a', { class: 'btn btn-primary btn-lg', href: file.url, 'data-external': '' }, icon('download', { size: 18 }), t('download.featured.download_for', { os: label })),
      h('span', { class: 'small muted center' }, `${formatLabel(file.name)}${archLabel(file.name) ? ` · ${archLabel(file.name)}` : ''} · ${fmtSize(file.size)}`),
    ];
  } else {
    actions = [h('a', { class: 'btn btn-lg', href: '#desktop' }, t('download.featured.see_all'), icon('chevron-down', { size: 16 }))];
  }
  return h('section', { class: 'download-featured', 'aria-labelledby': 'featured-download' },
    h('div', { class: 'os-logo' }, icon(mobile ? 'phone' : OS_ICON[os] || 'laptop', { size: 34 })),
    h('div', null,
      h('h2', { id: 'featured-download' }, mobile || file ? t('download.featured.title_for', { os: label }) : t('download.featured.title_desktop')),
      h('p', null, mobile && !file
        ? t('download.featured.mobile_soon', { os: label })
        : file
          ? t('download.featured.detected', { version: (file && file.version) || version, os: label })
          : version ? t('download.featured.choose_version', { version }) : t('download.featured.choose'))),
    h('div', { class: 'actions' }, actions));
}

function osCard(os, files, currentOs) {
  const primary = primaryFile(files, os);
  // The main installer goes in the button; the rest, in the list.
  const others = files.filter((f) => f.os === os && (f.kind === 'app' || f.kind === 'app-archive') && f !== primary);
  return h('article', { class: ['card os-card', os === currentOs && 'is-current'] },
    h('div', { class: 'os-card-head' },
      h('span', { class: 'os-logo' }, icon(OS_ICON[os], { size: 22 })),
      h('div', { class: 'grow' }, h('h3', null, osLabel(os)), h('span', { class: 'small muted' }, primary ? formatLabel(primary.name) : t('download.not_available'))),
      os === currentOs ? badge(t('download.your_system'), 'accent') : null),
    primary || others.length
      ? [
        primary ? h('a', { class: 'btn btn-primary btn-block', href: primary.url, 'data-external': '' }, icon('download', { size: 16 }), t('download.download_size', { size: fmtSize(primary.size) })) : null,
        primary && archLabel(primary.name) ? h('span', { class: 'small muted center' }, archLabel(primary.name)) : null,
        // The latest version does not include this system yet: an older one is offered.
        primary && primary.version ? h('span', { class: 'small muted center' }, t('download.older_version', { version: primary.version, os: osLabel(os) })) : null,
        others.length ? [h('span', { class: 'label mt-8' }, t('download.other_formats')), h('ul', { class: 'file-list' }, others.map(fileRow))] : null,
      ]
      : h('p', { class: 'small muted' }, t('download.not_in_release')));
}

function mobileSection(files = [], components = {}, currentOs = null) {
  const card = (ico, name, text, os) => h('article', { class: ['card os-card', os === currentOs && 'is-current'] },
    h('div', { class: 'os-card-head' },
      h('span', { class: 'os-logo' }, icon(ico, { size: 22 })),
      h('div', { class: 'grow' }, h('h3', null, name), h('span', { class: 'small muted' }, text)),
      badge(t('common.coming_soon'), 'warn')));
  const ipa = iosIpa(files);
  const ios = ipa
    ? h('article', { class: ['card os-card', currentOs === 'ios' && 'is-current'] },
      h('div', { class: 'os-card-head' },
        h('span', { class: 'os-logo' }, icon('apple', { size: 22 })),
        h('div', { class: 'grow' }, h('h3', null, t('download.ios.name')), h('span', { class: 'small muted' }, t('download.ios.requirements'))),
        components.ios ? h('span', { class: 'badge' }, `v${components.ios.version}`) : null),
      h('a', { class: 'btn btn-primary btn-block', href: ipa.url, 'data-external': '' }, icon('download', { size: 16 }), t('download.download_size', { size: fmtSize(ipa.size) })),
      h('span', { class: 'small muted center' }, t('download.ios.unsigned')))
    : card('apple', t('download.ios.name'), t('download.ios.soon'), 'ios');
  const apk = androidApk(files);
  const android = apk
    ? h('article', { class: ['card os-card', currentOs === 'android' && 'is-current'] },
      h('div', { class: 'os-card-head' },
        h('span', { class: 'os-logo' }, icon('android', { size: 22 })),
        h('div', { class: 'grow' }, h('h3', null, 'Android'), h('span', { class: 'small muted' }, t('download.android.requirements'))),
        components.android ? h('span', { class: 'badge' }, `v${components.android.version}`) : null),
      h('a', { class: 'btn btn-primary btn-block', href: apk.url, 'data-external': '' }, icon('download', { size: 16 }), t('download.download_size', { size: fmtSize(apk.size) })),
      h('span', { class: 'small muted center' }, t('download.android.unknown_sources')))
    : card('android', 'Android', t('download.android.soon'), 'android');
  return h('section', { class: 'section', 'aria-labelledby': 'mobile-title' },
    h('div', { class: 'section-head' }, h('h2', { id: 'mobile-title' }, icon('phone', { size: 20 }), t('download.mobile.title'))),
    h('div', { class: 'mobile-apps' },
      ios,
      android));
}

function connectHint() {
  return h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', null, h('h3', { class: 'card-title' }, t('download.connect.title')),
        h('p', { class: 'card-sub' }, t('download.connect.text')))),
    copyField(location.origin, { label: t('download.connect.address') }));
}

export function render() {
  const os = detectOS();
  const body = h('div', null, loadingState(t('download.loading')));
  const load = async () => {
    replace(body, loadingState(t('download.loading')));
    try {
      const data = await api.get('/downloads', { auth: false });
      const files = data.files || [];
      const tools = files.filter((f) => f.kind === 'server' || f.kind === 'cli');
      const components = data.components || {};
      const versionBadge = (id, name) => (components[id] ? h('span', { class: 'badge' }, `${name} v${components[id].version}`) : null);
      replace(body, h('div', { class: 'stack-lg' },
        featured(os, files, data.version, components),
        h('section', { class: 'section', id: 'desktop', 'aria-labelledby': 'desktop-title' },
          h('div', { class: 'section-head' }, h('h2', { id: 'desktop-title' }, icon('laptop', { size: 20 }), t('download.desktop.title')), data.version ? h('span', { class: 'badge' }, `v${data.version}`) : null),
          h('div', { class: 'grid grid-3' }, DESKTOP.map((o) => osCard(o, files, os)))),
        mobileSection(files, components, os),
        h('section', { class: 'section', 'aria-labelledby': 'server-title' },
          h('div', { class: 'section-head' }, h('h2', { id: 'server-title' }, icon('server', { size: 20 }), t('download.tool.server_cli')),
            h('span', null, versionBadge('server', t('download.tool.server')), ' ', versionBadge('cli', 'CLI'))),
          h('p', { class: 'muted' }, t('download.server.text')),
          tools.length
            ? h('div', { class: 'card' }, h('ul', { class: 'file-list' }, tools.map(fileRow)))
            : h('p', { class: 'small faint' }, t('download.server.none'))),
        connectHint()));
    } catch (e) {
      if (e.status === 404) {
        replace(body, h('div', { class: 'stack-lg' },
          alertBox({
            kind: 'warn',
            title: t('download.disabled.title'),
            text: t('download.disabled.text'),
          }),
          h('section', { class: 'section', id: 'desktop', 'aria-labelledby': 'desktop-title' },
            h('div', { class: 'section-head' }, h('h2', { id: 'desktop-title' }, icon('laptop', { size: 20 }), t('download.desktop.title'))),
            h('div', { class: 'grid grid-3' }, DESKTOP.map((o) => h('article', { class: ['card os-card', o === os && 'is-current'] },
              h('div', { class: 'os-card-head' },
                h('span', { class: 'os-logo' }, icon(OS_ICON[o], { size: 22 })),
                h('div', { class: 'grow' }, h('h3', null, osLabel(o)), h('span', { class: 'small muted' }, t('download.not_on_server'))),
                o === os ? badge(t('download.your_system'), 'accent') : null))))),
          mobileSection(),
          connectHint()));
      } else {
        replace(body, errorState(e, load));
      }
    }
  };
  load();
  return h('div', null,
    h('section', { class: 'page-hero' },
      h('div', { class: 'container' },
        h('span', { class: 'eyebrow' }, t('download.eyebrow')),
        h('h1', { tabindex: '-1', dataset: { pageTitle: '' } }, t('download.title')),
        h('p', null, t('download.lead')))),
    h('div', { class: 'container' }, body));
}

