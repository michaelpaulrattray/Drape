/**
 * THE DESIGN-LAW DRIVE — the mechanised laws, on every surface the router has.
 *
 * The UI milestone completion contract (founder, 2026-08-01) puts the
 * mechanizable design laws "as browser-drive assertions in the suite, not as
 * review memory". This is the suite. The laws themselves are in
 * `lib/designLaws.mts`; the surfaces are DERIVED from `client/src/App.tsx` in
 * `lib/designLawSurfaces.mts`. This file is the walk.
 *
 * WHAT CHANGED, AND WHY THE FILE WAS RENAMED (#512, founder-ordered). It was
 * `drive-casting-design-laws.mts` and it visited three addresses while the
 * router declared twenty-four. Every page the founder is actually designing on
 * outside casting — the lobby and its four views, nine staff pages, the
 * moderator dashboard, the legacy studio, home, login, the 404 — was guarded
 * by source-text regexes alone. That is how the red focus ring survived three
 * appearances (#445) and how a stroked-pill status strip reached his eye
 * (#492). A file called `casting` that drives the whole product is the same
 * drift wearing a filename, so the name went with the scope.
 *
 * THE THREE MODES:
 *
 *   --controls   the instrument's own proof: each law against a synthetic
 *                offender it must catch and a synthetic compliant page it must
 *                not. Needs NO server, NO session, NO database, NO credits, so
 *                it runs in the gate on every pull request.
 *   (default)    the walk over the running app.
 *   --optimistic law 9, which clicks Follow for real and therefore SPENDS
 *                CREDITS. Opt in deliberately; the sheet only.
 *
 * Usage:
 *   npx tsx scripts/drive-design-laws.mts --controls
 *   npx tsx scripts/drive-design-laws.mts --base http://localhost:3000 \
 *     --token <app_session_id for an ADMIN account> [--session <uuid>] \
 *     [--cast <kiId>] [--board <id>] [--only /admin/users] [--theme dark]
 *
 * Exits non-zero on any violation, so it can gate a release.
 */
import puppeteer from "puppeteer-core";

import { runControls } from "./lib/designLawControls.mts";
import { assertOptimisticChrome, LawLog, runLaws, type Observation } from "./lib/designLaws.mts";
import { planSurfaces, type Fixtures } from "./lib/designLawSurfaces.mts";
import { resolveBrowser } from "./lib/systemBrowser.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const CONTROLS_ONLY = process.argv.includes("--controls");
const BASE = arg("base", "http://localhost:3000");
const TOKEN = arg("token");
/** Law 9 clicks Follow for real, which costs credits. Opt in deliberately. */
const OPTIMISTIC = process.argv.includes("--optimistic");
/** Narrow the walk to one router path, for iterating on a single surface. */
const ONLY = arg("only");
/** One theme instead of both, for the same reason. */
const THEME = arg("theme");

const executablePath = resolveBrowser();
if (!executablePath) {
  console.error(
    "No Chromium found. Set DRAPE_BROWSER to a Chrome or Edge executable, or install one " +
      "at a standard location (see scripts/lib/systemBrowser.mts).",
  );
  process.exit(1);
}

/* ────────────────────────────── controls mode ────────────────────────────── */

if (CONTROLS_ONLY) {
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const results = await runControls(browser);
  await browser.close();

  let bad = 0;
  console.log("DESIGN-LAW CONTROLS — can each law still fail, and does it pass a clean page?\n");
  for (const r of results) {
    const ok = r.offenderCaught && r.compliantClean;
    if (!ok) bad += 1;
    console.log(`${ok ? "  ok  " : "  MISS"} ${r.law} — ${r.breaks}`);
    if (!r.offenderCaught) console.log(`        offender NOT caught: ${r.offenderSaw}`);
    if (!r.compliantClean) console.log(`        compliant page reddened: ${r.compliantSaw}`);
  }
  console.log(`\n${results.length} control(s), ${bad} miss(es)`);
  process.exit(bad === 0 ? 0 : 1);
}

/* ─────────────────────────────── the walk ────────────────────────────────── */

/*
  An ADMIN session. Nine of the nineteen surfaces are staff pages that own their
  own role guards: driven without one they redirect to /login or /studio, and
  every law then reads the login page while the report names the admin page —
  a FALSE reading, which is worse than a missing one.
*/
if (!TOKEN) throw new Error("--token <app_session_id JWT for an ADMIN account> is required");

const fixtures: Fixtures = {
  session: arg("session") || undefined,
  cast: arg("cast") || undefined,
  board: arg("board") || undefined,
};

const plan = planSurfaces(BASE, fixtures);

const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const { hostname } = new URL(BASE);
await page.setCookie({ name: "app_session_id", value: TOKEN, domain: hostname, path: "/" });

const log = new LawLog((o: Observation) => {
  const mark = o.ok === null ? "  --  " : o.ok ? "  ok  " : "  FAIL";
  console.log(`${mark} ${o.law} — ${o.saw}`);
});

/**
 * WAIT FOR THE PAGE, NEVER FOR THE CLOCK — and fail if it never arrives.
 *
 * The first version of this walk slept 900ms after `networkidle2` and then
 * measured. Driven against the real app that was catastrophically wrong and it
 * failed in the direction that looks like success: at 900ms EVERY staff page in
 * this product is still completely blank — `document.body.innerText` is the
 * empty string — so all eight laws found no subject, printed "not applicable",
 * and the run came back clean. The single surface the founder complained about
 * in #445, the Users search box, reported "no text fields on this surface".
 * Measured on this machine: `/admin/users` holds 0 inputs at 900ms and 1 at 7s.
 *
 * A drive that reports a blank page as a lawful one is worse than no drive, so
 * readiness is now PROVEN rather than timed. The text length is sampled until
 * two consecutive readings agree — derived from the page itself, no per-surface
 * magic strings to rot — and a surface still empty at the deadline FAILS.
 *
 * Stated limit: a page that gets stuck showing "Loading..." forever stabilises
 * too, and this would measure it. That is why the observation carries the
 * character count and the opening of the text — so a reader sees WHAT was
 * measured rather than being told it was fine. The surfaces with a known
 * readiness marker use `waitFor` instead, which is exact.
 */
async function settle(where: string): Promise<boolean> {
  const read = () =>
    page.evaluate(() => ({
      chars: document.body.innerText.trim().length,
      loading: document.querySelectorAll(".dp-skeleton, .animate-pulse").length,
      opening: document.body.innerText.trim().replace(/\s+/g, " ").slice(0, 80),
    }));

  /*
    A PLATEAU IS NOT AN END STATE, AND STILLNESS ALONE CANNOT TELL THEM APART.

    Measured on `/admin/users` against the running app: 0 characters at 1s, then
    453 characters and FIVE skeletons from ~3s to ~6s, then 1,217 characters and
    the real table. That middle state is perfectly still for about three
    seconds, so every "wait until nothing changes" rule walks into it — a
    two-agreement version did, and so did a four-agreement one. It then reported
    "no text fields on this surface" about the very search box #445 was raised
    over, and passed.

    So the wait is in two phases, and the first uses the app's own statement
    about itself rather than a timer: a loading placeholder on screen means the
    page is not done. Only once they are gone (or a cap expires) does the text
    have to hold still. Surfaces that keep a placeholder on purpose — the
    specimen gallery renders one AS a specimen — pay the cap and are named in
    the report, which is the honest cost of not measuring half-drawn pages.
  */
  const LOADING_CAP_MS = 12000;
  const AGREEMENTS_NEEDED = 4;
  const INTERVAL_MS = 500;
  const deadline = Date.now() + 25000;

  // Phase A — the app says it is still loading.
  const loadingDeadline = Date.now() + LOADING_CAP_MS;
  let state = await read();
  while (Date.now() < loadingDeadline && (state.loading > 0 || state.chars === 0)) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
    state = await read();
  }

  // Phase B — and now the text has to stop moving.
  let last = { chars: -1, loading: -1 };
  let agreements = 0;
  while (Date.now() < deadline) {
    state = await read();
    if (state.chars > 0 && state.chars === last.chars && state.loading === last.loading) {
      agreements += 1;
      if (agreements >= AGREEMENTS_NEEDED) break;
    } else {
      agreements = 0;
      last = { chars: state.chars, loading: state.loading };
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  /* One more frame for transitions that move without changing the text. */
  await new Promise((r) => setTimeout(r, 400));
  state = await read();

  if (state.chars === 0) {
    log.check(
      where,
      "the surface renders before it is measured",
      false,
      "body text still empty after 25s — every law below would have measured a blank page and passed",
    );
    return false;
  }
  if (state.loading > 0) {
    /*
      Not a violation and not hidden either. Some surfaces hold a skeleton on
      purpose (the specimen gallery renders one as a specimen), and a page that
      never finishes loading in dev is a fixture problem rather than a design
      one. Both are named in the report so a reader knows which laws were
      measured against a half-drawn page.
    */
    stillLoading.push(`${where} — ${state.loading} loading placeholder(s) still up at ${state.chars} chars`);
  }
  log.check(
    where,
    "the surface renders before it is measured",
    true,
    `${state.chars} chars, ${state.loading} loading placeholder(s): "${state.opening}"`,
  );
  return true;
}

/*
  A misspelled theme used to be cast straight through: the app fell back to its
  default and the report printed `theme: banana` over it, so one operator typo
  mislabelled a whole pass and nothing said so.
*/
if (THEME && THEME !== "dark" && THEME !== "light") {
  console.error(`--theme must be "dark" or "light" (got "${THEME}").`);
  process.exit(1);
}
const themes = THEME ? [THEME as "dark" | "light"] : (["dark", "light"] as const);

/*
  Surfaces that could not be visited. Held separately from the law failures and
  printed at the end, because "the sheet was never checked" must never be able
  to read as "the sheet passed" — the failure this whole card is about.
*/
const unvisited: string[] = [];
/** Surfaces that settled with loading placeholders still on screen. */
const stillLoading: string[] = [];
/** Surfaces actually opened — never the PLANNED count, which `--only` narrows. */
const visited = new Set<string>();

for (const theme of themes) {
  console.log(`\n════════ theme: ${theme} ════════`);
  /* Set the theme once per pass, on an address that always renders. */
  await page.goto(`${BASE}/404`, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("drape_theme", t);
  }, theme);

  for (const surface of plan.visit) {
    if (ONLY && surface.plan.path !== ONLY) continue;
    const where = `${theme} · ${surface.plan.label}`;
    console.log(`\n── ${where}  (${surface.url})`);
    try {
      await page.goto(surface.url, { waitUntil: "networkidle2", timeout: 45000 });
    } catch (error) {
      log.check(where, "the surface loads", false, `goto failed: ${(error as Error).message}`);
      continue;
    }
    /* Counted once it has actually answered — a surface that never loaded is
       not one this run looked at, whatever the headline would rather say. */
    visited.add(surface.plan.path);

    /*
      A staff page that bounced to /login renders a perfectly lawful login form,
      so every law below would hold and the run would report the admin page as
      clean. Read the address back before measuring anything.
    */
    const landed = new URL(page.url()).pathname;
    const expected = new URL(surface.url).pathname;
    if (landed !== expected) {
      log.check(
        where,
        "the surface answers at its own address",
        false,
        `${expected} redirected to ${landed} — the laws below would have measured that page instead`,
      );
      continue;
    }

    if (surface.plan.waitFor) {
      const reached = await page
        .waitForFunction((t) => document.body.innerText.includes(t), { timeout: 40000 }, surface.plan.waitFor)
        .then(() => true)
        .catch(() => false);
      if (!reached) {
        log.check(
          where,
          "the surface reaches its loaded state",
          false,
          `never showed "${surface.plan.waitFor}" within 40s`,
        );
        continue;
      }
    }

    if (!(await settle(where))) continue;

    await runLaws(page, where, log, surface.plan.requires);

    // Spends credits, so it is opt-in: --optimistic, on the sheet only.
    if (OPTIMISTIC && surface.plan.path === "/casting/s/:sessionId") {
      await assertOptimisticChrome(page, where, log);
    }
  }
}

await browser.close();

/* ────────────────────────────── the report ───────────────────────────────── */

for (const d of plan.declared) {
  unvisited.push(`${d.label} (${d.path}) — declared undriveable: ${d.reason}`);
}
for (const a of plan.awaitingFixture) {
  unvisited.push(`${a.label} (${a.path}) — NOT CHECKED: needs --${a.fixture}`);
}

console.log(`\n════════ report ════════`);
console.log(
  `${visited.size} of ${plan.visit.length} planned surface(s) visited × ${themes.length} theme(s) · ` +
    `${log.held.length} held · ${log.skipped.length} not applicable · ${log.failures.length} violated`,
);

if (unvisited.length > 0) {
  console.log(`\nNOT VISITED (${unvisited.length}):`);
  for (const u of unvisited) console.log(`  · ${u}`);
}

if (stillLoading.length > 0) {
  console.log(`\nMEASURED WHILE STILL LOADING (${stillLoading.length}) — read these verdicts with that in mind:`);
  for (const s of stillLoading) console.log(`  · ${s}`);
}

/*
  A missing FIXTURE is a failure of the run, not of the product — but it is not
  silence either. `--session` was optional in the old drive and its absence
  printed one line among two hundred; a surface nobody checked has to cost the
  run its exit code, or the habit becomes running without it.
*/
const missingFixtures = plan.awaitingFixture.length;

if (log.failures.length > 0) {
  console.log(`\n${log.failures.length} VIOLATION(S):`);
  for (const f of log.failures) console.log(`  · [${f.surface}] ${f.law} — ${f.saw}`);
}

if (log.failures.length === 0 && missingFixtures === 0) {
  console.log("\nALL DESIGN LAWS HOLD, ON EVERY SURFACE THE ROUTER DECLARES.");
  process.exit(0);
}
if (log.failures.length === 0) {
  console.log(
    `\nNo violations on what was checked — but ${missingFixtures} surface(s) were never ` +
      `visited for want of a fixture, so this is not a clean run.`,
  );
}
process.exit(1);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
