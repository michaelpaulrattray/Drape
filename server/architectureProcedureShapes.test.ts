/**
 * THE ATLAS COUNTED SEVEN PROCEDURES THAT DO NOT EXIST AND MISSED FOURTEEN THAT
 * DO — AND CALLED EVERY BOARDS WRITE A `query`.
 *
 * `collectProcedures` walks variable declarations initialised to `router(...)`
 * and treats every property of that object literal as one procedure. Seven
 * properties in `server/routes/boardOps.ts` are not procedures — they are inline
 * nested routers:
 *
 *   applyModelEdit: router({
 *     plan:    protectedProcedure.input(z.object({ … })).query(…),        // open
 *     execute: protectedProcedure.input(z.object({ … }).strict()).mutation(…),
 *   }),
 *
 * The property's text contains `.mutation(`, so it was collected as ONE
 * procedure whose `type`, `auth`, input state and rate limiting were read off
 * whichever child appeared FIRST in the source. `plan` is written above
 * `execute`, so the Atlas recorded — quoted from the committed JSON on
 * 2026-08-23, before the fix:
 *
 *   route:boardOps.applyModelEdit | query | protected | strict: True
 *   route:boardOps.runGeneration  | query | protected | strict: True
 *   … all seven, all `query`
 *
 * Every one of them holds a `mutation`. **The boards write surface was reported
 * read-only by the document CLAUDE.md calls the deletion authority and the
 * mechanical verifier for access-control invariant 5.** The `strict: True` was
 * `execute`'s `.strict()` covering for `plan`, whose input object is open — an
 * attribution across siblings rather than a reading.
 *
 * The real ids were never hypothetical. The canvas calls one today:
 * `client/src/features/boards/canvas/useCastActions.ts` —
 * `trpc.boardOps.runGeneration.execute.useMutation({ … })`.
 *
 * # THE SECOND DEFECT IN THE SAME FIELD
 *
 * `strictInput` was `/\.strict\(\s*\)/.test(chainText)` — does the WORD appear
 * anywhere in the procedure — which is a different question from *is this
 * procedure's input object closed*. Both directions of that mistake are here as
 * fixtures, because the measured population had one of each:
 *
 *   said OPEN, was closed   `.input(operationIdInput)`, where that schema is
 *                           `z.object({ … }).strict()` one file away. FIVE
 *                           procedures were flagged that way.
 *   said CLOSED, was open   the nested-router sibling above; and structurally,
 *                           `.strict()` on a NESTED field of an open object.
 *
 * # AND THE THIRD: A MESSAGE THAT WAS FALSE OF 32 OF ITS SUBJECTS
 *
 * `false` was answering two questions at once. THIRTY-TWO of the 169
 * `non-strict-input` findings were procedures with no `.input()` AT ALL, being
 * told *"unknown fields are silently dropped rather than rejected"* — tRPC never
 * hands a handler an input it has no parser for, so nothing is dropped and there
 * is nothing to close. `billing.getStatus`, `billing.cancelSubscription`,
 * `credits.getBalance`, `profile.get` and 28 others. The field is three states
 * now, and only `open` is a finding.
 *
 * # WHY FIXTURES AND NOT THE REPOSITORY
 *
 * The sibling arms (`architectureExpressSurfaces.test.ts`,
 * `architecturePublicEndpoints.test.ts`) exist because a checker driven only
 * over the tree it already runs on cannot show its own blind spots: it reports a
 * complete list and *"263 procedures"* reads exactly like *"270"* to anyone who
 * was not counting. So the extractor is driven over sources written to contain
 * the shape, through `proceduresFrom` — the real code path, not a copy of it.
 *
 * The repository arm is kept as well, and it is deliberately the WEAKER of the
 * two: it pins the seven live specimens by id, so deleting the recursion is
 * caught by the fixtures AND by the tree at once.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { proceduresFrom } from "../scripts/generate-architecture.mts";

/** A router source in the house shape, so the fixtures read like the tree. */
function routerSource(body: string): string {
  return `
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./trpc";

const fixtureRouter = router({
${body}
});

export const appRouter = router({ fixture: fixtureRouter });
`;
}

describe("the extractor's own population, proven able to fail", () => {
  it("reads a bare procedure — the shape that always worked", () => {
    /* POSITIVE CONTROL. If this ever goes red the fixture harness is broken and
       every verdict below is about the harness rather than about the code. */
    const procedures = proceduresFrom(
      routerSource(`  getThing: protectedProcedure.input(z.object({ id: z.number() })).query(async () => null),`),
    );

    expect(procedures).toHaveLength(1);
    expect(procedures[0]).toMatchObject({
      id: "route:fixture.getThing",
      type: "query",
      auth: "protected",
      input: "open",
    });
  });

  it("splits an inline nested router into its children, with each child's own type", () => {
    /* THE SPECIMEN, reduced. Before the fix this returned ONE procedure named
       `doThing`, typed `query`, input `strict`. */
    const procedures = proceduresFrom(
      routerSource(`  doThing: router({
    plan: protectedProcedure.input(z.object({ id: z.number() })).query(async () => null),
    execute: protectedProcedure.input(z.object({ id: z.number() }).strict()).mutation(async () => null),
  }),`),
    );

    expect(
      procedures.map((p) => p.id),
      "an inline nested router must yield its children, not itself — this is the shape that hid seven boards mutations",
    ).toEqual(["route:fixture.doThing.execute", "route:fixture.doThing.plan"]);

    const byName = new Map(procedures.map((p) => [p.name, p]));
    expect(byName.get("doThing.plan")).toMatchObject({ type: "query", input: "open" });
    expect(byName.get("doThing.execute")).toMatchObject({ type: "mutation", input: "strict" });
  });

  it("does not let one child's .strict() speak for its sibling", () => {
    /* NEGATIVE CONTROL for the attribution, stated on its own so that a
       recursion which splits the ids but still reads the parent's text would
       fail HERE rather than pass everything. */
    const procedures = proceduresFrom(
      routerSource(`  doThing: router({
    plan: protectedProcedure.input(z.object({ id: z.number() })).query(async () => null),
    execute: protectedProcedure.input(z.object({ id: z.number() }).strict()).mutation(async () => null),
  }),`),
    );

    expect(procedures.filter((p) => p.input === "strict").map((p) => p.id)).toEqual([
      "route:fixture.doThing.execute",
    ]);
  });

  it("does not let one child's auth class speak for its sibling", () => {
    /* The direction with teeth. All fourteen live children are protected today,
       so the tree cannot exercise this — and a `publicProcedure` reaching the
       Atlas wearing `protected` is invariant 5's enumeration going blind. */
    const procedures = proceduresFrom(
      routerSource(`  doThing: router({
    plan: protectedProcedure.input(z.object({ id: z.number() })).query(async () => null),
    open: publicProcedure.input(z.object({ id: z.number() })).query(async () => null),
  }),`),
    );

    expect(procedures.map((p) => [p.name, p.auth])).toEqual([
      ["doThing.open", "public"],
      ["doThing.plan", "protected"],
    ]);
  });

  describe("the input state — three answers, because the question has three", () => {
    const read = (input: string): string =>
      routerSource(`  thing: protectedProcedure${input}.query(async () => null),`);

    it("no .input() at all is `none`, not `open`", () => {
      /* The 32. `none` raises no finding: there is no schema to close. */
      expect(proceduresFrom(read(""))[0]!.input).toBe("none");
    });

    it("an object without .strict() is `open`", () => {
      expect(proceduresFrom(read(".input(z.object({ id: z.number() }))"))[0]!.input).toBe("open");
    });

    it("an object with .strict() is `strict`", () => {
      expect(proceduresFrom(read(".input(z.object({ id: z.number() }).strict())"))[0]!.input).toBe(
        "strict",
      );
    });

    it("`.strict().optional()` is still strict — the word need not be last", () => {
      /* My own first reading of this population called `.strict().optional()`
         "inner-only strict" and nearly filed six Atlas defects that do not
         exist. Six live procedures are written this way. */
      expect(
        proceduresFrom(read(".input(z.object({ id: z.number() }).strict().optional())"))[0]!.input,
      ).toBe("strict");
    });

    it("`.strict()` on a NESTED field does not close the outer object", () => {
      /* NEGATIVE CONTROL for the substring test, in the direction that hides a
         gap. The outer object still accepts unknown keys. */
      expect(
        proceduresFrom(read(".input(z.object({ inner: z.object({}).strict() }))"))[0]!.input,
      ).toBe("open");
    });

    it("a NAMED schema is resolved to its declaration rather than read as open", () => {
      /* The five false positives: `operationIdInput`, `modelCreateInputSchema`,
         `iterateInputSchema`. */
      const source = `
import { z } from "zod";
import { router, protectedProcedure } from "./trpc";

const namedInput = z.object({ operationId: z.string().uuid() }).strict();

const fixtureRouter = router({
  thing: protectedProcedure.input(namedInput).query(async () => null),
});

export const appRouter = router({ fixture: fixtureRouter });
`;
      expect(proceduresFrom(source)[0]!.input).toBe("strict");
    });

    it("an unresolvable named schema reads as open — the safe direction", () => {
      /* A false alarm is survivable; a missed gap in a security measurement is
         not. Stated as an arm so the fallback is a decision, not an accident. */
      const source = `
import { z } from "zod";
import { router, protectedProcedure } from "./trpc";
import { schemaFromSomewhereElse } from "./elsewhere";

const fixtureRouter = router({
  thing: protectedProcedure.input(schemaFromSomewhereElse).query(async () => null),
});

export const appRouter = router({ fixture: fixtureRouter });
`;
      expect(proceduresFrom(source)[0]!.input).toBe("open");
    });
  });
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const atlas = JSON.parse(
  readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
) as {
  routes: { id: string; auth: string; input: "strict" | "open" | "none" }[];
  findings: { kind: string; subject: string }[];
};

describe("the finding rule, over the committed Atlas", () => {
  /* The field is three states; the FINDING is raised for exactly one of them.
     That rule lives in `computeFindings`, which the fixtures above cannot reach,
     so it is asserted where its output is readable — over the artifact, in both
     directions, with the population proven non-empty first. */
  const flagged = new Set(
    atlas.findings.filter((f) => f.kind === "non-strict-input").map((f) => f.subject),
  );

  it("has all three input states present, so neither direction below is vacuous", () => {
    /* `absence-only-expect-passes-on-nothing`: an empty population reads exactly
       like coverage. */
    for (const state of ["strict", "open", "none"] as const) {
      expect(atlas.routes.filter((r) => r.input === state).length, state).toBeGreaterThan(0);
    }
  });

  it("flags every non-public `open` input and nothing else", () => {
    const expected = atlas.routes
      .filter((r) => r.input === "open" && r.auth !== "public")
      .map((r) => r.id)
      .sort();

    expect(expected.length).toBeGreaterThan(0);
    expect([...flagged].sort()).toEqual(expected);
  });

  it("never tells a procedure with no input schema that its fields are dropped", () => {
    /* The 32. Kept as its own arm because it is the sentence that was false, and
       it would otherwise be an implication of the arm above rather than a claim. */
    const none = atlas.routes.filter((r) => r.input === "none");
    expect(none.length).toBeGreaterThan(0);
    expect(none.filter((r) => flagged.has(r.id))).toEqual([]);
  });
});

describe("two instruments, one population", () => {
  /**
   * THE ATLAS'S EXTRACTOR HAS ALWAYS BEEN THE ONLY THING COUNTING THIS
   * PRODUCT'S tRPC SURFACE, WHICH IS WHY IT COULD BE WRONG BY FOURTEEN FOR AS
   * LONG AS IT LIKED.
   *
   * `architecturePublicEndpoints.test.ts` has this property for the PUBLIC
   * procedures — it re-derives `key: publicProcedure` straight from the router
   * sources and compares the multiset with the Atlas's. That arm was green
   * throughout the nested-router defect, correctly: all fourteen hidden
   * children are `protectedProcedure`, so the public population really did
   * agree. **The blind spot was one auth class away from being invisible to the
   * only cross-check that existed.**
   *
   * So the same comparison is made over EVERY builder. Run against the Atlas as
   * it stood before the fix — a real artifact, not a fixture — this reports
   * exactly the defect:
   *
   *   source-declared procedure keys: 270
   *   atlas routes                  : 263
   *   in SOURCE but NOT in the Atlas: 14      execute x7, plan x7
   *   in ATLAS but not in source    : 7       applyModelEdit, createNode, …
   *
   * ⚠ WHEN THIS ARM IS LIVE, AND WHEN ITS SIBLING IS. This one reads the
   * COMMITTED Atlas, so a generator edit alone cannot redden it — that is
   * `architectureAtlas.test.ts`'s job, which regenerates and diffs. The pair is
   * what closes the loop: change the extractor and the freshness arm fails;
   * change it and regenerate, and this one fails. Neither is sufficient and
   * neither is redundant.
   *
   * A MULTISET, not a set: `validate` is declared twice, `plan` and `execute`
   * seven times each, and a set would swallow all but one of them — which is
   * the whole failure mode this file is about.
   */
  const BUILDERS = [
    "publicProcedure",
    "onboardingProcedure",
    "protectedProcedure",
    "adminProcedure",
    "moderatorProcedure",
  ];
  const declaration = new RegExp(String.raw`(\w+):\s*(${BUILDERS.join("|")})\b`, "g");

  function sourceProcedureKeys(): string[] {
    const keys: string[] = [];
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
        for (const hit of readFileSync(full, "utf8").matchAll(declaration)) keys.push(hit[1]!);
      }
    };
    walk(path.join(repoRoot, "server"));
    return keys.sort();
  }

  it("the Atlas holds exactly the procedures the router sources declare", () => {
    const fromSource = sourceProcedureKeys();
    const fromAtlas = atlas.routes.map((r) => r.id.slice(r.id.lastIndexOf(".") + 1)).sort();

    /* Population first: an empty read from either side would agree with an
       empty read from the other, and that reads exactly like coverage. */
    expect(fromSource.length).toBeGreaterThan(200);
    expect(fromAtlas.length).toBeGreaterThan(200);

    expect(
      fromAtlas,
      "the Atlas's routes and the procedure declarations under server/ describe different populations — one instrument is seeing a shape the other is not, which is how fourteen boards procedures stayed invisible",
    ).toEqual(fromSource);
  });
});

describe("the tree's own nested routers", () => {
  /* Deliberately the weaker arm — it pins the live specimens, so a regression is
     caught by the fixtures above AND here. Reading the Atlas rather than the
     source would make this a mirror of the generator's output (working law 4);
     it re-runs the extractor over `boardOps.ts` instead. */
  it("boardOps exposes fourteen procedures, seven of them mutations", () => {
    const text = readFileSync(path.join(repoRoot, "server/routes/boardOps.ts"), "utf8");
    const nested = [...text.matchAll(/^ {2}(\w+): router\(\{/gm)].map((m) => m[1]!);

    expect(
      nested.length,
      "boardOps.ts no longer declares inline nested routers — if they were refactored away, re-point this arm rather than deleting it; the fixtures above are what keep the extractor honest",
    ).toBe(7);

    /* `boardOps.ts` declares no root router, and `resolveNamespaces` requires
       one — so the fixture wraps the real file's own router variable. The
       procedure bodies are the tree's, unedited. */
    const procedures = proceduresFrom(
      `${text}
export const appRouter = router({ boardOps: boardOpsRouter });
`,
    );
    const children = procedures.filter((p) => nested.some((n) => p.name.startsWith(`${n}.`)));

    expect(children).toHaveLength(14);
    expect(children.filter((p) => p.type === "mutation")).toHaveLength(7);
    expect(
      children.filter((p) => p.type === "mutation").map((p) => p.name).sort(),
      "every boards write operation is an `execute` under a nested router — all seven read as `query` until 2026-08-23",
    ).toEqual([
      "applyModelEdit.execute",
      "createNode.execute",
      "deleteNode.execute",
      "deleteNodes.execute",
      "popOutView.execute",
      "runGeneration.execute",
      "runVariations.execute",
    ]);
  });
});
