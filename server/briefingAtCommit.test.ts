/**
 * THE BRIEFING READ, DRIVEN AT THE REAL FILE'S REAL SIZE (#1867).
 *
 * `crew-read-replies.mts` is the one tool a shift reads the founder with. Its
 * read of the deployed briefing had `execFileSync`'s default 1 MiB buffer, the
 * briefing grew past that, and the read has failed ever since — falling back to
 * the WORKING TREE (which can be a shift's unfinished edition) under a sentence
 * that blamed the git clone. Three shifts saw it; two went looking at their
 * clone; the clone was never the problem.
 *
 * # Why the arms are on the REAL file and not on a fixture
 *
 * The defect was a NUMBER against a SIZE. A fixture proves whatever size it was
 * written at, so it would have been green on the night the real file crossed the
 * line — which is exactly the failure mode here: a limit crossed quietly, with
 * the instrument reporting a different cause. So:
 *
 *   - the POSITIVE arm reads the real briefing at HEAD through the shipped
 *     default, and therefore **reddens on the day the briefing outgrows the new
 *     buffer too** rather than printing a wrong diagnosis for three nights;
 *   - the NEGATIVE arm asks the same real file for the 1 MiB buffer that broke
 *     it, so the incident itself is reproduced in the suite and the reason the
 *     tool now prints is read off a genuine failure;
 *   - the DISCRIMINATION arm asks git for a sha that does not exist, which is
 *     the cause the old sentence asserted. Both roads must fail, and they must
 *     fail with DIFFERENT reasons — that is the whole of the repair, because the
 *     old reader could not tell them apart and told a shift the wrong one.
 *
 * Working law 2: the negative and the discrimination arms are what make the
 * positive one worth anything.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  BRIEFING_READ_MAX_BUFFER,
  briefingAtCommit,
  describeGitShowFailure,
} from "../scripts/lib/briefingAtCommit.mts";
import { briefingReadFailed } from "../scripts/lib/liveBriefing.mts";
import { BRIEFING_PATH } from "../scripts/lib/quietEdition.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { readListedSource } from "./testing/listedSource";
import { codeOnly, withoutComments } from "./testing/withoutComments";

/* This suite spawns real `git` processes AND reads the tracked tree, so it is
   in both #548's and #741's populations. Either constant lifts the file off
   vitest's 5 s default, which is the property both guards are about. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const ROOT = resolve(import.meta.dirname, "..");
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const HEAD = git("rev-parse", "HEAD").trim();
/** The one sha git is certain not to have: the all-zero object name. */
const NO_SUCH_COMMIT = "0".repeat(40);
const NODE_DEFAULT_MAX_BUFFER = 1024 * 1024;

describe("the briefing at a commit, at the real size (#1867)", () => {
  const realBytes = Number(git("cat-file", "-s", `${HEAD}:${BRIEFING_PATH}`).trim());

  it("the subject is real and is past the old limit — otherwise the arms below prove nothing", () => {
    /* If this ever fails the suite has stopped testing the defect: either the
       briefing shrank under 1 MiB (and the negative arm would pass for the
       wrong reason) or the path moved. Verify the instrument first. */
    expect(realBytes).toBeGreaterThan(NODE_DEFAULT_MAX_BUFFER);
  });

  it("POSITIVE — the shipped default reads it, and reddens the day it outgrows that too", () => {
    const read = briefingAtCommit(HEAD);
    expect(
      briefingReadFailed(read) ? read.reason : "",
      `The briefing is ${realBytes} bytes and BRIEFING_READ_MAX_BUFFER is `
        + `${BRIEFING_READ_MAX_BUFFER}. If the reason below is ENOBUFS, the file has `
        + "outgrown the buffer again — raise BRIEFING_READ_MAX_BUFFER, which is the "
        + "one place it is declared, rather than adding a number at a call site.",
    ).toBe("");
    expect(typeof read).toBe("string");
    expect(JSON.parse(read as string).edition).toEqual(expect.any(Number));
  });

  it("NEGATIVE — the 1 MiB default that broke it still fails, and says so by the BUFFER", () => {
    const read = briefingAtCommit(HEAD, NODE_DEFAULT_MAX_BUFFER);
    expect(briefingReadFailed(read)).toBe(true);
    const reason = briefingReadFailed(read) ? read.reason : "";
    expect(reason).toContain("ENOBUFS");
    expect(reason).toContain(String(NODE_DEFAULT_MAX_BUFFER));
    /* The sentence that cost three nights. It must not come back on any road. */
    expect(reason).not.toContain("may not hold");
  });

  it("DISCRIMINATION — a sha the clone really lacks fails with GIT's words, not the buffer's", () => {
    const read = briefingAtCommit(NO_SUCH_COMMIT);
    expect(briefingReadFailed(read)).toBe(true);
    const reason = briefingReadFailed(read) ? read.reason : "";
    expect(reason).toContain("git said:");
    expect(reason).not.toContain("ENOBUFS");
  });
});

describe("describeGitShowFailure says what happened and never composes a cause", () => {
  it("a buffer overflow names the buffer and points at the one place to raise it", () => {
    const reason = describeGitShowFailure({ code: "ENOBUFS", status: null }, 1234);
    expect(reason).toContain("ENOBUFS");
    expect(reason).toContain("1234");
    expect(reason).toContain("BRIEFING_READ_MAX_BUFFER");
  });

  it("git's own stderr wins over the node-level code, and only its first line travels", () => {
    const reason = describeGitShowFailure(
      { code: "EBADEXIT", stderr: "fatal: invalid object name 'deadbeef'\nsecond line\n" },
      BRIEFING_READ_MAX_BUFFER,
    );
    expect(reason).toBe("git said: fatal: invalid object name 'deadbeef'");
  });

  it("a code with no stderr is reported as the code — never dressed up as a cause", () => {
    expect(describeGitShowFailure({ code: "ETIMEDOUT", stderr: "  " }, 1)).toBe("git failed (ETIMEDOUT)");
  });

  it("nothing at all still produces a sentence, and it claims nothing", () => {
    expect(describeGitShowFailure({}, 1)).toBe("git failed and said nothing");
    expect(describeGitShowFailure(null, 1)).toBe("git failed and said nothing");
    expect(describeGitShowFailure({ message: "spawnSync git ENOENT\nat …" }, 1)).toBe("spawnSync git ENOENT");
  });
});

/**
 * ONE READER — the class, not the instance (working law 7).
 *
 * The defect was not a missing number: it was TWO callers of one pure chooser,
 * each with its own copy of the git read, and the copies disagreeing about the
 * buffer. The population is DERIVED from that seam — every tracked file that
 * calls `chooseBriefing` — so a third caller written next month is in it the day
 * it is written, rather than reddening somebody's preflight a month later.
 *
 * ⚠ **STATED LIMIT.** `deploy-rite.mts` and `briefingConformance.mts` also read
 * the briefing at a commit and are deliberately OUT of this population: neither
 * calls `chooseBriefing`, both already pass the 32 MiB buffer, and both live on
 * the push path where a `spawnSync` status contract differs from this reader's.
 * Converting them is tidying rather than repair and was not folded in. So a
 * clean reading here is a FLOOR over the whole tree and coverage only over the
 * seam the defect lived in.
 */
describe("one reader of the briefing at a commit, across every chooseBriefing caller", () => {
  const callers = git("ls-files", "scripts")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".mts") || line.endsWith(".ts"))
    .map((file) => ({ file, source: readListedSource(resolve(ROOT, file)) }))
    .filter((row): row is { file: string; source: string } => row.source !== null)
    /* IMPORTS it, rather than merely naming it — `liveBriefing.mts` declares
       the function and is not one of its callers. The first reading of this
       population said otherwise and the arm below caught it. */
    .filter((row) => /import\s*\{[^}]*\bchooseBriefing\b[^}]*\}\s*from/.test(withoutComments(row.source)));

  it("the population is real, and holds the two files the defect lived in", () => {
    /* A FLOOR rather than an exact list: a third caller written next month is
       legitimate and must not redden this arm — the two arms below are what
       judge it. What may never happen is one of these two leaving the
       population, because that is how a fixed file stops being watched. */
    const files = callers.map((row) => row.file).sort();
    expect(files).toContain("scripts/crew-read-replies.mts");
    expect(files).toContain("scripts/crew-mirror-replies.mts");
  });

  /* ⚠ `withoutComments` HERE, NOT `codeOnly` — AND THE BASELINE WENT RED
     TEACHING ME SO. An import specifier is a string literal, and `codeOnly`
     drops literal contents by contract, so the module path is simply not in
     that output: the first version of this arm reported BOTH correct callers
     as missing the import. The house rule is already written down at
     `codeOnly`'s declaration — the SPECIFIER is read from source with comments
     stripped, the CALL from `codeOnly`. Both halves are here, one each. */
  it("every one of them imports the shared reader", () => {
    const missing = callers
      .filter((row) => !/from\s+["'][^"']*briefingAtCommit\.mts["']/.test(withoutComments(row.source)))
      .map((row) => row.file);
    expect(
      missing,
      "A chooseBriefing caller takes its reader from scripts/lib/briefingAtCommit.mts. "
        + "A local one is how both callers came to have 1 MiB where the push path has 32.",
    ).toEqual([]);
  });

  /**
   * ⚠ THE ARM THE SABOTAGE RUN REWROTE, AND THE REASON IT IS POSITIVE.
   *
   * This was first written as a NEGATIVE sweep for the deleted call's shape
   * (`"show", \`${sha}:…\``). Driven, it survived: the sabotage put the local
   * reader back as a single-string `execSync(\`git show …\`)`, which is a
   * different spelling, so the guard read a clean tree and the green would have
   * passed for coverage. Widening it to any `git`-and-`show` spelling is not the
   * repair either — measured on the real sources, that matches `showAll`,
   * `SHOW TABLES` and six lines of console prose in `crew-read-replies.mts`
   * alone, i.e. a guard that reddens on correct code.
   *
   * So the property is asserted POSITIVELY: the reader handed to `chooseBriefing`
   * is the shared one. There is exactly one spelling of being right and
   * unboundedly many of being wrong, and this arm reads the first.
   */
  it("and every one of them HANDS it to chooseBriefing — the arm a local reader breaks", () => {
    const notPassed = callers
      .filter((row) => !/chooseBriefing\s*\([^)]*\bbriefingAtCommit\s*\)/.test(codeOnly(row.source)))
      .map((row) => row.file);
    expect(
      notPassed,
      "chooseBriefing's third argument must BE briefingAtCommit, not a local arrow "
        + "function that spawns git — importing it and then not using it is the defect "
        + "wearing the fix's clothes.",
    ).toEqual([]);
  });
});
