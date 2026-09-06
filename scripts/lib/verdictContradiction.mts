/**
 * A VERDICT CONTRADICTED BY ITS OWN `saw` (fable-312 §4).
 *
 * # The walk carried the evidence of its own failure and had no rule that read it
 *
 * Shift 59's five-ask walk went CLEAN, 83 green checks, on a chain whose second
 * step charged 25 credits for a picture that did not contain what was asked for.
 * The row said so in its own words:
 *
 *     facet   statedAccessories     binding: TRUE     verified: TRUE
 *     asked   "gold hoop earrings, dangly cross earrings, …"
 *     saw     "gold hoop earrings on both ears, plain hoops, no dangly crosses"
 *
 * and the walk PRINTED that verbatim, beside a green tick, because `[A]` asks
 * whether an earring is on both ears — which it is. A verdict and its `saw` sat
 * in one string and nothing compared them.
 *
 * # Anchored on the ASKED thing, never on the presence of a negation
 *
 * The obvious rule — "fire if the `saw` contains a negation" — is the one this
 * must not be. Readers negate constantly and harmlessly: *"no visible
 * blemishes"*, *"not gathered or pinned"*, *"no rim shadow"*. A check that fired
 * on those would cry wolf on honest rows, and an instrument that cries wolf is
 * an instrument nobody reads.
 *
 * So the comparator works clause by clause, and a clause only counts when it
 * both NEGATES and names a distinctive word from what was ASKED. That is the
 * shape of a reader saying *the thing you asked for is not here* while its
 * verdict says otherwise.
 *
 * # The one thing it could not do alone — CLOSED, by the fix it shipped beside
 *
 * While the ask ACCUMULATED a set, the asked string carried superseded items
 * too, so a `saw` honestly reporting *"no plain hoops"* after a replacement
 * looked like a contradiction of the ask. That was named here rather than hidden
 * and it is now discharged: the ask supersedes (`supersedeWithinSet`, shift 60),
 * so every asked term is a term the picture is supposed to contain — and the
 * last NEGATIVE below is that sentence as a control.
 *
 *   npx tsx scripts/lib/verdictContradiction.mts --prove
 */

/** Words that carry no distinguishing weight when matched inside a `saw`. */
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
const NOISE = new Set([
  "with", "and", "the", "her", "his", "their", "one", "each", "both", "pair",
  "matching", "visible", "worn", "that", "this", "from", "into", "onto", "over",
  "under", "very", "more", "less", "than", "then", "also", "still", "some",
]);

/** How a reader says a thing is not there. */
const NEGATORS = /\b(?:no|not|none|without|lacking|absent|missing|nor|isn't|aren't|doesn't|don't)\b/i;

const stem = (word: string) => word.replace(/(ing|ed|es|s)$/i, "").replace(/e$/i, "");

/** Clauses, split the same way on both sides of the comparison. */
function clausesOf(text: string): string[] {
  return text.split(/[,;.]|—|\bbut\b|\bthough\b|\bor\b/i).map((part) => part.trim()).filter(Boolean);
}

/**
 * The distinctive words of what the picture is supposed to CONTAIN — lowercase,
 * de-noised, stemmed the same crude way the free lane's source containment
 * stems.
 *
 * **A term the ask itself negates is not one of them**, and that carve-out came
 * out of this module's own negative control rather than out of foresight. Half
 * the product's pinned wordings are contrastive by design — `HAIR_ARRANGEMENTS`
 * says *"worn down — hanging, not gathered, tied or pinned up"* because a
 * wording that names its own contrast reads better — so "gathered" is a word in
 * the ask that the picture must NOT show. A reader echoing *"not gathered or
 * pinned"* is AGREEING, and a comparator that took every word of the ask at
 * face value called that a contradiction on the first honest row it met.
 */
export function askedTerms(asked: string): string[] {
  const wanted = clausesOf(asked).filter((clause) => !NEGATORS.test(clause));
  return Array.from(new Set(
    wanted.join(" ").toLowerCase().split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !NOISE.has(word))
      .map(stem),
  ));
}

export type Contradiction = {
  /** The clause that both negates and names the asked thing. */
  clause: string;
  /** Which asked term it named — so the report says what was contradicted. */
  term: string;
};

/**
 * Does this `saw` explicitly say the ASKED thing is not there?
 *
 * Null when it does not, which is the answer for the overwhelming majority of
 * honest rows — including every row whose reader negates something nobody asked
 * about.
 */
export function contradicts(asked: string, saw: string): Contradiction | null {
  const terms = askedTerms(asked);
  if (terms.length === 0) return null;
  for (const clause of clausesOf(saw)) {
    if (!NEGATORS.test(clause)) continue;
    const words = clause.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem);
    const named = terms.find((term) => words.includes(term));
    if (named !== undefined) return { clause, term: named };
  }
  return null;
}

/**
 * Every BINDING facet that passed on this row while its own reading names the
 * asked thing as missing.
 *
 * The row-reading lives here rather than in the walk so that the walk's check
 * and the probe that proves it can fire are the SAME code. A check whose only
 * exercise is a copy of itself is the shape this campaign keeps paying for: two
 * benches passed for a week over an inert segment store, each proving its own
 * half against arguments its own harness supplied.
 *
 * Takes the stored `internalPrompt` in either shape — the driver hands JSON back
 * parsed on one path and as text on another.
 */
export function contradictedBindingVerdicts(internalPrompt: unknown): Array<{
  facet: string;
  asked: string;
  saw: string;
  against: Contradiction;
}> {
  const stored = typeof internalPrompt === "string"
    ? (() => { try { return JSON.parse(internalPrompt); } catch { return null; } })()
    : internalPrompt;
  const verdicts: Array<Record<string, unknown>> = stored?.verification?.checks ?? [];
  return verdicts
    .filter((row) => row.binding === true && row.verified === true)
    .map((row) => ({
      facet: String(row.facet ?? ""),
      asked: String(row.asked ?? ""),
      saw: String(row.saw ?? ""),
      against: contradicts(String(row.asked ?? ""), String(row.saw ?? "")),
    }))
    .filter((row): row is { facet: string; asked: string; saw: string; against: Contradiction } =>
      row.against !== null);
}

/** How many binding facets passed on this row at all — so a walk can tell
 *  "nothing to contradict" apart from "nothing was read". */
export function bindingVerdictCount(internalPrompt: unknown): number {
  const stored = typeof internalPrompt === "string"
    ? (() => { try { return JSON.parse(internalPrompt); } catch { return null; } })()
    : internalPrompt;
  const verdicts: Array<Record<string, unknown>> = stored?.verification?.checks ?? [];
  return verdicts.filter((row) => row.binding === true && row.verified === true).length;
}

/* ------------------------------------------------------------ the controls */

const CASES: Array<{ kind: "POSITIVE" | "NEGATIVE"; why: string; asked: string; saw: string }> = [
  {
    kind: "POSITIVE",
    why: "shift 59 step 2's own row — the render that was charged for and did not deliver",
    asked: "gold hoop earrings, dangly cross earrings, one on each ear, a matching pair",
    saw: "gold hoop earrings on both ears, plain hoops, no dangly crosses",
  },
  {
    kind: "POSITIVE",
    why: "the same shape said the other way round, so the rule is not matching one sentence",
    asked: "thin gold wire-frame glasses",
    saw: "her face is bare, without glasses of any kind",
  },
  {
    kind: "NEGATIVE",
    why: "shift 59 step 1's own row — an honest affirmative, no negation at all",
    asked: "gold hoop earrings, one on each ear, a matching pair",
    saw: "gold hoop earrings visible on both left and right ears",
  },
  {
    kind: "NEGATIVE",
    why: "THE ONE THAT MATTERS — a negation about something nobody asked about",
    asked: "dangly cross earrings, one on each ear, a matching pair",
    saw: "dangly cross earrings on both ears, no visible blemishes",
  },
  {
    kind: "NEGATIVE",
    why: "a reader's ordinary contrastive phrasing, which every hairWorn wording uses",
    asked: "worn down — hanging, not gathered, tied or pinned up",
    saw: "hair worn loose and down past the shoulders, not gathered or pinned",
  },
  {
    kind: "NEGATIVE",
    why: "an empty saw is a no-read, and a no-read is not a contradiction",
    asked: "gold hoop earrings",
    saw: "",
  },
  {
    kind: "NEGATIVE",
    why: "THE ONE THE ACCUMULATING ASK BLOCKED — a replacement's honest reading. "
      + "The hoops were replaced, so a reader reporting their absence is agreeing; "
      + "under the old accumulating ask this exact row would have cried wolf",
    asked: "dangly cross earrings, one on each ear, a matching pair",
    saw: "dangly cross earrings on both ears, no plain hoops",
  },
  {
    kind: "POSITIVE",
    why: "a LIVE reading of the walk's own step-2 frame, per item "
      + "(prove-per-item-question-disposable.mts, 5/5, 2026-08-13) — the words a "
      + "real reader used once the question was asked about one thing",
    asked: "dangly cross earrings, one on each ear, a matching pair",
    saw: "gold hoop earrings on both ears, not dangly cross earrings",
  },
];

/*
  ITS CONTROLS RUN ONLY WHEN THIS FILE IS THE ONE THAT WAS INVOKED (#345, the
  class sweep behind PR #587's reviewer finding 2).

  A module-scope argv read is the IMPORTER's argv. So `npx tsx
  scripts/drive-self-walk.mts --prove --spend` ran THIS module's self-controls
  and exited before the driver's own strict parse ever saw the unknown word -
  the driver neither walked nor refused. One word bypassing a refusal, which is
  the class the strict parse exists to close. Five modules in `scripts/lib`
  carried it; `server/spendingScriptArguments.test.ts` now pins all five.
*/
const invokedDirectly = process.argv[1] !== undefined
  && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly && process.argv.includes("--prove")) {
  let failed = 0;
  for (const bench of CASES) {
    const found = contradicts(bench.asked, bench.saw);
    const ok = bench.kind === "POSITIVE" ? found !== null : found === null;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${bench.kind.padEnd(8)} ${bench.why}\n`
      + `        asked: ${bench.asked}\n`
      + `        saw:   ${bench.saw || "(empty)"}\n`
      + `        →      ${found ? `contradicted on "${found.term}" in "${found.clause}"` : "no contradiction"}`,
    );
  }
  console.log(`\n${CASES.length} case(s), ${failed} failure(s).`);
  process.exit(failed === 0 ? 0 : 1);
}
