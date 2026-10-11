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
 * # AND IT REPORTS RECORD FAULTS IT WILL NOT REPAIR
 *
 * Those four passes repair the briefing. The blocks below them report things
 * the RECORD gets wrong and deliberately leave alone, because what each should
 * become is a judgement about work: a hold that has outlived his desk, a hold
 * nobody can read, a pipeline row whose PR cannot land or was closed unmerged,
 * and — newest, #1825 — **a card whose price was eaten by a shell on the way to
 * GitHub.** Each block states its own reason for not repairing; none of them is
 * summarised here, because a second list of them would drift from the first.
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
import { cardsNamedInText } from "../shared/crewBriefingCardToken.js";
import {
  type ResolvableBriefing,
  planCardResolutions,
  promotionLine,
} from "../shared/crewCardResolution.js";
import {
  type UnreadableHold,
  CREW_HOLD_LABELS,
  CREW_HOLD_MARKER,
  planDeskHoldLabels,
  planFounderHeldDrift,
  planUnreadableHolds,
} from "../shared/crewNextUpHold.js";
import {
  type ShellDamageFinding,
  planShellDamage,
} from "../shared/crewShellDamage.js";
import { buildBoard, readCardComments, readNotBuiltCards } from "./lib/cardBuildState.mts";
import { type GhExec, ghReadMaxBuffer, makeGhTransport } from "./lib/ghQueueTransport.mts";
import { readOpenPullRequests } from "./lib/cardClaimWarning.mts";
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
import {
  type PipelineRowPullRequest,
  type PlannablePipelineRow,
  PR_CONFLICT_NOTE,
  planPipelineRowStates,
  planPipelineRowsWithoutPullRequests,
} from "../shared/crewShiftState.js";
import {
  type CrewProblemRowPlan,
  planProblemRows,
} from "../shared/crewProblemState.js";
import { cardNumbersIn } from "../shared/crewQueuePossiblyDone.js";

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

/**
 * `gh` with no shell — it is an .exe, and the shell form emits DEP0190.
 *
 * ⚠ It takes `options` and HONOURS them (#1870). It declared the parameter and
 * ignored it, so a buffer passed through `makeGhTransport` — which forwards on
 * both roads — was silently dropped here; and with no buffer at all the two
 * body-carrying reads below sat on node's 1 MiB default, where an overflow
 * throws into `gh`'s catch and reads as an unreadable board.
 */
const RAW_GH: GhExec = (args, options) =>
  execFileSync("gh", [...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: ghReadMaxBuffer(options),
  });

/**
 * ⚠ **THE QUEUE READS GO OVER REST FIRST (#1399).** GitHub's SECONDARY (burst)
 * limiter refused every GraphQL call for hours a day for four days running with
 * the GraphQL quota 99% unused — and it answers with the PRIMARY limiter's
 * sentence, which is why it read as an exhausted quota. The one shape that stayed
 * refused after the others recovered is the queue LIST read, which is both of
 * this file's own. `makeGhTransport` translates exactly that shape and passes
 * everything else through; the failure semantics below do not move, because a
 * transport that could not answer still throws.
 */
const TRANSPORT = makeGhTransport({ exec: RAW_GH });

function gh(args: string[]): unknown | null {
  try {
    const out = TRANSPORT.run(args);
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

/**
 * A pipeline row's pull request, as `gh` answers it — `null` when it could not
 * be read at all.
 *
 * ⚠ **THE FIELD NAMES ARE THE CONTRACT AND NO FIXTURE CAN SEE THEM
 * (#1101, inheriting #1099's own lesson).** Trim `mergeable,mergeStateStatus`
 * out of this list and `readPullRequestConflict` correctly answers `null` for
 * every row, the stuck block goes quiet for ever, and nothing anywhere turns
 * red — the suite would be driving a table that still carries the fields. So
 * `server/crewPipelineRowStates.test.ts` holds this list at the BYTES.
 *
 * `closedAt` joined it for #1439 and is the one field here that decides NOTHING:
 * the closed-unmerged verdict is `state` alone, and this only lets the report
 * tell a shift when the PR was closed so the replacement is one search away. It
 * is held at the bytes with the rest, because a field read for a report still
 * has to be asked for.
 */
function prRecord(prNumber: number): PipelineRowPullRequest {
  const row = gh([
    "pr", "view", String(prNumber),
    "--json", "state,mergeable,mergeStateStatus,closedAt",
  ]) as Json | null;
  return row === null ? null : row as PipelineRowPullRequest;
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
  /* `body` rides along for `planUnreadableHolds` (#1467 slice 2) — the hold
     REASON lives in the body, so a held card that never says whose hold it is
     can only be found here. Same request, same instant, no extra call, and the
     ladder pass below reads this same answer. */
  "--json", "number,title,labels,body",
]) as Json[] | null;

/*
  ⚠ **THE HELD CARDS NOTHING DRAWS (#1467 slice 2).** `planUnreadableHolds` owns
  the rule and the measurement; this is its I/O, and it sits here because the
  read above is the only one that sees the WHOLE queue. The stale-hold block
  below is its neighbour and its opposite: that one asks whether a hold has
  outlived his desk, this one asks whether anybody can tell what a live hold is
  waiting for.

  ⚠ **A READ THAT FAILED IS NEVER REPORTED AS A CLEAN POPULATION.** `null` here
  means `gh` did not answer, and an empty finding list would read exactly like
  "every held card says whose hold it is" — the shape the shift-close orders
  name as a receipt that cannot be trusted.
*/
const unreadableHolds: readonly UnreadableHold[] = allOpen === null
  ? []
  : planUnreadableHolds({
    open: allOpen.map((row) => ({
      issueNumber: Number(row?.number),
      labels: Array.isArray(row?.labels)
        ? (row.labels as Json[]).map((label: Json) => String((label as { name?: unknown })?.name ?? ""))
        : [],
      body: String(row?.body ?? ""),
    })),
  });
if (allOpen === null) {
  skipped.push(
    "HOLDS: the open queue could not be read, so no card was checked for a hold that does not say"
    + " whose it is. That is unread, NOT clean.",
  );
}

/*
  ⚠ **A PRICE EATEN BY A SHELL ON THE WAY TO GITHUB (#1825).** `planShellDamage`
  owns the rule, the measurement and the stated holes; this is its I/O, and it
  belongs here for the same reason the block above does — the read is the only
  one that sees the WHOLE open queue, titles and bodies together, so the pass
  costs no extra call.

  **It belongs in THIS script rather than in a guard** because the damage is in
  a RECORD and not in the tree: no suite can see what a card title says, and the
  disease this file's own header names is *"a state written once, at the moment
  it became true, and never re-read"*. A title mangled by a shell is exactly
  that, and a shift close is the cadence at which it can be caught at all.

  ⚠ **A READ THAT FAILED IS NEVER REPORTED AS A CLEAN POPULATION** — the same
  rule as the holds above, and it matters more here, because the honest answer
  on a healthy board is zero and an unread board also answers zero.
*/
const shellDamage: readonly ShellDamageFinding[] = allOpen === null
  ? []
  : planShellDamage(allOpen.map((row) => ({
    issueNumber: Number(row?.number),
    title: String(row?.title ?? ""),
    body: String(row?.body ?? ""),
  })));
if (allOpen === null) {
  skipped.push(
    "SHELL DAMAGE: the open queue could not be read, so no card title or body was checked for a"
    + " price eaten by a shell. That is unread, NOT clean.",
  );
}

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

    ⚠ **AND HIS OWN STATED SEQUENCE OUTRANKS BOTH (#1006, 2026-09-19).** When he
    orders cards in a sentence, the relay files `order:<n>` labels and
    `orderedBand.mts` puts those first, lowest first; a card he did not rank
    keeps the order below. The night of 2026-09-16 he ordered five and this
    block showed him the exact reverse, which is why the label exists.

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
  /*
    ⚠ WHO IS ALREADY BUILDING WHICH OF THESE (#1094 piece 2) — REPORTED, NEVER
    WRITTEN INTO THE BRIEFING.

    This sweep is the one queue reader whose output is a stored artifact, and
    "somebody has a pull request open on #1231" is the most perishable fact on the
    board: it is true for an hour. `server/crew/liveDesk.ts` derives the same
    phrases from GitHub every 30 s and his page draws THOSE (#1193), so writing a
    copy here would be a second list that is stale before he reads it — working
    law 4, and the staleness argument `next-up-escalation.mts`' own header makes
    about reading the briefing.

    What the sweep owes is its OPERATOR: the person running it is about to look at
    NEXT UP and decide something, and the line below tells them which rows are not
    on offer. Same reader, same judgement, same words as his page.
  */
  const prs = readOpenPullRequests();
  const comments = readCardComments();
  const notBuilt = readNotBuiltCards();
  const board = buildBoard({
    openPullRequests: prs === null ? { unreadable: "`gh pr list` could not be read" } : prs,
    comments: comments === null
      ? { unreadable: "`gh api .../issues/comments` could not be read" }
      : comments,
    notBuilt: notBuilt === null
      ? { unreadable: "`gh issue list --label not-built` could not be read" }
      : notBuilt,
    nowMs: Date.now(),
  });
  const onIt = items
    .map((item) => ({ number: item.issueNumber, phrase: board.phraseFor(item.issueNumber) }))
    .filter((row): row is { number: number; phrase: string } => row.phrase !== null);
  if (board.partial) {
    skipped.push(
      `NEXT UP: nobody checked which rows are already being built — ${board.unreadable.join("; ")}.`
      + " That is an unread board, not a clean one.",
    );
  } else if (onIt.length === 0) {
    changes.push(`NEXT UP: no row is already being built or claimed (${prs === null ? 0 : prs.length} open PR(s) read)`);
  } else {
    changes.push(
      `NEXT UP: ${onIt.length} row(s) already have somebody on them — `
      + onIt.map((row) => `#${row.number} ${row.phrase}`).join("; "),
    );
  }
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
const pipelinePlan = planPipelineRowStates(
  (briefing.pipeline ?? []) as (Json & PlannablePipelineRow)[],
  prRecord,
);

for (const item of pipelinePlan.merged) {
  changes.push(`pipeline ${item.id}: ${item.status} → merged (PR ${item.prNumber} is merged)`);
  item.status = "merged";
  /* A merged row cannot be waiting on him; its cardId would fail the parse. */
  delete item.cardId;
}
for (const item of pipelinePlan.unreadable) {
  skipped.push(`pipeline ${item.id}: PR ${item.prNumber} could not be read — left ${item.status}.`);
}

/*
  ⚠ **AND THE ROWS THAT READER SKIPS ON ITS FIRST STATEMENT (#2165).**

  `planPipelineRowStates` opens with `if (typeof row.prNumber !== "number")
  continue;`, so a live row naming no pull request is invisible to all four of
  its verdicts — it cannot be promoted, called stuck, called closed-unmerged, or
  even called unreadable. It says whatever it was written saying, for ever.

  ⚠ **IT COSTS NO NEW `gh` CALL.** Whether a card is open is already in
  `allOpen`, read once at the top for the whole run. What that list cannot say
  is whether a MISSING card is closed or merely past `OPEN_QUEUE_LIMIT`, so the
  reader is handed a three-state answer and a row it cannot judge is left alone
  — the same guard the ladder pass makes one block up, for the same reason.
*/
const openCardNumbers = allOpen === null
  ? null
  : new Set(allOpen.map((row) => Number(row?.number)));
const queueIsAFloor = allOpen !== null && allOpen.length >= OPEN_QUEUE_LIMIT;
/*
  ⚠ `null` IS THE WHOLE GUARD. A missing card is closed only if the list it is
  missing from was a LIST; at the cap it is a floor, and reporting a live card
  as closed is the finding-shaped lie this sweep exists to prevent.

  ⚠ **ONE DECLARATION, BECAUSE TWO PASSES NOW ASK IT (#2247).** The problems
  reader below judges its rows against the same `gh issue list` this one does,
  at the same instant and under the same cap — so a second copy of this
  three-state rule would be two readers of one question, and the day one of
  them learned about the cap and the other did not, only the capped one would
  start calling live cards closed.
*/
const isCardOpen = (card: number): boolean | null => {
  if (openCardNumbers === null || queueIsAFloor) return null;
  return openCardNumbers.has(card);
};
const pipelineNoPr = planPipelineRowsWithoutPullRequests(
  (briefing.pipeline ?? []) as (Json & PlannablePipelineRow & { title?: string })[],
  (title) => cardNumbersIn(title),
  isCardOpen,
);
if (allOpen === null) {
  skipped.push("PIPELINE: the open queue could not be read, so no PR-less row was judged against its card.");
} else if (queueIsAFloor) {
  skipped.push(
    `PIPELINE: ${OPEN_QUEUE_LIMIT} rows came back, which is the limit — a PR-less row's card `
    + "cannot be called closed off a floor.",
  );
}

/**
 * What this pass reads off a `problems` row: the three fields `planProblemRows`
 * judges, plus the two the report prints. `problemSchema` has already refused a
 * row missing any of them by the time an edition is in the tree.
 */
type PlannableProblemRow = Json & {
  id: string;
  title: string;
  detail: string;
  severity: string;
  state: string;
};

/*
  ⚠ **4b. HIS PROBLEMS SECTION — THE SECTION HE COMPLAINED ABOUT BY NAME, AND
  THE ONLY ONE OF HIS LISTS NOTHING HAS EVER RE-READ (#2247).**

  `planProblemRows` owns the rule, the measurement and the two things it
  deliberately does not judge; this is its I/O. His words, 2026-09-25: *"problems
  never seems to update and it doesnt feel useful either"*.

  ⚠ **IT COSTS NO NEW `gh` CALL** — `allOpen` was read once at the top of the
  run for everything, and `isCardOpen` above is the same three-state predicate
  the pipeline pass uses, so the two sections cannot describe different moments.

  ⚠ **AND THE READER HANDED IN IS HIS PAGE'S OWN** (`cardsNamedInText`, moved to
  `shared/` by this card for exactly this reason). `problemsFor` retires a row
  live when a card it names has closed; this names the same rows for repair. One
  spelling, or the sweep would go quiet about rows his page draws.

  ⚠ **A READ THAT FAILED IS NEVER REPORTED AS A CLEAN POPULATION** — the same
  rule as the holds and the shell damage above. An unread queue makes every
  judgeable row `unjudged` rather than fine.
*/
const problemRows: CrewProblemRowPlan<PlannableProblemRow> = planProblemRows(
  (briefing.problems ?? []) as PlannableProblemRow[],
  cardsNamedInText,
  isCardOpen,
);
if (allOpen === null) {
  skipped.push(
    "PROBLEMS: the open queue could not be read, so no problem row was judged against the cards"
    + " it names. That is unread, NOT clean.",
  );
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
  /*
    ⚠ EVERY ROW HERE IS A CARD THAT CLOSED WHILE HIS EYE WAS STILL OWED (#1349).

    That is what the hold IS: the issue is CLOSED — `planCardResolutions` only
    reaches a hold through `closing()` — and the frames still need him. His
    rule, 2026-09-26: *"yes it shouldnt close if its waiting on my eye and my
    verdict"*. So the block says the breach out loud rather than only naming the
    frames, because the card being shut is the half that costs him a verdict:
    #1208 closed on its merge, he answered the next day, and the answer landed
    where nobody was listening.
  */
  console.log(`⚠ ${heldEyeItems.length} card(s) are CLOSED while his eye is still owed (#1349).`);
  console.log("  A card waiting on his eye or his verdict does not close — his rule, 2026-09-26.");
  console.log("  Reopen it with the receipt `built and live — waiting on his eye`, so his verdict");
  console.log("  has an owner when it lands; the frames stay on his page either way.");
  console.log("");
  console.log(`  ${heldEyeItems.length} set(s) of frames would have LEFT HIS PAGE, and did not.`);
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

if (unreadableHolds.length > 0) {
  /*
    ⚠ **THE OTHER DIRECTION, AND IT IS THE SILENT ONE (#1467 slice 2).** The
    block above finds a hold that has outlived his desk. This finds a hold that
    is perfectly live and says nothing anybody can act on: `liveWaitingOnYou`
    will not draw it, because that reader never guesses `you` from a sentence it
    cannot read, and until this block nothing named it either.

    ⚠ **IT IS EVERY BAND, WHICH IS THE WHOLE POINT.** `planDeskHoldLabels`'
    population is the `founder-ordered` queue, and neither of the two cards this
    was filed about is founder-ordered — so the obvious home could not see
    either of them. This reads the whole-queue answer instead.

    Exit code 0, on the rule the tail of this file states rather than a fresh
    judgement: a briefing carrying this is schema-VALID, so a shift can ship
    past it, and exit 2 is spent only on what it cannot.
  */
  const titles = new Map<number, string>(
    (allOpen ?? []).map((row) => [Number(row?.number), String(row?.title ?? "")]),
  );
  /*
    ⚠ **HIS OWN CARDS LEAVE THE REPAIR BAND FIRST (#2117).**

    Both repairs this block asks for — write the sentence, or drop the hold
    label — are acts a seat is forbidden to perform on a card he keeps for
    himself (#1995, his *"dont let the crew touch it"*). So those rows are still
    SHOWN, because a live hold nothing draws is exactly what this block exists
    to surface; what changes is that nobody is asked to fix them.

    **Measured before it was built: five consecutive shifts met the same row and
    each one correctly did nothing.** The row was never the expensive part — a
    block whose finding is always unactionable teaches its reader to skim the
    ones beside it that are real, and those are the four this sweep is for.
  */
  const founderHeld = unreadableHolds.filter((hold) => hold.founderHeld !== null);
  const ours = unreadableHolds.filter((hold) => hold.founderHeld === null);
  const silent = ours.filter((hold) => hold.reason === null);
  const unclear = ours.filter((hold) => hold.reason !== null);
  if (founderHeld.length > 0) {
    console.log("");
    console.log(`· ${founderHeld.length} held card(s) are HIS OWN — worth a glance, nothing to do:`);
    for (const hold of founderHeld) {
      console.log(`  · #${hold.issueNumber} [${hold.heldStates.join(",")}] ${hold.founderHeld}`);
    }
    console.log("  Not repairable by a seat either way: writing the sentence edits his card, and");
    console.log("  dropping the label is the act his own order names. Shown so the hold is never");
    console.log("  invisible — read the sentence above and check it is still true.");
  }
  if (ours.length > 0) {
    console.log("");
    console.log(
      `⚠ ${ours.length} held card(s) do not say whose hold it is — so his page cannot draw`,
    );
    console.log("  them and, until this line existed, nothing named them either (#1467).");
    console.log("  NOT repaired here: what a hold is waiting on is a judgement about work, and a");
    console.log("  sentence nobody meant is worse than none because the next reader believes it.");
    if (silent.length > 0) {
      console.log(`  NO \`${CREW_HOLD_MARKER}\` LINE IN THE BODY — write one, or drop the hold label:`);
      for (const hold of silent) {
        console.log(
          `  ! #${hold.issueNumber} [${hold.heldStates.join(",")}] ${(titles.get(hold.issueNumber) ?? "").slice(0, 70)}`,
        );
      }
    }
    if (unclear.length > 0) {
      console.log("  A LINE IS THERE and the first word after the marker names nobody — rewrite it so");
      console.log("  it begins with who is waited on (`you`, a person, a card, a clock):");
      for (const hold of unclear) {
        console.log(`  ! #${hold.issueNumber} [${hold.heldStates.join(",")}] ${JSON.stringify(hold.reason)}`);
      }
    }
    console.log("  ⚠ A comment does not count — the body is what is read (the founder-ordered clause).");
  }
}

/*
  ⚠ **AND THE EXEMPTION LIST IS CHECKED AGAINST THE QUEUE EVERY RUN (#2117).**

  The one way a hand-written exemption rots: the card he kept is closed or
  handed back, and the entry stays here for ever quietly excusing nothing. The
  list is only defensible under working law 4 because this says so out loud.

  Deleting the line IS the repair, so unlike its neighbours above this one names
  an act a shift may actually perform — and it is reported rather than applied,
  for the same reason everything else here is: whether a card has stopped being
  his is his to say.
*/
const founderHeldDrift = planFounderHeldDrift({
  openIssueNumbers: allOpen === null ? null : allOpen.map((row) => Number(row?.number)),
});
if (founderHeldDrift.length > 0) {
  console.log("");
  console.log(`⚠ ${founderHeldDrift.length} founder-held exemption(s) name a card that is not open.`);
  console.log("  Delete the line in `FOUNDER_HELD_CARDS` (`shared/crewNextUpHold.ts`) — an exemption");
  console.log("  that outlives its card is a permanent silent pass:");
  for (const stale of founderHeldDrift) {
    console.log(`  ! #${stale.issueNumber} — ${stale.why}`);
  }
}

if (shellDamage.length > 0) {
  /*
    ⚠ **REPORTED, NEVER REPAIRED, AND HERE THE REFUSAL IS ABOUT A NUMBER
    (#1825).** #1690's two prices were recovered from its own body, which had
    been filed separately and was intact — a different card may have nothing to
    recover from, and a title rewritten on a guess is a wrong price laundered
    into a confident one on a board that carries the spend threshold and the
    approved top-up ladder.

    Exit code 0, read off the rule at the foot of this file rather than chosen
    afresh: a briefing carrying this is schema-VALID, so a shift can ship past
    it, and exit 2 is spent only on what it cannot.
  */
  const titles = new Map<number, string>(
    (allOpen ?? []).map((row) => [Number(row?.number), String(row?.title ?? "")]),
  );
  console.log("");
  console.log(
    `⚠ ${shellDamage.length} card field(s) carry a price that a SHELL ATE on the way to GitHub.`,
  );
  console.log("  A `$` is an instruction to a shell, not money: `$0.75` became the shell's own");
  console.log("  path with the cents still welded on, and `$1` became nothing at all.");
  console.log("  NOT repaired here — what the number was meant to say is a judgement, and a");
  console.log("  guessed price is worse than a visibly broken one (#1690 was recoverable only");
  console.log("  because its body had been filed separately and was intact).");
  for (const finding of shellDamage) {
    console.log(`  ! #${finding.issueNumber} ${finding.field} — ${finding.matched}`);
    /* A TITLE is short, so the whole of it is the most useful context and the
       excerpt would merely repeat it; a BODY needs the window round the mark. */
    const context = finding.field === "title"
      ? (titles.get(finding.issueNumber) ?? finding.excerpt)
      : finding.excerpt;
    console.log(`      ${context}`);
  }
  console.log("  Repair it, then FILE THE NEXT ONE SAFELY: `--body-file`, single quotes, or the");
  console.log("  title through `execFileSync` with no shell. That is the half that actually");
  console.log("  stops it — `$1` through `$9` vanish without a trace, and `$12` becomes `2`,");
  console.log("  so no reader here or anywhere can find the silent half of this fault.");
}

if (pipelinePlan.stuck.length > 0) {
  /*
    ⚠ REPORTED, NEVER WRITTEN, AND THE ORDER OF THE ADVICE IS THE PRODUCT
    DECISION (#1101). The repair comes FIRST because an ordinary merge
    collision is not something he should ever read about — #1078 went
    `CONFLICTING` twice in one day, both times from a routine merge to `main`
    touching only the generated atlas, and both were cleared in fifteen
    minutes. A row that says so on his page before a shift has tried the
    repair teaches him to ignore the line.

    The sentence on the row is written BY HAND, in his words, like every other
    `note` — `pipelineItemSchema` already carries the field, so this needs no
    new status for him to learn and no machine-written copy on his page.
  */
  console.log("");
  console.log(`⚠ ${pipelinePlan.stuck.length} pipeline row(s) tell him work is moving on a PR that CANNOT LAND.`);
  console.log(`  ${PR_CONFLICT_NOTE}`);
  console.log("  Nothing is repaired here. In this order:");
  console.log("  1. Re-merge `main` on its branch (#984 step 1) — fifteen minutes, and then his");
  console.log("     page was right all along and there is nothing to write.");
  console.log("  2. ONLY if it is still stuck when he will read the page — it is in another");
  console.log("     lane, or the repair failed — say so in the row's `note`, in his terms:");
  console.log("     what is held up and that somebody has to re-merge it before it can land.");
  for (const item of pipelinePlan.stuck) {
    console.log(`  ! ${item.id} — PR #${item.prNumber}, row still says \`${item.status}\``);
  }
}

if (pipelinePlan.closedUnmerged.length > 0) {
  /*
    ⚠ REPORTED, NEVER REWRITTEN, AND THE REFUSAL TO GUESS IS THE WHOLE DESIGN
    (#1439). The specimen: `try-again-row-1347` said `in-review` over PR #1353
    for a day, while #1355 — its replacement — had merged and card #1347 had
    closed four seconds later. The sweep promotes a row when THE PR THE ROW
    NAMES merges, and #1353 never will: it was closed and replaced because a
    commit message carried a closing keyword and could not be amended without a
    force push (#376). So the row's condition can never become true, the sweep
    correctly left it alone, and it was stuck for good.

    **The sweep cannot guess the successor PR and must not try.** A row promoted
    to `merged` on a guess is worse than a row that is late, because it is the
    shape he asked about — *"problems never seems to update"* — wearing a green
    tick. What it CAN do is refuse to let a row assert a state its own evidence
    contradicts, and name the PR and its close date so the replacement is one
    search away.
  */
  console.log("");
  console.log(`⚠ ${pipelinePlan.closedUnmerged.length} pipeline row(s) name a PR that was CLOSED WITHOUT MERGING.`);
  console.log("  The row's own claim has stopped being true and this pass can never repair it:");
  console.log("  it promotes a row when the PR THE ROW NAMES merges, and that one never will.");
  console.log("  Nothing is rewritten here — the successor is a judgement about work. By hand:");
  console.log("  1. Find the replacement PR (a closed-and-replaced PR is the #376 road — a");
  console.log("     closing keyword in a commit message, rebuilt on a new branch).");
  console.log("  2. Point the row at it and set the status the record supports, or delete the row.");
  for (const item of pipelinePlan.closedUnmerged) {
    const closed = item.closedAt === null ? "close date unread" : `closed ${item.closedAt}`;
    console.log(`  ! ${item.id} — PR #${item.prNumber} ${closed}, row still says \`${item.status}\``);
  }
}

if (pipelineNoPr.length > 0) {
  /*
    ⚠ **THE ROWS THE READER ABOVE CANNOT SEE AT ALL (#2165).**

    Its first statement is `if (typeof row.prNumber !== "number") continue;`, so
    a live row naming no pull request is outside every one of its four verdicts
    — not promoted, not stuck, not closed-unmerged, not even unreadable. Until
    this block there was no rule anywhere that could notice one, and the
    specimen had been saying `in-review` since its card closed a week earlier.

    ⚠ **REPORTED, NEVER REWRITTEN, on this pass's own standing posture.** A card
    closes for reasons other than its work shipping — refused, superseded,
    folded into another card — so *the card is closed* does not mechanically
    mean *write `merged`*. What the row should say is a judgement about work,
    and a status nobody meant is worse than a stale one because the next reader
    believes it.

    ⚠ **AND THE REPAIR IS ONE A SHIFT CAN ACTUALLY MAKE, which the other blocks
    here cannot always say.** It is an edit to an edition a shift is writing
    anyway, so it costs nothing extra and it does not ask for a deploy of its
    own — which is the loop #2165 was filed about.
  */
  console.log("");
  console.log(`⚠ ${pipelineNoPr.length} pipeline row(s) name NO pull request and every card they name has CLOSED.`);
  console.log("  The reader above skips these by construction — a row with no PR number is outside");
  console.log("  all four of its verdicts, so one can sit saying `in-review` for ever (#2165).");
  console.log("  Nothing is rewritten here: a card closes for reasons other than its work shipping,");
  console.log("  so what the row should say is a judgement. Fix it in the next edition you write.");
  for (const item of pipelineNoPr) {
    console.log(
      `  ! ${item.id} — says \`${item.status}\`, names #${item.cards.join(", #")} (closed), no PR`,
    );
  }
}

/*
  ⚠ **THE PROBLEMS SECTION, READ BACK AGAINST THE RECORD (#2247).**

  Why it is printed rather than applied is `planProblemRows`' own docblock and
  is this pass's standing posture: *resolved* and *still half-true* are
  different answers, and a row's repair is an edit to an edition a shift is
  writing anyway.

  Exit code 0, read off the rule at the foot of this file rather than chosen
  afresh: a briefing carrying any of these is schema-VALID, so a shift can ship
  past it, and exit 2 is spent only on what it cannot.
*/
if (problemRows.stale.length > 0) {
  console.log("");
  console.log(`⚠ ${problemRows.stale.length} problem row(s) say \`open\` and a card they name has CLOSED.`);
  console.log("  Three of twenty-one did at edition 674, and you would not have seen one: his page");
  console.log("  retires a row live when its card closes, so these are invisible on a good night —");
  console.log("  and ALL of them are drawn the night GitHub will not answer the crew's reads");
  console.log("  (#1399, four nights running). That night is the one he complained about.");
  console.log("  Nothing is rewritten here: `resolved` and `still half-true` are different answers,");
  console.log("  and the repair is an edit to the next edition you write anyway.");
  for (const finding of problemRows.stale) {
    console.log(
      `  ! ${finding.row.id} — names #${finding.closed.join(", #")} (closed)`
      + (finding.row.severity === "info" ? " [info — his page does not draw it today]" : ""),
    );
    console.log(`      ${String(finding.row.title).slice(0, 90)}`);
  }
}

if (problemRows.noCard.length > 0) {
  console.log("");
  console.log(`· ${problemRows.noCard.length} problem row(s) name NO card, so nothing can ever retire them.`);
  console.log("  `problemsFor` reads the title AND the detail, and neither of these names a `#N` —");
  console.log("  a card number living only in the row's `id` slug is read by nothing (#2247, the");
  console.log("  #2165 shape one section over). This had never happened when the reader was built.");
  console.log("  Either write the `#N` into the row's own words, or resolve it in your edition —");
  console.log("  a row that cannot retire by any road will outlive its fault by months.");
  for (const finding of problemRows.noCard) {
    console.log(`  · ${finding.row.id} — ${String(finding.row.title).slice(0, 90)}`);
  }
}

if (problemRows.unjudged.length > 0) {
  console.log("");
  console.log(`! ${problemRows.unjudged.length} problem row(s) could not be judged — their cards were not readable.`);
  console.log("  Unread is NOT clean and it is not stale either: a card missing from a capped or");
  console.log("  failed queue read is either closed or past the cap, and those are opposite facts.");
  for (const finding of problemRows.unjudged) {
    console.log(`  ! ${finding.row.id} — names #${finding.cards.join(", #")}, unread`);
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
   unjudged for ever. Both still exit 0; both are printed loudly.

   ⚠ **A STUCK PIPELINE ROW (#1101) EXITS 0 FOR THE SAME REASON, AND IT IS READ
   OFF THIS PARAGRAPH RATHER THAN CHOSEN.** It is the closest thing yet to a
   liar — both are a row on his page saying something the record does not
   support — so the temptation to give it exit 2 is real. But the rule above is
   not "how wrong is it", it is **"can the shift ship past it"**: a liar is a
   shape the schema REFUSES at the parse, and a row whose PR is merely
   conflicting is schema-valid and ships. Spending the one signal that means
   *you cannot ship this* on a state you can is what that paragraph forbids.
   It is printed loudly instead, and its first instruction is a repair that
   usually removes the whole question. */
process.exit(liars.length > 0 ? 2 : 0);
