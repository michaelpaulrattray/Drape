import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { withoutComments } from "../../../../server/testing/withoutComments";

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
  PACKAGE_REDO_MENU_LABEL,
  PACKAGE_REDO_WORKING,
  characterSheetCount,
  characterSheetMenuItems,
  packageRedoPrice,
} from "./packageRedoRow";
import { CASTING_V2_PACKAGE_REDO_PRICE_CREDITS } from "../../../../server/casting/castingCreditCosts";

const ROOM = fs.readFileSync(
  path.join(process.cwd(), "client/src/pages/CastingRoom.tsx"),
  "utf8",
);

describe("what the redo says about money when a view does not arrive", () => {
  /*
    ⚠ **UNDER THE FLAT PRICE NOTHING COMES BACK FOR ONE VIEW, so no sentence
    may imply it did** (#1968, his word of 2026-10-08; #1903's card names this
    as its own sweep item — *"nothing may imply credits came back for that
    view"*).

    The partial-failure toast ended *"You weren't charged for them."* on every
    such failure, which under the flat price is the ORDINARY one: her slot rows
    cost nothing, so `refundedCredits` is 0 and the branch fires. True of the
    pipeline, false to the person who paid 650 for the set.

    It is read at the ROOM because that is where the sentence is composed — a
    constant in `packageRedoRow.ts` could be held to anything and still not be
    the thing on screen.
  */
  /*
    ⚠ **SLICED TO THE STATEMENTS, NOT THE FILE — and the first draft of these
    arms failed on their own evidence.** A whole-file `not.toContain` of the
    banned sentence reddened because the REPAIR's own comment quotes it, which
    is how this repository records a superseded line. A guard that cannot
    survive its subject being explained is a guard that will be deleted.

    So the subject is cut out: `const back =` through the end of the `toast(`
    call. That region is code only, and it is where both defects lived.
  */
  /*
    ⚠ **A FUNCTION, NOT A MODULE-LEVEL CONSTANT — found by sabotaging it.**
    The slice's own `expect`s ran while the file was being collected, so a
    sabotage that moved the anchor took the WHOLE suite down with a collection
    error: vitest then prints `Tests no tests` beside `Test Files 1 failed`,
    which a reader scanning the `Tests` line reads as a pass. Called inside
    each arm, a missing anchor fails that arm by name and leaves its siblings
    able to speak.
  */
  const redoToast = (): string => {
    const start = ROOM.indexOf("const back = result.refundedCredits");
    expect(start, "the redo's money line is gone from the room").toBeGreaterThan(-1);
    const end = ROOM.indexOf("The rest are new.", start);
    expect(end, "the redo's partial-failure toast is gone from the room").toBeGreaterThan(start);
    return ROOM.slice(start, end);
  };

  it("never tells her she wasn't charged for a view of a set she paid for", () => {
    expect(redoToast()).not.toContain("You weren't charged");
    /* And not the retired spelling of the refund line either: #1940 replaced
       four of them with one helper, and this branch had brought one back
       (*"Your N credits … are back."*). */
    expect(redoToast()).not.toContain("are back");
    expect(redoToast()).not.toMatch(/credits for/);
  });

  it("says the money line only when money moved, in the ONE shared vocabulary", () => {
    /*
      Two halves, and the second is what stops this passing by deleting the
      sentence: the money clause must still EXIST, and it must be the shared
      helper rather than a fifth hand-built spelling.
    */
    expect(redoToast()).toContain("result.refundedCredits > 0");
    expect(redoToast()).toContain("creditsReturnedText(result.refundedCredits)");
    /* The empty alternative is the repair: no claim at all when nothing came
       back. A literal sentence here would be the defect returning. */
    expect(redoToast()).toMatch(/\?\s*` \$\{creditsReturnedText\(result\.refundedCredits\)\}`\s*:\s*""/);
  });

  it("does its own credit arithmetic nowhere — the helper converts", () => {
    /* `displayRefund`/`formatCredits` by hand on this page is how a ledger
       figure reaches a customer five times too large (#1600). The conversion
       is `creditsReturnedText`'s job, and the page no longer imports either —
       read on the IMPORT rather than the call, so a new call site anywhere on
       the page reddens and not merely one inside the slice above. */
    expect(ROOM).not.toContain('from "@shared/creditDisplay"');
  });
});

describe("the redo button", () => {
  it("says his word for it, and only that", () => {
    /* REGENERATE — his word, #2090 (2026-10-08): *"way too long just call it
       Regenerate"*. It was "Ask for all views again" until then, and this arm
       said "not regenerate" on the reasoning that it was product shorthand;
       his ruling supersedes that, and the refine panel's version button
       already says Regenerate to the same customer. Still not "package", not
       "redo" (the copy arm below). */
    expect(PACKAGE_REDO_LINK).toBe("Regenerate");
    /* The old sentence must not survive in the row's copy under any casing. */
    expect(PACKAGE_REDO_LINK.toLowerCase()).not.toContain("ask for all views again");
  });

  it("carries the price, spelled `credits` and never `CR`", () => {
    /* 3,250 LEDGER is his 650 display (his word, 2026-10-08: "on this card
       make both sign and redo/regenerate 650 credis"). Handed the ledger
       number because that is what the wire carries, and the conversion is
       this module's job. Since #2144 the price is the menu item's own grey
       line on the right, so it is the figure alone. */
    expect(packageRedoPrice(3250)).toBe("650 credits");
    /* And held against the SERVER's declared price, so a reprice that forgot
       the client reddens here rather than on a receipt. */
    expect(packageRedoPrice(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS)).toBe("650 credits");
    /* #1908's rule: an abbreviation is the product's shorthand. */
    expect(/\bCR\b/.test(packageRedoPrice(3250))).toBe(false);
    /* A price rounds UP (displayPrice), never down: one ledger credit over a
       display step is quoted as the next display credit. */
    expect(packageRedoPrice(3251)).toBe("651 credits");
  });

  it("names the menu item in his Option A words (card 2144)", () => {
    /* His word, 2026-10-09 (card 2150): "in the menu just call it Regenerate
       and Delete not those full sentences". */
    expect(PACKAGE_REDO_MENU_LABEL).toBe("Regenerate");
    expect(PACKAGE_REDO_MENU_LABEL).toBe(PACKAGE_REDO_LINK);
    expect(PACKAGE_REDO_MENU_LABEL.toLowerCase()).not.toContain("character sheet");
  });

  it("names no engine, no model and no pipeline word, anywhere in its copy", () => {
    /*
      The disappearing-technology law's second clause: no engine name on a path
      someone must walk to reach their picture. The strings are checked TOGETHER
      because the working line is on that path too — a loader is named in the
      law by example.
    */
    const copy = [PACKAGE_REDO_LINK, PACKAGE_REDO_MENU_LABEL, packageRedoPrice(1750), PACKAGE_REDO_WORKING]
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

describe("the character sheet row's menu (card 2144, his Option A)", () => {
  const noop = () => undefined;
  const offered = { priceCredits: CASTING_V2_PACKAGE_REDO_PRICE_CREDITS };

  it("offers Regenerate with its price, then Delete in red, in that order", () => {
    const items = characterSheetMenuItems({
      redo: offered, askingAll: false, deleteOffered: true, onRegenerate: noop, onDelete: noop,
    });
    expect(items.map((item) => [item.label, item.meta ?? null, item.danger ?? false])).toEqual([
      ["Regenerate", "650 credits", false],
      ["Delete", null, true],
    ]);
  });

  it("wires each item to the press it had as a link — never crossed", () => {
    const calls: string[] = [];
    const items = characterSheetMenuItems({
      redo: offered,
      askingAll: false,
      deleteOffered: true,
      onRegenerate: () => calls.push("regenerate"),
      onDelete: () => calls.push("delete"),
    });
    items[0].onSelect();
    items[1].onSelect();
    expect(calls).toEqual(["regenerate", "delete"]);
  });

  it("leaves out what cannot happen, rather than disabling it", () => {
    /* No redo offered by the server: no Regenerate. */
    expect(characterSheetMenuItems({
      redo: null, askingAll: false, deleteOffered: true, onRegenerate: noop, onDelete: noop,
    }).map((item) => item.label)).toEqual(["Delete"]);
    /* A redo already being asked for: no second Regenerate. */
    expect(characterSheetMenuItems({
      redo: offered, askingAll: true, deleteOffered: true, onRegenerate: noop, onDelete: noop,
    }).map((item) => item.label)).toEqual(["Delete"]);
    /* Delete door shut or still building: no Delete. */
    expect(characterSheetMenuItems({
      redo: offered, askingAll: false, deleteOffered: false, onRegenerate: noop, onDelete: noop,
    }).map((item) => item.label)).toEqual(["Regenerate"]);
    /* Nothing possible: an empty list, which CardMenu draws as no dots at all. */
    expect(characterSheetMenuItems({
      redo: undefined, askingAll: false, deleteOffered: false, onRegenerate: noop, onDelete: noop,
    })).toEqual([]);
  });
});

describe("the count beside the title — only while views are being made (card 2144)", () => {
  const NOBODY = new Set<string>();
  const slot = (angle: string, state: string, extra: { retrying?: true } = {}) => ({
    angle, state, url: state === "ready" ? `https://cdn/${angle}.png` : null, ...extra,
  });
  const five = (states: string[]) => states.map((state, i) => slot(`a${i}`, state));

  it("says nothing once every view is done (his 'on yunas call - yes')", () => {
    expect(characterSheetCount("ready", five(["ready", "ready", "ready", "ready", "ready"]), NOBODY))
      .toBeNull();
  });

  it("counts the ready views over all five while the sheet is being made", () => {
    expect(characterSheetCount("building", five(["ready", "ready", "ready", "building", "building"]), NOBODY))
      .toBe("3 of 5");
    /* A slot building on a ready cast (a view being made again) shows it too. */
    expect(characterSheetCount("ready", five(["ready", "ready", "ready", "ready", "building"]), NOBODY))
      .toBe("4 of 5");
  });

  it("does not call a view done while it is being re-made, so a Regenerate starts at 0 of 5", () => {
    const retrying = ["a0", "a1", "a2", "a3", "a4"].map((angle) => slot(angle, "ready", { retrying: true }));
    expect(characterSheetCount("ready", retrying, NOBODY)).toBe("0 of 5");
    /* Our own press, before the server's answer lands, reads the same. */
    expect(characterSheetCount("ready", five(["ready", "ready", "ready", "ready", "ready"]),
      new Set(["a0", "a1", "a2", "a3", "a4"]))).toBe("0 of 5");
  });

  it("does not hold the count up forever for a view that failed and was refunded", () => {
    expect(characterSheetCount("ready", five(["ready", "ready", "ready", "ready", "failed-refunded"]), NOBODY))
      .toBeNull();
  });
});

describe("the room draws it through this module", () => {
  it("renders the menu, the count and the working line from here", () => {
    /*
      THE ARM THAT MAKES THE ONES ABOVE WORTH ANYTHING. A component with its
      own literal would pass every assertion in this file and put a different
      sentence on screen.
    */
    expect(ROOM).toContain("characterSheetMenuItems({");
    expect(ROOM).toContain("characterSheetCount(data.status, data.slots, asking)");
    expect(ROOM).toContain("{PACKAGE_REDO_WORKING}");
    /* And it must not have grown a second copy of his words. */
    expect(ROOM).not.toContain("Regenerate character sheet");
  });

  it("hands over the LEDGER price and does no arithmetic of its own", () => {
    /*
      `shared/creditDisplay.ts` is the only thing in this product allowed to
      turn a ledger number into a display one (#1600), and the conversion lives
      in `packageRedoPrice` — so what the ROOM must not do is touch the number.
    */
    const from = ROOM.indexOf("characterSheetMenuItems({");
    const call = ROOM.slice(from, ROOM.indexOf("})}", from));
    expect(call).toMatch(/redo: data\.redo,/);
    /* Comments stripped: the room's own docblock names the field it is
       explaining, and a guard broken by prose is a guard that gets deleted. */
    expect(withoutComments(ROOM)).not.toContain("priceCredits");
  });

  it("converts through the one converter, where a census reader can see it", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "client/src/features/castingV2/packageRedoRow.ts"),
      "utf8",
    );
    /* SLICED TO THE FUNCTION'S RETURN, never the file: the docblock names the
       wrong converters on purpose, and a whole-file read is broken by prose. */
    const body = source.match(/export function packageRedoPrice[\s\S]*?\n}/)?.[0] ?? "";
    const returned = body.split("\n").filter((line) => line.includes("return `")).join("\n");
    expect(returned).toContain("formatCredits(displayPrice(priceCredits))");
    expect(returned).not.toContain("displayBalance");
    expect(returned).not.toContain("displayRefund");
  });
});
