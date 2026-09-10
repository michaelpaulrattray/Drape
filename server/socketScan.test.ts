import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { requireShell, runHook } from "./testing/hookDriver";

/* The refusal arm spawns a real shell, and vitest's 5s default is not enough
   for that under load on somebody's machine — #548's class. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * THE WARDEN'S SUPPLY-CHAIN SCAN — the three things about it that can rot
 * silently (issue #35, his account connected 2026-09-10).
 *
 * `scripts/socket-scan.sh` runs the Socket CLI over this repo's dependency
 * manifests and exits nonzero when the report is unhealthy. The gate calls it
 * only on a PR that touches a manifest, because a scan spends one quota unit
 * on the free tier and the dependency set cannot change in a PR that touches
 * neither `package.json` nor `pnpm-lock.yaml`.
 *
 * ⚠ THAT SCOPING IS THE PART THAT ROTS, AND IT ROTS TOWARD SILENCE. A second
 * manifest added anywhere in the tree — `client/package.json`, a
 * `requirements.txt`, a nested workspace — would simply not be covered by the
 * gate's pattern, and NOTHING would go red: the step would keep printing "No
 * manifest touched" over a PR that changed dependencies. That is working law
 * 4 exactly (a second list shadowing a source of truth always drifts from
 * it), so the population here is DERIVED from `git ls-files` rather than
 * typed out, and the arm reddens on the day the second manifest lands.
 *
 * The other two arms guard the failure this repository has shipped four
 * recorded times: a control that is not invoked, or that passes when its
 * dependency is missing (invariant 7). The refusal is DRIVEN — the script is
 * executed with no token and its exit code read — never grepped for, because
 * a `grep` for the word REFUSING passes just as happily on a comment
 * promising a refusal that the code does not perform.
 */

const repoRoot = path.resolve(__dirname, "..");
const gate = readFileSync(path.join(repoRoot, ".github/workflows/gate.yml"), "utf8");
const script = readFileSync(path.join(repoRoot, "scripts/socket-scan.sh"), "utf8");

/** The step's own `MANIFESTS='…'` line, read out of the workflow it governs. */
function manifestPatternFromGate(): RegExp {
  const line = gate.match(/^\s*MANIFESTS='(.+)'$/m);
  if (!line) {
    throw new Error(
      "gate.yml has no MANIFESTS='…' line — the supply-chain step's path filter " +
        "has moved or gone. This test cannot report a verdict about a pattern it " +
        "cannot find, so it refuses instead of passing.",
    );
  }
  return new RegExp(line[1]);
}

/**
 * Every dependency manifest git actually tracks, in the ecosystems Socket
 * reads (its `scan create --help`: Go, Gradle, JavaScript, Kotlin, Python,
 * Scala). Derived, so a new one appears here the moment it is committed.
 */
function trackedManifests(): string[] {
  const tracked = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  const names =
    /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|Pipfile\.lock|poetry\.lock|go\.mod|go\.sum|build\.gradle(\.kts)?|pom\.xml)$/;
  return tracked
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && names.test(f));
}

describe("the supply-chain scan's path filter", () => {
  it("covers every dependency manifest git tracks", () => {
    const pattern = manifestPatternFromGate();
    const manifests = trackedManifests();

    /* A population that came up empty would make the arm below vacuous — the
       shape every Atlas collector was repaired for. */
    expect(manifests.length).toBeGreaterThan(0);

    const uncovered = manifests.filter((f) => !pattern.test(f));
    expect(
      uncovered,
      `These manifests are tracked but the gate's supply-chain step would ignore a PR ` +
        `that changed them, silently and greenly. Extend MANIFESTS in gate.yml:\n  ` +
        uncovered.join("\n  "),
    ).toEqual([]);
  });

  it("is a real filter and not a pattern that matches everything", () => {
    /* The negative control. Without it the arm above passes on `.*` — and a
       filter matching everything would spend a quota unit on every PR, which
       is the exact cost the scoping exists to avoid. */
    const pattern = manifestPatternFromGate();
    expect(pattern.test("server/routes/billing.ts")).toBe(false);
    expect(pattern.test("docs/WARDEN_SOCKET.md")).toBe(false);
    /* Root-anchored on purpose: a nested manifest is NOT silently covered, so
       the derived arm above is the thing that catches one arriving. */
    expect(pattern.test("client/package.json")).toBe(false);
    expect(pattern.test("package.json")).toBe(true);
    expect(pattern.test("pnpm-lock.yaml")).toBe(true);
  });
});

describe("the supply-chain scan is actually invoked", () => {
  it("is called by the gate, with the token the repository holds", () => {
    /* Assert at the wire (invariant 5): the step must both RUN the script and
       hand it the secret. Either half alone is a control that cannot work —
       the script without the secret refuses every time, and the secret
       without the call scans nothing. */
    expect(gate).toContain("sh scripts/socket-scan.sh");
    expect(gate).toContain("SOCKET_CLI_API_TOKEN: ${{ secrets.SOCKET_CLI_API_TOKEN }}");
  });

  it("pins the CLI version in the script and nowhere else", () => {
    /* One instrument, one pin — the drift gitleaks' pair was repaired for on
       PR #88, where the version was copied into each workflow. */
    const pin = script.match(/^SOCKET_VERSION="([\d.]+)"$/m);
    expect(pin, "scripts/socket-scan.sh must declare SOCKET_VERSION").toBeTruthy();
    expect(gate).not.toContain(pin![1]);
  });
});

describe("the supply-chain scan refuses rather than passing", () => {
  it("exits nonzero and says why when no token is configured", () => {
    /* Driven, not grepped. A missing dependency must REFUSE, never allow
       (invariant 7) — this repository has four recorded controls that shipped
       green while scanning nothing. */
    const env = { ...process.env };
    delete env.SOCKET_CLI_API_TOKEN;

    const run = runHook(requireShell(), ["scripts/socket-scan.sh"], { cwd: repoRoot, env });

    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("REFUSING");
    expect(run.stderr).toContain("SOCKET_CLI_API_TOKEN");
    /* The refusal must be legible as a refusal rather than as a finding —
       otherwise a red gate sends a shift hunting a malicious package that was
       never looked for. */
    expect(run.stderr).toContain("nothing was scanned");
  });
});
