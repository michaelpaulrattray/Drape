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
 * # ⚠ AND IT WRITES THE SNAPSHOTS THE MANAGER CAN ACTUALLY READ (2026-10-01)
 *
 * **The first armed pass produced no sheet, and this was why.** `gh issue list
 * --json …` prints COMPACT JSON: one line, no newline at the end. Pass
 * `20261001-141427`'s queue snapshot was **171,326 bytes on a single line**, and
 * the manager holds `Read`, `Grep` and `Glob` and nothing else. Measured on a
 * byte-for-byte size control that same hour:
 *
 *  - `Read` returns **the first 21,249 of 171,326 characters** and says the file
 *    *"has very long lines and cannot be paginated by line"*;
 *  - `offset`/`limit` are LINE offsets, so `offset: 2` on a one-line file is
 *    refused as past the end of the file — there is no second page to ask for;
 *  - the real snapshot's first 21,249 characters hold **5 of its 54 card
 *    numbers**, so 49 cards were unreachable by any tool the session had.
 *
 * The brief asked for exactly 54 rows, one per card, from a file the session
 * could see 5 cards of. It spent ten minutes on that and was killed at the
 * ceiling, and because `--output-format json` emits one envelope at the END, the
 * log was empty and the pass read as *the manager produced nothing*.
 *
 * So the snapshots are re-written here, **pretty-printed**, and the brief cites
 * THOSE paths. Same bytes of data, same shape, one JSON value per line — which
 * is all `Read` needs to paginate: the real queue becomes 1,028 lines, and a
 * 5,326-character body line comes back whole (the per-read cap is on the whole
 * read, never on a line). The raw snapshots are left exactly where the runner
 * put them, because the sheet writer's allowlists are read from them.
 *
 * ⚠ **The line counts go INTO the brief** (`{{QUEUE_LINES}}`, `{{PRS_LINES}}`).
 * One read still will not hold 179 KB, so the manager has to page; a brief that
 * does not say how long the file is leaves it to discover that by running out.
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

/* The readable copies this run has written, so a later refusal takes them back
   out. They are per-pass paths, so a leftover could not be mistaken for another
   pass's — but a refused run that leaves files behind is the shape that plants a
   stale artifact, and this script's whole contract is to leave nothing. */
const written: string[] = [];

function refuse(why: string): never {
  for (const path of [...(outPath === null ? [] : [outPath]), ...written]) {
    try {
      rmSync(path, { force: true });
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
let queueDoc: unknown = null;
try {
  queueDoc = JSON.parse(readFileSync(queuePath, "utf8")) as unknown;
  if (!Array.isArray(queueDoc)) refuse(`the queue snapshot at ${queuePath} is not an array`);
  cardCount = (queueDoc as QueueRow[]).filter(
    (row) => typeof row?.number === "number" && Number.isSafeInteger(row.number) && (row.number as number) > 0,
  ).length;
} catch (error) {
  refuse(`the queue snapshot could not be read (${error instanceof Error ? error.message : String(error)})`);
}
if (cardCount === 0) refuse(`the queue snapshot at ${queuePath} names no cards`);

/*
  THE PULL-REQUEST SNAPSHOT IS PARSED NOW, NOT MERELY STATTED.

  It was `existsSync` alone, because the manager read the file directly and the
  runner had already checked it starts with `[`. It is re-written below, so it has
  to be a document rather than a string — and parsing it here is the SAFE
  direction: a snapshot this cannot read refuses the brief, the runner skips the
  manager, and the pass cuts exactly as it did before #1658. Nothing can be made
  worse by refusing here.
*/
let prsDoc: unknown = null;
try {
  prsDoc = JSON.parse(readFileSync(prsPath, "utf8")) as unknown;
} catch (error) {
  refuse(
    `the pull-request snapshot at ${prsPath} could not be read (${error instanceof Error ? error.message : String(error)})`,
  );
}
if (!Array.isArray(prsDoc)) refuse(`the pull-request snapshot at ${prsPath} is not an array`);

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

/*
  THE SNAPSHOTS THE MANAGER WILL ACTUALLY READ — see the docblock's own section.
  `gh --json` prints one line; `Read` cannot paginate one line and shows the
  first ~21,000 characters of it, which was 5 of 54 cards on the first armed
  pass. Pretty-printing is the whole repair: one JSON value per line, so
  `offset`/`limit` work.

  ⚠ WRITTEN WITH `\n`, NEVER THE PLATFORM'S LINE ENDING. The line count below is
  what the brief tells the manager to page by, and `readable.split("\n").length`
  must be the number `Read` reports. On Windows a CRLF copy still counts the same
  lines, but the byte figures a later reading quotes would drift from the bytes —
  and `fingerprint-hashed-line-endings` is this repository's own receipt for what
  that costs. `JSON.stringify` emits `\n` only, so this is a note rather than a
  transformation.
*/
function readablePathFor(path: string): string {
  return path.endsWith(".json") ? `${path.slice(0, -".json".length)}.readable.json` : `${path}.readable.json`;
}

function writeReadable(path: string, doc: unknown, label: string): { readonly path: string; readonly lines: number } {
  const readablePath = readablePathFor(path);
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  try {
    writeFileSync(readablePath, text, "utf8");
  } catch (error) {
    refuse(
      `the readable ${label} could not be written to ${readablePath} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  written.push(readablePath);
  /* The trailing newline makes a final empty element; the manager pages by the
     lines `Read` numbers, which is this count. */
  return { path: readablePath, lines: text.split("\n").length - 1 };
}

const queueReadable = writeReadable(queuePath, queueDoc, "queue snapshot");
const prsReadable = writeReadable(prsPath, prsDoc, "pull-request snapshot");

const substitutions: Record<string, string> = {
  QUEUE_FILE: queueReadable.path,
  PRS_FILE: prsReadable.path,
  QUEUE_LINES: String(queueReadable.lines),
  PRS_LINES: String(prsReadable.lines),
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

/* The readable line counts are ON the verdict line, because the runner prints it
   and a shift reading a pass later has no other way to know the manager was
   handed something it could page. A one-line snapshot would read `1 line` here,
   which is the whole defect visible in the one place every pass records. */
console.log(
  `BRIEF ${cardCount} cards | ${domains.length} areas | ${prompt.length} characters | queue ${queueReadable.lines} lines, prs ${prsReadable.lines} lines readable`,
);

/* AND THE LAST STATEMENT ENDS THE PROCESS (`server/scriptExitDiscipline.test.ts`). */
process.exit(0);
