/**
 * THE PAID TATTOO WALK — his own reference photographs, his own three ask
 * shapes, frames for his eyes (authorized fable-1159, sited in DEV fable-1164).
 *
 * > *"you already have reference photos ive provided test your heart away then
 * > ill get eyes on."*
 *
 * # WHAT IT WALKS, and the three shapes are his (fable-1158 §2, fable-1160)
 *
 *   1  WHOLE DESIGN        a design sheet, no person in it — the `rideWhole`
 *                          route, and the simplest thing the road can be asked
 *   2  REGION-COLLECTION   *"copy his right arm sleeve"* — many tattoos on one
 *                          person, one region named
 *   3  SINGLE MOTIF        *"the mask tattoo on his stomach"* — one piece out
 *                          of many, the attempt-and-preview shape
 *
 * **What exists today is ONE cutter that asks `tattooed skin` about the whole
 * frame.** Neither the region nor the motif take is built (1158 §2 files them as
 * v1-dependable and attempt-and-preview respectively). So shapes 2 and 3 are
 * walked to find out WHAT THE PRODUCT ACTUALLY DOES with them right now, which
 * is a finding for his frames rather than a pass or a fail.
 *
 * # IT REPORTS AGAINST HIS OWN BAR (fable-1162)
 *
 * > *"now im not expecting amazing results from the tattoo work as this is AI
 * > but as good as we can get it is good enough"*
 *
 * So a lettering drop or a shuffled arrangement is a FINDING to show him, not a
 * blocker. What is not softened: the preview shows what was actually cut, the
 * same stored design rides every render, and nothing of the person in her
 * photograph reaches the frame.
 *
 * # THE MONEY, before it is spent
 *
 * Each scenario is: one attach (free) → one ask that mints and OFFERS (free,
 * two segmenter calls of house money + two text calls) → one adopt that CLAIMS,
 * charges 25 credits and renders. Dev credits on verify-bot, whose balance the
 * campaign ledger does not read (it reads `userId = 1` and nothing else).
 *
 *   pnpm dev            (in another shell)
 *   npx tsx scripts/walk-tattoo-scenarios-disposable.mts
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import { SignJWT } from "jose";

import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/tattoo-walk";
const SESSION = "af5011d8-ca5f-4bd8-a785-7cc516c8361d";

type Scenario = {
  readonly key: string;
  readonly shape: string;
  readonly picture: string;
  readonly ask: string;
  /** Whether to buy the render. Every scenario does; stated per row so a
   *  budget stop can turn one off without editing the loop. */
  readonly adopt: boolean;
};

const ONLY = process.env.WALK_ONLY ?? "";

const ALL: readonly Scenario[] = [
  {
    key: "1-whole-design",
    shape: "whole design (rideWhole — nobody in the picture)",
    picture: "docs/specs/references/build-two-founder-specimens/tattoo-sleeve-trex-geometric-design.png",
    ask: "use this tattoo design on her upper chest",
    adopt: true,
  },
  {
    key: "2-region-collection",
    shape: "region-collection take (1158 §2a) — not built; walked to see what happens",
    picture: "docs/specs/references/build-two-founder-specimens/tattoo-patchwork-man-selective-take.png",
    /*
      HER NECK, and the first run of this row is why. It asked for the upper
      chest, where scenario 1's design already lives, and met the CONFLICT
      refusal — *"You've got a design for her upper chest already, and this
      picture isn't one of them"* — which is a reading of the conflict path
      rather than of the region take. It is also the exact sentence fable-1158
      §1 replaces with replace-on-confirm, so the first run is kept in the log
      as that amendment's live specimen.
    */
    ask: "copy the torso tattoos from this picture onto her neck",
    adopt: true,
  },
  {
    key: "3-single-motif",
    shape: "single-motif take (1158 §2b) — not built; walked to see what happens",
    picture: "docs/specs/references/build-two-founder-specimens/tattoo-patchwork-man-selective-take.png",
    ask: "put the mask tattoo from this picture on her neck",
    adopt: true,
  },
];

const log: string[] = [];
const say = (line: string) => { console.log(line); log.push(line); };

await mkdir(OUT, { recursive: true });

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

async function openTheBox(): Promise<boolean> {
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
  const tile = await page
    .waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
    .catch(() => null);
  if (!tile) return false;
  await tile.click();
  const box = await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null);
  return box !== null;
}

const SCENARIOS = ONLY ? ALL.filter((one) => one.key === ONLY) : ALL;

for (const scenario of SCENARIOS) {
  say("");
  say(`══ ${scenario.key} — ${scenario.shape}`);
  say(`   picture: ${scenario.picture}`);
  say(`   ask:     "${scenario.ask}"`);

  if (!(await openTheBox())) { say("   FAILED: no ask box"); continue; }

  const input = (await page.$(".dpc-refine__readInput")) as ElementHandle<HTMLInputElement> | null;
  if (!input) { say("   FAILED: no attach door — is the scope armed?"); continue; }
  await input.uploadFile(scenario.picture);
  const chip = await page.waitForSelector(".dpc-refine__thumb img", { timeout: 30_000 }).catch(() => null);
  if (!chip) { say("   FAILED: her picture never became a chip"); continue; }

  /* "I have permission" — the honest claim for a design supplied to this repo
     as a specimen, picked by its WORDS so a reordered enum cannot file a
     different claim. */
  await page.evaluate(() => {
    const one = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__claim button"))
      .find((button) => (button.textContent ?? "").toLowerCase().includes("permission"));
    one?.click();
  });
  await page.waitForFunction(() => document.querySelector(".dpc-refine__claim") === null, { timeout: 60_000 })
    .catch(() => null);

  await page.type(".dpc-refine__field", scenario.ask);
  await page.evaluate(() => {
    const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
      .find((button) => button.type === "submit");
    submit?.click();
  });

  /* THE OFFER, or whatever the road said instead — both are the walk's output. */
  const offered = await page.waitForFunction(
    () => document.querySelector(".dpc-refine__shownCut img") !== null
      || (document.querySelector(".dpc-refine__outcome")?.textContent ?? "").length > 0,
    { timeout: 240_000 },
  ).then(() => true, () => false);

  const said = await page.evaluate(() => ({
    outcome: document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "",
    cut: document.querySelector<HTMLImageElement>(".dpc-refine__shownCut img")?.getAttribute("src") ?? "",
    chips: Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__answer"))
      .map((one) => one.textContent?.trim() ?? ""),
  }));
  say(`   said:    ${said.outcome || "(nothing)"}`);
  if (!offered || !said.cut) {
    say("   → no cut was offered; nothing charged. This IS the finding for this shape.");
    const panel = await page.$(".dpc-refine");
    await panel?.screenshot({ path: `${OUT}/${scenario.key}-refused.png` as never });
    continue;
  }

  /* The cut itself, saved at full size rather than as a panel crop — his eyes
     are judging the artwork, not the layout. */
  const bytes = await page.evaluate(async (src: string) => {
    const response = await fetch(src, { credentials: "include" });
    const buffer = await response.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  }, said.cut);
  await writeFile(`${OUT}/${scenario.key}-cut.png`, Buffer.from(bytes));
  say(`   cut:     ${OUT}/${scenario.key}-cut.png (${bytes.length} bytes)`);
  const panel = await page.$(".dpc-refine");
  await panel?.screenshot({ path: `${OUT}/${scenario.key}-offer.png` as never });

  if (!scenario.adopt) { say("   (adopt skipped by the scenario row)"); continue; }

  /* AND THE PAID HALF. This is the only line in the walk that spends. */
  await page.evaluate(() => {
    const yes = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__answer"))
      .find((one) => (one.textContent ?? "").toLowerCase().startsWith("yes"));
    yes?.click();
  });

  const landed = await page.waitForFunction(
    () => {
      const busy = document.querySelector(".dpc-refine__busy, [data-refining='true']");
      const note = document.querySelector(".dpc-refine__outcome")?.textContent ?? "";
      return !busy && (note.length > 0 || document.querySelectorAll(".dpc-rail__item").length > 0);
    },
    { timeout: 600_000, polling: 2000 },
  ).then(() => true, () => false);
  say(`   render:  ${landed ? "settled" : "did not settle inside 10 minutes"}`);

  const after = await page.evaluate(() => ({
    outcome: document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "",
    frame: document.querySelector<HTMLImageElement>(".dpc-viewer__image, .dpc-candidate__image, img[alt*='andidate']")
      ?.getAttribute("src") ?? "",
  }));
  say(`   after:   ${after.outcome || "(no sentence)"}`);
  if (after.frame) {
    const frameBytes = await page.evaluate(async (src: string) => {
      const response = await fetch(src, { credentials: "include" });
      const buffer = await response.arrayBuffer();
      return Array.from(new Uint8Array(buffer));
    }, after.frame);
    await writeFile(`${OUT}/${scenario.key}-frame.png`, Buffer.from(frameBytes));
    say(`   frame:   ${OUT}/${scenario.key}-frame.png (${frameBytes.length} bytes)`);
  }
  const settled = await page.$(".dpc-refine");
  await settled?.screenshot({ path: `${OUT}/${scenario.key}-settled.png` as never });
}

await browser.close();
await writeFile(`${OUT}/walk.log`, `${log.join("\n")}\n`);
console.log(`\nwalk log: ${OUT}/walk.log`);
