/**
 * THE STANDING-EXCEPTIONS RANKING — the rendering half, so both states can be
 * DRIVEN rather than reasoned about (#472's own bar).
 *
 * The fetch stays in `scripts/queue-standing-exceptions.mts` and is the thin
 * part; everything that decides what a shift READS is here, as a pure function
 * of two card lists and a clock.
 *
 * # Why there are two bands and why they are never merged
 *
 * PROGRAM.md's clause of 2026-08-30, written after he asked *"see this is what
 * confuses me i said to do those things so i assumed the shifts are working on
 * them but they are not"*:
 *
 * > **A card labelled `founder-ordered` is AUTHORISED WORK and is taken FIRST —
 * > before the focus, before patrols, before anything.**
 *
 * So his ordered band outranks the urgent band, and this prints it first. They
 * stay two lists on #471's reasoning: **`urgent` means this cannot wait,
 * `founder-ordered` means he chose the order** — collapsing them loses the one
 * signal that means drop everything.
 *
 * # The empty state is the defect this closes
 *
 * The view read ONE label and, when it was empty, printed *"Bands 2 and 3
 * apply"* — a sentence that reads as complete while fourteen cards he had
 * personally ordered sat unnamed. **An empty band now says which labels were
 * looked at**, and the bands-2-and-3 sentence appears only when BOTH are empty,
 * because that is the only state in which it is true.
 *
 * # The running order inside his band is HIS, and it lives in one place
 *
 * ⚠ **This file used to sort his ordered band oldest-first with nothing
 * floating, while his own page floated `urgent` to the top of it (#718).**
 * He settled it on 2026-09-09, verbatim: *"Urgent wins inside your ordered
 * group"*. The comparator is `scripts/lib/orderedBand.mts` and BOTH views
 * call it — this file does not declare its own, because the disagreement it
 * closes was two declarations, not one wrong one.
 */
import {
  ORDERED_BAND_RULE,
  sortOrderedBand,
} from "./orderedBand.mts";
/**
 * How many open cards one band may hold before this reading is INCOMPLETE.
 *
 * ⚠ **A silent cap is this view's own defect class wearing different clothes**
 * (gate review of PR #716, finding 1). The fetch asked for 200 rows and never
 * asked whether it got 200: past that, `gh`'s ordering drops the OLDEST card
 * first — which is exactly the card this ranking exists to surface, and #236 is
 * the incident about an old card sitting unworked. The header would still print
 * a count that reads as the whole band.
 *
 * So it refuses rather than truncating, the way `scripts/lib/queueRot.mts`'s
 * `refuseIfTruncated` does, and for the same stated reason: a short list that
 * looks complete is worse than no list. The decision lives here so it can be
 * driven without a subprocess.
 */
export const BAND_CEILING = 200;

/** Throws when a band came back AT its ceiling, i.e. possibly cut short. */
export function refuseIfTruncated(label: string, rowsRead: number): void {
  if (rowsRead < BAND_CEILING) return;
  throw new Error(
    `the \`${label}\` band came back with ${rowsRead} rows, at the ceiling of ${BAND_CEILING}, `
    + `so this reading may be INCOMPLETE and its count would look like the whole band. `
    + `Raise BAND_CEILING in scripts/lib/standingExceptions.mts.`,
  );
}

export type Row = {
  number: number;
  title: string;
  createdAt: string;
  labels: { name: string }[];
};

/** Oldest first — an ordered or urgent card that has waited longest is what
 *  #236 was filed about. A copy, so a caller's array is not re-sorted. */
export function oldestFirst(rows: readonly Row[]): Row[] {
  return [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Whether a queue row carries the `urgent` label — read from the row's own
 *  labels rather than from a second list, which is this file's whole point. */
export function isUrgent(row: Row): boolean {
  return row.labels.some((label) => label.name === "urgent");
}

/**
 * THE RUNNING ORDER OF HIS ORDERED BAND, exported so it can be driven against
 * the other view's (`server/orderedBandOrder.test.ts`) rather than compared by
 * reading two files. The rule itself is not declared here — it is
 * `compareOrderedBand`, which his page reads from the same module.
 */
export function orderedBandRunningOrder(rows: readonly Row[]): Row[] {
  return sortOrderedBand(
    rows.map((row) => ({ ...row, urgent: isUrgent(row), issueNumber: row.number })),
  );
}

function rowLines(rows: readonly Row[], ownLabel: string, now: Date): string[] {
  const lines: string[] = [];
  for (const [index, row] of rows.entries()) {
    const age = Math.floor(
      (now.getTime() - Date.parse(row.createdAt)) / (24 * 60 * 60 * 1000),
    );
    lines.push(
      `${String(index + 1).padStart(2)}. #${row.number}  ${row.createdAt.slice(0, 10)}  (${age}d)  ${row.title}`,
    );
    /*
      The other labels are printed rather than filtered to a set we chose,
      because `blocked` is the one that matters most here and naming it in a
      list we maintain would be the mirror this whole file exists to avoid: a
      hold this view could not see reads exactly like takeable work.
    */
    const others = row.labels
      .map((label) => label.name)
      .filter((name) => name !== ownLabel);
    if (others.length > 0) lines.push(`      labels: ${others.join(", ")}`);
  }
  return lines;
}

export const PATROL_POINTER = "npx tsx scripts/patrol-clocks.mts";

/**
 * The whole output, as lines. `now` is injected so an arm can assert an age
 * without asserting today's date.
 */
export function renderBands(input: {
  ordered: readonly Row[];
  urgent: readonly Row[];
  now: Date;
}): string[] {
  const { ordered, urgent, now } = input;
  const out: string[] = [
    "STANDING EXCEPTIONS — derived from the queue, never a second list",
    `read ${now.toISOString()} · ${ordered.length} ordered · ${urgent.length} urgent`,
    "",
  ];

  if (ordered.length === 0 && urgent.length === 0) {
    /*
      THE NEGATIVE ARM, AND IT NAMES WHAT IT LOOKED AT. The old sentence said
      only "no card carries `urgent`", which was true and read as complete.
    */
    out.push(
      "  (both bands are empty — no open card carries `founder-ordered`, and none",
      "   carries `urgent`. Bands 2 and 3 apply; for band 3 run",
      `   \`${PATROL_POINTER}\`.)`,
    );
    return out;
  }

  out.push("HIS ORDERED BAND — taken FIRST: before the focus, before patrols (PROGRAM.md)");
  if (ordered.length === 0) {
    out.push("  (empty — no open card carries `founder-ordered`.)");
  } else {
    out.push(...rowLines(orderedBandRunningOrder(ordered), "founder-ordered", now));
  }

  out.push("", "THE URGENT BAND — standing exception 1");
  if (urgent.length === 0) {
    out.push("  (empty — no open card carries `urgent`.)");
  } else {
    out.push(...rowLines(oldestFirst(urgent), "urgent", now));
  }

  out.push(
    "",
    `His band runs ${ORDERED_BAND_RULE}; the urgent band is oldest first.`,
    "The two are NOT merged: `urgent` means this cannot wait, `founder-ordered`",
    "means he chose the order — and inside his band the urgent one goes first.",
    "A row carrying `blocked` is not takeable — read the card before you take it.",
    "Band 2 (blocks every merge) is a judgement and stays prose.",
    `Band 3 (a patrol whose clock has fired) is DERIVED — \`${PATROL_POINTER}\`.`,
  );
  return out;
}

/**
 * THE WHOLE READING — the fetch→render seam, on THIS side of the boundary so it
 * can be driven (gate review of PR #716, finding 2).
 *
 * ⚠ **The seam is where the interesting bug lives, and the first shape of this
 * suite could not see it.** With the rendering driven by injected lists and the
 * wiring asserted by a source grep, transposing the two bands at the call site —
 * `renderBands({ ordered: urgent, urgent: ordered })` — kept EVERY arm green:
 * the rendering arms supply their own lists, and a grep only proves the two
 * fetch strings exist somewhere in the file (a commented-out call passes too).
 * That is the instrument class CLAUDE.md names at invariant 4: the Atlas's own
 * `strictInput` "was a substring test for months".
 *
 * So the band reader is a PARAMETER. The executable passes the real `gh` call
 * and the suite passes a fake keyed on the label, and a transposition is a red
 * arm rather than a shift being told his ordered queue is the urgent one.
 *
 * It returns a process exit code and writes through injected sinks, so no arm
 * needs a subprocess and no arm reads a real queue.
 */
export function report(input: {
  readBand: (label: string) => readonly Row[];
  now: Date;
  log: (line: string) => void;
  error: (line: string) => void;
}): number {
  const { readBand, now, log, error } = input;
  let ordered: readonly Row[];
  let urgent: readonly Row[];
  try {
    /*
      REFUSE RATHER THAN PRINT AN EMPTY RANKING. A ranking that comes up empty
      because `gh` is unauthenticated reads exactly like a ranking that is
      genuinely empty, and the second one means "nothing urgent, work a patrol".
      That is the collector class CLAUDE.md's Atlas section names: a reader that
      can come up empty THROWS rather than returning a short list. It matters
      MORE on the ordered band than it ever did on the urgent one — an empty
      ordered band tells a shift he has asked for nothing, which is precisely
      the harm his 2026-08-30 clause was written about.
    */
    ordered = readBand("founder-ordered");
    urgent = readBand("urgent");
  } catch (failure) {
    /* The message goes FIRST and the hint second — the truncation refusal comes
       through here too, and "is `gh` authenticated?" is the wrong thing to read
       first when the real answer is "raise the ceiling". */
    error(
      `queue-standing-exceptions REFUSING: ${String(failure instanceof Error ? failure.message : failure)}`,
    );
    error("(if that reads like a transport failure rather than a refusal: is `gh` authenticated?)");
    return 1;
  }

  for (const line of renderBands({ ordered, urgent, now })) log(line);
  return 0;
}
