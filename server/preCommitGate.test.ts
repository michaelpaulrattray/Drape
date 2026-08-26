import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * THE PRE-COMMIT GATE, DRIVEN RATHER THAN READ.
 *
 * Two Retro guards share one hook (docs/RETRO_LOG.md R3 and R4; #102, #103).
 * Like the pre-push test this does NOT mock `sh` or git: it builds real
 * temporary repositories, points them at this tree's `.githooks`, and commits.
 * The decision is git's exit code. Both directions of each arm are here —
 * a refusal alone cannot tell "refuses everything" from a working gate (law 2).
 *
 * The positive controls are the CLASS specimens: a commit on a `team/*` branch
 * from the repository's main working tree, and a staged text file carrying a
 * literal 0x08 — the byte a non-raw Python heredoc makes of `\b`.
 */

const HOOKS_DIR = resolve(".githooks");
const HOOK = join(HOOKS_DIR, "pre-commit");

function git(cwd: string, ...args: string[]): { status: number; stderr: string } {
  try {
    execFileSync(
      "git",
      [
        "-c",
        `core.hooksPath=${HOOKS_DIR}`,
        "-c",
        "user.name=gate",
        "-c",
        "user.email=gate@example.invalid",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd, encoding: "utf8", stdio: "pipe" },
    );
    return { status: 0, stderr: "" };
  } catch (error: any) {
    return {
      status: typeof error?.status === "number" ? error.status : -1,
      stderr: String(error?.stderr ?? ""),
    };
  }
}

/** A fresh repository on `main` with one commit, so branches and worktrees can hang off it. */
function freshRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "drape-precommit-"));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "seed\n");
  git(dir, "add", "README.md");
  const seeded = git(dir, "commit", "-q", "-m", "seed");
  if (seeded.status !== 0) throw new Error(`seed commit failed: ${seeded.stderr}`);
  return dir;
}

function stageAndCommit(cwd: string, name: string, bytes: Buffer | string) {
  writeFileSync(join(cwd, name), bytes);
  git(cwd, "add", name);
  return git(cwd, "commit", "-q", "-m", `add ${name}`);
}

const repos: string[] = [];
afterAll(() => {
  for (const dir of repos) rmSync(dir, { recursive: true, force: true });
});

describe("the pre-commit gate", () => {
  beforeAll(() => {
    expect(existsSync(HOOK)).toBe(true);
    /* Line endings: a CRLF shebang line is a hook sh cannot run. `.githooks/**`
       is pinned LF in .gitattributes; this pins the bytes on disk. */
    expect(readFileSync(HOOK, "utf8")).not.toContain("\r");
  });

  it("every hook in .githooks is executable IN THE INDEX, or a Linux clone never runs it", () => {
    /* Found on the gate (run 32912700673): this hook was authored on Windows,
       landed as mode 100644, and ubuntu's git skipped it silently — all three
       refusal arms passed the commit. The pre-push was 100644 too, since its
       test drives the file through `sh` and never asked git to. Windows runs a
       non-executable hook anyway (core.filemode=false), so the index mode is
       the only reading that is true on every machine that clones this. The
       population is the directory, not a list. */
    const listing = execFileSync("git", ["ls-files", "-s", "--", ".githooks"], { encoding: "utf8" });
    const rows = listing.trim().split("\n").filter(Boolean);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row, `${row} — fix with: git update-index --chmod=+x <path>`).toMatch(/^100755 /);
    }
  });

  describe("arm 1 — R3, a team/* branch committed from the MAIN working tree", () => {
    it("REFUSES the commit in the main tree, and names the worktree command", () => {
      const dir = freshRepo();
      repos.push(dir);
      git(dir, "checkout", "-q", "-b", "team/102-specimen");
      const result = stageAndCommit(dir, "work.txt", "shift work\n");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("MAIN working tree");
      expect(result.stderr).toContain("git worktree add");
    });

    it("allows the same commit from a linked worktree", () => {
      const dir = freshRepo();
      repos.push(dir);
      const wt = join(dir, "..", `${dir.split(/[\\/]/).pop()}-wt`);
      repos.push(wt);
      expect(git(dir, "worktree", "add", "-q", wt, "-b", "team/102-in-worktree").status).toBe(0);
      expect(stageAndCommit(wt, "work.txt", "shift work\n").status).toBe(0);
    });

    it("leaves main, other branches and a detached HEAD in the main tree alone", () => {
      const dir = freshRepo();
      repos.push(dir);
      expect(stageAndCommit(dir, "on-main.txt", "fine\n").status).toBe(0);
      git(dir, "checkout", "-q", "-b", "census/full-map");
      expect(stageAndCommit(dir, "on-census.txt", "fine\n").status).toBe(0);
      git(dir, "checkout", "-q", "--detach");
      expect(stageAndCommit(dir, "detached.txt", "fine\n").status).toBe(0);
    });
  });

  describe("arm 2 — R4, a staged text file holding a control byte", () => {
    it("REFUSES a literal 0x08 (the heredoc backspace), naming the file, byte and offset", () => {
      const dir = freshRepo();
      repos.push(dir);
      const result = stageAndCommit(dir, "harness.ts", Buffer.from("const re = /\x08foo/;\n", "latin1"));
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("harness.ts");
      expect(result.stderr).toContain("0x08");
      expect(result.stderr).toContain("offset 12");
    });

    it("refuses the other bytes of the class too (0x1B, 0x0C), never tab/LF/CR", () => {
      const dir = freshRepo();
      repos.push(dir);
      const esc = stageAndCommit(dir, "esc.toml", Buffer.from("x = '\x1b[0m'\n", "latin1"));
      expect(esc.status).not.toBe(0);
      expect(esc.stderr).toContain("esc.toml holds a control byte 0x1b at offset 5");
      /* A refused commit leaves its file staged; clear it so the next arm is
         judged on its own file and not on this one. */
      git(dir, "reset", "-q");
      const ff = stageAndCommit(dir, "page.md", Buffer.from("one\x0ctwo\n", "latin1"));
      expect(ff.status).not.toBe(0);
      expect(ff.stderr).toContain("page.md holds a control byte 0x0c at offset 3");
      git(dir, "reset", "-q");
      expect(stageAndCommit(dir, "whitespace.txt", "tab\there\r\nnext line\n").status).toBe(0);
    });

    it("skips a text-looking file that git itself calls binary (a NUL in the content)", () => {
      /* Git's heuristic reads a NUL in the first block as binary, and the hook
         takes git's verdict rather than keeping its own list — so this passes
         by construction and is pinned here so nobody 'fixes' it into a second
         list. (The file is not called nul.txt: that is a reserved device name
         on Windows and git cannot open it at all.) */
      const dir = freshRepo();
      repos.push(dir);
      expect(stageAndCommit(dir, "zero.txt", Buffer.from("a\x00b\n", "latin1")).status).toBe(0);
    });

    it("passes the same content written as the two characters backslash-b", () => {
      const dir = freshRepo();
      repos.push(dir);
      expect(stageAndCommit(dir, "harness.ts", "const re = /\\bfoo/;\n").status).toBe(0);
    });

    it("passes a binary file even though its bytes hold 0x08", () => {
      const dir = freshRepo();
      repos.push(dir);
      /* A PNG signature followed by bytes from the refused range: git's own
         binary heuristic (the NUL in the signature) is what skips it. */
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x08, 0x08, 0x1b]);
      expect(stageAndCommit(dir, "pixel.png", png).status).toBe(0);
    });

    it("ignores a deletion (there is no blob to scan)", () => {
      const dir = freshRepo();
      repos.push(dir);
      git(dir, "rm", "-q", "README.md");
      expect(git(dir, "commit", "-q", "-m", "delete").status).toBe(0);
    });
  });
});
