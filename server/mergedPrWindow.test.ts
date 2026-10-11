/**
 * THE MERGED-PULL-REQUEST READ, DRIVEN (#2291).
 *
 * The finding this read feeds — *a card was shipped by a merged pull request
 * and never closed* — answers ZERO on a healthy board. **So a clean run proves
 * nothing on its own** (working law 2), and the read that was there answered
 * zero for a second reason nobody could see: `--limit 200` against **1089**
 * merged pull requests, with no truncation check at all.
 *
 * Every number in these arms is a measurement taken at the live repository on
 * 2026-10-11, not a fixture invented to pass:
 *
 *  - **1089** merged pull requests, read twice on two different roads that
 *    agreed — the search API's `total_count` and a `--state merged` listing;
 *  - **200**, the bound that was there, which is the REGRESSION control: the
 *    old shape's own numbers must come back as a floor;
 *  - **#14, filed 2026-08-25**, the oldest open card, and **1089 of 1089**
 *    merges postdate it — which is why the derived-date-window repair the card
 *    offered is dead rather than merely unchosen;
 *  - **757 merges in 30 days**, which is why no constant bound was taken.
 *
 * ⚠ **THE LAST GROUP OF ARMS IS THE ONE WITH TEETH.** Two pure functions with
 * green arms prove nothing if the script still carries its own copy of the read
 * (working law 4), so the sweep's own bytes are held: it reads through this
 * module, and the hand-built `--state merged` form is asserted ABSENT. That
 * absence arm carries its own anchor arm, because an absence check over the
 * wrong file or the wrong slice is green for the wrong reason.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MERGED_PR_READ_HEADROOM,
  mergedPrListArgs,
  mergedPrPageBound,
  mergedPrPopulationArgs,
  mergedPrPopulationFrom,
  mergedPrReadVerdict,
} from "../scripts/lib/mergedPrWindow.mts";

/** The live population, read on two roads that agreed. */
const POPULATION = 1089;
/** The bound that was there, with no check on it. */
const OLD_BOUND = 200;

const SWEEP = join(import.meta.dirname, "..", "scripts", "crew-desk-sweep.mts");

describe("#2291 · the count is read before the page is sized", () => {
  it("asks the only road that reports a total, for a total and no rows", () => {
    const args = mergedPrPopulationArgs();
    expect(args[0]).toBe("api");
    const path = args[1];
    /* The search API is the only road with a `total_count`. */
    expect(path).toContain("search/issues");
    expect(path).toContain("is:pr");
    expect(path).toContain("is:merged");
    /* ⚠ The placeholders are the whole reason this module names no repository.
       Drop them and the read either fails or answers about another repository,
       and `gh` substitutes them inside the QUERY STRING as well as the path —
       driven at the live repository before it was relied on. */
    expect(path).toContain("repo:{owner}/{repo}");
    /* Only the count is read, so a single row is all that is paid for. */
    expect(path).toContain("per_page=1");
  });

  it("reads total_count off the real response shape", () => {
    expect(mergedPrPopulationFrom({ total_count: POPULATION, items: [{ number: 2288 }] }))
      .toBe(POPULATION);
  });

  it("⚠ ZERO IS A REAL ANSWER AND IS NOT CONFUSED WITH AN UNREADABLE ONE", () => {
    /* A repository with no merges genuinely counts zero. Reading an unreadable
       shape AS zero would make every bound look sufficient for ever. */
    expect(mergedPrPopulationFrom({ total_count: 0 })).toBe(0);
  });

  it("refuses every shape that is not a count", () => {
    for (const response of [
      null,
      undefined,
      {},
      { total_count: "1089" },
      { total_count: -1 },
      { total_count: 1.5 },
      { total_count: Number.NaN },
      { items: [] },
      "1089",
    ]) {
      expect(mergedPrPopulationFrom(response)).toBeNull();
    }
  });
});

describe("#2291 · the page is sized from that count, on the road the ceiling does not bind", () => {
  it("bounds the page above the population by the headroom", () => {
    expect(mergedPrPageBound(POPULATION)).toBe(POPULATION + MERGED_PR_READ_HEADROOM);
  });

  it("⚠ THE HEADROOM IS NOT ZERO, so an inter-call merge cannot push a row off", () => {
    /* With the bound set to exactly the population, a merge landing between the
       two calls drops the NEWEST row — the likeliest of all of them to be the
       one that just shipped a card nobody closed. */
    expect(MERGED_PR_READ_HEADROOM).toBeGreaterThan(0);
    expect(mergedPrPageBound(POPULATION)).toBeGreaterThan(POPULATION);
  });

  it("⚠ ASKS `--state merged` AND NEVER `--search` — the ceiling is why", () => {
    const args = mergedPrListArgs(POPULATION);
    expect(args.slice(0, 2)).toEqual(["pr", "list"]);
    expect(args).toContain("--state");
    expect(args).toContain("merged");
    /* The search road stops at 1000 results and the population passed that
       before this was written, so on that road no bound can answer at all. */
    expect(args).not.toContain("--search");
  });

  it("carries the derived bound at the wire, not a constant standing near it", () => {
    const args = mergedPrListArgs(POPULATION);
    const limit = args[args.indexOf("--limit") + 1];
    expect(limit).toBe(String(POPULATION + MERGED_PR_READ_HEADROOM));
    /* And it moves with the population rather than standing still. */
    const grown = mergedPrListArgs(POPULATION + 500);
    expect(grown[grown.indexOf("--limit") + 1])
      .toBe(String(POPULATION + 500 + MERGED_PR_READ_HEADROOM));
  });

  it("asks for number and title only — never `body` (#2270)", () => {
    const args = mergedPrListArgs(POPULATION);
    expect(args[args.indexOf("--json") + 1]).toBe("number,title");
  });
});

describe("#2291 · the verdict — the regression control is the old read's own numbers", () => {
  it("⚠ THE OLD SHAPE IS A FLOOR: 200 rows where 1089 were counted", () => {
    const verdict = mergedPrReadVerdict({ population: POPULATION, rows: OLD_BOUND });
    expect(verdict.kind).toBe("floor");
    /* It says how short it was, because 889 unread merges is the fact a shift
       acts on — not the word "truncated". */
    expect(verdict.kind === "floor" && verdict.why).toContain(String(POPULATION - OLD_BOUND));
  });

  it("a whole reading is complete", () => {
    const verdict = mergedPrReadVerdict({ population: POPULATION, rows: POPULATION });
    expect(verdict.kind).toBe("complete");
  });

  it("merges landing between the two calls do not read as a fault", () => {
    /* The list legitimately comes back LONGER than the count: the headroom is
       what makes that a complete reading rather than a floor. */
    const verdict = mergedPrReadVerdict({ population: POPULATION, rows: POPULATION + 2 });
    expect(verdict.kind).toBe("complete");
  });

  it("⚠ A PAGE STOPPED AT ITS BOUND IS A FLOOR THE COUNT COMPARE CANNOT SEE", () => {
    /* This is the arm the second compare exists for. The bound sits ABOVE the
       population by construction, so a capped page reads as *more rows than the
       population* and sails through the short-read compare. */
    const rows = mergedPrPageBound(POPULATION);
    expect(rows).toBeGreaterThan(POPULATION);
    const verdict = mergedPrReadVerdict({ population: POPULATION, rows });
    expect(verdict.kind).toBe("floor");
    expect(verdict.kind === "floor" && verdict.why).toContain(String(rows));
  });

  it("an unreadable count is unread, and says what it could not size against", () => {
    const verdict = mergedPrReadVerdict({ population: null, rows: 1089 });
    expect(verdict.kind).toBe("unread");
    expect(verdict.kind === "unread" && verdict.why).toMatch(/could not be read/);
  });

  it("an unreadable listing is unread even when the count came back", () => {
    const verdict = mergedPrReadVerdict({ population: POPULATION, rows: null });
    expect(verdict.kind).toBe("unread");
  });

  it("an empty history is complete rather than a fault", () => {
    /* Zero merges and zero rows agree, and the finding is genuinely clean. */
    expect(mergedPrReadVerdict({ population: 0, rows: 0 }).kind).toBe("complete");
  });
});

describe("#2291 · the sweep reads through this module and keeps no copy of the read", () => {
  const source = readFileSync(SWEEP, "utf8");

  /**
   * The shipped-but-still-open block alone. ⚠ Sliced rather than asserted over
   * the whole file, because the NEXT UP read below it legitimately still
   * carries `"--limit", "200"` — a whole-file arm would be answered by a
   * neighbour either way round.
   */
  const block = (() => {
    const from = source.indexOf("A FINISHED CARD THAT READS AS OPEN WORK");
    const to = source.indexOf("1. NEXT UP");
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    return source.slice(from, to);
  })();

  it("the source reader is really looking at the sweep, and at the right slice", () => {
    /* An absence check over the wrong file, or an empty slice, is green for the
       wrong reason — so both are anchored before anything is asserted absent. */
    expect(source).toContain("crew-briefing.json");
    expect(source.length).toBeGreaterThan(10_000);
    expect(block).toContain("planShippedNotClosed({");
    expect(block.length).toBeGreaterThan(500);
  });

  it("sizes the read through this module and builds no arguments of its own", () => {
    expect(block).toContain("mergedPrPopulationFrom(gh(mergedPrPopulationArgs()))");
    expect(block).toContain("gh(mergedPrListArgs(mergedPopulation))");
    expect(block).toContain("mergedPrReadVerdict({");
  });

  it("⚠ THE HAND-BUILT MERGED READ IS GONE, bound and all", () => {
    /* The exact form that shipped the defect. Its absence is asserted rather
       than assumed, and this string was unique to that read. */
    expect(source).not.toContain('"--state", "merged"');
  });

  it("feeds the planner only a reading that is whole", () => {
    /*
      A floor must not reach the rule — that is the difference between *clean*
      and *unread*, and it is the whole card.

      ⚠ **THIS ARM WAS INERT IN ITS FIRST SHAPE AND THE SABOTAGE CAUGHT IT.**
      It asserted the guard over the whole block, and the same expression
      appears TWICE there — once feeding the planner and once deciding what to
      report. So deleting the planner's limb left the arm GREEN, answered by its
      neighbour four lines down: the guard read its own sibling as coverage.
      The feed expression is sliced out, and both limbs are then held
      separately, because they are two decisions and only one of them keeps a
      floor out of the rule.
    */
    const feed = block.slice(
      block.indexOf("const shippedNotClosed"),
      block.indexOf("if (allOpen === null"),
    );
    expect(feed).toContain("planShippedNotClosed({");
    expect(feed.length).toBeGreaterThan(100);
    expect(feed).toContain('mergedRead.kind !== "complete"');
  });

  it("and reports the floor separately from feeding the planner", () => {
    /* The second limb: the reporting branch has to agree, or a floor is kept
       out of the rule and then never mentioned — silence with extra steps. */
    const report = block.slice(block.indexOf("if (allOpen === null"));
    expect(report.length).toBeGreaterThan(100);
    expect(report).toContain('mergedRead.kind !== "complete"');
  });

  it("a short read is reported with its reason rather than as a clean board", () => {
    expect(block).toContain("That is unread, NOT clean.");
    expect(block).toContain("mergedRead.why");
  });
});
