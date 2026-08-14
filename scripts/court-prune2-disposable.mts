/**
 * THE PRUNE COURT, SECOND RUN — with the road asserted at the wire.
 *
 * The first run measured the wrong road and could not tell: all three specimens
 * already wore earrings in their MASTER, so the removal was correctly read as a
 * base-worn departure and the recipe filed a vacancy. The arms all passed — on
 * the vacancy road, not on the pruning one this milestone built.
 *
 * Two changes, and the second is the one that matters:
 *
 *   1. specimens are chosen by ASKING whether the master wears earrings, and a
 *      face that does is skipped;
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

const OUT = "output/prune-court-2";
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
      AND selectedVariantId IS NULL
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
    user: "Answer as {\"earrings\": true|false, \"copper_hair\": true|false, \"saw\": \"<a few words>\"}. "
      + "earrings: is this person wearing earrings — anything hanging from or fixed to either earlobe? "
      + "copper_hair: is their hair copper, red or auburn (as opposed to blonde, brown or black)?",
    images: [{ bytes, contentType: "image/png" }],
    json: true,
  });
  const parsed = (() => {
    try { return JSON.parse(answer.text.replace(/```json|```/g, "").trim()); } catch { return null; }
  })();
  const saw = typeof parsed?.saw === "string" ? parsed.saw : "";
  const seen = saw.trim().length > 0;
  const read = { earrings: parsed?.earrings === true && seen, lips: parsed?.copper_hair === true && seen, saw };
  say(`    look  ${label.padEnd(16)} earrings=${read.earrings ? "YES" : "no "} copperHair=${read.lips ? "YES" : "no "}  ${saw.slice(0, 52)}`);
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

/**
 * A MASTER THAT ALREADY WEARS EARRINGS CANNOT MEASURE A PRUNE.
 *
 * The first run's whole defect: the removal is then a base-worn DEPARTURE, the
 * recipe files a vacancy, and the pruning road never runs. Asked once per
 * candidate, a cent each, before a single credit is spent.
 */
async function masterIsBareEared(imageKey: string): Promise<boolean> {
  const bytes = await fetchFrame(storagePublicUrl(imageKey));
  const answer = await reader.complete({
    system: "You are looking at one photograph. JSON only.",
    user: "Answer as {\"earrings\": true|false, \"saw\": \"<a few words>\"}. "
      + "earrings: is this person wearing earrings — anything hanging from or fixed to either earlobe?",
    images: [{ bytes, contentType: "image/png" }],
    json: true,
  });
  const parsed = (() => {
    try { return JSON.parse(answer.text.replace(/```json|```/g, "").trim()); } catch { return null; }
  })();
  const bare = parsed?.earrings === false && String(parsed?.saw ?? "").trim().length > 0;
  say(`  master ${bare ? "BARE-EARED — usable" : "wears earrings — skipped"}  ${String(parsed?.saw ?? "").slice(0, 46)}`);
  return bare;
}

say("CHOOSING SPECIMENS — a master that already wears earrings cannot measure a prune");
const candidates: string[] = [];
for (const row of candidateRows) {
  if (candidates.length >= N) break;
  if (await masterIsBareEared(row.imageKey)) candidates.push(row.publicId as string);
}
if (candidates.length < N) throw new Error(`only ${candidates.length} bare-eared masters, needed ${N}`);
say("");

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
    const withLips = await step("colour her hair copper", "copper");
    const beforeRead = await look(withLips, "before the prune");
    const pruned = await step("take the earrings off", "pruned");
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
