import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * The casting-V2 test tree must typecheck, and it must do so WITHOUT anyone
 * remembering to ask.
 *
 * The repo's root `tsconfig.json` excludes `**\/*.test.ts`, so for the whole
 * life of this subsystem its test files have never been typechecked. That is
 * how `followAnchor.test.ts` came to build a `FollowAnchor` with no `realized`
 * field at all — meaning no test in that file ever exercised realized-axis
 * inheritance, the single most-changed thing about follows — and how a
 * `ResolvedIdentity` fixture drifted four fields out of date while its suite
 * stayed green.
 *
 * A separate `pnpm check:casting-tests` fixed the checking and not the
 * remembering. Invariant 7 is the rule that applies: a control that is not
 * invoked does not exist, so the gate runs here, inside the suite everything
 * else already runs.
 *
 * The scope is a GLOB in `tsconfig.casting-tests.json`, so it grows with the
 * tree rather than needing a list maintained beside it.
 *
 * Scoped rather than repo-wide deliberately: turning the exclusion off
 * everywhere surfaces 471 errors across unrelated suites and build scripts,
 * which is a project rather than a gate, and the only quick way through it
 * would be loosening compiler options — worse than the gap it closes.
 */
describe("the casting V2 tree typechecks, tests included", () => {
  it(
    "has no type errors in server/castingV2, shared, or the casting client feature",
    () => {
      let output = "";
      let failed = false;
      try {
        execFileSync("npx", ["tsc", "-p", "tsconfig.casting-tests.json", "--noEmit"], {
          encoding: "utf8",
          stdio: "pipe",
          shell: process.platform === "win32",
        });
      } catch (error) {
        failed = true;
        const err = error as { stdout?: string; stderr?: string };
        output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
      }
      expect(failed, `casting V2 typecheck failed:\n${output}`).toBe(false);
    },
    120_000,
  );
});
