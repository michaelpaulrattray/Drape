/**
 * THE GUARD FOR #536 — the four slice-refund sentences have ONE author, and a
 * fifth copy of any of them reddens here.
 *
 * The card is working law 4: `scripts/machinist-ledger-read.mts` matched credit
 * refunds by their exact wording and typed all four sentences out a second
 * time, copied from their writers. Nothing pinned them together. The repair is
 * `sliceRefundLedger.ts`; **this file is the thing that keeps the repair true**,
 * because the alternative — a comment asking the next author to remember — is
 * exactly what had already failed three times on this reader (PR #533's three
 * review rounds, each finding a sentence the list did not carry).
 *
 * ⚠ **The drift this guards is SILENT, which is why a test and not a habit.**
 * A reworded sentence at a writer whose failure has not fired lately leaves the
 * cross-check printing `AGREES` for months: the render-fault sentence has not
 * fired in 60 days, and no `castingV2.retry` operation has ever run on
 * production, all time.
 */
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readListedSource } from "../testing/listedSource";
import {
  SLICE_REFUND_DESCRIPTION,
  SLICE_REFUND_DESCRIPTIONS,
  rollSliceRefundDescription,
} from "./sliceRefundLedger";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");

/*
 * The one file allowed to hold these sentences, and this test, which must
 * quote them to look for them. Everything else composes them.
 */
const AUTHOR = path.join("server", "castingV2", "sliceRefundLedger.ts");
const THIS_FILE = path.join("server", "castingV2", "sliceRefundLedger.test.ts");

const ROOTS = ["server", "scripts", "shared", path.join("client", "src")];
const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".js", ".mjs"]);

/*
 * RECURSIVE ON PURPOSE, and it is stated because the opposite has bitten this
 * repository: a guard declaring "every source file" and reading one directory
 * flat is #655's whole class. A sentence moved into a subdirectory must not
 * become invisible to this sweep.
 *
 * `withFileTypes` rather than a `statSync` per entry — an entry can be gone
 * before it is even classified, which is the `stat` half of #223 that reading
 * the code missed and driving the race found.
 */
function sourceFilesUnder(root: string): string[] {
  const absolute = path.join(REPO, root);
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (EXTENSIONS.has(path.extname(entry.name))) found.push(path.relative(REPO, full));
    }
  };
  walk(absolute);
  return found;
}

/*
 * ⚠ READ ONCE, AT MODULE SCOPE, AND IT IS NOT AN OPTIMISATION — IT IS WHAT
 * KEEPS THIS FILE OUT OF A FLAKY POPULATION. The first shape re-read every file
 * for every sentence: four passes per arm, eight across the two sweeping arms.
 * Alone that cost ~2.2s; inside `vitest run server/castingV2` it took **20.1s
 * against vitest's 5s per-arm default** and went red — while
 * `uploadRefusalCopy.test.ts`, a sweep of exactly this shape, was doing the
 * same thing on `main` (filed as #741). A guard that reddens because the
 * machine was busy teaches a shift to ignore it, which is worse than not having
 * it. One pass instead: 2159ms → 89ms.
 *
 * ⚠ AND THE READ GOES THROUGH `readListedSource`, NEVER A BARE `readFileSync` —
 * #223's class, and the gate caught this file writing the bare form. A walk
 * LISTS and then READS, and this tree carries hundreds of untracked disposables
 * that parallel suites plant and unlink; a file that is gone at the read was
 * not part of the tree at the moment of the reading, and skipping it is the
 * correct answer rather than an ENOENT that refuses the deploy rite on a clean
 * tree. **Skipping is also how a reader goes quiet**, which is what the
 * positive control below exists to catch.
 *
 * The explicit timeouts are the belt to these braces, stated rather than tuned
 * by feel: one pass over ~1,900 files is fast, and it still shares a disk with
 * twelve thousand other arms.
 */
const SOURCES: ReadonlyMap<string, string> = new Map(
  ROOTS.flatMap(sourceFilesUnder).flatMap((relative): Array<[string, string]> => {
    const contents = readListedSource(path.join(REPO, relative));
    return contents === null ? [] : [[relative, contents]];
  }),
);

const POPULATION = [...SOURCES.keys()];

const SWEEP_TIMEOUT_MS = 30_000;

function filesQuoting(sentence: string): string[] {
  return POPULATION.filter((relative) => SOURCES.get(relative)!.includes(sentence));
}

describe("the slice-refund sentences have exactly one author", () => {
  /*
   * THE POSITIVE CONTROL, first, because the arm below is a search that finds
   * nothing and a search that CANNOT find anything reports the same result. If
   * the population or the reader is broken, this reddens and the real arm's
   * silence is never mistaken for a clean tree.
   */
  it("can see a sentence where one is genuinely written", () => {
    expect(POPULATION.length).toBeGreaterThan(500);
    for (const sentence of SLICE_REFUND_DESCRIPTIONS) {
      expect(filesQuoting(sentence)).toContain(AUTHOR);
    }
  }, SWEEP_TIMEOUT_MS);

  it("is quoted nowhere but its author", () => {
    const offenders: Record<string, string[]> = {};
    for (const sentence of SLICE_REFUND_DESCRIPTIONS) {
      const elsewhere = filesQuoting(sentence).filter(
        (relative) => relative !== AUTHOR && relative !== THIS_FILE,
      );
      if (elsewhere.length > 0) offenders[sentence] = elsewhere;
    }
    expect(offenders).toEqual({});
  }, SWEEP_TIMEOUT_MS);

  /*
   * A sentence in the record that nothing composes is a dead line in the
   * reader's `IN (…)` — harmless in itself, but it means the record and the
   * product have parted company, which is the same drift read from the other
   * end.
   *
   * ⚠ The first shape of this arm excused `candidateAbsent` and `renderFault`
   * with `|| key === …` because they are composed inside the fork rather than
   * at a writer. That is a test asserting its own literal — the very shape
   * #697 is unpicking elsewhere tonight — so the arm asks the real question
   * instead: every key is named by SOMETHING, and the fork that names two of
   * them has a caller outside its own module.
   */
  it("has a live composer for every sentence in the record", () => {
    const sources = new Map(
      [...SOURCES].filter(([relative]) => !relative.endsWith(".test.ts") && !relative.endsWith(".test.tsx")),
    );

    const unnamed = Object.keys(SLICE_REFUND_DESCRIPTION).filter(
      (key) => ![...sources.values()].some((source) => source.includes(`SLICE_REFUND_DESCRIPTION.${key}`)),
    );
    expect(unnamed).toEqual([]);

    const forkCallers = [...sources.entries()]
      .filter(([relative, source]) => relative !== AUTHOR && source.includes("rollSliceRefundDescription("))
      .map(([relative]) => relative);
    expect(forkCallers.length).toBeGreaterThan(0);
  }, SWEEP_TIMEOUT_MS);
});

describe("the roll's fork", () => {
  it("names the render fault as the event that DID arrive", () => {
    expect(rollSliceRefundDescription("render_fault")).toBe(
      SLICE_REFUND_DESCRIPTION.renderFault,
    );
  });

  it("names everything else as a candidate that did not arrive", () => {
    for (const failureClass of ["recovered", "transport", "timeout", "unknown", null, undefined]) {
      expect(rollSliceRefundDescription(failureClass)).toBe(
        SLICE_REFUND_DESCRIPTION.candidateAbsent,
      );
    }
  });
});

describe("the enumeration a reader matches on", () => {
  /*
   * ⚠ Counting a SUBSET of these is not a smaller reading, it is a wrong one —
   * it manufactures a disagreement out of a healthy window. The list is
   * `Object.values`, and this is the arm that says so out loud rather than
   * leaving it to a reader of the module.
   */
  it("carries every sentence in the record and nothing else", () => {
    expect([...SLICE_REFUND_DESCRIPTIONS].sort()).toEqual(
      Object.values(SLICE_REFUND_DESCRIPTION).slice().sort(),
    );
    expect(new Set(SLICE_REFUND_DESCRIPTIONS).size).toBe(SLICE_REFUND_DESCRIPTIONS.length);
  });
});
