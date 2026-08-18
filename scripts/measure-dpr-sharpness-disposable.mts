/**
 * THE SHARPNESS AUDIT THE FOUNDER ORDERED, AT THE VALUE HE ORDERED IT AT.
 *
 * His ruling (POST_SIGN_ROADMAP §7, 2026-08-16, from his own report *"why do the
 * images look so pixelated?"*):
 *
 *   > audit every surface's displayed size × devicePixelRatio against the asset
 *   > it serves; where a 320 px thumb is stretched past ~1:1 device pixels,
 *   > serve the full frame instead.
 *
 * # Why this exists when a downsample probe already did
 *
 * `measure-downsample-disposable.mts` answered the OPPOSITE question (M12 row 2:
 * how many bought pixels does the layout throw away) and answered it with
 * **`deviceScaleFactor` pinned at 1**, which is the one value at which no asset
 * can be stretched at all. A sharpness verdict taken there cannot disagree with
 * itself. Both questions are the same measurement read in two directions, so
 * this takes it once, at 1 AND 2, and reports both:
 *
 *   ratio = (drawn CSS box ÷ the asset's natural pixels) × devicePixelRatio
 *
 *   ratio > 1   the screen has more pixels than the asset — it is being
 *               STRETCHED. This is "pixelated", and which fix reaches it
 *               depends entirely on WHICH asset is stretched (see verdicts).
 *   ratio < 1   the asset has more pixels than the screen shows — detail
 *               generated, stored and discarded by the layout (M12 row 2).
 *
 * # The verdict column, which is the point
 *
 *   cheap-fix-applies   a THUMB (≤320 px longest side) stretched past 1.0.
 *                       Serving the full frame here delivers real pixels — this
 *                       is exactly the fix he ruled.
 *   needs-real-fix      a FULL FRAME stretched past 1.0. No substitution
 *                       reaches it; the asset itself is too small, which is the
 *                       upscaler he NOTED but did not rule.
 *   ok                  at or under 1.0 — every device pixel has an asset pixel.
 *
 * Reporting the split is the deliverable. This roadmap item has already produced
 * one fix aimed at a limit that did not bind (the withdrawn 760 px cap lift);
 * shipping a thumb swap onto surfaces whose problem is the frame would be the
 * same mistake in the same line.
 *
 * # Three ways this instrument could lie, and what stops each
 *
 * 1. **It might not be able to say "stretched" at all.** So it measures two
 *    INJECTED controls on every page: a 32×32 image drawn at 200 px (must be
 *    flagged) and the same image drawn at 32 px (must not be, at dpr 1). If
 *    either control disagrees, the run FAILS and no verdict is reported.
 * 2. **A surface might be empty**, and zero images reads exactly like zero
 *    problems. Every surface therefore records its image COUNT, and a surface
 *    that painted nothing is reported as UNREAD, never as clean.
 * 3. **It could spend house money.** The face scan is aborted at the wire
 *    (`holdFaceScan: true`), so no segmenter call can leave the browser, and the
 *    harness prints what it saw.
 *
 * Costs NOTHING: no render, no credits, no vision call. It loads pages and
 * measures the images already on them.
 *
 *   npx tsx scripts/measure-dpr-sharpness-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";
const OUT = path.resolve("output/sharpness");
const WIDTH = Number(process.env.W ?? 1440);
const HEIGHT = Number(process.env.H ?? 1000);
/** The bot the verify skill names, and the only one holding a SIGNED Cast. */
const BOT = process.env.BOT_OPEN_ID ?? "verify-bot-local";

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required");

/* ---------------------------------------------------------------- fixtures */

const conn = await openDatabase(process.env.DATABASE_URL!);

const [sessions] = await conn.query<Array<{ session: string; n: number }>>(
  `SELECT s.publicId AS session, COUNT(c.id) AS n
     FROM casting_sessions s
     JOIN users u ON u.id = s.userId
     JOIN casting_candidates c ON c.sessionId = s.id AND c.status IN ('ready','signed')
    WHERE u.openId = ? GROUP BY s.id ORDER BY s.id DESC LIMIT 1`,
  [BOT],
);

/*
  A SIGNED Cast, which is where the 2K package views live.

  The predecessor probe asked for this with `m.publicId` and `m.castingV2SignedAt`
  — NEITHER COLUMN EXISTS on `models` — inside a `.catch(() => [[]])`, and printed
  the empty result as "no signed cast for this bot — the 2K half is UNREAD". The
  product keys a Cast by `agencyId` and marks it signed by a candidate pointing at
  it through `signedCastId`, which is what this asks. There is no catch: a query
  that cannot run should stop the audit, not quietly become a fact about the world.
*/
const [casts] = await conn.query<Array<{ agencyId: string; name: string | null }>>(
  `SELECT m.agencyId, m.name
     FROM models m
     JOIN users u ON u.id = m.userId
     JOIN casting_candidates c ON c.signedCastId = m.id
    WHERE u.openId = ? AND m.deletedAt IS NULL AND m.status <> 'archived'
    ORDER BY m.id DESC LIMIT 1`,
  [BOT],
);

const [boards] = await conn.query<Array<{ id: number }>>(
  `SELECT b.id FROM boards b JOIN users u ON u.id = b.userId
    WHERE u.openId = ? AND b.thumbnailUrl IS NOT NULL AND b.status = 'active'
    ORDER BY b.id DESC LIMIT 1`,
  [BOT],
);

await conn.end();

console.log(`fixtures — session ${sessions[0]?.session ?? "NONE"} · signed cast `
  + `${casts[0]?.agencyId ?? "NONE"} · board ${boards[0]?.id ?? "NONE"}`);

/* ------------------------------------------------------------- measurement */

/**
 * Every painted picture, plus the two injected controls.
 *
 * `object-fit: contain` letterboxes the picture inside its box, so the delivered
 * fraction is decided by the SMALLER axis — measuring the box alone would
 * overstate what the screen actually asks of the asset.
 *
 * TWO SOURCES, because one of them is invisible to the obvious collector.
 * `document.images` holds `<img>` only: a picture painted as a CSS
 * `background-image` is not in it, and a surface that paints that way would
 * measure zero images and read as "nothing stretched here". The verify skill
 * already warns about this class for a different reason. So the sweep also
 * walks every element whose computed `background-image` carries a `url(...)`,
 * loads that URL to learn its natural size, and measures it the same way.
 *
 * And everything is DECODED before it is measured. The first run of this probe
 * failed its own controls because an injected data URI had not decoded yet:
 * `naturalWidth` 0 makes the ratio Infinity, which crosses the evaluate boundary
 * as `null` and reads like a missing number rather than an unloaded picture.
 */
const MEASURE = `(async () => {
  const dpr = window.devicePixelRatio;

  /* The controls are injected, measured and removed inside one evaluation, so
     nothing is left on a page a later surface might reuse. A 32x32 red square
     as a data URI — no network, no cache, no storage. */
  const PIXELS = "data:image/gif;base64,R0lGODlhIAAgAIAAAP8AAAAAACH5BAAAAAAALAAAAAAgACAAAAIfhI+py+0Po5y02ouz3rz7D4biSJbmiabqyrbuC8dHAQA7";
  const controls = [];
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-9999px;top:0";
  document.body.appendChild(holder);
  for (const side of [200, 32]) {
    const probe = document.createElement("img");
    probe.src = PIXELS;
    probe.style.cssText = "width:" + side + "px;height:" + side + "px";
    probe.setAttribute("data-control", String(side));
    holder.appendChild(probe);
    controls.push(probe);
  }

  /* Decode before measuring, or an undecoded picture reports natural 0 and an
     infinite ratio — which is what broke this probe's first run.

     Every decode is RACED against a timer. A picture whose bytes never arrive
     leaves decode() pending forever, and a sweep that awaits one of those in a
     loop stops being a measurement and becomes a hang — which is what happened
     on the models library, where the whole evaluation timed out. */
  const decoded = (img) => Promise.race([
    img.decode().then(() => true).catch(() => false),
    new Promise((r) => setTimeout(() => r(false), 3000)),
  ]);
  await Promise.all(controls.map(decoded));

  const read = (img, box, natural) => {
    box = box || img.getBoundingClientRect();
    const nw = natural ? natural.w : img.naturalWidth;
    const nh = natural ? natural.h : img.naturalHeight;
    if (!nw || !nh) return null;
    const scale = Math.min(box.width / nw, box.height / nh);
    const longest = Math.max(nw, nh);
    const ratio = Number((scale * dpr).toFixed(3));
    return {
      cls: (typeof img.className === "string" && img.className) || "(none)",
      natural: nw + "x" + nh,
      drawn: Math.round(box.width) + "x" + Math.round(box.height),
      device: Math.round(box.width * dpr) + "x" + Math.round(box.height * dpr),
      dpr,
      ratio,
      /* An asset at or under the thumbnail's own longest side IS a thumbnail as
         far as the screen is concerned, whatever it is called. Classifying on
         the pixels rather than the URL keeps the verdict about the picture. */
      asset: longest <= 320 ? "thumb" : "frame",
      verdict: ratio <= 1 ? "ok" : (longest <= 320 ? "cheap-fix-applies" : "needs-real-fix"),
      src: (img.currentSrc || "").slice(-28),
    };
  };

  const control = controls.map((img) => ({ side: img.getAttribute("data-control"), ...read(img) }));
  holder.remove();

  const images = [];
  const shown = Array.from(document.images).filter((img) => {
    if (img.hasAttribute("data-control")) return false;
    const box = img.getBoundingClientRect();
    return box.width >= 8 && box.height >= 8;
  });
  await Promise.all(shown.map(decoded));
  for (const img of shown) {
    const row = read(img, img.getBoundingClientRect(), null);
    if (row) images.push({ ...row, via: "img" });
  }

  /* THE HALF document.images CANNOT SEE. A background-image has no natural
     size on the element, so the URL is loaded (from cache — it is already
     painted) purely to ask what it measures. */
  const painted = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const value = getComputedStyle(el).backgroundImage;
    if (!value || value === "none" || !value.includes("url(")) continue;
    const box = el.getBoundingClientRect();
    if (box.width < 8 || box.height < 8) continue;
    const url = (value.match(/url\\(["']?([^"')]+)["']?\\)/) || [])[1];
    if (!url || url.startsWith("data:")) continue;
    painted.push({ el, box, url });
  }
  /* One probe per DISTINCT url, however many elements paint it — a repeated
     background would otherwise be fetched once per element. */
  const sizes = new Map();
  await Promise.all([...new Set(painted.map((p) => p.url))].slice(0, 40).map(async (url) => {
    const probe = new Image();
    probe.src = url;
    await decoded(probe);
    if (probe.naturalWidth) sizes.set(url, { w: probe.naturalWidth, h: probe.naturalHeight });
  }));
  const backgrounds = [];
  for (const p of painted) {
    const natural = sizes.get(p.url);
    if (!natural) continue;
    const row = read(p.el, p.box, natural);
    if (row) backgrounds.push({ ...row, via: "background", src: p.url.slice(-28) });
  }

  return { dpr, control, images: images.concat(backgrounds) };
})()`;

/* ------------------------------------------------------------------- sweep */

type Row = Record<string, unknown>;
type Surface = { name: string; images: Row[]; control: Row[]; note?: string };

const report: { window: string; passes: Array<{ dpr: number; surfaces: Surface[] }> } = {
  window: `${WIDTH}x${HEIGHT}`,
  passes: [],
};

const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * WAIT ON THE PICTURES, NEVER ON THE CLOCK — the reading that cost this probe
 * its first sweep.
 *
 * Fixed settles of 2.5–5 s measured LOADING SKELETONS: the screenshots of the
 * casting sheet and the boards view show eight and six empty grey tiles, and the
 * sweep dutifully reported "1 picture, nothing stretched" from a page that had
 * painted no photograph at all. An empty surface and an unfinished one produce
 * the same number, and only one of them is a fact about the product.
 *
 * So this polls until the count of decoded, visible pictures has STOPPED
 * MOVING, and returns what it waited for. A surface that never paints returns
 * zero with the full wait behind it, which is then reported as UNREAD rather
 * than as clean.
 */
async function waitForPictures(page: Awaited<ReturnType<typeof openDrivenPage>>["page"], maxMs = 120_000) {
  /*
    THE PRODUCT'S OWN "STILL LOADING" MARKER, asked rather than guessed at.

    Every lobby surface renders `animate-pulse` blocks while its query is in
    flight (`HomeView`, `BoardsView`, `LibraryView`). Waiting for picture counts
    to stabilise is not enough on those pages, because the avatar is a picture,
    it arrives immediately, and one stable picture over a page of grey tiles
    looks exactly like a finished surface with one photograph on it. The
    screenshots caught this: the boards view and the models library were BOTH
    measured mid-skeleton, and reported clean.
  */
  const STATE = `(() => ({
    pulsing: document.querySelectorAll(".animate-pulse").length,
    pictures: Array.from(document.images).filter((i) => i.naturalWidth > 0
      && i.getBoundingClientRect().width >= 8).length,
  }))()`;
  const started = Date.now();
  let last = -1;
  let stable = 0;
  let pulsing = 0;
  while (Date.now() - started < maxMs) {
    const state = (await page.evaluate(STATE)) as { pulsing: number; pictures: number };
    pulsing = state.pulsing;
    if (state.pictures === last && state.pictures > 0 && state.pulsing === 0) stable += 1;
    else stable = 0;
    last = state.pictures;
    /* Three quiet polls in a row with no skeleton left: enough that a grid
       filling in one tile at a time is not mistaken for a finished page. */
    if (stable >= 3) break;
    await settle(700);
  }
  return { pictures: last, waitedMs: Date.now() - started, pulsing };
}

await mkdir(OUT, { recursive: true });

for (const dpr of [1, 2]) {
  const token = await new SignJWT({ openId: BOT, appId, name: "Sharpness audit" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));

  const { browser, page } = await openDrivenPage({
    base: BASE, token, width: WIDTH, height: HEIGHT, deviceScaleFactor: dpr, holdFaceScan: true,
  });

  const surfaces: Surface[] = [];
  /**
   * `awaitSelector` is the surface's OWN thing, waited on before the pictures.
   *
   * Stability alone is not enough and the second sweep proved it: the casting
   * sheet at dpr 2 held at ONE picture (the avatar) for three quiet polls while
   * its tiles were still being fetched, so the wait returned on a page that had
   * loaded nothing it was there to measure — and the viewer step then found no
   * tile to click. A count that is stable and a count that is finished are
   * different facts.
   */
  const take = async (name: string, note?: string, awaitSelector?: string) => {
    if (awaitSelector) {
      await page.waitForSelector(awaitSelector, { timeout: 120_000 }).catch(() => null);
    }
    const waited = await waitForPictures(page);
    note = `${note ? note + " · " : ""}waited ${(waited.waitedMs / 1000).toFixed(1)}s`
      + ` for ${waited.pictures} picture(s) to settle`
      /* A surface still pulsing at the timeout is NOT a finished reading, and it
         says so in its own row rather than in a footnote nobody reads. */
      + (waited.pulsing > 0 ? ` · ⚠ STILL PULSING (${waited.pulsing}) at timeout` : "");
    const seen = (await page.evaluate(MEASURE)) as { dpr: number; control: Row[]; images: Row[] };
    if (seen.dpr !== dpr) throw new Error(`asked for dpr ${dpr}, the page reports ${seen.dpr}`);
    /*
      A SCREENSHOT OF EVERY SURFACE MEASURED (law 9, and doctrine's own rule that
      a count is not a sighting). "0 images" and "the collector is blind here"
      produce the same number; only the frame tells them apart, and these go in
      front of eyes before any verdict is believed.
    */
    const shot = path.join(OUT, `dpr${dpr}-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`);
    await page.screenshot({ path: shot as `${string}.png` }).catch(() => null);
    surfaces.push({ name, images: seen.images, control: seen.control, note });
    console.log(`  ${name}: ${seen.images.length} picture(s) at dpr ${seen.dpr}`
      + ` (${seen.images.filter((i) => i.via === "background").length} as background)`);
  };

  try {
    console.log(`\n=== PASS dpr ${dpr} ===`);

    await page.goto(`${BASE}/app`, { waitUntil: "networkidle2", timeout: 240_000 });
    await take("lobby /app");

    await page.goto(`${BASE}/app/models`, { waitUntil: "networkidle2", timeout: 240_000 });
    await take("lobby /app/models");

    await page.goto(`${BASE}/app/boards`, { waitUntil: "networkidle2", timeout: 240_000 });
    await take("lobby /app/boards");

    if (boards[0]) {
      await page.goto(`${BASE}/app/board/${boards[0].id}`, { waitUntil: "networkidle2", timeout: 240_000 });
      await take(`board canvas /app/board/${boards[0].id}`);
    }

    if (sessions[0]) {
      await page.goto(`${BASE}/casting/s/${sessions[0].session}`, { waitUntil: "networkidle2", timeout: 240_000 });
      await take("casting sheet grid", undefined, 'button[aria-label^="View candidate"]');
      /* The viewer is where a paid frame is actually looked at. Open whichever
         tile the sheet offers rather than guessing a position. */
      const opened = await page.evaluate(`(() => {
        const tile = document.querySelector('button[aria-label^="View candidate"]');
        if (!tile) return null;
        tile.click();
        return tile.getAttribute("aria-label");
      })()`);
      if (opened) {
        await page.waitForSelector(".dpc-viewer__plate img", { timeout: 120_000 }).catch(() => null);
        await take("casting sheet viewer", `opened via ${opened}`);
      } else {
        surfaces.push({ name: "casting sheet viewer", images: [], control: [], note: "UNREAD — no tile button found" });
      }
    }

    if (casts[0]) {
      await page.goto(`${BASE}/casting/cast/${casts[0].agencyId}`, { waitUntil: "networkidle2", timeout: 240_000 });
      await take(`cast room (SIGNED ${casts[0].agencyId})`, undefined, ".dpc-master__main, .dpc-strip__frame");
      const opened = await page.evaluate(`(() => {
        const shot = document.querySelector(".dpc-master__main, .dpc-strip__frame");
        if (!shot) return false;
        shot.click();
        return true;
      })()`);
      if (opened) {
        await take("cast room viewer");
      } else {
        surfaces.push({ name: "cast room viewer", images: [], control: [], note: "UNREAD — no frame to click" });
      }
    } else {
      surfaces.push({ name: "cast room", images: [], control: [], note: "UNREAD — bot owns no signed Cast" });
    }
  } finally {
    report.passes.push({ dpr, surfaces });
    await browser.close();
  }
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "sharpness.json"), JSON.stringify(report, null, 2));

/* --------------------------------------------------------------- the verdict */

/*
  THE CONTROLS ARE CHECKED BEFORE ANY FINDING IS PRINTED (working law 2).

  The 200 px arm must be flagged at every dpr — a 32 px asset drawn at 200 px is
  stretched 6.25x and there is no reading of the product in which that is fine.
  The 32 px arm must be clean at dpr 1 and flagged at dpr 2, which is the
  instrument demonstrating that dpr is the variable under test rather than a
  number carried along beside it.
*/
let armed = true;
console.log("\n=== INSTRUMENT CONTROLS ===");
for (const pass of report.passes) {
  const control = pass.surfaces.find((s) => s.control.length === 2)?.control ?? [];
  const big = control.find((c) => c.side === "200");
  const small = control.find((c) => c.side === "32");
  const bigOk = big?.verdict === "cheap-fix-applies";
  const smallOk = pass.dpr === 1 ? small?.verdict === "ok" : small?.verdict === "cheap-fix-applies";
  console.log(`  dpr ${pass.dpr}  32px asset at 200px → ratio ${big?.ratio} ${bigOk ? "FLAGGED ✓" : "NOT FLAGGED ✗"}`);
  console.log(`  dpr ${pass.dpr}  32px asset at  32px → ratio ${small?.ratio} `
    + `${smallOk ? (pass.dpr === 1 ? "clean ✓" : "FLAGGED ✓ (dpr is the variable)") : "unexpected ✗"}`);
  if (!bigOk || !smallOk) armed = false;
}
if (!armed) {
  console.log("\nINSTRUMENT FAILED ITS OWN CONTROLS — no verdict is reported.");
  process.exit(1);
}

console.log("\n=== FINDINGS ===");
for (const pass of report.passes) {
  console.log(`\n--- dpr ${pass.dpr} ---`);
  for (const surface of pass.surfaces) {
    if (surface.images.length === 0) {
      console.log(`  ${surface.name.padEnd(34)} UNREAD — ${surface.note ?? "painted no image"}`);
      continue;
    }
    const worst = [...surface.images].sort((a, b) => Number(b.ratio) - Number(a.ratio))[0]!;
    const cheap = surface.images.filter((i) => i.verdict === "cheap-fix-applies").length;
    const real = surface.images.filter((i) => i.verdict === "needs-real-fix").length;
    console.log(
      `  ${surface.name.padEnd(34)} ${String(surface.images.length).padStart(2)} img · `
      + `worst ratio ${String(worst.ratio).padStart(6)} (${worst.asset} ${worst.natural} → ${worst.drawn} CSS)`
      + ` · cheap ${cheap} · real ${real}`,
    );
  }
}

/* The one field the totals below read, named rather than spread: a `Row` is an
   index signature, and spreading one into a literal loses it. */
const all = report.passes.flatMap((p) => p.surfaces.flatMap(
  (s) => s.images.map((i) => ({ dpr: p.dpr, verdict: i.verdict })),
));
console.log(`\ntotals — ${all.length} measurements · `
  + `cheap-fix-applies ${all.filter((i) => i.verdict === "cheap-fix-applies").length} · `
  + `needs-real-fix ${all.filter((i) => i.verdict === "needs-real-fix").length} · `
  + `ok ${all.filter((i) => i.verdict === "ok").length}`);
console.log(`written: ${path.join(OUT, "sharpness.json")}`);

process.exit(0);
