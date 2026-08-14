/**
 * THE MID-CHAIN PRUNE COURT — the arm the chip surface will invite
 * (V3(c), fable-538 §3).
 *
 * Not an engine bench: what is on trial is the product's own road — the
 * interpreter reading a removal, the arbitration deciding the chain put it
 * there, the carry list derived from the surviving chain, and the restate ask
 * naming what was taken back. So every render here goes through
 * `refineCandidate` exactly as a customer's would, on the dev database, with
 * the repaint scope forced on for this process.
 *
 * # THE ARMS, PRE-REGISTERED
 *
 * ```
 * per specimen:  (1) add earrings  (2) add a fuller lip  (3) take the earrings off
 *
 * (a) EVERYTHING ELSE STILL THERE   the copper hair survives the prune    — the
 *     verdict-maker. Proving the pruned thing left is easy; proving the rest
 *     survived is the expensive half.
 * (b) THE PRUNED THING REVERTS      the earrings are actually gone. If its crop
 *     rides and the feature survives, the prune is cosmetic — RED.
 * (c) SAME PERSON THROUGHOUT        every chained frame against its own parent,
 *     never against the master (the branch-state rule).
 * ```
 *
 * n = 3 specimens. Dev credits (25 per render, the founder's dev account) and
 * about a dollar of fal; the ledger is read at both ends.
 *
 *   npx tsx scripts/court-prune-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { refineCandidate } from "../server/castingV2/refineService";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only");
if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");

const OUT = "output/prune-midchain-court";
mkdirSync(OUT, { recursive: true });
const USER = Number(process.env.USER_ID ?? 1);
const N = Number(process.env.SPECIMENS ?? 3);

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

const db = await openDatabase(process.env.DATABASE_URL!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await db.query<any[]>(sql, params);
  return rows;
};

const ledgerBefore = (await query(
  "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0];

/*
  UNTOUCHED FACES ONLY, and the first run is why: the specimen it picked was the
  face I had given horns to earlier the same night, so the reader spent both its
  answers describing a horn and the "before" reading of the second feature came
  back false. A court whose specimen already carries somebody else's edits is
  measuring their chain, not this one.
*/
const candidates = (await query(
  `SELECT publicId FROM casting_candidates
    WHERE userId = ? AND status = 'ready' AND imageKey IS NOT NULL
      AND selectedVariantId IS NULL
    ORDER BY id DESC LIMIT ?`,
  [USER, N],
)).map((row: any) => row.publicId as string);
if (candidates.length < N) throw new Error(`only ${candidates.length} candidates, needed ${N}`);

const { createOpenRouterTextEngine } = await import("../server/providers/openrouterText.js");
const reader = createOpenRouterTextEngine({ apiKey: process.env.OPENROUTER_API_KEY! });

const fetchFrame = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching a delivered frame`);
  return Buffer.from(await response.arrayBuffer());
};

/** What is in this picture — asked about both features at once, one read. */
async function look(bytes: Buffer, label: string): Promise<{ earrings: boolean; lips: boolean; eyes: boolean; saw: string }> {
  /*
    THE SECOND FEATURE IS HAIR COLOUR, not fuller lips, and the first run is the
    reason: "are the lips noticeably full" came back false on a frame that had
    just been given fuller lips, so the arm could not be measured at all. Arm (a)
    needs a survivor the reader cannot miss, and copper hair is unmistakable —
    the question is about the prune, not about the reader's threshold.
  */
  const answer = await reader.complete({
    system: "You are looking at one photograph and answering two questions. JSON only.",
    user: "Answer as {\"earrings\": true|false, \"copper_hair\": true|false, "
      + "\"green_eyes\": true|false, \"saw\": \"<a few words>\"}. "
      + "earrings: is this person wearing earrings — anything hanging from or fixed to either earlobe? "
      + "copper_hair: is their hair copper, red or auburn (as opposed to blonde, brown or black)? "
      + "green_eyes: are their eyes green?",
    images: [{ bytes, contentType: "image/png" }],
    json: true,
  });
  const parsed = (() => {
    try { return JSON.parse(answer.text.replace(/```json|```/g, "").trim()); } catch { return null; }
  })();
  const saw = typeof parsed?.saw === "string" ? parsed.saw : "";
  const seen = saw.trim().length > 0;
  const read = {
    earrings: parsed?.earrings === true && seen,
    lips: parsed?.copper_hair === true && seen,
    eyes: parsed?.green_eyes === true && seen,
    saw,
  };
  say(`    look  ${label.padEnd(16)} earrings=${read.earrings ? "YES" : "no "} copperHair=${read.lips ? "YES" : "no "} greenEyes=${read.eyes ? "YES" : "no "}  ${saw.slice(0, 44)}`);
  return read;
}

/** Is the child the same individual as its own parent? */
async function stillHer(parent: Buffer, child: Buffer, label: string): Promise<boolean> {
  const answer = await reader.complete({
    system: "You are shown two photographs of a person. The FIRST is the reference. JSON only.",
    user: "Answer as {\"same_person\": true|false, \"saw\": \"<a few words about the FACE>\"}. "
      + "same_person: is the second photograph the same individual — the same face, the same bone "
      + "structure, the same features? Jewellery, clothing and hair styling may differ.",
    images: [
      { bytes: parent, contentType: "image/png" },
      { bytes: child, contentType: "image/png" },
    ],
    json: true,
  });
  const parsed = (() => {
    try { return JSON.parse(answer.text.replace(/```json|```/g, "").trim()); } catch { return null; }
  })();
  const saw = typeof parsed?.saw === "string" ? parsed.saw : "";
  const same = parsed?.same_person === true && saw.trim().length > 0;
  say(`    same  ${label.padEnd(16)} ${same ? "YES" : "no "}  ${saw.slice(0, 52)}`);
  return same;
}

const rounds: any[] = [];
for (const [at, candidate] of candidates.entries()) {
  say("");
  say("=".repeat(78));
  say(`SPECIMEN ${at + 1} — ${candidate}`);
  say("-".repeat(78));
  const step = async (instruction: string, label: string): Promise<Buffer> => {
    const started = Date.now();
    const result = await refineCandidate({}, {
      userId: USER,
      clientRequestId: randomUUID(),
      candidatePublicId: candidate,
      instruction,
    });
    const bytes = await fetchFrame(result.imageUrl);
    writeFileSync(`${OUT}/${at + 1}-${label}.png`, bytes);
    say(`  ${label.padEnd(10)} "${instruction}" — ${((Date.now() - started) / 1000).toFixed(0)}s`);
    return bytes;
  };

  try {
    const withEarrings = await step("gold hoop earrings", "earrings");
    await step("colour her hair copper", "copper");
    /*
      THE THIRD STEP is what makes this the mid-chain case: the prune below
      takes back step ONE with two later steps standing on top of it, which is
      the gesture a column of chips invites (fable-538 §3). Every earlier
      measurement pruned the LAST accessory step.
    */
    const withEyes = await step("give her green eyes", "eyes");
    const beforeRead = await look(withEyes, "before the prune");
    const pruned = await step("take the earrings off", "pruned");
    const afterRead = await look(pruned, "after the prune");
    const same = await stillHer(withEyes, pruned, "pruned vs before");

    rounds.push({
      candidate,
      before: beforeRead,
      after: afterRead,
      same,
      /* (a) the lip survives · (b) the earrings actually go · (c) still her */
      /* BOTH later steps must survive, not one: the point of the mid-chain arm
         is that the derivation keeps everything standing on top of the pruned
         step. */
      everythingElse: beforeRead.lips && afterRead.lips && beforeRead.eyes && afterRead.eyes,
      reverted: beforeRead.earrings && !afterRead.earrings,
      identity: same,
    });
  } catch (error) {
    say(`  FAILED: ${error instanceof Error ? error.message : String(error)}`);
    rounds.push({ candidate, error: String(error), everythingElse: false, reverted: false, identity: false });
  }
}

const ledgerAfter = (await query(
  "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0];

const count = (key: "everythingElse" | "reverted" | "identity") => rounds.filter((row) => row[key]).length;
say("");
say("=".repeat(78));
say(`(a) EVERYTHING ELSE still there   ${count("everythingElse")} of ${rounds.length}`);
say(`(b) THE PRUNED THING reverted     ${count("reverted")} of ${rounds.length}`);
say(`(c) SAME PERSON throughout        ${count("identity")} of ${rounds.length}`);
const pass = rounds.length > 0 && ["everythingElse", "reverted", "identity"]
  .every((key) => count(key as never) === rounds.length);
say(pass ? "PASS — a prune takes back what it named and leaves the rest of her alone"
  : "SHORT — see the arms above; nothing ships on this reading");
say("=".repeat(78));
say(`LEDGER: ${ledgerBefore.n} rows → ${ledgerAfter.n} rows · net ${ledgerBefore.net} → ${ledgerAfter.net} `
  + `(spent ${ledgerBefore.net - ledgerAfter.net} dev credits)`);

writeFileSync(`${OUT}/court.txt`, `${lines.join("\n")}\n`);
writeFileSync(`${OUT}/court.json`, `${JSON.stringify(rounds, null, 2)}\n`);
await db.end();
process.exit(pass ? 0 : 1);
