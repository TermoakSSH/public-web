// Finds Playwright and starts its headless Chromium, for the build scripts
// (prerender.mjs, brand-images.mjs).
//
// Playwright is looked up in PLAYWRIGHT_MODULE (the folder of the
// `playwright` or `playwright-core` package), then as `playwright` and
// `playwright-core` from this folder (e.g. a node_modules next to the
// repository). Its Chromium comes from PLAYWRIGHT_BROWSERS_PATH (or
// Playwright's default cache), or CHROMIUM (path to the executable). On
// Linux without the system libraries, point LD_LIBRARY_PATH to them.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * `{browser}` with a running Chromium, or `{browser: null, reason}` when
 * Playwright or the browser are not available (`required`: throw instead).
 */
export async function loadChromium({ required = false } = {}) {
  const ids = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean);
  let pw = null;
  for (const id of ids) {
    try {
      pw = require(id);
      if (pw && pw.chromium) break;
      pw = null;
    } catch {
      /* try the next one */
    }
  }
  const fail = (reason) => {
    if (required) throw new Error(reason);
    return { browser: null, reason };
  };
  if (!pw) return fail(`Playwright not found (tried ${ids.join(', ')}; set PLAYWRIGHT_MODULE)`);
  try {
    const browser = await pw.chromium.launch({
      executablePath: process.env.CHROMIUM || undefined,
      // Root on a build server: Chromium's sandbox needs an unprivileged user.
      args: process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [],
    });
    return { browser };
  } catch (e) {
    return fail(`Chromium did not start: ${String(e.message || e).split('\n')[0]}`);
  }
}
