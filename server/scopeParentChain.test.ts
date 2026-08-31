/**
 * THE SCOPE FLAGS' PARENT CHAIN, AS THE CODE HAS IT AND AS THE DOCUMENT SAYS IT.
 *
 * Every casting scope flag is a CHILD: `CASTING_INK_CUT_SCOPE` refuses to boot
 * for a user who is not already inside `CASTING_INK_STUDIO_SCOPE`, and so on up
 * to `CASTING_V2_SCOPE` at the root. That fence is real — twenty
 * `validate…Environment` functions in `castingV2/castingV2Scope.ts`, each
 * throwing rather than warning — and every one of them is described in
 * the flag catalogue (`docs/architecture/FEATURE_FLAGS.md`, carved out
 * of CLAUDE.md by #330), because **that catalogue is the document a flip
 * is planned from.**
 *
 * ⚠ WHAT HAPPENS WHEN THOSE TWO DISAGREE IS NOT A DOCUMENTATION BUG. It is a
 * production crash loop, and this product has had one: 2026-07-31, the evidence
 * boot guards, a deploy that reported SUCCESS and a service that would not stay
 * up. A paragraph naming the wrong parent sends whoever reads it to set one
 * variable when two were needed — and the failure lands at BOOT, after the
 * push, on a service that was healthy a minute earlier.
 *
 * So the chain is derived from the fences themselves and compared against the
 * bullets (working law 4):
 *
 *   the code       each `validate<Stem>Environment`'s body, and the `*_SCOPE_ENV`
 *                  constant it names when it refuses
 *   the document   the catalogue entry that opens `- \`<THAT FLAG>\``
 *
 * ⚠ THE MAPPING IS SELF-CHECKING RATHER THAN TYPED. A validator's stem is turned
 * into its flag name mechanically (`CastingInkRegionCrop` →
 * `CASTING_INK_REGION_CROP_SCOPE`) and then REQUIRED to be one of the env
 * constants the file actually declares. A typed table would be the parallel copy
 * that goes stale; a derivation that guessed wrong would be worse than either,
 * so it is made to fail loudly instead of silently matching nothing.
 *
 * And the two populations are compared as SETS, not counts: twenty fences and
 * twenty declared flags are not the same twenty (`prose-join-fails-both-ways`).
 * A scope constant declared with no fence behind it is the shape that arm
 * catches — a flag that can be set and is enforced by nothing.
 *
 * STATED LIMITS, both of them:
 *
 *   1. The parent must be NAMED in the flag's bullet; this does not read the
 *      sentence around it. A bullet naming its parent for some other reason
 *      would pass. That is a false negative and it is the price of not writing
 *      a parser for twenty ornate paragraphs — the failure that matters, a
 *      parent the bullet never mentions at all, cannot slip through.
 *   2. The population is the scope fences in `castingV2Scope.ts`. The R7
 *      evidence scopes have their own guards elsewhere and are not here.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FLAG_CATALOGUE, flagCatalogue } from "../scripts/lib/lawText.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scopeSource = readFileSync(
  path.join(repoRoot, "server/castingV2/castingV2Scope.ts"),
  "utf8",
);
/*
  ⚠ THE BULLETS MOVED, THE ARM DID NOT (2026-08-31, #330).

  The flag catalogue was carved out of `CLAUDE.md` into
  `docs/architecture/FEATURE_FLAGS.md`, byte for byte. Left reading `CLAUDE.md`
  this file would have found no bullet for any flag, and the "has a bullet"
  assertion below would have caught it loudly — which is the only reason the
  move was safe to make. The document a flip is planned from is the catalogue
  now, and `scripts/lib/lawText.mts` owns where that is.
*/
const catalogue = flagCatalogue(repoRoot);

/** `IDENTIFIER_SCOPE_ENV` → the flag name it holds. */
function declaredScopeEnvs(source: string): Record<string, string> {
  const declared: Record<string, string> = {};
  for (const hit of source.matchAll(
    /export const ([A-Z][A-Z0-9_]*_SCOPE_ENV)\s*=\s*"([A-Z0-9_]+)"/g,
  )) {
    declared[hit[1]!] = hit[2]!;
  }
  return declared;
}

/**
 * A function's body, brace-matched from the brace that follows its return type.
 *
 * ⚠ Matching from the FIRST brace after the name reads the destructured
 * parameter's type literal instead, and every parent then comes back empty —
 * which is a green run over nothing. That mistake was made once while building
 * this, and the "every fence has a parent" assertion below is what caught it.
 */
function bodyOfFunctionAt(source: string, at: number): string {
  const afterParams = source.indexOf("):", at);
  const open = source.indexOf("{", afterParams);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return "";
}

type Fence = { flag: string; parents: string[] };

function scopeFences(source: string): Fence[] {
  const declared = declaredScopeEnvs(source);
  const names = new Set(Object.values(declared));
  const fences: Fence[] = [];
  for (const hit of source.matchAll(/export function validate(\w+)Environment\(/g)) {
    const flag = `${hit[1]!.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}_SCOPE`;
    if (!names.has(flag)) {
      throw new Error(
        `validate${hit[1]}Environment does not map to a declared scope constant (derived "${flag}") — the stem convention has changed and this arm must be re-pointed, not deleted`,
      );
    }
    const body = bodyOfFunctionAt(source, hit.index!);
    const parents = [
      ...new Set(
        [...body.matchAll(/([A-Z][A-Z0-9_]*_SCOPE_ENV)/g)]
          .map((env) => declared[env[1]!]!)
          .filter((name) => name !== flag),
      ),
    ];
    fences.push({ flag, parents });
  }
  return fences;
}

/** The catalogue entry for one flag, from its own `- \`FLAG\`` to the next. */
function bulletFor(flag: string): string {
  const start = catalogue.indexOf(`- \`${flag}\``);
  if (start < 0) return "";
  const next = catalogue.indexOf("\n- `", start + 3);
  return catalogue.slice(start, next > start ? next : start + 8000);
}

describe("the scope fences, derived from the code", () => {
  const fences = scopeFences(scopeSource);

  it("⚠ CONTROL — the derivation found the fences AND read their bodies", () => {
    /*
      Two things, and the second is the one that failed while this was being
      written. A body slicer pointed at the wrong brace returns the parameter
      type, every parent comes back empty, and the comparison below passes over
      nothing at all — the vacuous green this whole family of arms exists to
      refuse. So: the population is large, and all but the ROOT have a parent.
    */
    expect(fences.length).toBeGreaterThan(15);
    const rootless = fences.filter((fence) => fence.parents.length === 0).map((f) => f.flag);
    expect(
      rootless,
      "exactly one scope fence has no parent — the root; if this list grew, either a child lost its fence or the body reader is returning nothing",
    ).toEqual(["CASTING_V2_SCOPE"]);
  });

  it("⚠ every declared scope flag HAS a fence, and every fence a declared flag", () => {
    /*
      Compared as SETS rather than counts (`prose-join-fails-both-ways`). The
      shape this catches is a scope constant that can be set and is enforced by
      nothing — a flag with no boot check is invariant 7's "a control that is not
      invoked does not exist", wearing an env var.
    */
    const declared = Object.values(declaredScopeEnvs(scopeSource)).sort();
    expect(declared.length).toBeGreaterThan(15);
    expect(
      fences.map((fence) => fence.flag).sort(),
      "the scope constants declared in castingV2Scope.ts and the validate…Environment fences are different sets",
    ).toEqual(declared);
  });

  it("⚠ every fence's parent is named in that flag's own CLAUDE.md bullet", () => {
    /*
      The point of the file. CLAUDE.md is what a flip is planned from, and a
      bullet naming the wrong parent — or a parent the code has since changed —
      is a production boot crash discovered after the push, which this product
      has had once already.
    */
    for (const fence of fences) {
      const bullet = bulletFor(fence.flag);
      expect(
        bullet.length,
        `${fence.flag} has a boot fence and no entry in ${FLAG_CATALOGUE}`,
      ).toBeGreaterThan(80);
      for (const parent of fence.parents) {
        expect(
          bullet.includes(parent),
          `${fence.flag}'s boot fence refuses unless ${parent} covers it, and ${fence.flag}'s entry in ${FLAG_CATALOGUE} never mentions ${parent} — whoever plans the flip from that paragraph will set one variable where two were needed, and find out at boot`,
        ).toBe(true);
      }
    }
  });

  it("CONTROL — a fence whose parent the document does not name is caught", () => {
    /*
      Driven on a fixture rather than by breaking the repository: a fence in the
      real shape, naming a parent that exists in the code and appears in no
      bullet. Without this the arm above says only that nothing is wrong today.
    */
    const fixture = `
      export const CASTING_MADE_UP_SCOPE_ENV = "CASTING_MADE_UP_SCOPE";
      export const CASTING_OTHER_MADE_UP_SCOPE_ENV = "CASTING_OTHER_MADE_UP_SCOPE";
      export function validateCastingMadeUpEnvironment(input: {
        scope: string | undefined;
      }): CastingV2Scope {
        throw new Error(\`needs \${CASTING_OTHER_MADE_UP_SCOPE_ENV}\`);
      }
      export function validateCastingOtherMadeUpEnvironment(input: {
        scope: string | undefined;
      }): CastingV2Scope {
        return parse(input.scope);
      }
    `;
    const [child] = scopeFences(fixture);
    expect(child!.flag).toBe("CASTING_MADE_UP_SCOPE");
    expect(child!.parents).toEqual(["CASTING_OTHER_MADE_UP_SCOPE"]);
    expect(bulletFor("CASTING_MADE_UP_SCOPE")).toBe("");
  });

  it("CONTROL — a stem that maps to no declared flag REFUSES rather than passing", () => {
    /*
      The derivation replaces a typed table, so it has to be unable to shrug. A
      renamed convention must stop the arm, not quietly produce a smaller
      population that agrees with everything.
    */
    expect(() =>
      scopeFences(`
        export const CASTING_REAL_SCOPE_ENV = "CASTING_REAL_SCOPE";
        export function validateSomethingElseEntirelyEnvironment(input: {
          scope: string | undefined;
        }): CastingV2Scope {
          return parse(input.scope);
        }
      `),
    ).toThrow(/does not map to a declared scope constant/);
  });
});
