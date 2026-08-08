/**
 * THE BESPECTACLED SHEET, ON THE FOUNDER'S OWN ACCOUNT (fable-061).
 *
 * `bespectacled-roll.mts` rolls on `verify-bot-local` — right for a fixture,
 * wrong for a walk. The walk reads `casting_candidates WHERE userId = 1` and
 * drives the browser as the founder, so a sheet cast on any other account is
 * eight faces it can never see. This is that script pointed at the real account,
 * and nothing else about it is different.
 *
 * # Why a roll at all
 *
 * The tray is out of walkable faces. Roll `455d096d` was the bespectacled one
 * and run-14 took its last untouched candidate; a segmenter sweep of all ~30
 * remaining untouched candidates found **zero** wearing glasses. Two of the
 * walk's five steps are about her glasses, so there is nothing left to walk.
 *
 * # The brief is the founder's own, verbatim
 *
 * "a woman in her 40s wearing chunky glasses" came back 8/8 on the stated-
 * accessory fix. A paid path is the wrong place to debut a cleverer sentence:
 * an unproven brief that files "glasses" somewhere unexpected costs a whole roll
 * to discover. Chunky frames are also what the walk wants — opaque enough to
 * composite back verbatim, with lens interiors that must regenerate inside
 * frame-edge anchors.
 *
 * # It spends, so it says so first
 *
 * `--spend` is required. Without it this prints what it would do and exits, the
 * same contract the walk lives under, for the same reason.
 *
 * # The invocation is NESTED, and that is not a trick
 *
 * Neither service alone can do this from a laptop, which is itself why the
 * mistake was so easy to make:
 *
 *   --service MySQL   the public database URL, and NO bucket at all
 *   --service Drape   the production bucket, and a database URL of
 *                     `mysql.railway.internal` — unreachable from outside
 *
 * Nesting one run inside the other composes them: the outer supplies R2, the
 * inner adds `MYSQL_PUBLIC_URL`, and this script swaps the internal host for
 * the public one below. Measured, not assumed — `R2_BUCKET` reads
 * `drape-production` under it.
 *
 *   railway.cmd run --service Drape -- railway.cmd run --service MySQL -- \
 *     npx tsx scripts/calibration/bespectacled-roll-production.mts --spend
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import {
  APP_WRITE_PATH_KEYS,
  assertDefinedByService,
  assertOneWorld,
  WORLD_DISCRIMINATING_KEYS,
} from "../lib/worldGuard.mts";

/*
  THE WORLD IS DECLARED BEFORE A CREDIT MOVES.

  This writes ROWS to whichever database it is handed and charges whichever
  account lives there. A dev URL silently supplied by dotenv inside a Railway run
  is the mistake `worldGuard` exists for, and here it would produce eight faces
  in the wrong world while reporting success.
*/
/*
  AND THE KEY DECLARED IS THE KEY THE CODE ACTUALLY READS — `DATABASE_URL`.

  The first version declared `MYSQL_PUBLIC_URL`, because that is what a
  `railway run --service MySQL` supplies and what every read-only script in this
  directory uses. But this script does not open its own connection: it calls
  `getDb()`, the APP's connection, and `getDb()` reads **`DATABASE_URL`** — a key
  the MySQL service does not define, so dotenv filled it from the developer's
  local `.env`. The guard stayed quiet because it was told the wrong dependency,
  and a full eight-candidate sheet was cast into the DEV database while every
  console line said production. Production's ledger never moved; the faces were
  simply useless, and the segmenter sweep that found them missing is the only
  reason anybody looked.

  The rule, stated so the next script inherits it: **declare the variable your
  DEPENDENCIES read, not the one you read.** `worldGuard` protects what you tell
  it you rely on, and a helper's hidden key is still your reliance.

  Both are declared here: `DATABASE_URL` because `getDb()` reads it, and
  `MYSQL_PUBLIC_URL` when present because that is how the run is meant to be
  pointed at production.
*/
/*
  AND THAT REPAIR WAS STILL INCOMPLETE, WHICH IS THE THIRD BITE.

  Declaring `DATABASE_URL` fixed the rows and said nothing about the BYTES.
  `createRoll` runs the app's own pipeline in process, so the eight pictures are
  written by `server/storage.ts` — which reads five R2 variables through `ENV`,
  three frames below anything visible at this call site. Under
  `railway run --service MySQL` the MySQL service defines none of them and
  dotenv supplied five DEV values.

  Result, measured afterwards rather than feared: roll `641c71d0` charged 160
  credits, its eight rows are in PRODUCTION, and all eight objects are in the
  **dev** bucket. Production 404s every key; the dev base serves every key; an
  older candidate proves the bases themselves are fine in both directions. The
  founder paid for a tray of broken tiles.

  So the declaration is no longer hand-written. `APP_WRITE_PATH_KEYS` is the
  maintained set of everything the app's own write path reads, and pointing at
  it is what makes this script run ONLY under a service that defines all six —
  `--service Drape`. `--service MySQL` now refuses by name instead of casting.

  Two assertions rather than one, because they catch different failures:
  presence catches the key nobody supplied, and the world check catches the key
  somebody supplied from the wrong world. The world check is asked only about
  the keys that DIFFER between dev and production — the R2 endpoint and
  credential are identical in both, so refusing on them would refuse the
  correct invocation.
*/
/*
  THE DATABASE IS REACHED BY ITS PUBLIC NAME, and the swap happens before any
  assertion so the guards judge the URL that will actually be dialled.

  The Drape service's own `DATABASE_URL` is `mysql.railway.internal`, which
  resolves inside Railway and nowhere else. Swapping in the public URL is what
  makes the nested invocation work; doing it BEFORE `assertOneWorld` is what
  keeps the guard's opinion about the real value rather than a placeholder.
*/
if (process.env.MYSQL_PUBLIC_URL && /\.railway\.internal/.test(process.env.DATABASE_URL ?? "")) {
  process.env.DATABASE_URL = process.env.MYSQL_PUBLIC_URL;
}
assertDefinedByService(APP_WRITE_PATH_KEYS);
assertOneWorld(WORLD_DISCRIMINATING_KEYS);

const { getDb } = await import("../../server/db/connection");
const { castingCandidates, users } = await import("../../drizzle/schema");
const { createCastingSession } = await import("../../server/db/castingV2");
const { createRoll } = await import("../../server/castingV2/rollService");

/* Founder-verified verbatim. Do not "improve" this on a paid path. */
const BRIEF = "a woman in her 40s wearing chunky glasses";
const OPEN_ID = "google_109438922864282769159";
const SPEND = process.argv.includes("--spend");

const db = await getDb();
if (!db) throw new Error("no db");

/*
  THE ACCOUNT IS FOUND BY ITS OWN IDENTIFIER, NEVER BY `id = 1`.

  "User 1" is how the campaign talks about the founder and it is a row number,
  not a fact — the walk authenticates as this openId, so this is the same person
  by the same key, and a mismatch fails loudly rather than casting a sheet the
  walk cannot see.
*/
const [owner] = await db.select().from(users).where(eq(users.openId, OPEN_ID)).limit(1);
if (!owner) throw new Error(`no account for ${OPEN_ID} in this database — wrong world, or wrong key`);
console.log(`account: ${owner.id} (${owner.openId})`);
console.log(`brief:   ${BRIEF}`);

if (!SPEND) {
  console.log("\nDRY RUN — this would cast a full eight-candidate sheet and CHARGE the account.");
  console.log("Pass --spend to actually roll it. Nothing was charged.");
  process.exit(0);
}

const session = await createCastingSession({ userId: owner.id });
console.log(`session: ${session.publicId}`);

const result = await createRoll({}, {
  userId: owner.id,
  clientRequestId: randomUUID(),
  sessionPublicId: session.publicId,
  briefText: BRIEF,
});
console.log(`roll:    ${result.rollPublicId} — waiting for the eight to settle…`);

for (let attempt = 0; attempt < 90; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const rows = await db
    .select({
      publicId: castingCandidates.publicId,
      status: castingCandidates.status,
      imageKey: castingCandidates.imageKey,
    })
    .from(castingCandidates)
    .where(eq(castingCandidates.sessionId, session.id));
  const ready = rows.filter((row) => row.status === "ready");
  const settled = rows.filter((row) => row.status !== "queued" && row.status !== "generating");
  console.log(`  ${ready.length} ready / ${settled.length} settled of ${rows.length}`);
  if (rows.length > 0 && settled.length === rows.length) {
    console.log("\nready candidates:");
    for (const row of ready) console.log(`  ${row.publicId}  ${row.imageKey}`);
    console.log(`\nroll ${result.rollPublicId}`);
    console.log("NEXT: verify the sheet is actually bespectacled before walking it —");
    console.log("  pick-walk-face-disposable.mts --glasses --public-base <production bucket>");
    break;
  }
}
process.exit(0);
