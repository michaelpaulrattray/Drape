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

import { crewCardNeedsHim } from "../shared/crewCardState.js";
import {
  type ResolvableBriefing,
  planCardResolutions,
  promotionLine,
} from "../shared/crewCardResolution.js";
import {
  CREW_HOLD_LABELS,
  CREW_HOLD_MARKER,
  planDeskHoldLabels,
} from "../shared/crewNextUpHold.js";
import {
  type OrderedIssue,
  OPEN_QUEUE_LIMIT,
  emptyOrderedBandVerdict,
  planNextUpItems,
} from "./lib/nextUpItems.mts";
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

/**
 * ⚠ A WRITE THAT PRINTS NO JSON — `gh issue edit` answers with a URL, so the
 * reader below would parse-fail on a call that SUCCEEDED and report the label
 * as unwritten (#586). Two shapes, because they are two questions: `gh` asks
 * *what does the record say*, this asks *did the write land*.
 *
 * Returns `true` on exit 0, `false` on anything else. Never throws, so a failed
 * label cannot take the whole sweep down after it has already changed the
 * briefing in memory.
 */
function ghWrite(args: string[]): boolean {
  try {
    execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch (cause) {
    console.error(`[warn] gh ${args.slice(0, 3).join(" ")} failed: ${(cause as Error).message}`);
    return false;
  }
}

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
/* Cards carrying `blocked` with no written reason his desk no longer names —
   named for a person, never unlabelled here (#586). */
let staleHolds: ReadonlyArray<{ issueNumber: number; hasWrittenReason: boolean }> = [];

/* ─── THE WHOLE OPEN QUEUE, read ONCE and used twice ───

   It is taken here rather than beside the ladder block it feeds because NEXT UP
   needs it FIRST: it is the witness that makes an empty band believable (#772).
   One call, one instant — the ladder pass below reads this same answer, so the
   two cannot describe different moments. */

/* ONE owner for the cap, because five readings across two files depend on it:
   this read, the ladder's "a floor, not a list" refusal, the empty-band
   witness, and the shift digest's own two (#774). A number typed once per file
   is the drift working law 4 is about, so it lives in `lib/nextUpItems.mts`
   beside the verdict that quotes it. */

const allOpen = gh([
  "issue", "list",
  "--state", "open",
  "--limit", String(OPEN_QUEUE_LIMIT),
  "--json", "number,title,labels",
]) as Json[] | null;

/* ─── 1. NEXT UP — the founder-ordered queue, in the order a shift takes it ─── */

const ordered = gh([
  "issue", "list",
  "--label", "founder-ordered",
  "--state", "open",
  "--limit", "200",
  /* `body` rides along for the hold REASON (#298). It is the same request, so
     it costs nothing extra — and it is the only way the sentence a filer wrote
     reaches his page without somebody transcribing it into the briefing. */
  "--json", "number,title,labels,body,createdAt",
]) as Json[] | null;

if (ordered === null) {
  skipped.push("NEXT UP: the founder-ordered queue could not be read — the block is left as it was.");
} else if (ordered.length >= 200) {
  /* A `--limit` shorter than the population would silently cap the list, and a
     capped running order reads exactly like a complete one. */
  skipped.push("NEXT UP: 200 rows came back, which is the limit — that is a floor, not a list.");
} else if (ordered.length === 0 && !emptyOrderedBandVerdict(allOpen, OPEN_QUEUE_LIMIT).believable) {
  /* An EMPTY answer is the one reading that must survive a cross-examination
     before it is written onto his page (#772). `emptyOrderedBandVerdict` says
     why in his English; the witness is the whole-queue read above, so this
     costs no extra call. */
  skipped.push(
    `NEXT UP: it read empty and that could not be believed — ${emptyOrderedBandVerdict(allOpen, OPEN_QUEUE_LIMIT).why}.`
    + " The block is left as it was.",
  );
} else {
  /*
    ⚠ **THE ORDER IS THE WHOLE ANSWER TO HIS QUESTION**, so it is the order a
    shift genuinely takes them in rather than the order `gh` happens to return
    (newest first, which is nobody's priority).

    `PROGRAM.md`'s standing exceptions put **urgent first, oldest first** —
    that is band 1. Everything else the founder ordered follows, also oldest
    first.

    ⚠ **HE SETTLED IT — #718, Crew reply #168, 2026-09-09, verbatim and
    entire: *"Urgent wins inside your ordered group"*.** So this page's reading
    was the surviving one, and the priority view came to it rather than the
    other way round.

    ⚠ **AND THE REPAIR IS NOT THAT THE TWO NOW AGREE — IT IS THAT THERE IS ONE
    SORT.** This paragraph used to end *"`scripts/queue-standing-exceptions.mts`
    is the same sort"*, which was true when written and silently stopped being
    true (#472); asserting an agreement in prose is what let the two drift for a
    week with a worked example nobody could see. The comparator is
    `scripts/lib/orderedBand.mts` and both views call it, on the same key —
    ⚠ **this block used to tiebreak on `issueNumber`, which is oldest-first for
    one repository's issues and was therefore not wrong, but it is a DIFFERENT
    KEY, and two functions comparing different keys can only ever be held to
    each other by a sentence.** `server/orderedBandOrder.test.ts` drives both
    over one fixture.

    Caught by looking at the rendered page: sorting on the number alone put a
    non-urgent card above three urgent ones, which is a running order that no
    shift would obey.
  */
  /*
    ⚠ **THE LABELS ARE MADE TRUE BEFORE THE ROWS ARE BUILT (#586)**, so his page
    and the readers that launch shifts agree after ONE run rather than after
    two. `planDeskHoldLabels` owns the rule and the reasoning; this is its I/O.

    The defect it closes: a shift that parks a card on his desk leaves a
    sentence, and the escalation gate reads LABELS. On 2026-09-06 a desk-held
    card with no label read as Opus-takeable and #535 — the next
    `awaiting-fable` card in his own order — was not escalated.
  */
  const deskPlan = planDeskHoldLabels({
    ordered: ordered.map((row) => ({
      issueNumber: Number(row.number),
      labels: Array.isArray(row.labels)
        ? row.labels.map((label: Json) => String(label?.name ?? ""))
        : [],
      body: String(row.body ?? ""),
    })),
    deskOpen: ((briefing.needsYou ?? []) as Json[])
      /* ⚠ `crewCardNeedsHim`, NEVER a literal (#354, review of PR #648 finding 1).
         A `waiting` card is one he answered whose remaining act is still HIS —
         so its issue must carry the `blocked` label exactly as an open card's
         does. The escalation gate reads holds from LABELS ONLY and cannot see
         his desk (`shared/crewNextUpHold.ts`), so a literal here would let a
         shift launch onto work whose one remaining step is his, while this very
         page rendered "waiting on you" beside it. That is #586's measured
         incident re-created for the new state. */
      .filter((card) => crewCardNeedsHim(String(card.state)) && typeof card.issueNumber === "number")
      .map((card) => ({ issueNumber: Number(card.issueNumber), cardId: String(card.id) })),
  });

  /*
    Which issues ended up held, and WHY — so the rows written below carry the
    label this run applied rather than the one `gh` answered with a moment ago.

    ⚠ **THE REASON COMES FROM THE DESK AND NEVER FROM THE BODY** (PR #613
    review, finding 1). A body may still hold a `**Waiting on:**` line from some
    earlier hold — #298's design deliberately leaves a rotted line in place when
    a label is removed, because nothing renders it — and reading it here would
    have shown an unrelated old sentence beside a brand-new chip. That is
    *"a stale reason outliving its state"*, the one bug #298 was built to kill,
    revived by a new state adopting an old sentence.
  */
  const applied = new Map<number, string>();
  for (const hold of deskPlan.apply) {
    if (!WRITE) {
      changes.push(
        `HOLD: #${hold.issueNumber} would get \`blocked\` — his desk card `
        + `\`${hold.deskCardId}\` is open and the card carries no hold label`
        + (hold.bodyCarriesFossil
          ? ` (its body still carries an OLDER \`${CREW_HOLD_MARKER}\` line, which would NOT`
            + ` be used as the reason)`
          : ""),
      );
      continue;
    }
    const done = ghWrite([
      "issue", "edit", String(hold.issueNumber), "--add-label", CREW_HOLD_LABELS.blocked,
    ]);
    if (!done) {
      /* A label that could not be written is NOT reported as applied — the
         whole point is that the gate reads labels, so a claim here with no
         label there is the defect wearing the repair's clothes. */
      skipped.push(
        `HOLD: #${hold.issueNumber} could not be labelled \`blocked\` — the gate will still `
        + `read it as takeable. Apply it by hand.`,
      );
      continue;
    }
    applied.set(hold.issueNumber, `his desk card \`${hold.deskCardId}\` is open`);
    changes.push(
      `HOLD: #${hold.issueNumber} labelled \`blocked\` — his desk card \`${hold.deskCardId}\` is open`
      + (hold.bodyCarriesFossil
        ? ` (its body still carries an OLDER \`${CREW_HOLD_MARKER}\` line; the reason shown`
          + ` is the desk card, not that sentence)`
        : ""),
    );
  }

  staleHolds = deskPlan.stale;

  /*
    The rows and their running order are `scripts/lib/nextUpItems.mts` — a pure
    function, so his page's order can be DRIVEN against the priority view's
    instead of held to it by a sentence. That sentence is what failed (#718).
  */
  const items = planNextUpItems({ ordered: ordered as OrderedIssue[], appliedReasons: applied });
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
  /* ⚠ In report-only mode nothing was applied, so a row this run WOULD hold is
     absent from `holds` — and printing "no card is held" four lines under
     "HOLD: #N would get `blocked`" is the two-contradictory-facts shape this
     script's own pass-2 comment names as the disease (PR #613 review, nit). */
  const wouldHold = WRITE ? 0 : deskPlan.apply.length;
  changes.push(holds.length === 0 && wouldHold === 0
    ? `NEXT UP: no card is held — every row is takeable`
    : `NEXT UP: ${holds.length} held${wouldHold > 0 ? `, ${wouldHold} more would be once applied` : ""}`
      + (holds.length === 0
        ? ""
        : ` — ${holds.map((i) => `#${i.issueNumber} ${(i as { held: { state: string } }).held.state}`).join(", ")}`));
}

/* ─── 1b. THE LADDER CARDS — roadmap / parked / design-unbuilt, homed under
   THE PROGRAM (#493 move 2). Derived through `pipelineGroupFor`, the ONE
   partition, so a card the switches offer or NEXT UP holds can never also
   land here. The rung comes from a `rung:` label — TRANSCRIPTION of a rung
   the record already names, never a shift's sequencing — and an unknown rung
   is reported out loud rather than dropped or invented. ─── */

if (allOpen === null) {
  skipped.push("LADDER: the open queue could not be read — the ladder cards are left as they were.");
} else if (allOpen.length >= OPEN_QUEUE_LIMIT) {
  skipped.push(`LADDER: ${OPEN_QUEUE_LIMIT} rows came back, which is the limit — that is a floor, not a list.`);
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
       order he reads the rungs in, never the order gh returns.

       ⚠ **THIS TIEBREAK IS THE "NOT WRONG, BUT A DIFFERENT KEY" SHAPE #718 IS
       ABOUT, AND IT IS LEFT ALONE DELIBERATELY** (review of PR #722, finding
       3). `issueNumber` is oldest-first for one repository's issues, and this
       ladder has exactly ONE consumer — so there is no sibling to drift from
       and nothing to hold it to. **It is named here because it is the first
       place the class would re-fire**: the day a second ladder view exists,
       this sort moves into `scripts/lib/orderedBand.mts` beside the ordered
       band's, rather than being copied into the new one. */
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
    /* Same question, same owner (#354). A `waiting` card still holds its
       `waiting-founder` row, so reporting that row as a liar would be the
       opposite error. */
    .filter((card) => crewCardNeedsHim(String(card.state)))
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

/*
  ⚠ TWO KINDS OF HOLD, PRINTED APART, BECAUSE ONE SENTENCE WAS TRUE OF ONLY ONE
  OF THEM (#354). This block used to say, of everything held: *"marking them
  would orphan something the briefing schema then refuses at the parse"*. That
  is the CARD hold, and it is why a card hold is transient — the schema forces
  the settling. An EYE-ITEM hold is schema-valid and does not self-resolve: it
  is held because promoting it would take frames off his page, and only a
  person can say whether he still needs to see them. Filing both under the
  card's sentence would tell a shift its eye-item hold clears itself, which is
  the shape this whole script exists to kill.
*/
const heldEyeItems = heldCards.filter((hold) => hold.list === "eyeItems");
const heldNeedsYou = heldCards.filter((hold) => hold.list !== "eyeItems");

if (heldNeedsYou.length > 0) {
  console.log("");
  console.log(`⚠ ${heldNeedsYou.length} card(s) are finished by their issue but cannot be marked done yet.`);
  console.log("  Marking them would orphan something the briefing schema then refuses at the");
  console.log("  parse, so each is left alone and named instead (#604):");
  for (const hold of heldNeedsYou) {
    console.log(`  ! ${hold.list} ${hold.id} (#${hold.issueNumber}) — ${hold.reason}`);
  }
}

if (heldEyeItems.length > 0) {
  console.log("");
  console.log(`⚠ ${heldEyeItems.length} set(s) of frames would have LEFT HIS PAGE, and did not.`);
  console.log("  The gallery renders `open` only, so marking these done removes them from his");
  console.log("  screen. Their issue closing means the work finished, not that he looked — so");
  console.log("  each is left visible and named instead (#354). This does NOT clear itself:");
  console.log("  If he has REPLIED on them, that is already the act and a command applies it (#749):");
  console.log("    railway.cmd run --service MySQL -- npx tsx scripts/crew-read-replies.mts --write");
  console.log("  Only when he has NOT replied is this a judgement: mark it `answered` once he has");
  console.log("  judged, or re-point it at a card still open.");
  for (const hold of heldEyeItems) {
    console.log(`  ! ${hold.id} (#${hold.issueNumber}) — ${hold.reason}`);
  }
}

if (staleHolds.length > 0) {
  /*
    ⚠ EVERY desk-silent `blocked` card is here, and the written reason changes
    only the LOUDNESS (PR #613 review, finding 1). The first shape used the
    marker line to filter this list, and a card whose body carried a FOSSIL line
    from an older hold would then have been frozen for ever without ever being
    named — the freeze this block exists to prevent.
  */
  const loud = staleHolds.filter((hold) => !hold.hasWrittenReason);
  const quiet = staleHolds.filter((hold) => hold.hasWrittenReason);
  console.log("");
  console.log(`⚠ ${staleHolds.length} card(s) carry \`blocked\` and nothing on his desk holds them.`);
  console.log("  Removing a hold is the act that lets work start, so none is cleared here (#586).");
  if (loud.length > 0) {
    console.log("  NO REASON WRITTEN — most likely a hold this sweep applied whose desk card has");
    console.log("  since been answered. Remove the label or write its `**Waiting on:**` line:");
    for (const hold of loud) console.log(`  ! #${hold.issueNumber}`);
  }
  if (quiet.length > 0) {
    console.log("  A reason IS written — probably held on something real (a card, a rung). Worth");
    console.log("  a glance only, to check the sentence is still true:");
    for (const hold of quiet) console.log(`  · #${hold.issueNumber}`);
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
   at all; a hold is schema-valid. Exiting 2 on it would spend the signal that
   currently means "you cannot ship this" on a state you can. It is printed
   loudly instead, in its own block.

   ⚠ **AND THIS PARAGRAPH CARRIED THIS PR'S OWN DEFECT CLASS ONE SCREEN BELOW
   THE BLOCK IT SPLIT (review of PR #628, finding 1).** It used to end *"a hold
   is schema-valid, TRANSIENT, and resolves itself the sweep after its
   dependant is settled"* — one sentence about all holds that is true of only
   one kind, which is exactly why the report block above is now two.
   **Schema-valid is the half that carries the exit code, and it is true of
   both.** Self-resolving is not:

     - a CARD hold clears itself the sweep after its dependant is settled,
       because the schema forces the settling;
     - an EYE-ITEM hold (#354) waits for a person, and reprints every run until
       one acts.

   A shift reasoning from the old sentence about a perpetually-reprinting frame
   set would conclude it clears itself and stop chasing frames that will sit
   unjudged for ever. Both still exit 0; both are printed loudly. */
process.exit(liars.length > 0 ? 2 : 0);
