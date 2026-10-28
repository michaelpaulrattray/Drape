/**
 * THE SIDE CLAUSE, AND THAT ITS FLAG STAYS RETIRED (#1577 slice D2).
 *
 * `CASTING_SIDE_PHRASING_SCOPE` decided whether a per-side ask also said which
 * half of the picture that side is on — *"her right eye (on the left of the
 * picture as you look at it)"*. It stood at `all` on the service from the
 * founder's widening on 2026-08-25 (*"measured p≈0.09, never once worse, free
 * per render"*) until the flag came out, so the arm that said nothing extra
 * was asked of nobody, and the clause is simply what the assembler says now.
 *
 * # What this file is for, and what it deliberately is NOT
 *
 * The clause's own sentences are pinned where they always were, in
 * `recipeAssembler.test.ts`'s *"where that side is in the picture"* — those
 * three literal strings are the BAR the retirement had to meet, and a second
 * copy of them here is the drift working law 4 names. This file holds the two
 * things that suite cannot say:
 *
 *  1. **It is unconditional at the SEAM**, driven through the real assembler
 *     with no option and no environment — the gap slice D1 named as the trap
 *     for every one of these retirements, where a flag is proven gone inside
 *     the function and inside the boot guard and nowhere at the wire between.
 *  2. **It stays retired** — the three resurrection shapes, on the shape slice
 *     D1 settled, plus the opposite failure: a flag deleted from the code AND
 *     from the record leaves the next shift no way to learn it ever existed.
 *
 * ⚠ **It does NOT assert the flag's name is absent from the tree**, the same
 * floor slices 4b and D1 stated and for the same reason: the record has to
 * name what died. The three shapes below are what it reads, and a fourth would
 * be invisible to it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { declaredEnvNames, serverAndSharedSources } from "../../scripts/lib/declaredEnvNames.mts";
import {
  cataloguedFlags, flagCatalogue, FLAG_CATALOGUE, indexedFlags, LAW_SURFACES,
} from "../../scripts/lib/lawText.mts";
import { PRODUCTION_FLAG_POSITIONS } from "../../scripts/lib/productionFlagPositions.mts";
import { assembleRecipe } from "./recipeAssembler";
import { pronounsForSex } from "./castPronouns";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MASTER = { key: "casting-v2/candidates/master.png", sha: "16bb85180e9e" };
const SHE = pronounsForSex("female");

describe("the clause is said unconditionally, at the seam", () => {
  /*
    THE SEAM IS THE PART A PER-USER FLAG HID, and it is why this arm is here
    rather than only in the assembler's suite: the dying code read the flag in
    `refineService.ts` and passed the answer in as `placeSides`, so a reader
    looking at the assembler alone could never see which arm production took.
    With the option gone there is nothing to pass, and the only way to prove
    that is to call the real function with no option at all.
  */
  it("names the half with no option passed and no environment set", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [],
      asks: [{ slot: "eye@right", noun: "right eye", words: "fiery red" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toContain("on the left of the picture as you look at it");
  });

  it("and no environment can take it back — the flag's own value changes nothing", () => {
    /*
      The negative control for the arm above, and the one that would have caught
      a half-done retirement: setting the retired name to every value it ever
      took must make no difference, because nothing reads it. A retirement that
      left one reader behind fails exactly here and nowhere else.
    */
    const before = { ...process.env };
    try {
      for (const value of ["off", "all", "users:1", "users:2"]) {
        process.env.CASTING_SIDE_PHRASING_SCOPE = value;
        const recipe = assembleRecipe({
          master: MASTER, pronouns: SHE,
          library: [],
          asks: [{ slot: "eye@right", noun: "right eye", words: "fiery red" }],
        });
        expect(recipe.ok, value).toBe(true);
        if (!recipe.ok) return;
        expect(recipe.ask, value).toBe(
          "Change only her right eye (on the left of the picture as you look at it): fiery red.",
        );
      }
    } finally {
      process.env = { ...before };
    }
  });

  it("and a COLLAPSING pair still says no half, because the answer is both", () => {
    /* Not a leftover of the flag: there is no half of the picture to name when
       a pair speaks once. Pinned here because it is the one place the clause
       legitimately says nothing on a sided slot, and a reader meeting that
       sentence would otherwise read it as the retirement having missed a seam. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [],
      asks: [
        { slot: "earring@left", noun: "left earring", words: "a thin gold hoop" },
        { slot: "earring@right", noun: "right earring", words: "a thin gold hoop" },
      ],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe("Change only her earrings: a thin gold hoop.");
  });
});

describe("and it stays retired (#1577 slice D2)", () => {
  /** The retired flag. */
  const RETIRED = "CASTING_SIDE_PHRASING_SCOPE";
  /** A flag that exists and cannot go — every control below finds this one. */
  const LIVE = "CASTING_V2_SCOPE";
  /*
    A SECOND LIVE FLAG, used as this block's positive control for shape 1.

    ⚠ IT WAS THE RETIRED FLAG'S FORMER PARENT, `CASTING_REFERENCE_LIBRARY_SCOPE`,
    UNTIL #1577 SLICE D5 RETIRED THAT ONE TOO — the hazard every retirement
    guard carries and no other suite does: its controls are flags, and a flag
    can die. A control naming a dead flag does not fail loudly; it quietly stops
    proving the reader works while the file keeps passing. So it moved to a flag
    that is not on the ghost audit's retirement list at all: the auto-scan's,
    which band E marks KEEP because widening it is his.
  */
  const PARENT = "CASTING_FACE_SCAN_SCOPE";

  const SOURCES = serverAndSharedSources(repoRoot);
  const DECLARED = declaredEnvNames(SOURCES);
  const TEXTS = SOURCES.map((file) => ({ file, text: readFileSync(file, "utf8") }));

  it("shape 1 — no module DECLARES it as an env name any more", () => {
    expect(DECLARED, "the control: the reader finds a flag that is really there").toContain(LIVE);
    expect(DECLARED).toContain(PARENT);
    expect(DECLARED).not.toContain(RETIRED);
  });

  it("shape 2 — nothing reads it bare off `process.env`", () => {
    /*
      The second shape, and the one a constant-only arm cannot see: slice 4b
      found a bare read on the refine road that no `…_ENV` declaration would
      have shown.

      ⚠ **ITS CONTROL IS A DIFFERENT FLAG FROM THE OTHER ARMS' AND THAT IS A
      FINDING, NOT A CONVENIENCE** — slice D1's, re-used rather than re-learnt.
      A sibling scope flag is never read bare in production source here, because
      the house style is the declared constant, so a control sharing shape 1's
      flag reddens and proves nothing. Measured across `server` and `shared` on
      2026-10-15: exactly TWO flags in the tree are read bare in production
      source, and this is one of them.
    */
    const BARE_LIVE = "ENABLE_FINAL_MODEL_DELETE";

    const bare = (name: string) => TEXTS
      .filter(({ text }) => text.includes(`process.env.${name}`) || text.includes(`process.env["${name}"]`))
      .map(({ file }) => path.relative(repoRoot, file));

    expect(bare(BARE_LIVE), "the control: a bare read of a live flag is findable")
      .toContain(path.join("server", "routes", "models.ts"));
    expect(bare(RETIRED)).toEqual([]);
  });

  it("shape 3 — it has no production position, and its former parent keeps its own", () => {
    expect(PRODUCTION_FLAG_POSITIONS[LIVE], "the control").toBeDefined();
    expect(PRODUCTION_FLAG_POSITIONS[PARENT], "the parent is live and keeps its row").toBeDefined();
    expect(PRODUCTION_FLAG_POSITIONS[RETIRED]).toBeUndefined();
  });

  it("and the law still NAMES it, retired, rather than quietly dropping it", () => {
    /*
      The opposite failure to the three above, and the one this repository has
      actually paid for: a flag removed from the code AND from the record leaves
      the next shift no way to learn it ever existed, which is the
      path-one/path-three confusion CLAUDE.md's own list has been bitten by. So
      the catalogue and the index must EACH still name it, and say retired.

      ⚠ **"EACH" IS THE WHOLE POINT, AND THIS ARM SURVIVED ITS OWN SABOTAGE
      UNTIL IT SAID SO.** It was written against `lawText(repoRoot)`, which JOINS
      CLAUDE.md and the catalogue — so deleting the index row entirely left the
      arm GREEN, satisfied by the catalogue entry two assertions down. That is
      the sibling-satisfaction shape: a whole-text `toContain` passes on a
      neighbouring surface, and the arm cannot tell "both name it" from "only one
      does". Driven, not reasoned: the index row was removed and 7 of 7 passed.
      So each surface is now read on its own, through its OWN membership reader
      rather than a substring, and the surface is DERIVED from the helper's
      constants instead of named here (working law 4 — the one place a second
      spelling of "CLAUDE.md" would be worst).
    */
    const indexSurfaces = LAW_SURFACES.filter((file) => file !== FLAG_CATALOGUE);
    expect(indexSurfaces, "one law surface is the index and the other is the catalogue")
      .toHaveLength(1);
    const CLAUDE_MD = readFileSync(path.join(repoRoot, indexSurfaces[0]!), "utf8");
    const CATALOGUE = flagCatalogue(repoRoot);

    expect(indexedFlags(CLAUDE_MD), "the control: the index lists live flags").toContain(LIVE);
    expect(cataloguedFlags(CATALOGUE), "the control: the catalogue lists live flags").toContain(LIVE);

    expect(indexedFlags(CLAUDE_MD), "the index must still carry a row for it").toContain(RETIRED);
    expect(cataloguedFlags(CATALOGUE), "and the catalogue must still carry its entry")
      .toContain(RETIRED);

    /* Anchored on the BULLET rather than on the first mention of the name
       anywhere, so a future entry that merely cites this flag in its prose
       cannot move where this slice starts. */
    const bullet = CATALOGUE.indexOf(`- \`${RETIRED}\``);
    expect(bullet, "the catalogue's own top-level entry for it").toBeGreaterThan(-1);
    expect(CATALOGUE.slice(bullet, bullet + 6_000)).toMatch(/RETIRED/);
  });
});
