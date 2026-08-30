/**
 * THE DESK SWEEP — re-read the briefing against the record, every shift
 * (#290, #291, #292, and the mechanism #287 asked for).
 *
 *   npx tsx scripts/crew-desk-sweep.mts            # report only, changes nothing
 *   npx tsx scripts/crew-desk-sweep.mts --write    # apply what it found
 *
 * No database, no Railway wrapper, no credentials of its own: it reads GitHub
 * through the `gh` CLI a shift is already signed in to, and writes one tracked
 * file.
 *
 * # THE DISEASE IT EXISTS TO KILL
 *
 * On 2026-08-30 the founder found FOUR separate hand-kept lists governing live
 * work while contradicting the code, and his page was the fifth. Every one had
 * the same shape: **a state written once, at the moment it became true, and
 * never re-read.**
 *
 *   - `answered` was set the moment he replied. **Half of everything marked
 *     answered was actually finished** and the page never said so, so it
 *     under-reported its own progress — a bad way round to be wrong, because
 *     it makes the team look like it decides and does not deliver.
 *   - `waiting-founder` was typed by a shift. **Seven rows claimed he was
 *     blocking things while his desk said nothing was**, on the same screen.
 *   - `in-review` outlived the merge. Five rows sat in review whose PRs had
 *     been merged for hours.
 *   - and nothing anywhere said what was QUEUED, which is the question he
 *     actually asked: *"i cant see what its planned as the next shift"*.
 *
 * Four passes, all four derived from a record outside the file:
 *
 *   1. **NEXT UP** — `gh issue list --label founder-ordered --state open`, in
 *      the order a shift takes them. This is not a view OF the running order,
 *      it IS the running order: `PROGRAM.md` makes a `founder-ordered` card
 *      authorised work taken first, so the page renders the same query a shift
 *      obeys rather than a copy someone maintains.
 *   2. **`answered` → `done`** when the card's issue is CLOSED.
 *   3. **not-merged → `merged`** when the row's PR is MERGED.
 *   4. **`waiting-founder`** is REPORTED against the desk. It is not repaired
 *      automatically and that is deliberate: what a stale row should become —
 *      merged, in review, blocked, or deleted — is a judgement about work, and
 *      guessing it is how a wrong state gets laundered into a confident one.
 *      The schema refuses the row at the parse (`crewBriefing.ts`), so a shift
 *      cannot ship past it; this pass only names them first.
 *
 * # ⚠ A FAILED READ IS NEVER A VERDICT
 *
 * If `gh` cannot answer for an issue or a PR, that row is SKIPPED and said out
 * loud — never treated as "not closed" or "not merged". They are opposite
 * facts, and a broken reader quietly voting for the status quo is how an
 * instrument stops being able to fail (working law 2).
 *
 * # ⚠ IT REFUSES A FLAG IT DOES NOT KNOW
 *
 * `--dry-run` — the safest-sounding word an operator can type — was passed to
 * `crew-shift-close.mts` on 2026-08-30 and silently read as *no arguments*,
 * which is the do-it-for-real path; it closed a shift's row while the shift was
 * still running (#289). The same class had already fired twice from the
 * spending side. This script's default is report-only and its argument reader
 * enumerates what it was given, so a typo stops it instead of steering it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRIEFING = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "server",
  "crew",
  "crew-briefing.json",
);

/* ─── arguments: every one enumerated, anything else refused (#289) ─── */

const KNOWN_FLAGS = new Set(["--write"]);
const unknown = process.argv.slice(2).filter((arg) => !KNOWN_FLAGS.has(arg));
if (unknown.length > 0) {
  console.error(
    `REFUSING: unknown argument(s) ${unknown.join(" ")}.\n`
    + `Known: ${[...KNOWN_FLAGS].join(", ")}. Default is report-only.`,
  );
  process.exit(1);
}
const WRITE = process.argv.includes("--write");

/* ─── the record readers ─── */

type Json = Record<string, any>;

/** `gh` with no shell — it is an .exe, and the shell form emits DEP0190. */
function gh(args: string[]): unknown | null {
  try {
    const out = execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return JSON.parse(out);
  } catch (cause) {
    console.error(`[warn] gh ${args.slice(0, 3).join(" ")} failed: ${(cause as Error).message}`);
    return null;
  }
}

/** OPEN | CLOSED | null when the record could not be read. */
function issueState(issueNumber: number): "OPEN" | "CLOSED" | null {
  const row = gh(["issue", "view", String(issueNumber), "--json", "state"]) as Json | null;
  const state = row?.state;
  return state === "OPEN" || state === "CLOSED" ? state : null;
}

/** MERGED | OPEN | CLOSED | null when the record could not be read. */
function prState(prNumber: number): string | null {
  const row = gh(["pr", "view", String(prNumber), "--json", "state"]) as Json | null;
  return typeof row?.state === "string" ? row.state : null;
}

const briefing = JSON.parse(readFileSync(BRIEFING, "utf8")) as Json;
const changes: string[] = [];
const skipped: string[] = [];

/* ─── 1. NEXT UP — the founder-ordered queue, in the order a shift takes it ─── */

const ordered = gh([
  "issue", "list",
  "--label", "founder-ordered",
  "--state", "open",
  "--limit", "200",
  "--json", "number,title,labels",
]) as Json[] | null;

if (ordered === null) {
  skipped.push("NEXT UP: the founder-ordered queue could not be read — the block is left as it was.");
} else if (ordered.length >= 200) {
  /* A `--limit` shorter than the population would silently cap the list, and a
     capped running order reads exactly like a complete one. */
  skipped.push("NEXT UP: 200 rows came back, which is the limit — that is a floor, not a list.");
} else {
  /*
    ⚠ **THE ORDER IS THE WHOLE ANSWER TO HIS QUESTION**, so it is the order a
    shift genuinely takes them in rather than the order `gh` happens to return
    (newest first, which is nobody's priority).

    `PROGRAM.md`'s standing exceptions put **urgent first, oldest first** —
    that is band 1, and `scripts/queue-standing-exceptions.mts` is the same
    sort. Everything else the founder ordered follows, also oldest first.
    Caught by looking at the rendered page: sorting on the number alone put a
    non-urgent card above three urgent ones, which is a running order that no
    shift would obey.
  */
  const items = ordered
    .slice()
    .map((row) => ({
      issueNumber: Number(row.number),
      title: String(row.title).slice(0, 300),
      urgent: Array.isArray(row.labels)
        && row.labels.some((label: Json) => label?.name === "urgent"),
    }))
    .sort((a, b) =>
      (a.urgent === b.urgent ? 0 : a.urgent ? -1 : 1) || a.issueNumber - b.issueNumber);
  const before = JSON.stringify(briefing.nextUp?.items ?? null);
  briefing.nextUp = { readAt: new Date().toISOString(), items };
  if (JSON.stringify(items) !== before) {
    changes.push(`NEXT UP: ${items.length} founder-ordered card(s) — ${items.map((i) => `#${i.issueNumber}`).join(", ") || "none"}`);
  } else {
    changes.push(`NEXT UP: unchanged (${items.length}), stamp refreshed`);
  }
}

/* ─── 2. answered → done, from the issue's own state ─── */

for (const list of ["needsYou", "eyeItems"] as const) {
  for (const card of (briefing[list] ?? []) as Json[]) {
    if (card.state !== "answered") continue;
    if (typeof card.issueNumber !== "number") continue;
    const state = issueState(card.issueNumber);
    if (state === null) {
      skipped.push(`${list} ${card.id}: issue #${card.issueNumber} could not be read — left answered.`);
      continue;
    }
    if (state === "CLOSED") {
      card.state = "done";
      changes.push(`${list} ${card.id}: answered → done (#${card.issueNumber} is closed)`);
    }
  }
}

/* ─── 3. a row whose PR is merged is merged ─── */

for (const item of (briefing.pipeline ?? []) as Json[]) {
  if (item.status === "merged") continue;
  if (typeof item.prNumber !== "number") continue;
  const state = prState(item.prNumber);
  if (state === null) {
    skipped.push(`pipeline ${item.id}: PR ${item.prNumber} could not be read — left ${item.status}.`);
    continue;
  }
  if (state === "MERGED") {
    changes.push(`pipeline ${item.id}: ${item.status} → merged (PR ${item.prNumber} is merged)`);
    item.status = "merged";
    /* A merged row cannot be waiting on him; its cardId would fail the parse. */
    delete item.cardId;
  }
}

/* ─── 4. waiting-founder, reported against his desk and never guessed ─── */

const openCardIds = new Set(
  ((briefing.needsYou ?? []) as Json[])
    .filter((card) => card.state === "open")
    .map((card) => String(card.id)),
);
const liars = ((briefing.pipeline ?? []) as Json[]).filter(
  (item) => item.status === "waiting-founder"
    && !(typeof item.cardId === "string" && openCardIds.has(item.cardId)),
);

/* ─── the report ─── */

console.log(WRITE ? "THE DESK SWEEP — applying" : "THE DESK SWEEP — report only (pass --write to apply)");
console.log("");
if (changes.length === 0) console.log("  nothing to change.");
for (const line of changes) console.log(`  · ${line}`);

if (skipped.length > 0) {
  console.log("");
  console.log("SKIPPED — a read that failed is never a verdict:");
  for (const line of skipped) console.log(`  ! ${line}`);
}

if (liars.length > 0) {
  console.log("");
  console.log(`⚠ ${liars.length} pipeline row(s) claim he is blocking them and his desk does not agree.`);
  console.log("  These are NOT repaired here — what a stale row should become is a judgement");
  console.log("  about work. The briefing schema refuses them at the parse, so fix each by hand:");
  for (const item of liars) {
    console.log(`  ! ${item.id} — ${String(item.title).slice(0, 80)}`);
  }
}

if (WRITE) {
  writeFileSync(BRIEFING, `${JSON.stringify(briefing, null, 2)}\n`, "utf8");
  console.log("");
  console.log(`WROTE ${path.relative(process.cwd(), BRIEFING)} — review the diff before committing.`);
}

/* A stale `waiting-founder` row is a failure of the sweep's own subject even
   when everything else applied cleanly: exiting 0 on it would let a shift read
   a green run as a clean desk. */
process.exit(liars.length > 0 ? 2 : 0);
