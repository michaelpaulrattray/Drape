import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT, repoPath, sourcesUnder } from "./testing/sourceTree";
import { withoutComments } from "./testing/withoutComments";

/**
 * THE ATLAS'S RATE-LIMIT COLUMN, READ A SECOND TIME BY A READER THAT SHARES NO
 * RESOLVER WITH THE GENERATOR (#2704, Warden run 9 §D).
 *
 * ⚠ **THE COLUMN SAID SEVENTEEN PROCEDURES HAD NO RATE LIMIT WHEN THEY DID,
 * AND NOTHING COULD EVER HAVE GONE RED ABOUT IT.** The collector was
 * `/rateLimit|RATE_LIMITS|checkRateLimit/` over the procedure's own text, and
 * fifteen route files call the enforcer through a locally named wrapper —
 * `limit`, `rl`, `enforce`, `enforceRateLimit`, `rateCheck`,
 * `throwIfRateLimited`, `enforceReferenceRateLimit` — none of which contains
 * any of the three spellings, case included. `creationCheck.lookup` is on
 * CLAUDE.md's invariant-5 public allowlist and the map said it had no limit.
 *
 * ⚠ **AND THE FIELD WAS READ BY NOTHING** — grepped across `scripts`,
 * `server`, `client`, `shared`, its only mentions were its own type
 * declaration, the collector line, the HTML table column and the JSON schema.
 * *A field recorded on every row and asserted nowhere is a field nobody has*,
 * so it had been wrong for as long as those wrappers had existed. **This suite
 * is the half of the repair that stops it rotting again**; the collector fix
 * alone would have left the same silence behind a better number.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS READER DOES DIFFERENTLY, BECAUSE AGREEMENT ONLY MEANS SOMETHING
 * IF THE TWO ROADS ARE DIFFERENT.
 *
 * The generator walks the TypeScript AST: it resolves import specifiers
 * through the compiler, grows a per-file enforcer set to a fixed point across
 * the import graph, and asks `getDescendantsOfKind(CallExpression)` whether a
 * handler calls one. This reader never loads the compiler. It resolves module
 * specifiers against the FILE SYSTEM, derives enforcer names with regexes over
 * comment-stripped text, and isolates a procedure's handler by BRACE
 * MATCHING — the same split `architectureAtlas.test.ts` uses for the edge
 * graph, and for the same stated reason: *neither inherits the other's blind
 * spot.*
 *
 * ⚠ **THE #2349 LESSON IS LOAD-BEARING HERE: TWO READERS THAT DO NOT SHARE A
 * RESOLVER CAN STILL SHARE A SHAPE LIST**, and then their agreement proves
 * nothing about the shape neither of them reads. So the last describe below
 * derives a POPULATION — every enforcer call site under `server/` — rather
 * than comparing two answers to the same question, and the destructured
 * dynamic import (`const { checkRateLimit } = await import("…")`, the shape
 * that cost the un-wiring differ 36 wired symbols in #108) is asked for by
 * name, because it is the shape the generator deliberately does not read.
 */

const ATLAS = JSON.parse(
  readFileSync(repoPath("docs", "architecture", "drape-architecture.json"), "utf8"),
) as { routes: Array<{ id: string; namespace: string; name: string; rateLimited: boolean; file: string }> };

/**
 * The three exports of `server/security/rateLimit.ts` whose call DECIDES and
 * REFUSES. Held against that module's real exports below, so a new enforcer
 * cannot arrive unclassified.
 */
const ENFORCERS = ["checkRateLimit", "checkUserRateLimit", "enforcePublicRateLimit"] as const;

/**
 * Deliberately NOT enforcers, each for its own reason. Kept beside the list it
 * is the complement of, so the population arm can prove the two together are
 * the module's whole export surface.
 */
const NOT_ENFORCERS: Record<string, string> = {
  rateLimitError: "formats a MESSAGE; it is called beside a real check, not instead of one",
  releaseRateLimitSlot: "gives a slot BACK",
  getClientIp: "reads an address",
  configureTrustedProxy: "boot wiring",
  RateLimitConfig: "a type",
  RATE_LIMITS: "the config table — referencing it is not calling a limiter",
  recordGlobalFailedLogin: "the login-attack detector: it alerts and never refuses",
  markGlobalAttackAlertSent: "the login-attack detector: it alerts and never refuses",
  shouldSendGlobalAttackAlert: "the login-attack detector: it alerts and never refuses",
};

/* ------------------------------------------------------- the second reader */

type ServerSource = { relative: string; code: string; raw: string };

let swept: Map<string, ServerSource> | null = null;

function serverSources(): Map<string, ServerSource> {
  if (swept) return swept;
  swept = new Map();
  for (const file of sourcesUnder(repoPath("server"), { tests: "exclude" })) {
    const relative = `server/${file.relative}`.replaceAll("\\", "/");
    swept.set(relative, { relative, raw: file.source, code: withoutComments(file.source) });
  }
  return swept;
}

/** A relative specifier resolved against the FILE SYSTEM, never the compiler. */
function resolveSpecifier(importer: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = path
    .normalize(path.join(path.dirname(importer), specifier))
    .replaceAll("\\", "/");
  for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
    if (serverSources().has(candidate)) return candidate;
  }
  return null;
}

const IMPORT = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
const NAMESPACE_IMPORT = /import\s*\*\s*as\s+(\w+)\s+from\s*["']([^"']+)["']/g;

/** `foo`, `foo as bar` → the local name. */
const localNameOf = (specifier: string): string => {
  const parts = specifier.trim().split(/\s+as\s+/);
  return (parts[parts.length - 1] ?? "").trim();
};

/**
 * Every name in one file whose call enforces, resolved transitively.
 *
 * Same ANSWER as the generator's `enforcingNamesIn`, reached by a different
 * road: regexes over comment-stripped text and a file-system resolve.
 */
const resolvedNames = new Map<string, Set<string>>();

function enforcingNamesIn(relative: string, visiting: Set<string>): Set<string> {
  const done = resolvedNames.get(relative);
  if (done) return done;
  if (visiting.has(relative)) return new Set<string>();
  visiting.add(relative);

  const source = serverSources().get(relative);
  const names = new Set<string>();
  if (!source) {
    visiting.delete(relative);
    return names;
  }

  for (const hit of source.raw.matchAll(NAMESPACE_IMPORT)) {
    if (/rateLimit/.test(hit[2] as string)) for (const name of ENFORCERS) names.add(name);
  }
  for (const hit of source.raw.matchAll(IMPORT)) {
    const target = resolveSpecifier(relative, hit[2] as string);
    const reached = target ? enforcingNamesIn(target, visiting) : null;
    for (const piece of (hit[1] as string).split(",")) {
      const imported = piece.trim().split(/\s+as\s+/)[0]?.trim();
      if (!imported) continue;
      if ((ENFORCERS as readonly string[]).includes(imported) || reached?.has(imported)) {
        names.add(localNameOf(piece));
      }
    }
  }

  if (names.size > 0) {
    /* Module-level `function f(` and `const f = (…) =>` / `async (…) =>`. */
    const declarations = [
      ...source.code.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[(<]/g),
      ...source.code.matchAll(/(?:^|\n)\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?[(<]/g),
    ].map((hit) => hit[1] as string);

    let grew = true;
    while (grew) {
      grew = false;
      for (const declaration of declarations) {
        if (names.has(declaration)) continue;
        const body = declarationBodyOf(source.code, declaration);
        if (body === null || !callsAnyOf(body, names)) continue;
        names.add(declaration);
        grew = true;
      }
    }
  }

  visiting.delete(relative);
  resolvedNames.set(relative, names);
  return names;
}

const callsAnyOf = (text: string, names: ReadonlySet<string>): boolean =>
  [...names].some((name) => new RegExp(`(?<![\\w$.])${name}\\s*\\(`).test(text));

/**
 * A ROUTER PROPERTY'S WHOLE HANDLER CHAIN — `name: <chain>` up to the comma
 * that ends it.
 *
 * Brace matching rather than an AST: that is the whole point of this file. It
 * runs over comment-stripped code, so a sentence mentioning `checkRateLimit(…)`
 * inside a chain — `server/routes/account.ts` has one — cannot be read as a
 * call. The old collector could, and did.
 *
 * ⚠ **THE FIRST DRAFT STOPPED AT THE FIRST BALANCED GROUP AND THAT IS WHY IT
 * IS WRITTEN DOWN.** A procedure is a CHAIN of sibling groups —
 * `.input(…).mutation(…)` — so returning the moment depth came back to zero
 * handed back `.input(z.object({…}).strict())` and nothing after it. Driven
 * against the real Atlas it disagreed on 27 rows, every one of them
 * `atlas=true text=false`: the handler, which is where the limiter is, had
 * been cut off. The end of a property is the `,` or the enclosing `}` at
 * depth zero, never the first `)`.
 */
function propertyBodyOf(code: string, name: string): string | null {
  const anchor = new RegExp(`(?<![\\w$.])${name}\\s*:`, "g");
  for (const hit of code.matchAll(anchor)) {
    const from = hit.index + hit[0].length;
    let depth = 0;
    for (let i = from; i < code.length; i += 1) {
      const character = code[i] as string;
      if ("({[".includes(character)) depth += 1;
      else if (")}]".includes(character)) {
        if (depth === 0) return code.slice(from, i);
        depth -= 1;
      } else if (character === "," && depth === 0) return code.slice(from, i);
    }
    return code.slice(from);
  }
  return null;
}

/**
 * A MODULE-LEVEL DECLARATION'S BODY — `function f(…) { … }` or
 * `const f = (…) => { … }`.
 *
 * Deliberately a different matcher from {@link propertyBodyOf}: a declaration
 * ends at its own closing brace, and the property rule — stop at the first
 * depth-zero `,` or `)` — would run a top-level function to the end of the
 * file, which would make every wrapper read as calling everything.
 */
function declarationBodyOf(code: string, name: string): string | null {
  const anchor = new RegExp(`(?<![\\w$.])${name}\\s*[(=<]`, "g");
  for (const hit of code.matchAll(anchor)) {
    let parens = 0;
    for (let i = hit.index + hit[0].length - 1; i < code.length; i += 1) {
      const character = code[i] as string;
      if (character === "(") parens += 1;
      else if (character === ")") parens -= 1;
      else if (character === "{" && parens <= 0) {
        let depth = 0;
        for (let j = i; j < code.length; j += 1) {
          const inner = code[j] as string;
          if (inner === "{") depth += 1;
          else if (inner === "}") {
            depth -= 1;
            if (depth === 0) return code.slice(hit.index, j + 1);
          }
        }
        return code.slice(hit.index);
      } else if (character === ";" && parens <= 0) break;
    }
  }
  return null;
}

/** This reader's verdict for one Atlas row. */
function readsAsLimited(row: { name: string; file: string }): boolean | null {
  const source = serverSources().get(row.file);
  if (!source) return null;
  const names = enforcingNamesIn(row.file, new Set<string>());
  if (names.size === 0) return false;
  /* `applyModelEdit.plan` → the child's own region inside the parent's. */
  let region: string | null = source.code;
  for (const segment of row.name.split(".")) {
    region = region === null ? null : propertyBodyOf(region, segment);
  }
  return region === null ? null : callsAnyOf(region, names);
}

/* --------------------------------------------------------------- the arms */

describe("the enforcer list is the module's, and its exclusions are stated", () => {
  const rateLimitModule = readFileSync(repoPath("server", "security", "rateLimit.ts"), "utf8");

  it("every export of server/security/rateLimit.ts is classified one way or the other", () => {
    const exported = [
      ...withoutComments(rateLimitModule).matchAll(
        /\bexport\s+(?:async\s+)?(?:function|const|interface|type|class)\s+(\w+)/g,
      ),
    ].map((hit) => hit[1] as string);

    expect(exported.length).toBeGreaterThan(5);
    const unclassified = exported.filter(
      (name) => !(ENFORCERS as readonly string[]).includes(name) && !(name in NOT_ENFORCERS),
    );
    /* A new enforcer cannot arrive and quietly read as "not one". */
    expect(unclassified).toEqual([]);
  });

  it("and each named enforcer really is exported by that module", () => {
    for (const enforcer of ENFORCERS) {
      expect(rateLimitModule).toContain(`export function ${enforcer}`);
    }
  });
});

describe("the artifact agrees with a reader that does not share its resolver", () => {
  it("every one of the Atlas's procedures reads the same both ways", () => {
    const disagreements = ATLAS.routes
      .map((row) => ({ row, mine: readsAsLimited(row) }))
      .filter(({ row, mine }) => mine !== null && mine !== row.rateLimited)
      .map(({ row, mine }) => `${row.id} (${row.file}): atlas=${row.rateLimited} text=${mine}`);

    expect(disagreements).toEqual([]);
  });

  it("and the comparison is over the whole column, not a handful of rows", () => {
    const readable = ATLAS.routes.filter((row) => readsAsLimited(row) !== null);
    /* A reader that silently returned `null` everywhere would pass the arm
       above by comparing nothing at all. */
    expect(readable.length).toBeGreaterThan(ATLAS.routes.length * 0.95);
    expect(ATLAS.routes.length).toBeGreaterThan(250);
  });
});

describe("the wrapper roads this column was blind to, named one at a time", () => {
  const limitedIds = new Set(ATLAS.routes.filter((row) => row.rateLimited).map((row) => row.id));

  /**
   * ⚠ THE PUBLIC ONE IS FIRST BECAUSE IT IS THE REASON THIS WAS A WARDEN
   * FINDING. `creationCheck.lookup` is on CLAUDE.md's invariant-5 allowlist,
   * `limit(getClientIp(ctx.req), CREATION_CHECK_LOOKUP_RATE)` is the first
   * statement in its handler, and the map said it had no rate limit.
   */
  it("a module-local wrapper: creationCheck.lookup, which is PUBLIC", () => {
    expect(limitedIds.has("route:creationCheck.lookup")).toBe(true);
  });

  it("a wrapper whose name differs only in case: wardrobe's throwIfRateLimited", () => {
    /* `/rateLimit/` is case-sensitive and the wrapper is `…RateLimited`. */
    for (const id of ["route:wardrobe.garments.upload", "route:wardrobe.vto.generate"]) {
      expect(limitedIds.has(id)).toBe(true);
    }
  });

  it("evidence's three enforcers, which wrap checkUserRateLimit rather than checkRateLimit", () => {
    expect(limitedIds.has("route:evidence.discardReferencePlate")).toBe(true);
    expect(limitedIds.has("route:evidence.generateInkAddCandidate")).toBe(true);
  });

  /**
   * ⚠ THE ONE A ONE-HOP FIX WOULD STILL HAVE LIED ABOUT. All four
   * `castingV2.voice.*` procedures delegate their whole body to
   * `./castingVoice`, whose module-local `enforce` wraps `checkRateLimit` —
   * so the enforcement is two hops away and across a module boundary, and
   * resolving only the declaring file leaves these four reading `false`.
   */
  it("CROSS-MODULE: all four castingV2.voice procedures, two hops away", () => {
    for (const name of ["status", "design", "keep", "remove"]) {
      expect(limitedIds.has(`route:castingV2.voice.${name}`)).toBe(true);
    }
  });

  it("NEGATIVE CONTROL: a procedure with no limiter still reads unlimited", () => {
    /* `creationCheck.status` sits in the SAME FILE as three limited ones and
       simply does not call `limit` — so a reader that marked a whole file
       would fail here. The card itself counted this row as limited; it is
       not, read at `server/routes/creationCheck.ts:144`. */
    expect(limitedIds.has("route:creationCheck.status")).toBe(false);
    expect(readsAsLimited({ name: "status", file: "server/routes/creationCheck.ts" })).toBe(false);
  });

  it("NEGATIVE CONTROL: the column is not simply true everywhere now", () => {
    expect(limitedIds.size).toBeGreaterThan(80);
    expect(limitedIds.size).toBeLessThan(ATLAS.routes.length * 0.6);
  });
});

/**
 * THE POPULATION, which is what makes a shape NEITHER reader sees go red
 * rather than quiet (#2349's lesson, applied before it costs anything).
 */
describe("every enforcer call site under server/ is accounted for", () => {
  const callSites = () => {
    const sites: Array<{ relative: string; enforcer: string }> = [];
    for (const { relative, code } of serverSources().values()) {
      for (const enforcer of ENFORCERS) {
        if (new RegExp(`(?<![\\w$.])${enforcer}\\s*\\(`).test(code)) sites.push({ relative, enforcer });
      }
    }
    return sites;
  };

  it("the reader found call sites at all, in more than one module", () => {
    const sites = callSites();
    expect(sites.length).toBeGreaterThan(10);
    expect(new Set(sites.map((site) => site.relative)).size).toBeGreaterThan(5);
  });

  it("every ROUTER file that reaches an enforcer has at least one limited procedure", () => {
    const routerFiles = new Set(ATLAS.routes.map((row) => row.file));
    const silent = [...routerFiles]
      .filter((file) => enforcingNamesIn(file, new Set<string>()).size > 0)
      .filter((file) => !ATLAS.routes.some((row) => row.file === file && row.rateLimited));
    /* A router file that resolves an enforcer and limits nothing is either a
       real finding or a resolver that broke — never something to pass over. */
    expect(silent).toEqual([]);
  });

  /**
   * ⚠ THE SHAPE THE GENERATOR DELIBERATELY DOES NOT READ, asked for by name so
   * that the day it arrives is the day this reddens rather than the day the
   * column quietly goes wrong again. `const { checkRateLimit } = await
   * import("…")` is the house style of the admin routes and the atomic credit
   * layer — 104 statements in 23 files for other symbols — and it cost the
   * un-wiring differ 36 wired exports before #108 slice 2 taught it the shape.
   */
  it("no destructured dynamic import of an enforcer exists — the generator cannot see one", () => {
    const offenders: string[] = [];
    for (const { relative, code } of serverSources().values()) {
      for (const hit of code.matchAll(/\{([^}]*)\}\s*=\s*await\s+import\s*\(/g)) {
        const named = (hit[1] as string).split(",").map((piece) => piece.trim().split(/\s*:\s*/)[0]?.trim());
        if (named.some((name) => name && (ENFORCERS as readonly string[]).includes(name))) {
          offenders.push(relative);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the dynamic-import reader can actually see that shape", () => {
    /* A positive control, because an arm asserting an empty list is otherwise
       satisfied by a regex that matches nothing at all. */
    const fixture = `const { checkRateLimit } = await import("../security/rateLimit");`;
    const found = [...fixture.matchAll(/\{([^}]*)\}\s*=\s*await\s+import\s*\(/g)].flatMap((hit) =>
      (hit[1] as string).split(",").map((piece) => piece.trim()),
    );
    expect(found).toContain("checkRateLimit");
  });
});

describe("the reader itself was driven before its verdicts counted (law 2)", () => {
  it("POSITIVE CONTROL: it resolves a wrapper of a wrapper", () => {
    const code = withoutComments(`
      import { checkRateLimit } from "../security/rateLimit";
      function inner(id: string) { return checkRateLimit(id, {}); }
      function outer(id: string) { inner(id); }
      export const r = router({ thing: protectedProcedure.mutation(() => { outer("x"); }) });
    `);
    const names = new Set(["checkRateLimit", "inner", "outer"]);
    expect(callsAnyOf(propertyBodyOf(code, "thing") ?? "", names)).toBe(true);
    /* The wrapper's own body is read by the OTHER matcher, and must not run on. */
    expect(declarationBodyOf(code, "inner")).toContain("checkRateLimit(id, {})");
    expect(declarationBodyOf(code, "inner")).not.toContain("outer");
  });

  it("NEGATIVE CONTROL: it does not read a MENTION as a call", () => {
    const code = withoutComments(`
      export const r = router({
        /* was checkRateLimit(x) with the result dropped */
        thing: protectedProcedure.mutation(() => { doWork(); }),
      });
    `);
    expect(callsAnyOf(propertyBodyOf(code, "thing") ?? "", new Set(["checkRateLimit"]))).toBe(false);
  });

  /**
   * ⚠ THE ARM THE FIRST DRAFT FAILED, kept as the control for the mistake:
   * the limiter lives in `.mutation(…)`, which comes AFTER a balanced
   * `.input(…)` group. A matcher that stops at the first depth-zero close
   * reads this procedure as unlimited.
   */
  it("REGRESSION CONTROL: a chain's handler survives a balanced .input() before it", () => {
    const code = withoutComments(`
      export const r = router({
        upload: protectedProcedure
          .input(z.object({ a: z.string() }).strict())
          .mutation(async ({ ctx }) => { throwIfRateLimited(ctx.user.id); }),
        next: protectedProcedure.query(() => 1),
      });
    `);
    const body = propertyBodyOf(code, "upload") ?? "";
    expect(body).toContain("throwIfRateLimited");
    /* … and it still stops at its own comma, rather than swallowing a sibling. */
    expect(body).not.toContain("next");
  });

  it("NEGATIVE CONTROL: a longer name is not a prefix match", () => {
    const code = "function f() { enforceReferenceRateLimit(1); }";
    expect(callsAnyOf(code, new Set(["enforce"]))).toBe(false);
    expect(callsAnyOf(code, new Set(["enforceReferenceRateLimit"]))).toBe(true);
  });

  it("the brace matcher takes the whole region, nesting included", () => {
    const body = propertyBodyOf("const r = { a: f({ b: g({ c: 1 }) }), d: 2 };", "a");
    expect(body).toContain("g({ c: 1 })");
    expect(body).not.toContain("d: 2");
  });

  it("the source sweep reached the real tree and the Atlas is the real artifact", () => {
    expect(serverSources().size).toBeGreaterThan(100);
    expect(serverSources().has("server/routes/creationCheck.ts")).toBe(true);
    expect(REPO_ROOT.length).toBeGreaterThan(0);
  });
});
