/**
 * THE REGENERATE CONTROL — the founder's own ask (2026-08-15), driven.
 * (fable-579 §2: a dedicated action beside the typed offer, one machinery.)
 *
 * ```
 * PRESENT    on a version, beside Refine, and legible
 * NO PRICE   on the label (D-109); the price arrives in the question it raises
 * THE OFFER  pressing it raises the same question typing the words raises —
 *            one implementation, two doors — free, before anything is claimed
 * ABSENT     on the ORIGINAL, where there is no edit to re-roll
 * ```
 *
 * # The sequence is deliberate, and the first three attempts were not
 *
 * Selection is SERVER state on the candidate, so it survives the browser: a run
 * that ends on the Original leaves the next run starting there. And "click the
 * original, then click back" is a race between two round trips that says
 * nothing about the control. So each theme now: select a version and WAIT for
 * the control, press it, read the offer, then step to the original last —
 * and put a version back before leaving, so the next run starts where this one
 * started.
 *
 * Nothing is spent: the offer is free and this never confirms it.
 *
 *   npx tsx scripts/drive-regenerate-control-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3013";
const OUT = "output/regenerate-control";
mkdirSync(OUT, { recursive: true });
const records: { ok: boolean; name: string; saw: string }[] = [];
const check = (ok: boolean, name: string, saw: string) => {
  records.push({ ok, name, saw });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
};

const outsider = await ensureOutsider();
const conn = await openDatabase(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  `SELECT s.publicId FROM casting_sessions s JOIN casting_candidates c ON c.sessionId = s.id
    WHERE c.publicId = '3d7ee6cd-51d5-4fca-83a0-91f698db1c38' LIMIT 1`,
);
const session = (rows as Array<{ publicId: string }>)[0]!.publicId;
await conn.end();

const CHIP = "jet black";
const hasControl = () => Array.from(document.querySelectorAll(".dpc-refine__ask button"))
  .some((one) => /regenerate/i.test(one.textContent ?? ""));

for (const theme of ["dark", "light"] as const) {
  const { browser, page } = await openDrivenPage({ base: BASE, token: outsider.token, width: 1440, height: 1000 });
  const spends: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /castingV2\.(roll|sign)/.test(request.url())) {
      spends.push(request.url().slice(0, 80));
    }
  });
  try {
    await page.evaluateOnNewDocument((value) => window.localStorage.setItem("drape_theme", value), theme);
    await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 120_000 });
    await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 });
    await page.click('button[aria-label^="View candidate"]');
    await page.waitForSelector(".dpc-viewer__plate img", { timeout: 60_000 });
    await page.waitForSelector("[data-frame]", { timeout: 60_000 });

    /* Start from a VERSION, whatever the last run left selected. */
    await page.evaluate(`(() => {
      const chip = Array.from(document.querySelectorAll("[data-frame]"))
        .find((one) => /${CHIP}/i.test(one.textContent || ""));
      if (chip) chip.setAttribute("data-probe", "version");
    })()`);
    await page.click('[data-probe="version"]').catch(() => null);
    const arrived = await page.waitForFunction(hasControl, { timeout: 30_000 })
      .then(() => true).catch(() => false);
    check(arrived, `${theme}: the control is there on a version`,
      arrived ? "beside Refine" : "it never appeared");

    const label = await page.evaluate(`(() => {
      const button = Array.from(document.querySelectorAll(".dpc-refine__ask button"))
        .find((b) => /regenerate/i.test(b.textContent || ""));
      return button ? (button.textContent || "").trim() : null;
    })()`) as string | null;
    check(label !== null && !/\d/.test(label), `${theme}: its label carries no price`, label ?? "no label");
    writeFileSync(`${OUT}/${theme}-on-version.png`, await page.screenshot({ fullPage: false }));

    /* PRESS IT — the offer, free. */
    await page.evaluate(`(() => {
      const button = Array.from(document.querySelectorAll(".dpc-refine__ask button"))
        .find((b) => /regenerate/i.test(b.textContent || ""));
      if (button) button.setAttribute("data-probe", "regen");
    })()`);
    await page.click('[data-probe="regen"]').catch(() => null);
    const asked = await page.waitForFunction(
      () => document.querySelectorAll(".dpc-refine__answer").length > 0,
      { timeout: 90_000 },
    ).then(() => true).catch(() => false);
    const question = await page.evaluate(`(() => {
      const line = (document.body.innerText || "").split(String.fromCharCode(10))
        .find((one) => /fresh take/i.test(one));
      return line || null;
    })()`) as string | null;
    check(asked && Boolean(question), `${theme}: pressing it raises the offer`, question ?? "no question appeared");
    check(/\d+\s*credits/i.test(question ?? ""), `${theme}: with the price, before the money`,
      question ?? "no price");
    writeFileSync(`${OUT}/${theme}-offer.png`, await page.screenshot({ fullPage: false }));

    /* AND THE ORIGINAL, last: no edit to re-roll, so no control. */
    await page.click('button[aria-label="The original"]').catch(() => null);
    const gone = await page.waitForFunction(
      () => !Array.from(document.querySelectorAll(".dpc-refine__ask button"))
        .some((one) => /regenerate/i.test(one.textContent ?? "")),
      { timeout: 30_000 },
    ).then(() => true).catch(() => false);
    check(gone, `${theme}: and absent on the original`, gone ? "absent" : "still there");
    writeFileSync(`${OUT}/${theme}-on-original.png`, await page.screenshot({ fullPage: false }));

    check(spends.length === 0, `${theme}: nothing was rolled or signed`,
      spends.length === 0 ? "no spending call" : spends.join(" | "));

    /* Leave a version selected, so the next run starts where this one did. */
    await page.evaluate(`(() => {
      const chip = Array.from(document.querySelectorAll("[data-frame]"))
        .find((one) => /${CHIP}/i.test(one.textContent || ""));
      if (chip) chip.setAttribute("data-probe", "restore");
    })()`);
    await page.click('[data-probe="restore"]').catch(() => null);
    await page.waitForFunction(hasControl, { timeout: 30_000 }).catch(() => null);
  } finally {
    await browser.close();
  }
}

const failed = records.filter((row) => !row.ok);
console.log(`\n${records.length - failed.length}/${records.length} · shots in ${OUT}/`);
writeFileSync(`${OUT}/checks.json`, `${JSON.stringify(records, null, 2)}\n`);
process.exit(failed.length === 0 ? 0 : 1);
