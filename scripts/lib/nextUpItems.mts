/**
 * NEXT UP's ROWS — the pure half of `scripts/crew-desk-sweep.mts`, lifted out
 * so the running order his page shows him can be DRIVEN (#718).
 *
 * The sweep's I/O stays where it was: reading `gh`, writing labels, writing the
 * briefing. What is here is everything that decides WHAT HE SEES AND IN WHAT
 * ORDER, as a function of already-fetched rows and the holds this run applied.
 *
 * ⚠ **It is here for one reason and it is the same reason `standingExceptions`
 * has a rendering half: a sort that cannot be driven is a sort held to its
 * sibling by prose.** #718 is exactly what that costs — the sweep's own
 * docblock asserted *"queue-standing-exceptions is the same sort"*, which was
 * true when written and stopped being true with nothing anywhere noticing.
 * `server/orderedBandOrder.test.ts` now drives this function and the priority
 * view over ONE fixture and asserts they agree.
 *
 * The rule they both obey is the founder's, on 2026-09-09 (Crew reply #168):
 * *"Urgent wins inside your ordered group"* — `scripts/lib/orderedBand.mts`.
 */
import {
  CREW_HOLD_LABELS,
  heldStateFromLabels,
  holdReasonFromBody,
} from "../../shared/crewNextUpHold.js";

import { sortOrderedBand } from "./orderedBand.mts";

/** A row as `gh issue list --json number,title,labels,body,createdAt` gives it. */
export type OrderedIssue = {
  number: number | string;
  title: unknown;
  labels?: unknown;
  body?: unknown;
  createdAt?: unknown;
};

/** A row of NEXT UP, exactly as `nextUpSchema` in `server/crew/crewBriefing.ts`
 *  will parse it — nothing here may add a field that schema does not know. */
export type NextUpItem = {
  issueNumber: number;
  title: string;
  urgent: boolean;
  held?: { state: string; because?: string };
};

/** The label whose open cards ARE the NEXT UP band. */
export const ORDERED_BAND_LABEL = "founder-ordered";

/**
 * THE CAP ON THE WHOLE-QUEUE READ THAT WITNESSES AN EMPTY BAND — and it lives
 * here because TWO FILES now depend on it meaning the same thing (#774).
 *
 * `crew-desk-sweep.mts` declared it for three readings of its own (the read,
 * the ladder's "a floor, not a list" refusal, and the witness below) with a
 * comment saying a number typed three times is the drift working law 4 is
 * about. The digest is now the fourth and fifth reading, in another file — so
 * the constant moves to the module both import rather than being typed a
 * second time. `verdict.why` quotes it back, so a cap that drifted would say
 * one number while the read used another.
 */
export const OPEN_QUEUE_LIMIT = 200;

/**
 * IS AN EMPTY NEXT UP BELIEVABLE THIS RUN? (#772, and the third instance of one
 * class.)
 *
 * The sweep asks `gh` a narrow question — open issues carrying
 * `founder-ordered` — and **an empty answer to a narrow question is
 * indistinguishable from a broken one.** `[]` was written onto his page as
 * *nothing queued*, with the same confidence as a real reading. It has been
 * seen: the queue counter's half of this road stored 0 for `process` at
 * 15:00:11 and 8 forty seconds later (#725), and the park gate's half was
 * #730.
 *
 * The witness is FREE and already in the sweep: the same run reads the whole
 * open queue with its labels for the ladder block. An empty band is a fact only
 * when that read ANSWERED and holds no card carrying the label.
 *
 *   whole-queue read unreadable  -> not believable (nothing can confirm it)
 *   whole-queue read also empty  -> not believable (a queue is never empty here)
 *   whole-queue read AT ITS CAP  -> not believable (it may not hold the band)
 *   it holds labelled cards      -> not believable, and provably wrong
 *   it answered, none labelled   -> believable: the band really is empty
 *
 * The cap row is the PR #773 review's finding 1 and it is an in-file
 * inconsistency rather than a hypothetical: the sweep's ladder branch already
 * calls a 200-row answer "a floor, not a list", so one consumer of that read
 * refused what this one trusted. `gh` returns the NEWEST rows, and
 * founder-ordered cards skew OLD — the day the queue passes the cap, the band
 * is exactly what falls outside the window, and an empty band would read as
 * believable on a read that never looked at it.
 *
 * Refusing costs a NEXT UP block one run older with its reason printed.
 * Believing costs his page telling him he has nothing queued while his own
 * ordered cards sit in the queue — and every other view a shift reads renders
 * the same query, so nothing would disagree with it.
 */
export function emptyOrderedBandVerdict(
  allOpen: readonly { labels?: unknown }[] | null,
  /** The `--limit` the whole-queue read was taken with, so "at its cap" is the
   *  caller's own number rather than a constant that could drift from it. */
  limit = OPEN_QUEUE_LIMIT,
): { believable: boolean; why: string } {
  return emptyOrderedBandVerdictOnLabels(
    allOpen === null ? null : allOpen.map((row) => labelNames(row.labels)),
    limit,
  );
}

/**
 * THE SAME JUDGEMENT, OVER LABEL NAMES RATHER THAN RAW `gh` ROWS (#774).
 *
 * ⚠ **It exists because the two callers hold their rows in two shapes and a
 * function silently accepting both is how a witness stops witnessing.** The
 * sweep passes `gh` rows, whose `labels` are `{ name }` objects; the digest
 * flattens to `string[]` before it filters. Handing the flattened shape to the
 * raw reader does not throw — `labelNames` reads `.name` off a string, gets
 * `undefined`, and the carried count is **silently zero**, so the sharpest of
 * the four refusals (*"your own read holds N ordered cards"*) would never fire
 * and an empty band would read as believable while the band was sitting in the
 * witness. Both callers therefore state their shape at the boundary, and the
 * decision itself is written once.
 */
export function emptyOrderedBandVerdictOnLabels(
  allOpen: readonly (readonly string[])[] | null,
  limit = OPEN_QUEUE_LIMIT,
  /** Which band is being cross-examined. `founder-ordered` is the default
   *  because it is the one his 2026-08-30 clause is about, but the judgement
   *  is identical for `urgent` — the standing-exceptions view reads both out
   *  of one whole-queue read and asks this question twice (#774, PR #775
   *  review finding 1). A second copy differing only in a string literal is
   *  exactly the drift working law 4 names. */
  band: string = ORDERED_BAND_LABEL,
): { believable: boolean; why: string } {
  if (allOpen === null) {
    return {
      believable: false,
      why: "the whole-queue read that would confirm it could not be taken this run",
    };
  }
  if (allOpen.length === 0) {
    return {
      believable: false,
      why: "the whole open queue came back empty too, which is a blip and not a queue",
    };
  }
  if (allOpen.length >= limit) {
    return {
      believable: false,
      why: `the witness itself came back at its ${limit}-row limit, which is a floor and not a list`,
    };
  }
  const carried = allOpen.filter((labels) => labels.includes(band)).length;
  if (carried > 0) {
    return {
      believable: false,
      why: `this run's own whole-queue read holds ${carried} open card(s) carrying \`${band}\``,
    };
  }
  return {
    believable: true,
    why: `${allOpen.length} open card(s) were read and none carries \`${band}\``,
  };
}

function labelNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((label) => String((label as { name?: unknown })?.name ?? ""));
}

/** A row of the shift digest's NEXT UP block, already flattened. */
export type BandRow = {
  number: number;
  title: string;
  labels: string[];
  createdAt: string;
};

/**
 * THE BAND, CUT OUT OF A WHOLE-QUEUE READ — the shift digest's judgement half,
 * lifted here for the same reason everything else in this file was (#774).
 *
 * `scripts/shift-digest.mts` does the `gh` call; **this decides what the answer
 * MEANS**, which is the part that was wrong and the part a test must be able to
 * drive. A collector that both fetches and judges can only be tested by
 * standing up a `gh`, which is why the defect this repairs shipped green.
 *
 * Three outcomes, and the middle one is the whole point:
 *
 *   the band has rows          -> those rows, truncation measured on the POPULATION
 *   the band is empty, witnessed -> an empty band, believable, printed as EMPTY
 *   the band is empty, unwitnessed -> `Unreadable` — a blip, never "nothing queued"
 *
 * ⚠ Truncation is measured on `allOpen`, NOT on the band. `gh` returns the
 * NEWEST rows and `founder-ordered` cards skew OLD, so a read that filled its
 * window is exactly the one that may not have reached the band.
 */
export function bandFromOpenQueue(
  allOpen: readonly BandRow[],
  limit = OPEN_QUEUE_LIMIT,
): { band: BandRow[]; truncated: boolean } | { unreadable: string } {
  const band = allOpen.filter((row) => row.labels.includes(ORDERED_BAND_LABEL));
  if (band.length === 0) {
    /* The LABEL-shaped reader, because these rows are already flattened —
       see its own docblock for what handing it the wrong shape costs. */
    const verdict = emptyOrderedBandVerdictOnLabels(allOpen.map((row) => row.labels), limit);
    if (!verdict.believable) {
      return { unreadable: `an empty NEXT UP could not be believed — ${verdict.why}` };
    }
  }
  return { band, truncated: allOpen.length >= limit };
}

/**
 * The rows of NEXT UP, in the order a shift genuinely takes them.
 *
 * `appliedReasons` maps an issue number to the reason THIS RUN held it, so a
 * label written moments ago is reflected without re-reading `gh`.
 */
export function planNextUpItems(input: {
  ordered: readonly OrderedIssue[];
  appliedReasons: ReadonlyMap<number, string>;
}): NextUpItem[] {
  const { ordered, appliedReasons } = input;

  const rows = ordered.map((row) => {
    const labels = labelNames(row.labels);
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
    const appliedReason = appliedReasons.get(Number(row.number)) ?? null;
    const state = heldStateFromLabels(
      appliedReason === null ? labels : [...labels, CREW_HOLD_LABELS.blocked],
    );
    /* A hold this run applied says WHY from the desk; every other hold keeps
       reading the filer's own line, which is #298's rule untouched. */
    const because = state === null
      ? null
      : appliedReason ?? holdReasonFromBody(String(row.body ?? ""));
    return {
      issueNumber: Number(row.number),
      title: String(row.title).slice(0, 300),
      urgent: labels.includes("urgent"),
      /* ⚠ NOT stringified here — `filedKey` in `scripts/lib/orderedBand.mts`
         owns what a missing date means, once, for all three views. */
      createdAt: row.createdAt,
      ...(state === null ? {} : { held: { state, ...(because ? { because } : {}) } }),
    };
  });

  /*
    ⚠ **HELD ROWS ARE NOT SORTED DOWN, AND THAT IS #298's OWN INSTRUCTION**:
    *"Do not quietly hide blocked rows — he needs to see that seven of eight
    are stuck, because that is the real state of his queue and it is the thing
    that would tell him to unblock something."* The position stays the
    priority order; the chip explains the skip.
  */
  return sortOrderedBand(rows).map(({ createdAt: _sortKey, ...item }) => item);
}
