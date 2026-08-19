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
 *   2  a picture chosen, not yet claimed      the 32px chip and the question
 *   3  the picture attached                   the chip and the quiet line
 *
 * It drives the REAL surface with a real file chosen through the real picker,
 * so state 2 is the browser's own file input rather than a prop set by a test.
 *
 *   npx tsx scripts/drive-attach-surface-evidence.mts
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import { SignJWT } from "jose";

import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/attach-surface";
/* The READY candidate on verify-bot's own sheet, read off the dev database
   rather than guessed — an expired or signed one has no refine panel at all. */
const SESSION = process.env.ATTACH_SESSION ?? "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
const PICTURE = process.env.ATTACH_PICTURE
  ?? "docs/specs/references/templates/ink-template-armless-set-panel.png";

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

/**
 * OPEN THE SHEET IN ONE THEME AND GET TO THE BOX.
 *
 * A fresh load per theme rather than a class toggled in place: the theme is
 * owned by the provider and persisted under `drape_theme`, and a class swapped
 * underneath it is a picture of a state the app cannot be in.
 */
async function openTheBox(theme: "dark" | "light"): Promise<boolean> {
  await page.evaluateOnNewDocument(`(() => { try { window.localStorage.setItem("drape_theme", ${JSON.stringify(theme)}); } catch {} })()`);
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
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
  return box !== null;
}

async function shoot(name: string, theme: "dark" | "light"): Promise<void> {
  const panel = await page.$(".dpc-refine");
  if (!panel) { check(`photographed ${name} (${theme})`, false); return; }
  await panel.screenshot({ path: `${OUT}/${name}-${theme}.png` as never });
  check(`photographed ${name} (${theme})`, true, `${OUT}/${name}-${theme}.png`);
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
    const geometry = await page.evaluate(() => {
      const button = document.querySelector<HTMLElement>(".dpc-refine__attach");
      const field = document.querySelector<HTMLElement>(".dpc-refine__field");
      if (!button || !field) return null;
      const b = button.getBoundingClientRect();
      const f = field.getBoundingClientRect();
      return {
        sameRow: Math.abs(b.top - f.top) < 4 && Math.abs(b.height - f.height) < 4,
        leftOfTheField: b.right <= f.left + 1,
        label: (button.textContent ?? "").trim(),
        aria: button.getAttribute("aria-label") ?? "",
        height: Math.round(b.height),
      };
    });
    check(`the + sits in the box's own row (${theme})`, geometry?.sameRow === true, JSON.stringify(geometry));
    check(`the + is at the LEFT of the field (${theme})`, geometry?.leftOfTheField === true);
    /* No label, no tooltip chrome — design §6. The name it carries is for a
       screen reader, and it names the ACT rather than a feature. */
    check(`the + carries no visible label (${theme})`, geometry?.label === "");
    check(`it is named for a screen reader (${theme})`, (geometry?.aria ?? "").length > 0, geometry?.aria);

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
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>(".dpc-refine__attachedOff")?.click();
      const field = document.querySelector<HTMLInputElement>(".dpc-refine__field");
      if (field) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
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
