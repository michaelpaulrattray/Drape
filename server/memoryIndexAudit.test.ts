import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runHook } from "./testing/hookDriver";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite drives a real child process, so it declares the class's timeout
   rather than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * THE MEMORY INDEX'S ACCOUNTING READER, DRIVEN (#1472).
 *
 * `scripts/memory-index-audit.mts` is the only thing that can see the file
 * memory's structure breaking, and its subject — the shared memory directory —
 * is outside this repository and under no version control. **So no suite can
 * ever assert anything about the real index**, and that is not a gap to be
 * closed later: a test keyed on this machine's home directory would be red on
 * every other machine and in CI.
 *
 * What CAN be automated is the reader, and that is this file. Every arm builds
 * a fixture tree in a temp directory and drives the script against it with
 * `--root`, so no arm can pass by reading the real memories.
 *
 * BOTH DIRECTIONS ON EVERY FAULT (working law 2). The negative control is the
 * load-bearing one here: a reader that called everything unreachable would
 * satisfy every positive arm below, and a reader that reported nothing would
 * satisfy none of them while looking exactly like a healthy index — which is
 * the direction this instrument exists to rule out.
 *
 * ⚠ THE PATH-POINTER ARMS ARE THE REASON THE SCRIPT WAS PROMOTED AT ALL. The
 * disposable it came from matched `](name.md)` with no `/` in the class, so a
 * pointer carrying a path was invisible to it — a whole SHAPE of pointer that
 * could be dangling for months while the report read clean. Those two arms
 * redden against the old character class and hold against the new one.
 */

const SCRIPT = resolve("scripts/memory-index-audit.mts");

type Result = { status: number; stdout: string; stderr: string };

function audit(...args: string[]): Result {
  /* An `npx` that fails to start THROWS rather than reading as an exit code
     (#640) — this suite asserts 1 for a refusal and 2 for faults, and a missing
     npx would otherwise have to be told apart from one by eye. */
  return runHook("npx", ["tsx", SCRIPT, ...args], { shell: process.platform === "win32" });
}

let root: string;

/** A memory file: frontmatter-ish head and a body, in the shape the real ones use. */
function memory(name: string, body = "the fact.\n") {
  writeFileSync(
    join(root, `${name}.md`),
    `---\nname: ${name}\ndescription: "a fixture"\nmetadata:\n  type: project\n---\n\n${body}`,
    "utf8",
  );
}

/** An index file: one `- [Title](target.md) — hook` line per entry. */
function index(file: string, lines: string[], head = "") {
  writeFileSync(join(root, file), `${head}${lines.join("\n")}\n`, "utf8");
}

/** The clean tree every arm starts from: one index, one sub-index, four memories. */
function healthy() {
  memory("alpha");
  memory("beta");
  memory("gamma");
  /* The sub-index is DETECTED by carrying pointers of its own, never by a list
     — so it is written as a real one rather than registered anywhere. */
  index("toolbelt.md", [
    "- [Gamma](gamma.md) — the third fact",
  ], "---\nname: toolbelt\n---\n\n");
  index("MEMORY.md", [
    "- [Alpha](alpha.md) — the first fact",
    "- [Beta](beta.md) — the second fact",
    "- [The toolbelt](toolbelt.md) — READ BEFORE ANY SHELL COMMAND",
  ]);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "memidx-1472-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the negative control — a healthy index", () => {
  it("reports no faults and exits 0", () => {
    healthy();
    const run = audit("--root", root);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("FAULTS (unreachable + dangling + duplicate + joined): 0");
    expect(run.stdout).toContain("UNREACHABLE (on disk, no index points at it): 0");
    expect(run.stdout).toContain("DANGLING (pointer with no file): 0");
  });

  it("walks the sub-index transitively, so its children are reachable", () => {
    healthy();
    const run = audit("--root", root);

    /* `gamma` is pointed at only by the sub-index. A reader that stopped at
       MEMORY.md would call it unreachable — the whole point of the walk. */
    expect(run.stdout).toContain("INDEXES WALKED (2)");
    expect(run.stdout).toContain("toolbelt.md");
    expect(run.stdout).not.toMatch(/UNREACHABLE[^\n]*\n\s+gamma\.md/);
  });
});

describe("the four faults", () => {
  it("names a memory no index points at", () => {
    healthy();
    memory("orphan");

    const run = audit("--root", root);
    expect(run.status).toBe(2);
    expect(run.stdout).toContain("UNREACHABLE (on disk, no index points at it): 1");
    expect(run.stdout).toContain("orphan.md");
  });

  it("names a pointer whose file is not there, with its index and line", () => {
    healthy();
    index("MEMORY.md", [
      "- [Alpha](alpha.md) — the first fact",
      "- [Beta](beta.md) — the second fact",
      "- [The toolbelt](toolbelt.md) — READ BEFORE ANY SHELL COMMAND",
      "- [Never written](ghost.md) — the pointer with nothing behind it",
    ]);

    const run = audit("--root", root);
    expect(run.status).toBe(2);
    expect(run.stdout).toContain("DANGLING (pointer with no file): 1");
    expect(run.stdout).toContain("MEMORY.md:4 -> ghost.md");
  });

  it("names two pointers at one file, and both of their hooks", () => {
    healthy();
    index("MEMORY.md", [
      "- [Alpha](alpha.md) — the first fact",
      "- [Alpha again](alpha.md) — said differently, which is the contradiction",
      "- [Beta](beta.md) — the second fact",
      "- [The toolbelt](toolbelt.md) — READ BEFORE ANY SHELL COMMAND",
    ]);

    const run = audit("--root", root);
    expect(run.status).toBe(2);
    expect(run.stdout).toContain("DUPLICATE POINTERS (one file, several entries): 1");
    expect(run.stdout).toContain("the first fact");
    expect(run.stdout).toContain("said differently");
  });

  it("names two entries sharing one line, and still counts the second", () => {
    healthy();
    index("MEMORY.md", [
      "- [Alpha](alpha.md) — the first fact - [Beta](beta.md) — the second fact",
      "- [The toolbelt](toolbelt.md) — READ BEFORE ANY SHELL COMMAND",
    ]);

    const run = audit("--root", root);
    expect(run.status).toBe(2);
    expect(run.stdout).toContain("JOINED LINES (two entries, one line): 1");
    /* And `beta` is NOT also reported unreachable: a reader keying on `^- [`
       would lose it entirely, which is the shape this fault exists to find. */
    expect(run.stdout).toContain("UNREACHABLE (on disk, no index points at it): 0");
  });
});

describe("a pointer carrying a path — the blind spot #1472 was filed about", () => {
  /**
   * The real instance is `MEMORY.md:80`, which points at
   * `../../../../Drape/.agents/mailbox/fable-1678.md`. Under the old character
   * class that pointer did not exist as far as the reader was concerned: it
   * could never be dangling, never duplicate, never counted. A reader blind to
   * a shape reports a clean index either way.
   */
  it("resolves one that is really there", () => {
    healthy();
    mkdirSync(join(root, "elsewhere"), { recursive: true });
    writeFileSync(join(root, "elsewhere", "handoff.md"), "the handoff.\n", "utf8");
    index("MEMORY.md", [
      "- [Alpha](alpha.md) — the first fact",
      "- [Beta](beta.md) — the second fact",
      "- [The toolbelt](toolbelt.md) — READ BEFORE ANY SHELL COMMAND",
      "- [Handoff](elsewhere/handoff.md) — POINTER only, the entry lives outside",
    ]);

    const run = audit("--root", root);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("DANGLING (pointer with no file): 0");
    /* Seen at all — 4 pointers rather than the 3 the old class could read. */
    expect(run.stdout).toMatch(/MEMORY\.md\s+\d+ bytes\s+\d+ lines\s+4 pointers/);
  });

  it("reports one that is not, which the old character class could never do", () => {
    healthy();
    index("MEMORY.md", [
      "- [Alpha](alpha.md) — the first fact",
      "- [Beta](beta.md) — the second fact",
      "- [The toolbelt](toolbelt.md) — READ BEFORE ANY SHELL COMMAND",
      "- [Handoff](elsewhere/handoff.md) — POINTER only, and the file moved",
    ]);

    const run = audit("--root", root);
    expect(run.status).toBe(2);
    expect(run.stdout).toContain("DANGLING (pointer with no file): 1");
    expect(run.stdout).toContain("-> elsewhere/handoff.md");
  });

  it("never follows one as a sub-index", () => {
    /* A mailbox entry full of markdown links is not an index of this structure,
       and walking into it would start reading the repository as memories. */
    healthy();
    mkdirSync(join(root, "elsewhere"), { recursive: true });
    writeFileSync(
      join(root, "elsewhere", "handoff.md"),
      "- [Something](nowhere-at-all.md) — a link inside a foreign document\n",
      "utf8",
    );
    index("MEMORY.md", [
      "- [Alpha](alpha.md) — the first fact",
      "- [Beta](beta.md) — the second fact",
      "- [The toolbelt](toolbelt.md) — READ BEFORE ANY SHELL COMMAND",
      "- [Handoff](elsewhere/handoff.md) — POINTER only",
    ]);

    const run = audit("--root", root);
    expect(run.stdout).toContain("INDEXES WALKED (2)");
    expect(run.stdout).not.toContain("nowhere-at-all.md");
    expect(run.status).toBe(0);
  });
});

describe("the walk terminates and the reader refuses rather than reporting nothing", () => {
  it("survives two sub-indexes pointing at each other", () => {
    memory("alpha");
    index("one.md", ["- [Two](two.md) — the other index", "- [Alpha](alpha.md) — a fact"]);
    index("two.md", ["- [One](one.md) — back again"]);
    index("MEMORY.md", ["- [One](one.md) — the first sub-index"]);

    const run = audit("--root", root);
    /* It TERMINATES, which is the arm: three indexes, each walked once. The
       cycle also makes `one.md` carry two pointers, and that is a real
       duplicate rather than an artefact of the fixture — a sub-index named
       from two places IS the contradiction the fault is about, so the reader
       is right to say so and the exit code is 2. */
    expect(run.stdout).toContain("INDEXES WALKED (3)");
    expect(run.stdout).toContain("DUPLICATE POINTERS (one file, several entries): 1");
    expect(run.stdout).toContain("UNREACHABLE (on disk, no index points at it): 0");
    expect(run.status).toBe(2);
  });

  it("refuses a root with no MEMORY.md instead of calling it clean", () => {
    /* "0 faults" over a directory that was not there is the vacuous pass this
       reader exists to make impossible elsewhere. */
    const run = audit("--root", join(root, "not-a-directory"));
    expect(run.status).toBe(1);
    expect(run.stderr + run.stdout).toContain("REFUSING");
    expect(run.stdout).not.toContain("FAULTS");
  });

  it("refuses --root with no directory after it", () => {
    const run = audit("--root");
    expect(run.status).toBe(1);
    expect(run.stderr + run.stdout).toContain("REFUSING");
  });
});

describe("a hook that stops mid-sentence is reported and is not a fault", () => {
  it("counts it without failing the run", () => {
    healthy();
    index("MEMORY.md", [
      "- [Alpha](alpha.md) — the first fact",
      "- [Beta](beta.md) — it began explaining and then just…",
      "- [The toolbelt](toolbelt.md) — READ BEFORE ANY SHELL COMMAND",
    ]);

    const run = audit("--root", root);
    /* Readability, not a broken link: exit 0, and the count is there to read. */
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("HOOKS ENDING MID-SENTENCE IN AN ELLIPSIS: 1");
    expect(run.stdout).toContain("-> beta.md");
  });
});
