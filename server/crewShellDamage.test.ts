/**
 * THE PRICE-EATEN-BY-A-SHELL READER, DRIVEN (#1825).
 *
 * The reading this detector will give every night from now on is ZERO — the one
 * damaged record this repository had was repaired the morning the card was
 * filed, and the measurement over all 42 open cards found nothing else. **So a
 * clean run proves nothing on its own**, which is working law 2 exactly: a
 * checker that cannot fail is not a checker. These arms are the only thing that
 * tells a clean reading apart from a blind one.
 *
 * The POSITIVE control is not a fixture invented to pass. It is the real byte
 * sequence that reached his board, quoted from #1690's own damaged title:
 *
 *   `(~ today, five NBP 2K views ~/usr/bin/bash.75 of it)`
 *
 * The NEGATIVE controls are the prose this board actually writes — a card whose
 * subject IS this fault and names the shell path in its title, a shell
 * transcript in a fenced block, a quoted path in backticks, a real Windows
 * path, and the strikethrough markers the filing sweep's ten false candidates
 * turned out to be.
 */
import { describe, expect, it } from "vitest";

import { type ShellDamageCard, planShellDamage } from "../shared/crewShellDamage.js";

function card(partial: Partial<ShellDamageCard> & { issueNumber: number }): ShellDamageCard {
  return { title: "", body: "", ...partial };
}

/** #1690's real damaged title, byte for byte. */
const DAMAGED_1690 =
  "N3 research: what a Sign costs us and whether it can come down"
  + " (~ today, five NBP 2K views ~/usr/bin/bash.75 of it)";

describe("planShellDamage — the positive controls", () => {
  it("finds the real damage that reached his board (#1690's own title)", () => {
    const found = planShellDamage([card({ issueNumber: 1690, title: DAMAGED_1690 })]);
    expect(found).toHaveLength(1);
    expect(found[0]?.field).toBe("title");
    expect(found[0]?.matched).toBe("/usr/bin/bash.75");
    /* The excerpt must carry enough prose for a reader to judge without
       opening the card — the whole reason it is reported rather than repaired. */
    expect(found[0]?.excerpt).toContain("five NBP 2K views");
  });

  it("finds it in a BODY as well as a title, because both are filed through a shell", () => {
    const found = planShellDamage([
      card({ issueNumber: 1, body: `The five views are about ~/usr/bin/bash.75 of that.` }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]?.field).toBe("body");
  });

  it("finds a home path welded to an amount — `$HOME` eaten the same way", () => {
    const found = planShellDamage([
      card({ issueNumber: 2, title: "a top-up pack is /c/Users/Admin.00 a unit" }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]?.matched).toBe("/c/Users/Admin.00");
  });

  it("finds every mark on one card rather than stopping at the first", () => {
    const found = planShellDamage([
      card({
        issueNumber: 3,
        title: "roll /usr/bin/bash.12 and sign /usr/bin/bash.45",
        body: "and the plate /bin/sh.07 too",
      }),
    ]);
    expect(found.map((f) => f.matched)).toEqual([
      "/usr/bin/bash.12",
      "/usr/bin/bash.45",
      "/bin/sh.07",
    ]);
    /* Title before body on one card, so a reader repairs the loud half first. */
    expect(found.map((f) => f.field)).toEqual(["title", "title", "body"]);
  });

  it("reports oldest card first, so two runs of the sweep read the same way", () => {
    const found = planShellDamage([
      card({ issueNumber: 900, title: "x /bin/bash.50" }),
      card({ issueNumber: 100, title: "y /bin/bash.50" }),
    ]);
    expect(found.map((f) => f.issueNumber)).toEqual([100, 900]);
  });
});

describe("planShellDamage — the negative controls, which are this board's real prose", () => {
  it("does NOT fire on the card that REPORTS this fault (#1825's own title)", () => {
    /*
      ⚠ THE ARM THAT CHOSE THE RULE. The loose reading — any shell path in prose
      — fires here, and this row would then print at every shift close for ever.
      A block with a permanent known-good row in it is a block the next shift
      learns to skip, so the welded rule exists to keep this quiet.
    */
    const found = planShellDamage([
      card({
        issueNumber: 1825,
        title:
          "A card filed through a shell string silently loses dollar amounts:"
          + " your roadmap card read /usr/bin/bash where a price belonged",
      }),
    ]);
    expect(found).toEqual([]);
  });

  it("does NOT fire on a shell transcript in a fenced block", () => {
    const found = planShellDamage([
      card({
        issueNumber: 4,
        body: [
          "Read it with:",
          "```",
          "/usr/bin/bash.75 --version",
          "```",
          "and that is all.",
        ].join("\n"),
      }),
    ]);
    expect(found).toEqual([]);
  });

  it("does NOT fire on a path in backticks — the correctly quoted file path", () => {
    const found = planShellDamage([
      card({ issueNumber: 5, body: "the tree is at `/c/Users/Admin/Drape.1` on this machine" }),
    ]);
    expect(found).toEqual([]);
  });

  it("does NOT fire on damage QUOTED in a blockquote — reporting must not trip it", () => {
    /* The precedent is the team's own quiet-entry detector (#360), which strips
       fences and blockquotes so an entry may quote the marker freely. */
    const found = planShellDamage([
      card({
        issueNumber: 6,
        body: "His card said:\n\n> five NBP 2K views **~/usr/bin/bash.75** of it\n\nwhich is the fault.",
      }),
    ]);
    expect(found).toEqual([]);
  });

  it("does NOT fire on an ordinary path, a strikethrough, or a price that survived", () => {
    const found = planShellDamage([
      card({
        issueNumber: 7,
        title: "the court ran in /usr/bin/bash and cost $0.75",
        body: [
          "~~retired~~ — the old road is gone.",
          "The tree is /c/Users/Admin/Drape and the roll cost $1.20.",
          "A Sign is about $0.95 today, five views about $0.75 of it.",
        ].join("\n"),
      }),
    ]);
    expect(found).toEqual([]);
  });

  it("does not weld two innocent halves together when code is stripped out", () => {
    /*
      Stripping replaces with a SPACE rather than deleting. Deleting would join
      `/usr/bin/bash` to a neighbouring `.75` across the removed span and
      manufacture a finding out of two legitimate pieces.
    */
    const found = planShellDamage([
      card({ issueNumber: 8, body: "the shell is /usr/bin/bash`x`.75 of nothing" }),
    ]);
    expect(found).toEqual([]);
  });

  it("gives an empty answer for an empty population, which the caller must not read as clean", () => {
    expect(planShellDamage([])).toEqual([]);
  });
});

describe("planShellDamage — every card in the population is read", () => {
  it("reads a third card as thoroughly as the first", () => {
    /*
      ⚠ THE ARM THIS FILE WAS WRONG ABOUT ONCE, KEPT WITH THE CORRECTION. The
      first draft scanned with a module-level `/g` regex plus a
      `lastIndex = 0` reset, and this arm claimed to cover that reset —
      **deleting the reset left all thirteen arms green**, because `exec` zeroes
      `lastIndex` itself on the null that ends the loop, so the line could never
      matter. The reader builds a fresh matcher per field now, so the hazard is
      gone rather than guarded.

      ⚠ **AND THIS ARM WOULD NOT HAVE CAUGHT IT EITHER — DRIVEN, NOT SUPPOSED.**
      The reader was sabotaged to a single shared stateful `exec`; the suite
      went red at *"finds every mark on one card"* and *"finds a home path
      welded to an amount"*, and **this arm stayed green**, because every card
      in its fixture has an empty body and the empty scan after each title
      resets `lastIndex` for free. So those two are the arms that cover a
      stateful regression, and this one is a plain population arm: three cards
      in, three read, oldest first. The sentence is what it is worth, not what
      it would be nice for it to be worth.
    */
    const found = planShellDamage([
      card({ issueNumber: 10, title: "a /bin/bash.11" }),
      card({ issueNumber: 11, title: "b /bin/bash.22" }),
      card({ issueNumber: 12, title: "c /bin/bash.33" }),
    ]);
    expect(found.map((f) => f.issueNumber)).toEqual([10, 11, 12]);
    expect(found.map((f) => f.matched)).toEqual(["/bin/bash.11", "/bin/bash.22", "/bin/bash.33"]);
  });
});
