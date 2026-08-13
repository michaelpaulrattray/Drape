/**
 * THE AUTO-SCAN, DRIVEN IN THE REAL BROWSER (D-101, the UI milestone contract).
 *
 * The founder's complaint was a screenshot of empty boxes: *"you never mentioned
 * original image analyzing to prefill the library at the moment it still shows
 * blank slots completely unrelated."* This opens the real sheet on a real face,
 * waits for the scan to land, and photographs what the panel becomes.
 *
 *   npx tsx scripts/drive-face-scan-evidence.mts
 *
 * Shots land in `output/face-scan/`.
 *
 * # THE BEFORE-ARM IS THE HALF THAT MAKES IT A READING
 *
 * "The panel has cutouts" is also what a panel with a seeded library looks like.
 * So the panel is read TWICE: once before the scan lands (the library alone —
 * the founder's own screenshot) and once after, and what is reported is the
 * DIFFERENCE. A run where the second read equals the first proves the scan did
 * nothing, and says so.
 *
 * # AND THE ARITHMETIC IS DRIVEN, NOT ADMIRED
 *
 * A scanned cutout is the whole frame slid under a 34px tile by a stylesheet
 * calculation. Three ways that can be wrong and still photograph as *something*:
 * the variables might not be read at all, every tile might show the same part of
 * the picture, or the tile might paint nothing and be full of the page behind
 * it. Each has a control here — a deliberately wrong crop, a pairwise
 * comparison, and a blocked background — because a photograph of a smudge is
 * indistinguishable from a photograph of her eye at 34 pixels.
 *
 * Requires a server with `CASTING_REFERENCE_LIBRARY_SCOPE=users:1` and
 * `CASTING_FACE_SCAN_SCOPE=users:1`. With either off the panel answers
 * unscanned, and this fails rather than passing quietly.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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
const OUT = path.resolve("output/face-scan");
const SESSION = arg("session", "2df4aeab-daa0-4bab-8ce7-d1e2c969510d");
const TILE = arg("tile", "01");
const THEMES = ["dark", "light"] as const;

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await conn.query("SELECT openId FROM users WHERE id = 1") as any[];
await conn.end();
if (!owners[0]?.openId) throw new Error("no owner account to drive as");
const token = await new SignJWT({ openId: owners[0].openId, appId, name: "Face scan evidence" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { check, records, failures, print } = createChecks();

/** What the panel holds, including how each thumbnail is being drawn. */
const READ_PANEL = `(() => {
  const panel = document.querySelector(".dpc-face");
  if (!panel) return null;
  const rows = Array.from(panel.querySelectorAll(".dpc-face__row")).map((row) => {
    const tile = row.querySelector(".dpc-face__thumb");
    /* ONE TILE, ONE PART PER INSTANCE — a matched pair draws two, so the tile
       is a container now and the arithmetic lives on the parts inside it. */
    const parts = Array.from(row.querySelectorAll(".dpc-face__cut")).map((part) => {
      const style = getComputedStyle(part);
      return {
        isCutout: part.classList.contains("dpc-face__cut--cutout"),
        background: style.backgroundImage.slice(0, 120),
        maskKind: (style.maskImage || style.webkitMaskImage || "").slice(0, 30),
        backgroundSize: style.backgroundSize,
        backgroundPosition: style.backgroundPosition,
        cut: {
          x: part.style.getPropertyValue("--dpc-cut-x"),
          y: part.style.getPropertyValue("--dpc-cut-y"),
          w: part.style.getPropertyValue("--dpc-cut-w"),
          h: part.style.getPropertyValue("--dpc-cut-h"),
          fw: part.style.getPropertyValue("--dpc-cut-fw"),
          fh: part.style.getPropertyValue("--dpc-cut-fh"),
        },
      };
    });
    return {
      name: row.querySelector(".dpc-face__name")?.textContent ?? "",
      words: row.querySelector(".dpc-face__words")?.textContent ?? "",
      hasThumb: parts.length > 0,
      isCutout: parts.some((part) => part.isCutout),
      parts,
      background: parts[0]?.background ?? "",
      maskKind: parts[0]?.maskKind ?? "",
      cut: parts[0]?.cut ?? null,
    };
  });
  return { rows, cutouts: rows.filter((row) => row.isCutout).length };
})()`;

const READ_REGIONS = `(() => {
  const holder = document.querySelector(".dpc-regions");
  if (!holder) return null;
  const plate = document.querySelector(".dpc-viewer__plate");
  const p = plate ? plate.getBoundingClientRect() : null;
  return {
    plate: p ? { x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.width), h: Math.round(p.height) } : null,
    boxes: Array.from(holder.querySelectorAll(".dpc-regions__box")).map((box) => {
      const r = box.getBoundingClientRect();
      return {
        tag: box.querySelector(".dpc-regions__tag")?.textContent ?? "",
        left: box.style.left,
        top: box.style.top,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      };
    }),
  };
})()`;

async function meanAbsoluteDifference(a: Buffer, b: Buffer): Promise<number> {
  const [left, right] = await Promise.all([
    sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (left.data.length !== right.data.length) throw new Error("two shots of one tile came back different sizes");
  let total = 0;
  for (let at = 0; at < left.data.length; at += 1) total += Math.abs(left.data[at] - right.data[at]);
  return total / left.data.length;
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

async function openPanel(page: Page): Promise<void> {
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 180_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${TILE} larger"]`, { timeout: 180_000 });
  await page.click(`button[aria-label="View candidate ${TILE} larger"]`);
  await page.waitForSelector(".dpc-face", { timeout: 90_000 });
}

let firstThemeDone = false;

for (const theme of THEMES) {
  const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
  const spends: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (request.method() === "POST" && /castingV2\.(refine|roll|sign)/.test(url)) spends.push(url.slice(0, 160));
  });

  try {
    await page.evaluateOnNewDocument((value) => {
      window.localStorage.setItem("drape_theme", value);
    }, theme);

    await openPanel(page);

    /* ---- THE BEFORE-ARM: the panel as the library alone draws it ---- */
    const before = await page.evaluate(READ_PANEL) as any;
    const beforeRegions = await page.evaluate(READ_REGIONS) as any;
    await shot(page, ".dpc-face", `panel-before-${theme}.png`);
    check(
      before !== null,
      `${theme}: the panel is on the screen before any scan lands`,
      before ? `${before.rows.length} rows, ${before.cutouts} scan-born cutouts, ${before.rows.filter((r: any) => r.hasThumb).length} thumbnails in all` : "no panel",
    );

    /*
      ---- WAIT FOR THE SCAN ITSELF ----

      Fourteen segmenter calls in parallel; on a warm cache it is already in the
      first payload. Waiting on the CUTOUT rather than on a clock, because a
      fixed sleep reports a slow answer as no answer (the panel driver's own
      scar).
    */
    const started = Date.now();
    await page.waitForFunction(
      `document.querySelectorAll(".dpc-face__cut--cutout").length > 0`,
      { timeout: 180_000, polling: 500 },
    ).catch(() => null);
    const waited = Date.now() - started;

    /* Backgrounds and stencils are images; a shot taken before they decode is a
       photograph of an empty box. */
    await page.evaluate(`(async () => {
      const urls = Array.from(document.querySelectorAll(".dpc-face__cut"))
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
    await new Promise((resolve) => setTimeout(resolve, 800));

    const after = await page.evaluate(READ_PANEL) as any;
    const cutouts = after.rows
      .map((row: any, at: number) => ({ ...row, at }))
      .filter((row: any) => row.isCutout);

    check(
      cutouts.length > 0,
      `${theme}: the scan filled rows the library had nothing for`,
      `${cutouts.length} cutouts after ${(waited / 1000).toFixed(1)}s: ${cutouts.map((r: any) => r.name).join(", ") || "none"}`,
    );
    /*
      COLD AND WARM ARE DIFFERENT CLAIMS, and only the cold one is a delta.

      On a key nobody has read, the panel paints from the library and the
      cutouts arrive seconds later — that difference is the reading. On a key
      already in the cache the panel arrives COMPLETE in its first payload,
      which is the cache doing its job, and asserting a change there would fail
      the design for working. So the arm is named by what actually happened
      rather than assumed, and a warm run says so instead of quietly passing a
      test it never ran.
    */
    const cold = before.cutouts === 0;
    check(
      cold ? cutouts.length > before.cutouts : cutouts.length === before.cutouts && before.cutouts > 0,
      cold
        ? `${theme}: COLD — the panel changed, the second reading is not the first`
        : `${theme}: WARM — the panel arrived complete in one round trip`,
      cold
        ? `${before.cutouts} scan-born cutouts before, ${cutouts.length} after ${(waited / 1000).toFixed(1)}s (a run where these matched would prove the scan did nothing)`
        : `${before.cutouts} cutouts in the FIRST payload, ${cutouts.length} after — no second read, no second scan`,
    );
    check(
      cutouts.every((row: any) => row.maskKind.startsWith("url(\"data:image/png")),
      `${theme}: every scanned stencil rides the payload rather than an object`,
      cutouts.slice(0, 3).map((r: any) => `${r.name}: ${r.maskKind}…`).join(" | "),
    );
    check(
      new Set(cutouts.map((row: any) => row.background)).size === 1,
      `${theme}: every scanned row draws the SAME frame — the picture already on screen`,
      `${new Set(cutouts.map((r: any) => r.background)).size} distinct background images across ${cutouts.length} cutouts`,
    );

    /*
      ---- THE SURGERY (fable-382 §1): NO ROW WITHOUT CONTENT ----

      His panel had sixteen rows and seven pictures. A row is now drawn only
      where this face has a picture or something said about it, structure is
      words with no row at all, and lashes are read on the eyes.
    */
    const empties = after.rows.filter((row: any) => !row.hasThumb && !row.words.trim());
    check(
      empties.length === 0,
      `${theme}: every row on screen has a picture or something said about it`,
      `${after.rows.length} rows, ${after.rows.filter((r: any) => r.hasThumb).length} with a picture, `
        + `${empties.length} with neither${empties.length ? `: ${empties.map((r: any) => r.name).join(", ")}` : ""}`,
    );
    const gone = ["cheekbone", "jaw", "chin", "lash"];
    const survivors = after.rows.filter((row: any) =>
      gone.some((word: string) => row.name.toLowerCase().includes(word)));
    check(
      survivors.length === 0,
      `${theme}: facial structure and lashes have no row of their own`,
      survivors.length === 0
        ? `none of ${gone.join(" / ")} on screen; the ask box still reaches all of them`
        : `still drawn: ${survivors.map((r: any) => r.name).join(", ")}`,
    );

    /*
      ---- THE PAIR TILE (fable-382 §2): BOTH OF THEM ----

      *"its only showing one eye"* — on a face whose eyes were both read. A pair
      row now draws one part per instance, measured against the union it
      replaced (`bench-pair-tile`: the union of two eye boxes is 34 × 5.7px of
      content in an empty square).
    */
    const pairs = after.rows.filter((row: any) => row.parts.length > 1);
    const pairNames = ["eyes", "brows", "ears", "earrings"];
    const oneSided = after.rows.filter((row: any) =>
      pairNames.some((word: string) => row.name.toLowerCase().endsWith(word)) && row.parts.length === 1);
    check(
      pairs.length > 0,
      `${theme}: a matched pair draws BOTH instances in its one tile`,
      pairs.length > 0
        ? `${pairs.map((r: any) => `${r.name} (${r.parts.length})`).join(", ")}`
        : `no pair row drew two parts; one-sided pair rows: ${oneSided.map((r: any) => r.name).join(", ") || "none"}`,
    );

    /* ---- the regions the picture now offers ---- */
    const regions = await page.evaluate(READ_REGIONS) as any;
    check(
      regions !== null && (cold
        ? regions.boxes.length > (beforeRegions?.boxes.length ?? 0)
        : regions.boxes.length === (beforeRegions?.boxes.length ?? 0) && regions.boxes.length > 1),
      cold
        ? `${theme}: COLD — the picture gained click targets it did not have`
        : `${theme}: WARM — the picture had its click targets from the first paint`,
      `${beforeRegions?.boxes.length ?? 0} boxes before, ${regions?.boxes.length ?? 0} after: ${(regions?.boxes ?? []).map((b: any) => b.tag).join(", ")}`,
    );
    /* A pair draws one rectangle per instance and each says which one — the
       tags read "Her right eye" / "Her left eye" while the row stays "Her eyes".
       Written without a word boundary on purpose: an escape in this line once
       compiled to a literal control character, and the check reported zero on a
       screen full of correctly named boxes. */
    const instanceTags = (regions?.boxes ?? []).filter((box: any) =>
      / left | right /i.test(` ${String(box.tag).replace(/\s+/g, " ")} `));
    check(
      instanceTags.length > 0,
      `${theme}: a pair's rectangles each say which one they cover`,
      `${instanceTags.length} of ${regions?.boxes.length ?? 0} boxes name an instance: `
        + `${instanceTags.map((b: any) => b.tag).join(", ") || "none"}`,
    );
    const outside = (regions?.boxes ?? []).filter((box: any) => {
      const p = regions.plate;
      return box.rect.x < p.x - 1 || box.rect.y < p.y - 1
        || box.rect.x + box.rect.w > p.x + p.w + 1 || box.rect.y + box.rect.h > p.y + p.h + 1;
    });
    check(
      regions !== null && outside.length === 0,
      `${theme}: every box lands inside the photograph`,
      outside.length === 0
        ? `${regions?.boxes.length} boxes inside a plate at (${regions?.plate.x}, ${regions?.plate.y}) ${regions?.plate.w} × ${regions?.plate.h}`
        : `${outside.length} outside: ${outside.map((b: any) => b.tag).join(", ")}`,
    );

    /*
      ---- ONE CENTRELINE UNDER THE PICTURE (fable-377) ----

      His screenshot, measured: the picture at 606, the ask box at 685, its
      helper lines at 720. Three centrelines on the one surface whose whole job
      is to be about the photograph — and the ask box was a sibling of the
      entire stage, so it centred on the viewer while the picture centred on the
      stage's middle column.

      Mechanised rather than remembered, because this is exactly the rule a
      later hand breaks by moving one node up a level.
    */
    const centres = await page.evaluate(`(() => {
      const mid = (node) => { if (!node) return null; const r = node.getBoundingClientRect(); return Math.round(r.x + r.width / 2); };
      return {
        plate: mid(document.querySelector(".dpc-viewer__plate")),
        ask: mid(document.querySelector(".dpc-refine__ask")),
        notes: Array.from(document.querySelectorAll(".dpc-refine__note")).map(mid),
      };
    })()`) as any;
    const off = [centres.ask, ...centres.notes]
      .filter((value: number | null) => value !== null)
      .filter((value: number) => Math.abs(value - centres.plate) > 2);
    check(
      centres.plate !== null && centres.ask !== null && off.length === 0,
      `${theme}: the ask box and its lines hang off the PICTURE's centreline`,
      `picture ${centres.plate}, ask ${centres.ask}, notes ${centres.notes.join(" / ")}`
        + (off.length ? ` — ${off.length} off by more than 2px` : ""),
    );

    await shot(page, ".dpc-face", `panel-after-${theme}.png`);
    await shot(page, ".dpc-viewer__plate", `picture-${theme}.png`);
    await page.screenshot({ path: path.join(OUT, `sheet-${theme}.png`) as `${string}.png` });

    /* ---- THE ARITHMETIC, DRIVEN ---- */
    if (!firstThemeDone && cutouts.length >= 2) {
      firstThemeDone = true;

      /* Every tile, photographed at its own size and written out so the founder
         can look at them beside their names. */
      const tiles: { name: string; bytes: Buffer }[] = [];
      for (const row of cutouts) {
        const bytes = await thumbShot(page, row.at);
        if (bytes) tiles.push({ name: row.name, bytes });
      }
      await Promise.all(tiles.map((tile, at) => writeFile(
        path.join(OUT, `tile-${String(at).padStart(2, "0")}-${tile.name.replace(/[^a-z]+/gi, "-").toLowerCase()}.png`),
        tile.bytes,
      )));

      /*
        CONTROL 1 — the tile paints the picture, not the page behind it.

        A 34px box over a blurred sheet is full of somebody else's colour, which
        is exactly the reading that once passed three blank slots. So the
        control removes the frame and keeps everything else.
      */
      await page.evaluate(`(() => {
        const style = document.createElement("style");
        style.id = "scan-control-nobg";
        style.textContent = ".dpc-face__cut--cutout { background-image: none !important; }";
        document.head.appendChild(style);
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const blank = await thumbShot(page, cutouts[0].at);
      await page.evaluate(`(() => { document.getElementById("scan-control-nobg")?.remove(); })()`);
      if (blank && tiles[0]) {
        const delta = await meanAbsoluteDifference(tiles[0].bytes, blank);
        await writeFile(path.join(OUT, "control-no-frame.png"), blank);
        check(
          delta > 1,
          "a cutout paints the photograph, not the page behind it",
          `mean absolute difference ${delta.toFixed(2)} between "${tiles[0].name}" and the same tile with its frame removed`,
        );
      } else {
        check(false, "a cutout paints the photograph", "never reached — no control shot");
      }

      /*
        CONTROL 2 — the STYLESHEET IS ACTUALLY READING THE GEOMETRY.

        Move the crop to the far corner of the frame and re-photograph. If the
        calculation ignored the variables — or if the tile were showing the whole
        frame contained, which looks like a cutout at this size — the two
        photographs would be identical.
      */
      const target = cutouts[0];
      await page.evaluate(`(() => {
        const thumb = document.querySelectorAll(".dpc-face__thumb")[${target.at}].querySelector(".dpc-face__cut");
        thumb.style.setProperty("--dpc-cut-x", String(Math.max(0, Number(${JSON.stringify(target.cut.fw)}) - Number(${JSON.stringify(target.cut.w)}))));
        thumb.style.setProperty("--dpc-cut-y", String(Math.max(0, Number(${JSON.stringify(target.cut.fh)}) - Number(${JSON.stringify(target.cut.h)}))));
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const moved = await thumbShot(page, target.at);
      if (moved && tiles[0]) {
        const delta = await meanAbsoluteDifference(tiles[0].bytes, moved);
        await writeFile(path.join(OUT, "control-moved-crop.png"), moved);
        check(
          delta > 1,
          "the tile shows the crop the box names, not the whole frame",
          `mean absolute difference ${delta.toFixed(2)} between "${target.name}" and the same tile with its crop moved to the far corner`,
        );
      } else {
        check(false, "the tile shows the crop the box names", "never reached — no moved shot");
      }
      /* Put it back before the pairwise reading, which depends on it. */
      await page.evaluate(`(() => {
        const thumb = document.querySelectorAll(".dpc-face__thumb")[${target.at}].querySelector(".dpc-face__cut");
        thumb.style.setProperty("--dpc-cut-x", ${JSON.stringify(target.cut.x)});
        thumb.style.setProperty("--dpc-cut-y", ${JSON.stringify(target.cut.y)});
      })()`);

      /*
        CONTROL 3 — two features are two pictures.

        Every pair compared. If the arithmetic collapsed — one divisor wrong, a
        position that ignored x and y — every tile would show the same part of
        the frame and this is where that shows up.
      */
      let identical = 0;
      let smallest = Number.POSITIVE_INFINITY;
      for (let a = 0; a < tiles.length; a += 1) {
        for (let b = a + 1; b < tiles.length; b += 1) {
          const delta = await meanAbsoluteDifference(tiles[a].bytes, tiles[b].bytes);
          smallest = Math.min(smallest, delta);
          if (delta < 0.5) identical += 1;
        }
      }
      check(
        identical === 0,
        "no two features photograph as the same tile",
        `${tiles.length} tiles, ${(tiles.length * (tiles.length - 1)) / 2} pairs, closest pair differs by ${smallest.toFixed(2)}`,
      );
    }

    check(spends.length === 0, `${theme}: nothing in this walk spent a credit`, `${spends.length} spend requests on the wire`);
  } finally {
    await browser.close();
  }
}

await writeFile(path.join(OUT, "checks.json"), JSON.stringify(records, null, 2));
print();
if (failures().length > 0) process.exit(1);
process.exit(0);
