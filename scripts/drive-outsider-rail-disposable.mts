/**
 * THE VERSION RAIL, FROM OUTSIDE THE REPAINT ROAD. (fable-560 §4 — a costless
 * walk, filed-not-fixed.)
 *
 * The rail was rebuilt this shift to the founder's ruling: pure version
 * history, no per-chip menu, each chip carrying the user's OWN WORDS, and the
 * lit chip riding the same override object as the photograph so the highlight
 * cannot lag the picture. Every one of those was driven as the founder — the
 * account inside every flag.
 *
 * This drives the same surface as the outsider, whose three versions were made
 * on the OLD road (`CASTING_REPAINT_SCOPE` undefined on this server) by the
 * take-back probe: master → "give her gold hoop earrings" → the same ask again.
 *
 * ```
 * 1  a chip per version, and no more
 * 2  the chip's words are the USER'S words, not the version-before's
 * 3  no per-chip menu, on a HOVERED chip — the dots were hover-revealed, so a
 *    resting check passes on a control that appears the moment you approach it
 * 4  clicking a chip changes the PICTURE, and the lit chip is that picture —
 *    sampled across the click rather than after it
 * 5  nothing spends
 * ```
 *
 * No credits, no generation, no segmenter call.
 *
 *   pnpm dev            (separate terminal)
 *   npx tsx scripts/drive-outsider-rail-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDrivenPage } from "./lib/drivePage.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/outsider-rail";
mkdirSync(OUT, { recursive: true });
const THEMES = ["dark", "light"] as const;

const records: { ok: boolean; name: string; saw: string }[] = [];
const check = (ok: boolean, name: string, saw: string) => {
  records.push({ ok, name, saw });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
};

const outsider = await ensureOutsider();
console.log(`outsider ${outsider.id} · sheet ${outsider.sessionPublicId}\n`);

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
    await page.goto(`${BASE}/casting/s/${outsider.sessionPublicId}`, { waitUntil: "networkidle2", timeout: 180_000 });
    await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 180_000 });
    const label = await page.evaluate(() => document.querySelector('button[aria-label^="View candidate"]')!.getAttribute("aria-label"));
    await page.click(`button[aria-label="${label}"]`);
    await page.waitForFunction(() => {
      const img = document.querySelector(".dpc-viewer__plate img") as HTMLImageElement | null;
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, { timeout: 90_000 });
    await page.waitForSelector("[data-frame]", { timeout: 60_000 });

    const rail = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll("[data-frame]"));
      return {
        count: chips.length,
        labels: chips.map((chip) => (chip.textContent ?? "").trim()).filter(Boolean),
        frames: chips.map((chip) => chip.getAttribute("data-frame")),
        onScreen: (document.querySelector(".dpc-viewer__plate img") as HTMLImageElement | null)?.src ?? null,
      };
    });
    check(rail.count >= 3, `${theme}: a chip per version`, `${rail.count} chips — ${rail.labels.join(" | ")}`);
    check(
      rail.labels.some((one) => one.toLowerCase().includes("earring")),
      `${theme}: a chip carries the user's own words`,
      rail.labels.join(" | "),
    );

    /* THE MENU'S ABSENCE, ON A HOVERED CHIP. A resting check would pass on a
       control that only appears when approached (fable-549 §1). */
    const chipBox = await page.evaluate(() => {
      const chip = document.querySelector("[data-frame]") as HTMLElement | null;
      if (!chip) return null;
      const box = chip.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    if (chipBox) await page.mouse.move(chipBox.x, chipBox.y);
    const triggers = await page.evaluate(() =>
      document.querySelectorAll(".dpc-cardmenu__trigger, .dpc-cardmenu__panel").length);
    check(triggers === 0, `${theme}: no per-chip menu on a hovered chip`, `${triggers} menu elements while hovering`);

    /* CLICK A CHIP THAT IS NOT THE ONE ON SCREEN — clicking the selected one
       measures a click that never happened (fable-549 §3) — and sample ACROSS
       the click, because the bug this replaced was a lag. */
    const target = await page.evaluate(() => {
      const img = document.querySelector(".dpc-viewer__plate img") as HTMLImageElement | null;
      const chips = Array.from(document.querySelectorAll("[data-frame]")) as HTMLElement[];
      const other = chips.find((chip) => chip.getAttribute("data-frame") !== img?.src);
      if (!other) return null;
      other.setAttribute("data-probe", "target");
      return other.getAttribute("data-frame");
    });
    if (target) {
      await page.click('[data-probe="target"]');
      const samples: { picture: string | null; lit: string | null }[] = [];
      for (let at = 0; at < 40; at += 1) {
        samples.push(await page.evaluate(() => {
          const img = document.querySelector(".dpc-viewer__plate img") as HTMLImageElement | null;
          const lit = document.querySelector('[data-frame][aria-current="true"], [data-frame][data-selected="true"], [data-frame].is-selected');
          return { picture: img?.src ?? null, lit: lit?.getAttribute("data-frame") ?? null };
        }));
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const settled = samples[samples.length - 1]!;
      check(settled.picture === target, `${theme}: clicking a chip changes the picture`,
        `on screen ${settled.picture?.slice(-24) ?? "none"} · asked for ${target.slice(-24)}`);
      const disagreements = samples.filter((one) => one.lit !== null && one.picture !== null && one.lit !== one.picture).length;
      check(disagreements === 0, `${theme}: the lit chip is the picture, across the click`,
        `${disagreements} of ${samples.length} samples disagreed`);
    } else {
      check(false, `${theme}: a chip other than the one on screen exists to click`, "every chip matched the picture");
    }

    check(spends.length === 0, `${theme}: nothing spent`, spends.length === 0 ? "no spending call" : spends.join(" | "));
    writeFileSync(`${OUT}/${theme}.png`, await page.screenshot({ fullPage: false }));
    writeFileSync(`${OUT}/${theme}.json`, `${JSON.stringify(rail, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

const failed = records.filter((row) => !row.ok);
console.log(`\n${records.length - failed.length}/${records.length} · shots in ${OUT}/`);
writeFileSync(`${OUT}/checks.json`, `${JSON.stringify(records, null, 2)}\n`);
process.exit(failed.length === 0 ? 0 : 1);
