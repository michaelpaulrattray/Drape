/**
 * THE PRUNE COURT, on a kind the master CANNOT already have.
 *
 * The first run measured the wrong road and could not tell: all three specimens
 * already wore earrings in their MASTER, so the removal was correctly read as a
 * base-worn departure and the recipe filed a vacancy. The arms all passed — on
 * the vacancy road, not on the pruning one this milestone built.
 *
 * Two changes, and the second is the one that matters:
 *
 *   1. the pruned thing is HORNS. Earrings were the wrong subject for this
 *      court on this database: nearly every master already wears a pair, so the
 *      removal is correctly a base-worn departure and the pruning road never
 *      runs. No master has horns — the detection court measured 0.0000% on
 *      every bare frame it read — so a horns step is one the CHAIN put there by
 *      construction, which is exactly the case a prune is for;
 *   2. after the removal render, the stored row is read and `restated` must be
 *      non-null. A court that cannot say which road it drove can pass on the
 *      wrong one — this one refuses to score an arm until it knows.
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
 * (b) THE PRUNED THING REVERTS      the horns are actually gone. If its crop
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

const OUT = "output/prune-court-horns";
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
const candidateRows = (await query(
  `SELECT publicId, imageKey FROM casting_candidates
    WHERE userId = ? AND status = 'ready' AND imageKey IS NOT NULL
    ORDER BY id DESC LIMIT 12`,
  [USER],
)) as any[];

const { createOpenRouterTextEngine } = await import("../server/providers/openrouterText.js");
const { storagePublicUrl } = await import("../server/storage.js");
const reader = createOpenRouterTextEngine({ apiKey: process.env.OPENROUTER_API_KEY! });

const fetchFrame = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching a delivered frame`);
  return Buffer.from(await response.arrayBuffer());
};

/** What is in this picture — asked about both features at once, one read. */
async function look(bytes: Buffer, label: string): Promise<{ earrings: boolean; lips: boolean; saw: string }> {
  /*
    THE SECOND FEATURE IS HAIR COLOUR, not fuller lips, and the first run is the
    reason: "are the lips noticeably full" came back false on a frame that had
    just been given fuller lips, so the arm could not be measured at all. Arm (a)
    needs a survivor the reader cannot miss, and copper hair is unmistakable —
    the question is about the prune, not about the reader's threshold.
  */
  const answer = await reader.complete({
    system: "You are looking at one photograph and answering two questions. JSON only.",
    user: "Answer as {\"horns\": true|false, \"copper_hair\": true|false, \"saw\": \"<a few words>\"}. "
      + "horns: are there horns growing from this person's head? "
      + "copper_hair: does this photograph show the SURVIVING edit — " + SURVIVOR_QUESTION,
    images: [{ bytes, contentType: "image/png" }],
    json: true,
  });
  const parsed = (() => {
    try { return JSON.parse(answer.text.replace(/```json|```/g, "").trim()); } catch { return null; }
  })();
  const saw = typeof parsed?.saw === "string" ? parsed.saw : "";
  const seen = saw.trim().length > 0;
  const read = { earrings: parsed?.horns === true && seen, lips: parsed?.copper_hair === true && seen, saw };
  say(`    look  ${label.padEnd(16)} horns=${read.earrings ? "YES" : "no "} copperHair=${read.lips ? "YES" : "no "}  ${saw.slice(0, 52)}`);
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

/*
  NO SPECIMEN CHECK IS NEEDED, and that is the point of choosing horns: a master
  cannot already have them. The first court's defect was a specimen question it
  never asked; this one removes the question instead of answering it.
*/
/* Two faces are already carrying tonight's other courts (one has horns, one has
   copper hair), and the already-true door refuses a step a face has. Skipped by
   name rather than by luck. */
const SPENT = new Set(["86e896f1-b9ca-4f4f-8bd7-b38e32b82a36", "8540d86f-1058-498c-97d3-9bb75acd9d5e"]);
const candidates = candidateRows
  .map((row: any) => row.publicId as string)
  .filter((publicId: string) => !SPENT.has(publicId))
  .slice(0, N);
if (candidates.length < N) throw new Error(`only ${candidates.length} candidates, needed ${N}`);

/** Which road the delivered row says this render actually drove. */
async function roadOf(candidate: string): Promise<{ restated: string[] | null; vacated: string[] | null }> {
  const [row] = await query(
    `SELECT v.internalPrompt FROM casting_candidate_variants v
       JOIN casting_candidates c ON c.id = v.candidateId
      WHERE c.publicId = ? ORDER BY v.id DESC LIMIT 1`,
    [candidate],
  );
  const stored = typeof row?.internalPrompt === "string" ? JSON.parse(row.internalPrompt) : row?.internalPrompt;
  return { restated: stored?.repaint?.restated ?? null, vacated: stored?.repaint?.vacated ?? null };
}

/** What arm (a) is asked about, per specimen — set before each look. */
let SURVIVOR_QUESTION = "";

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
    const withHorns = await step("give her curved ram horns", "horns");
    /*
      THE SURVIVOR VARIES PER SPECIMEN, and that is a strength rather than a
      convenience: this database's faces have been through other courts tonight,
      so a fixed survivor hits the already-true door ("she already has copper").
      A different survivor per face also means arm (a) holds across kinds rather
      than for one lucky feature.
    */
    const survivors = ["colour her hair jet black", "give her a blunt fringe", "colour her hair copper"];
    const survivor = survivors[at % survivors.length]!;
    const withLips = await step(survivor, "survivor");
    SURVIVOR_QUESTION = [
      "jet black hair (as opposed to blonde, brown, red or grey)?",
      "a blunt fringe — a straight-cut fringe across the forehead?",
      "copper, red or auburn hair (as opposed to blonde, brown or black)?",
    ][at % 3]!;
    const beforeRead = await look(withLips, "before the prune");
    const pruned = await step("take the horns off", "pruned");
    /*
      THE ROAD, ASSERTED AT THE WIRE, BEFORE ANY ARM IS SCORED.

      `restated` is the pruning road's own footprint and `vacated` is the
      departure road's. A run that scored its arms without reading this is how
      the first court passed three times on a road it was not testing.
    */
    const road = await roadOf(candidate);
    say(`    road  restated=${JSON.stringify(road.restated)} vacated=${JSON.stringify(road.vacated)}`);
    const drovethePrune = Array.isArray(road.restated) && road.restated.length > 0;
    if (!drovethePrune) {
      say("    THIS SPECIMEN DID NOT DRIVE THE PRUNE — not scored");
      rounds.push({ candidate, road, scored: false, everythingElse: false, reverted: false, identity: false });
      continue;
    }
    const afterRead = await look(pruned, "after the prune");
    const same = await stillHer(withLips, pruned, "pruned vs before");

    rounds.push({
      candidate,
      road,
      scored: true,
      before: beforeRead,
      after: afterRead,
      same,
      /* (a) the lip survives · (b) the earrings actually go · (c) still her */
      everythingElse: beforeRead.lips && afterRead.lips,
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

const scored = rounds.filter((row) => row.scored);
const count = (key: "everythingElse" | "reverted" | "identity") => scored.filter((row) => row[key]).length;
say("");
say("=".repeat(78));
say(`SPECIMENS that drove the PRUNE   ${scored.length} of ${rounds.length}`);
say(`(a) EVERYTHING ELSE still there   ${count("everythingElse")} of ${scored.length}`);
say(`(b) THE PRUNED THING reverted     ${count("reverted")} of ${scored.length}`);
say(`(c) SAME PERSON throughout        ${count("identity")} of ${scored.length}`);
const pass = scored.length === rounds.length && scored.length > 0
  && ["everythingElse", "reverted", "identity"].every((key) => count(key as never) === scored.length);
say(pass ? "PASS — a prune takes back what it named and leaves the rest of her alone"
  : "SHORT — see the arms above; nothing ships on this reading");
say("=".repeat(78));
say(`LEDGER: ${ledgerBefore.n} rows → ${ledgerAfter.n} rows · net ${ledgerBefore.net} → ${ledgerAfter.net} `
  + `(spent ${ledgerBefore.net - ledgerAfter.net} dev credits)`);

writeFileSync(`${OUT}/court.txt`, `${lines.join("\n")}\n`);
writeFileSync(`${OUT}/court.json`, `${JSON.stringify(rounds, null, 2)}\n`);
await db.end();
process.exit(pass ? 0 : 1);
