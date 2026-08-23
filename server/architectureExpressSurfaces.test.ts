/**
 * THE ATLAS'S EXPRESS SURFACES, PROVED ON THE SHAPE THAT WAS MISSING.
 *
 * Access-control invariant 5 makes the Express surface an ENUMERATED list, and
 * CLAUDE.md says the Atlas mechanically verifies it. On 2026-08-20 that
 * verification was found to be blind to a whole registration shape.
 *
 * A router is mounted one of two ways in `server/_core/index.ts`:
 *
 *   app.use(imageProxyRouter)                 a module-level value
 *   app.use(createCharacterSheetRouter())     built by a factory at mount time
 *
 * The second is the newer house style — a factory takes injected dependencies,
 * which is what makes a route drivable in a suite — and the extractor matched
 * only the first. So `/api/cast/:castId/sheet` was absent from the Atlas from
 * the day it shipped, and `/api/ink-design/:designId` would have been on the day
 * it landed. **Both are authenticated routes serving one owner's images**, which
 * is the exact category the enumerated list exists for.
 *
 * The failure arrived through the mechanism meant to prevent it: a checker blind
 * to a shape reports a complete list, and "12 express surfaces" reads the same
 * as "10" to everyone who was not counting.
 *
 * Working law 2, both directions:
 *
 *   negative controls   the specimen as it read before the fix, plus a mount
 *                       with arguments and a hypothetical third shape
 *   positive controls   the shapes that were already caught, which must not
 *                       start being double-counted or renamed
 *   noise control       ordinary middleware, which is not a surface
 *
 * The last arm is the one that keeps this honest as the app grows: it derives
 * the expected set from the REAL bootstrap source rather than from a list typed
 * here, so a third mount shape reddens it instead of passing quietly.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { expressSurfacesFrom } from "../scripts/generate-architecture.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function handlersOf(source: string): string[] {
  return expressSurfacesFrom(source).map((surface) => String(surface.handler)).sort();
}

/**
 * THE AUTHENTICATED EXPRESS SURFACE, DERIVED FROM THE CODE — see the two arms
 * at the foot of this file for why `checkUserRateLimit` is the discriminator
 * and why the first derivation attempted here was wrong.
 */
function userRateLimitedRouters(): string[] {
  const routerDir = path.join(repoRoot, "server/routes");
  const candidates = [
    ...readdirSync(routerDir)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => path.join(routerDir, name)),
    path.join(repoRoot, "server/heroProxy.ts"),
  ];
  return candidates
    .filter((file) => {
      const source = readFileSync(file, "utf8");
      return /Router\(\)/.test(source) && source.includes("checkUserRateLimit");
    })
    .map((file) => path.basename(file, ".ts"))
    .sort();
}

describe("the shape that was invisible", () => {
  it("sees a router built by a factory at mount time", () => {
    /* THE NEGATIVE CONTROL, verbatim in shape from `server/_core/index.ts`.
       Before the fix this source produced no surface at all. */
    expect(handlersOf(`
      app.use(createCharacterSheetRouter());
      app.use(createInkDesignDeliveryRouter());
    `)).toEqual(["createCharacterSheetRouter()", "createInkDesignDeliveryRouter()"]);
  });

  it("still sees a router mounted as a plain value", () => {
    /* POSITIVE CONTROL: the shape that always worked must not have been
       traded away for the one that did not. */
    expect(handlersOf("app.use(imageProxyRouter);")).toEqual(["imageProxyRouter"]);
  });

  it("counts a factory-mounted router ONCE, not once per pattern", () => {
    /* Two regexes now run over the same source. `createXRouter()` must not
       match the value pattern as well and arrive twice under two names — the
       double count would inflate the surface list, which is a different way of
       making it untrustworthy. */
    const surfaces = expressSurfacesFrom("app.use(createCharacterSheetRouter());");
    expect(surfaces).toHaveLength(1);
  });

  it("still sees a path-prefixed mount, with its handler", () => {
    expect(handlersOf(`app.use("/api/auth", emailAuthRouter);`))
      .toEqual(["emailAuthRouter"]);
  });

  it("does not mistake ordinary middleware for a surface", () => {
    /* NOISE CONTROL. `securityHeaders` and `express.json(...)` are mounted the
       same way and are not routes; a checker that counted them would drown the
       list it exists to keep readable. */
    expect(expressSurfacesFrom(`
      app.use(securityHeaders);
      app.use(correlationIdMiddleware);
      app.use(express.json({ limit: "15mb" }));
    `)).toEqual([]);
  });
});

describe("against the real bootstrap", () => {
  const bootstrap = readFileSync(path.join(repoRoot, "server/_core/index.ts"), "utf8");

  it("misses no router this app actually mounts", () => {
    /*
      DERIVED, NEVER MIRRORED (working law 4). The expectation is read out of
      the bootstrap itself: every `app.use(...)` whose argument names a Router,
      in whatever shape. A third registration shape — a router held in a const,
      mounted from an array, wrapped in a helper — reddens this rather than
      silently shrinking the Atlas's list, which is what happened for the
      factory shape and went unnoticed for as long as it existed.
    */
    const mounted = [...bootstrap.matchAll(/app\.use\(\s*([A-Za-z_$][\w$.]*)\s*(\(\s*\))?\s*\)/g)]
      .filter((hit) => /router/i.test(hit[1]))
      .map((hit) => `${hit[1]}${hit[2] ? "()" : ""}`)
      .sort();
    /* The fixture arms above are meaningless if this list is empty. */
    expect(mounted.length).toBeGreaterThan(3);

    const seen = handlersOf(bootstrap);
    for (const handler of mounted) expect(seen).toContain(handler);
  });

  it("carries both authenticated image routes the enumerated list names", () => {
    /*
      CLAUDE.md's invariant 5 names the authenticated, user-rate-limited Express
      routes. Two of them are mounted by factory and are the pair this file
      exists for; asserting them by name is the check that the document and the
      Atlas are describing the same application.

      ⚠ THIS ARM SAID "four" AND NAMED FOUR UNTIL 2026-08-23, and by then the
      document said FIVE. `/api/reference/:referenceId` landed on 2026-08-22 in
      the same commit that added it to CLAUDE.md's sentence — which is the
      discipline working — and this arm, the one that ties the sentence to the
      application, was not part of that commit. **The list-keeping guard fell one
      behind the list.** The named arm below is kept for the two factory-mounted
      specimens; the DERIVED arm after it is what stops this happening again,
      because a typed list of names is the thing that went stale here.
    */
    const seen = handlersOf(bootstrap);
    expect(seen).toContain("createReferenceDeliveryRouter()");
    expect(seen).toContain("createCharacterSheetRouter()");
    expect(seen).toContain("createInkDesignDeliveryRouter()");
    expect(seen).toContain("evidenceDeliveryRouter");
    expect(seen).toContain("imageProxyRouter");
  });

  it("⚠ EVERY user-rate-limited router is mounted — the population DERIVED, never typed", () => {
    /*
      WHY `checkUserRateLimit` IS THE DISCRIMINATOR, and it is structural rather
      than lucky. That helper keys its bucket on a `userId`, so a route that
      calls it has necessarily already resolved a user — you cannot user-rate-
      limit an anonymous request. Measured over every router module in the tree:

        characterSheet · evidenceDelivery · imageProxy · inkDesignDelivery ·
        referenceDelivery                                     <- all five, the
                                                                 enumerated set
        emailAuth · emailVerification · googleAuth · heroProxy <- ZERO, the
                                                                 public ones

      A clean split with no member on the wrong side, which is what a derivation
      has to earn before it may replace a list.

      ⚠ A TEXTUAL DERIVATION ON THE OBVIOUS WORD WOULD HAVE BEEN WRONG. The
      first attempt keyed on `authenticate(` and DROPPED `imageProxy`, which
      spells it `authenticateRequest`. A derivation that silently loses a member
      is worse than the typed list it replaces — it reads as coverage. That is
      why the arm below asserts the population SIZE before it asserts anything
      about the members.
    */
    const userLimited = userRateLimitedRouters();

    /* THE POPULATION FIRST — an empty or shrunken set would make every
       assertion below vacuously true (`absence-only-expect-passes-on-nothing`). */
    expect(userLimited).toEqual([
      "characterSheet", "evidenceDelivery", "imageProxy",
      "inkDesignDelivery", "referenceDelivery",
    ]);

    /* Then: each one is actually MOUNTED. This is the direction the arm above
       cannot see — it reads its expectation out of the bootstrap, so deleting a
       mount shrinks both sides and passes. Here the population comes from the
       route modules and the mounts from the bootstrap, so a dropped
       `app.use(...)` reddens. */
    const seen = handlersOf(bootstrap).join(" ");
    for (const name of userLimited) {
      const stem = name.charAt(0).toUpperCase() + name.slice(1);
      expect(
        seen.includes(`${name}Router`) || seen.includes(`create${stem}Router()`),
        `${name} user-rate-limits, so it serves a signed-in user — but nothing mounts it in server/_core/index.ts`,
      ).toBe(true);
    }
  });

  it("⚠ and CLAUDE.md's own COUNT is tied to that population", () => {
    /*
      THE LOOP THE INCIDENT LEFT OPEN. `/api/cast/:castId/sheet` existed for
      weeks while the sentence said four routes and named three; the repair added
      the names. Nothing made the NUMBER answerable, and CLAUDE.md's own words
      are why that matters: *"a route that exists but is not on the list is how
      the list stops being the list."*

      So the document's number is read out of the document and compared with the
      derived population. A sixth authenticated route now reddens the suite with
      the sentence to edit, rather than being noticed by whoever counts next.
    */
    const claude = readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");
    const stated = /\*\*(TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT)\*\* Express routes are \*\*authenticated/
      .exec(claude);
    expect(stated, "CLAUDE.md's authenticated-Express-routes sentence has moved — re-point this arm at it").not.toBeNull();

    const words: Record<string, number> = {
      TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8,
    };
    /* DERIVED on the right-hand side too — the number the document states is
       compared with the population the code produces, so neither side can be
       edited alone. */
    expect(
      words[stated![1]!],
      "CLAUDE.md's invariant 5 states a different number of authenticated Express routes than the code has — one of them moved without the other",
    ).toBe(userRateLimitedRouters().length);
  });
});

/**
 * ⚠ AND THE HALF NEITHER ARM ABOVE COULD SEE: A NEW **PUBLIC** EXPRESS ROUTE.
 *
 * Everything above is about the AUTHENTICATED five. `userRateLimitedRouters()`
 * is derived on `checkUserRateLimit`, so a router that calls it lands in the
 * population and reddens the arms — but a router that does NOT call it lands
 * nowhere at all. Mount a new anonymous `/api/…` route today and every arm in
 * this file stays green while invariant 5's public Express sentence quietly
 * stops being the list, which is the failure the enumeration exists to prevent
 * and the one CLAUDE.md has already suffered twice.
 *
 * So this last group asks the whole question instead of half of it: **every API
 * path this application registers, by any mechanism, is named in invariant 5.**
 * Both mechanisms, because there are exactly two and the second is the one that
 * carries the webhook:
 *
 *   app.post("/api/webhooks/stripe", …)      registered on the app directly
 *   app.use("/api/auth", emailAuthRouter)    a mounted router, prefix on the mount
 *   app.use(imageProxyRouter)                a mounted router, paths inside it
 *
 * Compared at the GROUP — the first two segments, `/api/ink-design` rather than
 * `/api/ink-design/:designId` — because the document writes `/api/hero/*` and
 * names "the auth routes" collectively. That is a stated limit and not a silent
 * one: a sixth route under an ALREADY-NAMED group passes here, and the arms
 * above are what catch it when it authenticates. A route under a NEW group —
 * which is what a new feature's public surface actually looks like — cannot.
 *
 * ⚠ AND IT REFUSES RATHER THAN SKIPPING. Two of the five routers register their
 * path as `CONSTANT + "/:id"` and a textual reader finds no literal in them at
 * all. A reader that shrugged at those would have dropped `/api/ink-design` and
 * `/api/reference` — the two newest authenticated routes, and precisely the
 * members this file exists because somebody lost. So the constant is resolved
 * from its declaration, and a registration that still cannot be read FAILS the
 * arm by name (`arm-asserts-its-own-reason`).
 */

/** Resolves an `export const NAME = "/api/…"` path constant from the tree. */
function constantPathValue(name: string): string | null {
  const sources: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts")) sources.push(readFileSync(full, "utf8"));
    }
  };
  walk(path.join(repoRoot, "server"));
  walk(path.join(repoRoot, "shared"));
  const declaration = new RegExp(`const\\s+${name}\\s*(?::[^=]+)?=\\s*"([^"]+)"`);
  for (const source of sources) {
    const hit = declaration.exec(source);
    if (hit) return hit[1]!;
  }
  return null;
}

const apiGroup = (p: string): string =>
  `/${p.split("/").filter(Boolean).slice(0, 2).join("/")}`;

/** The symbol → module map for both import forms the bootstrap uses. */
function bootstrapImports(bootstrap: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const hit of bootstrap.matchAll(/import\s+(?:(\w+)|\{([^}]+)\})\s+from\s+"([^"]+)"/g)) {
    const names = hit[1]
      ? [hit[1]]
      : hit[2]!.split(",").map((n) => n.trim().split(/\s+as\s+/).pop()!);
    for (const name of names) map[name] = hit[3]!;
  }
  for (const hit of bootstrap.matchAll(/\{\s*([\w,\s]+)\s*\}\s*=\s*await\s+import\("([^"]+)"\)/g)) {
    for (const name of hit[1]!.split(",").map((n) => n.trim())) map[name] = hit[2]!;
  }
  return map;
}

/** The API groups a mounted router registers, or the reasons it could not be read. */
function groupsOfRouterModule(modulePath: string): { groups: string[]; unreadable: string[] } {
  const source = readFileSync(modulePath, "utf8");
  const groups = new Set<string>();
  const unreadable: string[] = [];
  for (const hit of source.matchAll(/\brouter\.(get|post|put|patch|delete|all)\(\s*([^,]+),/g)) {
    const argument = hit[2]!;
    const literal = /"(\/api\/[^"]*)"/.exec(argument);
    if (literal) {
      groups.add(apiGroup(literal[1]!));
      continue;
    }
    const constant = /\b([A-Z][A-Z0-9_]{3,})\b/.exec(argument);
    const value = constant ? constantPathValue(constant[1]!) : null;
    if (value) {
      groups.add(apiGroup(value));
      continue;
    }
    unreadable.push(`${path.basename(modulePath)}: ${argument.trim().replace(/\s+/g, " ")}`);
  }
  return { groups: [...groups], unreadable };
}

function registeredApiGroups(bootstrap: string): { groups: string[]; unreadable: string[] } {
  const imports = bootstrapImports(bootstrap);
  const groups = new Set<string>();
  const unreadable: string[] = [];

  for (const hit of bootstrap.matchAll(/app\.(get|post|put|patch|delete|all)\(\s*"(\/api\/[^"]+)"/g)) {
    groups.add(apiGroup(hit[2]!));
  }
  for (const hit of bootstrap.matchAll(
    /app\.use\(\s*(?:"([^"]+)"\s*,\s*)?([A-Za-z_$][\w$]*)\s*(\(\s*\))?\s*\)/g,
  )) {
    const [, prefix, name] = hit;
    if (!/router/i.test(name!)) continue;
    if (prefix) {
      groups.add(apiGroup(prefix));
      continue;
    }
    const specifier = imports[name!];
    if (!specifier) {
      unreadable.push(`${name} is mounted but its import could not be resolved`);
      continue;
    }
    const read = groupsOfRouterModule(`${path.resolve(repoRoot, "server/_core", specifier)}.ts`);
    unreadable.push(...read.unreadable);
    if (read.groups.length === 0 && read.unreadable.length === 0) {
      unreadable.push(`${specifier} is mounted as a router and registers no /api path this reader can see`);
    }
    for (const group of read.groups) groups.add(group);
  }
  return { groups: [...groups].sort(), unreadable };
}

describe("the whole Express surface against invariant 5", () => {
  const bootstrap = readFileSync(path.join(repoRoot, "server/_core/index.ts"), "utf8");

  it("reads every registration — a path it cannot resolve is a FAILURE, never a skip", () => {
    /*
      The arm below compares a derived list with the document, so everything
      turns on that list being whole; its wholeness is stated here first and
      separately (`absence-only-expect-passes-on-nothing`). Both
      constant-prefixed routers pass through `constantPathValue` — if that
      declaration is ever renamed or moved out of `server/` and `shared/`, this
      says so instead of the surface silently getting smaller.
    */
    const { groups, unreadable } = registeredApiGroups(bootstrap);
    expect(
      unreadable,
      `Express registrations this reader could not resolve: ${unreadable.join(" | ")}`,
    ).toEqual([]);

    /* POSITIVE CONTROL FOR THE CONSTANT RESOLVER, named rather than counted.
       These two are the whole reason it exists: they are registered as
       `CONSTANT + "/:id"` and a literal-only reader finds nothing in them. A
       `groups.length` floor would go on passing without them. */
    expect(groups).toContain("/api/ink-design");
    expect(groups).toContain("/api/reference");

    /* And the surface as a whole, so the comparison below cannot be vacuous. */
    expect(groups).toEqual([
      "/api/auth", "/api/cast", "/api/evidence", "/api/health", "/api/hero",
      "/api/image-proxy", "/api/ink-design", "/api/reference", "/api/slack",
      "/api/webhooks",
    ]);
  });

  it("⚠ every API group the app registers is named in CLAUDE.md's invariant 5", () => {
    /*
      DERIVED ON BOTH SIDES. The left is the running application's own
      registrations; the right is the paragraph that claims to enumerate them.
      A new public route under a new group reddens here, with the group to add.
    */
    const invariant = /^5\. \*\*Public endpoints are an enumerated allowlist\.\*\*.*$/m.exec(
      readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8"),
    );
    expect(
      invariant,
      "CLAUDE.md's invariant 5 has been renumbered or reworded — re-point this arm at it",
    ).not.toBeNull();

    /* The paragraph must be the real one. An empty match would fail every check
       below for the wrong reason; a loose anchor that swallowed the whole
       document would pass them all for a worse one. */
    expect(invariant![0].length).toBeGreaterThan(500);
    expect(invariant![0]).toContain("/api/webhooks/stripe");

    const { groups } = registeredApiGroups(bootstrap);
    for (const group of groups) {
      expect(
        invariant![0].includes(group),
        `${group} is registered in server/_core/index.ts and invariant 5 does not name it — a route that exists but is not on the list is how the list stops being the list`,
      ).toBe(true);
    }
  });

  it("CONTROL — an unnamed group is caught", () => {
    /*
      The arm above passes today, so by itself it proves only that nothing is
      wrong at this moment. This drives the defect it is for: a new anonymous
      public route, mounted the simplest way there is.
    */
    const withNewRoute = `${bootstrap}\n  app.get("/api/telemetry/ping", pingHandler);\n`;
    const { groups } = registeredApiGroups(withNewRoute);
    expect(groups).toContain("/api/telemetry");
    expect(readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8").includes("/api/telemetry")).toBe(false);
  });
});

describe("⚠ ONE HOP: a router mounted with no prefix declares its own paths", () => {
  /*
    ORDERED fable-1435 §4 (from opus-1075 §3). Until 2026-08-23 a path-less
    router produced ONE row saying only that the router existed —
    `path: "(defined by the router)"`. **FOUR of access-control invariant 5's
    five authenticated routes are mounted that way**, so a NEW route added
    inside any of them was invisible to the very artifact invariant 5 is
    verified against. That is the difference between *the list was correct when
    someone last looked* and *the list cannot silently stop being the list.*

    Driven over fixture sources with an injected resolver, so these arms do not
    inherit the repository's current bootstrap — the sibling arms below read the
    real tree and would both go green on a reader that had stopped resolving.
  */
  const resolver = (text: string) => () => ({ file: "server/routes/thing.ts", text });

  it("reads the paths out of the router's own module", () => {
    const surfaces = expressSurfacesFrom(
      'app.use(thingRouter);',
      resolver('const router = Router(); router.get("/api/thing", h); router.post("/api/thing/:id", h);'),
    );
    expect(surfaces.map((s) => `${s.method} ${s.path}`)).toEqual([
      "GET /api/thing",
      "POST /api/thing/:id",
    ]);
    expect(surfaces[0]!.file, "the module that DECLARES it, not the bootstrap")
      .toBe("server/routes/thing.ts");
    expect(surfaces[0]!.mountedBy).toBe("server/_core/index.ts");
  });

  it("resolves a FACTORY-mounted router the same way", () => {
    const surfaces = expressSurfacesFrom(
      'app.use(createThingRouter());',
      resolver('router.get("/api/thing", h);'),
    );
    expect(surfaces.map((s) => `${s.method} ${s.path}`)).toEqual(["GET /api/thing"]);
    expect(surfaces[0]!.handler).toBe("createThingRouter()");
  });

  it("⚠ resolves a path built from a SHARED CONSTANT, never guessing its value", () => {
    /* The newer house style: the client and the route read ONE constant so they
       cannot disagree about the address. A literal-only reader saw nothing at
       all for `/api/reference/:referenceId` and `/api/ink-design/:designId`. */
    const surfaces = expressSurfacesFrom(
      'app.use(createThingRouter());',
      resolver('router.get(THING_PATH_PREFIX + "/:thingId", h);'),
      ['export const THING_PATH_PREFIX = "/api/thing";'],
    );
    expect(surfaces.map((s) => `${s.method} ${s.path}`)).toEqual(["GET /api/thing/:thingId"]);
  });

  it("⚠ REFUSES to invent an address when the prefix cannot be resolved", () => {
    /* The direction that must never be wrong: a reader guessing a prefix would
       put a route on the enumerated list under an address nothing serves. */
    const surfaces = expressSurfacesFrom(
      'app.use(createThingRouter());',
      resolver('router.get(THING_PATH_PREFIX + "/:thingId", h);'),
      [],
    );
    expect(surfaces).toHaveLength(1);
    expect(String(surfaces[0]!.path)).toContain("prefix unresolved");
    expect(String(surfaces[0]!.path)).not.toContain("/api/thing/");
  });

  it("⚠ still emits the router when the hop cannot be followed at all", () => {
    /* An unfollowable hop must UNDERSTATE nothing: the row survives, saying
       exactly what it is. Losing it would shrink the surface list silently,
       which is worse than the vagueness it replaced. */
    const surfaces = expressSurfacesFrom("app.use(mysteryRouter);", () => null);
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]!.path).toBe("(defined by the router)");
    expect(surfaces[0]!.handler).toBe("mysteryRouter");
  });

  it("⚠ CONTROL — and against the REAL tree, all five of invariant 5's routes are paths now", () => {
    /* The weaker repository arm, and the one that says the hop is actually
       wired: before this, every one of these read "(defined by the router)". */
    const atlas = JSON.parse(
      readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
    ) as { surfaces: Array<{ path: string }> };
    const paths = atlas.surfaces.map((s) => s.path);
    for (const route of [
      "/api/image-proxy",
      "/api/evidence/:kind/:entityId",
      "/api/cast/:castId/sheet",
      "/api/ink-design/:designId",
      "/api/reference/:referenceId",
    ]) {
      expect(paths, `${route} must be a PATH in the Atlas, not a router name`).toContain(route);
    }
    expect(paths, "no surface may still be unresolved").not.toContain("(defined by the router)");
  });
});
