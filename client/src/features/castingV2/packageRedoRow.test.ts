import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * THE REDO BUTTON'S COPY AND ITS PRICE (#1903 slice 2).
 *
 * His standing rule is **prices on paid buttons**, and the disappearing-
 * technology law says no engine name sits on a path somebody must walk to reach
 * their picture. Both are mechanizable, so both are arms here rather than
 * review memory.
 *
 * ⚠ **THE LAST TWO ARMS READ THE COMPONENT, which is the only way they can
 * answer what they ask.** `packageRedoRow.ts` can be held to any sentence at
 * all and still not be the thing on screen — the defect that matters is a
 * component that quotes a number of its own, or interpolates a ledger figure
 * straight onto a button, and neither is visible from this module.
 */
import {
  PACKAGE_REDO_LINK,
  PACKAGE_REDO_SEPARATOR,
  PACKAGE_REDO_WORKING,
  packageRedoLabel,
} from "./packageRedoRow";

const ROOM = fs.readFileSync(
  path.join(process.cwd(), "client/src/pages/CastingRoom.tsx"),
  "utf8",
);

describe("the redo button", () => {
  it("says what it does in the customer's own noun", () => {
    /* VIEWS — the word the strip beside it already uses. Not "package", not
       "redo", not "regenerate": the product's shorthand is not the customer's
       word (his #1908 rule, one noun over). */
    expect(PACKAGE_REDO_LINK).toBe("Ask for all views again");
    expect(PACKAGE_REDO_LINK.toLowerCase()).toContain("views");
  });

  it("carries the price, spelled `credits` and never `CR`", () => {
    const label = packageRedoLabel("350");
    expect(label).toBe(`Ask for all views again ${PACKAGE_REDO_SEPARATOR} 350 credits`);
    expect(label).toContain("credits");
    /* #1908's rule: an abbreviation is the product's shorthand. Asserted on a
       word boundary so "credits" does not satisfy a search for "CR". */
    expect(/\bCR\b/.test(label)).toBe(false);
  });

  it("names no engine, no model and no pipeline word, anywhere in its copy", () => {
    /*
      The disappearing-technology law's second clause: no engine name on a path
      someone must walk to reach their picture. The strings are checked TOGETHER
      because the working line is on that path too — a loader is named in the
      law by example.
    */
    const copy = [PACKAGE_REDO_LINK, packageRedoLabel("350"), PACKAGE_REDO_WORKING]
      .join(" ")
      .toLowerCase();
    for (const machine of [
      "sunburst", "nano", "banana", "gpt", "fal", "openrouter", "gemini",
      "plate", "conformance", "judge", "axis", "operation", "slot", "package",
    ]) {
      expect(copy, `the copy names "${machine}"`).not.toContain(machine);
    }
  });

  it("says what is happening to HER PICTURES while it runs, not what is doing it", () => {
    expect(PACKAGE_REDO_WORKING).toBe("Making a new set of views…");
  });
});

describe("the room draws it through this module", () => {
  it("renders the label from here rather than a sentence of its own", () => {
    /*
      ⚠ THE ARM THAT MAKES THE ONES ABOVE WORTH ANYTHING. A component with its
      own literal would pass every assertion in this file and put a different
      sentence on screen — which is `viewRetryRow.ts`'s own stated reason for
      existing, and `retryFace.ts`'s before it.
    */
    expect(ROOM).toContain("packageRedoLabel(");
    expect(ROOM).toContain("{PACKAGE_REDO_WORKING}");
    /* And it must not have grown a second copy of his sentence. */
    expect(ROOM).not.toContain(`"${PACKAGE_REDO_LINK}"`);
  });

  it("puts the LEDGER price through the one converter, and does no arithmetic", () => {
    /*
      `shared/creditDisplay.ts` is the only thing in this product allowed to
      turn a ledger number into a display one (#1600). A button interpolating
      `priceCredits` raw would print 1,750 where his price is 350 — five times
      the number, on the one surface that is a promise about money.
    */
    const call = ROOM.match(/packageRedoLabel\([^\n]*\)/)?.[0] ?? "";
    expect(call).toContain("formatCredits(");
    expect(call).toContain("displayPrice(");
    expect(call).toContain("data.redo.priceCredits");
    /* No division, no multiplication, no literal five anywhere in the call. */
    expect(call).not.toMatch(/[/*]|\b5\b/);
  });
});
