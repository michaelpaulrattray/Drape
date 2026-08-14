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
 *   npx tsx scripts/drive-face-panel-evidence.mts
 *
 * Shots land in `output/panel-v2/`.
 *
 * # THE FIXTURE, AND WHAT IS HAND-WRITTEN IN IT
 *
 * The frame is the founder's own v#156 render, uploaded to the dev bucket. The
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
 * Requires `CASTING_REFERENCE_LIBRARY_SCOPE=users:1` AND
 * `CASTING_FACE_SCAN_SCOPE=users:1` on the running server. With the library flag
 * off the endpoint answers `enabled: false`, the panel does not render, and this
 * driver fails rather than passing quietly — which is the correct verdict for a
 * run that proved nothing. With the SCAN flag off the panel is one library row,
 * every re-anchored check below fails loudly, and that too is correct: this
 * driver grades the product the founder is actually looking at.
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

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const BASE = arg("base", process.env.VERIFY_BASE_URL ?? "http://localhost:3000");
const OUT = path.resolve("output/panel-v2");
const SESSION = "2df4aeab-daa0-4bab-8ce7-d1e2c969510d";
const TILE = "01";
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
 */
const MEASURED_SPOKEN = "her lips";

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
 * `Her earrings` joined LIBRARY in shift 80, when earring detection armed and
 * the row came back onto the panel. It had been recorded ABSENT below the pair
 * check for four shifts — the check that could not fire in either direction.
 */
const LIBRARY_ROWS = ["Lips", "Hair", "Glasses", "Earrings"] as const;
const DESCRIBED_ROWS = ["Build", "Skin"] as const;
const PAIR_ROWS = ["Eyes", "Brows", "Ears"] as const;

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

/* The fixture is on the founder's own account, so the session is his. Read,
   never printed. */
const conn = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await conn.query("SELECT openId FROM users WHERE id = 1") as any[];
await conn.end();
if (!owners[0]?.openId) throw new Error("no owner account to drive as");
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

/** The healthy thumbnail photographs, kept so the control has something to differ from. */
const liveThumbs: Record<string, Buffer | null> = {};

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
    const missingLibrary = LIBRARY_ROWS
      .filter((name) => !(named(name)?.words !== "" && named(name)?.from === "from an edit"));
    check(
      missingLibrary.length === 0,
      `${theme}: every library row with a place on the photograph reaches the panel, carrying its own words`,
      missingLibrary.length === 0
        ? LIBRARY_ROWS.map((name) => `${name}: "${named(name)!.words}" (${named(name)!.from})`).join(" | ")
        : `missing or wordless: ${missingLibrary.join(", ")}`,
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
    check(
      earringRows.length === 1
        && earringRows[0].parts === 1
        && boxNames.includes("Left earring")
        && !boxNames.includes("Right earring"),
      `${theme}: the ear that wears one is found, and the ear behind her hair is not guessed at`,
      earringRows.length !== 1
        ? `${earringRows.length} rows named "Earrings"`
        : `one row, ${earringRows[0].parts} part(s), words "${earringRows[0].words}" (${earringRows[0].from})`
          + ` · boxes: ${boxNames.filter((name: string) => name.includes("earring")).join(", ") || "none"}`,
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
    check(
      minted.length === 1 && minted[0].name === MEASURED_ROW
        && windowed.length === withThumb.length - 1,
      `${theme}: the minted crop is its own picture; every scanned one is a window on the frame`,
      `its own picture: ${minted.map((r: any) => r.name).join(", ") || "none"}`
      + ` · windowed: ${windowed.length} of ${withThumb.length}`
      + ` · e.g. ${windowed[0]?.name} --dpc-cut-w=${windowed[0]?.cuts[0]?.cutWidth}`,
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
    liveThumbs[theme] = await thumbShotOf(page, MEASURED_ROW);
    check(
      liveThumbs[theme] !== null,
      `${theme}: ${MEASURED_ROW}' cutout has a box worth photographing`,
      liveThumbs[theme] ? `${liveThumbs[theme]!.length} bytes` : `no tile on a row named "${MEASURED_ROW}"`,
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
    const measuredSelector = litBox?.label
      ? `.dpc-regions__box[aria-label="${litBox.label.replace(/"/g, '\\"')}"]`
      : `.dpc-regions__box:nth-of-type(${boxIndex + 1})`;
    await page.click(measuredSelector);
    await page.waitForSelector(".dpc-regions__ask", { timeout: 10_000 });
    const opened = await page.evaluate(READ_REGIONS) as any;
    check(
      opened.draft === "her lips — ",
      `${theme}: the box opens carrying the opening of her sentence`,
      `field value "${opened.draft}"`,
    );
    check(
      opened.submitHasPrice === false && /\d+ credits/.test(opened.priceText ?? ""),
      `${theme}: the price is stated beside the button and never on it`,
      `button "${opened.submitText}", price "${opened.priceText}"`,
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
    check(
      opened.fieldPlaceholder === "Change something about them…",
      `${theme}: the scoped box asks in the same words as the ask box below`,
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
    check(
      opened.fieldLabel === `What to change about ${MEASURED_SPOKEN}`,
      `${theme}: and its label names the feature it is scoped to, in the words the product speaks`,
      `aria-label "${opened.fieldLabel}" · the row's own label is "${MEASURED_ROW}"`,
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
    check(
      asked === "her lips — ",
      `${theme}: tapping the row writes the same opening into the ask box below`,
      `ask box holds "${asked}"`,
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
    check(
      finished.value === `her lips — ${typed}` && finished.focused,
      `${theme}: a whole sentence can be typed without the viewer taking the caret back`,
      `field holds "${finished.value}" and still has focus: ${finished.focused}`,
    );

    check(
      refused.filter((entry) => /image-proxy|r2\.dev/.test(entry)).length === 0,
      `${theme}: no image or stencil was refused by the browser`,
      refused.length === 0 ? "no failed requests at all" : refused.slice(0, 3).join(" | "),
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
    const control = await thumbShotOf(page, MEASURED_ROW);
    check(blocked > 0, "control: the stencil really was blocked", `${blocked} proxy requests aborted`);
    if (control && liveThumbs.dark) {
      await writeFile(path.join(OUT, "thumb-control-blocked.png"), control);
      await writeFile(path.join(OUT, "thumb-live-dark.png"), liveThumbs.dark);
      const delta = await meanAbsoluteDifference(liveThumbs.dark, control);
      check(
        delta > 1,
        "the cutout paints something a blocked stencil does not",
        `mean absolute difference ${delta.toFixed(2)} between the live thumbnail and the same box with its stencil refused`,
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
