/**
 * WRITE THE MANAGER'S FACT SHEET — the one thing in #1658 that touches disk, and
 * the reason the manager itself needs no write tool.
 *
 *     npx tsx scripts/manager-fact-sheet.mts \
 *       --from-log .agents/shift-logs/manager-20261001-122100.log \
 *       --queue   .agents/shift-logs/manager-queue-20261001-122100.json \
 *       --prs     .agents/shift-logs/manager-prs-20261001-122100.json \
 *       --pass    20261001-122100 \
 *       --read-at 2026-10-01T02:21:00.000Z \
 *       --out     .agents/shift-logs/manager-20261001-122100.json
 *
 * It prints ONE machine-readable line on stdout:
 *
 *     SHEET 53 rows | pass 20261001-122100 | 41 ready | 12 held
 *     SHEET none | unparseable: #1604's `ready` is "maybe" …
 *
 * `.agents/foreman/foreman-runner.ps1` reads that line. A `SHEET none` is not an
 * incident: the cut then runs exactly as it did before this card, which is the
 * card's §5.
 *
 * # ⚠ WHY THE MANAGER PRINTS AND THIS WRITES
 *
 * The card's done-when: *"the manager session has no write tools."* So the
 * manager is launched with `Read`, `Grep` and `Glob` and nothing else, prints its
 * rows as its final message, and this script extracts, validates and stamps
 * them. Three things that buys, and the third is the one that matters most:
 *
 *  1. **read-only is provable, not promised** — the drive asserts a file the
 *     manager was told to write does not exist;
 *  2. **the stamps are facts** — `pass` and `readAt` come from the runner, which
 *     knows when it dumped the queue, so the staleness check never rests on
 *     something a model typed;
 *  3. **an invalid sheet is never written at all.** A refused validation leaves
 *     NO file, so the `missing` state and the `unparseable` state cannot be
 *     confused by a later reader, and nothing downstream has to decide whether a
 *     half-written document is usable.
 *
 * ⚠ **IT REFUSES BY WRITING NOTHING, AND IT EXITS 1 WHEN IT DOES.** The runner
 * treats a non-zero exit as *no sheet* and carries on; nothing here can stop a
 * pass. An existing file at `--out` is REMOVED before a refusal returns, because
 * a stale sheet from an earlier pass sitting at the path this pass refused to
 * write is precisely the shape `readManagerSheet`'s `stale` arm exists for, and
 * leaving it there would make this script the thing that planted it.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseManagerRows,
  stampSheet,
  unwrapManagerPayload,
} from "./lib/managerFactSheet.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["from-log", "queue", "prs", "pass", "read-at", "out", "model"],
  boolean: [],
});

/** Refuse: say why on stderr, print the machine line, leave no sheet behind. */
function refuse(why: string, outPath: string | null): never {
  if (outPath !== null) {
    try {
      rmSync(outPath, { force: true });
    } catch {
      /* Nothing to do about it, and it must not mask the real reason. */
    }
  }
  console.error(`manager-fact-sheet: REFUSING — ${why}`);
  console.log(`SHEET none | ${why}`);
  process.exit(1);
}

function required(name: string, outPath: string | null): string {
  const raw = ARGS.value(name);
  if (raw === null || raw.trim() === "") refuse(`--${name} is required`, outPath);
  return raw.trim();
}

const outPath = ARGS.value("out") === null ? null : resolve(ARGS.value("out")!);
const pass = required("pass", outPath);
const readAt = required("read-at", outPath);
if (!Number.isFinite(Date.parse(readAt))) refuse(`--read-at "${readAt}" is not a time`, outPath);

const logPath = resolve(required("from-log", outPath));
const queuePath = resolve(required("queue", outPath));
const model = ARGS.value("model") ?? "claude-opus-5";

if (!existsSync(logPath)) refuse(`the manager wrote no log at ${logPath}`, outPath);

let logText = "";
try {
  logText = readFileSync(logPath, "utf8");
} catch (error) {
  refuse(`the manager's log could not be read (${error instanceof Error ? error.message : String(error)})`, outPath);
}
if (logText.trim() === "") refuse("the manager's log is empty — the session produced nothing", outPath);

/*
  THE SNAPSHOT IS THE DENOMINATOR OF `partial`, and it is read from the file the
  MANAGER was given rather than from a fresh `gh` call. Re-reading the queue here
  would measure the manager against a population it never saw, which is the one
  way this check could be unfair to it.
*/
type QueueRow = { readonly number?: unknown };
let snapshot: number[] = [];
try {
  const rows = JSON.parse(readFileSync(queuePath, "utf8")) as unknown;
  if (!Array.isArray(rows)) refuse(`the queue snapshot at ${queuePath} is not an array`, outPath);
  snapshot = (rows as QueueRow[])
    .map((row) => row?.number)
    .filter((n): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0);
} catch (error) {
  refuse(`the queue snapshot could not be read (${error instanceof Error ? error.message : String(error)})`, outPath);
}
if (snapshot.length === 0) refuse(`the queue snapshot at ${queuePath} names no cards`, outPath);

/*
  THE PULL-REQUEST ALLOWLIST, from the file the MANAGER was shown (the relay's
  finding on PR #1668). `collidesWith` may name an open card or an open pull
  request, and until this was passed through, any positive integer was accepted —
  so a row that correctly named the branch editing the same file read as *no
  collision* downstream. The list is stamped onto the sheet because the cut needs
  it to tell a pair reading from a hold, and the read-time validator needs it as
  the allowlist once these files are gone.
*/
const prsPath = ARGS.value("prs");
let prNumbers: number[] = [];
if (prsPath !== null) {
  try {
    const rows = JSON.parse(readFileSync(resolve(prsPath), "utf8")) as unknown;
    if (!Array.isArray(rows)) refuse(`the pull-request snapshot at ${prsPath} is not an array`, outPath);
    prNumbers = (rows as QueueRow[])
      .map((row) => row?.number)
      .filter((n): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0);
  } catch (error) {
    refuse(`the pull-request snapshot could not be read (${error instanceof Error ? error.message : String(error)})`, outPath);
  }
}

/*
  THE ROWS AND THE COST, from either road the runner may have captured — the
  plain final message, or the `--output-format json` envelope that carries
  `total_cost_usd`. `unwrapManagerPayload` owns the discrimination; see its
  docblock for why stopping at the envelope reads a perfect session as prose.
*/
let unwrapped: ReturnType<typeof unwrapManagerPayload> = null;
try {
  unwrapped = unwrapManagerPayload(logText);
} catch (error) {
  refuse(`the manager's JSON did not parse (${error instanceof Error ? error.message : String(error)})`, outPath);
}
if (unwrapped === null || unwrapped.payload === null) {
  refuse("the manager's log holds no balanced JSON object — it answered in prose", outPath);
}

const verdict = parseManagerRows(unwrapped.payload, snapshot, prNumbers);
if (verdict.kind === "refused") refuse(`${verdict.state}: ${verdict.why}`, outPath);

const sheet = stampSheet({
  rows: verdict.rows,
  pass,
  readAt,
  snapshotCards: snapshot.length,
  prNumbers,
  model,
  costUsd: unwrapped.costUsd,
  nowMs: Date.now(),
});

if (outPath === null) refuse("--out is required", null);
try {
  writeFileSync(outPath, `${JSON.stringify(sheet, null, 2)}\n`, "utf8");
} catch (error) {
  refuse(`the fact sheet could not be written to ${outPath} (${error instanceof Error ? error.message : String(error)})`, outPath);
}

const ready = sheet.rows.filter((row) => row.ready === "yes").length;
const cost = sheet.costUsd === null ? "cost unreported" : `$${sheet.costUsd.toFixed(4)}`;
console.log(
  `SHEET ${sheet.rows.length} rows | pass ${pass} | ${ready} ready | ${sheet.rows.length - ready} held | ${cost}`,
);

/* AND THE LAST STATEMENT ENDS THE PROCESS (`server/scriptExitDiscipline.test.ts`). */
process.exit(0);
