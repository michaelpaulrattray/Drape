/**
 * CLAUSE (a)'S OWN PAIR — a copy of the realism court's driver, aimed at its
 * own output directory (fable-1194 §2/§4). The BEFORE arms are already bought:
 * `487` at `283a0f37` and `490` at `8f0515d2`, both carry renders that put the
 * design on his T-shirt with the artwork riding. The AFTER arm runs BOTH STEPS
 * at `ed5edea0`, because the delivered crop is minted by step one and there is
 * nothing for step two to carry without it.
 *
 * (original header follows)
 *
 * THE LIKE-FOR-LIKE COURT for the realism landing (`283a0f37`) — ordered
 * fable-1179 §2c, widened fable-1180, barred fable-1181, spent fable-1187 §3.
 *
 * # ONE DRIVER, TWO SERVERS — which is the whole design
 *
 * The variable under test is the WORDS the recipe speaks, and those live in the
 * server. So this file is the CLIENT for both arms and never changes between
 * them: the BEFORE arm points it at a dev server booted from the pinned
 * worktree `C:\Users\Admin\drape-pinned-42652964` (detached at `42652964`), the
 * AFTER arm at one booted from the main tree at `283a0f37`. Rendering "before"
 * from memory is the reconstruction trap this pinning exists to close.
 *
 *   COURT_ARM=before   npx tsx scripts/court-ink-realism-disposable.mts
 *   COURT_ARM=after    npx tsx scripts/court-ink-realism-disposable.mts
 *
 * # THE TWO ARMS THAT HAVE A DELTA, and the one that does not
 *
 * Read at the wire before a credit was spent (`output/_probe-ink-lanes.mts`,
 * run in both trees), because a court arm with no delta buys engine noise:
 *
 *   words-only        sha 378decc5f6170b7b BOTH TREES — IDENTICAL, struck
 *   fresh-reference   bc88520b… → 1d895d2d…   661 → 1475 chars
 *   carry             168833d3… → 07211312…   534 → 1348 chars
 *
 * So this drives the two that moved: a design supplied by picture, and the same
 * design CARRIED through an unrelated second edit.
 *
 * # THE SITING FACTS, inherited from `drive-ink-carry-fixed-disposable.mts`
 *
 * THE NECK AND NOT THE CHEST: this cast's master wears a crew tee and every
 * render re-anchors on the master, so a chest piece is invisible in any frame
 * the ask does not undress — the carry would be unjudgeable at the pixels
 * whichever way it went. The neck is above the collar.
 *
 * A CHAIN WITH NO INK IN IT: the containment wall refuses a second placement
 * free, and a chip's own words describe its STEP while the interpreter is
 * handed the composed CHAIN. The rail is oldest-first, so the version
 * immediately before the first inked one is the newest chain with no ink at all
 * — and both arms branch from that same version, which is what makes them a
 * pair rather than two experiments.
 *
 * # WHAT IT COSTS PER ARM
 *
 *   step 1   attach (free) → ask, which mints at an empty placement and offers
 *            the cut (free, house segmenter calls) → adopt, 25 dev credits
 *   step 2   ask, 25 dev credits
 *
 * Dev credits on verify-bot (user 823). The campaign ledger reads production
 * `userId = 1` and does not see this account — checked at the script, not
 * remembered.
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import { SignJWT } from "jose";
import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";

const ARM = process.env.COURT_ARM ?? "";
if (ARM !== "before" && ARM !== "after") {
  console.error("COURT_ARM must be `before` or `after` — the arm names the tree the SERVER was booted from");
  process.exit(1);
}

/**
 * WHICH STEP TO RUN — `one`, `two` or `both` (the default).
 *
 * Not a convenience. Each step is a PAID render, and a driver that can only run
 * both means every fix to step two's plumbing re-buys step one. `two` rides the
 * newest inked version on the rail, which is exactly what step two does inside
 * a `both` run.
 */
const STEP = process.env.COURT_STEP ?? "both";
if (!["one", "two", "both"].includes(STEP)) {
  console.error("COURT_STEP must be `one`, `two` or `both`");
  process.exit(1);
}

/**
 * WHICH LANE — `reference` (a design supplied by picture) or `words` (D-137's
 * face/neck road, no picture at all).
 *
 * The words lane was a NULL ARM until `27304e01`: the same recipe built at
 * `42652964` and at `283a0f37` produced the identical prompt, digest for
 * digest, because `inkRealismClause` had two callers and neither was reachable
 * without a reference. It has a delta now, so it has a court.
 */
const LANE = process.env.COURT_LANE ?? "reference";
if (LANE !== "reference" && LANE !== "words") {
  console.error("COURT_LANE must be `reference` or `words`");
  process.exit(1);
}

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
/*
  ⚠ ITS OWN DIRECTORY, and that is not tidiness.

  `output/court-realism/after` holds the REALISM landing's after-frames, which
  are founder evidence awaiting one sitting. A driver that wrote clause (a)'s
  frames over them would destroy the before-half of a different court while
  reporting success — and the two courts' frames have the same file names.
*/
const OUT = `output/court-carry-a/${LANE === "words" ? "words-" : ""}${ARM}`;
const SESSION = "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
const PICTURE = "docs/specs/references/build-two-founder-specimens/tattoo-sleeve-trex-geometric-design.png";
/* The neck on both lanes, for the siting reason in the docblock — and because
   D-137 lets words alone document ink only where the anchor already shows it. */
const STEP_ONE = LANE === "words"
  ? "give him a small geometric dinosaur skeleton tattoo on his neck"
  : "use this tattoo design on her neck";
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

const finish = async (code: number, why: string): Promise<never> => {
  say(why);
  await browser.close();
  await writeFile(`${OUT}/court.log`, `${log.join("\n")}\n`);
  process.exit(code);
};

say(`══ ARM: ${ARM} — the server on ${BASE} is the thing under test`);

/* WHICH SERVER ANSWERED — read off the running service rather than assumed, so
   a forgotten restart cannot silently make this a one-armed court. Read from
   NODE and not from the page: the first evaluate happens on `about:blank`,
   where a fetch at localhost is a cross-origin one and fails for a reason that
   has nothing to do with the server. */
const health = await fetch(`${BASE}/api/health`).then(
  async (response) => `${response.status} ${(await response.text()).slice(0, 240)}`,
  (error: unknown) => `unreachable — ${String(error)}`,
);
say(`   health: ${health}`);
if (!health.startsWith("200")) await finish(1, "STOPPED: no server on the port this arm is aimed at");

async function openTheBox(): Promise<boolean> {
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
  if (!(await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
    .catch(() => null))) return false;
  const opened = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="View candidate"]'));
    tiles[0]?.click();
    return { count: tiles.length, label: tiles[0]?.getAttribute("aria-label") ?? "" };
  });
  say(`   tile 0 of ${opened.count}: ${opened.label || "(none)"}`);
  if (!opened.label) return false;
  const box = await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null);
  return box !== null;
}

/**
 * The frame on screen, saved at full size — his eyes judge the artwork.
 *
 * ⚠ THE SELECTOR IS THE VIEWER'S OWN SHAPE, read off `CandidateViewer.tsx`
 * rather than inherited. The plate's real frame is an `<img>` with NO class of
 * its own — it is the sibling of `.dpc-viewer__sizer` and `.dpc-viewer__compare`
 * and it is the only one carrying `data-preview`. The first run of this court
 * used a guessed `.dpc-viewer__image, img[alt*='andidate']` and saved NOTHING
 * on either step, which is a court whose verdict is at the frames losing every
 * frame silently.
 *
 * `data-preview="false"` is waited for on purpose: `true` is the small copy the
 * viewer shows while the real bytes are in flight, and saving that would be an
 * at-rest reading of a transient.
 */
async function saveFrame(name: string): Promise<void> {
  const src = await page.waitForFunction(
    () => document.querySelector<HTMLImageElement>('.dpc-viewer__plate img[data-preview="false"]')
      ?.getAttribute("src") || null,
    { timeout: 120_000, polling: 1000 },
  ).then((handle) => handle.jsonValue() as Promise<string>, () => "");
  if (!src) { say(`   frame:   (none on screen for ${name})`); return; }
  /*
    FETCHED FROM NODE, NOT FROM THE PAGE. The frame's address is the R2 bucket's
    own public URL, which is a different origin from the dev server — an
    in-page fetch of it fails CORS, and it fails as a bare `Failed to fetch`
    that says nothing about the reason. Node has no origin to violate.
  */
  const from = src.startsWith("http") ? src : `${BASE}${src}`;
  const bytes = await fetch(from).then(
    async (response) => (response.ok ? Buffer.from(await response.arrayBuffer()) : null),
    () => null,
  );
  if (!bytes) { say(`   frame:   (could not fetch ${from})`); return; }
  await writeFile(`${OUT}/${name}.png`, bytes);
  say(`   frame:   ${OUT}/${name}.png (${bytes.length} bytes)  ← ${from}`);
}

async function ask(sentence: string): Promise<void> {
  await page.type(".dpc-refine__field", sentence);
  await page.evaluate(() => {
    const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
      .find((button) => button.type === "submit");
    submit?.click();
  });
}

/**
 * ⚠ THE OUTCOME BANNER IS STICKY, AND THAT COST THIS COURT TWO RUNS.
 *
 * `.dpc-refine__outcome` holds the LAST outcome for this Cast — including one
 * left by a render from a previous sitting. Every wait in the first draft of
 * this driver was `outcome.length > 0`, so both of them returned INSTANTLY on a
 * banner that predated the ask, and the log reported a stale sentence
 * (*"That one didn't make it. Your credits are back."*) as this ask's answer.
 * A wait that is already satisfied before the thing it waits for has started is
 * not a wait; it is a coin flip that always lands the same way.
 *
 * So the banner is DISMISSED before every ask, and the waits below are for it
 * to APPEAR rather than to be non-empty.
 */
const clearOutcome = async (): Promise<void> => {
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".dpc-refine__outcome .dpc-refine__dismiss")?.click();
  });
  await page.waitForFunction(() => document.querySelector(".dpc-refine__outcome") === null,
    { timeout: 30_000, polling: 500 }).catch(() => null);
  const left = await page.evaluate(() => document.querySelector(".dpc-refine__outcome") !== null);
  say(`   banner:  ${left ? "STILL THERE — a wait below may be reading somebody else's answer" : "cleared before the ask"}`);
};

const settled = (): Promise<boolean> => page.waitForFunction(
  () => {
    const busy = document.querySelector(".dpc-refine__busy, [data-refining='true']");
    const note = document.querySelector(".dpc-refine__outcome")?.textContent ?? "";
    return !busy && note.length > 0;
  },
  { timeout: 900_000, polling: 3000 },
).then(() => true, () => false);

const outcome = (): Promise<string> => page.evaluate(() =>
  document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "(nothing)");

/* ───────────────── step one: the design lands on her neck ───────────────── */

if (STEP !== "two") {
say("");
say(`══ step 1 — "${STEP_ONE}"`);
if (!(await openTheBox())) await finish(1, "STOPPED: no ask box");
await saveFrame("0-before-anything");

await page.waitForSelector(".dpc-refine__pick", { timeout: 60_000 }).catch(() => null);
const chose = await page.evaluate(() => {
  const picks = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__pick"));
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
  await finish(1, "STOPPED: no version without ink in its chain — the neck ask would be walled");
}

if (LANE === "reference") {
  const input = (await page.$(".dpc-refine__readInput")) as ElementHandle<HTMLInputElement> | null;
  if (!input) await finish(1, "STOPPED: no attach door — is the scope armed?");
  await input!.uploadFile(PICTURE);
  if (!(await page.waitForSelector(".dpc-refine__thumb img", { timeout: 30_000 }).catch(() => null))) {
    await finish(1, "STOPPED: her picture never became a chip");
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
} else {
  /* NOTHING IS ATTACHED ON THIS LANE, and that is the lane. A picture riding
     along would make it the other one. */
  say("   no picture — this is the words-only road");
}

await clearOutcome();
await ask(STEP_ONE);

/*
  ⚠ A FULL RENDER'S PATIENCE, NOT AN OFFER'S.

  This wait was 240 s on the theory that a cut is OFFERED before anything is
  charged, so a short timeout could only ever cost a free stage. It does not
  hold: driven at `42652964` the same ask minted the design and went STRAIGHT
  to the render with no cut shown at all — the driver gave up at four minutes
  and reported *"step one never settled"* while the server was mid-repaint and
  the credit was already spent. A driver whose timeout is shorter than the
  operation it is watching does not fail; it MISREPORTS, and it leaves a paid
  frame nobody saved.
*/
const offered = await page.waitForFunction(
  () => document.querySelector(".dpc-refine__shownCut img") !== null
    || (document.querySelector(".dpc-refine__outcome")?.textContent ?? "").length > 0,
  { timeout: 900_000, polling: 3000 },
).then(() => true, () => false);
const first = await page.evaluate(() => ({
  outcome: document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "",
  cut: document.querySelector<HTMLImageElement>(".dpc-refine__shownCut img") !== null,
}));
say(`   said:    ${first.outcome || "(nothing)"}`);
say(`   offered a cut: ${first.cut}`);
if (!offered) await finish(1, "STOPPED: step one never settled");

if (first.cut) {
  /* The shown cut, adopted — the only line here that spends. */
  await page.evaluate(() => {
    Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__answer"))
      .find((one) => (one.textContent ?? "").toLowerCase().startsWith("yes"))
      ?.click();
  });
}

const landedOne = await settled();
say(`   render:  ${landedOne ? "settled" : "did not settle inside 15 minutes"}`);
say(`   after:   ${await outcome()}`);
await saveFrame("1-tattoo-on-neck");
if (!landedOne) await finish(1, "STOPPED: step one did not land; step two would answer a different question");
}

/* ─────────────── step two: an unrelated ask, and no picture at all ──────── */

if (STEP === "one") await finish(0, `\nlog: ${OUT}/court.log — step one only, by COURT_STEP`);

say("");
say(`══ step 2 — "${STEP_TWO}" (no picture, nothing about ink in the sentence)`);
if (!(await openTheBox())) await finish(1, "STOPPED: no ask box for step two");
await page.waitForSelector(".dpc-refine__pick", { timeout: 60_000 }).catch(() => null);
/*
  ⚠ THE CAPTION IS NOT THE SELECTION, AND THAT COST A RENDER.

  This block used to click a chip and then read `.dpc-refine__madeText` — the
  viewer's own caption — as proof of what the ask would branch from. Variant
  `489` passed that check reading *"use this tattoo design on her neck"* and was
  filed with `parentVariantId 475`, `carried: []` and ONE reference: it branched
  from the pre-ink version and carried no design at all. 25 dev credits for a
  render that answered a different question, and the log said it had worked.

  Two things are wrong with reading the caption. `.dpc-refine__pick` is not only
  buttons — the rail draws a pending render as a `div.dpc-refine__pick--ghost`
  carrying its instruction in `aria-label`, so a `.click()` on it is silently
  nothing. And the caption describes what is ON SCREEN, which is a different
  fact from what the box will send.

  So the chip's OWN state is asserted instead: `aria-pressed="true"` on the very
  element that was clicked, waited for, and refused if it never arrives. The
  precondition is proved before the money is spent rather than inferred after.
*/
/*
  ⚠ WHICH inked version — `COURT_PARENT_NTH`, 1-based from the START of the
  rail, and it exists because THREE versions on this Cast carry the identical
  instruction.

  Clause (a)'s pair must branch from `486`, which is the parent BOTH before-arms
  (`487`, `490`) branched from: same parent, same step-two sentence, and the
  carrier is then the only thing that differs. Walking backwards for the newest
  match lands on `492` instead — a different parent, and a pair whose two arms
  differ in more than the variable under test is not a pair.

  The label cannot tell them apart (`484`, `486` and `492` were all asked "use
  this tattoo design on her neck"), so the ORDINAL is the selector, every
  matching label is printed for the record, and the parent is re-read OFF THE
  ROW after the render rather than believed from the rail.
*/
const NTH = Number(process.env.COURT_PARENT_NTH ?? "0");
const onTwo = await page.evaluate((nth: number) => {
  const picks = Array.from(document.querySelectorAll<Element>(".dpc-refine__pick"));
  const matching = picks.filter((one) => /tattoo|design/i.test(one.getAttribute("aria-label") ?? ""));
  const labels = matching.map((one) => one.getAttribute("aria-label") ?? "");
  const chosen = nth > 0 ? matching[nth - 1] : matching[matching.length - 1];
  const label = chosen?.getAttribute("aria-label") ?? "";
  if (!(chosen instanceof HTMLButtonElement)) return { label, clickable: false, labels };
  chosen.click();
  return { label, clickable: true, labels };
}, NTH);
say(`   inked versions on the rail, oldest first:`);
onTwo.labels.forEach((one, at) => say(`     ${at + 1}. ${one}`));
say(`   asked for #${NTH > 0 ? NTH : onTwo.labels.length}`);
say(`   selected: "${onTwo.label || "(no version names the design)"}"${onTwo.clickable ? "" : "  ← NOT A BUTTON"}`);
if (!onTwo.clickable) {
  await finish(1, "STOPPED: no clickable version chip names the design — a ghost chip is not a selection");
}
const pressed = await page.waitForFunction(
  (want: string) => Array.from(document.querySelectorAll(".dpc-refine__pick"))
    .some((one) => one.getAttribute("aria-label") === want && one.getAttribute("aria-pressed") === "true"),
  { timeout: 30_000, polling: 250 },
  onTwo.label,
).then(() => true, () => false);
say(`   chip says it is selected: ${pressed}`);
if (!pressed) {
  await finish(1, "STOPPED: the chip never reported itself selected — the ask would branch from somewhere else");
}
const made = await page.waitForFunction(
  () => document.querySelector(".dpc-refine__madeText")?.textContent?.trim() || null,
  { timeout: 60_000, polling: 500 },
).then((handle) => handle.jsonValue() as Promise<string>, () => "");
say(`   the version on screen was made by: "${made}"`);
if (!/tattoo|design/i.test(made)) {
  await finish(1, "STOPPED: the viewer is not on the tattooed version — an edit here answers a different question");
}

await clearOutcome();
await ask(STEP_TWO);
const landedTwo = await settled();
say(`   render:  ${landedTwo ? "settled" : "did not settle inside 15 minutes"}`);
say(`   after:   ${await outcome()}`);
await saveFrame("2-after-unrelated-edit");

await finish(landedTwo ? 0 : 1, landedTwo
  ? `\nlog: ${OUT}/court.log — the WIRE is read off the database, and the frames by eye`
  : "STOPPED: step two did not settle");

/* END BY ENDING THE PROCESS — puppeteer leaves handles alive, and
   `scriptExitDiscipline` wants the LAST top-level statement to be this one, not
   an exit inside a helper it cannot see. Unreachable, and that is the point. */
process.exit(0);
