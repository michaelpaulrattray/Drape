import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { declaredEnvNames, serverAndSharedSources } from "../../scripts/lib/declaredEnvNames.mts";
import {
  cataloguedFlags, flagCatalogue, FLAG_CATALOGUE, indexedFlags, LAW_SURFACES,
} from "../../scripts/lib/lawText.mts";
import { PRODUCTION_FLAG_POSITIONS } from "../../scripts/lib/productionFlagPositions.mts";
import { OPEN_KIND_SYSTEM } from "./openLaneKind";
import { KIND_PROPERTY_SYSTEM } from "./openKindProperties";
import { interpretRefinement, refineParseSystemPrompt } from "./refineInterpreter";

/**
 * THE OPEN LANE IS WHAT THE INTERPRETER DOES, AND ITS FLAG IS RETIRED —
 * #1577 slice D1.
 *
 * `CASTING_OPEN_LANE_SCOPE` decided whether an ask nobody catalogued could name
 * its own kind. Off, the prompt carried no last-resort clause, replies keyed
 * onto the nearest closed subject, and the acceptance door was never consulted;
 * on, the clause was in the prompt and the door decided. It reached `all` on
 * production on 2026-09-24 (his Crew reply #205, *"Turn it on for everyone"*)
 * and every flag above it was `all` too. ⚠ **This docblock said the OFF arm — two
 * of the four interpreter prompts — was *asked of nobody*, and one road was still
 * asking it**: the removal path's RULE 3 re-read, the only production caller of
 * `interpretRefinement` that never passed the option at all. Found by the relay on
 * PR #2556, declared and measured on the ghost audit's D1 row, and the measurement
 * says the surviving prompt gives that road the better answer. **His word retiring it,
 * 2026-10-15, verbatim and entire: _"yes approve the plan and switch off the six
 * settings"_** (the ghost audit's row D1).
 *
 * # What this file proves, in three parts
 *
 *  1. **THE BAR.** The two SURVIVING prompts are sha256-identical to what the
 *     flag's ON arm produced before the cut. That is #1495's rule in the shape
 *     #203 slice 2 used, and it replaces what this suite used to hold — a
 *     checked-in fixture of the OFF prompt, which died with the off road.
 *  2. **The clause and the door, now unconditional.** The same arms as before,
 *     with the flag's half of each REMOVED rather than inverted.
 *  3. **It stays retired.** The resurrection shapes, on `framingTrimRetirement`
 *     and slice 4b's pattern.
 *
 * # ⚠ THE BAR'S HASHES ARE RECORDED, NOT REGENERATED
 *
 * They were read from `origin/main` at `9622e69e` BEFORE the cut, through the
 * real function, and pasted here. **A control that re-records itself marks its
 * own homework** — which is what the retired fixture's own docblock said, and the
 * reason that fixture was never regenerated either. If a prompt change is ever
 * intended, these two lines are the ones to edit deliberately.
 *
 * # ⚠ IT DOES NOT ASSERT THE FLAG NAME IS ABSENT FROM THE TREE
 *
 * Deliberate, and the same floor slice 4b stated: the retirement record and the
 * notes left at the cut sites both NAME the variable, because the next reader has
 * to learn what died and why. So the arms below read the RESURRECTION SHAPES —
 * the three ways a flag gets a reader in this repository — and a fourth shape
 * would be invisible here.
 *
 * Every retirement arm is an ABSENCE, and an absence is green against a reader
 * that finds nothing at all. So each reader is first made to find a flag that
 * genuinely exists, in the same call, in the same shape. If a control reddens, no
 * verdict in that part means anything.
 *
 * The interpreter arms are SCRIPTED, for law 3's reason: the behaviour that
 * matters is a reply naming an unknown key, and a real model will not produce one
 * on demand.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** An engine that answers from a script and records what it was asked. */
function scripted(replies: string[]): TextEngine & { seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  let index = 0;
  return {
    id: "scripted",
    seen,
    async complete(request: TextRequest) {
      seen.push(request);
      const reply = replies[Math.min(index, replies.length - 1)]!;
      index += 1;
      return { text: reply, provenance: { provider: "openrouter" as const, model: "scripted" }, latencyMs: 0 };
    },
  } as TextEngine & { seen: TextRequest[] };
}

const FACE = {
  currentEyeColour: "brown",
  currentEyeShape: "almond",
  currentHairColour: "dark brown",
  currentHairStyle: "long, worn down",
  currentHairTexture: "curly",
  currentMakeup: null,
};

/** His own ask, and the only unfiled instruction in the production corpus. */
const HIS = "give her vampire fangs";
/** The reply the clause exists to make possible: an unknown subject key. */
const NAMES_A_NEW_KIND = JSON.stringify({ intent: "edit", free: { fangs: "vampire fangs" } });
/** What the normalizer answers when asked what the THING is. */
const NORMALIZED = JSON.stringify({ kind: "fangs" });

describe("THE BAR — the surviving prompts did not change by a character (#1495)", () => {
  /*
    Read at `origin/main` 9622e69e, through `refineParseSystemPrompt(mode,
    { openLane: true })`, before the flag came out. The lengths ride along
    because they make a failure legible at a glance — but the HASH is the bar,
    and that distinction was driven rather than assumed: sabotaging one
    lowercase character moved both hashes and left both lengths unchanged.
  */
  const BEFORE = {
    classify: { sha: "5166fdbcbef357f66191aae5029ffd60d3da33339d5c7a06d78909000f794756", len: 12_990 },
    edit: { sha: "d938853edbc22068b696eab704ad0ae80849457583b3a3a58e103b7420e9cb57", len: 10_547 },
  } as const;

  const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

  for (const mode of ["classify", "edit"] as const) {
    it(`${mode} is byte-identical to the ON prompt that shipped`, () => {
      const prompt = refineParseSystemPrompt(mode === "classify" ? undefined : mode);
      expect(prompt.length, "length (the hash is the bar; this just reads better)").toBe(BEFORE[mode].len);
      expect(sha(prompt)).toBe(BEFORE[mode].sha);
    });
  }

  it("CONTROL — the reader is looking at two different, substantial prompts", () => {
    /*
      Without this, both arms above would pass against a function returning the
      same string twice, or an empty one, so long as the recorded hashes happened
      to be that string's. The modes differ by the removal vocabulary (D-163 rule
      3), so they must not be equal.
    */
    const classify = refineParseSystemPrompt();
    const edit = refineParseSystemPrompt("edit");
    expect(classify.length).toBeGreaterThan(5_000);
    expect(edit.length).toBeGreaterThan(5_000);
    expect(classify).not.toBe(edit);
    expect(BEFORE.classify.sha).not.toBe(BEFORE.edit.sha);
  });
});

describe("the clause is in the prompt, unconditionally", () => {
  const prompt = refineParseSystemPrompt();

  it("carries the last resort", () => {
    expect(prompt).toContain("WHEN NO SUBJECT ABOVE IS ABOUT IT");
    expect(prompt).toContain("THE KEY IS THE THING");
  });

  it("keeps the lane a FALLBACK rather than a peer — the sentence the design turns on", () => {
    expect(prompt).toContain("ALWAYS");
    expect(prompt).toContain("wins and stays the answer");
  });

  it("routes fantastical anatomy to the last resort and NOT to the stage wall", () => {
    /*
      The half of the clause that was never additive, and the reason the
      stage-wall version of those four lines went WITH the flag rather than being
      left as a branch nothing takes: the wall check at `runOnce` sits ABOVE the
      acceptance door, so a reply claiming the stage wall returns before the open
      lane is ever consulted. Restoring it would make the last resort inert for
      exactly the population the lane exists for.
    */
    expect(prompt).toContain("They take the LAST RESORT at the end of the free-lane rules");
    expect(prompt).not.toContain('Reply {"wall": "stage", "asked": "<the thing, in their words>"}');
  });

  it("widens what may be NAMED and nothing else — wall (b) is restated, not relaxed", () => {
    expect(prompt).toContain("garments, headwear, the backdrop, props and the scene are the stage wall");
    /* The stage wall's own line is untouched by the clause. */
    expect(prompt).toContain("stage: garments, headwear, the backdrop, props, the scene");
  });
});

describe("the acceptance door runs, unconditionally", () => {
  it("files the open kind", async () => {
    const engine = scripted([NAMES_A_NEW_KIND, NORMALIZED]);
    const parse = await interpretRefinement({ instruction: HIS, engine, ...FACE });
    expect(parse.ok).toBe(true);
    if (!parse.ok || !("delta" in parse)) throw new Error("expected a delta");
    expect(parse.delta.open?.fangs).toEqual({ noun: "fangs", words: "vampire fangs" });
    /*
      THREE CALLS, AND THE THIRD IS 5b's PROPERTY READ — the parse, the
      normalizer, and *what is this kind* (`OPEN_KIND_PROPERTIES_DESIGN` §2).
      Named rather than counted, because a number alone would not notice a third
      call arriving from somewhere else.

      **This is the NO-STORE count.** With no database the property cache can
      never hit, so every ask re-buys the read; in production the row is written
      on the first ask for a noun and every later one is a table read, which is
      two calls. The cache itself is asserted at its own seam in
      `openKindProperties.test.ts`, by counting model calls rather than by
      inspecting a return value.
    */
    expect(engine.seen).toHaveLength(3);
    expect(engine.seen[1]!.system).toBe(OPEN_KIND_SYSTEM);
    expect(engine.seen[2]!.system).toBe(KIND_PROPERTY_SYSTEM);
  });

  it("keeps the whole-delta defect closed — the facets beside an open kind survive", async () => {
    /*
      The whole-delta null was the standing defect: one unknown noun discarded
      every facet in the same instruction. Step 5a closed it at the live
      boundary, and nothing here may reopen it — the mark she also asked for
      still files beside the kind.
    */
    const both = JSON.stringify({
      intent: "edit",
      free: { fangs: "vampire fangs", marks: ["a small scar on her cheek"] },
    });
    const engine = scripted([both, NORMALIZED]);
    const parse = await interpretRefinement({
      instruction: "give her vampire fangs and a small scar on her cheek",
      engine,
      ...FACE,
    });
    expect(parse.ok).toBe(true);
    if (!parse.ok || !("delta" in parse)) throw new Error("expected a delta");
    expect(parse.delta.free?.marks).toEqual(["a small scar on her cheek"]);
    expect(parse.delta.open?.fangs).toEqual({ noun: "fangs", words: "vampire fangs" });
  });

  it("sends the clause ON THE WIRE", async () => {
    /* Assert at the wire: a contract about what gets SENT is proven on the
       outgoing request, never on a constant near it (invariant 5). */
    const engine = scripted([NAMES_A_NEW_KIND, NORMALIZED]);
    await interpretRefinement({ instruction: HIS, engine, ...FACE });
    expect(engine.seen[0]!.system).toContain("WHEN NO SUBJECT ABOVE IS ABOUT IT");
  });
});

describe("and it stays retired (#1577 slice D1)", () => {
  /** The retired flag. */
  const RETIRED = "CASTING_OPEN_LANE_SCOPE";
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
      FINDING, NOT A CONVENIENCE.** `CASTING_V2_SCOPE` was the control here
      first and it REDDENED: in production source that flag is never read bare
      — it is reached through `CASTING_V2_SCOPE_ENV`, and its 44 bare reads are
      every one of them in a `.test.ts` file, which this population excludes by
      construction (`sourceFiles` skips them). Measured across `server` and
      `shared`: exactly TWO flags in the whole tree are read bare in production
      source, because the house style is the declared constant. So a control
      that shares shape 1's flag cannot prove this reader works, and a reader
      that cannot be proven to work makes the absence below worthless.
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

      ⚠ **"EACH" IS THE WHOLE POINT.** This arm was written against
      `lawText(repoRoot)`, which JOINS CLAUDE.md and the catalogue, so deleting
      the index row entirely left it GREEN, satisfied by the catalogue entry
      (foreman-20261016-0240's finding on this PR, driven on slice D2's copy:
      the row removed, 7 of 7 passed). Each surface is now read on its own,
      through its own membership reader, with the index surface DERIVED from the
      helper's constants rather than named here — slice D2's repaired shape.
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

    /* ⚠ THE PROPERTY IS THE ENTRY'S OPENING, NOT A CHARACTER COUNT — #2738.
       This arm asked that /RETIRED/ appear within 6,000 characters of the
       bullet, which `CASTING_SIDE_PHRASING_SCOPE` proved cannot express the
       property: its entry was shorter than the window, so a retirement recorded
       anywhere inside it passed while the entry opened as a live flag, for
       twelve days. THIS entry is 6,191 characters — already longer than the
       window it was being measured against, so the arm was passing for the
       right reason (it opens with its retirement) and the window was doing none
       of the work. The opening shape is the property, and it is what the
       guarded siblings assert.

       Line-based rather than offset-based, for the same reason the old arm
       anchored on the bullet: one catalogue entry is one line, so a neighbouring
       entry that merely cites this flag in its prose cannot move where this
       slice starts. The flag name is written out in the regex rather than
       interpolated from RETIRED, the siblings' own choice — a pattern built
       from the constant it is checking can be weakened by editing the
       constant. */
    const entry = CATALOGUE.split("\n").find((line) => line.startsWith(`- \`${RETIRED}\``));
    expect(entry, "the catalogue's own top-level entry for it").toBeTruthy();
    expect(entry, "and it opens with the retirement, not with what the flag used to do")
      .toMatch(/^- `CASTING_OPEN_LANE_SCOPE` — ✅ \*\*RETIRED/);
  });
});
