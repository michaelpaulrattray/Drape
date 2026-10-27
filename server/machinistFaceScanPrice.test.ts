/**
 * THE MACHINIST'S FACE-SCAN LINE PRICES A SCAN FROM THE MEASURED BAND (#2187).
 *
 * `scripts/machinist-ledger-read.mts` section E printed *"20 reads / $0.10
 * each = $(looks × 0.1)"* — a typed figure that #2184 had already shown to be
 * about half of a real face (21–27 segmenter reads plus a cutout plus a
 * describer call, `FACE_SCAN_FAL_CALLS` / `faceScanUsd()` in
 * `scripts/lib/falSpend.mts`). That reader opens a production database at
 * import, so it cannot be run here; its words come from `faceScanSpendWords`,
 * which is driven directly, and the reader is held to calling it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FACE_SCAN_FAL_CALLS,
  faceScanSam3Reads,
  faceScanSpendWords,
  faceScanUsd,
} from "../scripts/lib/falSpend.mts";

const LEDGER = resolve(__dirname, "../scripts/machinist-ledger-read.mts");

const RITE = resolve(__dirname, "../scripts/deploy-rite.mts");

/** One lettered section of the ledger reader, sliced so a sibling cannot satisfy an arm. */
function ledgerSection(from: string, to: string): string {
  const source = readFileSync(LEDGER, "utf8");
  const start = source.indexOf(from);
  const end = source.indexOf(to);
  expect(start, `the ${from} marker is gone — re-anchor this slice`).toBeGreaterThan(-1);
  expect(end, `the ${to} marker is gone — re-anchor this slice`).toBeGreaterThan(start);
  expect(source.indexOf(from, start + 1), `the ${from} marker is not unique`).toBe(-1);
  return source.slice(start, end);
}

const sectionE = () => ledgerSection("// ── E. face scans", "// ── F. provider books");
const sectionF = () => ledgerSection("// ── F. provider books", "// ── G. the shift process");

describe("faceScanSpendWords — the scan's price, read off the measured constants", () => {
  it("prints the measured read range and every part of a scan", () => {
    const words = faceScanSpendWords(10);
    const { low, high } = faceScanSam3Reads().measured;
    expect(words).toContain(`${low}–${high} segmenter reads`);
    expect(words).toContain(`${FACE_SCAN_FAL_CALLS.cutouts} cutout`);
    expect(words).toContain(`${FACE_SCAN_FAL_CALLS.describer} describer call`);
  });

  it("prices the looks as a band, both ends derived from faceScanUsd()", () => {
    const { total } = faceScanUsd();
    const words = faceScanSpendWords(10);
    expect(words).toContain(`$${total.low.toFixed(3)}–$${total.high.toFixed(3)} each`);
    expect(words).toContain(`= $${(10 * total.low).toFixed(3)}–$${(10 * total.high).toFixed(3)}`);
    /* The band is real: a range collapsed to one number is the old shape back. */
    expect(total.high).toBeGreaterThan(total.low);
  });

  it("never carries the retired figure — the negative control", () => {
    const words = faceScanSpendWords(10);
    expect(words).not.toMatch(/\b20 reads\b/);
    expect(words).not.toContain("$0.10 each");
    /* Ten scans at the retired flat price was exactly $1.00, and what rules it
       out is that the words are a RANGE at all — never that the band happens to
       sit above it. ⚠ On the crop road it did sit above ($1.21–$1.57); on the
       pair-in-one-read road the live band straddles it ($0.76–$1.07), so a
       comment claiming the band is above $1.00 would have gone quietly wrong
       the hour the flag flipped while this arm kept passing (#2577). */
    expect(words).not.toContain("= $1.00");
  });

  it("prints each range at ONE precision, both ends alike", () => {
    /* `$0.763–$1.07` is what a per-value precision rule produces once a band
       straddles a dollar, and the cheaper scan road made that reachable at ten
       scans (#2577). Driven across magnitudes so the arm covers both the cents
       end and the whole-dollar end rather than today's one figure. */
    for (const looks of [1, 10, 100, 1000]) {
      const words = faceScanSpendWords(looks);
      const ranges = [...words.matchAll(/\$\d+\.(\d+)–\$\d+\.(\d+)/g)];
      expect(ranges, `${looks} looks: the per-scan band and the total`).toHaveLength(2);
      for (const range of ranges) {
        expect(range[2].length, `${range[0]} at one precision`).toBe(range[1].length);
      }
    }
  });

  it("keeps a scan's own price in cents, where it can be checked", () => {
    /* The reason the three-place end is the one kept: a scan is about a dime,
       and two places round the measured band to `$0.08–$0.11`, which cannot be
       compared against fal's own $0.005 a read. */
    expect(faceScanSpendWords(1)).toMatch(/\$0\.\d{3}–\$0\.\d{3} each/);
  });
});

describe("machinist-ledger-read section E — the reader is held to the derived words", () => {
  it("prints the paid looks through faceScanSpendWords", () => {
    expect(sectionE()).toContain("${faceScanSpendWords(paidLooks)}");
  });

  it("types no per-scan figure of its own", () => {
    const section = sectionE();
    expect(section).not.toMatch(/\b20 reads\b/);
    expect(section).not.toMatch(/\$0\.10\b/);
    expect(section).not.toMatch(/\*\s*0\.1\b/);
  });
});

/**
 * SECTION F AND THE DEPLOY RITE TAKE THE FALLBACK FROM ONE FUNCTION (#2699).
 *
 * ⚠ **THE LEDGER WENT BLIND AND THE RITE DID NOT, ON THE SAME DEAD KEY, IN THE
 * SAME HOUR.** Section F printed `openrouter activity UNREAD — HTTP 401` and
 * nothing else; the rite's receipt the same hour kept today, this week and this
 * month, losing only the per-day and per-model breakdown. The rite had a
 * fallback this reader never got — working law 4, two readers of one source
 * with different coverage — and fixing it by writing a THIRD copy would have
 * been the same mistake.
 *
 * `keySpendLine` itself is driven directly in `server/openrouterBalance.test.ts`.
 * These arms are the other half and are the ones invariant 7 asks for: **a
 * control that is not invoked does not exist**, and a reader that opens a
 * production database at import cannot be run here, so its CALL is held at the
 * source. The last arm is the anti-drift one: neither call site may compose
 * that sentence itself again.
 */
describe("machinist-ledger-read section F — the provider books keep their fallback", () => {
  it("falls back to the key's own windows when the account's books refuse", () => {
    expect(sectionF()).toContain("keySpendLine(await readOpenRouterUsage(), activity)");
  });

  it("still says the activity read was UNREAD, so the fallback cannot pass as the table", () => {
    expect(sectionF()).toContain("openrouter activity UNREAD");
  });

  it("the deploy rite takes the same line from the same function", () => {
    expect(readFileSync(RITE, "utf8")).toContain("keySpendLine(await readOpenRouterUsage(), books)");
  });

  /*
    ⚠ **THE ARM THAT MATTERS.** The defect was a second reader with different
    coverage, so the thing to forbid is a second COMPOSER. `openrouterBalance.mts`
    is the only file in the tree that may hold this sentence; a call site that
    grows its own copy is how the two drift apart again, and it would pass every
    arm above.
  */
  it("neither call site composes the spend sentence itself", () => {
    for (const path of [LEDGER, RITE]) {
      expect(readFileSync(path, "utf8"), `${path} composes its own openrouter spend line`)
        .not.toContain("openrouter spend");
    }
  });
});
