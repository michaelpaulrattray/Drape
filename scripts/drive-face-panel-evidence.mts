/**
 * "ON HER FACE" — panel v2, driven in the real browser (D-101, the UI milestone
 * contract).
 *
 * Panel v2 was built whole in shift 26 and NEVER LOOKED AT. This opens the real
 * sheet, opens the real viewer on a real frame, photographs the panel in both
 * themes, and asserts the things a photograph cannot: that every row has a place
 * on the picture and every place belongs to a row, that hovering a row lights
 * ITS OWN region and nothing else and hovering the region lights the row, that
 * clicking it opens a scoped box AT that feature already carrying their
 * sentence, and that closing it spends nothing.
 *
 * Every check records what it SAW (D-235). An affirmative with no observation
 * behind it is not a reading.
 *
 *   npx tsx scripts/drive-face-panel-evidence.mts [--base http://localhost:3000]
 *
 * `--base` is the whole vocabulary: since #345 an unknown word is refused
 * rather than discarded, so a flag missing from here cannot be discovered.
 *
 * Shots land in `output/panel-v2/`.
 *
 * # ⚠ THE SUBJECT IS FOUND AT THE ROWS, NOT NAMED HERE (#1151, 2026-09-26)
 *
 * This file addressed one hard-coded session on `userId 1` and it had rotted
 * silently: that session is `expired` with **zero candidates**, and `userId 1`
 * holds no `ready` candidate anywhere in the dev database, so every run timed out
 * on the tile selector — the failure the paragraph below warns about, arriving in
 * the one shape a photograph cannot tell from a broken panel.
 *
 * `scripts/lib/facePanelSubject.mts` picks the subject from the rows and the run
 * PRINTS it, so the reading names its own fixture. The session is minted for
 * whoever owns it rather than for user 1.
 *
 * ⚠ **The subject needs a ready candidate AND library rows, and #1151's own test
 * (*"any account with a ready candidate"*) would have failed on a healthy
 * product.** `FacePanel.tsx` returns null for a panel with no rows and nothing in
 * flight, and the library holds only what an EDIT minted — so a ready candidate
 * nobody has edited correctly has no panel. That is what #1151 saw when it
 * widened the library flag to the dev bot and found the sheet rendering while the
 * viewer *"still will not open"*: the viewer opened, and the panel had nothing to
 * draw.
 *
 * # THE OLD FIXTURE, AND WHAT WAS HAND-WRITTEN IN IT
 *
 * Kept as history: it is the frame every assertion below was tuned against, and
 * a run on a found subject that disagrees with one of them needs to know which
 * frame the rule was written for.
 *
 * The frame was the founder's own v#156 render, uploaded to the dev bucket. The
 * library rows on it are hand-written fixture values standing in for the
 * harvest's own words, corrected against the photograph itself in shift 27
 * (`scripts/seed-face-panel-fixture-disposable.mts` says exactly what was
 * changed and why). The one piece of GEOMETRY in the fixture — her lips — is a
 * real stored measurement on this exact frame, and it is the only region a MINT
 * has ever put there.
 *
 * # AND THE SCAN NOW ANSWERS FOR THE REST (shift 79)
 *
 * With `CASTING_FACE_SCAN_SCOPE` live, the panel's first read of a version also
 * asks a segmenter where every feature is, so the picture carries twelve regions
 * and nine rows rather than one of each. Every assertion below that named a
 * count was re-anchored one at a time, each carrying the rule it now states and
 * the ruling that overruled the old one — never in bulk, because a bulk re-tune
 * makes a real regression and an overruled rule indistinguishable forever
 * (fable-431 §4).
 *
 * Requires `CASTING_REFERENCE_LIBRARY_SCOPE` and `CASTING_FACE_SCAN_SCOPE` to
 * cover THE SUBJECT IT FINDS — not `users:1`, which is what this line said until
 * #1297 and is a different account from the one the query returns. The refusal
 * below names the exact lines to add. With the library flag off the endpoint
 * answers `enabled: false`, the panel does not render, and this driver fails
 * rather than passing quietly — the correct verdict for a run that proved
 * nothing. With the SCAN flag off the panel is one library row, every count
 * below fails loudly, and that too is correct: this driver grades the product
 * the founder is actually looking at.
 *
 * # ⚠ THE FIRST RUN AGAINST A FRESH SERVER PROCESS IS NOT A CLEAN READING
 *
 * Measured 2026-09-26 (#1297), same tree, same subject, one `pnpm dev` restart
 * between them:
 *
 *   COLD — first driver run of a fresh server process   83 ok · 14 FAIL
 *   WARM — second run, same process                    107 ok ·  0 FAIL
 *
 * The cold DARK walk sees the panel's **library-only** shape — 14 rows and 3
 * regions — while the warm one sees the scanned shape, 9 rows and 13 regions.
 * `casting_face_scans` holds the stored scan throughout (`n = 1`, read at the
 * rows), so the stored answer exists and the first walk does not have it; and
 * the settle signal clears anyway, reporting *"her face is finished being read"*
 * over a panel that has not been read yet.
 *
 * ⚠ **So a cold run's failures are NOT findings about the panel's rules** —
 * they are fourteen ways of saying the scan has not landed, and two of them are
 * re-anchored checks correctly reporting a degraded panel. **Run it twice and
 * read the second.** The defect itself is filed rather than worked around here:
 * this driver must not learn to tolerate a panel that is missing its regions,
 * because that is exactly the failure it exists to catch.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { SignJWT } from "jose";
import sharp from "sharp";
import type { Page } from "puppeteer-core";

import { openDrivenPage, createChecks } from "./lib/drivePage.mts";
import { openDatabase } from "./lib/dbConnection.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";
import { chooseSubject, describeSubject } from "./lib/facePanelSubject.mts";
import {
  captureCastingFaceScanEnabled,
  captureCastingReferenceLibraryEnabled,
} from "../server/castingV2/castingV2Scope";

const args = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["base"],
  boolean: [],
});

const BASE = args.value("base") ?? process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/panel-v2");
const THEMES = ["dark", "light"] as const;

/**
 * The row whose box is a real stored MEASUREMENT from a mint, rather than one
 * the scan read off this frame. It is no longer the only clickable region — it
 * is the only one a paid edit put there, which is what makes it the right
 * subject for the minted-crop and one-selection-two-views checks.
 */
const MEASURED_ROW = "Lips";

/**
 * AND HOW THE PRODUCT SPEAKS ABOUT IT — the other half of fable-450/451.
 *
 * The founder took the possessive off every LABEL (*"just 'Left eye'"*), and it
 * stayed everywhere the product says a sentence. Both halves are named here, on
 * purpose: a check that read the label alone would pass on the day the ask box
 * started saying "what to change about lips", which is the ruling being obeyed
 * on one surface and lost on the other.
 *
 * ⚠ **THIS WAS `MEASURED_SPOKEN = "her lips"` UNTIL #1297, AND THE POSSESSIVE
 * CANNOT BE A CONSTANT — IT BELONGS TO THE CAST.** The founder's v#156 frame is
 * a woman; the subject this driver now finds for itself is a man, so the product
 * correctly said *"What to change about his lips"* and THREE separate checks
 * called it a defect. What replaced it is not another constant: the scoped label
 * is matched against this CLOSED SET, and the possessive it used is then carried
 * to the ask box's opening and to the typed sentence, which must agree with it.
 * One cast, one voice, on every surface — the ruling as a rule rather than as a
 * transcript of one face.
 *
 * The set is closed deliberately. An open `(\w+)` would accept *"What to change
 * about the lips"* and report the possessive intact.
 */
const SPOKEN_POSSESSIVES = ["his", "her", "their"] as const;

/**
 * THE FIXTURE'S THREE POPULATIONS, named rather than counted (shift 79).
 *
 * With the scan live a row's words come from one of two places and the panel
 * says which, so a count of "rows with words" can no longer tell a library row
 * from a described one — or notice that one of the four went missing.
 *
 *   LIBRARY    minted by an edit; carries a `from` line
 *   DESCRIBED  what the scan read off this frame; carries NO `from`, by design
 *   PAIR       one row in her words, one rectangle per instance (fable-378 (c))
 *
 * ⚠ **`LIBRARY_ROWS` IS GONE (#1297) AND `DESCRIBED_ROWS` IS ON NOTICE.** The
 * first named `Lips, Hair, Glasses, Earrings` — the v#156 frame's four edits —
 * and reported *"missing or wordless: Lips, Glasses"* about a cast who has
 * simply never had her lips or her glasses edited. The library population is
 * read off the panel's own provenance line now, where it always was.
 * `DESCRIBED_ROWS` is the same shape and survives only because this subject
 * happens to have a Build and a Skin row too; it is a fixture property wearing a
 * rule's clothes, and the next subject that lacks one will say so.
 */
const DESCRIBED_ROWS = ["Build", "Skin"] as const;
const PAIR_ROWS = ["Eyes", "Brows", "Ears"] as const;

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

/*
  THE SUBJECT IS FOUND, NOT REMEMBERED (#1151).

  This block addressed `2df4aeab-…` on `userId 1` and minted the session for user
  1 unconditionally. Both halves had rotted silently: read at the dev rows
  2026-09-26, that session is `expired` with **zero candidates**, and `userId 1`
  holds no `ready` candidate anywhere — so the run timed out on
  `button[aria-label="View candidate 01 larger"]`, which is the failure this
  file's own header warns is indistinguishable from a broken panel.

  ⚠ **AND THE QUERY ASKS FOR MORE THAN A READY CANDIDATE, WHICH IS THE PART
  #1151 DID NOT KNOW.** `FacePanel.tsx` returns null for a panel with no rows and
  nothing in flight, and the rows come from the reference library, which holds
  only what an EDIT minted. A ready candidate nobody has edited therefore has NO
  panel — correctly — and pointing a driver at one reports a missing panel on a
  healthy product. So the subject must carry library rows, and the `HAVING`
  clause is that requirement rather than a filter for tidiness.

  The session is minted for the SUBJECT's own account, whoever that is. Read,
  never printed.
*/
const conn = await openDatabase(process.env.DATABASE_URL!);
const [subjectRows] = await conn.query(`
  SELECT s.publicId AS sessionPublicId, s.status AS sessionStatus,
         c.publicId AS candidatePublicId, s.userId, c.position,
         COUNT(l.id) AS libraryRows, MAX(l.createdAt) AS newestRowAt
    FROM casting_reference_library l
    JOIN casting_candidates c ON c.id = l.candidateId
    JOIN casting_rolls r ON r.id = c.rollId
    JOIN casting_sessions s ON s.id = r.sessionId
   WHERE c.status = 'ready' AND l.retiredAt IS NULL
   GROUP BY s.publicId, s.status, c.publicId, s.userId, c.position
  HAVING COUNT(l.id) > 0
`) as any[];
const subject = chooseSubject((subjectRows as any[]).map((row) => ({
  sessionPublicId: String(row.sessionPublicId),
  sessionStatus: String(row.sessionStatus),
  candidatePublicId: String(row.candidatePublicId),
  userId: Number(row.userId),
  position: Number(row.position),
  libraryRows: Number(row.libraryRows),
  newestRowAt: new Date(row.newestRowAt),
})));
const SESSION = subject.sessionPublicId;
const TILE = subject.tile;
const [owners] = await conn.query("SELECT openId FROM users WHERE id = ?", [subject.userId]) as any[];
await conn.end();
if (!owners[0]?.openId) throw new Error(`no account row for user ${subject.userId} to drive as`);
console.log(describeSubject(subject));

/*
  ⚠ AND THE FLAGS ARE CHECKED AGAINST THAT USER BEFORE THE BROWSER OPENS.

  With the library flag not covering the subject, `facePanel` answers
  `enabled: false`, the panel never renders, and this run fails ninety seconds
  later on a selector — a refusal wearing a timeout's clothes. The check imports
  the PRODUCT's own capture functions rather than re-parsing the scope string
  (working law 4), so a grammar change cannot leave this reader believing an old
  one.

  **Its stated limit**: it reads THIS process's `.env`, and the server under
  `--base` may have been started with another. So it is a refusal that catches
  the ordinary case and names the line to add; a server started elsewhere still
  fails at the selector, and the message below is what a shift will then re-read.
*/
{
  const missing: string[] = [];
  if (!captureCastingReferenceLibraryEnabled(subject.userId)) missing.push("CASTING_REFERENCE_LIBRARY_SCOPE");
  if (!captureCastingFaceScanEnabled(subject.userId)) missing.push("CASTING_FACE_SCAN_SCOPE");
  if (missing.length > 0) {
    throw new Error(
      `the subject is user ${subject.userId} and ${missing.join(" + ")} does not cover them in this .env — `
        + `add \`${missing.map((flag) => `${flag}=users:${subject.userId}`).join("\` and \`")}\` and restart the server. `
        + "Without the library flag the panel never renders and this run would fail on a selector ninety seconds "
        + "from now; without the scan flag the panel is the library's rows alone and every re-anchored count below fails.",
    );
  }
}

const token = await new SignJWT({ openId: owners[0].openId, appId, name: "Panel v2 evidence" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { check, absent, records, failures, print } = createChecks();

/** The panel, as the DOM actually holds it. */
const READ_PANEL = `(() => {
  const panel = document.querySelector(".dpc-face");
  if (!panel) return null;
  const rows = Array.from(panel.querySelectorAll(".dpc-face__row")).map((row) => {
    const thumb = row.querySelector(".dpc-face__thumb");
    /*
      THE PICTURE IS THE __cut CHILDREN, NOT THE __thumb WRAPPER, and one row
      can hold two of them — a matched pair draws an instance each, side by side
      in the one tile. This read was taking getComputedStyle off the WRAPPER,
      which carries no mask and no window at all (the mask lives on
      .dpc-face__cut, castingV2.css:3081), so every style it reported was of the
      wrong element. It survived only because the assertion that consumed it
      stopped being reachable when the scan shipped.

      (No backticks in this comment on purpose: it lives inside a template
      literal, and one would end the string.)
    */
    const cuts = Array.from(row.querySelectorAll(".dpc-face__cut")).map((cut) => {
      const style = getComputedStyle(cut);
      return {
        maskImage: style.maskImage || style.webkitMaskImage || "",
        maskMode: style.maskMode || style.webkitMaskSourceType || "",
        background: style.backgroundImage,
        /* A MINTED crop is its own picture and publishes no window; a SCAN-BORN
           one is the whole frame with a window on it, and the window is these
           custom properties (cutoutStyle / .dpc-face__cut--cutout). This is
           how the two kinds are told apart from the outside. */
        cutWidth: style.getPropertyValue("--dpc-cut-w").trim(),
        windowed: cut.classList.contains("dpc-face__cut--cutout"),
      };
    });
    return {
      name: row.querySelector(".dpc-face__name")?.textContent ?? "",
      words: row.querySelector(".dpc-face__words")?.textContent ?? "",
      from: row.querySelector(".dpc-face__from")?.textContent ?? "",
      label: row.getAttribute("aria-label") ?? "",
      lit: row.getAttribute("data-lit"),
      active: row.getAttribute("data-active"),
      hasThumb: Boolean(thumb) && !thumb.classList.contains("dpc-face__thumb--none"),
      /** One per instance — a pair's tile holds two. */
      parts: Number(thumb?.getAttribute("data-parts") ?? 0),
      cuts,
    };
  });
  const groups = Array.from(panel.querySelectorAll(".dpc-face__group")).map((group) => ({
    heading: group.querySelector(".dpc-face__groupName")?.textContent ?? "",
    rows: group.querySelectorAll(".dpc-face__row").length,
  }));
  return {
    title: panel.querySelector(".dpc-face__title")?.textContent ?? "",
    sub: panel.querySelector(".dpc-face__sub")?.textContent ?? "",
    groups,
    rows,
  };
})()`;

/** The regions laid over the picture. */
const READ_REGIONS = `(() => {
  const holder = document.querySelector(".dpc-regions");
  if (!holder) return null;
  const boxes = Array.from(holder.querySelectorAll(".dpc-regions__box")).map((box) => ({
    label: box.getAttribute("aria-label") ?? "",
    tag: box.querySelector(".dpc-regions__tag")?.textContent ?? "",
    lit: box.getAttribute("data-lit"),
    active: box.getAttribute("data-active"),
    left: box.style.left,
    top: box.style.top,
    width: box.style.width,
    height: box.style.height,
  }));
  const form = holder.querySelector(".dpc-regions__ask");
  const field = holder.querySelector(".dpc-regions__field");
  const submit = holder.querySelector(".dpc-regions__submit");
  const price = holder.querySelector(".dpc-regions__price");
  return {
    boxes,
    open: Boolean(form),
    draft: field ? field.value : null,
    fieldLabel: field ? field.getAttribute("aria-label") : null,
    fieldPlaceholder: field ? field.getAttribute("placeholder") : null,
    submitText: submit ? submit.textContent : null,
    priceText: price ? price.textContent : null,
    submitHasPrice: submit ? /\\d/.test(submit.textContent ?? "") : null,
    fieldOutline: field ? getComputedStyle(field).outlineStyle : null,
  };
})()`;

async function shot(page: Page, selector: string, file: string): Promise<boolean> {
  const box = await page.evaluate((query) => {
    const node = document.querySelector(query as string) as HTMLElement | null;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  }, selector);
  if (!box || box.width < 2 || box.height < 2) return false;
  await page.screenshot({ path: path.join(OUT, file) as `${string}.png`, clip: box });
  return true;
}

/**
 * HOW MUCH DOES THIS ELEMENT ACTUALLY PAINT — measured as a delta against the
 * same box with its stencil blocked at the network layer, which is the CORS
 * defect reproduced on purpose. The absolute spread of a 44px box is worthless
 * here: it sits over the sheet's own blurred tiles, so an empty box is full of
 * someone else's colour (the reading that passed three blank slots in shift 24).
 */
async function meanAbsoluteDifference(a: Buffer, b: Buffer): Promise<number> {
  const [left, right] = await Promise.all([
    sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (left.data.length !== right.data.length) {
    throw new Error(`two shots of one box came back different sizes: ${left.data.length} vs ${right.data.length}`);
  }
  let total = 0;
  for (let at = 0; at < left.data.length; at += 1) total += Math.abs(left.data[at] - right.data[at]);
  return total / left.data.length;
}

/** The same photograph `shot` takes, kept in memory for a delta. */
async function shotBuffer(page: Page, selector: string): Promise<Buffer | null> {
  const box = await page.evaluate((query) => {
    const node = document.querySelector(query as string) as HTMLElement | null;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  }, selector);
  if (!box || box.width < 2 || box.height < 2) return null;
  return Buffer.from(await page.screenshot({ clip: box, encoding: "binary" }) as Uint8Array);
}

/**
 * ONE ROW'S TILE, FOUND BY ITS NAME.
 *
 * It took an INDEX into `.dpc-face__thumb`, and the list it indexed changes
 * shape while the page is alive: the panel mounts with whatever the library
 * knows (one row here) and fills to nine when the scan answers. So the same
 * number addressed a different feature depending on when it was called — and
 * the negative control at the foot of this file called it in a second browser,
 * where nothing guaranteed the same moment. The live shot and its control have
 * to be the same tile or the delta between them means nothing.
 */
async function thumbShotOf(page: Page, rowName: string): Promise<Buffer | null> {
  const box = await page.evaluate(`(() => {
    const row = Array.from(document.querySelectorAll(".dpc-face__row"))
      .find((node) => (node.querySelector(".dpc-face__name")?.textContent ?? "") === ${JSON.stringify(rowName)});
    const thumb = row?.querySelector(".dpc-face__thumb");
    if (!thumb) return null;
    const rect = thumb.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  })()`) as any;
  if (!box || box.width < 2 || box.height < 2) return null;
  return Buffer.from(await page.screenshot({ clip: box, encoding: "binary" }) as Uint8Array);
}

/**
 * WAIT FOR HER FACE TO BE FINISHED BEING READ. Null when it never settles,
 * which is a failure at every call site rather than a slow pass (opus-335 §3:
 * a driver that grades the loading state photographs a face mid-read).
 */
async function waitForSettled(page: Page): Promise<number | null> {
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const working = await page.evaluate(() => Boolean(document.querySelector(".dpc-face__working")));
    if (!working) return Date.now() - startedAt;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return null;
}

/** Open the sheet, open the viewer, wait for the panel to actually arrive. */
async function openPanel(page: Page): Promise<number> {
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 180_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${TILE} larger"]`, { timeout: 180_000 });
  await page.click(`button[aria-label="View candidate ${TILE} larger"]`);
  const started = Date.now();
  /*
    WAIT ON THE PANEL, NOT ON THE CLOCK. Shift 26 concluded "the panel does not
    appear" from a fixed sleep that expired before the second round trip landed —
    the panel takes ~5s here because it can only ask once `variants` has told it
    which version is selected, and the database is a remote one. A fixed wait is
    an instrument that reports a slow answer as no answer.
  */
  await page.waitForSelector(".dpc-face", { timeout: 90_000 });
  return Date.now() - started;
}

/**
 * The walk stopped because the SUBJECT lacks something, not because the driver
 * broke. Its own class so the report can say which of the two it was (#1151).
 */
class MeasuredRowMissing extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeasuredRowMissing";
  }
}

/** The healthy thumbnail photographs, kept so the control has something to differ from. */
const liveThumbs: Record<string, Buffer | null> = {};

/**
 * WHICH ROW THE BLOCKED-STENCIL CONTROL PHOTOGRAPHS — chosen from the panel, not
 * named here (#1297).
 *
 * ⚠ **The control used `MEASURED_ROW` and that is why it read 0.00.** Blocking
 * the image proxy can only change a row whose cutout is ITS OWN PICTURE, fetched
 * as bytes; a scan-born row is a WINDOW on the frame the viewer is already
 * showing, so refusing the proxy leaves it pixel-identical. On the founder's
 * v#156 frame her lips were the one minted crop, so naming that row happened to
 * pick a minted one; on the subject this driver finds, Lips is windowed and the
 * minted rows are her hair and her earrings. **The control was measuring a row
 * it could not possibly move** — a negative control that cannot fire in the
 * direction it exists to prove, which is this repository's most-repeated defect
 * (invariant 7, working law 2).
 *
 * It is set from the minted set the panel itself reports, in the first theme
 * walked, and the second theme must agree: which crops were minted is a property
 * of the cast, not of the palette.
 */
let mintedRowForControl: string | null = null;

for (const theme of THEMES) {
  const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
  const refused: string[] = [];
  page.on("requestfailed", (request) => {
    refused.push(`${request.failure()?.errorText} ${request.url().slice(0, 140)}`);
  });
  /* Nothing in this run may spend a credit. Watched at the wire, not assumed. */
  const spends: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (request.method() === "POST" && /castingV2\.(refine|roll|sign)/.test(url)) spends.push(url.slice(0, 160));
  });

  try {
    await page.evaluateOnNewDocument((value) => {
      window.localStorage.setItem("drape_theme", value);
    }, theme);

    const waited = await openPanel(page);
    check(true, `${theme}: the panel is on the screen`, `.dpc-face rendered ${waited}ms after the viewer opened`);

    const appliedTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    check(appliedTheme === theme, `${theme}: the page is actually in this theme`, `data-theme="${appliedTheme}"`);

    /*
      AND THEN IT WAITS FOR HER FACE TO BE READ — which this driver never did,
      and every verdict it took was of a state no user ever settles on.

      With the scan live, `.dpc-face` mounts within a second carrying only what
      the LIBRARY knows (one row on this fixture) and a "Reading her features…"
      line, and the segmenter's answer lands about twenty seconds later. Reading
      the panel at mount graded the incomplete state as if it were the finished
      one: sixteen failures, six of which were the shipped rule being read at the
      wrong moment.

      Measured here rather than assumed (`probe-panel-cold-fill`, this shift):
      cold, the working line held for 24s at one row, then the panel filled to
      nine IN THE SAME PAGE LIFE. So the wait is bounded generously and the
      panel is never re-opened to force it.

      It FAILS rather than proceeding if the scan never settles — a driver that
      quietly grades the loading state is exactly what produced the sixteen.
    */
    const settledAfter = await waitForSettled(page);
    check(
      settledAfter !== null,
      `${theme}: her face is finished being read before anything is judged`,
      settledAfter === null
        ? "the working line was still up after 60s — every reading below would have been of the loading state"
        : `the "Reading her features…" line cleared after ${(settledAfter / 1000).toFixed(1)}s`,
    );

    /* Thumbnails are background images; a shot taken before they decode is a
       photograph of an empty box. Wait on the bytes. */
    await page.evaluate(`(async () => {
      const urls = Array.from(document.querySelectorAll(".dpc-face__thumb"))
        .flatMap((thumb) => {
          const style = getComputedStyle(thumb);
          return [style.maskImage, style.webkitMaskImage, style.backgroundImage];
        })
        .map((value) => (typeof value === "string" ? (value.match(/url\\("?([^")]+)"?\\)/) ?? [])[1] : null))
        .filter(Boolean);
      await Promise.all(urls.map((url) => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(null);
        image.onerror = () => resolve(null);
        image.src = url;
      })));
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 600));

    const panel = await page.evaluate(READ_PANEL) as any;

    /* ---- the copy, verbatim ---- */
    /*
      RE-ANCHORED (shift 79). The rule it now states: THE HEADING IS THE
      FOUNDER'S OWN WORD.

      It asserted `"On her face"` and had been failing since fable-398 ruled
      "Refine them" in his own words ("how about refine them or somthing"). The
      old heading was not merely replaced, it was FALSIFIED by this panel: the
      list gained BODY and SKIN rows, so a heading naming the face was untrue in
      the same photograph that showed her shoulders. The pronoun law it used to
      carry lives on in "no row calls a woman's face his", three checks down —
      which is where it belongs, because the rows are what still derive a
      pronoun (FacePanel.tsx:25-38).
    */
    check(
      panel.title === "Refine them",
      `${theme}: the heading is his own word, and names nothing this panel is not`,
      `title="${panel.title}" over a panel carrying ${panel.rows.length} rows including her build`,
    );
    check(
      panel.sub === "Everything here can be changed. Tap one to talk about it.",
      `${theme}: the sub is true of a list including what was never touched`,
      `sub="${panel.sub}"`,
    );
    check(
      panel.rows.every((row: any) => !/^His\b/.test(row.name)),
      `${theme}: no row calls a woman's face his`,
      `${panel.rows.length} rows, first three: ${panel.rows.slice(0, 3).map((r: any) => `"${r.name}"`).join(", ")}`,
    );

    /* ---- the v2 shape: the catalogue, not the edit history ---- */
    check(
      panel.groups.map((group: any) => group.heading).join(" · ") === "Face · Hair · Body · Accessories",
      `${theme}: the four groups, in the order a face is read`,
      panel.groups.map((g: any) => `${g.heading}(${g.rows})`).join(" · "),
    );
    const untouched = panel.rows.filter((row: any) => row.words === "");
    check(
      untouched.length > 0,
      `${theme}: rows exist for things nothing has ever been said about`,
      `${untouched.length} of ${panel.rows.length} rows carry no words — e.g. ${untouched.slice(0, 3).map((r: any) => r.name).join(", ")}`,
    );
    const spoken = panel.rows.filter((row: any) => row.words !== "");
    /*
      RE-ANCHORED (shift 79). The rule it now states: EVERY LIBRARY ROW WITH A
      PLACE ON THE PHOTOGRAPH REACHES THE PANEL, AND SAYS SO.

      It counted `spoken === 4` — the fixture's four library rows — and the scan
      overruled the count from both ends at once: it ADDS words to rows the
      library has nothing for (her build, her skin), and fable-414's box rule
      REMOVES a worded row that nothing can point at (her earrings, §ABSENT
      below). A count cannot tell those two apart, so this names the rows.

      The discriminator is the provenance line, which is the product's own:
      a LIBRARY row is something she asked for or arrived with, a DESCRIBED row
      is what this photograph shows, and only the first has a `from`.
    */
    const named = (name: string) => panel.rows.find((row: any) => row.name === name);
    /*
      RE-ANCHORED (#1297). The rule it now states: EVERY ROW THE PANEL SAYS WAS
      BORN OF AN EDIT CARRIES THE WORDS THAT EDIT PUT THERE.

      What overruled the old one: it named FOUR ROWS — `Lips, Hair, Glasses,
      Earrings` — and they are properties of the founder's retired v#156 frame,
      not of the product. Driven on the subject the driver now finds for itself
      (user 28601, 53 library rows), it reported *"missing or wordless: Lips,
      Glasses"* about a cast who has simply never had her lips or her glasses
      edited. A check that names a feature the subject may not have is asserting
      the fixture, and it fails on a healthy product.

      ⚠ **The missing half of the old sentence — *reaches the panel* — is not
      dropped, it is somebody else's** and always was: a library row with no
      rectangle is taken OFF the panel by fable-414's box rule, and *"every row
      on the panel has a place on the photograph"* below is the check that owns
      that. Asserting it here as well would be two checks answering one question
      and neither of them able to say which.

      The discriminator is the panel's own provenance line, unchanged: a LIBRARY
      row is something she asked for or arrived with and carries a `from`. So the
      population is derived from the panel and the rule is the one that can still
      fail — a library-born row rendered WORDLESS, which is the edit's own
      sentence lost between the mint and the page.
    */
    const libraryBorn = panel.rows.filter((row: any) => row.from === "from an edit");
    const wordlessLibrary = libraryBorn.filter((row: any) => row.words === "");
    check(
      libraryBorn.length > 0 && wordlessLibrary.length === 0,
      `${theme}: every library row with a place on the photograph reaches the panel, carrying its own words`,
      libraryBorn.length === 0
        /* The floor, and it is a real verdict rather than a pass: a subject with
           no library row at all cannot exercise this rule, and `facePanelSubject`
           refuses such a subject upstream — so reaching here means something
           moved between the query and the render. */
        ? `NO row on this panel claims an edit — ${panel.rows.length} rows, none with a "from"`
        : wordlessLibrary.length === 0
          ? `${libraryBorn.length} of ${panel.rows.length} rows came from an edit, each with words: `
            + libraryBorn.slice(0, 4).map((r: any) => `${r.name}: "${r.words.slice(0, 40)}"`).join(" | ")
          : `wordless despite claiming an edit: ${wordlessLibrary.map((r: any) => r.name).join(", ")}`,
    );
    /*
      RE-ANCHORED (shift 79). The rule it now states: A DESCRIPTION IS NOT A
      PROVENANCE, and the panel says nothing rather than saying the wrong thing.

      Both halves of one rule, because the old check only had the positive one
      and read a designed null as a missing value: a described row carrying
      "from an edit" would be the panel telling her she bought her own
      shoulders (`facePanel.ts:341` — the null is deliberate and documented).
    */
    const describedRows = DESCRIBED_ROWS.map((name) => named(name)).filter(Boolean);
    check(
      describedRows.length === DESCRIBED_ROWS.length
        && describedRows.every((row: any) => row.words !== "" && row.from === ""),
      `${theme}: a row the scan described carries its words and claims no provenance`,
      describedRows.length === 0
        ? `none of ${DESCRIBED_ROWS.join(", ")} is on the panel at all`
        : describedRows.map((r: any) => `${r.name}: "${r.words}" from="${r.from}"`).join(" | "),
    );
    const silent = panel.rows.filter((row: any) => row.words === "");
    check(
      silent.length > 0 && silent.every((row: any) => row.from === ""),
      `${theme}: a row nothing has happened to claims no provenance`,
      `${silent.length} silent rows: ${silent.map((r: any) => `${r.name}(from="${r.from}")`).join(", ")}`,
    );
    /*
      RE-ANCHORED (shift 79). The rule it now states: A MATCHED PAIR IS ONE ROW
      WITH TWO RECTANGLES — asserted on a pair the picture actually has.

      It named her EARRINGS, and for four shifts that assertion could not fire
      in either direction: earring detection was deliberately unarmed
      (fable-340's `deferArming`), so the pair had no rectangle, so fable-414's
      box rule took the row off the panel. A check that cannot fail is the thing
      this program keeps finding, and it was one — recorded as ABSENT rather
      than deleted, because the day it CAN fire is the day someone should look.
      **Shift 80 is that day** (see the earring block below the pair check).

      Her eyes, her brows and her ears are read pairs on this frame, so the rule
      is exercised where the ontology actually lands: ONE row in the person's own
      words (fable-378 (c)), and each rectangle naming its own instance, because
      clicking a rectangle is a promise about those pixels.
    */
    const pairFailures = PAIR_ROWS.filter((name) => {
      const rows = panel.rows.filter((row: any) => row.name === name);
      return rows.length !== 1;
    });
    check(
      pairFailures.length === 0,
      `${theme}: a matched pair is one row, in her own words`,
      pairFailures.length === 0
        ? `${PAIR_ROWS.join(", ")} — one row each of ${panel.rows.length}`
        : `not one row each: ${pairFailures.join(", ")}`,
    );
    /*
      HER EARRINGS, JUDGED AT LAST — and the rule the picture actually states.

      She wears ONE hoop. Her left ear carries it; her right ear is behind her
      hair, and the earring court's whole point is that those two are different
      facts about a face: a worn side segments (0.0189–0.0347% of frame), and a
      side that is bare OR covered returns nothing at all. Presence-only arming
      files the first and never guesses at the second, so this row is one row
      with ONE rectangle — not half a pair.

      The row is on the panel because it has a rectangle to point at, which is
      fable-414's box rule working in the direction nobody could exercise until
      detection armed.
    */
    const earringRows = panel.rows.filter((row: any) => row.name === "Earrings");
    /* Its own read of the boxes — the regions are read again below for the
       hover checks, and a check that borrows a later read is a check whose
       subject moved between the two. */
    const drawn = await page.evaluate(READ_REGIONS) as any;
    const boxNames = (drawn?.boxes ?? []).map((region: any) => region.tag);
    /*
      RE-ANCHORED (#1297). The rule it now states: THE ROW HAS ONE RECTANGLE PER
      SIDE THAT WAS ACTUALLY FOUND, AND NEVER ONE FOR A SIDE THAT WAS NOT.

      What overruled the old one: it asserted `parts === 1`, `Left earring`
      present and `Right earring` ABSENT — which is not a rule about earrings, it
      is a description of the founder's v#156 frame, where she wears one hoop and
      her other ear is behind her hair. **The subject the driver now finds wears
      TWO** (`one row, 2 part(s) · boxes: Right earring, Left earring`), so the
      old assertion called a correct panel broken.

      ⚠ **The rule it was reaching for survives intact and is the interesting
      one**: presence-only arming files the side it can see and never guesses at
      the side it cannot, so a bare-or-covered ear yields no rectangle. Stated as
      a correspondence rather than a count, it says that about ONE earring, TWO
      earrings and NONE alike — and it still fails the day a side is invented.

      The two-ear case is not a weaker test than the one-ear case, which is worth
      saying because it looks like one: a guessed side would show up here as a
      rectangle whose side the row's own words never mention.
    */
    const earringBoxes = boxNames.filter((name: string) => /earring/i.test(name));
    const earringSides = earringBoxes
      .map((name: string) => (/left/i.test(name) ? "left" : /right/i.test(name) ? "right" : ""))
      .filter((side: string) => side !== "");
    const unspokenSide = earringRows.length === 1
      ? earringSides.filter((side: string) => !new RegExp(`\\b${side}\\b`, "i").test(earringRows[0].words))
      : [];
    check(
      earringRows.length === 1
        && earringSides.length === earringBoxes.length
        && earringRows[0].parts === earringBoxes.length
        && unspokenSide.length === 0,
      `${theme}: the ear that wears one is found, and the ear behind her hair is not guessed at`,
      earringRows.length !== 1
        ? `${earringRows.length} rows named "Earrings"`
        : `one row, ${earringRows[0].parts} part(s), words "${earringRows[0].words}" (${earringRows[0].from})`
          + ` · boxes: ${earringBoxes.join(", ") || "none"}`
          + (unspokenSide.length > 0 ? ` · ⚠ a side nobody said she wears: ${unspokenSide.join(", ")}` : ""),
    );

    /* ---- the thumbnail, and the negative control ---- */
    const withThumb = panel.rows
      .map((row: any, at: number) => ({ ...row, at }))
      .filter((row: any) => row.hasThumb);
    /*
      RE-ANCHORED (shift 79). The rule it now states: EVERY ROW ON THE PANEL HAS
      A PICTURE OF ITSELF, and the two ways of getting one read as one object.

      It asserted exactly one cutout, on the only row a mint had ever cropped.
      The scan overruled the "only" and not the rest: a scan mints nothing, so
      the frame the viewer is already showing is the content and the stencil is
      a window on it (`cutoutStyle`). Both kinds are one picture cut by one
      shape, which is the founder's ruling in one word — "masked cutouts",
      fable-374 — so the panel is a description of a face rather than a mix of
      two rendering languages.

      The window is what tells them apart from outside, so this asserts the
      DIFFERENCE rather than trusting the sameness: the minted row publishes no
      `--dpc-cut-w` because its crop IS the picture, and every scan-born row
      publishes one. A scan row with no window would draw the entire frame
      shrunk into a 34px tile — a face in a stamp, which is what this check
      would otherwise let through.
    */
    check(
      withThumb.length === panel.rows.length,
      `${theme}: every row has a picture of itself`,
      `${withThumb.length} cutouts on ${panel.rows.length} rows: ${withThumb.map((r: any) => r.name).join(", ") || "none"}`,
    );
    const minted = withThumb.filter((row: any) => row.cuts.every((cut: any) => !cut.windowed));
    const windowed = withThumb.filter((row: any) => row.cuts.every((cut: any) => cut.windowed && cut.cutWidth !== ""));
    /*
      RE-ANCHORED (#1297). The rule it now states: EVERY ROW WITH A PICTURE IS
      EITHER ITS OWN CROP OR A WINDOW ON THE FRAME — the two kinds PARTITION the
      panel, and neither is empty.

      What overruled the old one: `minted.length === 1 && minted[0].name ===
      MEASURED_ROW`. On the v#156 frame her lips were the only region a paid mint
      had ever cropped, so "exactly one, and it is Lips" read as a rule. It is a
      fact about how much editing that one cast had had. The subject the driver
      finds has TWO minted crops (`its own picture: Hair, Earrings`) and the
      assertion called them a defect.

      ⚠ **What the old check was really protecting is kept exactly, because it is
      the part with teeth**: a scan-born row that published no window would draw
      the entire frame shrunk into a 34px tile — a face in a stamp. So the
      partition is asserted in both directions (nothing is both, nothing is
      neither) and every windowed row must carry a real `--dpc-cut-w`.

      **Both kinds must be present or this proves nothing**, and that is an arm
      rather than an assumption: a panel of only windows would satisfy a
      one-sided rule while saying nothing about mints, and vice versa.
    */
    const bothKinds = withThumb.filter((row: any) =>
      row.cuts.some((cut: any) => cut.windowed) && row.cuts.some((cut: any) => !cut.windowed));
    check(
      minted.length > 0 && windowed.length > 0
        && bothKinds.length === 0
        && minted.length + windowed.length === withThumb.length,
      `${theme}: the minted crop is its own picture; every scanned one is a window on the frame`,
      `its own picture: ${minted.map((r: any) => r.name).join(", ") || "none"}`
      + ` · windowed: ${windowed.length} of ${withThumb.length}`
      + (windowed[0] ? ` · e.g. ${windowed[0].name} --dpc-cut-w=${windowed[0].cuts[0]?.cutWidth}` : "")
      + (bothKinds.length > 0
        ? ` · ⚠ neither one thing nor the other: ${bothKinds.map((r: any) => r.name).join(", ")}`
        : "")
      + (minted.length + windowed.length !== withThumb.length
        ? ` · ⚠ ${withThumb.length - minted.length - windowed.length} row(s) in neither kind`
        + ` — a window with no --dpc-cut-w draws the whole frame in a 34px tile`
        : ""),
    );
    /*
      THE PAIR RULE'S OTHER HALF, and the one the founder actually read: a
      single-eye tile on a two-eyed face is broken. One row, one tile, one
      picture PER INSTANCE.
    */
    const pairTiles = PAIR_ROWS.map((name) => panel.rows.find((row: any) => row.name === name)).filter(Boolean);
    check(
      pairTiles.length === PAIR_ROWS.length
        && pairTiles.every((row: any) => row.parts === 2 && row.cuts.length === 2),
      `${theme}: a pair's one tile holds a picture of each side`,
      pairTiles.map((r: any) => `${r.name}: ${r.parts} parts / ${r.cuts.length} cuts`).join(" · ")
        || "no pair rows at all",
    );
    const allCuts = withThumb.flatMap((row: any) => row.cuts.map((cut: any) => ({ ...cut, name: row.name })));
    const notLuminance = allCuts.filter((cut: any) => !/luminance/i.test(cut.maskMode));
    check(
      allCuts.length > 0 && notLuminance.length === 0,
      `${theme}: every cutout is cut by LUMINANCE, not by a missing alpha channel`,
      notLuminance.length === 0
        ? `${allCuts.length} cutouts across ${withThumb.length} rows, mask-mode: ${allCuts[0]?.maskMode}`
        : `not luminance: ${notLuminance.map((c: any) => `${c.name}(${c.maskMode})`).join(", ")}`,
    );
    /*
      BY NAME, NEVER BY POSITION — the same defect the hover pair paid for
      (opus-335 §3). The live shot for the blocked-stencil control at the foot of
      this file was only ever taken inside a branch requiring the panel to hold
      exactly ONE thumbnail, so with the scan live the control reported "never
      reached" instead of failing loudly. A control that cannot arm does not
      exist (invariant 7).
    */
    /*
      RE-ANCHORED (#1297): it photographs a MINTED row — one whose crop is its
      own picture — because that is the only kind the control below can move.
      The choice is the panel's own `minted` set, read a few lines above, and it
      must not change between themes.
    */
    const mintedHere = minted[0]?.name ?? null;
    if (mintedRowForControl === null) mintedRowForControl = mintedHere;
    check(
      mintedHere !== null && mintedHere === mintedRowForControl,
      `${theme}: the row the blocked-stencil control will photograph is the same one in both themes`,
      mintedHere === null
        ? "no row on this panel has a minted crop — the control below has nothing it could move"
        : `${mintedHere} (of ${minted.length} minted), first theme chose ${mintedRowForControl}`,
    );
    liveThumbs[theme] = mintedHere === null ? null : await thumbShotOf(page, mintedHere);
    check(
      liveThumbs[theme] !== null,
      `${theme}: ${mintedHere ?? "the minted row"}' cutout has a box worth photographing`,
      liveThumbs[theme] ? `${liveThumbs[theme]!.length} bytes` : `no tile on a row named "${mintedHere}"`,
    );

    /* ---- the picture's regions ---- */
    const regions = await page.evaluate(READ_REGIONS) as any;
    /*
      RE-ANCHORED (shift 79). The rule it now states is the FOUNDER'S OWN, and
      it is worth stating as he did (fable-414): *"nothing should ride words
      alone in the right panel — everything in the right panel should have a
      bounding box."*

      It asserted `boxes.length === 1`, which was the truthful state of the
      product on the day it was written — one measured lip box and nothing else.
      The scan overruled the number and PROVED the rule, so the check now tests
      the rule instead of the number, in both directions:

        every row has a place       no row is a name with nowhere to point
        every place has a row       no rectangle promises pixels no row owns

      The second half is the one a count could never see, and it is the more
      dangerous failure: a box the panel cannot explain is a click target that
      edits something the customer was never shown.

      A pair draws one rectangle per instance and each carries its INSTANCE's
      name ("Left eye"), not the row's — fable-378 (c), because clicking a
      rectangle is a promise about those pixels. So a box matches its row by
      either name.
    */
    const tags: string[] = regions ? regions.boxes.map((box: any) => box.tag) : [];
    const rowsWithoutPlace = panel.rows.filter((row: any) => {
      /* The label is already bare (founder, fable-450/451) — it used to be
         stripped of "Her "/"His "/"Their " here, and that strip is now a rule
         about a shape the panel cannot produce. */
      const bare = row.name;
      return !tags.some((tag) => tag === row.name || new RegExp(`(left|right) ${bare.replace(/s$/, "")}`, "i").test(tag));
    });
    check(
      regions !== null && regions.boxes.length > 0 && rowsWithoutPlace.length === 0,
      `${theme}: every row on the panel has a place on the photograph`,
      regions === null
        ? "no .dpc-regions at all"
        : `${regions.boxes.length} boxes for ${panel.rows.length} rows`
          + (rowsWithoutPlace.length === 0 ? ` — ${tags.join(", ")}` : ` · nowhere to point: ${rowsWithoutPlace.map((r: any) => r.name).join(", ")}`),
    );
    /*
      RE-ANCHORED ON THE BARE LABEL (founder, fable-450/451), and the old rule
      is the reason it had to be: it stripped a POSSESSIVE off the tag before
      matching, so with the possessive gone every instance tag ("Left eye")
      matched no row and seven boxes read as orphans. The rule it states is
      unchanged — every rectangle belongs to a row on the panel — and only the
      spelling of a label moved.
    */
    const stem = (label: string): string => label
      .toLowerCase()
      .replace(/^(left|right) /, "")
      .replace(/s$/, "");
    const orphanBoxes = tags.filter((tag) =>
      !panel.rows.some((row: any) => row.name === tag || stem(row.name) === stem(tag)));
    check(
      tags.length > 0 && orphanBoxes.length === 0,
      `${theme}: and every place on the photograph belongs to a row`,
      orphanBoxes.length === 0
        ? `${tags.length} boxes, every one owned by a row on the panel`
        : `boxes no row owns: ${orphanBoxes.join(", ")}`,
    );
    const measuredBox = (regions?.boxes ?? []).find((box: any) => box.tag === MEASURED_ROW);
    check(
      Boolean(measuredBox),
      `${theme}: the region measured by a paid mint is on the picture under its own name`,
      measuredBox ? `tag="${measuredBox.tag}" label="${measuredBox.label}"` : `no box tagged "${MEASURED_ROW}" among ${tags.length}`,
    );
    /*
      NEVER SCREEN PIXELS — asserted across EVERY box rather than the one that
      happened to be first. A rectangle placed by proportion is the thing this
      surface must never do, and one box in twelve doing it is the whole defect.
    */
    const inPixels = (regions?.boxes ?? []).filter(
      (box: any) => ![box.left, box.top, box.width, box.height].every((value: string) => value.endsWith("%")),
    );
    check(
      tags.length > 0 && inPixels.length === 0,
      `${theme}: every box is a fraction of its own frame, never screen pixels`,
      inPixels.length === 0
        ? `${tags.length} boxes in %, e.g. ${measuredBox?.tag} left=${measuredBox?.left} top=${measuredBox?.top} w=${measuredBox?.width} h=${measuredBox?.height}`
        : `in pixels: ${inPixels.map((b: any) => `${b.tag}(${b.left},${b.top})`).join(", ")}`,
    );

    /*
      ---- THE PICTURE IS STILL A PICTURE ----

      The law shift 27 was written for, and the only one of these that can fail
      on a collapsed element: with the panel ON, measure the plate. Panel v2 as a
      `below` took the viewer's whole column and the photograph rendered 0 × 0
      while every source-level assertion about it passed.
    */
    const stage = await page.evaluate(`(() => {
      const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const rect = (q) => box(document.querySelector(q));
      /* BY NAME, NOT BY POSITION — ".dpc-regions__box" is her BUILD now, and
         measuring it while calling it ${MEASURED_ROW} is the same coin flip the
         hover pair paid for. */
      const named = Array.from(document.querySelectorAll(".dpc-regions__box"))
        .find((node) => (node.querySelector(".dpc-regions__tag")?.textContent ?? "") === ${JSON.stringify(MEASURED_ROW)});
      const rows = Array.from(document.querySelectorAll(".dpc-face__row"));
      return {
        plate: rect(".dpc-viewer__plate"), figure: rect(".dpc-viewer__frame"),
        dock: rect(".dpc-viewer__dock"), rail: rect(".dpc-viewer__rail"),
        box: box(named), panel: rect(".dpc-face"),
        lastRow: box(rows[rows.length - 1]),
        viewport: { w: window.innerWidth, h: window.innerHeight },
        stacksUnderPicture: document.querySelectorAll(".dpc-refine .dpc-refine__stack").length,
        railSteps: document.querySelectorAll(".dpc-viewer__rail .dpc-refine__step").length,
      };
    })()`) as any;
    check(
      stage.plate !== null && stage.plate.w > 200 && stage.plate.h > 300,
      `${theme}: the photograph keeps its size with the panel on`,
      stage.plate ? `the plate renders ${stage.plate.w} × ${stage.plate.h}` : "no plate at all",
    );
    /*
      RE-ANCHORED (shift 79). The rule it now states: THE PANEL IS A COLUMN
      BESIDE THE PICTURE AND ALL OF IT CAN BE SEEN WITHOUT SCROLLING.

      It asserted `dock.h <= figure.h`, using the picture's own height as the
      proxy for "not a page under it" — sound while the panel was four rows and
      arithmetically doomed at nine (920 against an 820px figure). The property
      that actually matters survives the row count and is a design law this
      house already mechanizes: the dock is visible without scrolling. Where the
      dock STANDS is asserted by its own two checks below, which is where that
      half belonged all along.

      It fails the moment a row count pushes the last row past the fold, which
      is the real version of what the height proxy was reaching for.
    */
    check(
      stage.dock !== null && stage.lastRow !== null
        && stage.dock.y >= 0
        && stage.lastRow.y + stage.lastRow.h <= stage.viewport.h,
      `${theme}: the whole panel is visible without scrolling`,
      stage.dock && stage.lastRow
        ? `dock ${stage.dock.w} × ${stage.dock.h} from y=${stage.dock.y}, last row ends at ${stage.lastRow.y + stage.lastRow.h} in a ${stage.viewport.h}px viewport`
        : "no dock or no rows",
    );
    check(
      stage.box !== null
        && stage.box.w > 8 && stage.box.h > 6
        && stage.box.x >= stage.plate.x - 1 && stage.box.y >= stage.plate.y - 1
        && stage.box.x + stage.box.w <= stage.plate.x + stage.plate.w + 1
        && stage.box.y + stage.box.h <= stage.plate.y + stage.plate.h + 1,
      `${theme}: ${MEASURED_ROW}' region is a real target inside the picture`,
      stage.box
        ? `box ${stage.box.w} × ${stage.box.h} at (${stage.box.x}, ${stage.box.y}) inside a plate at (${stage.plate.x}, ${stage.plate.y}) ${stage.plate.w} × ${stage.plate.h}`
        : `no box tagged "${MEASURED_ROW}" drawn`,
    );

    /*
      ---- ARE THE WORDS ACTUALLY VISIBLE ----

      The light theme shipped white-on-white: `--onScrim` is white in BOTH themes
      because a scrim is dark in both, and the dock had been given a `--surface`
      background, which is white in light. Every source assertion about the copy
      passed while the copy could not be read.

      A colour comparison would be guesswork over a blurred photograph, so the
      reading is a DELTA: the dock as rendered, against the same dock with its
      own text made transparent. Words that paint nothing make the two identical.
    */
    const dockLive = await shotBuffer(page, ".dpc-viewer__dock");
    await page.evaluate(`(() => {
      const style = document.createElement("style");
      style.id = "shift27-ink-control";
      style.textContent = ".dpc-face, .dpc-face * { color: transparent !important; }";
      document.head.appendChild(style);
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const dockBlank = await shotBuffer(page, ".dpc-viewer__dock");
    await page.evaluate(`(() => { document.getElementById("shift27-ink-control")?.remove(); })()`);
    if (dockLive && dockBlank) {
      const ink = await meanAbsoluteDifference(dockLive, dockBlank);
      check(
        ink > 2,
        `${theme}: the panel's words are actually painted on this background`,
        `mean absolute difference ${ink.toFixed(2)} between the dock and the same dock with its text made transparent`,
      );
    } else {
      check(false, `${theme}: the panel's words are actually painted on this background`, "could not photograph the dock");
    }

    /*
      ---- HIS THREE COLUMNS: versions left, picture centre, panel right ----
    */
    check(
      stage.rail !== null && stage.rail.x + stage.rail.w <= stage.plate.x + 4,
      `${theme}: the versions stand to the LEFT of the picture`,
      stage.rail
        ? `rail ends at ${stage.rail.x + stage.rail.w}, the picture starts at ${stage.plate.x}`
        : "no rail at all",
    );
    check(
      stage.dock !== null && stage.dock.x >= stage.plate.x + stage.plate.w - 4,
      `${theme}: the panel stands to the RIGHT of it`,
      stage.dock ? `dock starts at ${stage.dock.x}, the picture ends at ${stage.plate.x + stage.plate.w}` : "no dock",
    );
    check(
      stage.stacksUnderPicture === 0 && stage.railSteps > 0,
      `${theme}: the versions are drawn once, in the rail — not twice`,
      `${stage.railSteps} steps in the rail, ${stage.stacksUnderPicture} stacks under the picture`,
    );

    /* ---- one selection, two views ---- */
    /*
      PAIRED BY NAME, NEVER BY INDEX.

      This read `boxes[0]` while hovering HER LIPS, which was sound when the
      fixture offered exactly one measured region and is a coin flip now that
      the scan draws twelve: box zero is her BUILD, so the check was asking
      whether hovering her lips lights her build. It failed, and it would have
      passed just as meaninglessly had the two been drawn in the other order.

      The rule under test is that one selection has two views, so both halves
      name the SAME feature at both ends.
    */
    const rowSelector = `.dpc-face__row[aria-label^="${MEASURED_ROW}"]`;
    await page.hover(rowSelector);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const litByRow = await page.evaluate(READ_REGIONS) as any;
    const litBox = litByRow?.boxes?.find((box: any) => box.tag === MEASURED_ROW);
    check(
      litBox?.lit === "true",
      `${theme}: hovering the row lights ITS OWN region on the picture`,
      litBox
        ? `${MEASURED_ROW}'s box reads data-lit="${litBox.lit}", and it is 1 of ${litByRow.boxes.length} drawn`
        : `no box is tagged "${MEASURED_ROW}" among ${litByRow?.boxes?.length ?? 0} drawn`,
    );
    /* And no OTHER region lights with it — a selection that lights everything
       is not a selection. The negative control on the same hover. */
    const alsoLit = (litByRow?.boxes ?? []).filter((box: any) => box.lit === "true" && box.tag !== MEASURED_ROW);
    check(
      alsoLit.length === 0,
      `${theme}: and lights nothing else`,
      alsoLit.length === 0
        ? `1 of ${litByRow.boxes.length} boxes lit`
        : `also lit: ${alsoLit.map((box: any) => box.tag).join(", ")}`,
    );
    await shot(page, ".dpc-face", `panel-${theme}.png`);
    await page.screenshot({ path: path.join(OUT, `sheet-${theme}.png`) as `${string}.png` });

    /*
      A PAIR OPENS INTO ITS TWO SIDES — founder ruling, fable-452, photographed
      in both states because a disclosure is exactly the kind of thing that
      looks right in the state its author left it in.

      The chevron is asserted to be its OWN control: the ruling keeps the row's
      tap meaning an ask about the pair, so a nesting that swallowed the row's
      click would obey the screenshot and break the sentence.
    */
    const collapsed = await page.evaluate(`(() => {
      const row = Array.from(document.querySelectorAll(".dpc-face__rows > li"))
        .find((item) => item.querySelector(".dpc-face__name")?.textContent === "Eyes");
      if (!row) return null;
      const chevron = row.querySelector(".dpc-face__open");
      return {
        hasChevron: Boolean(chevron),
        expanded: chevron ? chevron.getAttribute("aria-expanded") : null,
        label: chevron ? chevron.getAttribute("aria-label") : null,
        children: row.querySelectorAll(".dpc-face__row--side").length,
        /* The row's own button is still there and still one button. */
        rowButtons: row.querySelectorAll(":scope > .dpc-face__row").length,
      };
    })()`) as any;
    check(
      collapsed?.hasChevron === true && collapsed.expanded === "false" && collapsed.children === 0,
      `${theme}: a pair carries a chevron and is closed until she opens it`,
      collapsed === null
        ? "no Eyes row at all"
        : `chevron ${collapsed.hasChevron}, aria-expanded=${collapsed.expanded}, ${collapsed.children} children drawn`,
    );
    check(
      collapsed?.rowButtons === 1 && /^Show each of /.test(collapsed?.label ?? ""),
      `${theme}: and the chevron is its own control, so the row still means the pair`,
      `${collapsed?.rowButtons} row button(s), chevron says "${collapsed?.label}"`,
    );

    /*
      AND IT DRAWS IN THE SURFACE'S OWN INK, IN BOTH THEMES (founder,
      fable-476/477).

      His two sentences did the whole diagnosis: *"why is it black, shouldn't it
      be white like everything else"* and *"on the dark theme i can see it
      because its white like it should be."* The chevron took `color: inherit`,
      which walks up to the app's THEME text colour — and this panel sits on the
      viewer's scrim, which is dark in both themes.

      The assertion is the CLASS rather than the instance and it names no token:
      an affordance on this surface must draw in the same light ink its
      neighbours do, whatever the theme is set to. A token rename cannot break
      it and a re-flipped colour cannot pass it.
    */
    const ink = await page.evaluate(`(() => {
      const read = (selector) => {
        const node = document.querySelector(selector);
        return node ? getComputedStyle(node).color : null;
      };
      return { chevron: read(".dpc-face__open"), label: read(".dpc-face__name") };
    })()`) as { chevron: string | null; label: string | null };
    const luminance = (colour: string | null): number => {
      const parts = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(colour ?? "");
      if (!parts) return -1;
      const [r, g, b] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    check(
      ink.chevron !== null && ink.chevron === ink.label && luminance(ink.chevron) > 0.8,
      `${theme}: the chevron draws in the same light ink as the labels beside it`,
      `chevron ${ink.chevron} · label ${ink.label} · luminance ${luminance(ink.chevron).toFixed(2)}`,
    );

    await page.click(".dpc-face__rows > li .dpc-face__open").catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const expanded = await page.evaluate(`(() => {
      const row = Array.from(document.querySelectorAll(".dpc-face__rows > li"))
        .find((item) => item.querySelector(".dpc-face__open")?.getAttribute("aria-expanded") === "true");
      if (!row) return null;
      const children = Array.from(row.querySelectorAll(".dpc-face__row--side"));
      return {
        parent: row.querySelector(".dpc-face__name")?.textContent ?? "",
        names: children.map((child) => child.querySelector(".dpc-face__name")?.textContent ?? ""),
        thumbs: children.filter((child) => {
          const thumb = child.querySelector(".dpc-face__thumb");
          return Boolean(thumb) && !thumb.classList.contains("dpc-face__thumb--none");
        }).length,
      };
    })()`) as any;
    check(
      expanded !== null && expanded.names.length === 2
        && expanded.names.every((name: string) => /^(Left|Right) /.test(name)),
      `${theme}: opening it shows the two sides, each named as itself`,
      expanded === null
        ? "nothing expanded"
        : `${expanded.parent} → ${expanded.names.join(" · ")}, ${expanded.thumbs} with a picture of their own`,
    );
    /*
      AND THE ONE CASE THAT CHANGES WHAT THE PANEL SAYS (fable-459 §2).

      A diverged pair is the only shape where nesting changes the WORDS rather
      than the arrangement, and the fixture's eyes matched — so it was proven in
      the suite and, in the browser, only where it could not be wrong. The
      fixture now carries the founder's own live specimen in words (one pale icy
      blue iris against a warm brown one, his production v#185), and this reads
      the sentence off the rendered panel.
    */
    const diverged = await page.evaluate(`(() => {
      const row = Array.from(document.querySelectorAll(".dpc-face__rows > li"))
        .find((item) => item.querySelector(".dpc-face__name")?.textContent === "Eyes");
      if (!row) return null;
      const children = Array.from(row.querySelectorAll(".dpc-face__row--side"));
      return {
        parentWords: row.querySelector(".dpc-face__words")?.textContent ?? "",
        childWords: children.map((child) => child.querySelector(".dpc-face__words")?.textContent ?? ""),
      };
    })()`) as any;
    /*
      RE-ANCHORED (#1297), BOTH HALVES, AND THE RULE NOW ADMITS AGREEMENT.

      What overruled the old ones: they asserted `left …icy blue` and `right
      …brown` against the parent line, and `icy blue` / `brown` against the two
      children — the founder's own live specimen from production v#185. **That is
      a fact about one cast's eyes.** The subject the driver finds has eyes that
      AGREE (both children read the same hazel-brown sentence), so there was no
      disagreement to attribute and the assertion called a correct panel broken.

      ⚠ **The rule the specimen was standing in for is the one that matters and
      it is stated directly now** (fable-459 §2): a diverged pair is the only
      shape where nesting changes the WORDS rather than the arrangement. So —

        sides DISAGREE  the parent attributes both, by side, and claims neither
        sides AGREE     the parent says that one thing, unattributed

      Both arms are live on every subject: whichever one this cast exercises is
      asserted, and the other is recorded as not-applicable in the saw line
      rather than silently skipped. The check still fails on the case it was
      written for — a parent that says "hazel-brown" over two different irises,
      or one that says "left … right …" over two identical ones.

      ⚠ **And it refuses rather than passing when it cannot read the pair at
      all** — an unexpanded row hands back `null`, and the old check would have
      read that as "no icy blue" and failed for the wrong reason.
    */
    const childWords: string[] = diverged?.childWords ?? [];
    const parentWords: string = (diverged?.parentWords ?? "").trim();
    const sidesDisagree = childWords.length === 2
      && childWords[0]!.trim() !== "" && childWords[1]!.trim() !== ""
      && childWords[0]!.trim() !== childWords[1]!.trim();
    /* Attribution is the product's own side vocabulary, the same `Left `/`Right `
       prefix the expanded-names check above asserts the children are named by. */
    const attributesBothSides = /\bleft\b/i.test(parentWords) && /\bright\b/i.test(parentWords);
    check(
      diverged !== null && childWords.length === 2 && parentWords !== ""
        && (sidesDisagree ? attributesBothSides : !attributesBothSides),
      `${theme}: a pair whose sides disagree says so, attributed, and claims neither`,
      diverged === null
        ? "the Eyes row could not be read at all — REFUSING rather than reporting an absence as a pass"
        : `sides ${sidesDisagree ? "DISAGREE" : "agree"} · parent reads "${parentWords.slice(0, 90)}"`
          + ` · it ${attributesBothSides ? "names both sides" : "names neither side"}`,
    );
    /*
      AND THE SECOND HALF, which is what makes the first one safe: a parent may
      only claim what its children actually say. Where the sides disagree, each
      child's own sentence must appear under the parent's attribution of that
      side; where they agree, the parent's sentence is theirs.
    */
    const childrenCarryTheirOwn = childWords.length === 2
      && childWords.every((words) => words.trim() !== "")
      && (sidesDisagree
        ? childWords[0]!.trim() !== childWords[1]!.trim()
        : parentWords.includes(childWords[0]!.trim()) || childWords[0]!.trim().includes(parentWords));
    check(
      childrenCarryTheirOwn,
      `${theme}: and each side says its own`,
      childWords.length !== 2
        ? `${childWords.length} child row(s) — a pair has two`
        : `children read "${childWords.map((w) => w.slice(0, 60)).join('" · "')}"`,
    );
    await shot(page, ".dpc-face", `panel-open-${theme}.png`);

    /* CLICKING A CHILD IS THE SCOPING GESTURE AGAIN — the same wire the
       rectangle sends. Read on the child's own pressed state and on the picture,
       because "scoped" that lights both eyes is not scoped. */
    await page.click(".dpc-face__row--side").catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const afterChild = await page.evaluate(`(() => {
      const children = Array.from(document.querySelectorAll(".dpc-face__row--side"));
      const boxes = Array.from(document.querySelectorAll(".dpc-regions__box"));
      return {
        pressed: children.map((child) => child.getAttribute("aria-pressed")),
        activeBoxes: boxes.filter((box) => box.getAttribute("data-active") === "true")
          .map((box) => box.querySelector(".dpc-regions__tag")?.textContent ?? ""),
        askDraft: (document.querySelector(".dpc-refine__field") || {}).value ?? null,
      };
    })()`) as any;
    check(
      afterChild?.pressed?.filter((state: string) => state === "true").length === 1
        && afterChild.activeBoxes.length === 1,
      `${theme}: tapping one side scopes to it — one child pressed, one rectangle lit`,
      `pressed: ${afterChild?.pressed?.join(", ")} · lit boxes: ${afterChild?.activeBoxes?.join(", ") || "none"}`,
    );
    /* And it opened HER sentence about that one side, not the pair's. */
    check(
      typeof afterChild?.askDraft === "string" && /^(her|his|their) (left|right) /.test(afterChild.askDraft),
      `${theme}: and the ask box opens about that side in the words the product speaks`,
      `ask box holds "${afterChild?.askDraft}"`,
    );
    await page.click(".dpc-face__open").catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 150));

    /* The reverse, hovering the SAME feature's box rather than whichever one
       happens to be drawn first. */
    const boxIndex = (litByRow?.boxes ?? []).findIndex((box: any) => box.tag === MEASURED_ROW);
    /*
      ⚠ AN INDEX BUILT FROM A NOT-FOUND ANSWER IS NEVER TURNED INTO A SELECTOR
      (#1151, and it is the index-not-name class one step further along).

      `findIndex` answers `-1`, and `-1 + 1` is `:nth-of-type(0)` — not a wrong
      element but an INVALID selector, which puppeteer throws on. Measured on the
      first run against a found subject: the whole drive died there, taking every
      remaining check AND the entire light theme with it, and the hover check
      three lines below had already reported `box 0 of 3` rather than saying the
      box was absent (its `.catch(() => null)` swallowed the same throw).

      So the absence is a named FAILURE about the subject, not an exception: this
      frame has no `MEASURED_ROW` region, which is a true and useful thing to
      report, and the remaining checks are unreachable on it rather than broken.
    */
    if (boxIndex < 0) {
      check(
        false,
        `${theme}: the frame carries a region for the measured row, so the rest of this walk can run`,
        `no box tagged "${MEASURED_ROW}" among ${litByRow?.boxes?.length ?? 0}`
          + ` (${(litByRow?.boxes ?? []).map((box: any) => box.tag).join(", ") || "none"})`
          + ` — every check below this line needs one and is NOT REACHED on this subject`,
      );
      throw new MeasuredRowMissing(`${MEASURED_ROW} has no region on this frame`);
    }
    await page.hover(`.dpc-regions__box:nth-of-type(${boxIndex + 1})`).catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const litByBox = await page.evaluate(READ_PANEL) as any;
    const litRow = litByBox.rows.find((row: any) => row.name === MEASURED_ROW);
    check(
      litRow?.lit === "true",
      `${theme}: hovering that region lights ITS OWN row in the panel`,
      `${MEASURED_ROW}'s row reads data-lit="${litRow?.lit}" (box ${boxIndex + 1} of ${litByRow?.boxes?.length ?? 0})`,
    );

    /*
      ---- click the feature ON the picture ----

      RE-ANCHORED (shift 79). THE THIRD MEMBER OF THE INDEX-NOT-NAME CLASS, and
      the one that was still live after opus-335 fixed the hover pair three
      lines above it. This clicked `.dpc-regions__box` — the FIRST rectangle,
      which is her BUILD — and then asserted the box opened carrying "her lips
      — ". It has been failing on a true statement about the wrong feature, and
      on the day the scan happened to draw her lips first it would have PASSED
      just as meaninglessly. Same shape, same file, same fix: name the feature
      at both ends (working law 7 — fix the class, not the instance).
    */
    /* `boxIndex` is proven >= 0 above, so the fallback can no longer spell
       `:nth-of-type(0)`. Named first either way — the index is the last resort
       for a box whose aria-label the read did not capture, not a second road. */
    const measuredSelector = litBox?.label
      ? `.dpc-regions__box[aria-label="${litBox.label.replace(/"/g, '\\"')}"]`
      : `.dpc-regions__box:nth-of-type(${boxIndex + 1})`;
    await page.click(measuredSelector);
    await page.waitForSelector(".dpc-regions__ask", { timeout: 10_000 });
    const opened = await page.evaluate(READ_REGIONS) as any;
    /*
      AMENDED BY FOUNDER RULING (fable-1270 §1) — the box used to open carrying
      "her lips — " as typed text and now opens EMPTY behind hint text. The noun
      still reaches the wire, composed at submit; that half is pinned in
      `facePanelAnatomy.test.ts`, which can read the handler this drive cannot.
    */
    check(
      opened.draft === "" && (opened.fieldPlaceholder ?? "").length > 0,
      `${theme}: the box opens empty, with hint text rather than a pasted sentence`,
      `field value "${opened.draft}", placeholder "${opened.fieldPlaceholder}"`,
    );
    /*
      ⚠ AMENDED, NEVER SILENTLY DROPPED (FOUNDER, fable-1270 §2): *"its already
      stated in the description under the chatbar."*

      D-15/D-109 stands and is read as ONCE PER SURFACE rather than once per
      control: the refine panel under the picture states this edit's price, and
      the chip that repeated it beside this button is gone. The arm keeps the
      half that is still law — never a price ON the button — and now also
      proves the chip's ABSENCE, so putting it back reddens this rather than
      passing silently.
    */
    check(
      opened.submitHasPrice === false && opened.priceText === null,
      `${theme}: the price is stated once per surface — not on this popover, never on a button`,
      `button "${opened.submitText}", popover price ${JSON.stringify(opened.priceText)}`,
    );
    check(
      opened.fieldOutline === "none",
      `${theme}: no inner focus ring on the field`,
      `outline-style: ${opened.fieldOutline}`,
    );
    /*
      THE TWO STRINGS THE COPY AUDIT COULD NOT EVIDENCE (shift 79). The pack
      reads every classified string back out of these saw lines, and a string
      no check reads is shipped copy with nothing behind it. Both are on this
      surface and both were captured by the DOM read already — nothing asserted
      them.

      The placeholder is the shipped ask box's own, reused verbatim so the two
      doors to one edit do not speak differently; the field's label names the
      feature, because a screen reader arriving at this box mid-page has no
      rectangle to look at.
    */
    /*
      RE-ANCHORED (#1297), AND THE OLD TITLE WAS AS WRONG AS THE OLD STRING.

      It asserted `"Change something about them…"` — the ask box's placeholder,
      reused verbatim — under the title *"asks in the same words as the ask box
      below"*. **The founder replaced it**, and his reasoning reverses the rule
      rather than merely moving the string: `FaceRegions.tsx:61-70` records
      fable-1270 §1, *"the founder's own words for what this field should now
      show … It REPLACES the ask box's 'Change something about them…' … the two
      doors still do not disagree, because this one is now a HINT over an EMPTY
      box and the other is a hint over an UNSCOPED one."*

      ⚠ So the repair is NOT to compare the two placeholders — that would have
      re-asserted the sameness he deliberately ended, and it was the first thing
      this shift reached for. They are two different fields with two different
      jobs and they are allowed to say different things.

      **It stays a literal on purpose, which is the one place a literal is
      right**: this is shipped COPY, the founder owns the words, and the copy
      audit in that file reads every classified string back out of this saw line
      — a check comparing two DOM values would leave his ruling with nothing
      behind it anywhere.
    */
    check(
      opened.fieldPlaceholder === "Describe your edit…",
      `${theme}: the scoped box shows the founder's own hint over an empty field (fable-1270 §1)`,
      `placeholder "${opened.fieldPlaceholder}"`,
    );
    /*
      AND IT IS THE ONE LABEL HERE THAT IS A SENTENCE (founder, fable-451).

      The tags went bare — *"even on hover it's too long — just 'Left eye'"* —
      and this did not: a screen reader hearing "what to change about left eye"
      is being read a column header rather than asked a question. So it is
      checked against the server's own `spoken`, which is where the possessive
      now lives, and the possessive is checked SEPARATELY. Comparing only
      against `spoken` would pass just as happily on the day the server started
      sending a bare one — both sides would move together and the ruling would
      leave no mark anywhere.
    */
    /*
      RE-ANCHORED (#1297), AND IT IS THE FIRST OF THREE THAT NOW STATE ONE RULE.

      What overruled the old one: it compared the label to `What to change about
      her lips` — and `MEASURED_SPOKEN` was `"her lips"` because the founder's
      v#156 frame is a woman. **The subject the driver finds is a man**, so the
      product said `"What to change about his lips"`, which is correct, and three
      separate checks called it a defect (this one, the ask-box opening, and the
      typed sentence).

      ⚠ **The possessive is a property of the CAST, so it cannot be a constant —
      but it must not be read off the same surface it is checking either**, or
      the check passes on whatever the label happens to say. So the shape is
      asserted here — a possessive from the product's own closed set, then the
      row's own feature name — and the possessive it finds is carried to the two
      surfaces below, which must AGREE with it.

      That is fable-450/451's actual content: the founder took the possessive off
      every LABEL (*"just 'Left eye'"*) and kept it everywhere the product speaks
      a SENTENCE. One cast, one voice, on every surface. A bare
      `"What to change about lips"` fails here; a label that says `his` while the
      ask box says `her` fails below; and neither could be caught by comparing a
      surface with itself.
    */
    const labelShape = new RegExp(
      `^What to change about (${SPOKEN_POSSESSIVES.join("|")}) ${MEASURED_ROW.toLowerCase()}$`,
    );
    const spokenMatch = labelShape.exec(String(opened.fieldLabel ?? ""));
    const spokenPossessive = spokenMatch?.[1] ?? null;
    check(
      spokenMatch !== null,
      `${theme}: and its label names the feature it is scoped to, in the words the product speaks`,
      `aria-label "${opened.fieldLabel}" · the row's own label is "${MEASURED_ROW}"`
      + ` · ${spokenPossessive === null
        ? `it is not "What to change about <${SPOKEN_POSSESSIVES.join("|")}> ${MEASURED_ROW.toLowerCase()}"`
        : `the cast is spoken of as "${spokenPossessive}", and the two surfaces below must agree`}`,
    );
    const askBox = await page.evaluate(`(() => {
      const form = document.querySelector(".dpc-regions__ask");
      /* The feature that was actually clicked, not whichever is drawn first —
         this measured the distance from her BUILD's rectangle to a form opened
         at her LIPS and called it "at the feature". */
      const region = document.querySelector(${JSON.stringify(measuredSelector)});
      if (!form || !region) return null;
      const f = form.getBoundingClientRect();
      const r = region.getBoundingClientRect();
      return { formTop: Math.round(f.top), regionBottom: Math.round(r.bottom), formLeft: Math.round(f.left), regionLeft: Math.round(r.left) };
    })()`) as any;
    check(
      askBox !== null && Math.abs(askBox.formTop - askBox.regionBottom) < 40,
      `${theme}: the box opens AT the feature, not somewhere else on the page`,
      askBox ? `form top ${askBox.formTop} against region bottom ${askBox.regionBottom}` : "could not measure",
    );
    await page.screenshot({ path: path.join(OUT, `region-open-${theme}.png`) as `${string}.png` });
    await shot(page, ".dpc-viewer__plate", `region-closeup-${theme}.png`);

    /* Esc closes it, and closing spends nothing. */
    const beforeEscape = await page.evaluate(`(() => {
      const active = document.activeElement;
      return {
        active: active ? (active.className || active.tagName) : null,
        ownsEscape: Boolean(active && active.closest && active.closest("[data-owns-escape]")),
        attrPresent: Boolean(document.querySelector("[data-owns-escape]")),
      };
    })()`) as any;
    await page.keyboard.press("Escape");
    await new Promise((resolve) => setTimeout(resolve, 250));
    const closed = await page.evaluate(`(() => ({
      regions: ${READ_REGIONS},
      viewerStillOpen: Boolean(document.querySelector(".dpc-viewer")),
    }))()`) as any;
    check(
      closed.viewerStillOpen && closed.regions !== null && closed.regions.open === false,
      `${theme}: Esc closes the box and leaves the viewer standing`,
      `viewer open: ${closed.viewerStillOpen}, scoped form present: ${closed.regions?.open ?? "no regions at all"}`
        + ` (focus was ${beforeEscape.active}, owns-escape ancestor: ${beforeEscape.ownsEscape}, attribute in DOM: ${beforeEscape.attrPresent})`,
    );
    check(spends.length === 0, `${theme}: nothing in this walk spent a credit`, `${spends.length} spend requests on the wire`);

    /* Tapping a row prefills the ask box below — the other door to the same edit. */
    await page.click(rowSelector);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const asked = await page.evaluate(`(() => {
      const field = document.querySelector(".dpc-refine__ask input, .dpc-refine__ask textarea");
      return field ? field.value : null;
    })()`) as any;
    /*
      RE-ANCHORED (#1297) — the SECOND surface, and it agrees with the first or
      the product is speaking about this cast in two voices.

      The opening was `"her lips — "`, the fixture's possessive. It is now built
      from the possessive the scoped label just used, so the two doors to one
      edit cannot drift apart: a server that started sending `his` on one surface
      and `her` on the other is exactly what this now catches, and neither
      hard-coding nor reading this surface against itself could.
    */
    const expectedOpening = spokenPossessive === null
      ? null
      : `${spokenPossessive} ${MEASURED_ROW.toLowerCase()} — `;
    check(
      expectedOpening !== null && asked === expectedOpening,
      `${theme}: tapping the row writes the same opening into the ask box below`,
      `ask box holds "${asked}"`
      + (expectedOpening === null
        ? " · the scoped label named no possessive, so there is nothing to agree WITH — that failure is above"
        : ` · the scoped label spoke of this cast as "${spokenPossessive}", so the opening must too`),
    );
    await shot(page, ".dpc-refine", `refine-${theme}.png`);

    /*
      AND THE SENTENCE CAN ACTUALLY BE FINISHED.

      The draft is held by the sheet now, so every keystroke re-renders the
      viewer — and the viewer used to re-take focus on every render, because its
      key-handler effect depended on the caller's inline callbacks. Typing would
      have lost its caret after one character. Type a real phrase and read back
      what arrived.
    */
    const typed = "a touch glossier";
    await page.focus(".dpc-refine__field");
    await page.type(".dpc-refine__field", typed, { delay: 20 });
    const finished = await page.evaluate(`(() => {
      const field = document.querySelector(".dpc-refine__field");
      return { value: field ? field.value : null, focused: document.activeElement === field };
    })()`) as any;
    /*
      RE-ANCHORED (#1297) — the THIRD surface. Same repair, and the property
      under test is untouched: the caret survives a whole sentence.

      ⚠ **The possessive here was doing a second job and it still is.** This arm
      reads the WHOLE field back, opening included, so a viewer that re-took
      focus and ate the opening is caught by the same assertion that catches a
      dropped keystroke. Asserting only the typed tail would pass on a field that
      had silently lost `his lips — ` on the first re-render.
    */
    check(
      expectedOpening !== null && finished.value === `${expectedOpening}${typed}` && finished.focused,
      `${theme}: a whole sentence can be typed without the viewer taking the caret back`,
      `field holds "${finished.value}" and still has focus: ${finished.focused}`,
    );

    check(
      refused.filter((entry) => /image-proxy|r2\.dev/.test(entry)).length === 0,
      `${theme}: no image or stencil was refused by the browser`,
      refused.length === 0 ? "no failed requests at all" : refused.slice(0, 3).join(" | "),
    );
  } catch (error) {
    /*
      ⚠ A CRASH IN ONE THEME NO LONGER COSTS THE OTHER ONE (#1151).

      Everything above ran inside `try { } finally { close() }` with no catch, so
      any throw ended the process: on the first run against a found subject the
      dark walk died two thirds of the way through and the LIGHT theme was never
      opened at all — the run reported nothing about the theme it had not
      reached, and it reported it by exiting, which is the shape a shift reads as
      "the driver is broken" rather than "this subject has no lips region".

      A throw is now one recorded failure naming where the walk stopped, and the
      next theme still runs. It is deliberately a FAILURE and not a skip: the run
      must still be red, because it did not do what it says it does.
    */
    check(
      false,
      `${theme}: the walk reached the end`,
      `stopped at: ${error instanceof Error ? error.message : String(error)}`
        + (error instanceof MeasuredRowMissing ? " — a fact about this subject, not a broken driver" : ""),
    );
  } finally {
    await browser.close();
  }
}

/*
  THE NEGATIVE CONTROL: the same thumbnail with its stencil blocked at the
  network layer. Nothing painted → the two photographs are identical → zero. A
  null result with a fixture that could have produced a non-null one.
*/
{
  const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
  try {
    await page.evaluateOnNewDocument(() => window.localStorage.setItem("drape_theme", "dark"));
    await page.setRequestInterception(true);
    let blocked = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/image-proxy")) { blocked += 1; void request.abort(); return; }
      void request.continue();
    });
    await openPanel(page);
    /* THE SAME MOMENT AS THE LIVE SHOT, not a 1.5s guess. The panel mounts with
       one row and fills to nine when the scan answers, so a control taken mid-fill
       is a photograph of a different panel — and the delta between two different
       panels is not a reading of anything. */
    const controlSettled = await waitForSettled(page);
    check(
      controlSettled !== null,
      "control: her face is finished being read before the control is photographed",
      controlSettled === null ? "the working line never cleared" : `settled after ${(controlSettled / 1000).toFixed(1)}s`,
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    /* THE MINTED ROW THE LIVE SHOT TOOK, never `MEASURED_ROW` (#1297) — the
       reasoning is on `mintedRowForControl`, and the short version is that a
       windowed row is pixel-identical with the proxy refused, so the control was
       reading 0.00 about a row it could never have moved. */
    const control = mintedRowForControl === null
      ? null
      : await thumbShotOf(page, mintedRowForControl);
    check(blocked > 0, "control: the stencil really was blocked", `${blocked} proxy requests aborted`);
    if (control && liveThumbs.dark) {
      await writeFile(path.join(OUT, "thumb-control-blocked.png"), control);
      await writeFile(path.join(OUT, "thumb-live-dark.png"), liveThumbs.dark);
      const delta = await meanAbsoluteDifference(liveThumbs.dark, control);
      check(
        delta > 1,
        "the cutout paints something a blocked stencil does not",
        `mean absolute difference ${delta.toFixed(2)} between the live thumbnail and the same box with its stencil refused`
        + ` · the row is ${mintedRowForControl}, whose crop is its own picture — the one kind a refused proxy can move`,
      );
    } else {
      check(false, "the cutout paints something a blocked stencil does not", "never reached — no control shot");
    }
  } finally {
    await browser.close();
  }
}

await writeFile(path.join(OUT, "checks.json"), JSON.stringify(records, null, 2));
print();
if (failures().length > 0) process.exit(1);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
