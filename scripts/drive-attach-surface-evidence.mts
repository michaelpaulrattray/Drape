/**
 * THE ATTACH SURFACE, PHOTOGRAPHED IN THE RUNNING APP — the UI milestone
 * contract's evidence pack (founder, 2026-08-01; ordered again fable-1101 §3).
 *
 * Render before shipping (law 6): no visual change ships without being looked
 * at in the running app. What this driver produces is the LOOKING — both
 * themes, every state the control has, at the size a person sees it — plus the
 * mechanizable design laws as assertions rather than as review memory.
 *
 * The states, in the order a person meets them:
 *
 *   1  the box with nothing attached          the `+` at the left of the row
 *   1b a picture in the AIR over the box      the line, the sentence, the dimmed box
 *   1c that picture dropped                   the same chip the picker produces
 *   2  a picture chosen, not yet claimed      the 32px chip and the question
 *   3  the picture attached                   the chip and the quiet line
 *
 * States 1b and 1c are card #2912 — his word, 2026-10-31, verbatim: *"also
 * allow drag an drop of reference images into the refine box"*. They are driven
 * with a REAL `File` carrying the real bytes of the same picture state 2 picks
 * through the picker, built in page context from base64 — so the two doors are
 * photographed holding the identical photograph, which is the only way the
 * claim *the drop and the `+` produce the same thing* can be looked at.
 *
 * It drives the REAL surface with a real file chosen through the real picker,
 * so state 2 is the browser's own file input rather than a prop set by a test.
 *
 *   npx tsx scripts/drive-attach-surface-evidence.mts
 */
import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";

import { SignJWT } from "jose";

import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/attach-surface";
/*
  WHICH SHEET — ASKED OF THE PRODUCT, NEVER HARD-WIRED (repaired 2026-10-31,
  card #2912).

  ⚠ This was a fixture: `af5011d8-…`, with a comment saying *an expired or
  signed one has no refine panel at all* — which is precisely what it became.
  Read at the rows the day this was fixed, that session is the bot's, status
  **abandoned**, created **2026-08-01**; a sheet is kept thirty quiet days
  (#1464), so it had been past its keep for about two months. The driver's own
  verdict was `a candidate tile is on the sheet: FAIL`, both themes — a red
  that says nothing about the surface, which is the same defect the OPEN_ID
  block below exists for, wearing a different hat.

  So the sheet is DERIVED: `castingV2.openSessions` is the product's own
  answer to *which sheets does this account have open*, and a card with a face
  on it is a sheet with a candidate to open. `ATTACH_SESSION=…` still
  overrides, and with no answer the driver REFUSES rather than reporting FAIL.
*/
async function askProduct<T>(procedure: string): Promise<T | null> {
  const url = `${BASE}/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`;
  const response = await fetch(url, { headers: { cookie: `app_session_id=${token}` } });
  const body = await response.json().catch(() => null) as { result?: { data?: { json?: T } } } | null;
  return body?.result?.data?.json ?? null;
}

async function liveSheet(): Promise<string> {
  const named = process.env.ATTACH_SESSION;
  if (named) return named;
  type Card = { sessionId: string; previewTiles?: Array<{ kind: string }> };
  const cards = await askProduct<Card[]>("castingV2.openSessions");
  const withAFace = (cards ?? []).find((card) =>
    (card.previewTiles ?? []).some((tile) => tile.kind === "face"));
  if (!withAFace) {
    console.log(`REFUSED: ${OPEN_ID} has no open sheet carrying a face, so there is no refine panel to photograph.`);
    console.log("  A driver whose subject is absent must FAIL rather than skip, and it must say which absence it is.");
    console.log("  Roll a sheet for this account, or name one: ATTACH_SESSION=<public id>");
    process.exit(1);
  }
  return withAFace.sessionId;
}
const PICTURE = process.env.ATTACH_PICTURE
  ?? "docs/specs/references/templates/ink-template-armless-set-panel.png";

/*
  THE SAME BYTES BOTH DOORS GET (#2912). `uploadFile` hands the picker a path;
  a drop has to carry a real `File`, and the only honest way to build one in
  page context is from the bytes themselves. Read once here so a difference
  between the two roads can never be a difference in what was dropped.
*/
const pictureBytes = await readFile(PICTURE);
const pictureBase64 = pictureBytes.toString("base64");

const failures: string[] = [];
const check = (name: string, ok: boolean, saw = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${saw ? ` — saw ${saw}` : ""}`);
  if (!ok) failures.push(name);
};

await mkdir(OUT, { recursive: true });

/* What each road showed, so *the drop and the `+` produce the same thing* is a
   comparison in the output rather than a sentence in a report (#2912). */
const droppedSurface: Record<string, { question: string; chips: string }> = {};
const pickedSurface: Record<string, { question: string; chips: string }> = {};

/**
 * ⚠ WHO THIS DRIVES IS PART OF WHAT IT MEASURES (2026-08-23).
 *
 * The `+` is drawn only where the page is handed the attach door, and the door
 * is `CASTING_REFERENCE_ATTACH_SCOPE`. Hard-wired to `verify-bot-local` — user
 * 823 — this driver reported **"the + is drawn: FAIL", both themes**, on a
 * surface that was working perfectly: the flag is `users:1`, so the control was
 * correctly absent and the driver had no way to say so.
 *
 * A red that cannot distinguish *"the control is broken"* from *"this user may
 * not have it"* is the same defect as a green that proves nothing, with its
 * sign flipped — and it is the more expensive one, because somebody goes
 * looking for a bug that is not there.
 *
 * So the subject is overridable, and the driver REFUSES rather than reporting
 * FAIL when the door is shut for whoever it is driving (see the door check
 * below). `ATTACH_OPEN_ID=…` with a matching `ATTACH_SESSION=…`.
 */
const OPEN_ID = process.env.ATTACH_OPEN_ID ?? "verify-bot-local";

const token = await new SignJWT({
  openId: OPEN_ID,
  appId: process.env.VITE_APP_ID,
  name: OPEN_ID === "verify-bot-local" ? "Verify Bot" : "attach eye",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

/*
  THE DOOR, ASKED BEFORE THE SURFACE IS JUDGED.

  `attachReferenceEnabled` is the same field `CastingSheet.tsx` reads to decide
  whether to hand the panel an attach function at all, so this is the product's
  own answer rather than a second opinion about the flag. Shut, every assertion
  below would fail on a surface that is working exactly as designed — which is
  what happened on 2026-08-23 and is why this block exists.

  It REFUSES rather than skipping: a driver whose subject is absent must fail
  (the verify skill's own rule), and it must fail saying WHICH absence it is.
*/
{
  const response = await fetch(`${BASE}/api/trpc/castingV2.config?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`, {
    headers: { cookie: `app_session_id=${token}` },
  });
  const body = await response.json().catch(() => null) as { result?: { data?: { json?: { attachReferenceEnabled?: boolean } } } } | null;
  const open = body?.result?.data?.json?.attachReferenceEnabled;
  if (open !== true) {
    console.log(`REFUSED: the attach door is SHUT for ${OPEN_ID} (config says attachReferenceEnabled=${open}).`);
    console.log("  This driver photographs a control the page only draws where the road serves the account,");
    console.log("  so every assertion below would fail on a surface that is working. That is not a reading.");
    console.log(`  Drive somebody inside CASTING_REFERENCE_ATTACH_SCOPE: ATTACH_OPEN_ID=… ATTACH_SESSION=…`);
    process.exit(1);
  }
  console.log(`door: attachReferenceEnabled=true for ${OPEN_ID}`);
}

const SESSION = await liveSheet();
console.log(`sheet: ${SESSION}${process.env.ATTACH_SESSION ? " (named)" : " (derived from openSessions)"}`);

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

/**
 * OPEN THE SHEET IN ONE THEME AND GET TO THE BOX.
 *
 * A fresh load per theme rather than a class toggled in place: the theme is
 * owned by the provider and persisted under `drape_theme`, and a class swapped
 * underneath it is a picture of a state the app cannot be in.
 */
async function openTheBox(theme: "dark" | "light"): Promise<boolean> {
  await page.evaluateOnNewDocument(`(() => { try { window.localStorage.setItem("drape_theme", ${JSON.stringify(theme)}); } catch {} })()`);
  await page.goto(`${BASE}/app/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
  /* Wait on the THING, never on the clock — the tiles arrive after a remote
     database round trip, and a fixed sleep reports a slow answer as no answer. */
  const tile = await page
    .waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
    .catch(() => null);
  check(`a candidate tile is on the sheet (${theme})`, tile !== null);
  if (!tile) return false;
  await tile.click();
  const box = await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null);
  check(`the ask box is on screen (${theme})`, box !== null);
  if (!box) return false;
  /*
    ⚠ AND WAIT FOR IT TO HAVE PAINTED, which is a different question from
    whether it is in the document — the verify skill's second reading. Measured
    2026-10-31: `1-empty-dark.png` came back a **263-byte flat dark rectangle**
    while every arm around it passed, because the first pass photographs a cold
    app and `.dpc-refine__field` exists before the panel has laid out. A frame
    that was TAKEN but shows nothing is a receipt, not evidence, and it is the
    frame a person is asked to look at.

    The priced button is the thing to wait on rather than a clock: it carries
    `Refine` only once the panel has its version, and its price only once that
    has been read, so non-empty text on it means the composer is composed.
  */
  const painted = await page
    .waitForFunction(
      () => {
        const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
          .find((one) => one.type === "submit");
        return (submit?.textContent ?? "").trim().length > 0;
      },
      { timeout: 60_000 },
    )
    .then(() => true, () => false);
  check(`the composer has painted, not merely mounted (${theme})`, painted);
  return painted;
}

/**
 * ⚠ A FRAME TAKEN IS NOT A FRAME THAT SHOWS ANYTHING, and this driver was
 * producing the proof of that: measured 2026-10-31, `1-empty-dark.png` came
 * back a **263-byte flat dark rectangle** — the panel photographed through a
 * drawer still fading in — while every arm around it passed. It is the first
 * shot of the first theme, so it is the one frame a cold run always spoils and
 * the one a person opens first.
 *
 * Waiting on the element is not enough and neither is waiting on its text: the
 * opacity lives on an ANCESTOR (`.dpc-viewer__drawer`, 240ms), so the panel is
 * laid out, populated and invisible all at once. So the wait is the product of
 * every ancestor's opacity reaching 1, with a non-zero box, and then two
 * animation frames so the compositor has drawn what the style says.
 */
async function shoot(name: string, theme: "dark" | "light"): Promise<void> {
  const panel = await page.$(".dpc-refine");
  if (!panel) { check(`photographed ${name} (${theme})`, false); return; }
  const settled = await page
    .waitForFunction(
      () => {
        const node = document.querySelector<HTMLElement>(".dpc-refine");
        if (!node) return false;
        const box = node.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) return false;
        let through = 1;
        for (let at: HTMLElement | null = node; at; at = at.parentElement) {
          through *= Number(getComputedStyle(at).opacity);
        }
        if (through <= 0.99) return false;
        /*
          ⚠ AND THE PHOTOGRAPH BESIDE IT HAS TO HAVE DECODED, which is what the
          263-byte frame actually was. Measured: at the first shot of a cold
          pass the composer is **178px** wide against the 513px it settles at —
          the viewer's column is sized by the picture, and the picture had not
          arrived. So the panel was photographed truthfully, at a width it only
          has for a second, holding a placeholder too long for it. Waiting on
          the BYTES rather than on the element is the verify skill's own second
          reading, and it is the only thing that makes this frame reproducible.
        */
        const pictures = Array.from(document.querySelectorAll<HTMLImageElement>(".dpc-viewer__stage img"));
        return pictures.length > 0 && pictures.every((one) => one.complete && one.naturalWidth > 0);
      },
      { timeout: 30_000 },
    )
    .then(() => true, () => false);
  /* Two frames: one for the style to be committed, one for it to be drawn. */
  await page.evaluate(() => new Promise<void>((done) => {
    requestAnimationFrame(() => requestAnimationFrame(() => done()));
  }));
  await panel.screenshot({ path: `${OUT}/${name}-${theme}.png` as never });
  check(`photographed ${name} (${theme})`, settled, `${OUT}/${name}-${theme}.png`);
}

for (const theme of ["dark", "light"] as const) {
  await (async () => {
    if (!(await openTheBox(theme))) return;
    /* ── state 1: nothing attached ── */
    const plus = await page.$(".dpc-refine__attach");
    check(`the + is drawn (${theme})`, plus !== null);
    await shoot("1-empty", theme);

    if (!plus) return;

    /* THE LAWS, measured rather than remembered. */
    /*
      ⚠ RE-AIMED 2026-10-31 (card #2912), AND THE OLD AIM IS WORTH RECORDING.
      These two arms asked whether the `+` shares the FIELD'S row and sits to
      its left — the shape before #2533, which moved it onto a bar UNDER the
      field together with the priced button. Measured at the running app the
      day this was re-aimed: `dpc-refine__attach < dpc-refine__bar <
      dpc-refine__box`, button top 500 against field top 474. So the arms had
      been describing a layout the founder replaced, and they had never gone
      red at anybody, because the fixture sheet above them had expired and
      every run died before reaching them. The design intent they were written
      to protect is unchanged and is what they ask now: the `+` is the
      LEFTMOST thing on the box's own bar, and the priced button is at the far
      end of it.
    */
    const geometry = await page.evaluate(() => {
      const button = document.querySelector<HTMLElement>(".dpc-refine__attach");
      const bar = document.querySelector<HTMLElement>(".dpc-refine__bar");
      const field = document.querySelector<HTMLElement>(".dpc-refine__field");
      const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
        .find((one) => one.type === "submit");
      if (!button || !bar || !field) return null;
      const b = button.getBoundingClientRect();
      const r = bar.getBoundingClientRect();
      const f = field.getBoundingClientRect();
      const send = submit?.getBoundingClientRect();
      return {
        onTheBar: Math.abs(b.top + b.height / 2 - (r.top + r.height / 2)) < 4,
        leftmostOnTheBar: b.left <= r.left + 13,
        underTheField: b.top >= f.bottom - 1,
        sendIsAtTheOtherEnd: send ? send.left > b.right : null,
        label: (button.textContent ?? "").trim(),
        aria: button.getAttribute("aria-label") ?? "",
        height: Math.round(b.height),
      };
    });
    check(`the + sits on the box's own bar (${theme})`, geometry?.onTheBar === true, JSON.stringify(geometry));
    check(`the + is the LEFTMOST thing on it (${theme})`, geometry?.leftmostOnTheBar === true);
    check(`the bar is under the field, as #2533 built it (${theme})`, geometry?.underTheField === true);
    check(`the priced button is at the other end (${theme})`, geometry?.sendIsAtTheOtherEnd === true);
    /* No label, no tooltip chrome — design §6. The name it carries is for a
       screen reader, and it names the ACT rather than a feature. */
    check(`the + carries no visible label (${theme})`, geometry?.label === "");
    check(`it is named for a screen reader (${theme})`, (geometry?.aria ?? "").length > 0, geometry?.aria);

    /* ── state 1b: a picture in the AIR over the box (#2912) ── */
    /*
      The box's border at rest, read BEFORE the drag so the over-state can be a
      DELTA rather than an absolute. Card 1118's lesson on the ink panel next
      door: that control was already bordered, so "it has a border while a file
      is over it" was true of the defect too. ⚠ There is no transition on this
      box (checked at the stylesheet), so a computed read immediately after the
      flip is the settled value and not the start of an animation.
    */
    const atRest = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>(".dpc-refine__box");
      const field = document.querySelector<HTMLElement>(".dpc-refine__field");
      if (!box || !field) return null;
      return {
        border: getComputedStyle(box).borderTopColor,
        fieldOpacity: getComputedStyle(field).opacity,
        say: document.querySelector(".dpc-refine__dropsay") !== null,
      };
    });
    check(`the box is readable at rest (${theme})`, atRest !== null, JSON.stringify(atRest));
    check(`no drop sentence before a file is in the air (${theme})`, atRest?.say === false);

    /* A real DragEvent carrying a real file, dispatched on the box itself — the
       browser's own event shape, so React's handler sees what a hand produces.
       `types` only reports "Files" once an item is actually added, and that
       test is the one thing standing between a picture target and a target that
       lights up for dragged TEXT. */
    const drag = await page.evaluate((base64: string) => {
      const box = document.querySelector<HTMLElement>(".dpc-refine__box");
      if (!box) return null;
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const file = new File([bytes], "dropped.png", { type: "image/png" });
      const data = new DataTransfer();
      data.items.add(file);
      const carriedFiles = data.types.includes("Files");
      box.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: data }));
      box.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
      (window as unknown as { __drop2912?: DataTransfer }).__drop2912 = data;
      return { carriedFiles };
    }, pictureBase64);
    check(`the dragged thing reports itself as a file (${theme})`, drag?.carriedFiles === true);

    const inTheAir = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>(".dpc-refine__box");
      const field = document.querySelector<HTMLElement>(".dpc-refine__field");
      const say = document.querySelector<HTMLElement>(".dpc-refine__dropsay");
      if (!box || !field) return null;
      const sayBox = say?.getBoundingClientRect();
      const boxBox = box.getBoundingClientRect();
      return {
        marked: box.classList.contains("dpc-refine__box--drop"),
        border: getComputedStyle(box).borderTopColor,
        fieldOpacity: getComputedStyle(field).opacity,
        words: say?.textContent?.trim() ?? "",
        sayColour: say ? getComputedStyle(say).color : "",
        sayPointer: say ? getComputedStyle(say).pointerEvents : "",
        /* Over the box, not beside it — the overlay must actually cover it. */
        covers: sayBox && boxBox
          ? Math.abs(sayBox.width - boxBox.width) < 4 && Math.abs(sayBox.height - boxBox.height) < 4
          : false,
        sayPainted: sayBox ? sayBox.width > 0 && sayBox.height > 0 : false,
      };
    });
    check(`the box answers the hand (${theme})`, inTheAir?.marked === true, JSON.stringify(inTheAir));
    /* ⚠ A DELTA, NEVER AN ABSOLUTE. */
    check(
      `its border CHANGES rather than merely existing (${theme})`,
      Boolean(inTheAir && atRest && inTheAir.border !== atRest.border),
      `${atRest?.border} → ${inTheAir?.border}`,
    );
    check(
      `the sentence is on screen and says what happens to her picture (${theme})`,
      /drop/i.test(inTheAir?.words ?? "") && /attach/i.test(inTheAir?.words ?? ""),
      inTheAir?.words,
    );
    check(`it is laid OVER the box (${theme})`, inTheAir?.covers === true);
    check(`it actually painted (${theme})`, inTheAir?.sayPainted === true);
    check(`it cannot swallow the drop itself (${theme})`, inTheAir?.sayPointer === "none");
    check(
      `the box's own contents dim behind it (${theme})`,
      Number(inTheAir?.fieldOpacity ?? 1) < Number(atRest?.fieldOpacity ?? 1),
      `field opacity ${atRest?.fieldOpacity} → ${inTheAir?.fieldOpacity}`,
    );
    await shoot("1b-in-the-air", theme);

    /* ── state 1c: the drop lands, and it lands where the picker lands ── */
    await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>(".dpc-refine__box");
      const data = (window as unknown as { __drop2912?: DataTransfer }).__drop2912;
      if (!box || !data) return;
      box.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
    });
    const droppedChip = await page.waitForSelector(".dpc-refine__thumb img", { timeout: 20_000 }).catch(() => null);
    check(`a dropped picture becomes the same chip (${theme})`, droppedChip !== null);
    const dropped = await page.evaluate(() => {
      const thumb = document.querySelector<HTMLImageElement>(".dpc-refine__thumb img");
      const row = document.querySelector<HTMLElement>(".dpc-refine__claim");
      const box = document.querySelector<HTMLElement>(".dpc-refine__box");
      return {
        painted: thumb ? thumb.naturalWidth > 0 : false,
        question: row?.querySelector(".dpc-refine__claimAsk")?.textContent?.trim() ?? "",
        chips: Array.from(row?.querySelectorAll("button") ?? []).map((one) => one.textContent?.trim() ?? ""),
        /* And the over-state is GONE the moment the file lands — a box still
           dimmed under its own sentence after the drop reads as stuck. */
        stillMarked: box?.classList.contains("dpc-refine__box--drop") ?? null,
        stillSaying: document.querySelector(".dpc-refine__dropsay") !== null,
      };
    });
    check(`the dropped picture painted (${theme})`, dropped.painted === true);
    check(`the over-state clears when it lands (${theme})`, dropped.stillMarked === false && dropped.stillSaying === false);
    check(`the drop reaches the same question the picker does (${theme})`, dropped.question.endsWith("?"), dropped.question);
    await shoot("1c-dropped", theme);
    /* The surface the two roads are compared on, recorded rather than described. */
    droppedSurface[theme] = { question: dropped.question, chips: dropped.chips.join(" · ") };

    /*
      ⚠ AND THE DROPPED PICTURE IS CLAIMED, because stopping at the question
      would leave the card's actual proof unmeasured. *A drop and a `+` produce
      the same attachment row* is a claim about the ROW, and a chip on screen is
      not a row — the only thing that writes one is answering the question. The
      row this leaves behind is the one `_2912-caprow` compares with the
      picker's.
    */
    await page.evaluate(() => {
      document.querySelector<HTMLElement>(".dpc-refine__claim")?.querySelector("button")?.click();
    });
    const droppedLanded = await page
      .waitForFunction(() => document.querySelector(".dpc-refine__claim") === null, { timeout: 30_000 })
      .then(() => true, () => false);
    check(`a dropped picture can be claimed like any other (${theme})`, droppedLanded);

    /* Put the box back to empty, so state 2 drives the PICKER from the same
       starting point this pass began at rather than on top of a drop. */
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>(".dpc-refine__attachedOff")?.click();
    });
    await page.waitForFunction(() => document.querySelector(".dpc-refine__thumb img") === null, { timeout: 10_000 })
      .then(() => true, () => false);

    /* ── state 2: a picture chosen, not yet claimed ── */
    /* The picker is a real `<input type="file">`, and `uploadFile` is typed on
       the input handle rather than on a bare Element. */
    const input = (await page.$(".dpc-refine__readInput")) as ElementHandle<HTMLInputElement> | null;
    if (!input) { check(`the picker exists (${theme})`, false); return; }
    await input.uploadFile(PICTURE);
    const chip = await page.waitForSelector(".dpc-refine__thumb img", { timeout: 20_000 }).catch(() => null);
    check(`her picture appears as a chip (${theme})`, chip !== null);

    const claim = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(".dpc-refine__claim");
      const chipBoxElement = document.querySelector<HTMLElement>(".dpc-refine__thumb");
      const thumb = document.querySelector<HTMLImageElement>(".dpc-refine__thumb img");
      const field = document.querySelector<HTMLElement>(".dpc-refine__field");
      const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
        .find((button) => button.type === "submit");
      /* THE CHIP, not the picture inside it — 32px is the thing a person sees,
         and the image sits inside a 1px monochrome frame. Measuring the `img`
         reads 30 and would have moved a ruled figure to fit an inner box. */
      const chipBox = chipBoxElement?.getBoundingClientRect();
      const pictureBox = thumb?.getBoundingClientRect();
      const fieldBox = field?.getBoundingClientRect();
      return {
        question: row?.querySelector(".dpc-refine__claimAsk")?.textContent?.trim() ?? "",
        chips: Array.from(row?.querySelectorAll("button") ?? []).map((one) => one.textContent?.trim() ?? ""),
        thumbSize: chipBox ? [Math.round(chipBox.width), Math.round(chipBox.height)] : null,
        pictureSize: pictureBox ? [Math.round(pictureBox.width), Math.round(pictureBox.height)] : null,
        aboveTheInput: chipBox && fieldBox ? chipBox.bottom <= fieldBox.top + 1 : false,
        /* The picture is loaded rather than a broken box — a chip that has not
           decoded photographs as an empty square. */
        painted: thumb ? thumb.naturalWidth > 0 : false,
        submitHeld: submit?.disabled ?? null,
      };
    });
    check(
      `the chip is 32px (${theme})`,
      JSON.stringify(claim.thumbSize) === "[32,32]",
      `${JSON.stringify(claim.thumbSize)} chip, ${JSON.stringify(claim.pictureSize)} picture inside its frame`,
    );
    check(`the chip is ABOVE the input (${theme})`, claim.aboveTheInput === true);
    check(`her picture actually painted (${theme})`, claim.painted === true);
    check(`the claim is ASKED, never assumed (${theme})`, claim.question.endsWith("?"), claim.question);
    check(`both answers are offered (${theme})`, claim.chips.length === 2, claim.chips.join(" · "));
    pickedSurface[theme] = { question: claim.question, chips: claim.chips.join(" · ") };
    /* ⚠ THE CARD'S OWN PROOF, AS A COMPARISON (#2912): the same photograph down
       both roads has to reach the same place. A drop that landed somewhere
       subtly else — a different question, one chip, no claim at all — would
       have passed every arm above on each road taken separately. */
    check(
      `the drop and the + reach the identical surface (${theme})`,
      JSON.stringify(droppedSurface[theme]) === JSON.stringify(pickedSurface[theme]),
      `${JSON.stringify(droppedSurface[theme])} vs ${JSON.stringify(pickedSurface[theme])}`,
    );
    await shoot("2-claiming", theme);

    /* The ask is HELD while the picture is unclaimed — sending anyway would
       drop her photograph in silence. */
    await page.type(".dpc-refine__field", "copy this hair");
    const held = await page.evaluate(() => {
      const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
        .find((button) => button.type === "submit");
      return submit?.disabled ?? null;
    });
    check(`the ask is held until she answers (${theme})`, held === true, String(held));

    /* ── state 3: attached ── */
    await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(".dpc-refine__claim");
      const first = row?.querySelector<HTMLButtonElement>("button");
      first?.click();
    });
    const settled = await page.waitForFunction(
      () => document.querySelector(".dpc-refine__claim") === null,
      { timeout: 30_000 },
    ).then(() => true, () => false);
    check(`the claim clears once she answers (${theme})`, settled);
    await shoot("3-attached", theme);

    const after = await page.evaluate(() => {
      const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
        .find((button) => button.type === "submit");
      return {
        submitFree: submit ? !submit.disabled : null,
        note: document.querySelector(".dpc-refine__attached .dpc-refine__note")?.textContent?.trim() ?? "",
        off: document.querySelector(".dpc-refine__attachedOff")?.getAttribute("aria-label") ?? "",
      };
    });
    check(`the ask is free again (${theme})`, after.submitFree === true);
    check(`one quiet line says what the picture is for (${theme})`, after.note.length > 0, after.note);
    check(`the × promises no deletion (${theme})`, /off your ask/i.test(after.off), after.off);

    /* Put the surface back for the next theme's pass. */
    /*
      ⚠ `HTMLTextAreaElement`, NOT `HTMLInputElement` — this threw `Illegal
      invocation` and killed the driver mid-pass on the first run that ever
      reached it (2026-10-31). The box became a `<textarea>` in #2533 so a long
      sentence could be read back whole; the value setter was still being taken
      off the input prototype, which belongs to a different interface. Both
      halves of this block had been unreachable behind an expired fixture.
    */
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>(".dpc-refine__attachedOff")?.click();
      const field = document.querySelector<HTMLTextAreaElement>(".dpc-refine__field");
      if (field) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        setter?.call(field, "");
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  })();
}

await writeFile(`${OUT}/verdict.json`, JSON.stringify({ failures }, null, 2));
console.log(`\n${failures.length === 0 ? "PASS" : `FAIL — ${failures.length}`}`);
await browser.close();
process.exit(failures.length === 0 ? 0 : 1);
