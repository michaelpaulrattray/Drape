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
 */
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

function rowLines(rows: readonly Row[], ownLabel: string, now: Date): string[] {
  const lines: string[] = [];
  for (const [index, row] of oldestFirst(rows).entries()) {
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
    out.push(...rowLines(ordered, "founder-ordered", now));
  }

  out.push("", "THE URGENT BAND — standing exception 1");
  if (urgent.length === 0) {
    out.push("  (empty — no open card carries `urgent`.)");
  } else {
    out.push(...rowLines(urgent, "urgent", now));
  }

  out.push(
    "",
    "Oldest first within each band, and the two are NOT merged: `urgent` means this",
    "cannot wait, `founder-ordered` means he chose the order.",
    "A row carrying `blocked` is not takeable — read the card before you take it.",
    "Band 2 (blocks every merge) is a judgement and stays prose.",
    `Band 3 (a patrol whose clock has fired) is DERIVED — \`${PATROL_POINTER}\`.`,
  );
  return out;
}
