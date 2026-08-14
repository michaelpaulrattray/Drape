/**
 * THE LAST SEGMENTER WORD TYPED OUTSIDE A TABLE (V1/F5).
 *
 * The review named it by line: `refineService.ts` asked the segmenter about
 * `"glasses"` with the word typed in at the call site, while the accessory
 * table already owned that region. A word SENT to a model is a contract with
 * something outside this repo, and a second copy of it drifts silently — the
 * gate would keep asking about a region the table had renamed, get nothing
 * back, and stop protecting the customers it was written for.
 */
import { describe, expect, it } from "vitest";

import fs from "node:fs";
import path from "node:path";

import { EYEWEAR_REGION, LANDMARK_OF_ACCESSORY, accessoryKindOf } from "./accessoryKinds";

describe("the eyewear region", () => {
  it("is the table's own answer, not a second copy of it", () => {
    const table = LANDMARK_OF_ACCESSORY.find((entry) => entry.landmark === "eye");
    expect(table).toBeDefined();
    expect(EYEWEAR_REGION).toBe(table!.region);
    /* And the same answer the ordinary word road gives, so the gate and the
       recipe cannot be asking about two different things. */
    expect(EYEWEAR_REGION).toBe(accessoryKindOf("her glasses"));
  });

  it("is not typed into the service any more", () => {
    /*
      Read from the source, because the point is the ABSENCE of a literal and
      no runtime assertion can see one. Scoped to the segmenter call so an
      ordinary mention of the word in prose is not a breach.
    */
    const source = fs.readFileSync(
      path.join(path.resolve(import.meta.dirname), "refineService.ts"), "utf8");
    expect(source).not.toMatch(/\.region\(\{[^}]*name:\s*"glasses"/);
    expect(source).toMatch(/\.region\(\{[^}]*name:\s*EYEWEAR_REGION/);
  });

  it("CAN FAIL — the reader, driven on the shape it hunts", () => {
    /* Without this the assertion above could be passing because the regex
       matches nothing at all, which is what a moved call site looks like. */
    const typed = `.region({ image: bytes, name: "glasses", absentIsAnswer: true })`;
    expect(typed).toMatch(/\.region\(\{[^}]*name:\s*"glasses"/);
  });
});
