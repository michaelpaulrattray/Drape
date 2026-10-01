/**
 * COMPOSE THE MANAGER SEAT'S PROMPT — the brief, with this pass's facts in it
 * (#1658, founder-ordered 2026-10-01).
 *
 *     npx tsx scripts/manager-brief.mts \
 *       --queue   .agents/shift-logs/manager-queue-20261001-122100.json \
 *       --prs     .agents/shift-logs/manager-prs-20261001-122100.json \
 *       --pass    20261001-122100 \
 *       --read-at 2026-10-01T02:21:00.000Z \
 *       --out     .agents/shift-logs/manager-prompt-20261001-122100.txt
 *
 * It prints ONE machine-readable line:
 *
 *     BRIEF 53 cards | 29 areas | 6412 characters
 *     BRIEF none | the queue snapshot at … names no cards
 *
 * # ⚠ WHY THIS IS A TRACKED SCRIPT AND NOT TEN LINES OF THE RUNNER
 *
 * `.agents/foreman/foreman-runner.ps1` is gitignored, so nothing in it can ever
 * be held by a suite — the standing orders say so about themselves repeatedly,
 * and every control that has quietly rotted in this team lived there. Two things
 * here must not rot:
 *
 *  1. ⚠ **the area vocabulary is DERIVED from the Atlas, through the same
 *     `buildAreaIndex` the cutter's wall uses.** The brief tells the manager which
 *     names are acceptable and `managerArea` discards any other; if those two
 *     lists were written separately, every pass would be one typo away from a
 *     manager naming an area the cut silently drops. One reader, one list
 *     (working law 4). Doing it in PowerShell would also mean `ConvertFrom-Json`
 *     over a 1.1 MB artifact in 5.1, which is slow enough to notice;
 *  2. **no placeholder may survive into the prompt.** A `{{CARD_COUNT}}` reaching
 *     the manager as literal braces is a brief that silently asks for nothing, and
 *     the session would still produce a plausible sheet. It is refused here.
 *
 * ⚠ **THE BRIEF'S OWN HEADER IS STRIPPED.** Everything above the first `---` in
 * `docs/specs/MANAGER_SEAT_BRIEF.md` is about the brief — which file reads it,
 * which placeholders exist, why it is tracked — and is for a shift, not for the
 * manager. Sending it would hand the manager instructions about its own
 * plumbing, which is the opposite of the point.
 *
 * Fails toward NO PROMPT: every refusal exits non-zero having written nothing, the
 * runner then skips the manager, and the cut runs exactly as it did before this
 * card.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildAreaIndex } from "./lib/seatBatches.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["queue", "prs", "pass", "read-at", "out", "brief", "atlas", "repo"],
  boolean: [],
});

const outPath = ARGS.value("out") === null ? null : resolve(ARGS.value("out")!);

function refuse(why: string): never {
  if (outPath !== null) {
    try {
      rmSync(outPath, { force: true });
    } catch {
      /* Must not mask the real reason. */
    }
  }
  console.error(`manager-brief: REFUSING — ${why}`);
  console.log(`BRIEF none | ${why}`);
  process.exit(1);
}

function required(name: string): string {
  const raw = ARGS.value(name);
  if (raw === null || raw.trim() === "") refuse(`--${name} is required`);
  return raw.trim();
}

const queuePath = resolve(required("queue"));
const prsPath = resolve(required("prs"));
const pass = required("pass");
const readAt = required("read-at");
if (!Number.isFinite(Date.parse(readAt))) refuse(`--read-at "${readAt}" is not a time`);
if (outPath === null) refuse("--out is required");

const briefPath = resolve(ARGS.value("brief") ?? "docs/specs/MANAGER_SEAT_BRIEF.md");
const atlasPath = resolve(ARGS.value("atlas") ?? "docs/architecture/drape-architecture.json");
const repo = ARGS.value("repo") ?? process.cwd();

if (!existsSync(prsPath)) refuse(`the pull-request snapshot at ${prsPath} does not exist`);

let template = "";
try {
  template = readFileSync(briefPath, "utf8");
} catch (error) {
  refuse(`the brief at ${briefPath} could not be read (${error instanceof Error ? error.message : String(error)})`);
}

/* The header is about the brief, not for the manager — see the docblock. */
const separator = template.indexOf("\n---\n");
if (separator < 0) refuse(`the brief at ${briefPath} has no \`---\` separating its header from the brief itself`);
const body = template.slice(separator + "\n---\n".length).trimStart();
if (body.trim() === "") refuse(`the brief at ${briefPath} is empty below its header`);

type QueueRow = { readonly number?: unknown };
let cardCount = 0;
try {
  const rows = JSON.parse(readFileSync(queuePath, "utf8")) as unknown;
  if (!Array.isArray(rows)) refuse(`the queue snapshot at ${queuePath} is not an array`);
  cardCount = (rows as QueueRow[]).filter(
    (row) => typeof row?.number === "number" && Number.isSafeInteger(row.number) && (row.number as number) > 0,
  ).length;
} catch (error) {
  refuse(`the queue snapshot could not be read (${error instanceof Error ? error.message : String(error)})`);
}
if (cardCount === 0) refuse(`the queue snapshot at ${queuePath} names no cards`);

/*
  THE AREA VOCABULARY, through the cutter's own index so the brief and the wall
  read one list. `buildAreaIndex` already drops the Atlas's `unassigned`, which is
  why that word is not filtered again here — a card naming only unassigned files
  has named no area, and the brief's `null` is the answer for it.
*/
let domains: readonly string[] = [];
try {
  const atlas = JSON.parse(readFileSync(atlasPath, "utf8")) as {
    modules?: readonly { path?: string | null; domain?: string | null }[];
  };
  if (!Array.isArray(atlas.modules) || atlas.modules.length === 0) {
    refuse(`the Atlas at ${atlasPath} lists no modules, so there is no area vocabulary`);
  }
  domains = buildAreaIndex(atlas.modules).domains;
} catch (error) {
  refuse(`the Atlas could not be read (${error instanceof Error ? error.message : String(error)})`);
}
if (domains.length === 0) refuse("the Atlas yielded no domains, so the manager would have no vocabulary");

const substitutions: Record<string, string> = {
  QUEUE_FILE: queuePath,
  PRS_FILE: prsPath,
  PASS: pass,
  READ_AT: readAt,
  CARD_COUNT: String(cardCount),
  AREAS: [...domains].sort().join("\n"),
  REPO: repo,
};

let prompt = body;
for (const [key, value] of Object.entries(substitutions)) {
  prompt = prompt.split(`{{${key}}}`).join(value);
}

/* ⚠ NOTHING MAY SURVIVE. A placeholder reaching the manager as literal braces is
   a brief that asks for nothing and still gets a plausible answer. */
const leftover = [...prompt.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((match) => match[1]!);
if (leftover.length > 0) {
  refuse(`the brief still names ${[...new Set(leftover)].map((name) => `{{${name}}}`).join(", ")} after substitution`);
}

try {
  writeFileSync(outPath, prompt, "utf8");
} catch (error) {
  refuse(`the prompt could not be written to ${outPath} (${error instanceof Error ? error.message : String(error)})`);
}

console.log(`BRIEF ${cardCount} cards | ${domains.length} areas | ${prompt.length} characters`);

/* AND THE LAST STATEMENT ENDS THE PROCESS (`server/scriptExitDiscipline.test.ts`). */
process.exit(0);
