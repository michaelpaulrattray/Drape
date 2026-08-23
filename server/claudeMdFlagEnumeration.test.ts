/**
 * EVERY FEATURE FLAG THE CODE DECLARES IS NAMED IN `CLAUDE.md`.
 *
 * `CLAUDE.md`'s *"Optional .env vars (feature-gated)"* section reads as an
 * enumeration — one paragraph per flag, each naming its parent and what it
 * darkens — and a shift arriving at this product reads it as the flag list.
 *
 * ⚠ **On 2026-08-23 it was not one. EIGHT flags existed in the code and
 * appeared nowhere in it, and SIX of those were SET ON THE PRODUCTION SERVICE**
 * — `CASTING_TWO_PATHS_SCOPE`, `CASTING_DIAGNOSTIC_CAPTURE_SCOPE`,
 * `R7_SNAPSHOT_READ_SCOPE` (`all`), `R7_SNAPSHOT_RESTORE_SCOPE` (`users:1`),
 * `R7_EVIDENCE_COMPOSER_SCOPE`, `R7_EVIDENCE_COMPOSER_RECIPE`,
 * `R7_EVIDENCE_PACKAGE_SCOPE`, `ENABLE_EVIDENCE_CANDIDATE_WORKER`. Read off
 * `scripts/deploy-rite.mts`'s own flag block, which prints what the service
 * holds rather than what anyone remembers.
 *
 * It is the SAME failure as the Express route list one section up
 * (`architectureExpressSurfaces.test.ts`), pointed at a different list, and
 * `CLAUDE.md`'s own sentence about that one is the argument here: *a route that
 * exists but is not on the list is how the list stops being the list.*
 *
 * # DERIVED, NEVER MIRRORED (working law 4)
 *
 * The population is not a list typed here. It is every string literal assigned
 * to an exported `*_ENV` constant — the house pattern for *this is the name of
 * an environment variable* — so a new flag joins the population by being
 * written, not by anyone remembering this file.
 *
 * ⚠ **THE POPULATION IS ASSERTED NON-EMPTY AND LARGE FIRST**, before anything
 * is said about members. An enumeration guard whose scan silently returns
 * nothing is green over an empty set, which reads exactly like coverage
 * (`absence-only-expect-passes-on-nothing`). The negative control below drives
 * that directly.
 *
 * ⚠ **AND THE SCANNER IS MULTILINE ON PURPOSE.** `EVIDENCE_CANDIDATE_WORKER_ENV`
 * is declared with its value on the NEXT line, and a single-line regex drops it
 * without a word — which would have made this arm lose the one flag of the
 * eight that is not a scope. A derivation that silently loses a member is worse
 * than the list it replaces, because it reads as coverage. The positive control
 * pins that specimen by name.
 *
 * # ⚠ WHAT THIS DOES NOT COVER — a clean run is a floor, not coverage
 *
 * The population is the `*_ENV` constant pattern and ONLY that. An environment
 * variable named some other way is invisible here, and there is a real family
 * of them in the tree: `FAL_ALLOWANCES` (`server/castingV2/falBudget.ts`)
 * carries five — `ROLL_IMAGE_CONCURRENCY`, `SIGN_VIEW_CONCURRENCY`,
 * `REFINE_EDIT_CONCURRENCY`, `FAL_CONCURRENCY`, `INK_PLATE_CONCURRENCY` — as
 * `env:` fields on a table rather than as exported constants. All five ARE in
 * `CLAUDE.md` today, verified by hand 2026-08-23 along with their arithmetic
 * (8+3+3+5+1 = 20, the account ceiling, matching the sentence exactly), and
 * that family has its own boot check (`assertFalBudget`) which refuses an
 * undeclared caller. So it is guarded, differently — but a SIXTH declaration
 * shape would be guarded by nothing, and this paragraph is here so the next
 * reader knows the floor rather than inferring coverage from a green.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { declaredEnvNames, serverAndSharedSources } from "../scripts/lib/declaredEnvNames.mts";
import { FAL_ALLOWANCES, falAccountCeiling } from "./castingV2/falBudget";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/*
  THE DERIVATION MOVED, THE ARM DID NOT (2026-08-23).

  `declaredEnvNames` and its file walk now live in
  `scripts/lib/declaredEnvNames.mts`, because a SECOND arm needed the same
  population (`server/productionFlagPositions.test.ts`) and a derivation used by
  two readers must not live inside one of them — the copy is what drifts, which
  is working law 4 and is the failure this whole file exists for. The multiline
  note and the stated floor moved with it; nothing about the reading changed.
*/
const DECLARED = declaredEnvNames(serverAndSharedSources(repoRoot));

describe("the flag list is the flag list", () => {
  it("⚠ CONTROL — the scanner found a real population, and the wrapped declaration is in it", () => {
    /*
      POSITIVE CONTROLS, first and by name. Without these every assertion below
      is vacuously true over an empty scan, which is how an enumeration guard
      goes green while enumerating nothing.
    */
    expect(DECLARED.length).toBeGreaterThan(25);
    expect(DECLARED, "the scope flags this product is built on").toContain("CASTING_V2_SCOPE");
    expect(
      DECLARED,
      "the WRAPPED declaration — its value is on the line after the `=`, and a same-line regex drops it silently",
    ).toContain("ENABLE_EVIDENCE_CANDIDATE_WORKER");
  });

  it("⚠ CONTROL — a declaration the scanner cannot see would be caught", () => {
    /*
      NEGATIVE CONTROL. The instrument must be able to answer NO, and the shape
      that matters is a name the document does not carry — driven against a
      fixture rather than by breaking the repository.
    */
    expect(declaredEnvNames([])).toEqual([]);
    const claude = readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");
    expect(claude.includes("A_FLAG_NOBODY_HAS_WRITTEN_SCOPE")).toBe(false);
  });

  it("names every declared environment variable somewhere in CLAUDE.md", () => {
    const claude = readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");
    const missing = DECLARED.filter((name) => !claude.includes(name));
    expect(
      missing,
      "these environment variables exist in the code and are absent from CLAUDE.md — "
      + "a flag that exists but is not on the list is how the list stops being the list. "
      + "Add a line to the feature-gated section naming its grammar and its parent.",
    ).toEqual([]);
  });
});

/**
 * ⚠ THE SECOND DECLARATION FAMILY, WHICH THIS FILE'S OWN DOCBLOCK NAMED AS ITS
 * FLOOR AND LEFT UNCOVERED (2026-08-23, one commit after that floor was stated).
 *
 * `a0eb2889` found that `declaredEnvNames` sees ONE shape — a string literal
 * assigned to an exported `*_ENV*` constant — and that a real second family is
 * invisible to it: `FAL_ALLOWANCES` carries five environment variables as `env:`
 * fields on a table. It verified all five BY HAND and reasoned that the family
 * is "covered, differently" by `assertFalBudget`, which refuses to boot when the
 * allowances overspend the account ceiling.
 *
 * ⚠ THE CODE SIDE TURNED OUT TO BE BETTER COVERED THAN THAT NOTE IMPLIED, and
 * saying so is the point of writing this down. `falBudget.test.ts:64` pins all
 * five per-path defaults BY NAME and the total at 20, precisely so that a sixth
 * path quietly taking its slot from `roll images` reddens rather than booting.
 * Between that arm and `assertFalBudget`, the code cannot drift alone.
 *
 * WHAT NOTHING REACHED IS THE DOCUMENT. The boot check counts slots and the pin
 * reads the table; neither has ever opened CLAUDE.md. So the gap is narrower
 * than "uncovered" and it is real: change an allowance deliberately, update
 * `falBudget.test.ts` alongside it as any careful hand would, and the whole
 * suite is green while CLAUDE.md carries an undocumented variable and an
 * arithmetic sentence that no longer adds up. That exact sequence is the
 * sabotage this pair was proven on — code and its own suite moved together,
 * document left behind, and only the two arms below went red.
 *
 * A hand verification is a reading of one day, which is the thing this whole
 * file exists to stop relying on.
 *
 * So the population is taken from `FAL_ALLOWANCES` ITSELF rather than by a
 * second regex — imported, not matched, so no declaration shape can hide from
 * it — and the document's arithmetic is read back out of the sentence: every
 * name, every per-path number, the total, the count word, and the ceiling.
 * Neither side can move alone.
 */
describe("the fal allowances — the family the scanner above cannot see", () => {
  const claude = readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");

  /** CLAUDE.md's arithmetic sentence, parsed rather than trusted. */
  const sentence =
    /\`FAL_ACCOUNT_CEILING\` \(default (\d+)\)[\s\S]{0,200}?(\w+) paths spend it[\s\S]{0,200}?zero: ([^=]+)= (\d+)\./
      .exec(claude);

  it("⚠ CONTROL — the arithmetic sentence was found, and it is the real one", () => {
    /*
      Everything below reads out of this match. An anchor that stopped matching
      after a reword would make every assertion throw on `null` — loudly, which
      is fine — but an anchor that matched something SHORTER would quietly
      compare fewer pairs, and that is the failure mode worth a control.
    */
    expect(sentence, "CLAUDE.md's FAL_ACCOUNT_CEILING arithmetic sentence has moved — re-point this arm at it").not.toBeNull();
    expect(sentence![3]).toContain("ROLL_IMAGE_CONCURRENCY");
    expect(sentence![3]).toContain("INK_PLATE_CONCURRENCY");
  });

  it("⚠ names every fal allowance, with the number the code actually defaults to", () => {
    /*
      DERIVED FROM THE TABLE, not from a regex over it: `FAL_ALLOWANCES` is
      imported, so a sixth entry in any declaration style at all joins this
      population. The pairs are compared in ORDER as well as by value, because
      the sentence is arithmetic — `8 + 3` and `3 + 8` are the same sum and
      different documents.
    */
    expect(FAL_ALLOWANCES.length).toBeGreaterThan(3);

    const stated = [...sentence![3]!.matchAll(/`([A-Z][A-Z0-9_]+)`\s+(\d+)/g)]
      .map((hit) => `${hit[1]} ${hit[2]}`);
    const declared = FAL_ALLOWANCES.map((allowance) => `${allowance.env} ${allowance.fallback}`);

    expect(
      stated,
      "CLAUDE.md's fal arithmetic and FAL_ALLOWANCES name different paths or different defaults — one of them moved without the other",
    ).toEqual(declared);
  });

  it("⚠ and the count, the total and the ceiling are tied to the same table", () => {
    /*
      Three numbers in one sentence, each able to drift on its own: how many
      paths there are, what they add up to, and what they are allowed to add up
      to. `assertFalBudget` enforces the RELATION between the last two at boot;
      nothing until now checked that the document states them correctly, and a
      rebalanced sixth path keeps the boot check green while making all three
      wrong at once.
    */
    const words: Record<string, number> = { Three: 3, Four: 4, Five: 5, Six: 6, Seven: 7, Eight: 8 };
    const total = FAL_ALLOWANCES.reduce((sum, allowance) => sum + allowance.fallback, 0);

    expect(words[sentence![2]!], `CLAUDE.md says "${sentence![2]}" paths spend the fal ceiling; the code declares ${FAL_ALLOWANCES.length}`)
      .toBe(FAL_ALLOWANCES.length);
    expect(Number(sentence![4]), "CLAUDE.md's fal arithmetic no longer adds up to the sum of the declared defaults")
      .toBe(total);

    /* The ceiling is read from the code the same way the boot check reads it,
       with the variable unset — the default is what the document quotes. */
    const previous = process.env.FAL_ACCOUNT_CEILING;
    delete process.env.FAL_ACCOUNT_CEILING;
    try {
      expect(Number(sentence![1]), "CLAUDE.md quotes a different FAL_ACCOUNT_CEILING default than falAccountCeiling() returns")
        .toBe(falAccountCeiling());
    } finally {
      if (previous !== undefined) process.env.FAL_ACCOUNT_CEILING = previous;
    }
  });
});
