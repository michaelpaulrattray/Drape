/**
 * THE TWO MOVED SENTENCES, LOOKED AT (law 6; fable-684 §3, fable-687 §2).
 *
 * The held commit rewrites one promise and moves another:
 *
 *   viewer   "usually a minute or two"   →   "usually three to four minutes"
 *   panel    "taking longer than usual"  at 2 min   →   at 5 min
 *
 * Fable's condition for shipping them is that both are SEEN, and the reason is
 * concrete rather than ceremonial: the new viewer line is materially LONGER
 * than the one it replaces, and a promise surface with longer copy is exactly
 * where truncation, wrap or overlap hides. So this drive does three things a
 * unit test cannot:
 *
 *   1. reads the sentences off the running DOM;
 *   2. measures the line's own box for clipping and for staying on the plate;
 *   3. photographs both arms in both themes.
 *
 * THE READING IS OFF THE WIRE, NOT OFF THE SCREEN. `waitedMs` is captured from
 * the `castingV2.variants` response itself, because a screen agreeing with a
 * wrong number is the failure the pair of thresholds is about.
 *
 * THE QUIET ARM IS THE DISCRIMINATING ONE. It is a row 3 minutes old — past
 * yesterday's 2-minute threshold, inside today's 5-minute one — so its silence
 * is the threshold having moved and cannot be explained by "the note is just
 * never shown". The wire number is asserted INSIDE that window, so an arm that
 * went quiet because the fixture had vanished would fail rather than pass.
 *
 * Nothing here spends: the fixture rows are synthetic and no mutation is fired.
 *
 *   npx tsx scripts/seed-wait-notice-disposable.mts
 *   npx tsx scripts/drive-wait-notice-disposable.mts
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";
import type { HTTPResponse, Page } from "puppeteer-core";

import { openDatabase } from "./lib/dbConnection.mts";
import { createChecks, openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const SESSION = "0b17d084-ad91-4b4f-955c-45e21703fe05";
const OUT = path.resolve("output/wait-notices");
const STAMP = "2026-08-16";

/** What the copy must say now, and what it must no longer say. */
const NEW_LINE = "usually three to four minutes";
const OLD_LINE = "a minute or two";
const NOTE = "taking longer than usual";

/** The window the QUIET arm has to land in for its silence to mean anything. */
const OLD_THRESHOLD_MS = 2 * 60 * 1000;
const NEW_THRESHOLD_MS = 5 * 60 * 1000;

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await conn.query<any[]>("SELECT openId FROM users WHERE id = 1");
if (!owners[0]?.openId) throw new Error("no owner account to drive as");
const token = await new SignJWT({ openId: owners[0].openId, appId, name: "Wait notice evidence" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

/**
 * THE FIXTURE'S OWN STATE AT THE MOMENT OF THE READING.
 *
 * A vanished fixture and a working threshold look identical from the browser —
 * both are a quiet panel. The stuck-render drive learnt that the hard way, so
 * the rows are read from the database beside every verdict.
 */
async function fixtureRows(): Promise<Record<string, { status: string; ageS: number }>> {
  const [rows] = await conn.query<any[]>(
    `SELECT v.status, v.requestText, v.createdAt
       FROM casting_candidate_variants v
      WHERE v.userId = 1 AND v.requestText LIKE '%wait-notice-fixture%'`);
  const state: Record<string, { status: string; ageS: number }> = {};
  for (const row of rows) {
    const arm = row.requestText.includes("speaks") ? "SPEAKS" : "QUIET";
    state[arm] = {
      status: row.status,
      ageS: Math.round((Date.now() - new Date(row.createdAt).getTime()) / 1000),
    };
  }
  return state;
}

await mkdir(OUT, { recursive: true });
const { check, failures, print, records } = createChecks();

/**
 * WHAT THE SCREEN SAYS, AND HOW THE SENTENCE FITS.
 *
 * `scrollWidth > clientWidth` is the mechanical form of "the copy got longer
 * and the box did not" — a clipped promise reads, in a screenshot, exactly like
 * a promise that was never made.
 */
const READ = `(() => {
  const line = document.querySelector(".dpc-viewer__waitTypical");
  const wait = document.querySelector(".dpc-viewer__wait");
  const plate = document.querySelector(".dpc-viewer__plate");
  const box = line ? line.getBoundingClientRect() : null;
  const plateBox = plate ? plate.getBoundingClientRect() : null;
  return {
    typical: line ? (line.textContent || "").trim() : null,
    clipped: line ? line.scrollWidth > line.clientWidth + 1 : null,
    lines: line && box ? Math.round(box.height / parseFloat(getComputedStyle(line).lineHeight || "0")) : null,
    insidePlate: box && plateBox
      ? (box.left >= plateBox.left - 1 && box.right <= plateBox.right + 1
         && box.top >= plateBox.top - 1 && box.bottom <= plateBox.bottom + 1)
      : null,
    waitText: wait ? (wait.textContent || "").trim() : null,
    /* WHICH THEME ACTUALLY PAINTED. Two screenshots labelled dark and light
       that are both dark is an evidence pack claiming coverage it does not
       have, and nothing else on the page would say so. */
    theme: document.documentElement.dataset.theme || null,
    note: Array.from(document.querySelectorAll(".dpc-refine__note"))
      .map((n) => (n.textContent || "").trim())
      .find((t) => t.includes(${JSON.stringify(NOTE)})) || null,
    panel: Boolean(document.querySelector(".dpc-refine")),
  };
})()`;

type Read = {
  typical: string | null;
  clipped: boolean | null;
  lines: number | null;
  insidePlate: boolean | null;
  waitText: string | null;
  theme: string | null;
  note: string | null;
  panel: boolean;
};

/** Every `waitedMs` this page has been told, newest last. */
const wire: Array<{ instruction: string; waitedMs: number; stage: string }> = [];

function collectWire(payload: unknown): void {
  if (Array.isArray(payload)) {
    for (const entry of payload) collectWire(entry);
    return;
  }
  if (!payload || typeof payload !== "object") return;
  const record = payload as Record<string, unknown>;
  if (typeof record.waitedMs === "number" && typeof record.instruction === "string") {
    wire.push({
      instruction: record.instruction,
      waitedMs: record.waitedMs,
      stage: String(record.stage ?? "?"),
    });
    return;
  }
  for (const value of Object.values(record)) collectWire(value);
}

const onResponse = (response: HTTPResponse) => {
  if (!response.url().includes("castingV2.variants")) return;
  void response.json().then(collectWire).catch(() => { /* a non-JSON body is not a reading */ });
};

/** The newest wire figure for one arm, or null if the wire never carried it. */
function wireFor(arm: "speaks" | "quiet"): { waitedMs: number; stage: string } | null {
  const hit = wire.filter((row) => row.instruction.includes(arm)).at(-1);
  return hit ? { waitedMs: hit.waitedMs, stage: hit.stage } : null;
}

async function openTile(page: Page, label: string): Promise<void> {
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 180_000 });
  const selector = `button[aria-label="View candidate ${label} larger"]`;
  await page.waitForSelector(selector, { timeout: 180_000 });
  await page.click(selector);
  /* Wait on the thing, never on the clock — the panel can only render once the
     variants read has answered, and the database is remote. */
  await page.waitForSelector(".dpc-refine", { timeout: 120_000 });
  await page.waitForSelector(".dpc-viewer__wait", { timeout: 120_000 });
  /* One paint after both answers land. */
  await new Promise((resolve) => setTimeout(resolve, 1_200));
}

/**
 * RE-LAY THE ROWS IMMEDIATELY BEFORE EACH READING — the fixture AGES.
 *
 * The quiet arm is a row 3 minutes old, and it stops being that the moment the
 * drive takes four. A cold face scan can run past a minute, so a fixture seeded
 * once at the top would be read at six or seven minutes and the quiet arm would
 * fail for reasons that have nothing to do with the copy. Each arm therefore
 * gets a freshly stamped row, and the wire figure asserted beside it is what
 * proves the row was still in its window when the panel was photographed.
 */
function reseed(): void {
  const seeded = spawnSync("npx", ["tsx", "scripts/seed-wait-notice-disposable.mts"], {
    stdio: "pipe", encoding: "utf8", shell: true,
  });
  if (seeded.status !== 0) throw new Error(`seeding failed: ${seeded.stderr ?? ""}`);
}

async function shot(page: Page, name: string): Promise<void> {
  await writeFile(path.join(OUT, `${name}.png`), await page.screenshot({ type: "png" }) as Buffer);
}

async function shotOf(page: Page, selector: string, name: string): Promise<boolean> {
  const element = await page.$(selector);
  if (!element) return false;
  await writeFile(path.join(OUT, `${name}.png`), await element.screenshot({ type: "png" }) as Buffer);
  return true;
}

for (const theme of ["dark", "light"] as const) {
  const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
  try {
    await page.evaluateOnNewDocument((value) => {
      window.localStorage.setItem("drape_theme", value);
    }, theme);
    page.on("response", onResponse);

    /*
      WARM BOTH FACES FIRST. The panel's own scan is seconds-to-a-minute on a
      face nobody has read yet, and every one of those seconds is spent ageing
      the quiet arm out of its window. These two visits pay the scan; the reads
      below happen against a warm page and a freshly stamped row.
    */
    await openTile(page, "01");
    await openTile(page, "02");

    /* ── SPEAKS — 8 minutes old, past the new threshold ─────────────────── */
    reseed();
    await openTile(page, "01");
    const speaks = await page.evaluate(READ) as Read;
    const speaksRows = await fixtureRows();
    const speaksWire = wireFor("speaks");
    await shot(page, `${STAMP}-speaks-${theme}`);
    await shotOf(page, ".dpc-viewer__wait", `${STAMP}-speaks-viewerline-${theme}`);
    await shotOf(page, ".dpc-refine", `${STAMP}-speaks-panel-${theme}`);

    check(
      speaks.theme === theme,
      `${theme} SPEAKS: the page is actually painting the theme this pass is labelled`,
      `<html data-theme="${speaks.theme}">`,
    );
    check(
      speaksRows.SPEAKS?.status === "dispatched" && speaksRows.SPEAKS.ageS > 5 * 60,
      `${theme} SPEAKS: the fixture row was alive and past five minutes when it was read`,
      `row ${JSON.stringify(speaksRows.SPEAKS)}`,
    );
    check(
      speaksWire !== null && speaksWire.waitedMs > NEW_THRESHOLD_MS && speaksWire.stage !== "settling",
      `${theme} SPEAKS: the wire itself says the wait is past the new threshold`,
      `waitedMs=${speaksWire?.waitedMs} stage=${speaksWire?.stage} (threshold ${NEW_THRESHOLD_MS})`,
    );
    check(
      speaks.typical === NEW_LINE,
      `${theme} SPEAKS: the viewer promises the measured wait, in the founder's ruled words`,
      `the line on screen: "${speaks.typical}"`,
    );
    check(
      speaks.typical !== null && !speaks.typical.includes(OLD_LINE),
      `${theme} SPEAKS: and the old promise is nowhere on the picture`,
      `waitText="${speaks.waitText}"`,
    );
    check(
      speaks.clipped === false,
      `${theme} SPEAKS: the longer sentence is not truncated`,
      `scrollWidth > clientWidth: ${speaks.clipped} · rendered on ${speaks.lines} line(s)`,
    );
    check(
      speaks.insidePlate === true,
      `${theme} SPEAKS: and it stays inside the picture it is written over`,
      `line box within the plate: ${speaks.insidePlate}`,
    );
    check(
      speaks.note !== null,
      `${theme} SPEAKS: the panel admits the unusual wait and names the outcome`,
      `note: ${speaks.note ? `"${speaks.note}"` : "ABSENT"}`,
    );

    /* ── QUIET — 3 minutes old: yesterday's build would have spoken ─────── */
    reseed();
    await openTile(page, "02");
    const quiet = await page.evaluate(READ) as Read;
    const quietRows = await fixtureRows();
    const quietWire = wireFor("quiet");
    await shot(page, `${STAMP}-quiet-${theme}`);
    await shotOf(page, ".dpc-viewer__wait", `${STAMP}-quiet-viewerline-${theme}`);
    await shotOf(page, ".dpc-refine", `${STAMP}-quiet-panel-${theme}`);

    check(
      quietRows.QUIET?.status === "dispatched",
      `${theme} QUIET: the fixture row was still there when the panel said nothing`,
      `row ${JSON.stringify(quietRows.QUIET)}`,
    );
    check(
      quietWire !== null
        && quietWire.waitedMs > OLD_THRESHOLD_MS
        && quietWire.waitedMs < NEW_THRESHOLD_MS
        && quietWire.stage !== "settling",
      `${theme} QUIET: the wire puts the wait BETWEEN the old threshold and the new one`,
      `waitedMs=${quietWire?.waitedMs} stage=${quietWire?.stage}`
      + ` (old ${OLD_THRESHOLD_MS} < it < new ${NEW_THRESHOLD_MS})`,
    );
    check(
      quiet.panel && quiet.note === null,
      `${theme} QUIET: the panel is on screen and says nothing about an unusual wait`,
      `panel=${quiet.panel} note=${quiet.note ? `"${quiet.note}"` : "absent"}`
      + ` — yesterday's build would have spoken over this same row`,
    );
    check(
      quiet.typical === NEW_LINE,
      `${theme} QUIET: and the viewer still promises the measured wait`,
      `the line on screen: "${quiet.typical}"`,
    );
    check(
      quiet.clipped === false && quiet.insidePlate === true,
      `${theme} QUIET: the sentence fits here too`,
      `clipped=${quiet.clipped} insidePlate=${quiet.insidePlate} lines=${quiet.lines}`,
    );
  } finally {
    await browser.close();
  }
}

print();
console.log(`\nwire readings captured: ${wire.length}`);
for (const row of wire.slice(-6)) console.log(`  ${row.waitedMs} ms · ${row.stage} · ${row.instruction}`);
console.log(`\nscreenshots in ${OUT}`);
await conn.end();
process.exit(failures().length === 0 && records.length > 0 ? 0 : 1);
