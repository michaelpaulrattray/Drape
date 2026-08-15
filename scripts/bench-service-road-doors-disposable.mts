/**
 * DO THE TWO WALL DOORS WORK ON THE REAL SERVICE ROAD? — the confirmation
 * opus-486 §7.1 filed, fable-644 §4 kept actionable, and opus-494 §8 declined
 * for want of a runner. This is the runner.
 *
 * # The reading that is still missing
 *
 * Both doors' after-measurements drove `interpretRefinement` directly with a
 * captured input, and opus-485 said why that is the wrong instrument for the
 * sentence *"the customer no longer sees this"*: an interpreter probe is not a
 * pipeline reading. The one service-road run that has been taken — 60 attempts
 * at opus-486 — came back 60/60 reaching the paint with only **2** first-call
 * wall claims underneath it, and was ruled RUN INVALID by its own pre-filed bar
 * on exactly that ground. Sixty attempts with no refusal is consistent with two
 * working doors and equally consistent with a quiet window.
 *
 * # Why this is a two-armed bench and that one was not
 *
 * The invalidity was not bad luck; it was a design that could only ever read
 * the pressure off the CLOCK. Claim rates in this program are weather —
 * `the-rest` moved 37.8% to 62.2% between windows with nothing changed that
 * could touch it (opus-486 §1), and the same ask carried 12.5% in one arm and
 * 3.3% two hours later. A single column of zeros has to be reconciled against a
 * rate somebody measured on a different night, and that reconciliation is the
 * whole weakness.
 *
 * So the rival runs BESIDE it, in the same minutes:
 *
 * ```
 * DOORS OPEN    the shipped road, exactly as a customer meets it
 * DOORS SHUT    the same road with both latches pre-set —
 *               { colourWithheld: true, priorWithheld: true }
 * ```
 *
 * Those two fields are read at ONE line each, both inside their own door's
 * guard (`refineInterpreter.ts:784` and `:857`), and are set nowhere but by the
 * door's own re-read. Nothing in message construction reads either — so the
 * shut arm sends a BYTE-IDENTICAL first request and simply may not re-ask. That
 * identity is not asserted from the grep: phase 1 drives one attempt down each
 * arm and digests the first engine request off the wire.
 *
 * The shut arm is therefore the fired-not-quiet control the invalid run lacked,
 * and it is a control that reports in the same weather as the thing it controls.
 *
 * # TWO BARS, AND THE FIRST ONE IS KEPT HERE BECAUSE IT WAS WRONG
 *
 * **Run 1** (opus-495, bound at fable-653) was scored on this bar:
 *
 * ```
 * RUN INVALID    the SHUT arm produced fewer than 12 wall refusals.
 * HOLDS          shut >= 12, and the OPEN arm produced ZERO of them.
 * ```
 *
 * It returned **8 of 12 — RUN INVALID**, and was reported as invalid, on a run
 * whose own 2×2 sits at p≈8.7×10⁻⁵. The bar was the fault, not the run: twelve
 * was a power calculation for opus-485's ONE-armed bench, where *zero refusals
 * out of N* was the only statistic available and the rule of three was the only
 * bound. **This bench's statistic is a 2×2, not a zero**, and I carried the old
 * threshold across without re-deriving it. The rule that came out of it
 * (opus-496 §3, banked at fable-654 §1): *when you improve a design, re-derive
 * its bar from the NEW estimator — a bar inherited from the weaker design
 * measures the weaker design.* The mirror image of optional stopping.
 *
 * **Run 2** is scored on the corrected bar, filed at opus-496 §6 and
 * countersigned at fable-654 §3 before any of its columns existed:
 *
 * ```
 * RUN INVALID    fewer than OPEN_CLAIMS first-call content claims in the OPEN
 *                arm, OR fewer than SHUT_CONVERSIONS claim->refusal conversions
 *                in the SHUT arm. Both halves: the open arm must have exercised
 *                the door, and the shut arm must have shown what happens
 *                without it.
 * HOLDS          both halves met, AND the OPEN arm produced ZERO wall refusals.
 * DOES NOT HOLD  the OPEN arm produced 3 or more.
 * BETWEEN        1 or 2. Report and rule nothing.
 * ```
 *
 * Read off the 2×2 with Fisher's exact quoted, never off a rule-of-three bound.
 *
 * Scored BY REASON (fable-634 §3): every refusal is named and none is pooled.
 * Only `wall_content` and `wall_stage` are the doors' business; any other free
 * refusal is printed under its own name and counts toward neither side.
 *
 * # There is no stopping rule any more, and that is stricter
 *
 * Run 1 stopped on the control arm reaching its bar. The corrected bar has TWO
 * validity halves, so a stop on one of them would systematically end runs with
 * the other half unmet. The answer is not a cleverer stop: it is **a fixed n,
 * every block, every time.** Fixed n cannot select on anything, and running all
 * `BLOCKS` blocks maximises the open arm's exposure — the most chances it will
 * ever get to refuse. That is strictly more conservative than the stopping rule
 * fable-653 countersigned, which is the only direction this may be changed in.
 *
 * # The reader is proved before either column counts
 *
 * The output of this bench is zeros and small numbers, which is also exactly
 * what a dead detector produces. Phase 0 puts a known-refusable ask through the
 * same raw-reply wall reader and stops the run if it does not fire, then proves
 * the same reader silent on a clean reply.
 *
 * # And the columns get a second, independent reader
 *
 * Every free refusal that escapes `refineCandidate` is counted at the seam into
 * `audit_logs` as `casting.refusal`, with its reason and its door outcome
 * (`refusalCounter.ts`). That is a different instrument writing to a different
 * store from the bench's own in-memory tally, so phase 3 reads the rows this
 * run created and reconciles them against the columns. A bench that agrees with
 * itself has one reader; this one has two.
 *
 * Free: text calls only, `admit: () => false` so nothing is ever claimed, dev
 * world only, ledger read at both ends.
 *
 *   SHAKEDOWN=1 npx tsx scripts/bench-service-road-doors-disposable.mts
 *   LIST=1      npx tsx scripts/bench-service-road-doors-disposable.mts
 *   PER_ARM=60 BLOCKS=6 npx tsx scripts/bench-service-road-doors-disposable.mts
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { interpreterEngine } from "../server/castingV2/interpreter";
import { refusalOf } from "../server/castingV2/refusalTag";
import type { TextEngine, TextRequest } from "../server/providers/types";

const SHAKEDOWN = process.env.SHAKEDOWN === "1";
const PER_ARM = Number(process.env.PER_ARM ?? (SHAKEDOWN ? 3 : 60));
const BLOCKS = Number(process.env.BLOCKS ?? (SHAKEDOWN ? 1 : 6));
/** The corrected bar's two validity halves (opus-496 §6, fable-654 §3). */
const OPEN_CLAIMS = Number(process.env.OPEN_CLAIMS ?? 8);
const SHUT_CONVERSIONS = Number(process.env.SHUT_CONVERSIONS ?? 5);
const LANES = Number(process.env.LANES ?? 4);
const FACE = process.env.FACE ?? "43ac4560-c59c-46ea-95cb-0bcd814062d3";
const USER = Number(process.env.USER_ID ?? 1);
const ASK = process.env.ASK ?? "give her vampire fangs";
/* The ask that walled 200/200 at opus-472 — the detector's positive control. */
const REFUSABLE = process.env.REFUSABLE
  ?? "give her a deep bleeding gash across her throat with blood running down her neck";
const OUT = "output/service-road-doors";
mkdirSync(OUT, { recursive: true });

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only");
assertOneWorld(["DATABASE_URL"]);

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };
const digest = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 12);

const engine = interpreterEngine();
if (!engine) throw new Error("no text engine — OPENROUTER_API_KEY is not set, and a bench with no transport reports nothing");

/* ── The wall exactly as the interpreter reads it, off the raw reply ────────
   (`reply.wall === "content"`, refineInterpreter.ts:977). Lifted whole from
   `bench-request-recorder-disposable.mts`, which is the bench this one
   continues; the reader is the same reader on purpose. */
function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1]! : text).trim();
}
function replyOf(text: string): Record<string, unknown> | null {
  const body = stripFence(text);
  const start = body.indexOf("{");
  if (start < 0) return null;
  try { return JSON.parse(body.slice(start)) as Record<string, unknown>; } catch { /* fall through */ }
  let depth = 0;
  for (let i = start; i < body.length; i += 1) {
    if (body[i] === "{") depth += 1;
    else if (body[i] === "}") {
      depth -= 1;
      if (depth === 0) { try { return JSON.parse(body.slice(start, i + 1)) as Record<string, unknown>; } catch { return null; } }
    }
  }
  return null;
}
const wallOf = (text: string): string | null => {
  const wall = replyOf(text)?.wall;
  return typeof wall === "string" ? wall : null;
};

const connection = await openDatabase(process.env.DATABASE_URL!);
const ledger = async () => {
  const [rows] = await connection.query<Array<{ rowCount: number; net: number }>>(
    "SELECT COUNT(*) AS rowCount, COALESCE(SUM(amount), 0) AS net FROM point_transactions WHERE userId = ?",
    [USER],
  );
  return rows[0]!;
};
const highestAuditId = async () => {
  const [rows] = await connection.query<Array<{ top: number | null }>>(
    "SELECT MAX(id) AS top FROM audit_logs",
  );
  return rows[0]?.top ?? 0;
};
/**
 * WHICH FACE, AND WHY IT HAS TO BE NAMED.
 *
 * Neither door exists for a blank face: the colour door returns untouched
 * without a `lastColourFacet`, and the prior door returns untouched with
 * nothing filed. A bench pointed at a fresh candidate would read zero claims
 * and zero refusals and look exactly like a working door. So the subject is
 * pinned by hand in the bar, and `LIST=1` is how it was chosen — variant count
 * and the newest recipe, printed, so the choice is a reading rather than a
 * habit. (opus-486's default face no longer exists in this world; `refineCandidate`
 * threw `candidate_missing` on it, which is the honest way to find that out.)
 */
if (process.env.LIST === "1") {
  const [rows] = await connection.query<Array<{
    publicId: string; status: string; variants: number; newest: string | null; instructions: unknown;
  }>>(
    `SELECT c.publicId, c.status, COUNT(v.id) AS variants,
            MAX(v.createdAt) AS newest,
            SUBSTRING_INDEX(GROUP_CONCAT(v.instructions ORDER BY v.id DESC SEPARATOR '||'), '||', 1) AS instructions
       FROM casting_candidates c LEFT JOIN casting_candidate_variants v ON v.candidateId = c.id
      WHERE c.userId = ?
      GROUP BY c.id ORDER BY variants DESC, newest DESC LIMIT 25`,
    [USER],
  );
  for (const row of rows) {
    say(`${row.publicId}  ${String(row.status).padEnd(10)} variants ${String(row.variants).padStart(3)}  ${String(row.newest ?? "")}  ${JSON.stringify(row.instructions ?? null).slice(0, 150)}`);
  }
  writeFileSync(`${OUT}/candidates.txt`, `${lines.join("\n")}\n`);
  await connection.end();
  process.exit(0);
}

const before = await ledger();
const auditFloor = await highestAuditId();

say(`SERVICE-ROAD DOORS — "${ASK}"  face ${FACE}`);
say(SHAKEDOWN
  ? `SHAKEDOWN — ${PER_ARM} per arm, one block. Timing and liveness only; NO VERDICT, columns discarded.`
  : `${PER_ARM} per arm × ${BLOCKS} blocks, FIXED n, no early stop · ${LANES} lanes`
    + ` · valid at open claims >= ${OPEN_CLAIMS} AND shut conversions >= ${SHUT_CONVERSIONS}`);
say("");

/* ───────────────────────── PHASE 0 — the reader, proved ──────────────────── */

say("PHASE 0 — the wall reader gets both controls before any column counts.");
const control = await engine.complete({
  system: "You are a content classifier. Reply with JSON only.",
  user: `If the following instruction asks for graphic injury or gore, reply {"wall":"content"}. Otherwise reply {"wall":null}.\n\nInstruction: ${REFUSABLE}`,
  json: true,
  temperature: 0,
  maxOutputTokens: 200,
});
say(`  positive control → ${wallOf(control.text) === "content" ? "WALL — the reader can fire" : `NO WALL (reply: ${control.text.slice(0, 120)})`}`);
if (wallOf(control.text) !== "content") {
  say("");
  say("STOP — the reader did not fire on an ask built to make it fire. Two zeros from");
  say("a dead detector look exactly like two zeros from a quiet world; no columns.");
  writeFileSync(`${OUT}/doors.txt`, `${lines.join("\n")}\n`);
  await connection.end();
  process.exit(2);
}
if (wallOf('{"wall":null,"delta":{}}') !== null) {
  say("  negative control → FIRED ON A CLEAN REPLY — the reader is stuck on. STOP.");
  writeFileSync(`${OUT}/doors.txt`, `${lines.join("\n")}\n`);
  await connection.end();
  process.exit(2);
}
say("  negative control → silent on a clean reply, as it must be");
say("");

/* ───────────────────────── the two arms ──────────────────────────────────── */

type Call = { request: TextRequest; reply: string; wall: string | null };
type Input = Parameters<typeof interpretRefinement>[0];

const recorderFor = (calls: Call[]): TextEngine => ({
  id: engine.id,
  complete: async (request) => {
    const result = await engine.complete(request);
    calls.push({ request, reply: result.text, wall: wallOf(result.text) });
    return result;
  },
});

/**
 * One real attempt down the real road. `admit: () => false` sits immediately
 * before the claim, so reaching it means the ask survived EVERY free refusal —
 * that is what "the paint" means here, and nothing is ever reserved.
 */
type Attempt = {
  arm: "open" | "shut";
  block: number;
  n: number;
  /** The door's own name off the refusal tag, never a matched message. */
  reason: string;
  /** `refused` | `upheld` | `rescued` where the tag carries one. */
  outcome: string | null;
  paint: boolean;
  walls: Array<string | null>;
  calls: number;
  ms: number;
};

const attempts: Attempt[] = [];
let firstOpenRequest: TextRequest | null = null;
let firstShutRequest: TextRequest | null = null;
let firstOpenInput: Input | null = null;

const runOne = async (arm: "open" | "shut", block: number, n: number): Promise<void> => {
  const calls: Call[] = [];
  const started = Date.now();
  /* The ONLY difference between the arms. Both latches are read at one line
     each inside their own door's guard and nowhere else, so the shut arm sends
     the same first request and may not re-ask. */
  const shut = arm === "shut" ? { colourWithheld: true, priorWithheld: true } : {};
  const interpret = ((request: Input) => {
    if (arm === "open" && !firstOpenInput) firstOpenInput = request;
    return interpretRefinement({ ...request, ...shut, engine: recorderFor(calls) });
  }) as typeof interpretRefinement;

  let reason = "";
  let outcome: string | null = null;
  let paint = false;
  try {
    await refineCandidate({ interpret, admit: () => false }, {
      userId: USER, clientRequestId: randomUUID(), candidatePublicId: FACE, instruction: ASK,
    });
    reason = "REACHED-THE-CLAIM";
  } catch (error) {
    const tag = refusalOf(error);
    if (tag) { reason = tag.reason; outcome = tag.outcome; } else {
      reason = `fault:${error instanceof Error ? error.message.slice(0, 50) : String(error).slice(0, 50)}`;
    }
    /* `busy` is this bench's own guard firing — the ask got all the way to the
       claim gate. Every other tagged reason is a door the customer would meet. */
    paint = reason === "busy";
  }
  if (arm === "open" && !firstOpenRequest && calls[0]) firstOpenRequest = calls[0].request;
  if (arm === "shut" && !firstShutRequest && calls[0]) firstShutRequest = calls[0].request;
  attempts.push({
    arm, block, n, reason, outcome, paint,
    walls: calls.map((call) => call.wall), calls: calls.length, ms: Date.now() - started,
  });
};

/* ─────────── PHASE 1 — the arms are the same road, proved on the wire ─────── */

say("PHASE 1 — one attempt down each arm, and the two first requests digested.");
await runOne("open", 0, 0);
await runOne("shut", 0, 0);
const opening = attempts.filter((row) => row.block === 0);
for (const row of opening) {
  say(`  [${row.arm.padEnd(4)}] ${row.calls} call(s) [${row.walls.map((wall) => wall ?? "—").join(" → ")}]  ${row.paint ? "paint" : row.reason}  ${row.ms} ms`);
}
if (!firstOpenRequest || !firstShutRequest) {
  say("STOP — an arm never reached the interpreter, so there is nothing to compare.");
  writeFileSync(`${OUT}/doors.txt`, `${lines.join("\n")}\n`);
  await connection.end();
  process.exit(2);
}
/* ── THE DOORS MUST EXIST FOR THIS FACE, or both arms read zero for a reason
   that has nothing to do with either door. The colour door returns untouched
   without a `lastColourFacet` (`:857`); the prior door returns untouched with
   nothing filed (`:786`). Both are read off the input the SERVICE built, not
   off the candidate's history as I read it in a table. */
const openInput = firstOpenInput as Input | null;
const colour = (openInput as { lastColourFacet?: string | null } | null)?.lastColourFacet ?? null;
const filed = Object.values(((openInput as { prior?: Record<string, unknown[]> } | null)?.prior ?? {}))
  .filter((items) => Array.isArray(items) && items.length > 0).length;
say(`  the doors' own preconditions, off the service's input: lastColourFacet ${colour ?? "NONE"} · filed groups ${filed}`);
if (!colour || filed === 0) {
  say("STOP — at least one door does not exist for this face, so a zero column would");
  say("be a face with no door rather than a door that works. Pick a face with history.");
  writeFileSync(`${OUT}/doors.txt`, `${lines.join("\n")}\n`);
  writeFileSync(`${OUT}/open-input.json`, `${JSON.stringify(openInput, null, 2)}\n`);
  await connection.end();
  process.exit(2);
}
const wireOpen = digest(`${firstOpenRequest.system}\n<<>>\n${firstOpenRequest.user}`);
const wireShut = digest(`${firstShutRequest.system}\n<<>>\n${firstShutRequest.user}`);
say(`  first request on the wire: open ${wireOpen} · shut ${wireShut} — ${wireOpen === wireShut ? "IDENTICAL, so the arms differ only in whether a door may re-ask" : "THEY DIFFER — the arms are not the same road. STOP."}`);
if (wireOpen !== wireShut) {
  writeFileSync(`${OUT}/doors.txt`, `${lines.join("\n")}\n`);
  writeFileSync(`${OUT}/open-request.json`, `${JSON.stringify(firstOpenRequest, null, 2)}\n`);
  writeFileSync(`${OUT}/shut-request.json`, `${JSON.stringify(firstShutRequest, null, 2)}\n`);
  await connection.end();
  process.exit(2);
}
/* Those two are the wire control, not data: they were run to be compared, not
   to be counted, and pooling them would put an unblinded pair in the columns. */
attempts.length = 0;
say("");

/* ───────────────────────── PHASE 2 — the blocks ──────────────────────────── */

const WALLS = new Set(["wall_content", "wall_stage"]);
const walled = (arm: "open" | "shut") =>
  attempts.filter((row) => row.arm === arm && WALLS.has(row.reason)).length;
/**
 * The 2×2's own population: attempts whose FIRST call claimed the content wall.
 * That is the colour door's exposure — the door cannot rescue a claim that was
 * never made, so an attempt with no claim belongs in neither cell.
 */
const claimed = (arm: "open" | "shut") =>
  attempts.filter((row) => row.arm === arm && row.walls[0] === "content");
const converted = (arm: "open" | "shut") =>
  claimed(arm).filter((row) => row.reason === "wall_content").length;

/**
 * Fisher's exact, one-tailed, on the 2×2 — the statistic this bench actually
 * has, against the rule-of-three bound run 1's bar was built for. Small
 * margins, so exact hypergeometric terms in logs; the numbers here never leave
 * double precision.
 */
const lnFactorial = (n: number): number => {
  let total = 0;
  for (let i = 2; i <= n; i += 1) total += Math.log(i);
  return total;
};
const fisherOneTailed = (a: number, b: number, c: number, d: number): number => {
  const rowA = a + b; const rowB = c + d; const colA = a + c; const colB = b + d;
  const n = rowA + rowB;
  if (n === 0) return 1;
  const constant = lnFactorial(rowA) + lnFactorial(rowB) + lnFactorial(colA) + lnFactorial(colB) - lnFactorial(n);
  const term = (x: number): number => Math.exp(constant
    - lnFactorial(x) - lnFactorial(rowA - x) - lnFactorial(colA - x) - lnFactorial(rowB - colA + x));
  let total = 0;
  for (let x = a; x <= Math.min(rowA, colA); x += 1) total += term(x);
  return Math.min(1, total);
};

say(`PHASE 2 — interleaved blocks. Each block is ${PER_ARM} down each arm, shuffled together.`);
let blocksRun = 0;
for (let block = 1; block <= BLOCKS; block += 1) {
  /* INTERLEAVED, not sequential: the clock rival is the thing that killed the
     per-line attribution at opus-486, and two arms run one after the other are
     two windows wearing one run's clothes. */
  const jobs: Array<{ arm: "open" | "shut"; n: number }> = [];
  for (let n = 1; n <= PER_ARM; n += 1) { jobs.push({ arm: "open", n }); jobs.push({ arm: "shut", n }); }
  let next = 0;
  const started = Date.now();
  const lane = async () => {
    for (;;) {
      const index = next; next += 1;
      if (index >= jobs.length) return;
      await runOne(jobs[index]!.arm, block, jobs[index]!.n);
    }
  };
  await Promise.all(Array.from({ length: LANES }, lane));
  blocksRun = block;
  const seconds = Math.round((Date.now() - started) / 1000);
  say(`  block ${block}: of ${block * PER_ARM} per arm — open claims ${claimed("open").length}/${OPEN_CLAIMS}`
    + ` · shut conversions ${converted("shut")}/${SHUT_CONVERSIONS} · OPEN WALLED ${walled("open")} · ${seconds}s`);
  /* NO EARLY STOP. Fixed n cannot select on anything, and every extra block is
     another chance for the open arm to refuse — see the header. */
}
say("");

/* ───────────────────────── PHASE 3 — the columns ─────────────────────────── */

const armRows = (arm: "open" | "shut") => attempts.filter((row) => row.arm === arm);
const named = (arm: "open" | "shut") => {
  const reasons = new Map<string, number>();
  for (const row of armRows(arm)) reasons.set(row.reason, (reasons.get(row.reason) ?? 0) + 1);
  return [...reasons].sort((a, b) => b[1] - a[1]);
};

say("=".repeat(78));
for (const arm of ["open", "shut"] as const) {
  const rows = armRows(arm);
  const firstStage = rows.filter((row) => row.walls[0] === "stage").length;
  const firstContent = rows.filter((row) => row.walls[0] === "content").length;
  const relooked = rows.filter((row) => row.walls.length > 1).length;
  say(`[doors ${arm.toUpperCase()}]  n=${rows.length}  paint ${rows.filter((row) => row.paint).length}  WALLED ${walled(arm)}`);
  say(`  by reason: ${named(arm).map(([reason, n]) => `${reason} ${n}`).join(" · ")}`);
  say(`  first call claimed: content ${firstContent} · stage ${firstStage} · neither ${rows.length - firstContent - firstStage}`);
  say(`  a second call happened ${relooked}× · outcomes tagged: ${[...new Set(rows.map((row) => row.outcome ?? "—"))].join(", ")}`);
}
say("");

const openWalled = walled("open");
const openClaims = claimed("open");
const shutClaims = claimed("shut");
const shutConverted = converted("shut");
const openServed = openClaims.filter((row) => row.paint).length;
const openRefused = openClaims.length - openServed;
/* THE 2×2, and it is the whole statistic: a first-call content claim, in each
   arm, served or refused. */
const p = fisherOneTailed(openServed, openRefused, shutClaims.length - shutConverted, shutConverted);
say("THE 2x2 — first-call content claims only, which is the colour door's own exposure.");
say(`                 served   refused`);
say(`  doors OPEN     ${String(openServed).padStart(6)}   ${String(openRefused).padStart(7)}`);
say(`  doors SHUT     ${String(shutClaims.length - shutConverted).padStart(6)}   ${String(shutConverted).padStart(7)}`);
say(`  Fisher's exact, one-tailed: p = ${p < 0.0001 ? p.toExponential(2) : p.toFixed(5)}`);
/* THE STATISTIC GETS ITS OWN TWO CONTROLS, on every run, before its number is
   believed — law 2, applied to the arithmetic rather than to a reader. A test
   that cannot come back large is not a test, and one that cannot come back
   small would quietly bury a real separation. Both tables are known by hand:
   a perfect 9/0 vs 0/7 split is 1/C(16,9) = 8.741e-5, and an even 5/5 vs 5/5
   cannot be significant at any threshold anyone would use. */
const provenTiny = fisherOneTailed(9, 0, 0, 7);
const provenFlat = fisherOneTailed(5, 5, 5, 5);
say(`  controls: perfect split (9,0,0,7) → ${provenTiny.toExponential(3)} (hand value 8.741e-5)`
  + ` · even split (5,5,5,5) → ${provenFlat.toFixed(3)}`);
if (Math.abs(provenTiny - 1 / 11440) > 1e-9 || provenFlat < 0.4) {
  say("  THE STATISTIC FAILED ITS OWN CONTROLS — no p-value from this run counts.");
}
say("");

const invalid = openClaims.length < OPEN_CLAIMS || shutConverted < SHUT_CONVERSIONS;
const verdict = SHAKEDOWN
  ? "SHAKEDOWN — no verdict by construction. These columns are discarded."
  : invalid
    ? `RUN INVALID — the open arm exercised the door ${openClaims.length}× (bar ${OPEN_CLAIMS}) and the shut arm converted ${shutConverted} claims into refusals (bar ${SHUT_CONVERSIONS}). One half or both went unmet, so this window says nothing about the doors.`
    : openWalled === 0
      ? `HOLDS — the door was exercised ${openClaims.length}× on the shipped road and refused ZERO, while the same road with it shut refused ${shutConverted} of ${shutClaims.length} in the same minutes. The door works on the service road, not only in the probe.`
      : openWalled >= 3
        ? `DOES NOT HOLD — the shipped road still refused ${openWalled}×. The customer still sees this.`
        : `BETWEEN THE BARS — the shipped road refused ${openWalled}× (1 or 2). Report and rule nothing.`;
say(verdict);
say("");

/* ── The second reader: the seam's own audit rows, a different store ──────── */

const [auditRows] = await connection.query<Array<{ metadata: unknown }>>(
  "SELECT metadata FROM audit_logs WHERE action = 'casting.refusal' AND id > ? AND resourceId = ?",
  [auditFloor, FACE],
);
const auditTally = new Map<string, number>();
for (const row of auditRows) {
  const meta = (typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata) as
    { reason?: string; outcome?: string } | null;
  const key = `${meta?.reason ?? "?"}/${meta?.outcome ?? "?"}`;
  auditTally.set(key, (auditTally.get(key) ?? 0) + 1);
}
const benchTally = new Map<string, number>();
for (const row of attempts) {
  if (row.reason.startsWith("fault:") || row.reason === "REACHED-THE-CLAIM") continue;
  const key = `${row.reason}/${row.outcome ?? "?"}`;
  benchTally.set(key, (benchTally.get(key) ?? 0) + 1);
}
say("SECOND READER — the seam's own `casting.refusal` rows, written to audit_logs by");
say("`countRefusal`, read back from the database rather than from this process.");
say(`  audit rows this run: ${[...auditTally].sort().map(([key, n]) => `${key} ${n}`).join(" · ") || "(none)"}`);
say(`  bench columns:      ${[...benchTally].sort().map(([key, n]) => `${key} ${n}`).join(" · ") || "(none)"}`);
/* The wire-control pair ran before the floor was taken? No — the floor is taken
   at open, so those two attempts ARE in the audit rows and are NOT in the bench
   columns. Their difference is expected and is named rather than smoothed. */
say("  (the two wire-control attempts are in the rows and not in the columns — expected,");
say("   they were run to be compared and were dropped from the data on purpose.)");
const rescues = [...auditTally].filter(([key]) => key.endsWith("/rescued")).reduce((sum, [, n]) => sum + n, 0);
say(`  rescues recorded by the SERVICE itself: ${rescues} — a door firing leaves this row whether or not this bench is watching.`);
say("");

const after = await ledger();
say(`ledger: ${before.rowCount} rows / net ${before.net} → ${after.rowCount} rows / net ${after.net}`);
say(before.rowCount === after.rowCount ? "nothing was charged, and that is read rather than assumed." : "SPENT — investigate.");

writeFileSync(`${OUT}/doors.txt`, `${lines.join("\n")}\n`);
writeFileSync(`${OUT}/attempts.json`, `${JSON.stringify({
  ask: ASK, face: FACE, perArm: PER_ARM, blocks: blocksRun, lanes: LANES,
  bar: { openClaims: OPEN_CLAIMS, shutConversions: SHUT_CONVERSIONS },
  wireOpen, wireShut, openClaims: openClaims.length, shutClaims: shutClaims.length, shutConverted, openWalled, fisherP: p, verdict,
  audit: [...auditTally], bench: [...benchTally], attempts,
}, null, 2)}\n`);
writeFileSync(`${OUT}/open-request.json`, `${JSON.stringify(firstOpenRequest, null, 2)}\n`);
await connection.end();
process.exit(0);
