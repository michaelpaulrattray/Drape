/**
 * §6.1's PROVENANCE LABEL, PHOTOGRAPHED ON THE REAL PANEL — *"as dressed"*
 * (design `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §6.1, from §8.2; ruled
 * fable-1467 as part (b), which sent it here because it is *"a thing a PERSON
 * READS on a surface"*).
 *
 * The reading is a DIFFERENCE, and everything but the path is held equal: the
 * same slot, the same words, the same geometry, seeded onto one candidate of a
 * WARDROBE roll and one candidate of a BASICS roll in the same session. The
 * label appears on one and not the other, and the only variable is the path the
 * roll was cast on.
 *
 * ⚠ **THE LIBRARY ROW IS PLANTED, AND THIS SAYS SO RATHER THAN LOOKING LIKE A
 * FINDING.** No cast on either path has ever been refined in dev, so no
 * `build` row exists to draw — and `facePanel`'s own rule is *no box, no row*,
 * so an unedited build draws nothing at all. What is planted is exactly what a
 * paid build edit would have written; what is REAL is everything the label
 * depends on — the catalogue's `pathProvenance`, the one wardrobe owner's
 * resolution, the server projection, the component and the stylesheet.
 * Declared under the fidelity law rather than presented as a live reading.
 *
 * It cleans up after itself: the seeded rows are deleted in a `finally`, and
 * the run REFUSES to start if a row it would plant is already there — so a
 * crashed run cannot leave a fixture behind that a later reader mistakes for
 * production data.
 *
 *   npx tsx scripts/drive-two-paths-panel-label.mts
 */
import "dotenv/config";

import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { SignJWT } from "jose";

import type { Page } from "puppeteer-core";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage, createChecks } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3010";
const OUT = "output/two-paths-toggle";
const OPEN_ID = process.env.PATHS_OPEN_ID ?? "outside-scope-bot-local";
const SESSION = process.env.PATHS_SESSION ?? "6d7d455f-5e11-4542-bf71-c5730d207200";

/* Read off the dev database rather than guessed: position 3 of roll 4 (the
   caveman, Wardrobe) and position 0 of roll 3 (the woman, Basics). */
const WARDROBE_CANDIDATE = process.env.PATHS_WARDROBE_CANDIDATE ?? "c781013f-e125-43fe-9a61-bc6e317ee554";
const BASICS_CANDIDATE = process.env.PATHS_BASICS_CANDIDATE ?? "e027130b-151c-46c9-af14-9882cabd491e";

/** The one thing held equal across the two paths. */
const SEEDED_WORDS = ["narrower shoulders"];

/**
 * WHETHER THIS RUN IS THE POSITIVE SIDE OF SURFACE 9, and it exists because a
 * copy change that ships unphotographed on the side that CHANGED is the thing
 * this pack is for.
 *
 * The account that has the paths is not on the repaint road in dev
 * (`CASTING_REPAINT_SCOPE` is `users:1` and this is 28601), so an ordinary run
 * photographs the CONTROL — today's sentence, correct for this account. Start
 * the server with that account inside the repaint scope as well and set this,
 * and the same walk photographs the sentence a pathed customer on the repaint
 * road will actually read.
 *
 * It is an ASSERTION about what should be on screen rather than a mode switch:
 * a run that sets it and finds the old sentence FAILS, which is what stops it
 * being a way of making the driver agree with whatever it found.
 */
const EXPECT_WARDROBE_EDITS = process.env.PATHS_EXPECT_WARDROBE_EDITS === "1";

const { check, records, failures, print } = createChecks();

await mkdir(OUT, { recursive: true });

const db = await openDatabase();
const planted: number[] = [];

async function candidateRow(publicId: string): Promise<{ id: number; userId: number; path: string; position: number }> {
  const [rows] = await db.query(
    `SELECT c.id, s.userId, r.path, c.position
       FROM casting_candidates c
       JOIN casting_rolls r ON r.id = c.rollId
       JOIN casting_sessions s ON s.id = r.sessionId
      WHERE c.publicId = ? LIMIT 1`,
    [publicId],
  );
  const row = (rows as { id: number; userId: number; path: string | null; position: number }[])[0];
  if (!row) throw new Error(`no candidate ${publicId} in this database`);
  if (row.path === null) throw new Error(`candidate ${publicId} is on an UNPATHED roll — this driver needs one of each path`);
  return { id: row.id, userId: row.userId, path: row.path, position: row.position };
}

/**
 * ONE `build` ROW, AS THE MINT WOULD HAVE WRITTEN IT.
 *
 * `variantId: NULL` — master-minted, which is what "she came with it" means and
 * is the state a fresh cast is in. `role: "carry"` and a real bounding box,
 * because `facePanel` draws a row only where there is a rectangle to point at.
 */
async function plant(candidateId: number, userId: number): Promise<void> {
  const [existing] = await db.query(
    `SELECT id FROM casting_reference_library WHERE candidateId = ? AND slot = 'build' LIMIT 1`,
    [candidateId],
  );
  if ((existing as unknown[]).length > 0) {
    throw new Error(
      `candidate ${candidateId} ALREADY has a build row — refusing to plant on top of it. `
      + `If a previous run of this driver crashed, delete its row before re-running.`,
    );
  }
  const [result] = await db.query(
    `INSERT INTO casting_reference_library
       (publicId, userId, candidateId, variantId, role, slot, tier, noun, words,
        bboxX, bboxY, bboxW, bboxH, frameWidth, frameHeight, version, createdAt)
     VALUES (?, ?, ?, NULL, 'carry', 'build', 'anatomy', 'build', ?,
             180, 700, 660, 800, 1024, 1536, 1, NOW())`,
    [randomUUID(), userId, candidateId, JSON.stringify(SEEDED_WORDS)],
  );
  planted.push((result as unknown as { insertId: number }).insertId);
}

async function readBuildRow(page: Page): Promise<{ present: boolean; words: string | null; provenance: string | null }> {
  return page.evaluate(() => {
    for (const row of Array.from(document.querySelectorAll<HTMLElement>(".dpc-face__row"))) {
      const name = (row.querySelector(".dpc-face__name")?.textContent ?? "").trim();
      if (name !== "Build") continue;
      return {
        present: true,
        words: row.querySelector(".dpc-face__words")?.textContent ?? null,
        provenance: row.querySelector(".dpc-face__provenance")?.textContent ?? null,
      };
    }
    return { present: false, words: null, provenance: null };
  });
}

try {
  const wardrobe = await candidateRow(WARDROBE_CANDIDATE);
  const basics = await candidateRow(BASICS_CANDIDATE);
  if (wardrobe.path !== "wardrobe" || basics.path !== "basics") {
    throw new Error(`the two candidates must be one of each path — got ${wardrobe.path} and ${basics.path}`);
  }
  await plant(wardrobe.id, wardrobe.userId);
  await plant(basics.id, basics.userId);
  console.log(`planted 2 build rows (ids ${planted.join(", ")}) — deleted at the end of this run`);

  const token = await new SignJWT({ openId: OPEN_ID, appId: process.env.VITE_APP_ID, name: "label eye" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));

  /* Held at the wire — the scan is house money and this driver buys nothing.
     A held scan is also what makes the reading clean: the ONLY build row on
     either panel is the one this driver planted. */
  const { browser, page } = await openDrivenPage({
    base: BASE,
    token,
    width: 1440,
    height: 1000,
    holdFaceScan: true,
  });

  for (const theme of ["dark", "light"] as const) {
    console.log(`\n════════ theme: ${theme} ════════`);
    await page.evaluateOnNewDocument((one: string) => {
      localStorage.setItem("drape_theme", one);
    }, theme);

    for (const subject of [
      { name: "wardrobe", tile: wardrobe.position + 1, expect: "as dressed" as string | null },
      { name: "basics", tile: basics.position + 1, expect: null },
    ]) {
      await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
      /* Walk to the roll this candidate is on — the sheet opens on the newest. */
      const rollLabel = subject.name === "wardrobe" ? "04" : "03";
      await page.waitForFunction(
        () => document.querySelectorAll(".dpc-rollrail__item").length >= 4,
        { timeout: 40_000 },
      );
      await page.evaluate((want: string) => {
        for (const pill of Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-rollrail__item"))) {
          if (!(pill.textContent ?? "").trim().startsWith(want)) continue;
          pill.click();
          return;
        }
      }, rollLabel);

      const tileLabel = `View candidate ${String(subject.tile).padStart(2, "0")} larger`;
      await page.waitForSelector(`button[aria-label="${tileLabel}"]`, { timeout: 60_000 });
      await page.click(`button[aria-label="${tileLabel}"]`);
      await page.waitForSelector(".dpc-face", { timeout: 90_000 });
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll(".dpc-face__name"))
          .some((one) => (one.textContent ?? "").trim() === "Build"),
        { timeout: 30_000 },
      ).catch(() => undefined);

      const row = await readBuildRow(page);
      check(row.present, `[${theme}] the ${subject.name} cast draws its Build row`,
        row.present ? `words ${JSON.stringify(row.words)}` : "no row named Build on the panel");
      check(row.provenance === subject.expect,
        subject.expect === null
          ? `[${theme}] ⚠ CONTROL — the BASICS cast says nothing about its picture`
          : `[${theme}] the WARDROBE cast's Build row says what its picture actually shows`,
        `provenance=${JSON.stringify(row.provenance)}`);

      /*
        ───────── 9 · THE ASK BOX'S CAPABILITY LINE, on the same screen ────────

        §10's FIFTH flip precondition, landed 2026-08-24 (ruled fable-1490). The
        panel's WARDROBE section sits four lines above this sentence, so the two
        belong in one frame — which is how the contradiction was found in the
        first place: by photographing the panel for §6's pack rather than by
        reading the string.

        ⚠ **THE DEV FIXTURE CAN ONLY SHOW ONE SIDE OF IT, AND THAT IS STATED
        RATHER THAN GLOSSED.** The account with the paths is not on the repaint
        road (`CASTING_REPAINT_SCOPE` is `users:1` in dev and this is 28601), so
        `wardrobeEditsEnabled` is FALSE here and the old sentence is what a
        person sees on both paths. That is the CONTROL — the sentence is correct
        for this account — and it is worth a frame precisely because the change
        must be invisible until both halves are true.
      */
      const meta = await page.evaluate(() => {
        const lines: string[] = [];
        for (const node of Array.from(document.querySelectorAll(".dpc-refine__note"))) {
          lines.push((node.textContent ?? "").trim());
        }
        return lines;
      });
      const says = meta.join(" | ");
      /* BOTH HALVES: the account's gate AND the cast's path. On Basics the old
         sentence is right even for a repaint account, because that path refuses
         an outfit in its own words. */
      const shouldSay = EXPECT_WARDROBE_EDITS && subject.name === "wardrobe";
      check(
        shouldSay
          ? says.includes("including what they") && !says.includes("not their clothes")
          : says.includes("not their clothes or the room") && !says.includes("including what they"),
        shouldSay
          ? `[${theme}] the ${subject.name} cast is told the box reaches what they are wearing`
          : `[${theme}] ⚠ CONTROL — the ${subject.name} cast keeps today's sentence, and claims no capability it lacks`,
        JSON.stringify(says.slice(0, 130)),
      );

      const path = `${OUT}/${EXPECT_WARDROBE_EDITS ? "9-askbox" : "8-panel"}-${subject.name}-${theme}.png`;
      await page.screenshot({ path: path as `${string}.png` });
      console.log(`  shot ${path}`);
    }
  }

  await browser.close();
} finally {
  /* The fixture never outlives the run. A planted row left behind is a row a
     later reader would take for production data. */
  for (const id of planted) {
    await db.query(`DELETE FROM casting_reference_library WHERE id = ?`, [id]);
  }
  if (planted.length > 0) console.log(`\ncleaned up ${planted.length} planted rows`);
  await db.end();
}

print();
console.log(`\n${records.length} readings · ${failures().length} failed · frames in ${OUT}/`);
process.exit(failures().length === 0 ? 0 : 1);
