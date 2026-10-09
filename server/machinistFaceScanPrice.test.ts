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
    const { low, high } = FACE_SCAN_FAL_CALLS.sam3.measured;
    expect(words).toContain(`${low}–${high} segmenter reads`);
    expect(words).toContain(`${FACE_SCAN_FAL_CALLS.cutouts} cutout`);
    expect(words).toContain(`${FACE_SCAN_FAL_CALLS.describer} describer call`);
  });

  it("prices the looks as a band, both ends derived from faceScanUsd()", () => {
    const { total } = faceScanUsd();
    const words = faceScanSpendWords(10);
    expect(words).toContain(`$${total.low.toFixed(3)}–$${total.high.toFixed(3)} each`);
    expect(words).toContain(`= $${(10 * total.low).toFixed(2)}–$${(10 * total.high).toFixed(2)}`);
    /* The band is real: a range collapsed to one number is the old shape back. */
    expect(total.high).toBeGreaterThan(total.low);
  });

  it("never carries the retired figure — the negative control", () => {
    const words = faceScanSpendWords(10);
    expect(words).not.toMatch(/\b20 reads\b/);
    expect(words).not.toContain("$0.10 each");
    /* Ten scans at the old price was exactly $1.00; the measured band is above it. */
    expect(words).not.toContain("= $1.00");
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
