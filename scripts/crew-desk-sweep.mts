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
 *      obeys rather than a copy someone maintains. ⚠ **And each row now carries
 *      WHY a shift has not taken it** (#298) — his *"did it skip things or what
 *      happened"*. The state comes from a hold LABEL and the sentence from one
 *      line of the card body; `shared/crewNextUpHold.ts` owns both and says why
 *      those halves are held to different standards.
 *   2. **`done`** when the card's issue is CLOSED — from `open` as well as from
 *      `answered` (#604). It used to promote only from `answered`, so a card he
 *      finished without ever being marked answered stayed on his desk asking for
 *      a chore he had already done: `deploy-flip-508` told him to enter three
 *      Railway fields for a day after he entered them. **The rule now keys on
 *      the record rather than on the state a shift happened to type.** A
 *      promotion that would orphan an open eye item (#133) or a
 *      `waiting-founder` row (#291) is HELD and reported instead — see
 *      `shared/crewCardResolution.ts`, which owns the whole judgement.
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

import {
  type ResolvableBriefing,
  planCardResolutions,
  promotionLine,
} from "../shared/crewCardResolution.js";
import { heldStateFromLabels, holdReasonFromBody } from "../shared/crewNextUpHold.js";
import {
  CREW_LADDER_GROUP_KEYS,
  RUNG_LABEL_PREFIX,
  pipelineGroupFor,
  rungFromLabels,
} from "../shared/crewPipelineGroups.js";

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
  /* `body` rides along for the hold REASON (#298). It is the same request, so
     it costs nothing extra — and it is the only way the sentence a filer wrote
     reaches his page without somebody transcribing it into the briefing. */
  "--json", "number,title,labels,body",
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
    .map((row) => {
      const labels = Array.isArray(row.labels)
        ? row.labels.map((label: Json) => String(label?.name ?? ""))
        : [];
      /*
        ⚠ **THE HOLD'S STATE COMES FROM A LABEL AND ITS REASON FROM THE BODY,
        AND THE REASON IS ONLY EVER WRITTEN BESIDE A LIVE STATE** (#298).

        That asymmetry is the anti-rot property, not a shortcut: `#278` told him
        it was blocked for two shifts after it was unblocked, because the state
        lived in prose. Here, removing the label removes the whole row's chip
        AND its sentence in one act — a reason cannot outlive the state that
        renders it, whatever the body still says.

        A held card with no marker line keeps its chip. The label alone answers
        *"why was this skipped"*, and demanding prose would let a filer's
        omission quietly un-hold a card.
      */
      const state = heldStateFromLabels(labels);
      const because = state === null ? null : holdReasonFromBody(String(row.body ?? ""));
      return {
        issueNumber: Number(row.number),
        title: String(row.title).slice(0, 300),
        urgent: labels.includes("urgent"),
        ...(state === null ? {} : { held: { state, ...(because ? { because } : {}) } }),
      };
    })
    /*
      ⚠ **HELD ROWS ARE NOT SORTED DOWN, AND THAT IS #298's OWN INSTRUCTION**:
      *"Do not quietly hide blocked rows — he needs to see that seven of eight
      are stuck, because that is the real state of his queue and it is the thing
      that would tell him to unblock something."* The position stays the
      priority order; the chip explains the skip.
    */
    .sort((a, b) =>
      (a.urgent === b.urgent ? 0 : a.urgent ? -1 : 1) || a.issueNumber - b.issueNumber);
  const before = JSON.stringify(briefing.nextUp?.items ?? null);
  briefing.nextUp = { readAt: new Date().toISOString(), items };
  if (JSON.stringify(items) !== before) {
    changes.push(`NEXT UP: ${items.length} founder-ordered card(s) — ${items.map((i) => `#${i.issueNumber}`).join(", ") || "none"}`);
  } else {
    changes.push(`NEXT UP: unchanged (${items.length}), stamp refreshed`);
  }
  /* Said out loud whichever way the row above went: a hold is the thing an
     operator most wants to check before shipping, and "unchanged" hides it. */
  const holds = items.filter((item) => "held" in item);
  changes.push(holds.length === 0
    ? `NEXT UP: no card is held — every row is takeable`
    : `NEXT UP: ${holds.length} held — ${holds.map((i) => `#${i.issueNumber} ${(i as { held: { state: string } }).held.state}`).join(", ")}`);
}

/* ─── 1b. THE LADDER CARDS — roadmap / parked / design-unbuilt, homed under
   THE PROGRAM (#493 move 2). Derived through `pipelineGroupFor`, the ONE
   partition, so a card the switches offer or NEXT UP holds can never also
   land here. The rung comes from a `rung:` label — TRANSCRIPTION of a rung
   the record already names, never a shift's sequencing — and an unknown rung
   is reported out loud rather than dropped or invented. ─── */

const allOpen = gh([
  "issue", "list",
  "--state", "open",
  "--limit", "200",
  "--json", "number,title,labels",
]) as Json[] | null;

if (allOpen === null) {
  skipped.push("LADDER: the open queue could not be read — the ladder cards are left as they were.");
} else if (allOpen.length >= 200) {
  skipped.push("LADDER: 200 rows came back, which is the limit — that is a floor, not a list.");
} else {
  const rungKeys: string[] = ((briefing.program?.ladder ?? []) as Json[]).map((rung) => String(rung.key));
  const ladderItems = allOpen
    .map((row) => {
      const labels = Array.isArray(row.labels)
        ? row.labels.map((label: Json) => String(label?.name ?? ""))
        : [];
      const group = pipelineGroupFor(labels);
      if (!CREW_LADDER_GROUP_KEYS.includes(group)) return null;
      /* A `rung:` label naming a rung the ladder does not hold reads as
         UNPLACED and is said out loud — silence would launder a typo into a
         card quietly vanishing from every rung. */
      const named = labels.filter((label) => label.startsWith(RUNG_LABEL_PREFIX));
      const rung = rungFromLabels(labels, rungKeys);
      if (named.length > 0 && rung === null) {
        skipped.push(`LADDER: #${row.number} carries ${named.join(", ")} but the ladder holds no such rung — treated as unplaced.`);
      }
      return {
        issueNumber: Number(row.number),
        title: String(row.title).slice(0, 300),
        kind: group,
        rung,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    /* Ladder order first (unplaced last), oldest first within a rung — the
       order he reads the rungs in, never the order gh returns. */
    .sort((a, b) => {
      const at = a.rung === null ? rungKeys.length : rungKeys.indexOf(a.rung);
      const bt = b.rung === null ? rungKeys.length : rungKeys.indexOf(b.rung);
      return at - bt || a.issueNumber - b.issueNumber;
    });
  const beforeLadder = JSON.stringify(briefing.program?.ladderCards?.items ?? null);
  briefing.program = briefing.program ?? {};
  briefing.program.ladderCards = { readAt: new Date().toISOString(), items: ladderItems };
  const placed = ladderItems.filter((item) => item.rung !== null).length;
  changes.push(JSON.stringify(ladderItems) !== beforeLadder
    ? `LADDER: ${ladderItems.length} card(s) on the ladder — ${placed} placed under a rung, ${ladderItems.length - placed} rung not yet named`
    : `LADDER: unchanged (${ladderItems.length}), stamp refreshed`);
}

/* ─── 2. a row whose PR is merged is merged ─── */

/*
  ⚠ THIS RUNS BEFORE THE CARD PASS, AND THE ORDER IS LOAD-BEARING (review of
  PR #609, finding 1). A `waiting-founder` row HOLDS the card it names, so a
  card pass planned first would hold a card on a row this pass is about to
  repair — printing `pipeline R: waiting-founder → merged` and `needsYou C is
  HELD because R still says he is blocking it` in one report, and leaving C on
  his desk a sweep longer than the record justifies. Two contradictory facts
  about one row is the exact shape this script's header says it exists to kill.
*/
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

/* ─── 3. a finished card is done, from the issue's own state ─── */

const resolution = planCardResolutions(briefing as ResolvableBriefing, issueState);

for (const promotion of resolution.promote) {
  const card = ((briefing[promotion.list] ?? []) as Json[]).find((row) => row.id === promotion.id);
  if (!card) continue;
  card.state = "done";
  changes.push(promotionLine(promotion));
}
/* Held cards get their OWN block below, not `skipped`: that heading says "a read
   that failed", and a hold is the opposite — the read succeeded and the answer
   needs a hand. Two different facts under one heading is the shape this whole
   script exists to kill. */
const heldCards = resolution.held;
for (const item of resolution.unreadable) {
  skipped.push(
    `${item.list} ${item.id}: issue #${item.issueNumber} could not be read — left as it was.`,
  );
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

if (heldCards.length > 0) {
  console.log("");
  console.log(`⚠ ${heldCards.length} card(s) are finished by their issue but cannot be marked done yet.`);
  console.log("  Marking them would orphan something the briefing schema then refuses at the");
  console.log("  parse, so each is left alone and named instead (#604):");
  for (const hold of heldCards) {
    console.log(`  ! ${hold.list} ${hold.id} (#${hold.issueNumber}) — ${hold.reason}`);
  }
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
   a green run as a clean desk.

   ⚠ A HELD CARD (#604) DELIBERATELY DOES NOT EXIT 2, AND THAT IS A DECISION
   RATHER THAN AN OVERSIGHT (review of PR #609, finding 3). The two look alike
   — both are the record disagreeing with his page — but a liar is a shape the
   briefing schema REFUSES at the parse, so a shift that ignores it cannot ship
   at all; a hold is schema-valid, transient, and resolves itself the sweep
   after its dependant is settled. Exiting 2 on it would spend the signal that
   currently means "you cannot ship this" on a state you can. It is printed
   loudly instead, in its own block. */
process.exit(liars.length > 0 ? 2 : 0);
