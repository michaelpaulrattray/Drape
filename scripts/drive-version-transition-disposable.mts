/**
 * THE VERSION SWITCH, WATCHED FRAME BY FRAME ON A SLOW LINK (fable-686 §3).
 *
 * The founder: the stuck bug feels fixed, but *"it sometimes sticks on a
 * thumbnail for 10 seconds or so until it loads … the transition between
 * versions could feel more graceful/responsive and more polished."*
 *
 * The ten seconds are a 2.6MB frame's honest wire time and cannot be argued
 * away. What CAN be answered is that nothing on screen says so: the small copy
 * arrives in the same frame as the click and then sits there looking like a bad
 * photograph until the real bytes land.
 *
 * So this measures the two things the answer turns on, on Fast 3G, where the
 * founder's own complaint lives:
 *
 *   THE ANSWER    how long after the click the plate is drawing the version he
 *                 clicked (the placeholder budget, ~100 ms — one frame)
 *   THE ARRIVAL   that the soft state is MARKED as one and stops being marked
 *                 when the full frame lands, which is what makes the softness
 *                 read as arriving rather than as a bad picture
 *
 * And the one that is not about feel at all: **a click during an in-flight load
 * wins immediately**, which is the half of "clicks are never gated" that lives
 * in the viewer rather than in the write loop.
 *
 * `--plain` runs the identical drive with the new rule switched off in the
 * page, which is what the build looked like an hour ago — the honest "before"
 * for the founder's eye, since the instant thumbnail itself already shipped.
 *
 * **It buys nothing**: the face scan is held at the wire, and the run declares
 * that for itself.
 *
 *   npx tsx scripts/drive-version-transition-disposable.mts [--plain] [--tile 05]
 */
import "dotenv/config";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { SignJWT } from "jose";

import { openDrivenPage } from "./lib/drivePage.mts";
import { openDatabase } from "./lib/dbConnection.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const BASE = arg("base", process.env.VERIFY_BASE_URL ?? "http://localhost:3000");
const SESSION = arg("session", "0b17d084-ad91-4b4f-955c-45e21703fe05");
const TILE = arg("tile", "");
const PLAIN = process.argv.includes("--plain");
const OUT = path.resolve(`output/version-transition${PLAIN ? "-plain" : ""}`);

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required to mint a session");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await conn.query("SELECT openId FROM users WHERE id = 1") as any[];
await conn.end();
const token = await new SignJWT({ openId: owners[0].openId, appId, name: "Version transition" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { browser, page, faceScan } = await openDrivenPage({
  base: BASE, token, width: 1440, height: 1000, holdFaceScan: true,
});

let failed = 0;
const check = (ok: boolean, name: string, saw: string) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name} — saw: ${saw}`);
  if (!ok) failed += 1;
};

/** One frame of the plate: what it is drawing, and whether it says it is soft. */
const SAMPLER = `(() => {
  window.__frames = [];
  const start = performance.now();
  window.__sampleStart = start;
  const tick = () => {
    const img = document.querySelector(".dpc-viewer__plate img");
    if (img) {
      const src = img.currentSrc || img.src;
      const preview = img.getAttribute("data-preview");
      const last = window.__frames[window.__frames.length - 1];
      /* Transitions only. A sample per frame for thirty seconds is hundreds of
         rows of the same two facts, and the question is WHEN each changed. */
      if (!last || last.src !== src || last.preview !== preview) {
        window.__frames.push({ at: Math.round(performance.now() - start), src, preview });
      }
    }
    if (performance.now() - start < 30000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;

const CHIPS = `(() => Array.from(
  document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick"),
).filter((pick) => pick.tagName === "BUTTON").map((pick) => ({
  label: pick.querySelector("span") ? pick.querySelector("span").textContent.trim() : null,
  frame: pick.getAttribute("data-frame"),
  thumb: pick.getAttribute("data-thumb"),
  lit: pick.getAttribute("aria-pressed") === "true",
})))()`;

type Chip = { label: string | null; frame: string | null; thumb: string | null; lit: boolean };

try {
  if (PLAIN) {
    /* THE BEFORE, honestly named: this build with tonight's one rule off. */
    await page.evaluateOnNewDocument(`(() => {
      const style = document.createElement("style");
      style.textContent = '.dpc-viewer__frame:not([data-wait="true"]) img[data-preview="true"]'
        + ' { filter: none !important; transition: none !important; }';
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
    })()`);
  }

  /* UNTHROTTLED UNTIL THE SHEET IS OPEN. The founder's complaint is about
     SWITCHING versions, not about the first load, and pulling a whole sheet of
     faces over Fast 3G outlasts any protocol timeout. */
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 240_000 });
  /* `networkidle2` is not "the sheet is drawn" — the roll arrives on its own
     query afterwards. A scan for tiles before this wait finds none and reports
     a sheet with no faces on it, which is what the first run of this script
     did. */
  await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 240_000 });

  /*
    THE FACE HAS TO HAVE VERSIONS, and which tile that is cannot be assumed —
    tile 01 on this sheet is a candidate nobody has ever refined, and a drive
    that opened it would report "no chips" as though the rail were broken. So it
    looks: with the scan held, opening a face costs nothing at all.
  */
  const order = TILE === ""
    ? Array.from({ length: 16 }, (_unused, at) => String(at + 1).padStart(2, "0"))
    : [TILE, ...Array.from({ length: 16 }, (_unused, at) => String(at + 1).padStart(2, "0"))];
  let chips: Chip[] = [];
  let openedTile: string | null = null;
  for (const label of order) {
    const tile = await page.$(`button[aria-label="View candidate ${label} larger"]`);
    if (!tile) continue;
    await tile.click();
    await page.waitForSelector(".dpc-viewer__plate img", { timeout: 60_000 }).catch(() => null);
    /* The versions arrive on their own query after the picture — a fixed beat
       here reports a slow answer as no answer, which is this file's own scar. */
    await page.waitForSelector(".dpc-refine__stack .dpc-refine__pick", { timeout: 20_000 })
      .catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 800));
    chips = await page.evaluate(CHIPS) as Chip[];
    console.log(`  tile ${label}: ${chips.length} chip(s)`);
    if (chips.length >= 3) { openedTile = label; break; }
    await page.keyboard.press("Escape");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (openedTile === null) throw new Error("no face on this sheet has three versions to browse");
  console.log(`tile ${openedTile}: ${chips.length} chips, ${chips.filter((chip) => chip.thumb).length} with a small copy`);

  /* NOW his conditions: Fast 3G, the same emulation the version-switch reading
     and the burst sampler use. On this machine a warm 2.6MB PNG decodes before
     the next click lands, so an unthrottled drive certifies a surface nobody
     has. Enabled here so it governs the switch and not the sheet's own load. */
  const client = await page.createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  /*
    TWO DISTANT VERSIONS, NEITHER OF THEM THE ONE ALREADY ON THE PLATE.

    The first run of this drive clicked index 1 for its second click and index 1
    was the LIT chip — re-selecting the version already showing, which correctly
    does nothing, and was reported as "the second click never reached the
    plate". A drive that cannot tell a no-op click from a broken one is not
    measuring the product.
  */
  const litAt = chips.findIndex((chip) => chip.lit);
  const first = chips.length - 1 === litAt ? chips.length - 2 : chips.length - 1;
  /* Preferring a VERSION over the original: the original's full frame is the
     picture the sheet opened on, so it is already decoded and the switch to it
     is instant for a reason that has nothing to do with this change. */
  const second = chips.findIndex((chip, at) => at > 0 && at !== first && at !== litAt && chip.frame) >= 0
    ? chips.findIndex((chip, at) => at > 0 && at !== first && at !== litAt && chip.frame)
    : chips.findIndex((chip, at) => at !== first && at !== litAt && chip.frame);
  if (first < 0 || second < 0) throw new Error("this face has no two unselected versions to click between");
  console.log(`clicking ${chips[first]!.label} then ${chips[second]!.label} (lit was ${chips[litAt]?.label ?? "none"})`);

  await page.evaluate(SAMPLER);
  /* CLICKED IN THE PAGE, TIMED IN THE PAGE. A budget measured from when the
     driver ASKED for a click includes the driver's own round trip, which on
     this harness is tens of milliseconds of somebody else's latency. */
  await page.evaluate(`(() => {
    window.__clicks = window.__clicks || [];
    window.__clicks.push({ at: Math.round(performance.now() - window.__sampleStart) });
    document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick")[${first}].click();
  })()`);
  /* One frame budget, generously: the claim is that the answer is on screen
     before a person could notice the gap, not that it is instantaneous. */
  await new Promise((resolve) => setTimeout(resolve, 250));
  await page.screenshot({ path: path.join(OUT, "01-soft-just-after-the-click.png") as `${string}.png` });

  /* A SECOND CLICK WHILE THE FIRST IS STILL ON THE WIRE. */
  await page.evaluate(`(() => {
    window.__clicks.push({ at: Math.round(performance.now() - window.__sampleStart) });
    document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick")[${second}].click();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  await page.screenshot({ path: path.join(OUT, "02-second-click-owns-the-plate.png") as `${string}.png` });

  /* Rest, measured rather than assumed — a 2.6MB frame on this link is ~13 s. */
  const wanted = chips[second]!.frame;
  let restedAt: number | null = null;
  for (let tick = 0; tick < 60; tick += 1) {
    const now = await page.evaluate(`(() => {
      const img = document.querySelector(".dpc-viewer__plate img");
      return img ? { src: img.currentSrc || img.src, preview: img.getAttribute("data-preview") } : null;
    })()`) as { src: string; preview: string } | null;
    if (now && now.src === wanted && now.preview === "false") { restedAt = tick * 500; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await page.screenshot({ path: path.join(OUT, "03-sharp-when-the-bytes-land.png") as `${string}.png` });

  const frames = await page.evaluate("window.__frames") as Array<{ at: number; src: string; preview: string }>;
  console.log("\nthe plate, transition by transition:");
  for (const one of frames) {
    const which = one.src === chips[first]!.thumb ? `thumb of ${chips[first]!.label}`
      : one.src === chips[first]!.frame ? `FRAME of ${chips[first]!.label}`
      : one.src === chips[second]!.thumb ? `thumb of ${chips[second]!.label}`
      : one.src === chips[second]!.frame ? `FRAME of ${chips[second]!.label}`
      : "(the picture it started on)";
    console.log(`  ${String(one.at).padStart(6)} ms  preview=${one.preview}  ${which}`);
  }

  const clicks = await page.evaluate("window.__clicks") as Array<{ at: number }>;
  const firstAnswer = frames.find((one) => one.src === chips[first]!.thumb);
  /* Either copy counts as an answer: a version already decoded goes straight to
     its full frame, which is the same promise kept faster. */
  const secondAnswer = frames.find((one) => one.at >= (clicks[1]?.at ?? 0)
    && (one.src === chips[second]!.thumb || one.src === chips[second]!.frame));
  check(
    firstAnswer !== undefined && firstAnswer.at - (clicks[0]?.at ?? 0) <= 100,
    "the click is answered inside one frame budget",
    firstAnswer ? `${firstAnswer.at - (clicks[0]?.at ?? 0)} ms from the click to the version's own copy` : "the plate never drew it",
  );
  check(
    PLAIN ? true : firstAnswer?.preview === "true",
    PLAIN ? "(plain run: the soft state is not marked, by construction)" : "and the soft state SAYS it is soft",
    `data-preview=${firstAnswer?.preview ?? "absent"}`,
  );
  check(
    secondAnswer !== undefined && secondAnswer.at - (clicks[1]?.at ?? 0) <= 100,
    "a click during an in-flight load wins immediately",
    secondAnswer
      ? `${secondAnswer.at - (clicks[1]?.at ?? 0)} ms from the second click, while the first was still on the wire`
      : "the second click never reached the plate",
  );
  check(
    restedAt !== null,
    "and the plate comes to rest sharp on the LAST click's full frame",
    restedAt === null ? "never rested in 30 s" : `rested after ~${(restedAt / 1000).toFixed(1)} s, data-preview=false`,
  );
  const stale = frames.filter((one) => one.at > (secondAnswer?.at ?? 0) && one.src === chips[first]!.frame);
  check(
    stale.length === 0,
    "the abandoned version never lands on the plate after it was left",
    `${stale.length} appearance(s) of the first click's frame after the second click`,
  );
} finally {
  await browser.close();
}

console.log(`\nshots in ${OUT}`);
console.log(faceScan.line() ?? "face scan: nothing asked");
console.log(`\n${failed === 0 ? "ALL CHECKS HELD" : `${failed} FAILURE(S)`}`);
process.exit(failed === 0 ? 0 : 1);
