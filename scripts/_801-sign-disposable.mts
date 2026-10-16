/**
 * #801 — THE SIGN QUESTION, which he raised on 2026-10-15:
 *
 *   "after a chain of edits, do the signed views come out as the edited cast?
 *    Today they render from the master plus carried feature words and ink
 *    crops. Measure whether an edit that lives only in the picture reaches all
 *    the views, especially for a creature."
 *
 * Signs the CONTROL chain's own candidate — the creature, whose six-step chain
 * is on the record — and writes the five delivered views out so they can be
 * put beside the edited frame and looked at.
 *
 * Spend: one Sign, 3,250 dev ledger and about 75c of house fal.
 *
 *   npx tsx scripts/_801-sign-disposable.mts
 */
process.env.CASTING_V2_SCOPE = "all";
process.env.CASTING_REFERENCE_LIBRARY_SCOPE = "all";
/* `CASTING_REPAINT_SCOPE` (#1577 slice 4b) and `CASTING_OPEN_LANE_SCOPE` (slice D1)
   were set "all" here and are removed with their flags: nothing reads either name. */
/* `CASTING_SIDE_PHRASING_SCOPE = "all"` stood here and is removed with the flag
   (#1577 slice D2). It pinned the position production shipped at the time; the
   clause it armed is said on every render now, so a re-run reads the same
   sentence it did. */
process.env.CASTING_FACE_SCAN_SCOPE = "all";
process.env.CASTING_SCAN_TABLE_SCOPE = "all";
process.env.CASTING_BRIEF_FIDELITY_SCOPE = "all";

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { getDb } from "../server/db/connection";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { signCandidate } from "../server/castingV2/signService";

assertOneWorld(["DATABASE_URL"]);
if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only — this spends dev credits");

const USER = 823;
const CANDIDATE = process.env.CANDIDATE ?? "7dc26b57-cd4c-4064-91a6-343a0f80efed";
const OUT = "output/801/sign";
mkdirSync(OUT, { recursive: true });

const db = await getDb();
if (!db) throw new Error("no database");
const client = (db as unknown as {
  session: { client: { query: (s: string, p?: unknown[]) => Promise<[any[], unknown]> } };
}).session.client;
const q = async (s: string, p: unknown[] = []) => (await client.query(s, p))[0];

console.log("candidate:", JSON.stringify((await q(
  "select id, selectedVariantId, status from casting_candidates where publicId=?", [CANDIDATE]))[0]));
console.log("balance before:", (await q("select balance from points where userId=?", [USER]))[0]?.balance);

const started = Date.now();
/*
  THE PACKAGE IS BUILT INLINE, and the first Sign of this court is why: the
  service DETACHES it (`schedulePackage ?? detach`), so a script that signs and
  exits leaves the Cast at `provisioning` with the five views never rendered —
  charged, and nothing to look at. A browser polls; a script has to hold the
  process open, which is what injecting the scheduler does.
*/
const result = await signCandidate({ schedulePackage: (run) => run() }, {
  userId: USER,
  clientRequestId: randomUUID(),
  candidatePublicId: CANDIDATE,
  name: "Court 801 creature",
});
console.log(`signed in ${((Date.now() - started) / 1000).toFixed(0)}s`);
console.log("result keys:", Object.keys(result as object).join(", "));
writeFileSync(`${OUT}/sign-result.json`, JSON.stringify(result, null, 1));
console.log("balance after:", (await q("select balance from points where userId=?", [USER]))[0]?.balance);
process.exit(0);
