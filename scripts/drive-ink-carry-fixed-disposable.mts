/**
 * DOES THE TATTOO SURVIVE NOW — the carry re-drive (ordered fable-1167 §4,
 * after clause (a) landed at `28b48243`).
 *
 * The first drive of this question answered LOST: a delivered chest piece was
 * gone on the next unrelated edit, and the dispatch record showed why — the
 * chain held her ink WORDS and nothing held the design. This drives the same
 * two steps against the fix.
 *
 * # WHY THE NECK AND NOT THE CHEST, which is the whole point of the siting
 *
 * The first drive's cast wears a crew tee on his MASTER, and every render
 * re-anchors on the master. The chest render undressed him to satisfy the ask;
 * the next render correctly dressed him again — so a chest piece is invisible
 * in any frame the ask does not undress, and the carry would be UNJUDGEABLE at
 * the pixels whichever way it went.
 *
 * The NECK is above the collar. It is his own visible-extent ruling (fable-1081,
 * *"poking out the top of the shirt but thats the extent for now"*) used as the
 * instrument: a neck design shows in a dressed frame, so the second frame
 * answers the question by eye.
 *
 * # THE ASK NAMES NOTHING ABOUT INK ON STEP TWO, deliberately
 *
 * An edit that mentioned the tattoo would rescue it through the words road and
 * prove nothing. Step two asks for hair — unrelated, visible, and it also puts
 * a LIBRARY carry beside the ink carry, so the frame shows the two carriers
 * riding together rather than one at a time.
 *
 * # WHAT IT COSTS
 *
 *   step 1   attach (free) → ask, which MINTS at an empty placement and offers
 *            the cut (free, house segmenter calls) → adopt, 25 dev credits
 *   step 2   ask, 25 dev credits
 *
 * Dev credits on verify-bot, whose balance the campaign ledger does not read.
 *
 *   pnpm dev            (in another shell)
 *   npx tsx scripts/drive-ink-carry-fixed-disposable.mts
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import { SignJWT } from "jose";
import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/ink-carry-fixed";
const SESSION = "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
const PICTURE = "docs/specs/references/build-two-founder-specimens/tattoo-sleeve-trex-geometric-design.png";
const STEP_ONE = "use this tattoo design on her neck";
const STEP_TWO = "colour his hair silver";

const log: string[] = [];
const say = (line: string) => { console.log(line); log.push(line); };

await mkdir(OUT, { recursive: true });

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("3h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

const stop = async (why: string) => {
  say(`STOPPED: ${why}`);
  await browser.close();
  await writeFile(`${OUT}/carry.log`, `${log.join("\n")}\n`);
  process.exit(1);
};

/*
  A CAST WITH NO INK HISTORY, and the first run of this drive is why.

  It opened the walk's own cast — which already has a design on record at the
  upper chest — and asking for the NECK was refused free by the containment
  wall: *"the tattoo location is her neck rather than her upper chest as
  previously on record"*. That refusal is correct and it is the one-design
  limit meeting a door I had not predicted (the interpreter, not composition).

  So this drives a DIFFERENT cast in the same session, where the neck is the
  first thing anybody has asked for.
*/
const TILE = Number(process.env.CARRY_TILE ?? "0");

async function openTheBox(): Promise<boolean> {
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
  if (!(await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
    .catch(() => null))) return false;
  const opened = await page.evaluate((at: number) => {
    const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="View candidate"]'));
    const one = tiles[at];
    one?.click();
    return { count: tiles.length, label: one?.getAttribute("aria-label") ?? "" };
  }, TILE);
  say(`   tile ${TILE} of ${opened.count}: ${opened.label || "(none — out of range)"}`);
  if (!opened.label) return false;
  const box = await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null);
  return box !== null;
}

/** The frame on screen, saved at full size — his eyes judge the artwork. */
async function saveFrame(name: string): Promise<void> {
  const src = await page.evaluate(() => document
    .querySelector<HTMLImageElement>(".dpc-viewer__image, .dpc-candidate__image, img[alt*='andidate']")
    ?.getAttribute("src") ?? "");
  if (!src) { say(`   frame:   (none on screen for ${name})`); return; }
  const bytes = await page.evaluate(async (from: string) => {
    const response = await fetch(from, { credentials: "include" });
    return Array.from(new Uint8Array(await response.arrayBuffer()));
  }, src);
  await writeFile(`${OUT}/${name}.png`, Buffer.from(bytes));
  say(`   frame:   ${OUT}/${name}.png (${bytes.length} bytes)`);
}

async function ask(sentence: string): Promise<void> {
  await page.type(".dpc-refine__field", sentence);
  await page.evaluate(() => {
    const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
      .find((button) => button.type === "submit");
    submit?.click();
  });
}

/* ─────────────────────────── step one: the design lands on her neck ─────── */

say(`══ step 1 — "${STEP_ONE}"`);
if (!(await openTheBox())) await stop("no ask box");

/*
  A VERSION WHOSE CHAIN HAS NO INK — and the second run of this drive is why.

  The only refinable cast on this account already carries an upper-chest design
  in its newest chain, and asking for the NECK on top of it was refused free:
  the invention door asked the model whether the filed value asserts anything
  she did not ask for, and the model answered YES with the fact *"the tattoo
  location is her neck rather than her upper chest as previously on record"* —
  about a sentence in which she said "neck" herself.

  A BRANCH is the way past it and costs nothing: the rail holds versions from
  before the tattoo step, and an edit made from one of those composes a chain
  with no ink fact in it at all. That is also the honest shape of the thing
  being proved — the carry is a property of the branch, so proving it on a
  branch it was born in is the right place to prove it.
*/
/* WAIT for the rail before reading it. The first two runs read an empty list
   and reported "0 versions" while four were about to render — a selector read
   before its component exists is the sampler certifying an empty surface. */
await page.waitForSelector(".dpc-refine__pick", { timeout: 60_000 }).catch(() => null);
const chose = await page.evaluate(() => {
  const picks = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__pick"));
  /*
    THE VERSION IMMEDIATELY BEFORE THE FIRST TATTOO ONE — not merely a version
    whose own words say nothing about ink.

    A run of this drive picked "give him green eyes", whose own sentence is
    innocent and whose CHAIN descends from the tattoo step, and the neck ask was
    walled exactly as before. A chip's words describe its STEP; what the
    interpreter is handed is the composed chain. The rail is oldest-first, so
    the last version before the first inked one is the newest chain with no ink
    in it at all.
  */
  const labels = picks.map((one) => one.getAttribute("aria-label") ?? "");
  const firstInked = labels.findIndex((one) => /tattoo|design/i.test(one));
  const at = firstInked === -1 ? picks.length - 1 : firstInked - 1;
  picks[Math.max(at, 0)]?.click();
  return { count: picks.length, at, label: (labels[Math.max(at, 0)] ?? "").trim() };
});
say(`   versions on the rail: ${chose.count}; chose ${chose.at} — ${chose.label}`);
const startedFrom = await page.waitForFunction(
  () => document.querySelector(".dpc-refine__madeText")?.textContent?.trim() ?? "(the original)",
  { timeout: 60_000, polling: 500 },
).then((handle) => handle.jsonValue() as Promise<string>, () => "");
say(`   branching from: "${startedFrom}"`);
if (/tattoo|design/i.test(startedFrom)) {
  await stop("could not find a version without ink in its chain — the neck ask would be walled");
}

/* The picker is a real `<input type="file">`, and `uploadFile` is typed on the
   input handle rather than on a bare Element — the same cast every other driver
   here makes. Without it this file does not compile, and vitest cannot see
   that: the suite does not typecheck the scripts tree. */
const input = (await page.$(".dpc-refine__readInput")) as ElementHandle<HTMLInputElement> | null;
if (!input) await stop("no attach door — is the scope armed?");
await input!.uploadFile(PICTURE);
if (!(await page.waitForSelector(".dpc-refine__thumb img", { timeout: 30_000 }).catch(() => null))) {
  await stop("her picture never became a chip");
}
/* "I have permission" — picked by its WORDS, so a reordered enum cannot file a
   different claim. */
await page.evaluate(() => {
  Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__claim button"))
    .find((one) => (one.textContent ?? "").toLowerCase().includes("permission"))
    ?.click();
});
await page.waitForFunction(() => document.querySelector(".dpc-refine__claim") === null, { timeout: 60_000 })
  .catch(() => null);

await ask(STEP_ONE);

const offered = await page.waitForFunction(
  () => document.querySelector(".dpc-refine__shownCut img") !== null
    || (document.querySelector(".dpc-refine__outcome")?.textContent ?? "").length > 0,
  { timeout: 240_000 },
).then(() => true, () => false);
const first = await page.evaluate(() => ({
  outcome: document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "",
  cut: document.querySelector<HTMLImageElement>(".dpc-refine__shownCut img") !== null,
}));
say(`   said:    ${first.outcome || "(nothing)"}`);
say(`   offered a cut: ${first.cut}`);
if (!offered) await stop("step one never settled");

if (first.cut) {
  /* The shown cut, adopted — the only line here that spends. */
  await page.evaluate(() => {
    Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__answer"))
      .find((one) => (one.textContent ?? "").toLowerCase().startsWith("yes"))
      ?.click();
  });
}

const landedOne = await page.waitForFunction(
  () => {
    const busy = document.querySelector(".dpc-refine__busy, [data-refining='true']");
    const note = document.querySelector(".dpc-refine__outcome")?.textContent ?? "";
    return !busy && note.length > 0;
  },
  { timeout: 900_000, polling: 3000 },
).then(() => true, () => false);
say(`   render:  ${landedOne ? "settled" : "did not settle inside 15 minutes"}`);
say(`   after:   ${await page.evaluate(() =>
  document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "(nothing)")}`);
await saveFrame("1-tattoo-on-neck");
if (!landedOne) await stop("step one did not land; step two would answer a different question");

/* ─────────────────── step two: an unrelated ask, and no picture at all ──── */

say("");
say(`══ step 2 — "${STEP_TWO}" (no picture, nothing about ink in the sentence)`);
if (!(await openTheBox())) await stop("no ask box for step two");
await page.waitForSelector(".dpc-refine__pick", { timeout: 60_000 }).catch(() => null);
const onTwo = await page.evaluate(() => {
  const picks = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__pick"));
  /* The version step one just made: the newest chip whose own words name the
     design. Newest-first so a re-run does not pick an older tattoo version. */
  for (let at = picks.length - 1; at >= 0; at -= 1) {
    const label = picks[at]?.getAttribute("aria-label") ?? "";
    if (!/tattoo|design/i.test(label)) continue;
    picks[at]?.click();
    return label;
  }
  return "";
});
say(`   selected: "${onTwo || "(no version names the design)"}"`);
const made = await page.waitForFunction(
  () => document.querySelector(".dpc-refine__madeText")?.textContent?.trim() || null,
  { timeout: 60_000, polling: 500 },
).then((handle) => handle.jsonValue() as Promise<string>, () => "");
say(`   the version on screen was made by: "${made || "(the original)"}"`);
if (!/tattoo|design/i.test(made)) {
  await stop("the viewer is not on the tattooed version — an edit here answers a different question");
}

await ask(STEP_TWO);
const landedTwo = await page.waitForFunction(
  () => {
    const busy = document.querySelector(".dpc-refine__busy, [data-refining='true']");
    const note = document.querySelector(".dpc-refine__outcome")?.textContent ?? "";
    return !busy && note.length > 0;
  },
  { timeout: 900_000, polling: 3000 },
).then(() => true, () => false);
say(`   render:  ${landedTwo ? "settled" : "did not settle inside 15 minutes"}`);
say(`   after:   ${await page.evaluate(() =>
  document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "(nothing)")}`);
await saveFrame("2-after-unrelated-edit");

await browser.close();
await writeFile(`${OUT}/carry.log`, `${log.join("\n")}\n`);
console.log(`\nlog: ${OUT}/carry.log — the WIRE is read off the database, and the frames by eye`);

/* END BY ENDING THE PROCESS — puppeteer leaves handles alive. */
process.exit(0);
