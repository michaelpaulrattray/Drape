/**
 * NO FINISHED-LOOKING EMPTY SHEET. (Founder YES, 2026-08-15, fable-563 §1.)
 *
 * The outsider walk measured a four-second hole: the sheet painted its chrome,
 * its brief box and its price line in 4ms — no skeleton, no spinner, no word —
 * and her faces arrived 3,878ms later. Every instrument called that page
 * finished while the thing she opened it for was absent.
 *
 * This drives the fix the way the defect was found: by SAMPLING from the moment
 * of navigation, not by looking once at the end.
 *
 * ```
 * NEVER EMPTY   from first paint to her faces, every sample shows either
 *               skeletons or tiles — never a grid with nothing in it
 * NEVER LYING   the placeholder carries no "CASTING 0n" label on a cold open;
 *               nothing is being cast, the faces already exist
 * FILLS         the tiles do arrive, and the skeletons go
 * NOTHING SPENT watched at the wire
 * ```
 *
 * Both themes, shots kept, every check records what it SAW.
 *
 *   pnpm dev            (separate terminal)
 *   npx tsx scripts/drive-sheet-skeleton-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDrivenPage } from "./lib/drivePage.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/sheet-skeleton";
mkdirSync(OUT, { recursive: true });
const THEMES = ["dark", "light"] as const;

const records: { ok: boolean; name: string; saw: string }[] = [];
const check = (ok: boolean, name: string, saw: string) => {
  records.push({ ok, name, saw });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
};

const outsider = await ensureOutsider();
if (!outsider.sessionPublicId) throw new Error("the outsider has no sheet");

for (const theme of THEMES) {
  const { browser, page } = await openDrivenPage({ base: BASE, token: outsider.token, width: 1440, height: 1000 });
  const spends: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (request.method() === "POST" && /castingV2\.(refine|roll|sign)/.test(url)) spends.push(url.slice(0, 160));
  });
  try {
    await page.evaluateOnNewDocument((value) => {
      window.localStorage.setItem("drape_theme", value);
    }, theme);

    /* Navigate WITHOUT waiting for the network to settle, so the sampler starts
       inside the window the defect lived in. */
    const started = Date.now();
    await page.goto(`${BASE}/casting/s/${outsider.sessionPublicId}`, { waitUntil: "domcontentloaded", timeout: 180_000 });

    const samples: { at: number; skeletons: number; tiles: number; labels: number; grid: boolean }[] = [];
    let filledAt: number | null = null;
    for (let n = 0; n < 120 && filledAt === null; n += 1) {
      const shot = await page.evaluate(() => {
        const grid = document.querySelector(".dp-grid");
        return {
          grid: Boolean(grid),
          skeletons: document.querySelectorAll(".dp-skeleton").length,
          tiles: document.querySelectorAll('button[aria-label^="View candidate"]').length,
          labels: document.querySelectorAll(".dp-skeleton__label").length,
        };
      });
      const at = Date.now() - started;
      samples.push({ at, ...shot });
      if (shot.tiles > 0) filledAt = at;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    /* The window under test: from the first sample that has a grid, to the
       first that has tiles. An empty grid in there is the defect. */
    const inWindow = samples.filter((one) => one.grid && (filledAt === null || one.at <= filledAt));
    const empty = inWindow.filter((one) => one.skeletons === 0 && one.tiles === 0);
    check(inWindow.length > 0, `${theme}: the sampler saw the loading window`,
      `${samples.length} samples, grid from ${inWindow[0]?.at ?? "never"}ms, tiles at ${filledAt ?? "never"}ms`);
    check(empty.length === 0, `${theme}: never a grid with nothing in it`,
      empty.length === 0
        ? `0 of ${inWindow.length} samples empty`
        : `${empty.length} empty samples, first at ${empty[0]!.at}ms`);
    const maxSkeletons = Math.max(0, ...samples.map((one) => one.skeletons));
    check(maxSkeletons > 0, `${theme}: placeholders actually appeared`, `${maxSkeletons} skeletons at their peak`);
    const labelled = samples.filter((one) => one.labels > 0).length;
    check(labelled === 0, `${theme}: the placeholder claims nothing`,
      labelled === 0 ? "no CASTING 0n label on a cold open" : `${labelled} samples carried a label`);
    check(filledAt !== null, `${theme}: her faces arrive and the placeholders go`,
      filledAt === null ? "no tiles within 6s" : `tiles at ${filledAt}ms`);
    check(spends.length === 0, `${theme}: nothing spent`, spends.length === 0 ? "no spending call" : spends.join(" | "));

    writeFileSync(`${OUT}/${theme}-samples.json`, `${JSON.stringify(samples, null, 2)}\n`);
    writeFileSync(`${OUT}/${theme}-filled.png`, await page.screenshot({ fullPage: false }));

    /* And one shot INSIDE the window, taken on a second load so the picture is
       of the state itself rather than of a memory of it. */
    await page.goto(`${BASE}/casting`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.goto(`${BASE}/casting/s/${outsider.sessionPublicId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(() => document.querySelectorAll(".dp-skeleton").length > 0, { timeout: 10_000 }).catch(() => null);
    writeFileSync(`${OUT}/${theme}-loading.png`, await page.screenshot({ fullPage: false }));
  } finally {
    await browser.close();
  }
}

const failed = records.filter((row) => !row.ok);
console.log(`\n${records.length - failed.length}/${records.length} · shots in ${OUT}/`);
writeFileSync(`${OUT}/checks.json`, `${JSON.stringify(records, null, 2)}\n`);
process.exit(failed.length === 0 ? 0 : 1);
