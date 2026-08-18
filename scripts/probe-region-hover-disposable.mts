/**
 * THE FOUNDER'S HOVER BUG, REPRODUCED WITH NUMBERS BEFORE ANYTHING IS TOUCHED
 * (fable-384): *"the bounding boxes showing by smallest first rule wasnt working
 * when i was hovering over her eyes when she was wearing glasses."*
 *
 * Three candidate diagnoses, and this tells them apart:
 *   (a) the hit-test never applies smallest-wins on scan-born boxes
 *   (b) a z-order issue where the glasses box swallows the event
 *   (c) the eye boxes are missing on that face-version, so glasses is the only
 *       target — which would make it a laterality finding, not a hover one
 *
 * It asks the page what is ACTUALLY at the centre of each eye box:
 * `elementFromPoint` is the browser's own hit-test, so the answer is the same
 * one his cursor got.
 *
 * Read-only. No credits, no fal calls beyond the panel's own warm scan.
 */
import "dotenv/config";
import { SignJWT } from "jose";

import { openDrivenPage } from "./lib/drivePage.mts";
import { openDatabase } from "./lib/dbConnection.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const SESSION = "2df4aeab-daa0-4bab-8ce7-d1e2c969510d";
const TILE = "01";

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await conn.query("SELECT openId FROM users WHERE id = 1") as any[];
await conn.end();
const token = await new SignJWT({ openId: owners[0].openId, appId, name: "Hover probe" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });
await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "networkidle2", timeout: 180_000 });
await page.waitForSelector(`button[aria-label="View candidate ${TILE} larger"]`, { timeout: 180_000 });
await page.click(`button[aria-label="View candidate ${TILE} larger"]`);
await page.waitForSelector(".dpc-face", { timeout: 90_000 });
await page.waitForFunction(`document.querySelectorAll(".dpc-regions__box").length > 3`, { timeout: 180_000, polling: 500 })
  .catch(() => null);

const reading = await page.evaluate(`(() => {
  const boxes = Array.from(document.querySelectorAll(".dpc-regions__box")).map((node, at) => {
    const rect = node.getBoundingClientRect();
    return {
      at,
      tag: node.querySelector(".dpc-regions__tag")?.textContent ?? "",
      area: Math.round(rect.width * rect.height),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      node,
    };
  });
  const named = (word) => boxes.filter((box) => box.tag.toLowerCase().includes(word));
  const overlaps = [];
  for (const small of boxes) {
    for (const big of boxes) {
      if (small === big || small.area >= big.area) continue;
      const cx = small.rect.x + small.rect.w / 2;
      const cy = small.rect.y + small.rect.h / 2;
      const inside = cx >= big.rect.x && cx <= big.rect.x + big.rect.w
        && cy >= big.rect.y && cy <= big.rect.y + big.rect.h;
      if (!inside) continue;
      const hit = document.elementFromPoint(cx, cy);
      const hitBox = hit ? hit.closest(".dpc-regions__box") : null;
      /*
        THE CRITERION IS THE SMALLEST BOX CONTAINING THE POINT, not the smaller
        of this pair — and the first version of this probe got that wrong. The
        centre of the glasses box is where her NOSE is, and the nose is smaller
        than both: a rule that handed that point to the glasses would be the bug,
        not the fix. Three "failures" in the first reading after the fix were
        this instrument, and they are why the criterion is derived here.
      */
      const containing = boxes.filter((box) =>
        cx >= box.rect.x && cx <= box.rect.x + box.rect.w
        && cy >= box.rect.y && cy <= box.rect.y + box.rect.h);
      const smallest = containing.reduce((held, box) => (box.area < held.area ? box : held), containing[0]);
      overlaps.push({
        smaller: small.tag,
        smallerArea: small.area,
        larger: big.tag,
        largerArea: big.area,
        at: { x: Math.round(cx), y: Math.round(cy) },
        expected: smallest.tag,
        hitTag: hitBox ? (hitBox.querySelector(".dpc-regions__tag")?.textContent ?? "?") : (hit ? hit.className : "nothing"),
        smallestWins: hitBox === smallest.node,
      });
    }
  }
  return {
    boxes: boxes.map(({ node, ...rest }) => rest),
    eyes: named("eye").length,
    glasses: named("glasses").length,
    overlaps,
  };
})()`) as any;

console.log(`boxes drawn: ${reading.boxes.length} — eye boxes ${reading.eyes}, glasses boxes ${reading.glasses}`);
for (const box of reading.boxes) {
  console.log(`  #${String(box.at).padStart(2)} ${box.tag.padEnd(18)} ${String(box.area).padStart(7)} px²  ${box.rect.w}x${box.rect.h}@${box.rect.x},${box.rect.y}`);
}
console.log(`\ncontained overlaps: ${reading.overlaps.length}`);
let broken = 0;
for (const overlap of reading.overlaps) {
  if (!overlap.smallestWins) broken += 1;
  console.log(
    `  ${overlap.smallestWins ? "ok  " : "FAIL"} centre of "${overlap.smaller}" (${overlap.smallerArea}px²) `
    + `inside "${overlap.larger}" (${overlap.largerArea}px²) → the browser hits "${overlap.hitTag}"`,
  );
}
console.log(`\n${broken} of ${reading.overlaps.length} contained overlaps hand the point to the LARGER box.`);
await browser.close();
process.exit(0);
