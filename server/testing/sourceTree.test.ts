import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./contendedTestTimeout";
import { readListedSource } from "./listedSource";
import {
  CLIENT_SRC,
  REPO_ROOT,
  clientSources,
  repoPath,
  sourcePathsUnder,
  sourcesUnder,
} from "./sourceTree";

/* Three arms read the real `client/src` off disk — #741's population, reached
   directly here because this file IS the shared walk's suite. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/**
 * THE PROMOTED SOURCE-TREE WALK, DRIVEN (#2289).
 *
 * Working law 2: an instrument gets a negative control and a positive control
 * before its verdicts count. This walk is now the ONE reading behind twenty
 * guards, several of which are ABSENCE assertions — *no file under `client/src`
 * does X* — where **reading less IS passing**. So the arm that matters most
 * here is not that it finds files; it is that it CANNOT QUIETLY FIND FEWER.
 *
 * What is driven, and why each one is here rather than assumed:
 *
 *  - the real tree is found, at a floor, so a resolver matching nothing is red;
 *  - `tests: "include"` and `tests: "exclude"` really DIFFER on this tree,
 *    which is what makes the required option a control rather than a ceremony;
 *  - a file that vanishes between the listing and the read is SKIPPED and never
 *    returned as empty content — driven THROUGH the reader rather than by
 *    racing a real unlink, because a test that depends on winning a race is a
 *    test that passes for the wrong reason on a fast machine;
 *  - the order is deterministic, which `readdirSync` alone is not;
 *  - `node_modules` is skipped, and the skip list is an option rather than a
 *    hard-coded name;
 *  - the module takes NO second look at a listed entry, which is how the
 *    list-then-stat half of #223's race is dissolved rather than tolerated.
 */

const fixtures: string[] = [];
function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), "sourcetree-"));
  fixtures.push(root);
  mkdirSync(path.join(root, "nested"), { recursive: true });
  mkdirSync(path.join(root, "node_modules"), { recursive: true });
  writeFileSync(path.join(root, "b.ts"), "export const b = 1;\n");
  writeFileSync(path.join(root, "a.tsx"), "export const a = 1;\n");
  writeFileSync(path.join(root, "a.test.ts"), "it('x', () => {});\n");
  writeFileSync(path.join(root, "notes.md"), "# no\n");
  writeFileSync(path.join(root, "nested", "c.ts"), "export const c = 1;\n");
  writeFileSync(path.join(root, "node_modules", "dep.ts"), "export const dep = 1;\n");
  return root;
}

afterAll(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
});

const relatives = (root: string, options: Parameters<typeof sourcePathsUnder>[1]) =>
  sourcePathsUnder(root, options).map((file) =>
    path.relative(root, file).split(path.sep).join("/"),
  );

describe("the one derivation of the roots", () => {
  it("resolves the repository, the client tree and an arbitrary path inside it", () => {
    /* The reason this module exists at all: FIVE distinct spellings of the
       client root were in the tree, one of them depending on where vitest was
       launched from (`process.cwd()`). */
    expect(path.isAbsolute(REPO_ROOT)).toBe(true);
    expect(CLIENT_SRC).toBe(path.join(REPO_ROOT, "client", "src"));
    expect(repoPath("client", "src")).toBe(CLIENT_SRC);
    /* And it is the real tree, not a plausible-looking string. */
    expect(sourcePathsUnder(repoPath("server", "testing"), { tests: "exclude" }).length)
      .toBeGreaterThan(5);
  });
});

describe("the walk, over a fixture it fully controls", () => {
  it("finds every source under the root, deepest included, in a deterministic order", () => {
    const root = fixture();
    expect(relatives(root, { tests: "exclude" })).toEqual([
      "a.tsx",
      "b.ts",
      "nested/c.ts",
    ]);
  });

  it("the two `tests` answers really differ, which is what makes the option a control", () => {
    const root = fixture();
    expect(relatives(root, { tests: "include" })).toEqual([
      "a.test.ts",
      "a.tsx",
      "b.ts",
      "nested/c.ts",
    ]);
    expect(relatives(root, { tests: "exclude" })).not.toContain("a.test.ts");
  });

  it("skips `node_modules` by default and takes the skip list as an option", () => {
    const root = fixture();
    expect(relatives(root, { tests: "exclude" })).not.toContain("node_modules/dep.ts");
    /* ⚠ A GIVEN LIST **REPLACES** THE DEFAULT RATHER THAN ADDING TO IT, and
       that is pinned rather than left to be discovered: a caller naming its own
       skip is naming the whole of it, so `["nested"]` stops skipping
       `node_modules`. The first shape of this arm expected the other
       behaviour and reddened on its own fixture, which is the only reason
       anybody would ever learn which it was. */
    expect(relatives(root, { tests: "exclude", skipDirectories: ["nested"] }))
      .toEqual(["a.tsx", "b.ts", "node_modules/dep.ts"]);
    expect(relatives(root, { tests: "exclude", skipDirectories: [] }))
      .toContain("node_modules/dep.ts");
  });

  it("matches the extensions it is given and nothing else", () => {
    const root = fixture();
    expect(relatives(root, { tests: "exclude", extensions: [".md"] })).toEqual(["notes.md"]);
    expect(relatives(root, { tests: "exclude", extensions: [".ts"] })).toEqual([
      "b.ts",
      "nested/c.ts",
    ]);
  });

  it("reads the text of every file it lists", () => {
    const root = fixture();
    const read = sourcesUnder(root, { tests: "exclude" });
    expect(read.map((file) => file.relative)).toEqual(["a.tsx", "b.ts", "nested/c.ts"]);
    expect(read.every((file) => file.source.length > 0)).toBe(true);
    expect(read.find((file) => file.relative === "nested/c.ts")?.source)
      .toBe("export const c = 1;\n");
  });
});

describe("a file that leaves between the listing and the read is SKIPPED (#223)", () => {
  /*
    ⚠ **DRIVEN THROUGH THE READER, NOT BY RACING A REAL UNLINK.** The race is
    real — `scriptWorldGuard.test.ts` plants and unlinks a file in the live
    `scripts/` directory while other workers walk it — but a test that has to
    WIN that race is a test that passes for the wrong reason on a fast machine,
    and working law 3 says a backstop needs a test the model cannot rescue. So
    the reader is made to answer `null` for one listed file, which is exactly
    what it answers for a vanished one, and the two properties are read off the
    result: the file is ABSENT, and nothing in the result holds empty content.

    The ENOENT-only bound itself, and the negative control that a different
    error still throws, are `listedSource.test.ts`'s — not restated here.
  */
  it("the vanished file is absent, and is never returned as empty content", async () => {
    const root = fixture();
    const vanished = path.join(root, "b.ts");

    const present = sourcesUnder(root, { tests: "exclude" });
    expect(present.map((file) => file.relative), "the positive control")
      .toContain("b.ts");

    vi.resetModules();
    vi.doMock("./listedSource", () => ({
      readListedSource: (file: string) => (file === vanished ? null : readListedSource(file)),
    }));
    const { sourcesUnder: withAVanishedFile } = await import("./sourceTree");
    const after = withAVanishedFile(root, { tests: "exclude" });
    vi.doUnmock("./listedSource");
    vi.resetModules();

    expect(after.map((file) => file.relative)).toEqual(["a.tsx", "nested/c.ts"]);
    expect(after.some((file) => file.source === ""), "an empty source would read as a file "
      + "that holds nothing rather than one that is not there").toBe(false);
  });
});

describe("the real client tree, which twenty guards now rest on", () => {
  it("is found at a floor — a walk that silently found nothing would pass absence arms", () => {
    /*
      THE ARM THAT MATTERS MOST. Several consumers assert that NO file under
      `client/src` does something; every one of them passes over an empty list.
      Before #2289 each carried its own floor arm; the floor is here too, once,
      where the walk is.
    */
    const app = clientSources({ tests: "exclude" });
    expect(app.length).toBeGreaterThan(300);
    expect(app.every((file) => file.source.length > 0)).toBe(true);
    expect(app.map((file) => file.relative)).toContain("pages/CastingRoom.tsx");
  });

  it("including tests finds strictly more of the real tree than excluding them", () => {
    const withTests = clientSources({ tests: "include" }).length;
    const withoutTests = clientSources({ tests: "exclude" }).length;
    expect(withTests).toBeGreaterThan(withoutTests);
  });
});

describe("the module takes no second look at a listed entry", () => {
  it("lists with `withFileTypes` and never stats what the listing just named", () => {
    /*
      The list-side twin of #223, dissolved rather than tolerated: one syscall
      answers "is this a file" together with "what is it called", so there is no
      second look to lose. Read at this module's own bytes because the property
      is structural — a `statSync` reintroduced here would pass every arm above
      and reopen the race under load, which is how it was found the first time.
    */
    const source = readListedSource(path.join(REPO_ROOT, "server", "testing", "sourceTree.ts"));
    expect(source, "the module could not be read").not.toBeNull();
    expect(source!).toContain("withFileTypes: true");
    expect(
      /\bstatSync\s*\(/.test(source!),
      "a `statSync` on a listed entry is #223's list-side race coming back",
    ).toBe(false);
    expect(source!, "the read must go through the sanctioned reader")
      .toContain("readListedSource(absolute)");
  });
});
