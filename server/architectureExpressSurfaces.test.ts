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
