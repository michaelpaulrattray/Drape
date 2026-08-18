/**
 * CLICKING BETWEEN VERSIONS WHILE A RENDER LANDS — his shot 293, reproduced.
 * (fable-581 §2, the sampler arm.)
 *
 * The founder clicked between versions while a refine landed and got a rail
 * that no longer agreed with the picture: a chip showing the ORIGINAL frame
 * that could not be clicked, the edited frame on screen, and no way out of it
 * by clicking.
 *
 * His rows say the database is clean — two versions, both live, the selection
 * on the newest, nothing hidden behind a take
 * (`read-selection-tangle-disposable.mts`). So the tangle is client-side and
 * transient, and the only way to see it is to be there while it happens.
 *
 * This buys ONE render (25 dev credits) and clicks all the way through it,
 * sampling every 1.5s what the rail says and what the photograph says. The
 * invariant under test is the one the highlight work bought (fable-546):
 *
 *   **the lit chip's own frame IS the frame on the plate** — one claim, not two
 *
 * plus the two halves of his report: every delivered version stays clickable,
 * and something is lit once the dust settles. It reloads at the end, because
 * "stuck until refresh" and "stuck forever" are different severities and he
 * asked which one this is.
 *
 *   npx tsx scripts/drive-selection-tangle-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/selection-tangle");
/* A NOVEL ASK EVERY RUN, or the already-true door refuses it for free and the
   sampler measures a window with no landing in it — which is what the second
   run of this did. Passed in rather than fixed. */
const ASK = process.argv[2] ?? "make his hair silver";

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [rows] = await conn.query<Array<{ openId: string; session: string; position: number; id: number }>>(
  `SELECT u.openId AS openId, u.id AS id, s.publicId AS session, c.position AS position
     FROM users u
     JOIN casting_sessions s ON s.userId = u.id
     JOIN casting_candidates c ON c.sessionId = s.id
    WHERE u.openId = 'outside-scope-bot-local' AND c.status = 'ready'
    ORDER BY c.id DESC LIMIT 1`,
);
if (rows.length === 0) throw new Error("the fixture cast is missing");
const { openId, session, position, id: userId } = rows[0]!;
const tile = String(position + 1).padStart(2, "0");
const [before] = await conn.query<Array<{ balance: number }>>(
  "SELECT balance FROM points WHERE userId = ?", [userId],
);

const token = await new SignJWT({ openId, appId, name: "Tangle sampler" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 1000 });

/** One reading of the rail and the picture, taken together. */
const SAMPLE = `(() => {
  const plate = document.querySelector(".dpc-viewer__plate img");
  const rail = document.querySelector(".dpc-refine__stack");
  const picks = rail ? Array.from(rail.querySelectorAll(".dpc-refine__pick")) : [];
  const lit = picks.find((pick) => pick.getAttribute("aria-pressed") === "true") ?? null;
  return {
    plate: plate ? (plate.currentSrc || plate.src) : null,
    chips: picks.map((pick) => ({
      label: pick.querySelector("span")?.textContent?.trim() ?? null,
      pressed: pick.getAttribute("aria-pressed"),
      frame: pick.getAttribute("data-frame"),
      ghost: pick.classList.contains("dpc-refine__pick--ghost"),
      clickable: pick.tagName === "BUTTON" && !pick.disabled,
      shows: pick.querySelector("img")?.getAttribute("src") ?? null,
    })),
    litFrame: lit ? lit.getAttribute("data-frame") : null,
    litThumb: lit ? lit.getAttribute("data-thumb") : null,
    litLabel: lit ? lit.querySelector("span")?.textContent?.trim() ?? null : null,
    waiting: document.querySelector("[data-wait]")?.getAttribute("data-wait") ?? null,
  };
})()`;

type Sample = {
  at: number;
  plate: string | null;
  litFrame: string | null;
  litThumb: string | null;
  litLabel: string | null;
  waiting: string | null;
  chips: Array<{
    label: string | null; pressed: string | null; frame: string | null;
    ghost: boolean; clickable: boolean; shows: string | null;
  }>;
};

const samples: Array<Sample & { note?: string }> = [];
let failed = 0;
const check = (ok: boolean, name: string, saw: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
  if (!ok) failed += 1;
};

try {
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-viewer__plate img", { timeout: 240_000 });
  await page.waitForSelector(".dpc-refine__field", { timeout: 240_000 });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const busy = await page.evaluate(() => Boolean(document.querySelector(".dpc-face__working")));
    if (!busy) break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  const opening = await page.evaluate(SAMPLE) as Sample;
  console.log(`the rail opens with ${opening.chips.length} chips, lit: "${opening.litLabel}"`);

  await page.type(".dpc-refine__field", ASK, { delay: 8 });
  const t0 = Date.now();
  await page.evaluate(`document.querySelector(".dpc-refine__field").closest("form")
    .querySelector("button[type=submit]").click()`);

  /* Click between versions the whole time it renders, exactly as he did. */
  let clicks = 0;
  let landedAt: number | null = null;
  for (let tick = 0; tick < 300; tick += 1) {
    const sample = await page.evaluate(SAMPLE) as Sample;
    const at = Date.now() - t0;
    let note: string | undefined;
    if (tick % 6 === 5) {
      /* Alternate between the original and the newest real version — his own
         "clicking between versions", not a single switch. */
      const target = clicks % 2 === 0 ? 0 : -1;
      const clicked = await page.evaluate(`(() => {
        const picks = Array.from(document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick"))
          .filter((pick) => pick.tagName === "BUTTON");
        const pick = ${target === 0 ? "picks[0]" : "picks[picks.length - 1]"};
        if (!pick) return null;
        pick.click();
        return pick.querySelector("span")?.textContent?.trim() ?? "?";
      })()`) as string | null;
      clicks += 1;
      note = `clicked "${clicked}"`;
    }
    /* `at` AFTER the spread: the sample carries its own field and the measured
       elapsed time is the one this script means. */
    samples.push({ ...sample, at, ...(note ? { note } : {}) });
    if (landedAt === null && sample.chips.filter((chip) => !chip.ghost).length > opening.chips.length) {
      landedAt = at;
      console.log(`the render landed at ${Math.round(at / 1000)}s`);
    }
    if (landedAt !== null && at - landedAt > 25_000) break;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }

  const settled = samples.at(-1)!;
  await page.screenshot({ path: `${OUT}/after-landing.png` });

  /* THE INVARIANT: the lit chip and the photograph are one claim. Sampled while
     the render was out, so a disagreement that lasts one poll is still caught.
     Every chip carries its own frame now, the original included — the first cut
     of this read `null` there and could not tell a legitimate original from a
     tangle. */
  /* THE SMALL COPY IS THE SAME PICTURE. While a full frame decodes the viewer
     draws that version's thumbnail (fable-501 §a), so a sample where the plate
     holds the lit chip's THUMB is agreement, not disagreement — a comparison
     that missed this would report the sharpening as a tangle. */
  const comparable = samples.filter((sample) => sample.litFrame && sample.plate);
  const disagreeing = comparable.filter((sample) =>
    sample.litFrame !== sample.plate && sample.litThumb !== sample.plate);
  check(
    comparable.length > 5,
    "the sampler had something to compare at all",
    `${comparable.length} of ${samples.length} samples had both a lit frame and a plate`,
  );
  check(
    disagreeing.length === 0,
    "the lit chip's frame IS the frame on the plate, throughout",
    disagreeing.length === 0
      ? "no disagreement"
      : `${disagreeing.length} samples disagreed, first at ${disagreeing[0]!.at}ms ("${disagreeing[0]!.litLabel}")`,
  );
  check(
    settled.chips.filter((chip) => !chip.ghost).every((chip) => chip.clickable),
    "every delivered version stays clickable once the dust settles",
    settled.chips.map((chip) => `${chip.label}${chip.ghost ? " (ghost)" : ""}${chip.clickable ? "" : " UNCLICKABLE"}`)
      .join(" · "),
  );
  check(
    settled.chips.some((chip) => chip.pressed === "true"),
    "something is lit at the end — the rail is never pointing at nothing",
    settled.litLabel ? `"${settled.litLabel}"` : "NOTHING is lit",
  );
  check(landedAt !== null, "the render actually landed inside the window", `${landedAt}ms`);

  /* AND THE SEVERITY QUESTION HE ASKED: does a refresh clear it? */
  await page.reload({ waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-viewer__plate img", { timeout: 240_000 });
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  const reloaded = await page.evaluate(SAMPLE) as Sample;
  console.log(`after a reload: ${reloaded.chips.length} chips, lit "${reloaded.litLabel}"`);
  check(
    Boolean(reloaded.litFrame)
      && (reloaded.litFrame === reloaded.plate || reloaded.litThumb === reloaded.plate),
    "a reload leaves the rail and the picture agreeing",
    `lit "${reloaded.litLabel}" · ${reloaded.litFrame === reloaded.plate
      || reloaded.litThumb === reloaded.plate ? "same picture" : "DIFFERENT pictures"}`,
  );
  await page.screenshot({ path: `${OUT}/after-reload.png` });

  await writeFile(`${OUT}/samples.json`, `${JSON.stringify({ opening, samples, settled, reloaded }, null, 2)}\n`);
} finally {
  await browser.close();
}

const [after] = await conn.query<Array<{ balance: number }>>(
  "SELECT balance FROM points WHERE userId = ?", [userId],
);
console.log(`\nledger: ${before[0]!.balance} → ${after[0]!.balance} credits`);
await conn.end();
console.log(failed === 0 ? "all arms passed" : `${failed} arm(s) failed`);
process.exit(failed === 0 ? 0 : 1);
