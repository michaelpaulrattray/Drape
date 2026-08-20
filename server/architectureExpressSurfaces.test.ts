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
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { expressSurfacesFrom } from "../scripts/generate-architecture.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function handlersOf(source: string): string[] {
  return expressSurfacesFrom(source).map((surface) => String(surface.handler)).sort();
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
      CLAUDE.md's invariant 5 names four authenticated, user-rate-limited
      Express routes. Two of them are mounted by factory and are the pair this
      file exists for; asserting them by name is the check that the document and
      the Atlas are describing the same application.
    */
    const seen = handlersOf(bootstrap);
    expect(seen).toContain("createCharacterSheetRouter()");
    expect(seen).toContain("createInkDesignDeliveryRouter()");
    expect(seen).toContain("evidenceDeliveryRouter");
    expect(seen).toContain("imageProxyRouter");
  });
});
