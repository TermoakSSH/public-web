// The legal documents of termoak.com: Terms of Use, Privacy Policy and
// Legal notice.
//
// Their text lives in `legal/<lang>/<doc>.html` (served under /assets/), one
// file per language; js/pages/legal.js shows them. The version and date here
// apply to all three: when a document changes in a way people must accept
// again, raise LEGAL_VERSION (the sign-up page sends it with the acceptance,
// and the server records it).

import { localePath } from './seo.js';

/** Version of the documents accepted at sign-up (`terms_version`). */
export const LEGAL_VERSION = '1.0';

/** Date the current version takes effect (ISO, `YYYY-MM-DD`). */
export const LEGAL_DATE = '2026-10-04';

/** The documents: id → `{path, file, title}` (`title` is a translation key). */
export const LEGAL_DOCS = {
  terms: { path: '/terms', file: 'terms', title: 'legal.terms.title' },
  privacy: { path: '/privacy', file: 'privacy', title: 'legal.privacy.title' },
  legal: { path: '/legal', file: 'legal', title: 'legal.legal.title' },
};

/** Path of a document's page in the current language (`/terms`, `/es/terms`...). */
export function legalPath(id) {
  return localePath(LEGAL_DOCS[id].path);
}
