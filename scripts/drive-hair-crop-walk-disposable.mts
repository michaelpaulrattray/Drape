/**
 * THE CROP ROAD, END TO END, BY A CUSTOMER'S OWN HAND — the founder-eyes crop
 * gate's artifact (ordered fable-1074 §4, sequenced fable-1108 §4).
 *
 * The words lane's walk (`drive-words-lane-offer-disposable.mts`) was this
 * road's smaller sibling: it proved a picture could be attached and READ. This
 * one proves the other half — a picture attached, CUT into a carrier, and sent
 * to an engine with a sentence saying what it may give her.
 *
 * The specimen is his own (`build-two-founder-specimens` #2, the corpus's
 * centrepiece): two photographs of the same MAN, stacked — dark, near-black,
 * soft-waved, swept fringe. It is deliberately the hard one:
 *
 *   · TWO HEADS in one frame, so the panel decision is exercised rather than
 *     assumed (§9.10);
 *   · a MALE reference on a FEMALE Cast, so the ride-along sentence's pronoun
 *     has to be the CAST's — a reference is a source and never a subject;
 *   · a STYLE take, so the sentence must hold back a property the picture
 *     plainly shows. His own ask for this file is *"hair style with different
 *     color"*.
 *
 * WHAT IT SPENDS: 25 DEV credits and one real render on the fal balance, plus
 * the interpreter's own reads. The ask names two takes, so the take resolver
 * escalates to the text model rather than falling back — that is the road, not
 * an accident of phrasing.
 *
 * WHAT IT READS BACK: the frame (for eyes), the ledger on both sides (for the
 * charge), and THE PROMPT THAT WAS ACTUALLY SENT, off the generation record —
 * because "the scope rode" is a claim about a request, and the request is the
 * only place it is a fact.
 *
 *   npx tsx scripts/drive-hair-crop-walk-disposable.mts
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import { SignJWT } from "jose";
import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";
import { openDatabase } from "./lib/dbConnection.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/hair-crop-walk";
const SESSION = process.env.ATTACH_SESSION ?? "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
const PICTURE = "docs/specs/references/build-two-founder-specimens/hair-style-dark-waves-two-panel.png";
/* His own words for this specimen, and they name TWO takes on purpose. */
const ASK = "give her this haircut but keep her own hair colour";

const failures: string[] = [];
const check = (name: string, ok: boolean, saw = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${saw ? ` — saw ${saw}` : ""}`);
  if (!ok) failures.push(name);
};

await mkdir(OUT, { recursive: true });

const conn = await openDatabase(process.env.DATABASE_URL!);
const creditsNow = async (): Promise<number> => {
  const [rows] = await conn.query<any[]>("SELECT balance FROM points WHERE userId = 823");
  return Number(rows[0]?.balance ?? -1);
};
const before = await creditsNow();
console.log(`credits before: ${before}`);

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
const tile = await page
  .waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
  .catch(() => null);
check("a candidate tile is on the sheet", tile !== null);
if (tile) await tile.click();
const box = await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null);
check("the ask box is on screen", box !== null);

/* The face BEFORE, so the two frames can be looked at side by side. */
const beforeShot = await page.$(".dpc-viewer, .dpc-refine");
if (beforeShot) await beforeShot.screenshot({ path: `${OUT}/1-before.png` as never });

if (box) {
  const input = (await page.$(".dpc-refine__readInput")) as ElementHandle<HTMLInputElement> | null;
  check("the picker is there", input !== null);
  if (input) {
    await input.uploadFile(PICTURE);
    await page.waitForSelector(".dpc-refine__claim", { timeout: 20_000 });
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>(".dpc-refine__claim button")?.click();
    });
    const attached = await page
      .waitForFunction(() => document.querySelector(".dpc-refine__claim") === null, { timeout: 60_000 })
      .then(() => true, () => false);
    check("the picture attached", attached);

    await page.type(".dpc-refine__field", ASK);
    const panel = await page.$(".dpc-refine");
    if (panel) await panel.screenshot({ path: `${OUT}/2-asked.png` as never });

    /*
      THE BASELINE, TAKEN BEFORE THE ASK — a "new variant" is a row whose id is
      greater than the newest one that existed before I pressed anything. The
      first version of this driver waited on the panel's NOTE instead and the
      note was already on screen (the attach confirmation), so it declared
      something terminal in milliseconds, charged nothing, and read an old row.
      Wait on the thing the ask CREATES, never on a surface that was already
      saying something.
    */
    const [baselineRows] = await conn.query<any[]>(
      "SELECT COALESCE(MAX(id), 0) AS top FROM casting_candidate_variants WHERE userId = 823",
    );
    const baseline = Number(baselineRows[0]?.top ?? 0);

    /*
      THE PROPERTY, NOT THE ATTRIBUTE. `button[type=submit]` matches nothing
      here: the button carries no explicit `type`, and `HTMLButtonElement.type`
      DEFAULTS to "submit" in the DOM. A CSS attribute selector cannot see a
      default, so the selector form throws while the property form works — which
      is the same family as the assertion that cannot fail on a blank element.
    */
    await page.evaluate(() => {
      Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
        .find((button) => button.type === "submit")
        ?.click();
    });
    console.log(`sent — waiting on a variant past id ${baseline} (a repaint is minutes, not seconds)`);

    let row: any = null;
    for (let tick = 0; tick < 180; tick += 1) {
      const [rows] = await conn.query<any[]>(
        `SELECT id, publicId, status, internalPrompt
           FROM casting_candidate_variants
          WHERE userId = 823 AND id > ?
          ORDER BY id ASC LIMIT 1`,
        [baseline],
      );
      if (rows[0]) { row = rows[0]; if (row.internalPrompt) break; }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    check("the ask created a variant", row !== null, row ? `${row.publicId} (${row.status})` : "none in 15 min");

    /* Now let the surface catch up, so the FRAME and the row agree. */
    if (row) {
      await page.waitForFunction(
        () => {
          const outcome = document.querySelector(".dpc-refine__outcome")?.textContent ?? "";
          return outcome.trim().length > 0
            || document.querySelectorAll(".dpc-refine__step").length > 0;
        },
        { timeout: 600_000, polling: 3000 },
      ).catch(() => null);
    }

    const outcome = await page.evaluate(
      () => document.querySelector(".dpc-refine__outcome")?.textContent?.trim() ?? "",
    );
    const note = await page.evaluate(
      () => document.querySelector(".dpc-refine__note")?.textContent?.trim() ?? "",
    );
    if (outcome) console.log(`   outcome: ${outcome}`);
    if (note) console.log(`   note: ${note}`);

    await page.screenshot({ path: `${OUT}/3-after-full.png` as never });
    const after = await page.$(".dpc-viewer, .dpc-refine");
    if (after) await after.screenshot({ path: `${OUT}/3-after.png` as never });
  }
}

const afterCredits = await creditsNow();
console.log(`credits after: ${afterCredits}  (delta ${afterCredits - before})`);

/*
  THE REQUEST ITSELF — the only place "the scope rode" is a fact rather than a
  claim. Read off the newest generation record for this account.
*/
const [records] = await conn.query<any[]>(
  `SELECT id, publicId, createdAt, internalPrompt
     FROM casting_candidate_variants
    WHERE userId = 823
    ORDER BY id DESC
    LIMIT 1`,
);
/*
  THE RECORD MUST EXIST, ASSERTED — not "if it is there, read it".

  An `if` alone here is a false pass with extra steps: a query that matched
  nothing would skip every wire check below and the walk would still print PASS,
  which is the exact shape D-235 forbids. So its absence FAILS, loudly.
*/
check(
  "a dispatch record was written",
  Boolean(records?.[0]),
  records?.[0] ? `variant ${records[0].publicId}` : "no row",
);
if (records?.[0]) {
  const raw = typeof records[0].internalPrompt === "string"
    ? records[0].internalPrompt
    : JSON.stringify(records[0].internalPrompt);
  await writeFile(`${OUT}/dispatch.json`, raw ?? "", "utf8");
  const prompt = (() => {
    try { return JSON.parse(raw)?.repaint?.prompt ?? ""; } catch { return ""; }
  })();
  console.log("\nTHE PROMPT THAT WENT OUT:\n");
  console.log(prompt);
  check("a prompt was recorded at dispatch", prompt.length > 0, `${prompt.length} chars`);
  check("the crop rode as a reference", /picture supplied for her hair/.test(prompt));
  check("the scope rode with it", /Do not take the colour from the reference/.test(prompt));
  check("and it is the CAST's pronoun, not the reference's", /keep her own\./.test(prompt));
}

console.log(`\n${failures.length === 0 ? "PASS" : `FAIL — ${failures.length}`}`);
await browser.close();
await conn.end();
process.exit(failures.length === 0 ? 0 : 1);
