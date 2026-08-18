/**
 * HOW MANY OF THE PIXELS SHE PAID FOR DOES SHE ACTUALLY SEE? (M12 row 2)
 *
 * fable-787 §3 ordered the 760px cap lifted alongside hold-to-compare, on the
 * reasoning that a 2K signed view drawn at a third of its pixels is a defect
 * against law 9's own instrument. Before lifting anything I want the number,
 * per surface, because the cap and the *binding* constraint are not necessarily
 * the same thing: at 1440×1000 the sheet viewer's picture measured 310×466,
 * which is nowhere near 760 — so something other than the width cap was
 * deciding, and lifting the cap would have changed nothing while looking like a
 * fix.
 *
 * For every image on the two surfaces that show a paid frame, this records:
 *
 *   natural   the asset's own pixels (what the render cost bought)
 *   drawn     the CSS box it is painted into
 *   device    that box times devicePixelRatio — the pixels the screen can show
 *   ratio     device / natural, which is the fraction actually delivered
 *
 * A ratio at or above 1.0 means every pixel bought is reachable. Below it, the
 * difference is detail that was generated, stored, and then thrown away by the
 * layout — which is the thing worth fixing, and the thing to fix in the RIGHT
 * place.
 *
 * It costs NOTHING: no render, no credits. It loads two pages and measures.
 *
 *   npx tsx scripts/measure-downsample-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";
const OUT = path.resolve("output/downsample");
/** The window the founder's own screenshots are taken at. */
const WIDTH = Number(process.env.W ?? 1440);
const HEIGHT = Number(process.env.H ?? 1000);

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [sheets] = await conn.query<Array<{ openId: string; session: string; position: number }>>(
  `SELECT u.openId AS openId, s.publicId AS session, c.position AS position, COUNT(v.id) AS versions
     FROM users u
     JOIN casting_sessions s ON s.userId = u.id
     JOIN casting_candidates c ON c.sessionId = s.id
     JOIN casting_candidate_variants v ON v.candidateId = c.id AND v.status = 'ready'
    WHERE u.openId = 'outside-scope-bot-local' AND c.status = 'ready'
    GROUP BY c.id HAVING versions >= 2 ORDER BY c.id DESC LIMIT 1`,
);
/* A SIGNED cast, which is where the 2K views live — the sheet only ever shows
   1K candidate frames, so a reading taken there alone would answer the wrong
   question.

   THIS QUERY WAS BROKEN AND ITS EMPTY RESULT WAS PUBLISHED AS A FACT (found
   2026-08-17, shift 84). It selected `m.publicId` and filtered on
   `m.castingV2SignedAt`, and NEITHER COLUMN EXISTS on `models` — so it threw
   `ER_BAD_FIELD_ERROR` for every user alive, the `.catch` below turned that into
   the same empty array an honestly castless bot would produce, and the report
   line "no signed cast for this bot — the 2K half is UNREAD" went into
   `output/downsample/downsample.json` and from there into POST_SIGN_ROADMAP §7.
   A Cast is keyed by `agencyId` and is signed when a candidate points at it
   through `signedCastId`, which is what this now asks. `verify-bot-local` owns
   four of them; the bot this driver signs in as owns none, so the published
   sentence was accidentally true about the wrong thing.

   The catch is kept ONLY because this driver is a one-shot, and it now logs. */
const [rooms] = await conn.query<Array<{ openId: string; cast: string }>>(
  `SELECT u.openId AS openId, m.agencyId AS cast
     FROM users u
     JOIN models m ON m.userId = u.id
     JOIN casting_candidates c ON c.signedCastId = m.id
    WHERE u.openId = 'outside-scope-bot-local' AND m.deletedAt IS NULL
      AND m.status <> 'archived'
    ORDER BY m.id DESC LIMIT 1`,
).catch((error) => {
  console.log(`signed-cast query FAILED (not "no cast"): ${String(error?.message ?? error)}`);
  return [[]] as unknown as [Array<{ openId: string; cast: string }>];
});
await conn.end();

const token = await new SignJWT({ openId: "outside-scope-bot-local", appId, name: "Pixel sampler" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { browser, page } = await openDrivenPage({ base: BASE, token, width: WIDTH, height: HEIGHT });

/** Every painted image on screen, with what it cost and what is shown. */
const MEASURE = `(() => {
  const dpr = window.devicePixelRatio;
  return Array.from(document.images)
    .filter((img) => img.naturalWidth > 0)
    .map((img) => {
      const box = img.getBoundingClientRect();
      if (box.width < 8 || box.height < 8) return null;
      /* The DRAWN box is not the painted area for object-fit: contain — the
         picture is letterboxed inside it. The delivered fraction is decided by
         the smaller of the two axes, which is what contain preserves. */
      const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
      return {
        cls: img.className || "(none)",
        natural: img.naturalWidth + "x" + img.naturalHeight,
        drawn: Math.round(box.width) + "x" + Math.round(box.height),
        dpr,
        ratio: Number((scale * dpr).toFixed(3)),
        src: img.currentSrc.slice(-32),
      };
    })
    .filter(Boolean);
})()`;

const report: Record<string, unknown> = { window: `${WIDTH}x${HEIGHT}` };

try {
  if (sheets.length > 0) {
    const { session, position } = sheets[0]!;
    const tile = String(position + 1).padStart(2, "0");
    await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
    await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
    report.sheetGrid = await page.evaluate(MEASURE);
    await page.click(`button[aria-label="View candidate ${tile} larger"]`);
    await page.waitForSelector(".dpc-viewer__plate img", { timeout: 240_000 });
    await new Promise((r) => setTimeout(r, 2_500));
    report.sheetViewer = await page.evaluate(MEASURE);
  }
  if (rooms.length > 0) {
    await page.goto(`${BASE}/casting/cast/${rooms[0]!.cast}`, { waitUntil: "networkidle2", timeout: 240_000 });
    await new Promise((r) => setTimeout(r, 3_000));
    report.room = await page.evaluate(MEASURE);
    /* And the room's own viewer, which is where a signed view is looked at. */
    const opened = await page.evaluate(`(() => {
      const shot = document.querySelector(".dpc-master__main, .dpc-strip__frame");
      if (!shot) return false;
      shot.click();
      return true;
    })()`);
    if (opened) {
      await new Promise((r) => setTimeout(r, 2_500));
      report.roomViewer = await page.evaluate(MEASURE);
    }
  } else {
    report.room = "no signed cast for this bot — the 2K half is UNREAD";
  }
} finally {
  await writeFile(path.join(OUT, "downsample.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

for (const [surface, rows] of Object.entries(report)) {
  if (!Array.isArray(rows)) { console.log(`${surface}: ${rows}`); continue; }
  console.log(`\n=== ${surface} ===`);
  for (const row of rows as Array<Record<string, unknown>>) {
    console.log(
      `  ratio ${String(row.ratio).padStart(6)}  natural ${String(row.natural).padStart(10)}`
      + `  drawn ${String(row.drawn).padStart(9)}  ${row.cls}`,
    );
  }
}

// A script ends by ending the process (fable-127). Puppeteer's browser is closed
// above, but this file was written after shift 82's suite reading and reddened
// `scriptExitDiscipline` for the next reader — the guard sweeps the FILESYSTEM,
// so an untracked probe is in scope the moment it exists.
process.exit(0);
