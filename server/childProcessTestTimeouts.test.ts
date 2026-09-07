import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { childProcessSuites, codeOnly, declaresTheTimeout } from "./testing/childProcessSuites";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* ⚠ THIS SUITE IS IN ITS OWN POPULATION, AND IT SAID SO ITSELF. Each arm runs
   `git ls-files` over the tree — measured at ~450 ms apiece under load — so it
   spawns a real process exactly like the suites it polices, and the deriver
   put it on the list the moment the file became tracked. It was green while
   untracked and red on the next run, which is worth knowing about this reader:
   `git ls-files` cannot see a suite that has not been committed yet. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * EVERY SUITE THAT DRIVES A REAL CHILD PROCESS DECLARES THE CLASS'S TIMEOUT
 * (#548), and the population it checks is DERIVED from the tree rather than
 * listed here.
 *
 * ⚠ **A GUARD KEYED ON THE FILES YOU HAVE ALREADY FIXED STOPS WATCHING THE
 * MOMENT YOU FIX ONE.** That is `fix-drops-subject-from-guard`, and it is why
 * this suite contains no list of nineteen filenames: a suite added next month
 * that spawns `git` is in the population the day it is written, and reddens
 * here rather than reddening a shift's preflight at random three weeks later.
 *
 * The sizing, the measurement behind 30 s, and the two roads rejected are in
 * `testing/childProcessTimeout.ts`. This file proves only that the rule holds
 * over the whole tree, and that the reading which says so can fail.
 */
const ROOT = resolve(import.meta.dirname, "..");

describe("suites that drive a child process declare the class's timeout (#548)", () => {
  const population = childProcessSuites(ROOT);

  it("sweeps a real population — a clean answer over no files is not an answer", () => {
    /* The deriver throws on an empty `git ls-files`; this is the other half,
       and it is the arm that would catch a resolver quietly matching nothing. */
    expect(population.length).toBeGreaterThan(10);
  });

  it("every one of them declares it", () => {
    const missing = population.filter((row) => !row.declares).map((row) => row.file);
    expect(
      missing,
      "These suites spawn a real process inside vitest's 5s default and will go red " +
        "under load on somebody's machine, not in CI. Add, after the imports:\n" +
        '  import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";\n' +
        "  vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });",
    ).toEqual([]);
  });

  it("the two files the card named are IN it, and neither writes `spawnSync` in code", () => {
    /* The whole argument for resolving one hop. A sweep that asked only "does
       this file call spawnSync" finds neither, and reports a clean tree. */
    const byFile = new Map(population.map((row) => [row.file, row]));

    const escalation = byFile.get("server/nextUpEscalation.test.ts");
    expect(escalation?.via).toEqual({ module: "server/testing/hookDriver.ts" });

    const typecheck = byFile.get("server/typecheckOnCommit.test.ts");
    expect(typecheck?.via).toEqual({ module: "scripts/lib/typecheckOnCommit.mts" });
  });
});

describe("the reading can be wrong in both directions, and is checked in both (#548)", () => {
  it("an IMPORT of the constant is not a declaration — the call is what counts", () => {
    /* ⚠ THE HOLE THE SABOTAGE RUN FOUND IN THIS GUARD'S OWN FIRST DRAFT. It
       asked whether the source mentioned the constant, which the import line
       does, so a file that imported it and set nothing read as compliant and
       the sabotage aimed at that came back green. `import is not a call site`,
       inside a guard written the same week the law was quoted at me. */
    const importOnly = [
      'import { describe, it, vi } from "vitest";',
      'import { spawnSync } from "node:child_process";',
      'import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";',
      'it("x", () => { spawnSync("git", ["status"]); });',
    ].join("\n");
    const withTheCall = `${importOnly}\nvi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });`;

    expect(declaresTheTimeout(importOnly)).toBe(false);
    /* The positive half in the same breath: a reader that says no to everything
       would pass the line above and mean nothing. */
    expect(declaresTheTimeout(withTheCall)).toBe(true);
  });

  /* ⚠ NEGATIVE CONTROLS, AND THEY ARE LIVE FILES RATHER THAN FIXTURES — but
     read what they actually cover. Neither file imports `node:child_process`,
     so both are held out by the IMPORT half of the test and NOT by the
     stripper; the arms that cover the stripper are the two below them, which
     drive `codeOnly` directly. Measured under sabotage, not assumed. */
  it("a file that only MENTIONS a spawn call in a comment is not in the population", () => {
    const files = childProcessSuites(ROOT).map((row) => row.file);
    /* "…handed to `execFileSync`, not a constant standing near it" */
    expect(files).not.toContain("server/crewNamingWindow.test.ts");
  });

  it("a file whose spawn call is a STRING it asserts on is not in it either", () => {
    const files = childProcessSuites(ROOT).map((row) => row.file);
    /* expect(runner).toContain("spawnSync('taskkill.exe', …") */
    expect(files).not.toContain("server/r7-b4-live-consumers.test.ts");
  });

  it("POSITIVE CONTROL — the stripper removes a call in a comment and in a string, and keeps a real one", () => {
    /* Absence-only assertions pass over nothing at all, so this arm proves the
       stripper KEEPS what matters in the same breath as dropping what does not. */
    const stripped = codeOnly(
      [
        "// spawnSync('a')",
        "/* execFileSync('b') */",
        "const fake = \"spawnSync('c')\";",
        "const alsoFake = `execSync('d')`;",
        "spawnSync('the-real-one');",
      ].join("\n"),
    );
    expect(stripped).toContain("spawnSync(");
    expect(stripped).not.toContain("'a'");
    expect(stripped).not.toContain("'b'");
    expect(stripped).not.toContain("'c'");
    expect(stripped).not.toContain("'d'");
    /* One call survives, not five: the count is the assertion, not the presence. */
    expect(stripped.match(/spawnSync\(|execFileSync\(|execSync\(/g)).toHaveLength(1);
  });

  it("POSITIVE CONTROL — a quote-bearing regex literal does not swallow the code after it", () => {
    /* ⚠ PR #650's review, finding 1, and it was a LIVE defect rather than a
       hypothetical: the stripper has no regex-literal mode, so a quote inside
       one flipped it into string mode and it consumed real code until the next
       matching quote. Driven at this exact shape before the repair — the
       `spawnSync` below vanished from the stripped output, which would have
       dropped its whole file out of the population with nothing going red.

       The repair does not try to parse regex literals (division makes that
       genuinely hard); it bounds them, because an unescaped newline ends a
       single- or double-quoted literal by JavaScript's own rule. */
    const stripped = codeOnly(
      [
        'import { spawnSync } from "node:child_process";',
        `const RE = /["']x/;`,
        'spawnSync("git", ["status"]);',
      ].join("\n"),
    );
    expect(stripped).toContain("spawnSync(");
  });

  it("POSITIVE CONTROL — the escape inside a literal does not end it early", () => {
    /* A backslash-quote is how a naive stripper falls back into `code` mode
       mid-string and then reads the rest of the file as code. */
    const stripped = codeOnly(['const s = "he said \\"spawnSync(\'x\')\\" loudly";', "const after = 1;"].join("\n"));
    expect(stripped).not.toContain("spawnSync");
    expect(stripped).toContain("const after = 1;");
  });
});

describe("the floor itself (#548)", () => {
  it("is above every duration measured under full load, with headroom", () => {
    /* The worst arm measured on the 12,495-test run was 9,087 ms. A floor that
       merely cleared it would be a floor that fails on a slower machine. */
    expect(CHILD_PROCESS_TEST_TIMEOUT_MS).toBeGreaterThanOrEqual(9_087 * 3);
  });

  it("is stated ONCE — no suite in the population hard-codes the number instead", () => {
    /* Working law 4. Nineteen hand-typed 30_000s would drift the first time the
       figure moved, and the drift would be silent.

       ⚠ Read at the file's BYTES, not at its name. The first draft of this arm
       tested the regex against `row.file` — a path — so it was green over every
       possible tree and proved nothing at all. */
    /* ⚠ BOTH SPELLINGS, PER PR #650's REVIEW FINDING 2. This arm matched only
       `testTimeout:` — but the hard-coding shape this tree actually uses is the
       per-describe option, `describe(…, { timeout: 60_000 })`, which
       `atlasCommitHook.test.ts` and its siblings carry. A suite hand-typing
       `{ timeout: 30_000 }` would have written the class's figure without the
       constant and walked past a drift arm guarding one of the two spellings
       vitest accepts. */
    /* ⚠ AND THE POSITIONAL SPELLING, PER THE SECOND REVIEW — vitest accepts
       THREE, and the third is this tree's dominant per-arm style:
       `it("…", () => {…}, 30_000)`. Closing only the two key forms would have
       left the same evasion the previous round shut for `{ timeout: }`, one
       step along. */
    const figure = `(?:${CHILD_PROCESS_TEST_TIMEOUT_MS}|30_000)`;
    const literal = new RegExp(
      `\\b(?:testTimeout|timeout):\\s*${figure}\\b` + `|\\}\\s*,\\s*${figure}\\s*\\)`,
    );
    /* ⚠ AND IT READS STRIPPED CODE, NOT RAW BYTES — this arm indicted THIS FILE
       the moment finding 2's own explanatory comment mentioned the shape it was
       widened to catch. The subject is a suite hard-coding the figure, which is
       a property of its CODE; prose about hard-coding is not hard-coding. */
    const hardCoded = childProcessSuites(ROOT)
      .filter((row) => literal.test(codeOnly(readFileSync(join(ROOT, row.file), "utf8"))))
      .map((row) => row.file);
    expect(hardCoded).toEqual([]);
  });
});
