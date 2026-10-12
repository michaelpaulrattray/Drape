/**
 * THE ATLAS NOW SAYS WHICH CLIENT FILES REACH EACH PROCEDURE — AND THIS IS THE
 * READER THAT DOES NOT SHARE ITS RESOLVER (#2286, 2026-10-11).
 *
 * The fact being derived is the one five documents were restating by hand, each
 * one true the day it was written and each one saying the opposite of the truth
 * by the time somebody read it: *"Built dark: nothing in the client calls these
 * yet"* above the campaign doors, the campaign row in the model-id writer
 * inventory, and three roads on the capability map. #2277 repaired three of
 * them and #2285 the other two, each with a guard holding ONE sentence to the
 * tree; the class fix is to stop the fact being restated, which is what
 * `clientCallers` is for.
 *
 * # TWO INSTRUMENTS THAT DO NOT SHARE A RESOLVER (working law 4)
 *
 *   the generator   walks the AST. It resolves the trpc binding through the
 *                   IMPORT, finds each file's cache handle by its declaration,
 *                   and ends a property chain structurally. Comments are
 *                   invisible to it as a consequence of reading a tree.
 *   this suite      reads TEXT, stripped with the house `withoutComments`, and
 *                   derives the cache-handle names from the same text. Comments
 *                   are excluded as a deliberate step, which is the one place a
 *                   text reader can go wrong and the AST cannot.
 *
 * ⚠ **THE DISAGREEMENT IS NOT HYPOTHETICAL — IT FOUND THE DEFECT THE HOUR BOTH
 * WERE FIRST RUN, AND IN THE SILENCE DIRECTION.** The generator's first shape
 * read its cache handles with `getVariableDeclarations()`, which is TOP-LEVEL
 * ONLY, and a handle is always declared inside a component or a hook. So it
 * answered **0** cache-only procedures where this reader answered **4**, and
 * the four — `models.list`, `moderator.getUserDetails`,
 * `wardrobe.sessions.getRecent`, `wardrobe.sessions.list` — would have shipped
 * in the artifact as *nothing in the client calls these*, which is precisely
 * the reading that says safe to remove. They are the positive control below,
 * and that arm reddens under the old shape.
 *
 * ⚠ **THE REPOSITORY ARMS READ THE COMMITTED ATLAS, like every sibling here. A
 * generator edit alone cannot redden them** — that is
 * `architectureAtlas.test.ts`'s freshness diff. Change the collector and
 * freshness fails; change it AND regenerate, and these fail. Neither is
 * sufficient and neither is redundant.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { checkArchitecture } from "../scripts/check-architecture.mts";
import {
  clientCallersFrom,
  renderExplorer,
  type buildAtlas,
} from "../scripts/generate-architecture.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { sourceBand } from "./testing/sourceBand";
import { clientSources as clientTreeSources } from "./testing/sourceTree";
import { withoutComments } from "./testing/withoutComments";

/* ⚠ THIS SUITE IS IN BOTH DERIVED TIMEOUT POPULATIONS, AND IT WAS THE SECOND
   GUARD THAT SAID SO. It sweeps 437 client sources, which puts it in
   `sourceSweepSuites` (#741) through its own call of `readListedSource`; and it
   builds a real atlas through `scripts/check-architecture.mts`, which spawns
   `git`, which puts it in `childProcessSuites` (#548) — the deriver names that
   hop itself (`via: scripts/check-architecture.mts`). The first guard caught
   the sweep the moment the file became tracked and the second caught the spawn
   on the next preflight. **Either constant lifts a file off the 5 s default and
   both guards accept either**, which `contendedTestTimeouts.test.ts` does for
   the same reason, so one declaration answers both. Both are 30 s. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_SRC = path.join(repoRoot, "client", "src");

type Route = {
  namespace: string;
  name: string;
  file: string;
  clientCallers: string[];
};

const committed = JSON.parse(
  readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
) as { routes: Route[] };

const callablePath = (route: Route) => `${route.namespace}.${route.name}`;

/* ------------------------------------------------------- the second reader */

type ClientSource = { file: string; source: string; code: string };

let swept: ClientSource[] | null = null;

/**
 * Every client source, read once a run: the bytes as written, and the code.
 *
 * ⚠ **THE WALK IS `testing/sourceTree.ts`'S NOW (#2289)** — it was one of
 * twenty private copies, and this file's was the fifth path derivation.
 * `tests: "exclude"` is this reader's own population and the `.d.ts` filter
 * stays at the call site rather than moving into the shared walk: a
 * declaration file is not a caller, and this is the only one of the twenty
 * that had to say so.
 */
function clientSources(): ClientSource[] {
  if (swept) return swept;
  swept = clientTreeSources({ tests: "exclude" })
    .filter((file) => !file.relative.endsWith(".d.ts"))
    .map((file) => ({
      file: `client/src/${file.relative}`,
      source: file.source,
      code: withoutComments(file.source),
    }));
  return swept;
}

const sweptCode = () => clientSources().map(({ code }) => code).join("\n");

/**
 * The reach shapes, in TEXT — the hook and the query cache.
 *
 * The cache-handle names are derived per file rather than listed, for the same
 * reason the generator resolves them: `utils` and `trpcUtils` are both in use
 * today and a third name is one component away. A chain is accepted only when
 * it is followed by a `.` or a `(`, so `trpc.castingV2.listCampaignsExtra`
 * cannot be read as a reach of `castingV2.listCampaigns`.
 */
const cacheHandlesIn = (code: string): string[] =>
  [...code.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*trpc\.use(?:Utils|Context)\s*\(\s*\)/g)]
    .map((hit) => hit[1] as string);

function textCallersOf(procedure: string): string[] {
  return clientSources()
    .filter(({ code }) => {
      /* The vanilla client hangs off a cache handle ONLY (#2349) — so the
         `.client.` prefix is tried on the derived handles and never on `trpc`. */
      const prefixes = [
        "trpc.",
        ...cacheHandlesIn(code).flatMap((handle) => [`${handle}.`, `${handle}.client.`]),
      ];
      return prefixes.some((prefix) =>
        code.includes(`${prefix}${procedure}.`) || code.includes(`${prefix}${procedure}(`)
      );
    })
    .map(({ file }) => file)
    .sort();
}

/* ------------------------------------------------- the population (#2349) */

type Shape = "hook" | "cache" | "vanilla";

/**
 * EVERY chain off a client root in `client/src`, classified — the arm that
 * makes a FOURTH shape redden rather than go quiet.
 *
 * ⚠ **WHY THE COMPARISON ABOVE WAS NOT ENOUGH.** Until #2349 both readers were
 * blind to `utils.client.<path>` — the AST because the chain began with
 * `client` and matched nothing, this reader because it never asked — so they
 * AGREED, on seven call sites neither of them read, and five procedures shipped
 * as having no client caller. Two readers that do not share a resolver can
 * still share a shape list. What closes that is a population that does not
 * start from the shape list: every `<root>.<chain>` in the code, where a root
 * is the `trpc` binding or a derived cache handle, must resolve to a callable
 * procedure through a known shape, or be a named non-procedure member — and
 * whatever is left is printed.
 */
const NON_PROCEDURE_MEMBERS = new Set(["useUtils", "useContext", "createClient", "Provider"]);

function census(callable: Set<string>) {
  const pairs: Record<Shape, Set<string>> = { hook: new Set(), cache: new Set(), vanilla: new Set() };
  const unresolved = new Set<string>();
  for (const { file, code } of clientSources()) {
    for (const root of ["trpc", ...cacheHandlesIn(code)]) {
      const chains = code.matchAll(new RegExp(`(?<![\\w.$])${root}((?:\\s*\\.\\s*\\w+)+)`, "g"));
      for (const hit of chains) {
        let segments = (hit[1] as string).replace(/\s/g, "").slice(1).split(".");
        let shape: Shape = root === "trpc" ? "hook" : "cache";
        if (root !== "trpc" && segments[0] === "client") {
          segments = segments.slice(1);
          shape = "vanilla";
        }
        let procedure: string | null = null;
        for (let take = segments.length; take >= 1; take -= 1) {
          const candidate = segments.slice(0, take).join(".");
          if (callable.has(candidate)) {
            procedure = candidate;
            break;
          }
        }
        if (procedure) {
          pairs[shape].add(`${file} ${procedure}`);
        } else if (!(root === "trpc" && NON_PROCEDURE_MEMBERS.has(segments[0] as string))) {
          unresolved.add(`${file}: ${root}.${segments.join(".")}`);
        }
      }
    }
  }
  return { pairs, unresolved };
}

/** How many (file, procedure) pairs of a shape the Atlas does NOT credit. */
function absentFrom(routes: Route[], pairs: Set<string>): string[] {
  const callersOf = new Map(routes.map((route) => [callablePath(route), route.clientCallers]));
  return [...pairs].filter((pair) => {
    const [file, procedure] = pair.split(" ") as [string, string];
    return !(callersOf.get(procedure) ?? []).includes(file);
  }).sort();
}

/* --------------------------------------------------------------- the arms */

describe("the instrument before its finding (working law 2)", () => {
  it("the sweep read the client, and the artifact carries the field", () => {
    expect(clientSources().length, "the sweep found almost nothing — check the path")
      .toBeGreaterThan(300);
    expect(sweptCode()).toContain("trpc.");
    expect(committed.routes.length).toBeGreaterThan(200);
    for (const route of committed.routes) {
      expect(Array.isArray(route.clientCallers), `${callablePath(route)} has no clientCallers`)
        .toBe(true);
    }
    expect(committed.routes.filter((route) => route.clientCallers.length > 0).length)
      .toBeGreaterThan(100);
  });

  it("the second reader's own cache-handle derivation found the names in use", () => {
    const handles = new Set<string>();
    for (const { code } of clientSources()) {
      for (const hit of code.matchAll(
        /(?:const|let|var)\s+(\w+)\s*=\s*trpc\.use(?:Utils|Context)\s*\(\s*\)/g,
      )) {
        handles.add(hit[1] as string);
      }
    }
    /* If this ever reads empty the cache half of the comparison below is inert
       and every cache-only procedure passes by agreeing on nothing. */
    expect(handles.size, "no cache handle found — the cache half is not being read").toBeGreaterThan(0);
    expect([...handles].sort()).toContain("utils");
  });
});

describe("the artifact agrees with a reader that does not share its resolver", () => {
  it("every procedure's client callers are the ones a text sweep finds", () => {
    const disagreements: string[] = [];
    for (const route of committed.routes) {
      const measured = textCallersOf(callablePath(route));
      const recorded = [...route.clientCallers].sort();
      if (JSON.stringify(measured) !== JSON.stringify(recorded)) {
        disagreements.push(
          `${callablePath(route)}: the Atlas says [${recorded.join(", ") || "nothing"}] and `
          + `a text sweep of client/src finds [${measured.join(", ") || "nothing"}]`,
        );
      }
    }
    expect(
      disagreements,
      "the AST reader and the text reader disagree. Regenerate the Atlas; if they still "
      + "disagree, ONE of them has a blind spot and the silence direction is the dangerous "
      + `one.\n${disagreements.join("\n")}`,
    ).toEqual([]);
  });

  it("CAN FAIL — a procedure whose callers are emptied is caught", () => {
    const real = committed.routes.find((route) => route.clientCallers.length > 0);
    expect(real, "no route has a client caller at all").toBeDefined();
    const measured = textCallersOf(callablePath(real!));
    expect(measured).not.toEqual([]);
    /* The sabotage the arm above would see: the same comparison against a row
       with its callers stripped. */
    expect(JSON.stringify(measured)).not.toBe(JSON.stringify([]));
  });
});

describe("the cache reach is read — the positive control that found the defect", () => {
  /*
    Four procedures on this tree are named ONLY through the query cache
    (`utils.wardrobe.sessions.getRecent.invalidate()`) and never through a hook.
    A reader that sees only hooks prints an empty caller list for all four.

    The four are NOT asserted as an exact set: a hook caller added to any of
    them tomorrow is ordinary work and would redden an arm that had nothing to
    do with the hole. What is asserted is that each one HAS callers, and that
    at least one procedure on the tree is still reached by the cache alone — so
    the arm keeps watching the shape rather than a census.
  */
  const CACHE_ONLY_WHEN_WRITTEN = [
    "models.list",
    "moderator.getUserDetails",
    "wardrobe.sessions.getRecent",
    "wardrobe.sessions.list",
  ];

  it("the four cache-only procedures of 2026-10-11 all carry their callers", () => {
    for (const procedure of CACHE_ONLY_WHEN_WRITTEN) {
      const route = committed.routes.find((candidate) => callablePath(candidate) === procedure);
      expect(route, `${procedure} is no longer a procedure — re-measure the hole`).toBeDefined();
      expect(
        route!.clientCallers,
        `${procedure} reads as having no client caller. It is reached through the query cache `
        + "and not a hook, so this is the cache half of the collector going quiet — the "
        + "reading that says safe to remove.",
      ).not.toEqual([]);
    }
  });

  it("some procedure is still reached by the cache alone, so the half is load-bearing", () => {
    const cacheOnly = committed.routes.filter((route) => {
      if (route.clientCallers.length === 0) return false;
      const hooked = clientSources().some(({ code }) =>
        code.includes(`trpc.${callablePath(route)}.`)
      );
      return !hooked;
    });
    expect(
      cacheOnly.length,
      "nothing on this tree is reached by the query cache alone any more. The collector's "
      + "cache half is then unproven by the tree — keep the fixture arms below as its "
      + "only coverage, and say so here.",
    ).toBeGreaterThan(0);
  });
});

describe("the vanilla client is read, and a fourth shape cannot go quiet (#2349)", () => {
  const callable = new Set(committed.routes.map(callablePath));

  it("the hook shape is fully credited — the positive control, so the census can see", () => {
    const { pairs } = census(callable);
    expect(pairs.hook.size, "the census found no hook call at all — it is blind, not clean")
      .toBeGreaterThan(200);
    expect(absentFrom(committed.routes, pairs.hook)).toEqual([]);
    expect(absentFrom(committed.routes, pairs.cache)).toEqual([]);
  });

  it("every utils.client.<path> call site is credited in the Atlas", () => {
    const { pairs } = census(callable);
    /* Seven on the tree the day this landed, six of them absent from the map
       before it. Not pinned as an exact count — a new download button is
       ordinary work — but never zero, or this arm is watching nothing. */
    expect(pairs.vanilla.size, "no vanilla-client call found — the shape is not being read")
      .toBeGreaterThan(0);
    expect(
      absentFrom(committed.routes, pairs.vanilla),
      "a utils.client.<path> call site the Atlas does not credit — the reading that says "
      + "safe to delete. Regenerate; if it persists, the collector's `.client` hop is gone.",
    ).toEqual([]);
  });

  it("the five procedures reached ONLY through the vanilla client all carry their callers", () => {
    for (const procedure of [
      "account.exportData",
      "moderatorExports.exportAuditLogsCsv",
      "moderatorExports.exportUserCreditHistoryCsv",
      "moderatorExports.exportUserGenerationHistoryCsv",
      "boardOps.addEdge",
    ]) {
      const route = committed.routes.find((candidate) => callablePath(candidate) === procedure);
      expect(route, `${procedure} is no longer a procedure — re-measure the hole`).toBeDefined();
      expect(route!.clientCallers, `${procedure} reads as having no client caller`).not.toEqual([]);
    }
  });

  it("every chain off a client root resolves through a read shape — or is named here", () => {
    /*
      The ONLY declared remainder is #2356: the admin bug-report inbox is
      minted under `bugReports.*` (two routers share the variable name
      `bugReportsRouter`), so the client's `trpc.admin.getBugReports` resolves
      to no id the Atlas has. That is a route-minting defect, not a caller
      shape, and it has its own card. When #2356 lands this arm reddens and
      these lines are deleted with it.
    */
    const KNOWN_UNRESOLVED_2356 = [
      "client/src/pages/AdminBugReports.tsx: trpc.admin.getBugReportCounts.useQuery",
      "client/src/pages/AdminBugReports.tsx: trpc.admin.getBugReports.useQuery",
      "client/src/pages/AdminBugReports.tsx: trpc.admin.updateBugReportStatus.useMutation",
      "client/src/pages/AdminBugReports.tsx: utils.admin.getBugReportCounts.invalidate",
      "client/src/pages/AdminBugReports.tsx: utils.admin.getBugReports.invalidate",
    ];
    const { unresolved } = census(callable);
    expect(
      [...unresolved].sort(),
      "a client chain names no procedure through any shape this Atlas reads. Either a new "
      + "reach shape exists (teach collectClientCallers AND this census) or a route id is wrong.",
    ).toEqual(KNOWN_UNRESOLVED_2356);
  });

  it("CAN FAIL — the census reports a fourth shape it was never taught", () => {
    /* The census over a synthetic file, by swapping the swept set — the arm
       above must not be green because the census cannot produce a row. */
    const saved = swept;
    try {
      swept = [{
        file: "client/src/pages/Fixture.tsx",
        source: "",
        code: "const utils = trpc.useUtils();\nconst v = utils.vanilla.alpha.beta.query();\n"
          + "const w = utils.client.alpha.beta.query();\n",
      }];
      const { pairs, unresolved } = census(new Set(["alpha.beta"]));
      expect([...unresolved]).toEqual(["client/src/pages/Fixture.tsx: utils.vanilla.alpha.beta.query"]);
      expect([...pairs.vanilla]).toEqual(["client/src/pages/Fixture.tsx alpha.beta"]);
    } finally {
      swept = saved;
    }
  });
});

describe("prose is not a call (the control a text reader needs and an AST does not)", () => {
  /*
    `rosterChips.ts`'s docblock names `castingV2.renameCampaign` without calling
    it — #2285's own specimen, kept because it is the only one on the tree. The
    generator cannot be fooled by it; THIS reader can, and would then "agree"
    with a generator that had started reading comments too.
  */
  it("the specimen names the door in prose and not in code", () => {
    const specimen = clientSources()
      .find(({ file }) => file.endsWith("features/castingV2/rosterChips.ts"));
    expect(specimen, "rosterChips.ts was not read — the specimen moved").toBeDefined();
    expect(specimen!.source).toContain("`castingV2.renameCampaign`");
    expect(specimen!.code).not.toContain("castingV2.renameCampaign");
  });

  it("the sweep itself applied the stripper, and the Atlas does not name it", () => {
    /* Reading one file's stripped text would stay green if the sweep stopped
       calling the stripper — measured on PR #2284, where exactly that happened.
       The backticked form only ever occurs in prose. */
    expect(sweptCode()).not.toContain("`castingV2.renameCampaign`");
    expect(textCallersOf("castingV2.renameCampaign"))
      .not.toContain("client/src/features/castingV2/rosterChips.ts");
    const route = committed.routes
      .find((candidate) => callablePath(candidate) === "castingV2.renameCampaign");
    expect(route, "castingV2.renameCampaign is gone — move this control to another door")
      .toBeDefined();
    expect(route!.clientCallers)
      .not.toContain("client/src/features/castingV2/rosterChips.ts");
  });
});

describe("the collector refuses rather than returning a short list", () => {
  /*
    None of the three has an instance on this tree, so a fixture is the only
    thing that can prove it fires — and each is driven beside a POSITIVE control
    on the same fixture shape, because a throw for some other reason proves
    nothing. Every failure mode here lands on *nothing calls this*, which is the
    reading the Atlas is the deletion authority for.
  */
  const TRPC_MODULE = "client/src/lib/trpc.ts";
  const CLIENT = "client/src/pages/Thing.tsx";
  const declaration = 'export const trpc = createTRPCReact<AppRouter>();\n';

  it("the fixture shape works at all — the positive control", () => {
    const callers = clientCallersFrom(
      {
        [TRPC_MODULE]: declaration,
        [CLIENT]: 'import { trpc } from "../lib/trpc";\nconst q = trpc.alpha.beta.useQuery();\n',
      },
      ["alpha.beta"],
    );
    expect(callers.get("alpha.beta")).toEqual([CLIENT]);
  });

  it("CAN FAIL — no createTRPCReact declaration under the client", () => {
    expect(() => clientCallersFrom(
      { [CLIENT]: 'const q = trpc.alpha.beta.useQuery();\n' },
      ["alpha.beta"],
    )).toThrow(/no `createTRPCReact\(\.\.\.\)` declaration/);
  });

  it("CAN FAIL — nothing in the client imports the client", () => {
    expect(() => clientCallersFrom(
      { [TRPC_MODULE]: declaration, [CLIENT]: "export const nothing = 1;\n" },
      ["alpha.beta"],
    )).toThrow(/no file under client\/src imports/);
  });

  it("CAN FAIL — importers exist and name no procedure", () => {
    expect(() => clientCallersFrom(
      {
        [TRPC_MODULE]: declaration,
        [CLIENT]: 'import { trpc } from "../lib/trpc";\nconst u = trpc.useUtils();\n',
      },
      ["alpha.beta"],
    )).toThrow(/not one of them names any of the 1 procedures/);
  });

  it("a nested name is matched longest-first, never by counting segments", () => {
    const callers = clientCallersFrom(
      {
        [TRPC_MODULE]: declaration,
        [CLIENT]: 'import { trpc } from "../lib/trpc";\n'
          + "const a = trpc.wardrobe.garments.list.useQuery();\n"
          + "const b = trpc.boardOps.runGeneration.execute.useMutation();\n",
      },
      ["wardrobe.garments.list", "wardrobe.garments", "boardOps.runGeneration.execute"],
    );
    expect(callers.get("wardrobe.garments.list")).toEqual([CLIENT]);
    expect(callers.get("boardOps.runGeneration.execute")).toEqual([CLIENT]);
    /* The shorter path is a real callable id in this fixture and is NOT
       credited, because the chain resolved to the longer one. */
    expect(callers.get("wardrobe.garments")).toBeUndefined();
  });

  it("a cache handle declared inside a component is read — the defect, at the fixture", () => {
    const callers = clientCallersFrom(
      {
        [TRPC_MODULE]: declaration,
        [CLIENT]: 'import { trpc } from "../lib/trpc";\n'
          + "export function Thing() {\n"
          + "  const handle = trpc.useUtils();\n"
          + "  return handle.alpha.beta.invalidate();\n"
          + "}\n",
      },
      ["alpha.beta"],
    );
    expect(
      callers.get("alpha.beta"),
      "a cache handle declared inside a function is invisible — this is the "
      + "getVariableDeclarations() defect, which is top-level only",
    ).toEqual([CLIENT]);
  });

  it("the vanilla client off a cache handle is read — #2349, at the fixture", () => {
    const callers = clientCallersFrom(
      {
        [TRPC_MODULE]: declaration,
        [CLIENT]: 'import { trpc } from "../lib/trpc";\n'
          + "export function Thing() {\n"
          + "  const utils = trpc.useUtils();\n"
          + "  return () => utils.client.wardrobe.garments.list.query();\n"
          + "}\n",
      },
      ["wardrobe.garments.list", "wardrobe.garments"],
    );
    expect(
      callers.get("wardrobe.garments.list"),
      "utils.client.<path> is not read — the shape that hid five procedures",
    ).toEqual([CLIENT]);
    expect(callers.get("wardrobe.garments")).toBeUndefined();
  });

  it("the `.client` hop is taken off a cache handle only, never off the hook binding", () => {
    const callers = clientCallersFrom(
      {
        [TRPC_MODULE]: declaration,
        [CLIENT]: 'import { trpc } from "../lib/trpc";\n'
          + "const real = trpc.gamma.delta.useQuery();\n"
          + "const invented = trpc.client.alpha.beta.useQuery();\n",
      },
      ["alpha.beta", "gamma.delta"],
    );
    expect(callers.get("gamma.delta")).toEqual([CLIENT]);
    expect(callers.get("alpha.beta")).toBeUndefined();
  });

  it("a procedure named only in a comment is not a caller", () => {
    const callers = clientCallersFrom(
      {
        [TRPC_MODULE]: declaration,
        [CLIENT]: 'import { trpc } from "../lib/trpc";\n'
          + "/** calls trpc.alpha.beta, one day */\n"
          + "const real = trpc.gamma.delta.useQuery();\n",
      },
      ["alpha.beta", "gamma.delta"],
    );
    expect(callers.get("gamma.delta")).toEqual([CLIENT]);
    expect(callers.get("alpha.beta")).toBeUndefined();
  });

  it("a suite under client/src is not the customer's bundle", () => {
    const callers = clientCallersFrom(
      {
        [TRPC_MODULE]: declaration,
        [CLIENT]: 'import { trpc } from "../lib/trpc";\nconst q = trpc.gamma.delta.useQuery();\n',
        "client/src/pages/Thing.test.tsx":
          'import { trpc } from "../lib/trpc";\nconst q = trpc.alpha.beta.useQuery();\n',
      },
      ["alpha.beta", "gamma.delta"],
    );
    expect(callers.get("gamma.delta")).toEqual([CLIENT]);
    expect(callers.get("alpha.beta")).toBeUndefined();
  });
});

describe("the field cannot be hand-edited into the artifact, and is rendered", () => {
  it("CAN FAIL — a route carrying an undeclared field is refused by the schema", () => {
    /* The positive control is an otherwise VALID, real atlas with one field
       added, so the complaint cannot be some other objection to a fixture —
       `architectureAtlas.test.ts`'s fingerprint arm, in the one other place a
       hand edit would look like a measurement. */
    const real = JSON.parse(
      readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
    ) as ReturnType<typeof buildAtlas>;
    const doctored = {
      ...real,
      routes: real.routes.map((route, index) =>
        index === 0 ? { ...route, reachable: true } : route
      ),
    } as ReturnType<typeof buildAtlas>;
    expect(checkArchitecture({ build: () => doctored }).problems.join("\n"))
      .toContain("must NOT have additional properties");
    expect(
      checkArchitecture({ build: () => real }).problems
        .filter((problem) => problem.startsWith("schema:")),
    ).toEqual([]);
  });

  it("the explorer draws it, so it is not collected and rendered nowhere", () => {
    /*
      The credit-cost list was collected into the JSON and shown in no view for
      six months, which is how ten rows stood in for thirty-two.

      ⚠ **THE FIRST SHAPE OF THIS ARM WAS SATISFIED BY ITS OWN PROSE AND SURVIVED
      SABOTAGE GREEN.** It read `expect(html).toContain("client callers")`, and
      the explorer's view list is written INSIDE the returned template literal —
      so the comment the generator carries above that view ships in the HTML too,
      and `"client callers"` was in the output whether the column existed or not.
      Measured: the column deleted from `head`, 18 of 18 still passed. The band
      starts AFTER that comment and `sourceBand` throws when either anchor moves,
      rather than answering with an empty band that would pass both assertions
      (memory `guard-arm-satisfied-by-a-sibling`).
    */
    const view = sourceBand(
      renderExplorer(committed as ReturnType<typeof buildAtlas>),
      "{title:'Routes & access control'",
      "{title:'Express surfaces'",
      "the explorer's routes view",
    );
    expect(view, "the column is gone from the routes view's head").toContain("'client callers'");
    expect(view, "a route with no caller renders as blank rather than saying so")
      .toContain("'no client caller'");
  });
});
