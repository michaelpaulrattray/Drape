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

/** Section E of the ledger reader, sliced out so a sibling section cannot satisfy an arm. */
function sectionE(): string {
  const source = readFileSync(LEDGER, "utf8");
  const start = source.indexOf("// ── E. face scans");
  const end = source.indexOf("// ── F. provider books");
  expect(start, "the section E marker is gone — re-anchor this slice").toBeGreaterThan(-1);
  expect(end, "the section F marker is gone — re-anchor this slice").toBeGreaterThan(start);
  expect(source.indexOf("// ── E. face scans", start + 1), "the section E marker is not unique").toBe(-1);
  return source.slice(start, end);
}

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
