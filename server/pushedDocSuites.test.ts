/**
 * THE RITE'S INSTRUCTION-SURFACE GATE, DRIVEN AGAINST REAL REPOSITORIES (#1813).
 *
 * `scripts/lib/pushedDocSuites.mts` decides which suites the deploy rite runs
 * before a push, from the paths that push touches. It exists because `ca13c631`
 * (#1809) put two bare `file:line` pointers into `CLAUDE.md` through the rite
 * and reddened `prosePointerDiscipline` on `main`, failing the next PR's gate on
 * an arm its diff never touched.
 *
 * # WHAT THIS DRIVES, AND WHY IT BUILDS REPOSITORIES RATHER THAN FIXTURES
 *
 * The reader's whole job is `git grep` and `git show` AT A COMMIT, so a fixture
 * of strings would exercise none of it — the commit road is the subject. Each
 * arm below builds a throwaway repository with `git init`, commits a tree, and
 * asks the real function. Working law 3's shape: drive the guard directly.
 *
 * ⚠ **THE TWO ARMS THAT MATTER ARE THE DISCRIMINATION, NOT THE SELECTION.** A
 * reader that returned every test file would pass any "is my suite selected"
 * arm. So the citation arm is the load-bearing one: a suite that mentions
 * `CLAUDE.md` in a DOCBLOCK and reads nothing must NOT be selected, because
 * prose is the dominant source of a filename in this repository's test files —
 * 59 suites name `CLAUDE.md` and 11 read a law surface.
 *
 * And the REAL-TREE arms at the bottom are the positive control that keeps this
 * honest against the actual product: a synthetic repository proves the
 * mechanism, and only this tree proves the mechanism is pointed at the right
 * thing.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  containingPaths,
  GUARDED_SURFACES,
  pushedDocSuites,
} from "../scripts/lib/pushedDocSuites.mts";
import { LAW_SURFACES } from "../scripts/lib/lawText.mts";
import { BRIEFING_FILE } from "../scripts/lib/briefingConformance.mts";

/* A tree-walking, repository-building suite: both of the repo-wide guards want
   this declared at file level. */
export const CONTENDED_TEST_TIMEOUT_MS = 120_000;

const repoRoot = path.resolve(import.meta.dirname, "..");
const made: string[] = [];

afterEach(() => {
  while (made.length > 0) {
    const dir = made.pop()!;
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      /* Windows holds handles briefly; a leftover temp dir is not a finding. */
    }
  }
});

/** A real git repository carrying `files`, committed. Returns its path + sha. */
function repoWith(files: Record<string, string>): { dir: string; sha: string } {
  const dir = mkdtempSync(path.join(tmpdir(), "docsuites-1813-"));
  made.push(dir);
  const run = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
  run("init", "--quiet", "--initial-branch=main");
  run("config", "user.email", "seat@example.invalid");
  run("config", "user.name", "seat");
  run("config", "commit.gpgsign", "false");
  for (const [file, text] of Object.entries(files)) {
    const full = path.join(dir, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text, "utf8");
  }
  run("add", "--all");
  run("commit", "--quiet", "--no-verify", "-m", "tree");
  return { dir, sha: run("rev-parse", "HEAD").trim() };
}

/** A suite that genuinely READS the surface it names. */
const READER = `
import { readFileSync } from "node:fs";
const text = readFileSync("CLAUDE.md", "utf8");
it("reads the law", () => { expect(text).toBeTruthy(); });
`;

/** A suite that only CITES the surface, in a docblock, and reads nothing. */
const CITER = `
/**
 * The founder's law in \`CLAUDE.md\` says the engine name never reaches a
 * customer path, and "CLAUDE.md" is quoted here in prose on purpose.
 */
it("cites the law", () => { expect(1).toBe(1); });
`;

describe("containingPaths — the widening, bounded", () => {
  it("carries the file itself and its multi-segment ancestors", () => {
    expect(containingPaths("docs/specs/DECISION_LOG.md")).toEqual([
      "docs/specs/DECISION_LOG.md",
      "docs/specs",
    ]);
  });

  it("⚠ CONTROL — never widens to a bare top-level tree, which cost 76 suites", () => {
    // Without this bound `server/crew/crew-briefing.json` matched every
    // tree-walking guard that names "server" as its own population root.
    expect(containingPaths("server/crew/crew-briefing.json")).not.toContain("server");
    expect(containingPaths("server/crew/crew-briefing.json")).toContain("server/crew");
  });

  it("keeps a slash-less file, which is the whole subject of this module", () => {
    expect(containingPaths("CLAUDE.md")).toEqual(["CLAUDE.md"]);
  });
});

describe("pushedDocSuites — driven on real commits", () => {
  it("selects the suite that READS the pushed surface", () => {
    const { dir, sha } = repoWith({
      "CLAUDE.md": "# law\n",
      "server/reads.test.ts": READER,
    });
    expect(pushedDocSuites(dir, sha, ["CLAUDE.md"]).suites).toEqual(["server/reads.test.ts"]);
  });

  it("⚠ CONTROL — does NOT select a suite that only CITES it in prose", () => {
    // The load-bearing arm. 59 suites in the real tree name `CLAUDE.md`; 11
    // read a law surface. A reader that could not tell them apart would run
    // five times the work and be called noise.
    const { dir, sha } = repoWith({
      "CLAUDE.md": "# law\n",
      "server/cites.test.ts": CITER,
    });
    const selection = pushedDocSuites(dir, sha, ["CLAUDE.md"]);
    expect(selection.suites).toEqual([]);
    expect(selection.blindSurfaces).toEqual(["CLAUDE.md"]);
  });

  it("⚠ CONTROL — a reader that names the surface but never reads disk is not selected", () => {
    const { dir, sha } = repoWith({
      "CLAUDE.md": "# law\n",
      "server/names.test.ts": `const surface = "CLAUDE.md";\nit("x", () => { expect(surface).toBeTruthy(); });\n`,
    });
    expect(pushedDocSuites(dir, sha, ["CLAUDE.md"]).suites).toEqual([]);
  });

  it("follows the ONE HOP: a suite naming LAW_SURFACES is about every surface it holds", () => {
    // The half that keeps the reader honest rather than lucky — a guard that
    // reads its surfaces out of the shared declaration spells none of them.
    const { dir, sha } = repoWith({
      "CLAUDE.md": "# law\n",
      "docs/architecture/FEATURE_FLAGS.md": "# flags\n",
      "server/viaConstant.test.ts": `
import { readFileSync } from "node:fs";
import { LAW_SURFACES } from "../scripts/lib/lawText.mts";
it("reads them all", () => {
  for (const surface of LAW_SURFACES) expect(readFileSync(surface, "utf8")).toBeTruthy();
});
`,
    });
    for (const surface of LAW_SURFACES) {
      expect(
        pushedDocSuites(dir, sha, [surface]).suites,
        `${surface} must reach the suite that reads it through the declared constant`,
      ).toEqual(["server/viaConstant.test.ts"]);
    }
  });

  it("selects through a containing DIRECTORY literal, which is what a cross-tree guard writes", () => {
    const { dir, sha } = repoWith({
      "docs/specs/DECISION_LOG.md": "# log\n",
      "server/tree.test.ts": `
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
for (const f of readdirSync("docs/specs")) readFileSync(\`docs/specs/\${f}\`, "utf8");
it("walks", () => { expect(1).toBe(1); });
`,
    });
    expect(pushedDocSuites(dir, sha, ["docs/specs/DECISION_LOG.md"]).suites)
      .toEqual(["server/tree.test.ts"]);
  });

  it("a suite is never its own subject", () => {
    const { dir, sha } = repoWith({
      "server/self.test.ts": `
import { readFileSync } from "node:fs";
const me = readFileSync("server/self.test.ts", "utf8");
it("reads itself", () => { expect(me).toBeTruthy(); });
`,
    });
    expect(pushedDocSuites(dir, sha, ["server/self.test.ts"]).suites).toEqual([]);
  });

  it("excludes what a previous step already ran, so nothing runs twice", () => {
    const { dir, sha } = repoWith({
      "CLAUDE.md": "# law\n",
      "server/reads.test.ts": READER,
    });
    const selection = pushedDocSuites(dir, sha, ["CLAUDE.md"], ["server/reads.test.ts"]);
    expect(selection.suites, "already-run suites leave `suites`").toEqual([]);
    expect(
      selection.byPath.get("CLAUDE.md"),
      "but they stay in byPath, so the surface does not read as blind",
    ).toEqual(["server/reads.test.ts"]);
    expect(selection.blindSurfaces).toEqual([]);
  });

  it("an ordinary path with no suite about it is not a refusal", () => {
    const { dir, sha } = repoWith({
      "docs/notes.md": "# notes\n",
      "server/reads.test.ts": READER,
    });
    const selection = pushedDocSuites(dir, sha, ["docs/notes.md"]);
    expect(selection.suites).toEqual([]);
    expect(selection.blindSurfaces, "only a DECLARED surface refuses on empty").toEqual([]);
  });

  it("no changed paths selects nothing and refuses nothing", () => {
    const { dir, sha } = repoWith({ "CLAUDE.md": "# law\n", "server/reads.test.ts": READER });
    expect(pushedDocSuites(dir, sha, []).suites).toEqual([]);
    expect(pushedDocSuites(dir, sha, []).blindSurfaces).toEqual([]);
  });
});

describe("the real tree — the positive control the synthetic repositories cannot give", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();

  it("⚠ CONTROL — the declared surfaces are the real ones, derived not listed", () => {
    // An `it.each` over an empty list generates no test and reports no test,
    // which reads exactly like a pass; and a narrowed surface list reddens
    // nothing anywhere, because a reader that reads less simply passes.
    expect(GUARDED_SURFACES.length).toBeGreaterThan(1);
    expect(GUARDED_SURFACES, "the surface every session loads").toContain("CLAUDE.md");
    expect(GUARDED_SURFACES, "the file two thirds of it moved into (#330)")
      .toContain("docs/architecture/FEATURE_FLAGS.md");
    expect(GUARDED_SURFACES, "the file every edition pushes").toContain(BRIEFING_FILE);
  });

  it("#1809's specimen: a CLAUDE.md push reaches prosePointerDiscipline", () => {
    // The incident this card is about. If this arm ever stops holding, the rite
    // is blind to the exact defect that produced it.
    expect(pushedDocSuites(repoRoot, head, ["CLAUDE.md"]).suites)
      .toContain("server/prosePointerDiscipline.test.ts");
  });

  it("#1679's specimen: a briefing push reaches crewBodyWhitespace", () => {
    expect(pushedDocSuites(repoRoot, head, [BRIEFING_FILE], []).suites)
      .toContain("client/src/features/admin/components/crew/crewBodyWhitespace.test.ts");
  });

  it("every declared surface finds a reader in this tree, so the rite never refuses it blind", () => {
    for (const surface of GUARDED_SURFACES) {
      expect(
        pushedDocSuites(repoRoot, head, [surface]).blindSurfaces,
        `${surface} has no suite reading it — the rite would refuse a push touching it`,
      ).toEqual([]);
    }
  });

  it("stays a handful, not the whole suite — the selection is precise enough to be worth running", () => {
    // Measured when written: 11 for CLAUDE.md against 59 that merely cite it,
    // and 200 tests in ~1.6s. A ceiling well above today's reading, so an
    // ordinary new guard does not redden this while a runaway widening does.
    const selection = pushedDocSuites(repoRoot, head, ["CLAUDE.md"]);
    expect(selection.suites.length).toBeGreaterThan(0);
    expect(selection.suites.length).toBeLessThan(30);
  });
});
