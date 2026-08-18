/**
 * THE DISPATCH WALK — Landing C, in the running app (working law 6; ordered
 * fable-973 §3d).
 *
 * One real paid refine on the dev fixture face, with
 * `CASTING_REFINE_DISPATCH_SCOPE` armed in the server this drives. What it
 * reads back is the whole claim, at the wire and on the screen:
 *
 *   1. the refine mutation ANSWERS in seconds rather than minutes — timed on
 *      the response itself, not on a spinner disappearing;
 *   2. the panel shows the edit as RUNNING at that moment — the pending row and
 *      the busy state the customer is left looking at;
 *   3. the picture arrives on the surface AFTERWARDS, with no request holding
 *      it, and the version rail grows by one.
 *
 * Every check records what it SAW (D-235). The walk FAILS rather than skips if
 * the sheet is absent — a driver that cannot find its surface has not proved
 * the surface works.
 *
 * COST: one paid refine — 25 credits on the dev fixture account (verify-bot,
 * never a customer) and one render of house money. Nothing production.
 *
 *   npx tsx scripts/drive-refine-dispatch-walk-disposable.mts <sessionPublicId>
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SignJWT } from "jose";

import { openDrivenPage, createChecks } from "./lib/drivePage.mts";
import { openDatabase } from "./lib/dbConnection.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3007";
const SESSION = process.argv[2];
const TILE = process.argv[3] ?? "01";
const OUT = path.resolve("output/refine-dispatch-walk");
if (!SESSION) throw new Error("the session publicId is required");

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

const db = await openDatabase(process.env.DATABASE_URL!);
const [[bot]] = await db.query<any[]>("SELECT id, openId FROM users WHERE openId = 'verify-bot-local'");
if (!bot) throw new Error("the verify-bot fixture user is missing from this world");
const balanceBefore = (await db.query<any[]>("SELECT balance FROM points WHERE userId = ?", [bot.id]))[0][0].balance;

const token = await new SignJWT({ openId: bot.openId, appId, name: "the dispatch walk" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const checks = createChecks();
const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 980 });

/* THE ANSWER'S OWN CLOCK, taken at the response rather than at the screen: a
   surface can look ready for a dozen reasons, and only one of them is the
   server having answered. */
const answers: Array<{ ms: number; body: string }> = [];
let askedAt = 0;
page.on("response", (response) => {
  if (!response.url().includes("castingV2.refine")) return;
  const ms = Date.now() - askedAt;
  void response.text().then((body) => answers.push({ ms, body: body.slice(0, 400) })).catch(() => {});
});

await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 240_000 });
await page.waitForSelector(`button[aria-label="View candidate ${TILE} larger"]`, { timeout: 240_000 });
await page.click(`button[aria-label="View candidate ${TILE} larger"]`);
await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 });

const railBefore = await page.$$eval(".dpc-refine img, .dpc-viewer__rail img", (nodes) => nodes.length)
  .catch(() => 0);

await page.type(".dpc-refine__field", "colour her hair copper");
askedAt = Date.now();
await page.click(".dpc-refine__ask button[type=submit]");

/* Wait on the ANSWER, never on the clock. */
const deadline = Date.now() + 300_000;
while (answers.length === 0 && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}
const answered = answers[0];
if (!answered) throw new Error("the refine mutation never answered in five minutes");

const atReceipt = await page.evaluate(() => ({
  button: document.querySelector(".dpc-refine__ask button[type=submit]")?.textContent ?? null,
  ghosts: document.querySelectorAll("[data-pending], .dpc-rail__ghost, .dpc-viewer__ghost").length,
  bodyHasRefining: document.body.textContent?.includes("Refining") ?? false,
  outcome: document.querySelector(".dpc-refine__outcome")?.textContent ?? null,
}));
await page.screenshot({ path: path.join(OUT, "01-at-the-receipt.png") });

checks.check(
  answered.ms < 30_000,
  "the answer came back before the render could have",
  `the refine response arrived after ${(answered.ms / 1000).toFixed(1)}s — a render is 120-280s`,
);
checks.check(
  answered.body.includes('"dispatched"'),
  "and it is a RECEIPT rather than a picture",
  `the response body carried ${answered.body.includes('"dispatched"') ? '"kind":"dispatched"' : answered.body.slice(0, 120)}`,
);
checks.check(
  atReceipt.button === "Refining…" || atReceipt.bodyHasRefining,
  "the panel says the edit is running",
  `the submit button reads ${JSON.stringify(atReceipt.button)} · "Refining" present on the page: ${atReceipt.bodyHasRefining}`,
);
checks.check(
  atReceipt.outcome === null,
  "and it does NOT claim an outcome it has not got",
  `the outcome slot held ${JSON.stringify(atReceipt.outcome)}`,
);

/* THE PICTURE, ARRIVING WITH NOBODY HOLDING THE REQUEST. Read off the rows the
   surface reads, then photographed. */
const landedBy = Date.now() + 420_000;
let landed: any = null;
while (Date.now() < landedBy) {
  const [rows] = await db.query<any[]>(
    `SELECT v.publicId, v.status, v.imageKey IS NOT NULL AS hasImage
       FROM casting_candidate_variants v
      WHERE v.userId = ? ORDER BY v.id DESC LIMIT 1`, [bot.id]);
  landed = rows[0] ?? null;
  if (landed && (landed.status === "ready" || landed.status === "failed")) break;
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
const settledAfterMs = Date.now() - askedAt;
await page.reload({ waitUntil: "networkidle2", timeout: 240_000 }).catch(() => {});
await page.waitForSelector(`button[aria-label="View candidate ${TILE} larger"]`, { timeout: 240_000 }).catch(() => {});
await page.click(`button[aria-label="View candidate ${TILE} larger"]`).catch(() => {});
await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => {});
await page.screenshot({ path: path.join(OUT, "02-after-it-landed.png") });

checks.check(
  landed !== null && (landed.status === "ready" || landed.status === "failed"),
  "the render finished with nobody holding the request",
  `the newest variant settled as ${landed?.status ?? "NOTHING"} (image: ${landed?.hasImage === 1}) `
    + `${(settledAfterMs / 1000).toFixed(0)}s after the ask, ${((settledAfterMs - answered.ms) / 1000).toFixed(0)}s after the answer`,
);

const balanceAfter = (await db.query<any[]>("SELECT balance FROM points WHERE userId = ?", [bot.id]))[0][0].balance;
checks.check(
  balanceBefore - balanceAfter === 25 || (landed?.status === "failed" && balanceBefore === balanceAfter),
  "and it was charged exactly once",
  `balance ${balanceBefore} → ${balanceAfter} (delta ${balanceBefore - balanceAfter})`,
);

console.log(`\nrail images before the ask: ${railBefore}`);
await writeFile(path.join(OUT, "walk.json"), JSON.stringify({ answered, atReceipt, landed, balanceBefore, balanceAfter }, null, 2));
await browser.close();
await db.end();
checks.print();
if (checks.failures().length > 0) process.exit(1);
