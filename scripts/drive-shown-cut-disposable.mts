/**
 * THE SHOWN CUT, LOOKED AT IN THE RUNNING APP — working law 6 (ruled
 * fable-1127 §2; road (D)'s instance ruled fable-1156 §2).
 *
 * No visual change ships without being looked at in the running app, and this
 * one is a picture a customer is asked to APPROVE — so the thing that has to be
 * true is not that an element exists but that her design is VISIBLE on it.
 *
 * # What it costs, said before it is spent
 *
 * The offer is raised BEFORE THE CLAIM, so this drive spends **no credits at
 * all**. What it does spend is the mint's own house money — two segmenter calls
 * on the attached picture — once per run, because a second ask about the same
 * picture at the same address RIDES the row instead of cutting again.
 *
 * # AND IT NEVER TAPS YES
 *
 * "Yes — use this design" is the paid road: it claims, charges and renders.
 * This driver taps the DECLINE, which is free, deletes the row it just made and
 * hands the design's bytes to the cleanup worker — so the drive leaves the
 * database exactly as it found it and proves the other half of "see or reject"
 * on the way past.
 *
 *   pnpm dev            (in another shell)
 *   npx tsx scripts/drive-shown-cut-disposable.mts
 */
import "dotenv/config";

import { mkdir } from "node:fs/promises";

import { SignJWT } from "jose";

import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/shown-cut";
/* verify-bot's own READY candidate, read off the dev database rather than
   guessed — a signed or expired Cast has no refine panel at all. */
const SESSION = "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
/*
  THE FOUNDER'S OWN BUILD-TWO SPECIMEN — a sleeve design on paper.

  TWO PHOTOGRAPHS OF SKIN WERE TRIED FIRST AND BOTH WERE REFUSED, honestly and
  for the same measured reason: *"I found the design in that picture, but it's
  too small a piece to draw from — 256px across, at least."* A tattoo on an arm
  in a full-length frame is a small object, and both specimens' designs came in
  under the bound. That refusal is the road working; it is not what this driver
  is here to photograph.

  A design SHEET has nobody in it, so the cutter's `rideWhole` route applies —
  the frame IS the design — which is the other half of the disposition column
  and just as much a cut she is entitled to see before it rides.

  The provenance chip tapped for this one is "I have permission", which is the
  honest claim for a design supplied to this repo as a specimen. The synthetic
  chip would be a claim a driver invented.
*/
const PICTURE = "docs/specs/references/build-two-founder-specimens/tattoo-sleeve-trex-geometric-design.png";
/*
  HER NECK, AND THE CHOICE IS A FINDING RATHER THAN A PREFERENCE.

  The first sentence this driver used was "on her left upper arm" — the most
  natural phrasing there is — and it was REFUSED: the take reads the placement
  as the open phrase "left upper arm" (the side word inside it), which is not
  one of the three measured placements, and the refusal it composes reads
  "her left left upper arm is more than I can place yet". Filed to Fable.

  The neck needs no side (`centre` is the vocabulary's answer for a surface
  there is one of), so it reaches the mint without touching that wall.
*/
const ASK = "use this tattoo design on her neck";

const failures: string[] = [];
const check = (name: string, ok: boolean, saw = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${saw ? ` — saw ${saw}` : ""}`);
  if (!ok) failures.push(name);
};

await mkdir(OUT, { recursive: true });

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

/*
  WHAT THE DELIVERY ROUTE ACTUALLY ANSWERED — recorded off the wire rather than
  inferred from whether a picture appeared. An <img> that fails to load and an
  <img> nobody waited for look identical in the DOM, and the route logs nothing
  on success, so neither the page nor the server log can tell them apart.
*/
const deliveries: Array<{ status: number; url: string }> = [];
page.on("response", (response) => {
  const url = response.url();
  if (url.includes("/api/ink-design/")) deliveries.push({ status: response.status(), url });
});

async function run(theme: "dark" | "light"): Promise<void> {
  await page.evaluateOnNewDocument(
    `(() => { try { window.localStorage.setItem("drape_theme", ${JSON.stringify(theme)}); } catch {} })()`,
  );
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });

  const tile = await page
    .waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
    .catch(() => null);
  check(`a candidate tile is on the sheet (${theme})`, tile !== null);
  if (!tile) return;
  await tile.click();
  const box = await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null);
  check(`the ask box is on screen (${theme})`, box !== null);
  if (!box) return;

  /* Her picture, through the real picker. */
  const input = (await page.$(".dpc-refine__readInput")) as ElementHandle<HTMLInputElement> | null;
  check(`the attach door is drawn (${theme})`, input !== null);
  if (!input) return;
  await input.uploadFile(PICTURE);
  const chip = await page.waitForSelector(".dpc-refine__thumb img", { timeout: 30_000 }).catch(() => null);
  check(`her picture appears as a chip (${theme})`, chip !== null);

  /* "I have permission" — see the specimen's own note above. Picked by its
     WORDS rather than by position, so a reordered enum cannot silently file a
     different claim about where her picture came from. */
  await page.evaluate(() => {
    const chip = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__claim button"))
      .find((one) => (one.textContent ?? "").toLowerCase().includes("permission"));
    chip?.click();
  });
  await page.waitForFunction(() => document.querySelector(".dpc-refine__claim") === null, { timeout: 60_000 })
    .catch(() => null);

  /* The ask. The mint, the cut and the offer all happen inside this one
     submission, and none of it is charged. */
  await page.type(".dpc-refine__field", ASK);
  await page.evaluate(() => {
    const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
      .find((button) => button.type === "submit");
    submit?.click();
  });

  const cut = await page
    .waitForSelector(".dpc-refine__shownCut img", { timeout: 180_000 })
    .catch(() => null);
  /*
    AND THEN WAIT ON THE BYTES (the verify skill's second reading).

    The element arrives with the answer; the picture arrives over an
    authenticated route a moment later. Measuring `naturalWidth` the instant the
    element exists reported [0,0] on the first run of this driver — a picture
    that had not decoded YET, read as a picture that never would.
  */
  if (cut) {
    await page.waitForFunction(
      () => {
        const image = document.querySelector<HTMLImageElement>(".dpc-refine__shownCut img");
        return Boolean(image && image.complete);
      },
      { timeout: 60_000 },
    ).catch(() => null);
  }
  check(`THE CUT IS ON SCREEN (${theme})`, cut !== null);
  if (!cut) {
    /*
      WHAT THE PANEL SAID INSTEAD — and it reads EVERY place the panel can
      speak, not just the outcome line.

      The first run of this driver reported "(nothing)" while the surface was
      saying something perfectly clear two elements away: the Cast was already
      holding its eight pictures, so the attach refused and the ask never
      carried a reference. A failure probe that reads one element reports a
      refusal it was not looking at as silence.
    */
    const said = await page.evaluate(() => ({
      outcome: document.querySelector(".dpc-refine__outcome")?.textContent?.trim() ?? "",
      attach: document.querySelector(".dpc-refine__readNote")?.textContent?.trim() ?? "",
      claimOpen: document.querySelector(".dpc-refine__claim") !== null,
      submitHeld: Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
        .find((button) => button.type === "submit")?.disabled ?? null,
    }));
    check(`the panel said something about why (${theme})`, false, JSON.stringify(said));
    return;
  }

  /*
    IT PAINTED, AND IT IS VISIBLE ON ITS PAPER.

    `naturalWidth` is the bytes rather than the box — an element that has not
    decoded photographs as an empty square, which is indistinguishable from a
    picture nobody can see. The alpha reading is the reason the plate exists:
    the cut is artwork on transparency, so the question is whether it stands out
    against what is BEHIND it.
  */
  const reading = await page.evaluate(() => {
    const image = document.querySelector<HTMLImageElement>(".dpc-refine__shownCut img");
    const plate = document.querySelector<HTMLElement>(".dpc-refine__shownCut");
    const answers = document.querySelector<HTMLElement>(".dpc-refine__answers");
    const outcome = document.querySelector<HTMLElement>(".dpc-refine__outcome");
    if (!image || !plate) return null;
    const plateBox = plate.getBoundingClientRect();
    const answerBox = answers?.getBoundingClientRect();
    return {
      painted: image.naturalWidth > 0,
      natural: [image.naturalWidth, image.naturalHeight],
      drawn: [Math.round(plateBox.width), Math.round(plateBox.height)],
      plateBackground: getComputedStyle(plate).backgroundColor,
      aboveTheChips: answerBox ? plateBox.bottom <= answerBox.top + 1 : null,
      question: outcome?.textContent?.replace("×", "").trim() ?? "",
      chips: Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__answer"))
        .map((one) => one.textContent?.trim() ?? ""),
      source: image.getAttribute("src") ?? "",
      alt: image.getAttribute("alt") ?? "",
    };
  });
  check(`her design actually painted (${theme})`, reading?.painted === true, JSON.stringify(reading?.natural));
  check(`it is drawn at a size a person can judge (${theme})`, (reading?.drawn?.[0] ?? 0) >= 120, JSON.stringify(reading?.drawn));
  check(`it sits ABOVE the chips (${theme})`, reading?.aboveTheChips === true);
  check(`the question is asked in words (${theme})`, (reading?.question ?? "").length > 0, reading?.question);
  check(`both answers are offered (${theme})`, (reading?.chips ?? []).length === 2, (reading?.chips ?? []).join(" · "));
  check(`the address is the app's own route (${theme})`, (reading?.source ?? "").startsWith("/api/ink-design/"), reading?.source);
  check(`it is named for a screen reader (${theme})`, (reading?.alt ?? "").length > 0, reading?.alt);

  /*
    THE PLATE IS THE SAME PAPER IN BOTH THEMES — the one design law here, read
    off the COMPUTED style in the running app rather than off the stylesheet.
    A near-white plate in the dark theme is the whole point: a black-line tattoo
    on transparency drawn onto the panel itself is invisible.
  */
  /*
    READ AS NUMBERS, NOT AS A STRING. Chromium printed this plate as
    `color(srgb 1 1 1 / 0.92)` and the first version of this check was a regex
    for `rgb(...)` — so a plate that was exactly right failed a checker that
    could not read it. The rule is about LIGHTNESS, so the reading is the
    channel values, in whichever of the two units the browser chose.
  */
  const channels = (reading?.plateBackground ?? "").match(/[\d.]+/g)?.map(Number) ?? [];
  const asBytes = channels.slice(0, 3).map((value) => (value <= 1 ? value * 255 : value));
  check(
    `the plate is light (${theme})`,
    asBytes.length === 3 && asBytes.every((value) => value >= 200),
    `${reading?.plateBackground} → ${JSON.stringify(asBytes.map(Math.round))}`,
  );

  const answered = deliveries[deliveries.length - 1];
  check(
    `the delivery route served it (${theme})`,
    answered?.status === 200,
    answered ? `${answered.status} ${answered.url}` : "the route was never called",
  );

  const panel = await page.$(".dpc-refine");
  await panel?.screenshot({ path: `${OUT}/offer-${theme}.png` as never });
  check(`photographed the offer (${theme})`, panel !== null, `${OUT}/offer-${theme}.png`);

  /*
    AND THE DECLINE, which is what makes this a decision — free, and it deletes
    the row this run just wrote. Never "Yes": that one claims and charges.
  */
  const declined = await page.evaluate(() => {
    const chip = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__answer"))
      .find((one) => (one.textContent ?? "").toLowerCase().includes("discard"));
    chip?.click();
    return Boolean(chip);
  });
  check(`the decline is tappable (${theme})`, declined);
  const gone = await page.waitForFunction(
    () => {
      const said = document.querySelector(".dpc-refine__outcome")?.textContent ?? "";
      return said.includes("Discarded") && document.querySelector(".dpc-refine__shownCut") === null;
    },
    { timeout: 120_000 },
  ).then(() => true, () => false);
  check(`the decline is answered and the cut leaves the screen (${theme})`, gone);
  const after = await page.evaluate(() =>
    document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "");
  check(`it says what happened (${theme})`, after.includes("Discarded"), after);
  const panelAfter = await page.$(".dpc-refine");
  await panelAfter?.screenshot({ path: `${OUT}/discarded-${theme}.png` as never });
}

for (const theme of ["dark", "light"] as const) await run(theme);

await browser.close();
console.log(failures.length === 0 ? "ALL CHECKS PASSED" : `FAILED: ${failures.join(" · ")}`);
process.exit(failures.length === 0 ? 0 : 1);
