/**
 * THE RAIL AFTER fable-753 — the tooltip dies, the captions go, the sentence
 * moves to the composer.
 *
 * Four claims, driven rather than described:
 *
 *   1. no chip carries a hover tooltip — hovered, then read at the attribute;
 *   2. no chip renders any text at all — thumbnails stand blank;
 *   3. the composer shows the SELECTED version's own sentence;
 *   4. `Use` prefills the box with exactly that sentence and SENDS NOTHING —
 *      the field's value is checked, and every outgoing request is watched for
 *      a refine that must not happen.
 *
 * The scan is held at the wire, so this walk buys nothing.
 *
 *   npx tsx scripts/drive-composer-chip-disposable.mts
 *   THEME=light npx tsx scripts/drive-composer-chip-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SignJWT } from "jose";
import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage, createChecks } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/composer-chip");
const THEME = process.env.THEME ?? "dark";

const connection = await openDatabase(process.env.DATABASE_URL!);
const [owners] = await connection.query<any[]>("SELECT openId FROM users WHERE id = 1");
const [rows] = await connection.query<any[]>(
  `SELECT s.publicId AS session, c.position
     FROM casting_candidates c
     JOIN casting_sessions s ON s.id = c.sessionId
     JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE c.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
    GROUP BY c.id HAVING COUNT(v.id) >= 2
    ORDER BY c.id DESC LIMIT 1`,
);
await connection.end();
if (!rows[0]) throw new Error("no candidate with two versions — nothing to read a sentence from");
const session = rows[0].session;
const tile = String(rows[0].position + 1).padStart(2, "0");

const token = await new SignJWT({ openId: owners[0].openId, appId: process.env.VITE_APP_ID!, name: "Composer chip" })
  .setProtectedHeader({ alg: "HS256" }).setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

await mkdir(OUT, { recursive: true });
const { check, print, failures } = createChecks();
const { browser, page, faceScan } = await openDrivenPage({
  base: BASE, token, width: 1500, height: 1000, holdFaceScan: true,
});

/** Every refine this walk causes — none, if `Use` behaves. */
const refines: string[] = [];
page.on("request", (request) => {
  const body = request.postData() ?? "";
  if (/refineCandidate|castingV2\.refine/i.test(`${request.url()} ${body}`)) refines.push(request.url());
});

const read = async () => await page.evaluate(`(() => {
  const picks = Array.from(document.querySelectorAll(".dpc-refine__pick"));
  const made = document.querySelector(".dpc-refine__made");
  const field = document.querySelector(".dpc-refine__field");
  return {
    chips: picks.length,
    titled: picks.filter((pick) => pick.getAttribute("title")).length,
    /* Any text a sighted user could read on a chip. A ring or a ghost is not
       text, so this is the caption claim exactly. */
    captioned: picks.filter((pick) => (pick.textContent ?? "").trim().length > 0).length,
    /* And the screen reader's copy, which must NOT have gone with them. */
    labelled: picks.filter((pick) => (pick.getAttribute("aria-label") ?? "").trim().length > 0).length,
    litLabel: document.querySelector('.dpc-refine__pick[aria-pressed="true"]')?.getAttribute("aria-label") ?? null,
    made: made ? (made.querySelector(".dpc-refine__madeText")?.textContent ?? "").trim() : null,
    field: field ? field.value : null,
  };
})()`) as any;

try {
  await page.evaluateOnNewDocument(`(() => { try { window.localStorage.setItem("drape_theme", ${JSON.stringify(THEME)}); } catch {} })()`);
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-refine__step", { timeout: 120_000 });

  /* Select a VERSION rather than the original — the composer chip is about the
     sentence that made the frame on screen, and the original has none. */
  await page.evaluate(`(() => {
    const picks = Array.from(document.querySelectorAll(".dpc-refine__pick"));
    (picks[1] ?? picks[0]).click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  /* Hover, because the tooltip was hover-revealed and an unhovered chip would
     "pass" this check on a build that still had one. */
  await page.hover(".dpc-refine__pick");
  await new Promise((r) => setTimeout(r, 500));

  const resting = await read();
  await page.screenshot({ path: `${OUT}/1-rail-and-composer-${THEME}.png` });

  check(resting.titled === 0, "no chip carries a hover tooltip", `${resting.chips} chips hovered, ${resting.titled} with a title`);
  check(resting.captioned === 0, "no chip renders any caption", `${resting.captioned} of ${resting.chips} chips carry text`);
  check(
    resting.labelled === resting.chips,
    "and every chip still says its sentence to a screen reader",
    `${resting.labelled} of ${resting.chips} carry an aria-label`,
  );
  check(
    Boolean(resting.made) && resting.made === resting.litLabel,
    "the composer shows the SELECTED version's own sentence",
    `chip says "${resting.litLabel}" · composer says "${resting.made}"`,
  );

  /* THE PREFILL, AND THE SEND THAT MUST NOT HAPPEN. */
  await page.click(".dpc-refine__madeUse");
  await new Promise((r) => setTimeout(r, 800));
  const used = await read();
  await page.screenshot({ path: `${OUT}/2-after-use-${THEME}.png` });

  check(
    used.field === resting.made,
    "`Use` fills the box with exactly that sentence",
    `field is "${used.field}"`,
  );
  check(
    refines.length === 0,
    "and sends NOTHING — spending stays a deliberate act",
    `${refines.length} refine request(s) after Use`,
  );
  check(
    used.made === resting.made,
    "the chip stays put after Use — it is a source, not a one-shot",
    `composer says "${used.made}"`,
  );

  /* The 4× plate for the founder's eye (law 6). */
  await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 4 });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${OUT}/3-composer-4x-${THEME}.png` });

  await writeFile(`${OUT}/readings-${THEME}.json`, JSON.stringify({ resting, used, refines }, null, 2));
  console.log(`face scan: ${faceScan.line()}`);
} finally {
  print();
  await browser.close();
}
process.exit(failures().length > 0 ? 1 : 0);
