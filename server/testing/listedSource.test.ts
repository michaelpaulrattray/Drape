/**
 * THE HELPER GETS ITS CONTROLS BEFORE ITS VERDICT COUNTS (working law 2).
 *
 * `readListedSource` exists to make a tree walk survive a file that leaves
 * between the listing and the read. The danger in that sentence is the second
 * half: a reader that swallows failures is how a guard goes green by going
 * blind. So the race is driven directly rather than waited for, and the
 * NEGATIVE control — a failure that must still be thrown — is the arm that
 * matters most.
 *
 * The source guard at the bottom is what stops the class coming back through an
 * eighth suite.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readListedSource } from "./listedSource";

const withTempDir = (body: (dir: string) => void): void => {
  const dir = mkdtempSync(path.join(tmpdir(), "listed-source-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("readListedSource", () => {
  it("POSITIVE — returns the file's bytes when it is there", () => {
    withTempDir((dir) => {
      const file = path.join(dir, "present.mts");
      writeFileSync(file, "const db = getDb();\n");
      expect(readListedSource(file)).toBe("const db = getDb();\n");
    });
  });

  it("THE RACE, DRIVEN — a listed file that vanishes before the read reads as absent", () => {
    /*
      The incident reduced to its three steps. Waiting to meet the real race
      would be a test that passes for the wrong reason on most runs (law 3):
      list, delete, read is exactly what the parallel workers did to each other,
      and here it happens on purpose.
    */
    withTempDir((dir) => {
      const file = path.join(dir, "_vanishing-disposable.mts");
      writeFileSync(file, "const db = getDb();\n");

      const listed = readdirSync(dir);
      expect(listed, "the listing must name it — otherwise this arm proves nothing").toContain(
        "_vanishing-disposable.mts",
      );

      unlinkSync(file);

      expect(readListedSource(path.join(dir, "_vanishing-disposable.mts"))).toBeNull();
    });
  });

  it("returns null, NOT an empty string — absent and empty are different answers", () => {
    /*
      A caller that skips falsy content would treat an empty tracked file the
      same as a vanished one. `null` is the only value that cannot be confused
      with a file that genuinely holds nothing, and this arm pins the pair.
    */
    withTempDir((dir) => {
      const empty = path.join(dir, "empty.mts");
      writeFileSync(empty, "");
      expect(readListedSource(empty)).toBe("");
      expect(readListedSource(path.join(dir, "never-existed.mts"))).toBeNull();
    });
  });

  it("NEGATIVE CONTROL — a failure that is not absence is still thrown", () => {
    /*
      THE ARM THAT STOPS THIS HELPER FROM BEING A BLINDFOLD. If it caught
      everything, each of the seven guards below would pass over a tree it could
      not read and report a clean sweep — invariant 7, in the shape this
      repository has already been bitten by twice. A directory is the cheapest
      real errno that is not ENOENT: node answers EISDIR on this platform,
      measured before this arm was written.
    */
    withTempDir((dir) => {
      let code: string | undefined;
      try {
        readListedSource(dir);
        expect.unreachable("reading a directory must not be swallowed");
      } catch (error) {
        code = (error as NodeJS.ErrnoException).code;
      }
      expect(code, "the helper must rethrow everything that is not ENOENT").not.toBe("ENOENT");
      expect(code).toBeDefined();
    });
  });
});

/*
  THE POPULATION IS DERIVED, NOT LISTED (working law 4 — and #223's own card had
  seven where the tree has ten, three of which are innocent).

  The scan is deliberately broad: a suite that names a `scripts` root, lists a
  directory and reads files is a candidate whether or not it is the class. The
  three that are NOT the class are carved out BY NAME with the reason each was
  cleared at the source, and each carve-out is re-proven below — an exemption
  that stops being needed is an exemption that starts hiding the next copy.
*/
const NOT_THE_CLASS: Record<string, string> = {
  "server/architectureAtlas.test.ts":
    "walks server, client/src, shared, drizzle (line 474) and never scripts; its"
    + " `scripts` mentions are two module imports and one JSON path literal",
  "server/atlasMergeDriver.test.ts":
    "lists an mkdtemp fixture, not the tree; its one scripts/ read is the fixed"
    + " name `scripts/deploy-rite.mts`, which SHOULD throw if it is missing",
  "server/r7-b4-live-consumers.test.ts":
    "lists client/; its three scripts/ reads are fixed names, which should throw",
  "server/testing/listedSource.test.ts":
    "the file that owns the rule — it names the population it scans for",
};

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

const namesAScriptsRoot = (source: string): boolean =>
  /(["'`])scripts\1|(["'`])scripts\//.test(source) || /SCRIPTS_ROOT/.test(source);

function serverTests(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".test.ts")) found.push(full);
    }
  };
  walk(path.join(repoRoot, "server"));
  return found;
}

const relative = (file: string): string => path.relative(repoRoot, file).split(path.sep).join("/");

function candidates(): string[] {
  return serverTests()
    .filter((file) => {
      /* This walk is itself over `server/`, where nothing is planted mid-run —
         but it costs nothing to read the same way the rule asks others to. */
      const source = readListedSource(file);
      if (source === null) return false;
      return namesAScriptsRoot(source) && /readdirSync\s*\(/.test(source) && /readFileSync\s*\(/.test(source);
    })
    .map(relative)
    .sort();
}

/*
  IMPORTING THE HELPER IS NOT THE SAME AS USING IT, and a guard that stopped at
  the import would be satisfied by a file that calls it once and then adds ten
  bare listed reads beside it. So every `readFileSync` LEFT in a class member is
  accounted for by name, with the FIXED path it reads.

  A fixed-name read is not this class and must keep throwing: if
  `scripts/lib/dbConnection.mts` is missing, the suite that exempts it as "the
  door" has lost its subject and should say so loudly, not skip it.
*/
const BARE_READS_ALLOWED: Record<string, string[]> = {
  "server/scriptConnectionDiscipline.test.ts": ["DOOR — scripts/lib/dbConnection.mts, the exempted door itself"],
  "server/queueOrdinalDiscipline.test.ts": ["ROADMAP — docs/specs/POST_SIGN_ROADMAP.md, the §10 table"],
  "server/storageCleanupEnumCopies.test.ts": ["server/casting/evidence/evidenceComposerSchema.ts, the startup fence"],
  "server/castingV2/uploadRefusalCopy.test.ts": [
    "OWNER — the module that must stay a leaf",
    "each LITERAL_ALLOWED carve-out, a two-name list guarded by existsSync",
  ],
};

const bareReadCount = (source: string): number =>
  [...source.matchAll(/\breadFileSync\s*\(/g)].length;

describe("the class cannot come back through an eighth suite", () => {
  it("finds the walkers at all — a guard over an empty list is not a guard", () => {
    /* Invariant 7 in miniature: if a rename empties this scan, the assertion
       below passes vacuously and the ENOENT refusal comes straight back. */
    expect(candidates().length).toBeGreaterThanOrEqual(8);
  });

  it("every suite that walks scripts/ reads its entries through the helper", () => {
    /*
      IT MUST CALL IT, NOT MERELY NAME IT — `scriptWorldGuard.test.ts` learned
      this exact lesson about its own subject and wrote it down: *"matching the
      bare identifier is satisfied by the import line alone. Deleting the call
      and leaving the import — which is exactly what a careless edit or a bad
      merge produces — left the scan green."*

      The first cut of THIS arm made the same mistake, and a sabotage caught it:
      reverting `storageCleanupEnumCopies.test.ts` to a bare read while leaving
      its import in place did not redden this arm at all. Invariant 7, twice in
      one repository, on two different guards.
    */
    const offenders = candidates()
      .filter((file) => !(file in NOT_THE_CLASS))
      .filter((file) => !/\breadListedSource\s*\(/.test(readFileSync(path.join(repoRoot, file), "utf8")));

    expect(
      offenders,
      "These list `scripts/` and then read each entry with a bare readFileSync. A file"
      + " planted by a parallel suite — or by any of the ~440 untracked disposables this"
      + " tree carries (#8) — can leave between the two, and the ENOENT refuses the deploy"
      + " rite on a clean tree (#223). Read entries with `readListedSource` from"
      + " `server/testing/listedSource.ts` and skip the nulls:\n"
      + offenders.map((file) => `  ${file}`).join("\n"),
    ).toEqual([]);
  });

  it("every bare readFileSync left in the class is a FIXED name, accounted for", () => {
    const wrong: string[] = [];
    for (const file of candidates()) {
      if (file in NOT_THE_CLASS) continue;
      const expected = BARE_READS_ALLOWED[file]?.length ?? 0;
      const actual = bareReadCount(readFileSync(path.join(repoRoot, file), "utf8"));
      if (actual !== expected) wrong.push(`${file}: ${actual} bare readFileSync, ${expected} accounted for`);
    }

    expect(
      wrong,
      "A bare readFileSync in one of these suites is either (a) a listed entry, which must go"
      + " through `readListedSource` or it will ENOENT the deploy rite on a clean tree (#223), or"
      + " (b) a FIXED name, which should keep throwing — add a row to BARE_READS_ALLOWED naming"
      + " what it reads and why it cannot vanish mid-walk:\n"
      + wrong.map((row) => `  ${row}`).join("\n"),
    ).toEqual([]);
  });

  it("no walker in the class STATS a listed entry that is allowed to throw", () => {
    /*
      THE SHAPE THE FIRST CUT OF THIS FIX MISSED, and it was found by driving
      the race rather than by reading the code: the ENOENT that survived said
      `stat`, not `open`. An entry can be gone before it is even classified as
      file-or-directory, so `statSync` on a listed path must carry
      `throwIfNoEntry: false` and the caller must handle the empty answer.
    */
    const offenders: string[] = [];
    for (const file of candidates()) {
      if (file in NOT_THE_CLASS) continue;
      const source = readFileSync(path.join(repoRoot, file), "utf8");
      for (const call of source.matchAll(/statSync\s*\(([^)]*)\)/g)) {
        if (!call[1]!.includes("throwIfNoEntry")) offenders.push(`${file}: statSync(${call[1]!.trim()})`);
      }
    }

    expect(
      offenders,
      "A listed entry can vanish before it is stat'ed, and the ENOENT refuses the deploy rite on"
      + " a clean tree (#223). Pass `{ throwIfNoEntry: false }` and skip the empty answer:\n"
      + offenders.map((row) => `  ${row}`).join("\n"),
    ).toEqual([]);
  });

  it("keeps every bare-read row honest — a file that stops matching must lose its row", () => {
    const inClass = new Set(candidates().filter((file) => !(file in NOT_THE_CLASS)));
    for (const file of Object.keys(BARE_READS_ALLOWED)) {
      expect(inClass.has(file), `${file} is no longer in the class — delete its BARE_READS_ALLOWED row`).toBe(true);
    }
  });

  it("keeps every carve-out honest — each must still exist and still match the scan", () => {
    const matched = new Set(candidates());
    for (const [file, reason] of Object.entries(NOT_THE_CLASS)) {
      expect(
        matched.has(file),
        `${file} no longer matches the scan — delete the row (${reason})`,
      ).toBe(true);
    }
  });
});
