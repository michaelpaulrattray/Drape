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
    /* 1,750 LEDGER is his 350 display. Handed the ledger number because that
       is what the wire carries, and the conversion is this module’s job. */
    const label = packageRedoLabel(1750);
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
    const copy = [PACKAGE_REDO_LINK, packageRedoLabel(1750), PACKAGE_REDO_WORKING]
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

  it("hands over the LEDGER price and does no arithmetic of its own", () => {
    /*
      `shared/creditDisplay.ts` is the only thing in this product allowed to
      turn a ledger number into a display one (#1600), and the conversion lives
      in `packageRedoLabel` — so what the ROOM must not do is touch the number
      at all. A component interpolating `priceCredits` raw would print 1,750
      where his price is 350: five times the figure, on the one surface that is
      a promise about money.
    */
    const call = ROOM.match(/packageRedoLabel\([^\n]*\)/)?.[0] ?? "";
    expect(call).toBe("packageRedoLabel(data.redo.priceCredits)");
    /* And it is handed over exactly ONCE. Counted on the CALL rather than on
       the field name, which also appears in the hook's own docblock — a count
       over prose is a guard that reddens when somebody explains the code. */
    expect(ROOM.match(/packageRedoLabel\(/g)).toHaveLength(1);
  });

  it("converts through the one converter, where a census reader can see it", () => {
    /*
      ⚠ THE SHAPE THIS ARM EXISTS FOR, because the first draft failed it. A
      `packageRedoLabel(formattedDisplayCredits: string)` signature left the
      conversion in the component and this module holding a number it could not
      vouch for — and `server/creditDisplayGuard.test.ts` flagged it on its
      first run as a credit figure beside the word *credits* that nothing
      visibly routed. Both shapes obey #1600; only one is legible to the reader
      whose job is to check that it is obeyed.
    */
    const source = fs.readFileSync(
      path.join(process.cwd(), "client/src/features/castingV2/packageRedoRow.ts"),
      "utf8",
    );
    /*
      ⚠ SLICED TO THE RETURN, NOT READ OVER THE WHOLE FILE — which is the arm's
      own second lesson and it cost a red: the negative half below was written
      against `source` and the docblock three lines up says *"`displayPrice` and
      not `displayBalance`"*, so the guard failed on its own explanation. A
      whole-file read is satisfied, or broken, by prose.
    */
    const body = source.match(/export function packageRedoLabel[\s\S]*?\n}/)?.[0] ?? "";
    const returned = body.split("\n").filter((line) => line.includes("return `")).join("\n");
    expect(returned).toContain("formatCredits(displayPrice(priceCredits))");
    /* `displayPrice` rounds UP, so a customer is never quoted less than the
       till will take; `displayBalance` and `displayRefund` round DOWN and are
       the wrong readers for a price. */
    expect(returned).not.toContain("displayBalance");
    expect(returned).not.toContain("displayRefund");
  });
});
