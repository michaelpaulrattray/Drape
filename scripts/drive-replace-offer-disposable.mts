/**
 * THE REPLACE OFFER, LOOKED AT IN THE RUNNING APP — working law 6 (founder
 * ruling relayed fable-1158 §1, built in `5306069f`).
 *
 * A new sentence and two new chips reach a customer. No visual change ships
 * without being looked at, and the thing that has to be true here is not that
 * an element exists: it is that the sentence NAMES WHAT IT WOULD DESTROY, in
 * words that fit the panel, above a picture of the design that would replace it.
 *
 * # What it costs, said before it is spent
 *
 * **No credits at all.** The offer is raised before the claim. What it spends is
 * the mint's own house money — two segmenter calls on the attached picture —
 * once, because the drive never asks twice.
 *
 * # AND IT NEVER TAPS "REPLACE IT"
 *
 * That chip is the paid road AND the destructive one: it deletes the resident
 * and charges for a render. This driver taps **"No, keep the one she has"**,
 * which is free, throws away only the row this drive minted, and leaves the
 * resident exactly where it found it. The counts are read off the database
 * BEFORE and AFTER, so "left it as it found it" is a fact rather than a claim.
 *
 * # THE RESIDENT IS A REAL ONE
 *
 * Not planted: candidate `7cb9c7a4` already holds a design at `neck@centre`,
 * born in `CASTING_INK_CUT_SCOPE`'s off-period (`cutRoute: null`). So the frame
 * this drive photographs is the offer a real customer with a real studio meets,
 * and the resident is one of the rows that road exists to move on from.
 *
 *   pnpm dev            (in another shell)
 *   npx tsx scripts/drive-replace-offer-disposable.mts
 */
import "dotenv/config";

import { mkdir } from "node:fs/promises";

import { SignJWT } from "jose";
import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/replace-offer";
/* Read off the dev database this sitting, never carried: the session that owns
   the candidate holding a neck design. */
const SESSION = "0b17d084-ad91-4b4f-955c-45e21703fe05";
/*
  TWO DESIGNS, AND THEY MUST BE DIFFERENT PICTURES — which is the whole
  precondition of this question, and the first run of this driver PAID 25
  CREDITS to learn it. The same picture at the same address does not raise the
  offer at all: it RIDES (the reuse rule) and RENDERS.

  Both are design ARTWORKS rather than photographs of tattooed people. The
  patchwork specimens are known to refuse on this road for a measured reason
  (`tattooed skin` on a wholly-tattooed man answers a class with one instance —
  opus-862's 140x167), and that refusal is not what this driver is photographing.
*/
const RESIDENT_PICTURE = "docs/specs/references/build-two-founder-specimens/tattoo-statue-artwork-figure-inspired-by.png";
const PICTURE = "docs/specs/references/build-two-founder-specimens/tattoo-sleeve-trex-geometric-design.png";
/*
  HER UPPER CHEST, AND THE PLACEMENT IS A FINDING RATHER THAN A PREFERENCE.

  The neck was the obvious choice and it is UNREACHABLE on this Cast: her chain
  already records an ink step there, and the already-true door absorbs the ask
  before the ink road is ever consulted — *"She already has the tattoo design in
  the attached picture on her neck"*, said about a DIFFERENT design, because
  `free.ink` spells every reference tattoo the same way.

  That is a real finding and it is filed (opus-870). Her upper chest has no ink
  step in the chain, so the ask reaches the road this driver is here to look at.
*/
const ASK = "use this tattoo design on her upper chest";

const failures: string[] = [];
const check = (name: string, ok: boolean, saw = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${saw ? ` — saw ${saw}` : ""}`);
  if (!ok) failures.push(name);
};

await mkdir(OUT, { recursive: true });

const token = await new SignJWT({
  openId: "google_109438922864282769159",
  appId: process.env.VITE_APP_ID,
  name: "Michael Rattray",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

/*
  ONE ASK, FROM AN EMPTY BOX — attach, claim, submit. Returns nothing; what
  happened is read by the caller off the panel, because the two things this
  driver distinguishes (a question, a refusal) are told apart by which elements
  exist rather than by anything this function could return.
*/
async function ask(theme: "dark" | "light", picture: string, sentence: string): Promise<boolean> {
  await page.evaluateOnNewDocument(
    `(() => { try { window.localStorage.setItem("drape_theme", ${JSON.stringify(theme)}); } catch {} })()`,
  );
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });

  const tile = await page
    .waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
    .catch(() => null);
  if (!tile) { check(`a candidate tile is on the sheet (${theme})`, false); return false; }
  await tile.click();
  const box = await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null);
  if (!box) { check(`the ask box is on screen (${theme})`, false); return false; }

  const input = (await page.$(".dpc-refine__readInput")) as ElementHandle<HTMLInputElement> | null;
  if (!input) { check(`the attach door is drawn (${theme})`, false); return false; }
  await input.uploadFile(picture);
  const chip = await page.waitForSelector(".dpc-refine__thumb img", { timeout: 30_000 }).catch(() => null);
  if (!chip) { check(`her picture appears as a chip (${theme})`, false); return false; }

  /* "I have permission" — picked by its WORDS, so a reordered enum cannot file
     a different claim about where her picture came from. */
  await page.evaluate(() => {
    const claim = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__claim button"))
      .find((one) => (one.textContent ?? "").toLowerCase().includes("permission"));
    claim?.click();
  });
  await page.waitForFunction(() => document.querySelector(".dpc-refine__claim") === null, { timeout: 60_000 })
    .catch(() => null);

  await page.type(".dpc-refine__field", sentence);
  await page.evaluate(() => {
    const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
      .find((button) => button.type === "submit");
    submit?.click();
  });

  /*
    WAIT ON THE ANSWERS, NOT ON THE SENTENCE. The outcome line is written for
    every outcome including a refusal, so waiting on it would pass on the very
    thing this drive would want to catch. The chips only exist for a question.
  */
  const answers = await page
    .waitForSelector(".dpc-refine__answers", { timeout: 180_000 })
    .catch(() => null);
  return answers !== null;
}

/**
 * PUT THE RESIDENT THERE — ONCE, and never once per theme.
 *
 * ⚠ **THE DEFECT THIS SHAPE EXISTS TO PREVENT COST 50 DEV CREDITS IN TWO PAID
 * RENDERS, in two runs, by the same mistake made twice.**
 *
 * The statue is minted at her upper chest and the question it raises is LEFT
 * UNANSWERED: navigating away keeps the row, which is the state a customer is
 * in when she uploads a design and comes back later. Planting the row in the
 * database instead would be a fixture standing in for the thing under test.
 *
 * **But that step is only safe while the address is EMPTY.** Run it a second
 * time and the same picture is at the same address, which is not a question at
 * all — it is a reuse RIDE, and it charges and renders while a driver sits
 * waiting for chips that a render never produces.
 *
 * The first version of this driver put the DECLINE after both themes, so the
 * second theme rode. The second version fixed that and put this SETUP inside
 * the per-theme run, so the second theme rode again — a different line, the
 * same shape: **a step whose safety depends on state an earlier run changed.**
 * So it is hoisted out of the loop, which is the structure rather than a
 * comment about the structure.
 */
async function putTheResidentThere(): Promise<boolean> {
  const raised = await ask("dark", RESIDENT_PICTURE, ASK);
  if (!raised) {
    const said = await page.evaluate(() => document.querySelector(".dpc-refine__outcome")?.textContent?.trim() ?? "");
    check("the resident could be put there", false, JSON.stringify(said));
  }
  return raised;
}

async function run(theme: "dark" | "light"): Promise<boolean> {
  /*
    A DIFFERENT DESIGN AT THE ADDRESS THE RESIDENT HOLDS, which is the question.
    Free: the mint spends house money and nothing is claimed.
  */
  const raised = await ask(theme, PICTURE, ASK);
  if (!raised) {
    /* Reads EVERY place the panel can speak — a failure probe that reads one
       element reports a refusal it was not looking at as silence. */
    const said = await page.evaluate(() => ({
      outcome: document.querySelector(".dpc-refine__outcome")?.textContent?.trim() ?? "",
      attach: document.querySelector(".dpc-refine__readNote")?.textContent?.trim() ?? "",
      claimOpen: document.querySelector(".dpc-refine__claim") !== null,
    }));
    check(`THE OFFER IS ON SCREEN (${theme})`, false, JSON.stringify(said));
    await page.screenshot({ path: `${OUT}/replace-offer-${theme}-FAILED.png` });
    return false;
  }

  /* The picture arrives over an authenticated route a moment after the element
     — measuring the instant it exists reads a picture that has not decoded YET
     as one that never will. */
  await page.waitForFunction(
    () => {
      const image = document.querySelector<HTMLImageElement>(".dpc-refine__shownCut img");
      return Boolean(image && image.complete && image.naturalWidth > 0);
    },
    { timeout: 60_000 },
  ).catch(() => null);

  const seen = await page.evaluate(() => ({
    question: document.querySelector(".dpc-refine__outcome")?.textContent?.trim() ?? "",
    chips: Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__answer"))
      .map((one) => (one.textContent ?? "").trim()),
    cut: (() => {
      const image = document.querySelector<HTMLImageElement>(".dpc-refine__shownCut img");
      return image ? [image.naturalWidth, image.naturalHeight] : null;
    })(),
  }));

  check(`THE OFFER IS ON SCREEN (${theme})`, true, JSON.stringify(seen.question));
  /* IT NAMES WHAT IT WOULD DESTROY — the offer's whole content (fable-1158 §1). */
  check(
    `it names the resident's place (${theme})`,
    seen.question.includes("Her upper chest already has a design"),
    JSON.stringify(seen.question),
  );
  check(
    `it says nothing has been charged (${theme})`,
    seen.question.includes("Nothing has been charged"),
  );
  check(
    `both chips are drawn, in the server's own words (${theme})`,
    seen.chips.includes("Yes — replace it") && seen.chips.includes("No, keep the one she has"),
    JSON.stringify(seen.chips),
  );
  /* AND THE REPLACEMENT IS VISIBLE — a question about a picture nobody can see
     is not a question (fable-1127 §2). Bytes, not an element. */
  check(
    `the replacement design is decoded on screen (${theme})`,
    Boolean(seen.cut && seen.cut[0]! > 0 && seen.cut[1]! > 0),
    JSON.stringify(seen.cut),
  );

  await page.screenshot({ path: `${OUT}/replace-offer-${theme}.png` });
  const panel = await page.$(".dpc-refine");
  if (panel) await panel.screenshot({ path: `${OUT}/replace-offer-${theme}-panel.png` });

  /*
    AND THE RUN GIVES THE ROW BACK BEFORE THE NEXT ONE STARTS — the decline,
    tapped by its LABEL exactly as the client sends it.

    **THIS IS INSIDE THE RUN BECAUSE THE FIRST VERSION OF THIS DRIVER PUT IT
    AFTER BOTH OF THEM, AND THAT COST 25 CREDITS.** With the minted row still
    standing, the second theme's ask was the SAME picture at the SAME address —
    which is a reuse RIDE, not a question. It charged and rendered while the
    driver sat waiting 180 seconds for chips that were never coming, because a
    render does not produce any.

    So each run restores the state it found, and the next one raises the same
    question again from the same place.
  */
  await page.evaluate(() => {
    const keep = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__answer"))
      .find((one) => (one.textContent ?? "").includes("keep the one she has"));
    keep?.click();
  });
  const said = await page.waitForFunction(
    () => {
      const text = document.querySelector(".dpc-refine__outcome")?.textContent ?? "";
      return text.includes("Discarded") ? text.trim() : false;
    },
    { timeout: 120_000 },
  ).then((handle) => handle.jsonValue() as Promise<string>, () => "");
  const declined = said.includes("Discarded");
  check(`the decline threw away the replacement and said so (${theme})`, declined, JSON.stringify(said));
  if (theme === "dark") await page.screenshot({ path: `${OUT}/replace-declined.png` });
  return declined;
}

/*
  AND THE SECOND RUN IS GATED ON THE FIRST ONE HAVING GIVEN THE ROW BACK.

  If the decline did not land, the minted row is still at the address and the
  next ask is a paid render rather than a question. Refusing to start is the
  only safe answer to that, and it is the lesson above expressed as control
  flow rather than as a comment.
*/
/*
  THE RESIDENT IS PUT THERE ONCE — and only if the address is empty, which on a
  re-run of this driver it is not. `RESIDENT_ALREADY_THERE=1` says so, and it is
  an explicit switch rather than a probe because the cheap way to find out costs
  a paid render (see `putTheResidentThere`).
*/
const ready = process.env.RESIDENT_ALREADY_THERE === "1" || await putTheResidentThere();
if (!ready) {
  check("nothing was driven — the resident could not be put at the address", false);
} else {
  const restored = await run("dark");
  if (restored) {
    await run("light");
  } else {
    check("the light run was SKIPPED — the dark run left a row at the address", false);
  }
}

await browser.close();

console.log(`\n${failures.length === 0 ? "ALL PASS" : `${failures.length} FAILED`}`);
for (const failure of failures) console.log(`  FAILED  ${failure}`);
/* The driver ends by ending the process (`4ec6077d`) — puppeteer leaves the
   node handle open and a drive that never exits is a drive nobody reads. */
process.exit(failures.length === 0 ? 0 : 1);
