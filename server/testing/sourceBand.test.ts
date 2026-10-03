import { describe, expect, it } from "vitest";

import { sourceBand, sourceTail } from "./sourceBand";

/**
 * THE INSTRUMENT'S OWN CONTROLS (#1845, working law 2).
 *
 * Every arm written over a band is only as good as the band, and the failure
 * that matters is the SILENT one: a reader that answered an empty string when
 * its anchor moved would turn every `not.toContain` over it green. So the
 * refusals are driven, not just the happy path.
 */
describe("sourceBand (#1845)", () => {
  const source = [
    "function First() {",
    '  return <p>alpha</p>;',
    "}",
    "",
    "function Second() {",
    '  return <p>beta</p>;',
    "}",
  ].join("\n");

  it("slices one block out of a module, anchor included and closer excluded", () => {
    const first = sourceBand(source, "function First", "function Second");
    expect(first).toContain("alpha");
    expect(first, "the band ran on into its sibling").not.toContain("beta");
    expect(first.startsWith("function First")).toBe(true);
  });

  it("the tail reads the last block, which has no closing anchor to name", () => {
    const second = sourceTail(source, "function Second");
    expect(second).toContain("beta");
    expect(second, "the tail reached backwards").not.toContain("alpha");
  });

  it("NEGATIVE CONTROL — a missing opening anchor REFUSES, and never answers empty", () => {
    /*
      The whole safety property. An empty answer here passes every negative arm
      a caller writes, so the reader must be unable to give one.
    */
    expect(() => sourceBand(source, "function Third", "function Second")).toThrow(
      /opening anchor is gone/,
    );
    expect(() => sourceTail(source, "function Third")).toThrow(/opening anchor is gone/);
  });

  it("NEGATIVE CONTROL — a missing CLOSING anchor refuses rather than running to EOF", () => {
    /*
      Running to the end of the file is the plausible-looking tolerance and it
      is the dangerous one: a positive arm would then pass on a sibling's bytes,
      which is the defect this reader exists to close.
    */
    expect(() => sourceBand(source, "function First", "function Fourth")).toThrow(
      /closing anchor is gone/,
    );
  });

  it("the refusal names the band, so a reader knows WHICH anchor moved", () => {
    expect(() => sourceBand(source, "function Third", "}", "the free pane")).toThrow(
      /^the free pane: /,
    );
  });

  it("a closing anchor BEFORE the opening one is not found, so it refuses", () => {
    /* `indexOf` searches forward from the opening anchor, which is what makes
       a band directional — asserted rather than assumed, because a backwards
       match would silently slice the wrong block. */
    expect(() => sourceBand(source, "function Second", "alpha")).toThrow(
      /closing anchor is gone/,
    );
  });
});
