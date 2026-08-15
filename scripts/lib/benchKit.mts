/**
 * THE FOUR PIECES EVERY COURT REBUILDS (fable-485 §c, founder-approved
 * 2026-08-14).
 *
 * Fable's survey put bench boilerplate at the top of the 9-file-disease
 * ranking, and the repo agrees: of 409 scripts, **41** open the ledger by hand,
 * **32** hand-assemble a contact sheet, **26** re-declare a bar scaffold, and
 * the free-lane service drive is copied wherever a routing question is asked.
 * Two of the six pieces already live here — `worldGuard.mts` and
 * `sabotage.mts` — so this file is the other four.
 *
 * # Why a KIT and not a template
 *
 * Harness bugs have cost more this month than product bugs, and every one of
 * them was a copy that drifted:
 *
 *  - two benches passed while the segment store was inert, because each
 *    supplied its own arguments instead of the caller's (`harness-supplied
 *    arguments`);
 *  - a corpus bench read its verdicts off `process.stdout.write`, which pino
 *    does not use, and printed 11/13 then 2/13 about an unchanged product;
 *  - a bench whose arms shared state reddened two arms for one sabotage;
 *  - a ledger check that PRINTED a warning nobody exits on.
 *
 * A copied helper cannot be fixed once. This one can.
 *
 * # The rule each piece encodes
 *
 * Every piece here fails LOUD and fails CLOSED. A ledger that moved throws; a
 * missing contact-sheet cell is drawn and returned rather than skipped; a bar
 * with no reading is `NO READING` and never a pass; a reading citing a bar
 * nobody declared is an error. The bench cannot quietly report a smaller truth
 * than it measured.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

/* ────────────────────────────────────────────────────────────────────────────
   1. THE LEDGER, READ AT BOTH ENDS
   ──────────────────────────────────────────────────────────────────────── */

export type LedgerReading = { rows: number; net: number };

/**
 * EVERY LINE A SPENDING DRIVER PRINTS, ON DISK AS IT RUNS — the money guard's
 * sibling. (Ordered in fable-565 §3, after the tuition was paid twice.)
 *
 * The ledger watch proves nothing moved. This one guarantees nothing NEEDS to:
 * a run that spends real credits and prints its findings to a terminal is one
 * `| head` away from being paid for twice, and that is exactly how 50 dev
 * credits went on output that already existed. `tail` cut the summary off, the
 * script was re-run to read it, and the second run rendered again.
 *
 * So the rule is a line of setup: `const say = teeTo(`${OUT}/run.txt`)`. Every
 * line goes to the terminal AND to the file, appended as it happens rather than
 * flushed at the end — a run that dies halfway still leaves what it learned.
 *
 * It is deliberately not a logger: no levels, no timestamps, no formatting
 * opinion. A driver's output is prose somebody reads, and the only thing wrong
 * with it was that it existed in one place.
 *
 * # AND IT DOES NOT CATCH THE SERVER'S OWN LOG. Measured, at a price.
 *
 * A 50-credit reproduction relied on this to keep the render's own line about
 * what it carried, and kept twelve lines: its own. `pino` writes through
 * `sonic-boom` to the file descriptor, not through `process.stdout.write`, so
 * neither this nor a monkey-patch on that method sees a single log line.
 *
 * **A run that needs the SERVER's lines redirects the whole process** —
 * `npx tsx script.mts > run.log 2>&1` — and greps the file afterwards. This is
 * for the driver's own prose, which is a different thing and still worth
 * having.
 */
export function teeTo(file: string): (line?: string) => void {
  const slash = Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\"));
  if (slash > 0) mkdirSync(file.slice(0, slash), { recursive: true });
  /* Truncated once at setup, so a re-run reads as one run rather than as two
     interleaved ones — and the PREVIOUS run's copy is what the operator still
     has open if they were reading it. */
  writeFileSync(file, "");
  return (line = "") => {
    console.log(line);
    appendFileSync(file, `${line}
`);
  };
}


/**
 * Money before and after, on the caller's OWN connection.
 *
 * The connection is passed in rather than opened here, and that is the whole
 * point of the shape: a bench that reads the ledger on a second connection can
 * read a different database from the one it just drove (dev :52008 against
 * production :23768 — same host, same name, different world). One connection,
 * one world, one ledger.
 *
 * `close()` THROWS when the count moved. The hand-rolled version printed a line
 * saying "*** THIS BENCH SPENT MONEY ***" and carried on with exit code 0,
 * which is a warning nobody is required to read.
 */
export async function openLedgerWatch(input: {
  query: (sql: string, params?: unknown[]) => Promise<any[]>;
  userId: number;
  /** Set when a bench is EXPECTED to spend (a paid walk), so it reports rather than throws. */
  spendingIsExpected?: boolean;
}): Promise<{
  before: LedgerReading;
  read: () => Promise<LedgerReading>;
  close: () => Promise<{ before: LedgerReading; after: LedgerReading; moved: boolean; line: string }>;
}> {
  const read = async (): Promise<LedgerReading> => {
    const rows = await input.query(
      "SELECT COUNT(*) AS rowCount, COALESCE(SUM(amount), 0) AS net FROM point_transactions WHERE userId = ?",
      [input.userId],
    );
    return { rows: Number(rows[0]?.rowCount ?? 0), net: Number(rows[0]?.net ?? 0) };
  };
  const before = await read();
  return {
    before,
    read,
    close: async () => {
      const after = await read();
      const moved = after.rows !== before.rows || after.net !== before.net;
      const line = `LEDGER: ${before.rows} rows → ${after.rows} rows · net ${before.net} → ${after.net}`;
      if (moved && !input.spendingIsExpected) {
        throw new Error(`${line}\n  *** THIS BENCH SPENT MONEY — that is a defect in the bench ***`);
      }
      return { before, after, moved, line };
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   2. THE CONTACT SHEET — a number is not a specimen until somebody has seen it
   ──────────────────────────────────────────────────────────────────────── */

export type SheetCell = {
  /** PNG/JPEG bytes for this cell, or null when the run produced none. */
  bytes: Buffer | null;
};

export type ContactSheet = {
  bytes: Buffer;
  width: number;
  height: number;
  /** Every cell that had nothing to draw, as "row × column". Never silent. */
  missing: string[];
};

/**
 * Rows of frames with their labels, in one PNG.
 *
 * A cell with no bytes is drawn as a labelled empty box AND returned in
 * `missing`. The hand-rolled version `console.log`ed "missing: path" and left a
 * hole in the grid, so a sheet with three absent arms looked like a sheet with
 * three dark frames — and a dark frame is a real outcome in this product.
 */
export async function buildContactSheet(input: {
  rows: ReadonlyArray<{ label: string; cells: ReadonlyArray<SheetCell> }>;
  columns: readonly string[];
  tile?: { width: number; height: number };
  background?: string;
}): Promise<ContactSheet> {
  const tileWidth = input.tile?.width ?? 220;
  const tileHeight = input.tile?.height ?? 330;
  const label = 22;
  const width = tileWidth * input.columns.length;
  const height = (tileHeight + label) * input.rows.length + label;

  const missing: string[] = [];
  const tiles: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const [row, entry] of input.rows.entries()) {
    for (const [column, name] of input.columns.entries()) {
      const cell = entry.cells[column];
      const left = column * tileWidth;
      const top = row * (tileHeight + label) + label;
      if (!cell?.bytes) {
        missing.push(`${entry.label} × ${name}`);
        /*
          An absent cell is DRAWN, hatched, with the word on it — so the eye
          reading the sheet cannot mistake "we have no frame" for "the frame
          came back dark", which is a real outcome in this product.

          Hatching rather than a colour, because on-image geometry is
          monochrome everywhere (founder ruling, fable-230) and this file
          composites onto photographs. A tone cannot be trusted to stand out
          from a photograph; an alternation at a fixed pitch is not something a
          rendered face produces, and it survives being read as a number.
        */
        const pitch = 8;
        const hatch = Array.from(
          { length: Math.ceil((tileWidth + tileHeight) / pitch) },
          (_unused, step) => `<line x1="${step * pitch}" y1="0" x2="${step * pitch - tileHeight}"`
            + ` y2="${tileHeight}" stroke="#f2f2f2" stroke-width="2"/>`,
        ).join("");
        tiles.push({
          input: Buffer.from(
            `<svg width="${tileWidth}" height="${tileHeight}">`
            + `<rect width="${tileWidth}" height="${tileHeight}" fill="#141414"/>${hatch}`
            + `<text x="10" y="${Math.round(tileHeight / 2)}" font-family="monospace" font-size="13"`
            + ` fill="#ffffff">no frame</text></svg>`,
          ),
          left, top,
        });
        continue;
      }
      tiles.push({
        input: await sharp(cell.bytes).resize(tileWidth, tileHeight, { fit: "cover" }).png().toBuffer(),
        left, top,
      });
    }
  }

  const captions = Buffer.from(
    `<svg width="${width}" height="${height}">`
    + input.columns.map((name, column) =>
      `<text x="${column * tileWidth + 6}" y="16" font-family="monospace" font-size="14" fill="#fff">${name}</text>`).join("")
    + input.rows.map((entry, row) =>
      `<text x="6" y="${row * (tileHeight + label) + label + tileHeight + 16}" font-family="monospace"`
      + ` font-size="13" fill="#bbb">${entry.label}</text>`).join("")
    + "</svg>",
  );

  const bytes = await sharp({ create: { width, height, channels: 3, background: input.background ?? "#111" } })
    .composite([...tiles, { input: captions, left: 0, top: 0 }])
    .png()
    .toBuffer();
  return { bytes, width, height, missing };
}

/* ────────────────────────────────────────────────────────────────────────────
   3. THE BARS, WRITTEN BEFORE THE FIRST CALL
   ──────────────────────────────────────────────────────────────────────── */

export type Bar = {
  /** What this bar is called in the report, and what a reading must cite. */
  name: string;
  /** The claim in words — what passing it would mean. */
  claim: string;
  /** The number itself, where there is one. */
  floor?: number;
};

export type BarVerdict = {
  bar: Bar;
  /** null when nothing was ever filed against it — never a pass. */
  reading: number | null;
  verdict: "PASS" | "FAIL" | "NO READING";
  saw: string;
};

/**
 * Bars declared up front, readings filed against them by name.
 *
 * Three refusals, and each one is an incident from the record:
 *
 *  - a reading citing a bar nobody declared is an ERROR, not a new bar. That is
 *    how a bench acquires its bar after seeing its numbers;
 *  - a declared bar with no reading is `NO READING` and never a pass. A clean
 *    null is evidence only if the fixture could have produced a non-null;
 *  - a floor is judged against the BOTTOM of the reading's rounding interval
 *    when the caller passes `printedTo`, because a margin can be false in the
 *    third digit.
 */
export function preRegisterBars(bars: readonly Bar[]) {
  const declared = new Map(bars.map((bar) => [bar.name, bar]));
  const readings = new Map<string, { value: number; saw: string }>();
  if (declared.size !== bars.length) throw new Error("two bars share a name");

  return {
    bars,
    /** File what was measured. Throws on a bar nobody declared. */
    file(name: string, value: number, saw: string) {
      if (!declared.has(name)) {
        throw new Error(`no bar named "${name}" was declared before the run — bars are pre-registered`);
      }
      readings.set(name, { value, saw });
    },
    judge(options: { printedTo?: number } = {}): BarVerdict[] {
      return bars.map((bar) => {
        const filed = readings.get(bar.name);
        if (!filed) return { bar, reading: null, verdict: "NO READING" as const, saw: "nothing was filed" };
        if (bar.floor === undefined) {
          return { bar, reading: filed.value, verdict: "PASS" as const, saw: filed.saw };
        }
        /* The bottom of the rounding interval, never the printed figure. */
        const slack = options.printedTo === undefined ? 0 : 0.5 * 10 ** -options.printedTo;
        const verdict = filed.value - slack >= bar.floor ? "PASS" as const : "FAIL" as const;
        return { bar, reading: filed.value, verdict, saw: filed.saw };
      });
    },
    /** The block a report quotes verbatim. */
    print(options: { printedTo?: number } = {}): string {
      return this.judge(options).map((entry) =>
        `  [${entry.verdict.padEnd(10)}] ${entry.bar.name}`
        + (entry.bar.floor === undefined ? "" : ` (floor ${entry.bar.floor})`)
        + ` — ${entry.reading ?? "—"} · ${entry.saw}`).join("\n");
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   4. THE FREE LANE — a whole routing decision, and no money
   ──────────────────────────────────────────────────────────────────────── */

/**
 * `refineCandidate`'s `admit` hook runs after every interpretation and re-read
 * and BEFORE the claim and the charge, so `admit: () => false` drives the real
 * service end to end, text calls only, and refuses at the door having reserved
 * nothing.
 *
 * It is a CONSTANT rather than a habit because the trap is silent: any other
 * value spends the user's credits, and the difference between a free bench and
 * a paid one is one boolean nobody reads twice.
 */
export const FREE_LANE = { admit: () => false } as const;

/**
 * The interpreter, wrapped so every call it makes is on the record.
 *
 * An interpreter probe is not a pipeline reading — the shipped service asks
 * more than once (an echo pass, a re-read, sometimes a door), and a bench that
 * calls `interpretRefinement` directly measures the first step and reports it
 * as the route. This wraps the REAL one and records each call in order.
 */
export function recordingInterpreter<T extends (...args: any[]) => Promise<any>>(real: T): {
  interpret: T;
  calls: Array<{ mode: string; ok: boolean; intent?: string; delta?: unknown; refusal?: unknown }>;
} {
  const calls: Array<{ mode: string; ok: boolean; intent?: string; delta?: unknown; refusal?: unknown }> = [];
  const interpret = (async (request: any) => {
    const answer = await real(request);
    calls.push({
      mode: request?.mode ?? "(default)",
      ok: Boolean(answer?.ok),
      intent: answer?.intent,
      delta: answer?.delta,
      refusal: answer?.refusal,
    });
    return answer;
  }) as T;
  return { interpret, calls };
}
