/**
 * THE RITE'S TYPECHECK — ITS VERDICT LOGIC, DRIVEN (#263, second review round).
 *
 * `server/pushPathsToMain.test.ts` proves the rite CALLS `runTypecheckOnCommit`.
 * That is invariant 7 satisfied and nothing more: it says the control is
 * reached, never that it can say no.
 *
 * ⚠ **Before this file existed, nothing could.** The injectable `check` seam was
 * built into the module and used by no suite; the verdict mapping and the
 * throw-on-empty-output guard were driven once by hand the night they landed
 * and could never be driven again. So a later edit that flipped the status
 * mapping, or softened the empty-output refusal, would redden nothing — and the
 * rite would treat a failed or SILENT check as a pass, on the only path to
 * `main`. That is this card's own subject one level down: a control whose
 * verdict nobody checks.
 *
 * The empty-output arm is the one that matters most. `spawnSync` refuses a
 * `.cmd` on Windows with EINVAL and returns both streams empty, which is
 * byte-identical to a run that passed quietly — the shape that reported 0/7 on
 * a driver the night before this landed (#11).
 */
import { describe, expect, it } from "vitest";
import path from "node:path";
import { readCheckRun, runTypecheckOnCommit } from "../scripts/lib/typecheckOnCommit.mts";

const ROOT = path.resolve(import.meta.dirname, "..");

/** A check that never runs `pnpm`, so these arms cost a worktree and not a minute. */
const fakeCheck = (status: number | null, output: string) => () => ({ status, output });

describe("the typecheck verdict (#263)", () => {
  it("status 0 is ok", () => {
    const verdict = runTypecheckOnCommit(ROOT, "HEAD", { check: fakeCheck(0, "no errors\n") });
    expect(verdict.ok).toBe(true);
    expect(verdict.seconds).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it("a non-zero status is NOT ok, and it names the file at fault", () => {
    const compilerOutput = [
      "> tsc --noEmit",
      "",
      "server/thing.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.",
      " ELIFECYCLE  Command failed with exit code 2.",
    ].join("\n");
    const verdict = runTypecheckOnCommit(ROOT, "HEAD", { check: fakeCheck(2, compilerOutput) });
    expect(verdict.ok).toBe(false);
    /* The rite prints `printed` verbatim into its refusal, so the error line
       reaching it is the difference between "it is red" and "here is why". */
    expect(verdict.printed).toContain("server/thing.ts(1,14): error TS2322");
    /* Blank lines dropped, so twelve lines of budget are twelve lines of signal. */
    expect(verdict.printed.split("\n")).toHaveLength(3);
  }, 60_000);

  it("keeps only the LAST lines of a long report — where tsc puts the summary", () => {
    const noisy = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n");
    const verdict = runTypecheckOnCommit(ROOT, "HEAD", { check: fakeCheck(1, noisy) });
    const lines = verdict.printed.split("\n");
    expect(lines).toHaveLength(12);
    expect(lines.at(-1)).toBe("line 40");
    expect(lines[0]).toBe("line 29");
  }, 60_000);

  it("throws when the commit cannot be checked out — blind refuses, never allows", () => {
    expect(() => runTypecheckOnCommit(ROOT, "no-such-commit-0000", { check: fakeCheck(0, "fine") }))
      .toThrow();
  }, 60_000);
});

describe("THE ARM THAT MATTERS — a run that never happened is not a pass (#263)", () => {
  /* Driven on `readCheckRun` itself rather than through an injected `check`,
     because the guard IS inside the default check and a fake would hide the
     very thing under test. These are the real `spawnSync` return shapes. */
  it("the EINVAL shape — status null, both streams empty — THROWS", () => {
    expect(() => readCheckRun(
      { status: null, stdout: "", stderr: "", error: new Error("spawnSync pnpm EINVAL") },
      "/tmp/tree",
    )).toThrow(/a check that did not run is not a pass/);
  });

  it("a status-0 run with no output THROWS too — silence is the ambiguous case", () => {
    /* This is the direction that matters: exit 0 and nothing said reads as a
       pass everywhere else in the world, and here it is indistinguishable from
       a child that never started. */
    expect(() => readCheckRun({ status: 0, stdout: "", stderr: "   \n" }, "/tmp/tree"))
      .toThrow(/a check that did not run is not a pass/);
  });

  it("POSITIVE CONTROL — a real run passes through, on both streams and both verdicts", () => {
    expect(readCheckRun({ status: 0, stdout: "> tsc --noEmit\n", stderr: "" }, "/tmp/tree"))
      .toEqual({ status: 0, output: "> tsc --noEmit\n" });
    /* Compilers write to stderr; a guard that only looked at stdout would
       refuse every genuine failure. */
    expect(readCheckRun({ status: 2, stdout: "", stderr: "error TS2322\n" }, "/tmp/tree"))
      .toEqual({ status: 2, output: "error TS2322\n" });
  });

  it("names the directory and the underlying error, so a refusal can be diagnosed", () => {
    expect(() => readCheckRun({ status: null, stdout: null, stderr: null, error: "EINVAL" }, "/tmp/the-tree"))
      .toThrow(/\/tmp\/the-tree.*EINVAL/s);
  });
});
