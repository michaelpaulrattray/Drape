/**
 * FIVE CLICKS IN TWO SECONDS — the burst arm (fable-609 §1, localized by 610).
 *
 * The founder, live tonight: *"when you click between the thumbnails fast
 * sometimes it doesnt switch image — like the features switch but not the
 * image"*, and then, decisively: *"i can see the image in the casting sheet
 * changing through the blur but just not the image in the refine window."*
 *
 * So the selection MOVES — the sheet's tile, a different reader, follows his
 * clicks — and the viewer's plate specifically is pinned. The shipped arms do
 * not cover this: they sampled through a LANDING with steady clicks, one every
 * nine seconds, and the plate has a decode gate that only bites when a click
 * arrives before the previous one's picture has decoded.
 *
 * This clicks five versions inside two seconds and then reads FOUR surfaces at
 * rest — the plate, the lit chip, the panel's heading, and the sheet tile
 * behind the viewer — asserting they all name the LAST click. Every surface is
 * read from the same DOM at the same instant, so a split state is a fact rather
 * than an impression.
 *
 * # The slow-write arm (fable-701 §4)
 *
 * Reading the surfaces AT REST was never the whole answer. While the serialized
 * writes drain, the server can honestly answer with a version she passed
 * through two clicks ago, and the plate used to stand down for it — the last
 * click won in 15ms, lost the plate for about sixteen seconds, and won again.
 * Every at-rest reading calls that agreement. So each burst is now WATCHED for
 * twenty seconds after the last click's picture first appears, and one sample
 * showing anything else is a comeback.
 *
 * It costs nothing: no render, no credits, only clicks and looking.
 *
 *   npx tsx scripts/drive-burst-clicks-disposable.mts --throttle
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/burst-clicks");
const BURSTS = Number(process.env.BURSTS ?? 4);
const THROTTLE = process.argv.includes("--throttle");

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [rows] = await conn.query<Array<{ openId: string; session: string; position: number; versions: number }>>(
  `SELECT u.openId AS openId, s.publicId AS session, c.position AS position, COUNT(v.id) AS versions
     FROM users u
     JOIN casting_sessions s ON s.userId = u.id
     JOIN casting_candidates c ON c.sessionId = s.id
     JOIN casting_candidate_variants v ON v.candidateId = c.id AND v.status = 'ready'
    WHERE u.openId = 'outside-scope-bot-local' AND c.status = 'ready'
    GROUP BY c.id HAVING versions >= 3 ORDER BY c.id DESC LIMIT 1`,
);
await conn.end();
if (rows.length === 0) throw new Error("no fixture cast with three delivered versions to click between");
const { openId, session, position, versions } = rows[0]!;
const tile = String(position + 1).padStart(2, "0");

const token = await new SignJWT({ openId, appId, name: "Burst sampler" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });

/** All four surfaces, read from one DOM at one instant. */
const SURFACES = (tileLabel: string) => `(() => {
  const rail = document.querySelector(".dpc-refine__stack");
  const picks = rail ? Array.from(rail.querySelectorAll(".dpc-refine__pick")) : [];
  const lit = picks.find((pick) => pick.getAttribute("aria-pressed") === "true") ?? null;
  const plate = document.querySelector(".dpc-viewer__plate img");
  const sheetTile = document.querySelector('button[aria-label="View candidate ${tileLabel} larger"] img');
  return {
    plate: plate ? (plate.currentSrc || plate.src) : null,
    plateComplete: plate ? plate.complete : null,
    litLabel: lit ? lit.querySelector("span")?.textContent?.trim() ?? null : null,
    litFrame: lit ? lit.getAttribute("data-frame") : null,
    litThumb: lit ? lit.getAttribute("data-thumb") : null,
    tile: sheetTile ? (sheetTile.currentSrc || sheetTile.src) : null,
    panel: document.querySelector(".dpc-face__heading, .dpc-refine__keptHeading")?.textContent?.trim() ?? null,
  };
})()`;

type Surfaces = {
  plate: string | null; plateComplete: boolean | null; litLabel: string | null;
  litFrame: string | null; litThumb: string | null; tile: string | null; panel: string | null;
};

let failed = 0;
const check = (ok: boolean, name: string, saw: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
  if (!ok) failed += 1;
};
const runs: Array<Record<string, unknown>> = [];

try {
  /*
    HIS CONDITIONS, NOT MINE (`--throttle`).

    The plate's decode gate only bites when the new frame has NOT decoded yet,
    and on this machine a 2.6MB PNG from a warm cache decodes before the next
    click lands — so an unthrottled burst cannot reach the state he is
    describing. Fast 3G is the same emulation the version-switch reading used.
  */
  if (THROTTLE) {
    const client = await page.createCDPSession();
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-viewer__plate img", { timeout: 240_000 });
  await page.waitForSelector(".dpc-refine__stack .dpc-refine__pick", { timeout: 240_000 });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const busy = await page.evaluate(() => Boolean(document.querySelector(".dpc-face__working")));
    if (!busy) break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  console.log(`${versions} delivered versions on this face — ${versions + 1} chips including the original`);

  /*
    WHAT THE PLATE ACTUALLY DECODES — instrumented from OUT HERE, so the product
    carries no probe. `Image.decode` is the gate the viewer holds its frame on;
    this records every call, when it settled, and whether the caller had already
    given up on it (the effect's own cleanup sets a flag we cannot see, so the
    settle order is the observable half).
  */
  await page.evaluateOnNewDocument(`(() => {
    window.__decodes = [];
    const decode = Image.prototype.decode;
    Image.prototype.decode = function patched() {
      const at = performance.now();
      const src = this.src;
      const entry = { src, at: Math.round(at), settled: null, failed: false };
      window.__decodes.push(entry);
      return decode.call(this).then(
        () => { entry.settled = Math.round(performance.now() - at); },
        (error) => { entry.settled = Math.round(performance.now() - at); entry.failed = true; throw error; },
      );
    };
  })()`);
  await page.reload({ waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-refine__stack .dpc-refine__pick", { timeout: 240_000 });

  for (let burst = 0; burst < BURSTS; burst += 1) {
    /* FIVE CLICKS IN ~2 SECONDS, ending on a deliberately chosen chip so the
       assertion has a name to check rather than "whatever was last". */
    const GAP = Number(process.env.CLICK_GAP_MS ?? 120);
    const lastClick = await page.evaluate(`(async () => {
      const picks = () => Array.from(document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick"))
        .filter((pick) => pick.tagName === "BUTTON");
      /* Spread across the WHOLE rail, not the first four chips: a burst
         between distant versions swaps a picture the browser has not decoded,
         which is the condition the decode gate lives in. */
      const all = picks();
      const far = [0, Math.floor(all.length / 2), 1, all.length - 1, ${burst % 2 === 0 ? 2 : 3}];
      const order = far;
      let name = null;
      let frame = null;
      let thumb = null;
      for (const at of order) {
        const all = picks();
        const pick = all[Math.min(at, all.length - 1)];
        if (!pick) continue;
        pick.click();
        name = pick.querySelector("span")?.textContent?.trim() ?? null;
        /* The chip's OWN pictures, so the watch below knows what "the last
           click" looks like without asking a surface that might be wrong. */
        frame = pick.getAttribute("data-frame");
        thumb = pick.getAttribute("data-thumb");
        await new Promise((resolve) => setTimeout(resolve, ${GAP}));
      }
      return { name, frame, thumb };
    })()`) as { name: string | null; frame: string | null; thumb: string | null };
    const last = lastClick.name;

    /*
      AT REST — and "rest" is measured rather than assumed. Under Fast 3G a
      2.6MB frame needs ~13 seconds of wire time, so a fixed six-second wait
      would call a slow-but-correct swap a failure. This waits for agreement up
      to 30s and REPORTS how long it took, which is the number that says whether
      the picture is stuck or merely arriving.
    */
    let settledAfter: number | null = null;
    let at = await page.evaluate(SURFACES(tile)) as Surfaces;
    for (let tick = 0; tick < 60; tick += 1) {
      at = await page.evaluate(SURFACES(tile)) as Surfaces;
      if (at.plate !== null && (at.plate === at.litFrame || at.plate === at.litThumb)) {
        settledAfter = tick * 500;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const agrees = at.plate !== null
      && (at.plate === at.litFrame || at.plate === at.litThumb);
    console.log(`burst ${burst + 1}: last click "${last}" · lit "${at.litLabel}"`
      + ` · plate ${agrees ? `agreed after ${settledAfter}ms` : "DISAGREES after 30s"}`);
    runs.push({ burst: burst + 1, last, ...at, agrees });
    if (!agrees) {
      await page.screenshot({ path: `${OUT}/burst-${burst + 1}-split.png` });
      const decodes = await page.evaluate("window.__decodes ?? []") as Array<Record<string, unknown>>;
      await writeFile(`${OUT}/burst-${burst + 1}-decodes.json`, `${JSON.stringify(decodes, null, 2)}
`);
      console.log(`  the last six decodes this page asked for:`);
      for (const one of decodes.slice(-6)) {
        console.log(`    …${String(one.src).slice(-24)} at ${one.at}ms`
          + ` · ${one.settled === null ? "NEVER SETTLED" : `settled in ${one.settled}ms`}`
          + `${one.failed ? " (failed)" : ""}`);
      }
    }

    /*
      THE SLOW WRITE — the arm fable-701 §4 attached to the comeback fix.
      -------------------------------------------------------------------

      The state at rest was never the whole reading. A burst puts five writes in
      a queue that runs ONE at a time, and while that queue drains the sheet's
      poll can hear the server honestly answering with a version she passed
      through two clicks ago. Under the old single-URL claim the plate stood
      down for that answer: the last click won in 15ms, LOST the plate for about
      sixteen seconds, and won again when the final write landed. Every reading
      taken at rest says "agreed" through all of it.

      So this watches the plate for twenty seconds AFTER it first shows the last
      click's own picture, and a single sample showing anything else is a
      comeback. Before the frame first appears, a different picture is the
      decode gate holding the previous one — legitimate, and not counted.

      It costs nothing but seconds: no render, no credits, only looking.
    */
    /*
      THE RAIL'S OWN NAMES, so a comeback is a VERSION rather than a URL suffix.

      A hex tail proves nothing about which picture came back — and the first
      run of this arm spent a whole cycle guessing whether a PNG was the last
      click sharpening or an abandoned version returning. The chips answer it:
      every one carries its label and both spellings of its picture.
    */
    const chips = await page.evaluate(`(() => Array.from(
      document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick"),
    ).map((pick) => ({
      label: pick.querySelector("span")?.textContent?.trim() ?? null,
      frame: pick.getAttribute("data-frame"),
      thumb: pick.getAttribute("data-thumb"),
    })))()`) as Array<{ label: string | null; frame: string | null; thumb: string | null }>;
    const nameOf = (url: string | null): string => {
      if (url === null) return "(no picture)";
      const chip = chips.find((one) => one.frame === url || one.thumb === url);
      if (!chip) return `NOT A CHIP ON THIS RAIL — …${url.slice(-26)}`;
      return `"${chip.label}" (${chip.thumb === url ? "small copy" : "full frame"})`;
    };

    const WATCH_MS = Number(process.env.COMEBACK_WATCH_MS ?? 20_000);
    const isLast = (url: string | null) => url !== null
      && (url === lastClick.frame || url === lastClick.thumb);
    /*
      THE PLATE AND THE CHIP, IN ONE SAMPLE — which half moved.

      A comeback can be two entirely different defects wearing one symptom: the
      client's instant-frame override letting go of the plate (the lit chip
      stays on the last click and only the picture moves), or the SERVER
      settling its selection on an earlier write (both surfaces move together,
      which is the fable-609 class and not this one). Recording only the plate
      cannot tell them apart, and one run was spent guessing.
    */
    const trace: Array<{ at: number; plate: string | null; lit: string | null }> = [];
    let arrived = false;
    let comeback: { at: number; plate: string | null } | null = null;
    const watchFrom = Date.now();
    while (Date.now() - watchFrom < WATCH_MS) {
      const read = await page.evaluate(
        `(() => {
           const img = document.querySelector(".dpc-viewer__plate img");
           const lit = Array.from(document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick"))
             .find((pick) => pick.getAttribute("aria-pressed") === "true") ?? null;
           return {
             plate: img ? (img.currentSrc || img.src) : null,
             lit: lit ? (lit.querySelector("span")?.textContent?.trim() ?? null) : null,
           };
         })()`,
      ) as { plate: string | null; lit: string | null };
      const plate = read.plate;
      const sample = { at: Date.now() - watchFrom, plate, lit: read.lit };
      trace.push(sample);
      if (isLast(plate)) arrived = true;
      else if (arrived && comeback === null) comeback = sample;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (comeback) {
      await writeFile(`${OUT}/burst-${burst + 1}-comeback.json`, `${JSON.stringify(trace, null, 2)}\n`);
      await page.screenshot({ path: `${OUT}/burst-${burst + 1}-comeback.png` });
    }
    check(arrived && comeback === null,
      `burst ${burst + 1}: an abandoned version never comes back while the writes drain`,
      arrived
        ? (comeback
          ? `at ${comeback.at}ms the plate was ${nameOf(comeback.plate)}`
          + ` — the last click was "${last}"`
          : `${trace.length} samples over ${WATCH_MS}ms, all the last click's picture`)
        : `the last click's picture never reached the plate in ${WATCH_MS}ms`);

    check(at.litLabel === last,
      `burst ${burst + 1}: the lit chip is the last click`,
      `"${at.litLabel}" vs "${last}"`);
    check(agrees,
      `burst ${burst + 1}: the photograph is the lit chip's own picture`,
      agrees ? "same picture" : `plate …${String(at.plate).slice(-26)} vs chip …${String(at.litFrame).slice(-26)}`);
  }

  await writeFile(`${OUT}/bursts.json`, `${JSON.stringify(runs, null, 2)}\n`);
  await page.screenshot({ path: `${OUT}/at-rest.png` });
} finally {
  await browser.close();
}

console.log(failed === 0 ? "\nall arms passed" : `\n${failed} arm(s) failed`);
process.exit(failed === 0 ? 0 : 1);
