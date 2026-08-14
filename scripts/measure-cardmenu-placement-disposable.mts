/**
 * WHERE EVERY CardMenu PANEL LANDS — measured before and after the anchor
 * option, so a shared component's other callers are proved untouched
 * (fable-543 §2).
 *
 * The chip's menu opens leftward into the gutter because the panel's RIGHT edge
 * is aligned to the trigger's, which is right for a card in a grid and wrong
 * for a chip on the far-left rail. The fix is a per-usage anchor — and the
 * caution it deserves is the one Fable named: the sheet's and roster's menus
 * must be byte-identical afterwards, answered with an arm rather than by
 * avoiding the change.
 *
 *   npx tsx scripts/measure-cardmenu-placement-disposable.mts        (writes before.json)
 *   AFTER=1 npx tsx scripts/measure-cardmenu-placement-disposable.mts (compares)
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { SignJWT } from "jose";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage, createChecks } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/cardmenu-placement");
mkdirSync(OUT, { recursive: true });
const AFTER = process.env.AFTER === "1";

const connection = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await connection.query<any[]>("SELECT openId FROM users WHERE id = 1");
const [rows] = await connection.query<any[]>(
  `SELECT s.publicId AS session, c.position
     FROM casting_candidates c
     JOIN casting_sessions s ON s.id = c.sessionId
     JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE c.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
    GROUP BY c.id HAVING MAX(JSON_LENGTH(v.instructions)) >= 2
    ORDER BY MAX(JSON_LENGTH(v.instructions)) DESC LIMIT 1`,
);
await connection.end();
const session = rows[0].session;
const tile = String(rows[0].position + 1).padStart(2, "0");

const token = await new SignJWT({ openId: owners[0].openId, appId: process.env.VITE_APP_ID!, name: "Menu placement" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

const { check, print, failures } = createChecks();
const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1500, height: 1000 });

/** The panel's box relative to the TRIGGER that opened it — placement, not position. */
const relativePlacement = async () => await page.evaluate(`(() => {
  const trigger = document.querySelector('.dpc-cardmenu__trigger[aria-expanded="true"]');
  const panel = document.querySelector(".dpc-cardmenu__panel");
  if (!trigger || !panel) return null;
  const t = trigger.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  return {
    dTop: Math.round(p.top - t.bottom),
    dLeft: Math.round(p.left - t.left),
    dRight: Math.round(p.right - t.right),
    width: Math.round(p.width),
  };
})()`) as any;

const readings: Record<string, unknown> = {};
try {
  /*
    THE SHEET CARD's own menu lives on the casting INDEX, not on a sheet — the
    caller that must not move, so it is measured where it actually is. The dots
    are ABSENT until the card is pointed at (the reveal ladder's first rung), so
    the driver hovers like a person before it can find the control at all.
  */
  await page.goto(`${BASE}/casting`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(".dpc-menuhost", { timeout: 120_000 });
  await page.hover(".dpc-menuhost");
  await page.waitForSelector(".dpc-cardmenu__trigger", { timeout: 30_000 });
  await page.evaluate(`(() => { document.querySelector(".dpc-cardmenu__trigger").click(); })()`);
  await page.waitForSelector(".dpc-cardmenu__panel", { timeout: 10_000 });
  readings.sheetCard = await relativePlacement();
  await page.keyboard.press("Escape");

  /* THE RAIL CHIP's menu — the one that should change. */
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-refine__step", { timeout: 120_000 });
  await page.evaluate(`(() => {
    const triggers = document.querySelectorAll(".dpc-refine__step .dpc-cardmenu__trigger");
    (triggers[triggers.length - 1]).click();
  })()`);
  await page.waitForSelector(".dpc-cardmenu__panel", { timeout: 10_000 });
  readings.railChip = await relativePlacement();

  if (!AFTER) {
    writeFileSync(`${OUT}/before.json`, `${JSON.stringify(readings, null, 2)}\n`);
    console.log("BEFORE:", JSON.stringify(readings));
  } else {
    const before = JSON.parse(readFileSync(`${OUT}/before.json`, "utf8"));
    writeFileSync(`${OUT}/after.json`, `${JSON.stringify(readings, null, 2)}\n`);
    check(
      JSON.stringify(readings.sheetCard) === JSON.stringify(before.sheetCard),
      "the SHEET CARD's menu lands exactly where it did — the shared component's other callers are untouched",
      `before ${JSON.stringify(before.sheetCard)} · after ${JSON.stringify(readings.sheetCard)}`,
    );
    const chip = readings.railChip as { dLeft: number; dRight: number };
    check(
      Math.abs(chip.dLeft) <= 8,
      "and the CHIP's menu now opens from the chip rather than into the gutter",
      `before ${JSON.stringify(before.railChip)} · after ${JSON.stringify(chip)}`,
    );
  }
} finally {
  if (AFTER) print();
  await browser.close();
}
process.exit(failures().length > 0 ? 1 : 0);
