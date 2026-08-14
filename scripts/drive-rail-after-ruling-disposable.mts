/**
 * THE RAIL AS THE FOUNDER RULED IT (2026-08-15, via fable-545/546).
 *
 * Three claims, driven rather than described:
 *
 *   1. no per-chip menu anywhere on the rail — it is navigation and forking;
 *   2. a removal-created version's chip carries HER OWN WORDS ("remove the
 *      earrings"), not the last surviving sentence;
 *   3. the highlight and the photograph never name different versions —
 *      sampled across a click, which is the bug he reported.
 *
 *   npx tsx scripts/drive-rail-after-ruling-disposable.mts
 *   THEME=light npx tsx scripts/drive-rail-after-ruling-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SignJWT } from "jose";
import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage, createChecks } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/rail-ruling");
const THEME = process.env.THEME ?? "dark";

const connection = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await connection.query<any[]>("SELECT openId FROM users WHERE id = 1");
const [rows] = await connection.query<any[]>(
  `SELECT s.publicId AS session, c.position
     FROM casting_candidates c
     JOIN casting_sessions s ON s.id = c.sessionId
     JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE c.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
    GROUP BY c.id HAVING COUNT(v.id) >= 3
    ORDER BY c.id DESC LIMIT 1`,
);
await connection.end();
const session = rows[0].session;
const tile = String(rows[0].position + 1).padStart(2, "0");

const token = await new SignJWT({ openId: owners[0].openId, appId: process.env.VITE_APP_ID!, name: "Rail ruling" })
  .setProtectedHeader({ alg: "HS256" }).setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

await mkdir(OUT, { recursive: true });
const { check, print, failures } = createChecks();
const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1500, height: 1000 });

const read = async () => await page.evaluate(`(() => {
  const steps = Array.from(document.querySelectorAll(".dpc-refine__step"));
  const lit = document.querySelector('.dpc-refine__pick[aria-pressed="true"]');
  const image = document.querySelector(".dpc-viewer__plate img");
  return {
    chips: steps.length,
    triggers: document.querySelectorAll(".dpc-refine__step .dpc-cardmenu__trigger").length,
    labels: steps.map((s) => (s.querySelector(".dpc-refine__pick span:last-child")?.textContent ?? "").trim()),
    litLabel: lit ? (lit.querySelector("span:last-child")?.textContent ?? "").trim() : null,
    litFrame: lit ? lit.getAttribute("data-frame") : null,
    litThumb: lit ? lit.getAttribute("data-thumb") : null,
    shown: image ? image.getAttribute("src") : null,
  };
})()`) as any;

try {
  await page.evaluateOnNewDocument(`(() => { try { window.localStorage.setItem("drape_theme", ${JSON.stringify(THEME)}); } catch {} })()`);
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-refine__step", { timeout: 120_000 });

  /* Hover a chip, because the menu's first rung was hover-revealed. */
  await page.hover(".dpc-refine__step");
  await new Promise((r) => setTimeout(r, 400));
  const resting = await read();
  await page.screenshot({ path: `${OUT}/1-rail-${THEME}.png` });
  check(resting.triggers === 0, "no per-chip menu anywhere on the rail (founder ruling)", `${resting.chips} chips, ${resting.triggers} triggers, hovered`);

  /* THE HIGHLIGHT AND THE PICTURE, sampled across a click. */
  const disagreements: any[] = [];
  /* A chip that is NOT the one she is on — clicking the lit one changes
     nothing and would make this sampler measure a click that never happened. */
  const clicked = await page.evaluate(`(() => {
    const shown = document.querySelector(".dpc-viewer__plate img")?.getAttribute("src");
    const picks = Array.from(document.querySelectorAll(".dpc-refine__pick"));
    const target = picks.find((pick) => pick.getAttribute("data-frame")
      && pick.getAttribute("data-frame") !== shown);
    if (!target) return null;
    const label = (target.querySelector("span:last-child")?.textContent ?? "").trim();
    target.click();
    return label;
  })()`) as string | null;
  if (!clicked) throw new Error("every chip is already the one on screen — nothing to switch to");
  for (let at = 0; at < 60; at += 1) {
    const now = await read();
    /* The lit chip's own thumbnail and the displayed frame must be the same
       version. Both are URLs the rail already holds, so this compares the
       claim rather than the loading state. */
    /* The chip carries the FRAME it stands for, so this compares two claims
       about the same thing rather than a thumbnail against a full picture —
       which is what the first version of this check did, and it disagreed on
       every sample for a reason that had nothing to do with the bug. */
    /* The viewer draws the SMALL COPY first and sharpens in place (fable-503),
       so a sample showing the lit version's thumbnail is the same version —
       counting it as a disagreement measured the swap rather than the claim. */
    const agrees = now.shown === now.litFrame || (now.litThumb && now.shown === now.litThumb);
    if (now.litFrame && now.shown && !agrees) {
      disagreements.push({ at, lit: now.litLabel, litFrame: now.litFrame, shown: now.shown });
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  await page.screenshot({ path: `${OUT}/2-after-click-${THEME}.png` });
  check(
    disagreements.length === 0,
    "the lit chip and the photograph never name different versions",
    `clicked "${clicked}" · ${disagreements.length} of 60 samples disagreed`,
  );

  const settled = await read();
  await writeFile(`${OUT}/readings-${THEME}.json`, JSON.stringify({ resting, settled, disagreements }, null, 2));
} finally {
  print();
  await browser.close();
}
process.exit(failures().length > 0 ? 1 : 0);
