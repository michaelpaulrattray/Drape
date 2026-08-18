/**
 * WHAT DOES THE SERVICE SEND THAT THE PROBE DOES NOT? — the full-request
 * recorder named in opus-474 §3, built after opus-475 retired the one reading
 * that had ruled a suspect out.
 *
 * # Why this exists
 *
 * ```
 * through the SERVICE      3 walls /  42   ≈ 7.1%
 * through the INTERPRETER  1 wall  / 630   ≈ 0.16%   (all direct arms pooled)
 * ```
 *
 * Two orders of magnitude on the same sentence, and two mechanisms have already
 * been proposed and refuted by measurement. Both times the theory was about
 * what the service sends, and **nobody had ever looked at what the service
 * sends.** The origin bench recorded mode, restatement and a prior count — and
 * the prior count was `Array.isArray(objectValued) ? … : 0`, so it printed zero
 * whatever was there. This records the WHOLE thing instead of three fields.
 *
 * # Three phases
 *
 *   RECORD  drive the real service with the claim door shut, capturing BOTH the
 *           whole `RefineInterpretInput` it hands the interpreter AND every
 *           `complete()` request that input causes, entire.
 *   DIFF    the service's input and user message beside the bare probe's, line
 *           by line. This is the artifact opus-474 said we do not have.
 *   REPLAY  that captured input ×n through the real `interpretRefinement`
 *           against the bare input ×n — same function, same code path, the
 *           input the only difference — with every engine call's own `wall`
 *           value recorded underneath, so the mechanism is named and not
 *           narrated.
 *
 * # The bar, filed at opus-475 before any column
 *
 * ```
 * CONFIRMED-IN-THE-BYTES  service arm ≥5 walls AND ≥4× the bare arm's rate
 * REFUTED                 the two arms within a factor of two
 * UNDERPOWERED            fewer than 5 walls across both arms — no ruling
 * ```
 *
 * The per-call taxonomy under the columns is OBSERVATION, not a second verdict:
 * it cannot move the ruling above, only explain it.
 *
 * # The reader is proved before either column counts
 *
 * The output of this bench is zeros and small numbers, which is also exactly
 * what a dead wall-detector produces. So a known-refusable ask goes through the
 * SAME raw-reply reader first, and the run stops if it does not read as a wall.
 *
 * Free: text calls only, `admit: () => false`, ledger read at both ends.
 *
 *   SAMPLES=120 ATTEMPTS=3 npx tsx scripts/bench-request-recorder-disposable.mts
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { interpreterEngine } from "../server/castingV2/interpreter";
import type { TextEngine, TextRequest } from "../server/providers/types";

const SAMPLES = Number(process.env.SAMPLES ?? 120);
const ATTEMPTS = Number(process.env.ATTEMPTS ?? 3);
const LANES = Number(process.env.LANES ?? 4);
const FACE = process.env.FACE ?? "43ac4560-c59c-46ea-95cb-0bcd814062d3";
const USER = Number(process.env.USER_ID ?? 1);
const ASK = process.env.ASK ?? "give her vampire fangs";
/* The ask that walled 200/200 at opus-472 — the detector's positive control. */
const REFUSABLE = process.env.REFUSABLE
  ?? "give her a deep bleeding gash across her throat with blood running down her neck";
const OUT = "output/request-recorder";
mkdirSync(OUT, { recursive: true });

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only");
assertOneWorld(["DATABASE_URL"]);

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };
const digest = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 12);

const engine = interpreterEngine();
if (!engine) throw new Error("no text engine — OPENROUTER_API_KEY is not set, and a bench with no transport reports nothing");

/* The wall exactly as the interpreter reads it, off the raw reply
   (`reply.wall === "content"`, refineInterpreter.ts:977). */
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
const before = await ledger();

say(`REQUEST RECORDER — "${ASK}"`);
say(`record ${ATTEMPTS} service attempts · replay ${SAMPLES} per arm (${LANES} lanes) · face ${FACE}`);
say("");

/* ───────────────────────── PHASE 0 — the reader, proved ──────────────────── */

say("PHASE 0 — the wall reader gets a positive control before any column counts.");
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
  writeFileSync(`${OUT}/recorder.txt`, `${lines.join("\n")}\n`);
  await connection.end();
  process.exit(2);
}
if (wallOf('{"wall":null,"delta":{}}') !== null) {
  say("  negative control → FIRED ON A CLEAN REPLY — the reader is stuck on. STOP.");
  writeFileSync(`${OUT}/recorder.txt`, `${lines.join("\n")}\n`);
  await connection.end();
  process.exit(2);
}
say("  negative control → silent on a clean reply, as it must be");
say("");

/* ───────────────────────── PHASE 1 — record ──────────────────────────────── */

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

say(`PHASE 1 — RECORD. ${ATTEMPTS} real service attempts; the interpreter's whole input captured.`);
const captured: Array<{ attempt: number; door: string; input: Input | null; calls: Call[] }> = [];

for (let n = 1; n <= ATTEMPTS; n += 1) {
  const calls: Call[] = [];
  let input: Input | null = null;
  const interpret = ((request: Input) => {
    input = request;
    return interpretRefinement({ ...request, engine: recorderFor(calls) });
  }) as typeof interpretRefinement;

  let door = "";
  try {
    await refineCandidate({ interpret, admit: () => false }, {
      userId: USER, clientRequestId: randomUUID(), candidatePublicId: FACE, instruction: ASK,
    });
    door = "REACHED THE CLAIM (the bench's own guard failed)";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    door = message.includes("Casting is busy right now") ? "THE PAINT" : message.slice(0, 70);
  }
  captured.push({ attempt: n, door, input, calls });
  say(`  #${n}  ${door === "THE PAINT" ? "paint" : "WALL "}  ${calls.length} engine call(s) [${calls.map((call) => call.wall ?? "—").join(" → ")}]  ${door}`);
}

const withInput = captured.filter((row) => row.input !== null);
if (withInput.length === 0) {
  say("STOP — the service never called the interpreter through the recorder. Nothing to replay.");
  writeFileSync(`${OUT}/recorder.txt`, `${lines.join("\n")}\n`);
  await connection.end();
  process.exit(2);
}
/* A control on the capture itself: the input must be the same every attempt,
   or "the service's input" is not one thing and the replay means less. */
const inputShape = (input: Input) => JSON.stringify({ ...input, engine: undefined, signal: undefined });
const distinctInputs = new Set(withInput.map((row) => inputShape(row.input!)));
say(`  ${withInput.length} input(s) captured · ${distinctInputs.size} distinct — ${distinctInputs.size === 1 ? "the service sends one shape, so replaying it means something" : "THEY DIFFER; the replay speaks only for the one it uses"}`);

const SERVICE_INPUT = { ...withInput[0]!.input!, engine: undefined, signal: undefined } as Input;
const BARE_INPUT = { instruction: ASK, prior: {} } as unknown as Input;

/* ───────────────────────── PHASE 2 — diff ────────────────────────────────── */

say("");
say("PHASE 2 — DIFF. What the service hands the interpreter that the bare probe does not.");
const serviceKeys = Object.entries(SERVICE_INPUT as Record<string, unknown>)
  .filter(([key, value]) => key !== "engine" && key !== "signal" && value !== undefined);
for (const [key, value] of serviceKeys) {
  say(`  ${key.padEnd(20)} ${JSON.stringify(value).slice(0, 140)}`);
}
say("");

/* The derived user message, which is what the model actually reads. */
const derive = async (input: Input) => {
  const calls: Call[] = [];
  await interpretRefinement({ ...input, engine: recorderFor(calls) });
  return calls[0]!.request;
};
const SERVICE_REQUEST = withInput[0]!.calls[0]?.request ?? await derive(SERVICE_INPUT);
const BARE_REQUEST = await derive(BARE_INPUT);
const serviceLines = SERVICE_REQUEST.user.split("\n");
const bareLines = BARE_REQUEST.user.split("\n");
say(`  system prompts ${SERVICE_REQUEST.system === BARE_REQUEST.system ? "IDENTICAL" : `DIFFER (${SERVICE_REQUEST.system.length} B vs ${BARE_REQUEST.system.length} B)`}`);
say(`  user message: service ${serviceLines.length} lines / ${SERVICE_REQUEST.user.length} B · bare ${bareLines.length} lines / ${BARE_REQUEST.user.length} B`);
say("  --- the service's user message, entire ---");
for (const line of serviceLines) say(`  | ${line}`);
say("  --- lines the service sends that the bare probe does not ---");
const onlyService = serviceLines.filter((line) => !bareLines.includes(line));
if (onlyService.length === 0) say("  (none — the two agree line for line)");
for (const line of onlyService) say(`  + ${line}`);
say("");

/* ───────────────────────── PHASE 3 — replay ──────────────────────────────── */

say(`PHASE 3 — REPLAY. ${SAMPLES} per arm through the real interpretRefinement.`);

type Attempt = { arm: string; n: number; walled: boolean; reason: string; walls: Array<string | null> };
const attempts: Attempt[] = [];

const runOne = async (arm: string, input: Input, n: number): Promise<void> => {
  const calls: Call[] = [];
  try {
    const answer = await interpretRefinement({ ...input, engine: recorderFor(calls) });
    const reason = answer.ok ? "served" : answer.refusal.reason;
    attempts.push({ arm, n, walled: reason === "wall_content", reason, walls: calls.map((call) => call.wall) });
  } catch (error) {
    attempts.push({ arm, n, walled: false, reason: `error:${error instanceof Error ? error.message.slice(0, 40) : ""}`, walls: [] });
  }
};

const pool = async (arm: string, input: Input) => {
  let next = 1;
  const lane = async () => {
    for (;;) {
      const n = next; next += 1;
      if (n > SAMPLES) return;
      await runOne(arm, input, n);
    }
  };
  await Promise.all(Array.from({ length: LANES }, lane));
};

for (const arm of [{ key: "service-input", input: SERVICE_INPUT }, { key: "bare-input", input: BARE_INPUT }]) {
  const started = Date.now();
  await pool(arm.key, arm.input);
  const mine = attempts.filter((row) => row.arm === arm.key);
  const walls = mine.filter((row) => row.walled).length;
  say(`  [${arm.key}] ${walls}/${SAMPLES} wall_content — ${((walls / SAMPLES) * 100).toFixed(1)}%  (${Math.round((Date.now() - started) / 1000)}s)`);
}

const count = (arm: string, predicate: (row: Attempt) => boolean) =>
  attempts.filter((row) => row.arm === arm && predicate(row)).length;
const service = count("service-input", (row) => row.walled);
const bare = count("bare-input", (row) => row.walled);

say("");
say("=".repeat(78));
say(`service-input ${service}/${SAMPLES}   bare-input ${bare}/${SAMPLES}`);
const verdict = service + bare < 5
  ? "UNDERPOWERED — fewer than five walls across both arms. No ruling."
  : service >= 5 && service >= 4 * Math.max(bare, 1)
    ? "CONFIRMED-IN-THE-BYTES — the difference is inside what the service hands the interpreter."
    : service <= 2 * Math.max(bare, 1) && bare <= 2 * Math.max(service, 1)
      ? "REFUTED — the two arms are within a factor of two; the service's input is exonerated."
      : "BETWEEN THE BARS — report the numbers and rule nothing.";
say(verdict);

/* ── The taxonomy underneath: OBSERVATION, it cannot move the verdict above ── */
say("");
say("PER-CALL TAXONOMY (observation — it explains the columns, it does not rule).");
for (const arm of ["service-input", "bare-input"]) {
  const mine = attempts.filter((row) => row.arm === arm);
  const firstStage = mine.filter((row) => row.walls[0] === "stage").length;
  const firstContent = mine.filter((row) => row.walls[0] === "content").length;
  const relooked = mine.filter((row) => row.walls.length > 1).length;
  const relookContent = mine.filter((row) => row.walls.length > 1 && row.walls[row.walls.length - 1] === "content").length;
  say(`  [${arm}] first call: stage ${firstStage} · content ${firstContent} · neither ${mine.length - firstStage - firstContent}`);
  say(`  [${arm}] a second call happened ${relooked}× · of those, the last call claimed content ${relookContent}×`);
  const reasons = new Map<string, number>();
  for (const row of mine) reasons.set(row.reason, (reasons.get(row.reason) ?? 0) + 1);
  say(`  [${arm}] outcomes: ${[...reasons].map(([reason, n]) => `${reason} ${n}`).join(" · ")}`);
}

const after = await ledger();
say(`ledger: ${before.rowCount} rows / net ${before.net} → ${after.rowCount} rows / net ${after.net}`);
say(before.rowCount === after.rowCount ? "nothing was charged, and that is read rather than assumed." : "SPENT — investigate.");

writeFileSync(`${OUT}/recorder.txt`, `${lines.join("\n")}\n`);
writeFileSync(`${OUT}/service-input.json`, `${JSON.stringify(SERVICE_INPUT, null, 2)}\n`);
writeFileSync(`${OUT}/service-request.json`, `${JSON.stringify(SERVICE_REQUEST, null, 2)}\n`);
writeFileSync(`${OUT}/bare-request.json`, `${JSON.stringify(BARE_REQUEST, null, 2)}\n`);
writeFileSync(`${OUT}/replay.json`, `${JSON.stringify({ ask: ASK, samples: SAMPLES, service, bare, verdict, attempts }, null, 2)}\n`);
await connection.end();
process.exit(0);
