import path from "node:path";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { runHook } from "./testing/hookDriver";
import { readListedSource } from "./testing/listedSource";
import { repoPath, sourcePathsUnder } from "./testing/sourceTree";
import { allowTreeSweeps } from "./testing/suiteClocks";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

/*
  THIS SUITE IS IN BOTH FAMILIES, SO IT DECLARES BOTH — and that is not belt
  and braces, it is the honest reading of what its arms do.

  It walks the `scripts/` tree and parses every caller (the contended family,
  #741), and it spawns a real `git ls-files` through `runHook` to decide scope
  (the child-process family, #548). Each guard derives its own population from
  the thing the file actually does, so a file doing both is asked by both, and
  a declaration missing here is a red on somebody's loaded machine rather than
  in CI. ⚠ `atlasCommitHook.test.ts` carries the opposite correction — #964
  called it a tree sweeper and at the bytes it only spawns — so the family is
  read off the arms, never off the resemblance to a neighbour.

  `allowTreeSweeps()` is LAST on purpose: it sets 60,000 where both constants
  are 30,000, and the final `setConfig` wins. The longer number is the right
  one here because the sweep and the child are paid in the same arm.
*/
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });
allowTreeSweeps();

/**
 * A SCRIPT THAT DRIVES A PAID EDIT SAYS WHETHER IT CAN TAKE A RECEIPT.
 *
 * # The incident this exists for, which has happened once and was armed sixteen times
 *
 * `CASTING_REFINE_DISPATCH_SCOPE` changes the SHAPE OF THE ANSWER, not the
 * picture: with it on, `refineCandidate` returns a dispatch receipt the moment
 * the render starts, and `imageUrl` on that receipt is the face the customer is
 * still looking at. A browser can take a receipt and a script cannot — a script
 * reads the answer as the finished picture and exits.
 *
 * It cost `_801-court-disposable.mts` a court round: three copies of the
 * unedited master written to disk as results, *"That edit is already being
 * made"* on every following step, and one render abandoned mid-flight (`v557`,
 * left `dispatched`) when the process exited. That is the origin of the
 * `cannotTakeAReceipt` seam (#2560, `refineService.ts:919`).
 *
 * ⚠ **AND ON 2026-10-27 SIXTEEN TRACKED SCRIPTS WERE ONE FLAG RETIREMENT AWAY
 * FROM THE SAME INCIDENT** (#2710, found by the law-7 sweep on #2560).
 * Production holds the flag at `all`; the only reason those sixteen worked is
 * that the dev `.env` does not set the variable at all. That is a configuration
 * nobody chose for this purpose, on a variable **#1577 slice D4 deletes** — so
 * the protection was due to vanish without a line of their code changing.
 * Three of them were confirmed writing the receipt's `imageUrl` straight to
 * disk: `court-prune-disposable.mts:147`, `drive-refine-stack.mts:139`,
 * `drive-caption-lifecycle.mts:171`.
 *
 * # Why a guard rather than a note, and what it is honest about
 *
 * #2710 asked for *"a guard, or an honest statement that there is none"*, and
 * doubted one was available: *"`scripts/` has no suite of its own for this
 * shape."* It has two — `scriptExitDiscipline` and `scriptConnectionDiscipline`
 * — and this is the third, in their shape.
 *
 * The card's other worry was that *"a guard whose population is every tracked
 * script reddens whenever somebody writes a one-off."* It does, and that is the
 * guard working rather than noise: a new script that drives a paid edit and
 * reads the answer genuinely must say this, and the remedy is one field. It is
 * the same bargain `scriptExitDiscipline` already strikes with every new
 * script, and the refusal names the remedy.
 *
 * ⚠ **UNTRACKED FILES ARE OUT OF SCOPE ON PURPOSE** — the card's own words:
 * *"they are not shipped and they are not anybody's inheritance."* The
 * exemption is decided by `git ls-files` and never by the `-disposable` suffix,
 * for the reason `scriptWorldGuard.test.ts` records at length: twenty-four
 * `-disposable.mts` files were promoted into the repository because tracked
 * source cites them by name, and under a suffix key they would have kept a
 * one-shot's exemption forever.
 */

const ROOT = path.resolve(__dirname, "..");
const SCRIPTS = repoPath("scripts");

/** Source with comments removed — a mention in a docblock is not a door. */
const codeOnly = (raw: string): string => raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((line) => line.replace(/(^|\s)\/\/.*$/, ""))
  .join("\n");

export type CallVerdict = {
  readonly line: number;
  readonly ok: boolean;
  readonly reason: string;
};

/** `refineCandidate(…)` or `mod.refineCandidate(…)`, never a type reference. */
const calleeIsRefineCandidate = (callee: ts.Expression): boolean => {
  if (ts.isIdentifier(callee)) return callee.text === "refineCandidate";
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text === "refineCandidate";
  return false;
};

/**
 * `harness(counters, stop) as never` is a real shape in the tree, and so is a
 * parenthesised one. The assertion is not the argument; the thing inside it is.
 */
const unwrap = (node: ts.Expression): ts.Expression => {
  let current = node;
  for (;;) {
    if (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) { current = current.expression; continue; }
    if (ts.isParenthesizedExpression(current)) { current = current.expression; continue; }
    if (ts.isTypeAssertionExpression(current)) { current = current.expression; continue; }
    return current;
  }
};

const named = (property: ts.ObjectLiteralElementLike, name: string): boolean =>
  property.name !== undefined && ts.isIdentifier(property.name) && property.name.text === name;

/** `admit: () => false` — the credit door shut, so nothing is ever dispatched. */
const shutsTheCreditDoor = (property: ts.ObjectLiteralElementLike): boolean => {
  if (!ts.isPropertyAssignment(property) || !named(property, "admit")) return false;
  const value = unwrap(property.initializer);
  return ts.isArrowFunction(value)
    && !ts.isBlock(value.body)
    && value.body.kind === ts.SyntaxKind.FalseKeyword;
};

/** `cannotTakeAReceipt: true` — stated by the caller, which is where it belongs. */
const saysItCannotTakeOne = (property: ts.ObjectLiteralElementLike): boolean =>
  ts.isPropertyAssignment(property)
  && named(property, "cannotTakeAReceipt")
  && unwrap(property.initializer).kind === ts.SyntaxKind.TrueKeyword;

/**
 * THE FOUR ACCEPTED SHAPES, every one of them already in the tree, and the one
 * limit stated rather than hidden.
 *
 *   1. `{ cannotTakeAReceipt: true, … }` — the caller says so. The fifteen
 *      callers repaired by #2710, and `_801-court-disposable.mts` before them.
 *   2. `{ admit: () => false, … }` — the credit door is shut, so the claim is
 *      never taken and no render is ever dispatched; the flag cannot reach it.
 *      `bench-noop-door-disposable.mts` and `bench-request-recorder-disposable.mts`,
 *      whose whole subject is the refusal BEFORE the claim. #2710 is explicit
 *      that adding the field to these would be *"noise that reads as coverage."*
 *   3. A bag carrying a SPREAD — `{ ...dependencies, … }` — is out of scope,
 *      because its doors demonstrably come from its caller. This is the three
 *      `_2544-*` census scripts, which reach the service through
 *      `scripts/lib/capabilityAtlas.mts`, where `admit: () => false` is passed.
 *      ⚠ Note they each mention `admit` in a DOCBLOCK and nowhere else, which
 *      is exactly why this reader asks the parser about the argument instead of
 *      grepping the file for a word.
 *   4. A bag that is not a literal at all — `harness(…) as never` — is accepted
 *      only when the FILE sets the field in code, which is where a bag built by
 *      a local helper states it. `prove-refine-idempotency-disposable.mts` sets
 *      it inside `harness()`, once, rather than at each of its two call sites.
 *
 * ⚠ **THE LIMIT, NAMED: shape 4 is the hole.** A bag built by a helper in
 * ANOTHER file, with no mention here, is refused — which is the safe direction
 * — but a file that mentions the field anywhere in code and passes a different
 * bag would pass. That is a floor, not a proof, and it is the smallest hole the
 * parser can leave without resolving values across modules.
 */
export const receiptContract = (raw: string, fileName = "probe.mts"): CallVerdict[] => {
  const source = ts.createSourceFile(fileName, raw, ts.ScriptTarget.ESNext, true);
  const fileSetsTheField = /\bcannotTakeAReceipt\s*:/.test(codeOnly(raw));
  const verdicts: CallVerdict[] = [];

  const judge = (argument: ts.Expression | undefined, line: number): CallVerdict => {
    if (argument === undefined) {
      return { line, ok: false, reason: "called with no dependency bag at all" };
    }
    const bag = unwrap(argument);
    if (ts.isObjectLiteralExpression(bag)) {
      if (bag.properties.some(saysItCannotTakeOne)) {
        return { line, ok: true, reason: "says `cannotTakeAReceipt: true`" };
      }
      if (bag.properties.some(shutsTheCreditDoor)) {
        return { line, ok: true, reason: "shuts the credit door with `admit: () => false`" };
      }
      if (bag.properties.some((property) => ts.isSpreadAssignment(property))) {
        return { line, ok: true, reason: "spreads a caller's bag, so its doors come from the caller" };
      }
      return {
        line,
        ok: false,
        reason: "passes a bag that neither says `cannotTakeAReceipt: true` nor shuts the credit door",
      };
    }
    if (fileSetsTheField) {
      return { line, ok: true, reason: "passes a bag built in this file, which sets the field" };
    }
    return {
      line,
      ok: false,
      reason: "passes a bag this reader cannot see into, and the file never sets `cannotTakeAReceipt`",
    };
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && calleeIsRefineCandidate(node.expression)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      verdicts.push(judge(node.arguments[0], line));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return verdicts;
};

/**
 * REFUSE, DO NOT ALLOW, WHEN THE DEPENDENCY IS MISSING.
 *
 * This decides who is in scope, so an empty answer — git absent, an export, a
 * build context that is not a checkout — would exempt every script in the tree
 * and turn the suite green by making it blind. Invariant 7's other half, and
 * the same refusal `scriptWorldGuard.test.ts` writes for the same reason.
 */
const trackedScripts = (): Set<string> => {
  const run = runHook("git", ["ls-files", "--", "scripts"], { cwd: ROOT });
  if (run.status !== 0) throw new Error(`git ls-files exited ${run.status} — scope cannot be decided`);
  const names = run.stdout.split(/\r?\n/).filter((line) => line !== "");
  if (names.length === 0) throw new Error("git ls-files returned no scripts — scope cannot be decided");
  return new Set(names);
};

/* The read and the population are the same step (#223): a file that leaves
   between the walk and the read is dropped, never thrown out of a filter. */
const callers = (): { rel: string; source: string; verdicts: CallVerdict[] }[] => {
  const tracked = trackedScripts();
  const walked = sourcePathsUnder(SCRIPTS, {
    tests: "include",
    extensions: [".ts", ".mts", ".tsx", ".js", ".mjs"],
  }).map((absolute) => path.relative(ROOT, absolute).split(path.sep).join("/"));

  const found: { rel: string; source: string; verdicts: CallVerdict[] }[] = [];
  for (const rel of walked) {
    if (!tracked.has(rel)) continue;
    const source = readListedSource(path.join(ROOT, rel));
    if (source === null) continue;
    const verdicts = receiptContract(source, rel);
    if (verdicts.length > 0) found.push({ rel, source, verdicts });
  }
  return found;
};

/*
  THE FLOOR IS THE TWO KEPT TOOLS, not a count and not the disposables.

  #2710 singles them out: `drive-refine-stack.mts` and
  `drive-caption-lifecycle.mts` carry no `-disposable` suffix, so they are
  standing instruments rather than spent one-offs, and they are *"the two most
  likely to be run again by somebody who was not here tonight."* A count would
  drift every time a court is swept; these two are the stable members.

  If a later shift genuinely retires one, this line is the thing that tells it
  to re-point the floor — which is the conversation a floor exists to force.
*/
const FLOOR = ["scripts/drive-refine-stack.mts", "scripts/drive-caption-lifecycle.mts"];

describe("a script that drives a paid edit says whether it can take a receipt", () => {
  it("finds the callers at all — a guard over an empty list is not a guard", () => {
    const found = callers().map((entry) => entry.rel);
    expect(found.length).toBeGreaterThan(0);
    for (const rel of FLOOR) {
      expect(
        found,
        `${rel} drives a paid edit and is not in this guard's population. Either the reader `
        + "stopped seeing it, or the file was retired — if it was retired, re-point FLOOR at "
        + "another tracked caller rather than deleting the floor.",
      ).toContain(rel);
    }
  });

  it("holds for every one of them", () => {
    const refused = callers()
      .flatMap((entry) => entry.verdicts.map((verdict) => ({ rel: entry.rel, verdict })))
      .filter((row) => !row.verdict.ok)
      .map((row) => `${row.rel}:${row.verdict.line} — ${row.verdict.reason}`);

    expect(
      refused,
      "A script cannot take a dispatch receipt: it reads the answer as the finished picture and "
      + "exits, so with `CASTING_REFINE_DISPATCH_SCOPE` on it writes the unedited master to disk "
      + "and abandons the render it paid for (#2710, #801). Pass `cannotTakeAReceipt: true` in the "
      + "dependency bag, or shut the credit door with `admit: () => false` if the subject is a "
      + "refusal before the claim.",
    ).toEqual([]);
  });

  it("CAN FAIL — the shapes it must reject, driven directly", () => {
    const bare = receiptContract("await refineCandidate({}, { userId: 1 });");
    expect(bare).toHaveLength(1);
    expect(bare[0]!.ok).toBe(false);

    /* The exact line #2710 repaired fifteen times. */
    const withOtherDeps = receiptContract("await refineCandidate({ interpret }, { userId: 1 });");
    expect(withOtherDeps[0]!.ok).toBe(false);

    /* An OPEN credit door is not a shut one — `prove-refine-idempotency` sets
       this, and it is the sharpest caller rather than an exempt one. */
    const openDoor = receiptContract("await refineCandidate({ admit: () => true }, { userId: 1 });");
    expect(openDoor[0]!.ok).toBe(false);

    /* `false` is the word that matters, not the field's presence. */
    expect(receiptContract("refineCandidate({ cannotTakeAReceipt: false }, {});")[0]!.ok).toBe(false);

    /* A docblock mention is not a door — the census scripts' real shape. */
    const commented = receiptContract("/* admit: () => false — cents */\nrefineCandidate({ interpret }, {});");
    expect(commented[0]!.ok).toBe(false);

    /* An opaque bag with no mention in the file. */
    const opaque = receiptContract("refineCandidate(harness() as never, {});");
    expect(opaque[0]!.ok).toBe(false);

    expect(receiptContract("refineCandidate();")[0]!.ok).toBe(false);
  });

  it("accepts the four shapes that are really in the tree, driven directly", () => {
    expect(receiptContract("refineCandidate({ cannotTakeAReceipt: true }, {});")[0]!.ok).toBe(true);
    expect(receiptContract("refineCandidate({ interpret, admit: () => false }, {});")[0]!.ok).toBe(true);
    expect(receiptContract("refineCandidate({ ...dependencies, outfitEditEnabled: () => true }, r);")[0]!.ok).toBe(true);

    const viaHelper = [
      "function harness() { return { admit: () => true, cannotTakeAReceipt: true }; }",
      "await refineCandidate(harness() as never, { userId: 1 });",
      "await refineCandidate(harness() as never, { userId: 2 });",
    ].join("\n");
    const verdicts = receiptContract(viaHelper);
    expect(verdicts).toHaveLength(2);
    expect(verdicts.every((verdict) => verdict.ok)).toBe(true);
  });

  it("reads calls and not type references, so a wrapper's annotation is not a call", () => {
    /* `const refine: typeof refineCandidate = …` is real, in all three census
       scripts. A reader keyed on the NAME rather than on the call would judge
       the annotation and report a caller that does not exist. */
    const annotated = [
      "const refine: typeof refineCandidate = (dependencies, request) =>",
      "  refineCandidate({ ...dependencies }, request);",
    ].join("\n");
    const verdicts = receiptContract(annotated);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]!.ok).toBe(true);
  });
});
