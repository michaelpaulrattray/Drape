/**
 * THE SHAPE A DISPOSABLE SCRIPT IS ALREADY IN — copy this file, do not start
 * from a blank one.
 *
 * # Why this exists
 *
 * Four times a script written as a one-shot bench has been PROMOTED into the
 * repository — because a design note cites it by name, and a cited instrument
 * that is not in the tree is a dangling citation — and the act of committing it
 * brought it into the scope of a guard it had never had to satisfy. Every time
 * the suite caught it, and every time it cost a red run and a fix commit. The
 * fourth was a panel builder whose last statement was a `console.log`.
 *
 * The guards are right and not one of them should be relaxed. What was missing
 * is a starting point that already satisfies them, so a promoted script arrives
 * compliant instead of arriving red. That is this file, and writing it found a
 * FIFTH instance immediately: the first draft tripped the third guard below,
 * which is as good an argument for the file as anything written here.
 *
 * # The three guards, and what each one is really about
 *
 * **1 · `assertOneWorld` — which world am I in?** (`scriptWorldGuard`)
 * A script that loads `.env` for a `FAL_KEY` and then reaches for
 * `DATABASE_URL` can end up on the DEV database inside a process whose whole
 * purpose was to read production — the two differ only by port, so nothing in
 * the output says so. The guard is inert outside that wrapper, so it costs a
 * local run nothing. Required of any script under `scripts/` whose text calls
 * `getDb()`.
 *
 * **2 · A terminal `process.exit()` — end by ending.** (`scriptExitDiscipline`)
 * `getDb()` hands out a module-level mysql pool with no exported shutdown and
 * `storagePut` builds an S3 client with keep-alive sockets, so a finished
 * script sits there with everything done and nothing to do. Eighteen such
 * processes were once found alive from the previous day, and a SPEND script was
 * resident for three hours and twenty minutes while the shift that left it
 * reported no jobs running — in good faith, because nothing showed them. The
 * check is on the LAST TOP-LEVEL STATEMENT, not on the presence of the string:
 * an exit in an earlier branch does not count.
 *
 * **3 · The right door for the right world.** (`scriptConnectionDiscipline`)
 * **This template is for a DEV-side script that drives the app's own services**
 * — a court, a bench, a probe — and that is why it uses `getDb()`. A script
 * written to READ PRODUCTION is a different family and this is the wrong
 * skeleton for it: the production URL does not arrive under the name this one
 * reads, and `scripts/lib/dbConnection.mts` is the door for that family. It
 * also applies `timezone: "Z"`, without which every DATETIME comes back ten
 * hours early on this bench, silently, looking entirely reasonable.
 *
 * # It is a real script, and that is the point
 *
 * A template kept as prose or as a `.txt` drifts from the guards the first time
 * they change, and nothing says so. This file is under `scripts/`, it is
 * tracked, and it calls `getDb()` — so it sits inside the derived scope of all
 * three guards and the suite proves it compliant on every run. Sabotaging
 * either half of it reddens the guard that owns that half, by name, which is
 * how it was checked rather than assumed. Running it is harmless: it reads one
 * count and leaves.
 *
 *   npx tsx scripts/SKELETON-disposable.mts
 */

/* Any flag a script needs set for the whole process goes ABOVE the imports —
   module side effects run at import time, so setting it below is too late. */
// process.env.SOME_SCOPE_FLAG = "users:1";

import "dotenv/config";
import { getDb } from "../server/db/connection";
import { assertOneWorld } from "./lib/worldGuard.mts";

/*
  THE WORLD, DECLARED. Name every variable this script reads that decides which
  world it is talking to. A script that also WRITES objects should say so:
  running under the production database wrapper leaves the R2 variables
  pointing at the local dev bucket, and the guard is what catches the mismatch.
*/
assertOneWorld(["DATABASE_URL"]);

const db = await getDb();
if (!db) throw new Error("no database");

const [rows] = await (db as unknown as {
  session: { client: { query: (sql: string) => Promise<[unknown[], unknown]> } };
}).session.client.query("select count(*) as n from users");
console.log("users:", JSON.stringify(rows));

/*
  AND THE LAST STATEMENT ENDS THE PROCESS. The failure arm is covered for free:
  the throw above is an unhandled rejection, which exits nonzero. This is the
  happy arm, and it must be the last top-level statement in the file.
*/
process.exit(0);
