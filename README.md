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

## Running it locally

With a Termoak server (a release binary, or `cargo run` in a checkout of
[TermoakSSH/server](https://github.com/TermoakSSH/server)):

```sh
TERMOAK_WEB_DIR=$PWD/site termoak-server serve    # http://localhost:7722
```

`TERMOAK_WEB_DIR` serves the folder without caching, so a reload shows your
changes. In production, use `[web] dir = "/path/to/site"` in the server's
configuration.

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
