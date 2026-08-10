/**
 * "ON HER FACE" — panel v2, driven in the real browser (D-101, the UI milestone
 * contract).
 *
 * Panel v2 was built whole in shift 26 and NEVER LOOKED AT. This opens the real
 * sheet, opens the real viewer on a real frame, photographs the panel in both
 * themes, and asserts the things a photograph cannot: that the one region drawn
 * over the picture is the one the library actually measured, that hovering a row
 * lights that region and hovering the region lights the row, that clicking it
 * opens a scoped box AT the feature already carrying their sentence, and that
 * closing it spends nothing.
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
 * real stored measurement on this exact frame, and it is the only region the
 * picture offers, which is the truthful state of the product today: hair and
 * earrings have no measured box until the mint caller produces one.
 *
 * Requires `CASTING_REFERENCE_LIBRARY_SCOPE=users:1` on the running server. With
 * the flag off the endpoint answers `enabled: false`, the panel does not render,
 * and this driver fails rather than passing quietly — which is the correct
 * verdict for a run that proved nothing.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { SignJWT } from "jose";
import sharp from "sharp";
import type { Page } from "puppeteer-core";

import { openDrivenPage, createChecks } from "./lib/drivePage.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const BASE = arg("base", process.env.VERIFY_BASE_URL ?? "http://localhost:3000");
const OUT = path.resolve("output/panel-v2");
const SESSION = "2df4aeab-daa0-4bab-8ce7-d1e2c969510d";
const TILE = "01";
const THEMES = ["dark", "light"] as const;

/** The row the library has a measured box for — the only clickable region. */
const MEASURED_ROW = "Her lips";

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

/* The fixture is on the founder's own account, so the session is his. Read,
   never printed. */
const conn = await mysql.createConnection(process.env.DATABASE_URL!);
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
    const style = thumb ? getComputedStyle(thumb) : null;
    return {
      name: row.querySelector(".dpc-face__name")?.textContent ?? "",
      words: row.querySelector(".dpc-face__words")?.textContent ?? "",
      from: row.querySelector(".dpc-face__from")?.textContent ?? "",
      label: row.getAttribute("aria-label") ?? "",
      lit: row.getAttribute("data-lit"),
      active: row.getAttribute("data-active"),
      hasThumb: Boolean(thumb) && !thumb.classList.contains("dpc-face__thumb--none"),
      maskImage: style ? (style.maskImage || style.webkitMaskImage || "") : "",
      maskMode: style ? (style.maskMode || style.webkitMaskSourceType || "") : "",
      background: style ? style.backgroundImage : "",
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

async function thumbShot(page: Page, index: number): Promise<Buffer | null> {
  const box = await page.evaluate(`(() => {
    const thumb = document.querySelectorAll(".dpc-face__thumb")[${index}];
    if (!thumb) return null;
    const rect = thumb.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  })()`) as any;
  if (!box || box.width < 2 || box.height < 2) return null;
  return Buffer.from(await page.screenshot({ clip: box, encoding: "binary" }) as Uint8Array);
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
let thumbIndex = -1;

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
    check(
      panel.title === "On her face",
      `${theme}: the heading, with this face's own pronoun`,
      `title="${panel.title}" over a woman's photograph`,
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
    check(
      spoken.length === 4,
      `${theme}: every library row reaches the panel`,
      spoken.map((r: any) => `${r.name}: "${r.words}"`).join(" | "),
    );
    check(
      spoken.every((row: any) => row.from === "from an edit"),
      `${theme}: a spoken row says where it came from`,
      spoken.map((r: any) => `"${r.from}"`).join(", "),
    );
    check(
      panel.rows.filter((row: any) => row.from !== "").length === spoken.length,
      `${theme}: a row nothing has happened to claims no provenance`,
      `${panel.rows.length - spoken.length} silent rows carry no "from" line`,
    );
    /* The pair rule, read off the screen: matched earrings are ONE row. */
    const earringRows = panel.rows.filter((row: any) => /earring/i.test(row.name));
    check(
      earringRows.length === 1 && earringRows[0].name === "Her earrings",
      `${theme}: a matched pair is one row`,
      earringRows.map((r: any) => `"${r.name}"`).join(", ") || "no earring row at all",
    );

    /* ---- the thumbnail, and the negative control ---- */
    const withThumb = panel.rows
      .map((row: any, at: number) => ({ ...row, at }))
      .filter((row: any) => row.hasThumb);
    check(
      withThumb.length === 1 && withThumb[0].name === MEASURED_ROW,
      `${theme}: a cutout appears only where a crop was minted`,
      `${withThumb.length} thumbnails: ${withThumb.map((r: any) => r.name).join(", ") || "none"}`,
    );
    if (withThumb.length === 1) {
      thumbIndex = withThumb[0].at;
      check(
        /luminance/i.test(withThumb[0].maskMode),
        `${theme}: the cutout is cut by LUMINANCE, not by a missing alpha channel`,
        `mask-mode: ${withThumb[0].maskMode}`,
      );
      liveThumbs[theme] = await thumbShot(page, thumbIndex);
      check(
        liveThumbs[theme] !== null,
        `${theme}: the cutout has a box worth photographing`,
        liveThumbs[theme] ? `${liveThumbs[theme]!.length} bytes` : "no box",
      );
    } else {
      check(false, `${theme}: the cutout is cut by LUMINANCE`, "never reached — no thumbnail found");
    }

    /* ---- the picture's regions ---- */
    const regions = await page.evaluate(READ_REGIONS) as any;
    check(
      regions !== null && regions.boxes.length === 1,
      `${theme}: exactly one region is drawn — the one that was measured`,
      regions ? `${regions.boxes.length} boxes: ${regions.boxes.map((b: any) => b.tag).join(", ")}` : "no .dpc-regions at all",
    );
    if (regions && regions.boxes.length === 1) {
      const box = regions.boxes[0];
      check(
        box.tag === MEASURED_ROW,
        `${theme}: the region is her lips, not a rectangle placed by proportion`,
        `tag="${box.tag}" label="${box.label}"`,
      );
      check(
        [box.left, box.top, box.width, box.height].every((value: string) => value.endsWith("%")),
        `${theme}: the box is a fraction of its own frame, never screen pixels`,
        `left=${box.left} top=${box.top} w=${box.width} h=${box.height}`,
      );
    }

    /*
      ---- THE PICTURE IS STILL A PICTURE ----

      The law shift 27 was written for, and the only one of these that can fail
      on a collapsed element: with the panel ON, measure the plate. Panel v2 as a
      `below` took the viewer's whole column and the photograph rendered 0 × 0
      while every source-level assertion about it passed.
    */
    const stage = await page.evaluate(`(() => {
      const rect = (q) => { const n = document.querySelector(q); if (!n) return null; const r = n.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      return { plate: rect(".dpc-viewer__plate"), figure: rect(".dpc-viewer__frame"), dock: rect(".dpc-viewer__dock"), box: rect(".dpc-regions__box"), panel: rect(".dpc-face") };
    })()`) as any;
    check(
      stage.plate !== null && stage.plate.w > 200 && stage.plate.h > 300,
      `${theme}: the photograph keeps its size with the panel on`,
      stage.plate ? `the plate renders ${stage.plate.w} × ${stage.plate.h}` : "no plate at all",
    );
    check(
      stage.dock !== null && stage.figure !== null && stage.dock.h <= stage.figure.h + 4,
      `${theme}: the panel is a column beside the picture, not a page under it`,
      stage.dock ? `dock ${stage.dock.w} × ${stage.dock.h} beside a ${stage.figure?.h}px figure` : "no dock",
    );
    check(
      stage.box !== null
        && stage.box.w > 8 && stage.box.h > 6
        && stage.box.x >= stage.plate.x - 1 && stage.box.y >= stage.plate.y - 1
        && stage.box.x + stage.box.w <= stage.plate.x + stage.plate.w + 1
        && stage.box.y + stage.box.h <= stage.plate.y + stage.plate.h + 1,
      `${theme}: her region is a real target inside the picture`,
      stage.box
        ? `box ${stage.box.w} × ${stage.box.h} at (${stage.box.x}, ${stage.box.y}) inside a plate at (${stage.plate.x}, ${stage.plate.y}) ${stage.plate.w} × ${stage.plate.h}`
        : "no region drawn",
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

    /* ---- one selection, two views ---- */
    const rowSelector = `.dpc-face__row[aria-label^="${MEASURED_ROW}"]`;
    await page.hover(rowSelector);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const litByRow = await page.evaluate(READ_REGIONS) as any;
    check(
      litByRow?.boxes[0]?.lit === "true",
      `${theme}: hovering the row lights the region on the picture`,
      `box data-lit="${litByRow?.boxes[0]?.lit}"`,
    );
    await shot(page, ".dpc-face", `panel-${theme}.png`);
    await page.screenshot({ path: path.join(OUT, `sheet-${theme}.png`) as `${string}.png` });

    await page.hover(".dpc-regions__box");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const litByBox = await page.evaluate(READ_PANEL) as any;
    const litRow = litByBox.rows.find((row: any) => row.name === MEASURED_ROW);
    check(
      litRow?.lit === "true",
      `${theme}: hovering the region lights the row in the panel`,
      `row data-lit="${litRow?.lit}"`,
    );

    /* ---- click the feature ON the picture ---- */
    await page.click(".dpc-regions__box");
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
    const askBox = await page.evaluate(`(() => {
      const form = document.querySelector(".dpc-regions__ask");
      const region = document.querySelector(".dpc-regions__box");
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
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const control = thumbIndex >= 0 ? await thumbShot(page, thumbIndex) : null;
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
