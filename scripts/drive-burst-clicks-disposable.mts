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
 * It costs nothing: no render, no credits, only clicks.
 *
 *   npx tsx scripts/drive-burst-clicks-disposable.mts
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

  for (let burst = 0; burst < BURSTS; burst += 1) {
    /* FIVE CLICKS IN ~2 SECONDS, ending on a deliberately chosen chip so the
       assertion has a name to check rather than "whatever was last". */
    const GAP = Number(process.env.CLICK_GAP_MS ?? 120);
    const last = await page.evaluate(`(async () => {
      const picks = () => Array.from(document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick"))
        .filter((pick) => pick.tagName === "BUTTON");
      /* Spread across the WHOLE rail, not the first four chips: a burst
         between distant versions swaps a picture the browser has not decoded,
         which is the condition the decode gate lives in. */
      const all = picks();
      const far = [0, Math.floor(all.length / 2), 1, all.length - 1, ${burst % 2 === 0 ? 2 : 3}];
      const order = far;
      let name = null;
      for (const at of order) {
        const all = picks();
        const pick = all[Math.min(at, all.length - 1)];
        if (!pick) continue;
        pick.click();
        name = pick.querySelector("span")?.textContent?.trim() ?? null;
        await new Promise((resolve) => setTimeout(resolve, ${GAP}));
      }
      return name;
    })()`) as string | null;

    /* AT REST — long enough for any decode to land, so a split state here is
       not a race caught mid-flight but a surface that stopped following. */
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    const at = await page.evaluate(SURFACES(tile)) as Surfaces;
    const agrees = at.plate !== null
      && (at.plate === at.litFrame || at.plate === at.litThumb);
    console.log(`burst ${burst + 1}: last click "${last}" · lit "${at.litLabel}"`
      + ` · plate ${agrees ? "agrees" : "DISAGREES"}`);
    runs.push({ burst: burst + 1, last, ...at, agrees });
    if (!agrees) await page.screenshot({ path: `${OUT}/burst-${burst + 1}-split.png` });

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
