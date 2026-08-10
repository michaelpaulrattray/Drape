/**
 * Theme-parity screenshot drive — the harness every later Casting V2 milestone
 * reuses (plan §K M1, §M "Theme parity").
 *
 * Loads each V2 surface in both themes at two widths, proves the theme actually
 * applied before first paint, and writes PNGs for review. No repo had such a
 * harness before M1: theme regressions were invisible because nothing ever
 * looked at the other theme.
 *
 * Free: touches no provider, spends no credit, writes nothing to the database.
 *
 *   pnpm dev                                  # in another terminal
 *   npx tsx scripts/drive-foundation-theme-parity.mts
 *
 * Env:
 * M1's own surface is client-only, so it can also be driven against a static
 * preview of the build when the local database is behind a migration and the
 * Express server refuses to boot (a documented condition — DECISION_LOG D-76):
 *
 *   pnpm build && pnpm exec vite preview --port 4173
 *   VERIFY_BASE_URL=http://localhost:4173 THEME_SHOT_NO_API=1 \
 *     npx tsx scripts/drive-foundation-theme-parity.mts
 *
 * Env:
 *   VERIFY_BASE_URL   default http://localhost:3000
 *   THEME_SHOT_DIR    default .theme-shots (gitignored)
 *   THEME_SHOT_ROUTES comma-separated route list; defaults to the V2 surfaces
 *                     that exist. Later milestones extend the default instead
 *                     of writing a new script.
 *   THEME_SHOT_NO_API 1 → there is no backend; skip the health wait and ignore
 *                     console errors that name /api. Every other console error
 *                     still fails the drive. Never set this for a surface that
 *                     reads real data — it would hide a broken query.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SignJWT } from "jose";
import puppeteer from "puppeteer-core";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT_DIR = path.resolve(process.env.THEME_SHOT_DIR ?? ".theme-shots");

const THEMES = ["dark", "light"] as const;

/** 1240px working column + the documented 800px reflow check (plan §D.9). */
const WIDTHS = [
  { label: "wide", width: 1440, height: 1000 },
  { label: "narrow", width: 800, height: 1000 },
] as const;

/**
 * Every surface on the foundation shell. Extend this as milestones adopt it,
 * rather than writing a second script.
 */
// The primitive gallery moved to /casting/foundation in M5, when /casting
// became the product. Theme parity is checked against the gallery, because it
// is the page that renders every primitive in one place.
const DEFAULT_ROUTES = ["/casting/foundation", "/casting", "/app", "/app/boards", "/app/models"];

const ROUTES = (process.env.THEME_SHOT_ROUTES ?? DEFAULT_ROUTES.join(","))
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

/**
 * Authenticated surfaces need a session. Minted for the dedicated verify-bot
 * user (never a real account — those carry PII), and only when the signing
 * inputs are present; without them the drive still covers the public routes.
 */
async function mintSessionCookie(): Promise<string | null> {
  const secret = process.env.JWT_SECRET;
  const appId = process.env.VITE_APP_ID;
  if (!secret || !appId || NO_API) return null;
  return new SignJWT({ openId: "verify-bot-local", appId, name: "Verify Bot" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

/** Marker that the foundation shell mounted — not a fixed sleep. */
const SHELL_SELECTOR = ".dp-root .dp-topbar";

const NO_API = process.env.THEME_SHOT_NO_API === "1";

/**
 * Only backend-absence noise is ignorable, and only when NO_API says so.
 * With no server the SPA fallback answers /api/trpc with index.html, so the
 * tRPC client reports a JSON parse failure rather than naming the URL — hence
 * the client-error prefixes rather than a URL match alone.
 */
const NO_API_NOISE = [
  /\/api\//,
  /TRPCClientError/,
  /\[API (Query|Mutation) Error\]/,
  /request failed/,
];

function isIgnorableConsoleError(text: string): boolean {
  return NO_API && NO_API_NOISE.some((pattern) => pattern.test(text));
}

function slug(route: string): string {
  return route.replace(/^\//, "").replace(/[^\w.-]+/g, "-") || "root";
}

async function waitForHealth(): Promise<void> {
  if (NO_API) {
    const response = await fetch(BASE).catch(() => null);
    if (!response) throw new Error(`Nothing serving ${BASE}.`);
    return;
  }
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {
      // Server still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`No server at ${BASE} — start \`pnpm dev\` first.`);
}

await waitForHealth();
await mkdir(OUT_DIR, { recursive: true });

const sessionCookie = await mintSessionCookie();
if (!sessionCookie) {
  console.log("[theme-parity] no session minted — authenticated routes will redirect");
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new" as never,
  pipe: true,
});

const failures: string[] = [];
const written: string[] = [];

try {
  for (const route of ROUTES) {
    for (const size of WIDTHS) {
      for (const theme of THEMES) {
        // A cold page per combination. Sharing one page across themes meant the
        // second navigation aborted the first's in-flight queries, which the
        // console reported as fetch failures that never really happened — and a
        // cold load is what actually exercises the first-paint theme script.
        const page = await browser.newPage();
        await page.setViewport({ width: size.width, height: size.height });
        if (sessionCookie) {
          await page.setCookie({
            name: 'app_session_id',
            value: sessionCookie,
            domain: 'localhost',
            path: '/',
          });
        }

        const consoleErrors: string[] = [];
        const record = (text: string) => {
          if (!isIgnorableConsoleError(text)) consoleErrors.push(text);
        };
        page.on('console', (message) => {
          if (message.type() === 'error') record(message.text());
        });
        page.on('pageerror', (error) => record(String(error)));
        page.on('requestfailed', (request) => {
          // Aborts are the drive tearing the page down, not a defect.
          const reason = request.failure()?.errorText ?? '';
          if (reason.includes('ERR_ABORTED')) return;
          record(`request failed (${reason}): ${request.url().split('?')[0]}`);
        });

        // Seed the theme the way a returning user has it: in storage, read by
        // the first-paint script. If that script were deferred, the shot would
        // catch the wrong-theme paint.
        await page.evaluateOnNewDocument((value) => {
          localStorage.setItem('drape_theme', value);
        }, theme);

        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 90_000 });
        await page.waitForSelector(SHELL_SELECTOR, { timeout: 90_000 });

        const applied = await page.evaluate(() => {
          const root = document.documentElement;
          const rootStyles = getComputedStyle(root);
          const shell = document.querySelector('.dp-root');
          const styles = shell ? getComputedStyle(shell) : null;
          return {
            attribute: root.getAttribute('data-theme'),
            // Tokens must resolve at :root, not just inside the shell — that is
            // what portaled content (dialogs, menus) reads.
            rootSurface: rootStyles.getPropertyValue('--surface').trim(),
            surface: styles?.getPropertyValue('--surface').trim() ?? '',
            ink: styles?.getPropertyValue('--ink').trim() ?? '',
            fontFamily: styles?.fontFamily ?? '',
          };
        });

        const where = `${route} ${theme} @${size.width}`;
        if (applied.attribute !== theme) {
          failures.push(`${where}: data-theme is "${applied.attribute}", expected "${theme}"`);
        }
        if (!applied.rootSurface) {
          failures.push(`${where}: foundation tokens are not resolving at :root`);
        }
        if (!applied.surface || !applied.ink) {
          failures.push(`${where}: foundation tokens did not reach .dp-root`);
        }
        if (!applied.fontFamily.includes('Archivo')) {
          failures.push(`${where}: shell font is "${applied.fontFamily}", expected Archivo`);
        }

        /*
          Two shots per combination, deliberately.

          `chrome` is viewport-sized: the rail is `height:100vh` and the dock is
          sticky, so only a viewport capture shows them where a user sees them.
          `page` is fullPage for content coverage — in that mode the browser
          resolves sticky elements against the tall capture, which parks the
          dock mid-document and stops the rail short. That is a screenshot
          artifact, not a layout bug, and having both makes it obvious.
        */
        for (const mode of ['chrome', 'page'] as const) {
          const file = path.join(
            OUT_DIR,
            `${slug(route)}--${theme}--${size.label}--${mode}.png`,
          );
          await page.screenshot({
            path: file as `${string}.png`,
            fullPage: mode === 'page',
          });
          written.push(path.relative(process.cwd(), file));
        }

        // Reduced motion: every animation must collapse, not merely slow down.
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        const animated = await page.evaluate(() =>
          [...document.querySelectorAll('.dp-root, .dp-root *')].filter((element) => {
            const name = getComputedStyle(element).animationName;
            return name && name !== 'none';
          }).length,
        );
        if (animated > 0) {
          failures.push(
            `${where}: ${animated} element(s) still animate under prefers-reduced-motion`,
          );
        }

        if (consoleErrors.length > 0) {
          failures.push(`${where}: console errors → ${consoleErrors.join(' | ')}`);
        }
        console.log(`[theme-parity] ${where} → surface ${applied.surface} · 2 shots`);
        await page.close();
      }
    }
  }

  await writeFile(
    path.join(OUT_DIR, "index.html"),
    [
      "<!doctype html><meta charset=utf-8><title>Theme parity</title>",
      "<style>body{margin:0;padding:24px;font:14px system-ui;background:#111;color:#eee}",
      "figure{margin:0 0 28px}img{max-width:100%;border:1px solid #333}</style>",
      ...written.map(
        (file) =>
          `<figure><figcaption>${path.basename(file)}</figcaption><img src="${path.basename(file)}"></figure>`,
      ),
    ].join("\n"),
    "utf8",
  );
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\n[theme-parity] FAILED\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}

console.log(
  `\n[theme-parity] OK — ${written.length} shots in ${path.relative(process.cwd(), OUT_DIR)} (open index.html)`,
);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
