/**
 * THE PANEL FILLS A ROW AT A TIME, PHOTOGRAPHED (fable-521 §3).
 *
 * The skeleton driver proved a fresh cast keeps a PLACE for every row. This is
 * the next claim and it cannot be asserted from source: that the places are
 * filled **progressively** as each feature is read, rather than all at once
 * when the slowest of fourteen questions returns.
 *
 * The reading that makes it a measurement rather than a screenshot: sample the
 * panel every 300ms from first paint to settled, and require a sample where
 * SOME rows are answered and some are not. All-at-once fails that by
 * construction — it goes from 0 answered to all answered between two samples,
 * with nothing in between — so the check can fail, which is the whole point.
 *
 *   npx tsx scripts/drive-panel-live-fill-disposable.mts
 *   THEME=light npx tsx scripts/drive-panel-live-fill-disposable.mts
 *
 * NOTE: only a COLD scan can show this. A face already read in this server
 * process paints its answers immediately, which measures the cache rather than
 * the fill — pick another face with FACE_OFFSET rather than softening it.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage, createChecks } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/panel-live-fill");
const THEME = process.env.THEME ?? "dark";
const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required");

const connection = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await connection.query<any[]>("SELECT openId FROM users WHERE id = 1");
const [rows] = await connection.query<any[]>(
  `SELECT s.publicId AS session, c.position
     FROM casting_candidates c
     JOIN casting_sessions s ON s.id = c.sessionId
    WHERE c.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
    ORDER BY c.id DESC LIMIT 1 OFFSET ${Number(process.env.FACE_OFFSET ?? "0")}`,
);
await connection.end();
if (rows.length === 0) throw new Error("no ready candidate in the dev database");
const session = rows[0].session;
const tile = String(rows[0].position + 1).padStart(2, "0");

const token = await new SignJWT({ openId: owners[0].openId, appId, name: "Panel live fill" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { check, print, failures } = createChecks();
const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1500, height: 1000 });

const readPanel = async () => await page.evaluate(`(() => {
  const rows = Array.from(document.querySelectorAll(".dpc-face__row"));
  const image = document.querySelector(".dpc-viewer__plate img");
  const rect = image ? image.getBoundingClientRect() : null;
  return {
    rows: rows.length,
    pending: rows.filter((row) => row.getAttribute("data-state") === "pending").length,
    settled: rows.filter((row) => row.getAttribute("data-state") === "settled").length,
    working: Boolean(document.querySelector(".dpc-face__working")),
    image: rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null,
    imageComplete: image ? Boolean(image.complete && image.naturalWidth > 0) : false,
  };
})()`) as any;

try {
  await page.evaluateOnNewDocument(`(() => {
    try { window.localStorage.setItem("drape_theme", ${JSON.stringify(THEME)}); } catch {}
  })()`);
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-viewer__plate img", { timeout: 120_000 });
  await page.waitForSelector(".dpc-face__row", { timeout: 60_000 });

  const first = await readPanel();
  await page.screenshot({ path: `${OUT}/1-skeleton-${THEME}.png` });

  /* EVERY 300ms UNTIL IT SETTLES, and a photograph of the first partial state
     we see — the shot the founder reads beside the skeleton and the settled. */
  const samples: any[] = [first];
  let midway: any = null;
  for (let at = 0; at < 400; at += 1) {
    const now = await readPanel();
    samples.push(now);
    if (midway === null && now.settled > 0 && now.pending > 0) {
      midway = now;
      await page.screenshot({ path: `${OUT}/2-midway-${THEME}.png` });
    }
    if (now.rows > 0 && now.pending === 0 && !now.working) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const settled = await readPanel();
  await page.screenshot({ path: `${OUT}/3-settled-${THEME}.png` });

  const partials = samples.filter((one) => one.settled > 0 && one.pending > 0).length;
  check(
    midway !== null,
    "the panel fills a feature at a time rather than all at once",
    `${partials} of ${samples.length} samples had SOME rows answered and some still pending`
      + (midway ? ` (first at ${midway.settled} answered, ${midway.pending} pending)` : ""),
  );
  check(
    settled.pending === 0 && settled.rows > 0,
    "and it does settle — every row ends as this version's own answer",
    `${settled.rows} rows, ${settled.settled} settled`,
  );
  check(
    samples.every((one) => one.imageComplete && (one.image?.width ?? 0) > 200),
    "the photograph is never in a loading state, at any sample",
    `${samples.length} samples, smallest ${Math.min(...samples.map((one) => one.image?.width ?? 0))}px wide`,
  );

  await writeFile(
    `${OUT}/readings-${THEME}.json`,
    JSON.stringify({ first, midway, settled, samples }, null, 2),
  );
} finally {
  print();
  await browser.close();
}
process.exit(failures().length > 0 ? 1 : 0);
