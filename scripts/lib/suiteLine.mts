/**
 * A SUITE READING IS ONLY A READING IF ITS PARTS SUM TO ITS OWN TOTAL.
 *
 * On 2026-08-16 a park reported the suite as *"6,754 passed · 302 skipped ·
 * 0 failed"* and the suite was RED. The failing test was
 * `scriptExitDiscipline` — an untracked probe written minutes after the
 * reading, in scope the moment it existed because that guard sweeps the
 * filesystem rather than the index.
 *
 * Nothing external was needed to convict it. Vitest prints the total in the
 * same line it prints the parts:
 *
 *     Tests  1 failed | 6754 passed | 302 skipped (7057)
 *
 * and 6,754 + 302 + 0 is 7,056. **One test was unaccounted for, and the
 * missing one is precisely the one that was failing.** A claim whose parts do
 * not sum to its own parenthetical total is not a reading — it is a reading
 * with something dropped out of it, and what drops out is never the good news.
 *
 * Ruled standing by fable-791 §1: every suite line in every report quotes all
 * four numbers, and a line whose parts do not sum is not a reading.
 *
 * The check is deliberately blind to WHICH word is which. Vitest may print
 * `todo` alongside the other three, and a category nobody enumerated here must
 * widen the sum rather than break it — a list of expected words would be a
 * mirror of vitest's vocabulary, and mirrors drift (working law 4).
 *
 * # QUOTE THIS LINE VERBATIM. DO NOT RE-TYPESET IT.
 *
 * **A green run has THREE parts, not four** — vitest prints a `failed` part only
 * when there is one, so `suiteVerdict` on a passing suite reads
 * `6764 passed · 302 skipped = 7066  ✓ parts sum to the total`. **A fourth part
 * in a report is the author's, not this reader's**, and so are thousands
 * separators and a shortened tick.
 *
 * This is not pedantry about formatting. `0 failed` is the exact token that
 * carried the 2026-08-16 lie: it was hand-typed into a line whose run had one
 * failure, and it was hand-typed again into the two parks that shipped and
 * ratified this file (opus-583, opus-584) — into output they had otherwise
 * quoted. The cause was a reporting rule demanding four numbers the instrument
 * cannot emit, which a report can only satisfy by editing what it was given
 * (fable-791 §1, AMENDED by fable-794 §1: quote the line verbatim; hand-assembled
 * suite lines are forbidden outright). **An instrument only removes hand-assembly
 * from a report if the report is allowed to paste what it printed.**
 */

export type SuiteReading = {
  /** Every `N word` pair found, in the order printed. */
  parts: Array<{ count: number; label: string }>;
  /** The parenthetical, which vitest prints as the number of tests it ran. */
  total: number | null;
  /** The sum of the parts. */
  sum: number;
  /** Do the parts account for the total? */
  sums: boolean;
  /** How many tests are unaccounted for (negative = the parts overcount). */
  unaccounted: number;
};

/**
 * Read a vitest summary line — `Tests  6755 passed | 302 skipped (7057)` — with
 * or without ANSI colour, with or without thousands separators.
 *
 * Returns `null` only when the line holds no `N word` pair at all, which is the
 * shape of a line that was never the summary. A line WITH parts and no total is
 * read and reported `sums: false`: a total that failed to print is exactly the
 * case this exists to refuse, and treating it as unreadable would let it pass
 * as "the instrument said nothing".
 */
export function readSuiteLine(raw: string): SuiteReading | null {
  const line = raw.replace(new RegExp(String.fromCharCode(27) + "\[[0-9;]*m", "g"), "");
  const parts = [...line.matchAll(/(\d[\d,]*)\s+([A-Za-z]+)/g)]
    .map((match) => ({ count: Number(match[1]!.replace(/,/g, "")), label: match[2]!.toLowerCase() }))
    .filter((part) => Number.isFinite(part.count) && part.label !== "tests");
  if (parts.length === 0) return null;

  const totalMatch = line.match(/\((\d[\d,]*)\)\s*$/);
  const total = totalMatch ? Number(totalMatch[1]!.replace(/,/g, "")) : null;
  const sum = parts.reduce((running, part) => running + part.count, 0);
  return {
    parts,
    total,
    sum,
    sums: total !== null && sum === total,
    unaccounted: total === null ? Number.NaN : total - sum,
  };
}

/** The line a park prints: the reading, then whether it is one. */
export function suiteVerdict(raw: string): string {
  const reading = readSuiteLine(raw);
  if (!reading) return `${raw.trim()}  — NOT A READING (no counts in this line)`;
  const quoted = reading.parts.map((part) => `${part.count} ${part.label}`).join(" · ");
  if (reading.total === null) return `${quoted}  — NOT A READING (no total printed)`;
  if (reading.sums) return `${quoted} = ${reading.total}  ✓ parts sum to the total`;
  return `${quoted} = ${reading.sum} against a total of ${reading.total}`
    + `  — NOT A READING: ${Math.abs(reading.unaccounted)} test(s) `
    + `${reading.unaccounted > 0 ? "unaccounted for" : "counted twice"}`;
}

/**
 * Pick the summary line out of a whole vitest run.
 *
 * It must be the `Tests` line and never the `Test Files` line, and the two are
 * easy to confuse in exactly the case that matters: a predicate reaching for
 * `failed |` finds
 *
 *     Test Files  1 failed | 460 passed | 27 skipped (488)
 *
 * FIRST on a red run — a line whose own parts sum perfectly well. The reader
 * would then report file counts, with a tick beside them, for a suite with a
 * failing test in it. `park-state.mts` carried that predicate until 2026-08-16.
 */
export function findSuiteLine(output: string): string | null {
  const lines = output.replace(new RegExp(String.fromCharCode(27) + "\[[0-9;]*m", "g"), "")
    .split(String.fromCharCode(10))
    .map((line) => line.trim())
    .filter((line) => /^Tests\s+\d/.test(line));
  return lines.length === 0 ? null : lines[lines.length - 1]!;
}
