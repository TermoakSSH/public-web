# Termoak website

The public website of [termoak.com](https://termoak.com): the landing page,
pricing and downloads of [Termoak](https://termoak.com), the open-source SSH
client for desktop and mobile with an optional self-hosted server. It is
published for transparency and so that anyone can fix or translate it.

A single-page application without a build step: HTML, CSS and JavaScript
modules in `site/`, served by the Termoak server
([TermoakSSH/server](https://github.com/TermoakSSH/server)) from a directory (`[web] dir`). It uses the
server's API for what changes (the plans on the pricing page, the versions on
the downloads page).

| Path | What it is |
|---|---|
| `site/index.html`, `site/app.js` | Page shell and router |
| `site/js/` | Shared base: API client, session, router, layouts, UI components, icons, formatting, i18n |
| `site/js/pages/` | Landing, pricing and downloads |
| `site/css/` | Styles |
| `site/locales/<lang>.json` | Translations |
| `site/legal/<lang>/` | Terms of Use, Privacy Policy and Legal notice (`terms.html`, `privacy.html`, `legal.html`), shown at `/terms`, `/privacy` and `/legal` (English when a language has no copy). Their version and date are in `site/js/legal.js` |
| `site/seo.json` | Search engines and link previews: title and description of each public page in each language, the languages with their own URLs, the preview image and the structured data (JSON-LD). Read by `site/js/seo.js` and by the build |
| `site/robots.txt`, `site/.well-known/security.txt`, `site/favicon.*`, `site/apple-touch-icon.png`, `site/site.webmanifest`, `site/icons/`, `site/og-image.png` | Served by the server at the root of the site (`/robots.txt`...) and under `/assets/` |
| `scripts/` | Build (`build.sh`, `prerender.mjs`: sitemap and prerendered pages), image generation (`brand-images.mjs`) and the translation check |

## Running it locally

With a Termoak server (a release binary, or `cargo run` in a checkout of
[TermoakSSH/server](https://github.com/TermoakSSH/server)):

```sh
TERMOAK_WEB_DIR=$PWD/site termoak-server serve    # http://localhost:7722
```

`TERMOAK_WEB_DIR` serves the folder without caching, so a reload shows your
changes. In production, use `[web] dir = "/path/to/site"` in the server's
configuration, pointing to a build (below).

## Search engines and languages

The public pages (landing, pricing, downloads and the legal documents) are
listed in `site/seo.json`, and each one exists in every language there:
English at its path (`/pricing`) and Spanish under `/es/` (`/es/pricing`).
On those URLs the language of the URL wins over the saved or browser one;
an address without prefix sends someone who reads Spanish to the `/es/`
one, and the language picker goes to the other language's URL. The sign-in
pages and the app have no language in their URLs.

`site/js/seo.js` fills the head of every page from `seo.json`: title,
description, canonical URL, `hreflang` alternates, Open Graph and Twitter
tags and JSON-LD (the organization and the application), and
`<meta name="robots" content="noindex">` on the pages that are not public.

The build adds what search engines read without running JavaScript:

```sh
scripts/build.sh [out-dir]                 # dist/ by default
```

copies `site/` and runs `scripts/prerender.mjs` on the copy, which writes:

- `sitemap.xml`: every public page in every language, with its alternates
  and the date of its last commit;
- `prerendered/<path>.html` (`prerendered/index.html`,
  `prerendered/es/pricing.html`...): each public page rendered by the site
  itself in headless Chromium, with its content, head tags and JSON-LD. The
  server serves it at its path instead of `index.html`, and the page keeps
  working as before once `app.js` loads (no inline scripts: the strict CSP
  still applies);
- `noindex` in `index.html`, which then only answers the other paths.

The sitemap needs Node.js 18 or later; the prerendered pages also need
[Playwright](https://playwright.dev) with its Chromium. Without them the
build still works, with a warning. Variables:

| Variable | Meaning |
|---|---|
| `NODE` | Node.js binary (default: `node` from the `PATH`) |
| `PLAYWRIGHT_MODULE` | Folder of the `playwright` or `playwright-core` package, if it is not installed next to this repository |
| `PLAYWRIGHT_BROWSERS_PATH`, `CHROMIUM` | Playwright's browsers folder, or the Chromium executable |
| `LD_LIBRARY_PATH` | Chromium's libraries, if the system does not have them |
| `PRERENDER_API` | Termoak server whose API the pages use while prerendering (plans, versions): `https://termoak.com` by default, `none` for placeholders |
| `SKIP_PRERENDER=1` | Only the sitemap |

For example, with Playwright installed in `~/pw` (`npm install
playwright-core` and `npx playwright-core install chromium` there):

```sh
PLAYWRIGHT_MODULE=~/pw/node_modules/playwright-core scripts/build.sh
```

The icons (`favicon.ico`, `apple-touch-icon.png`, `icons/`) and the link
preview image (`og-image.png`) are generated from `site/icon.svg` by
`node scripts/brand-images.mjs` (also with Playwright) and committed.
`site/.well-known/security.txt` expires a year after its last update:
renew its `Expires` date before then.

## How termoak.com uses it

The sign-in pages, the signed-in web app and the administration of
termoak.com live in a private repository and are deployed on top of this
site, in the same directory: they only add files (`js/ext.js`, their pages,
`css/app.css` and `locales/app/<lang>.json`) and never replace one of this
repository. When `js/ext.js` exists, `app.js` loads it and adds its routes,
stylesheets and translations; without it (as here), only the public pages
exist and links such as *Sign in* show "not found".

A self-hosted server does not need this site: it has its own basic web app
built in.

## Translations

Copy `site/locales/en.json` to your language code (`pt-BR.json`...),
translate the values and open a pull request: the server lists the new
language automatically. Keep the keys and the `%{placeholders}` as they are.
`python3 scripts/check-locales.py` checks the files. See
[I18N.md](https://github.com/TermoakSSH/core/blob/main/docs/I18N.md).

## The Termoak repositories

| Repository | Contents |
|---|---|
| [TermoakSSH/core](https://github.com/TermoakSSH/core) | Shared crates (SSH engine, vault, API client, AI engine, FFI bindings, updates) and the `termoak` CLI |
| [TermoakSSH/server](https://github.com/TermoakSSH/server) | `termoak-server`: HTTP/WebSocket API, basic web app, deployment files |
| [TermoakSSH/desktop](https://github.com/TermoakSSH/desktop) | Desktop app (GPUI) for Windows, Linux and macOS |
| [TermoakSSH/mobile-android](https://github.com/TermoakSSH/mobile-android) | Android app (Jetpack Compose) |
| [TermoakSSH/mobile-ios](https://github.com/TermoakSSH/mobile-ios) | iOS app (SwiftUI) |
| **[TermoakSSH/public-web](https://github.com/TermoakSSH/public-web)** | Public website of termoak.com: landing, pricing and downloads |


## Contributing and translations

Bug reports, fixes, features and translations are welcome: see
[CONTRIBUTING.md](CONTRIBUTING.md). Translating Termoak into your language
needs no programming: copy the English strings file of an app, translate it
and open a pull request ([docs/I18N.md](https://github.com/TermoakSSH/core/blob/main/docs/I18N.md)).

## License

Copyright © Ohz Digital SL.

Termoak is free software released under the
[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).

"Termoak" and the Termoak logo are trademarks of Ohz Digital SL and are not
covered by the code license: see [TRADEMARK.md](TRADEMARK.md).
