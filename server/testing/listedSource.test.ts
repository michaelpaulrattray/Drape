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
  "server/ceremonyAutoApply.test.ts":
    "lists `drizzle/`, never scripts; its two reads are a migration file from that"
    + " listing and the fixed name `scripts/deploy-rite.mts`, and BOTH should throw"
    + " if they are missing — a vanished migration is the one thing the auto-applier"
    + " must never shrug at. No disposable has ever landed in `drizzle/`; the tree's"
    + " ~440 untracked ones are all in `scripts/`, which is the population this rule"
    + " is about",
  "server/testing/listedSource.test.ts":
    "the file that owns the rule — it names the population it scans for",
  "server/shiftDigest.test.ts":
    "lists the REPOSITORY ROOT for its top-level directory names — the derived"
    + " `roots` the path index needs — and never reads a listed entry. Its reads"
    + " are all fixed names (the two law surfaces, the reviewer's charter, and"
    + " `PROGRAM.md` behind an existsSync), and each SHOULD throw if it is"
    + " missing: a law surface that is gone is the defect. The litter this rule is"
    + " about is files in `scripts/`; a top-level directory has never vanished"
    + " mid-run",
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

/*
  ⚠ TOUCHING A LISTED ENTRY IS WHAT PUTS A WALKER IN THE CLASS — NOT THE
  SPELLING IT TOUCHES IT WITH, and requiring the bare spelling made the guard
  let go of a walker the moment it was FIXED (#591, found by sabotage).

  This read `readFileSync\s*\(` until today. So `importerCountDiff.mts`, put on
  the ENOENT-only tolerance an hour earlier in this same change, dropped
  straight out of the population — and restoring its bare `statSync` afterwards
  went GREEN. A guard that stops watching the files it has already corrected
  cannot see them regress, which is the whole job.

  Every way of touching a listed entry counts now, tolerant spellings included.
  The arms below are what judge them; this predicate only decides who is
  looked at.
*/
const TOUCHES_A_LISTED_ENTRY =
  /\b(?:readFileSync|statSync|readListedSource|readIfPresent|statIfPresent)\s*\(/;

/* Walks a directory and then touches what it listed — the class itself, with no
   claim about WHICH directory. This is the whole rule for a `scripts/lib`
   module, whose root is an argument. */
const walksAndTouches = (source: string): boolean =>
  /readdirSync\s*\(/.test(source) && TOUCHES_A_LISTED_ENTRY.test(source);

/* The same rule for a TEST SUITE, which writes its root in its own text and so
   can be asked which one — without it the scan pulls in every suite that lists
   any directory at all, most of which never go near `scripts/`. */
const isTheClass = (source: string): boolean =>
  namesAScriptsRoot(source) && walksAndTouches(source);

/*
  ⚠ A WALK DELEGATED TO AN IMPORTED MODULE WAS STRUCTURALLY INVISIBLE, AND THAT
  IS THE DOOR #589 CAME THROUGH — weeks AFTER #223's repair reached the suites
  that existed then (#591, PR #590 review finding 1).

  The scan above reads TEST FILE SOURCES. `spendingScriptArguments.test.ts`
  contains no `readdirSync` at all: its walk lives in `scripts/lib/stopline.mts`
  and runs under vitest through an import. So the guard never saw the bare
  `statSync` that refused the deploy rite on a clean tree twice in one morning,
  with every current test green.

  ⚠ THE POPULATION IS EVERY `scripts/lib` WALKER, NOT ONLY THE IMPORTED ONES,
  and the wider rule is the simpler one. The first cut of this fix took the
  reviewer's sketch literally and asked which modules a server test imports —
  which needed an import-specifier regex (a second reading of the module graph,
  free to drift from it, working law 4) and still left
  `productionMention.mts` outside: it walks `scripts/` with `CONSUMER_ROOTS`
  and is keyboard-run, so no import would ever have pulled it in. Being
  unreachable from vitest means it cannot refuse the rite; it does not mean it
  is not the class. Reading the directory covers both and has nothing to rot.
*/
function scriptLibWalkers(): string[] {
  const dir = path.join(repoRoot, "scripts", "lib");
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".mts")) continue;
    const source = readListedSource(path.join(dir, entry));
    if (source === null) continue; /* a disposable can leave mid-walk — the rule this file owns */
    /*
      ⚠ NO `namesAScriptsRoot` HERE, AND THAT IS THE WHOLE OF #594. A test
      suite writes its walk root in its own text, so asking for the spelling is
      a fair proxy for "does this walk scripts/". A `scripts/lib` MODULE is the
      opposite shape: the root arrives as an ARGUMENT, so the spelling says
      nothing about whether it walks one, and requiring it made membership hang
      on prose. Measured: `declaredEnvNames.mts` names no scripts root at all,
      so restoring its bare `statSync` — the very read PR #592 had just fixed —
      went GREEN; and `importerCountDiff.mts` was in the population only through
      backticked `scripts/` mentions in its docblock, i.e. one reworded comment
      away from leaving silently.

      An exported walker taking a caller-supplied root is in the class whichever
      root it happens to be handed today. Walk plus a touch of what it listed is
      the entire test, and it has nothing to rot.
    */
    if (walksAndTouches(source)) found.push(relative(path.join(dir, entry)));
  }
  return found;
}

function candidates(): string[] {
  const tests = serverTests()
    .filter((file) => {
      /* This walk is itself over `server/`, where nothing is planted mid-run —
         but it costs nothing to read the same way the rule asks others to. */
      const source = readListedSource(file);
      if (source === null) return false;
      return isTheClass(source);
    })
    .map(relative);
  return [...tests, ...scriptLibWalkers()].sort();
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
  "scripts/lib/stopline.mts": [
    "STOPLINE_PATH — the freeze file by fixed path, behind its own existsSync; its"
    + " catch answers `(present, unreadable)` rather than absent, which is the"
    + " REFUSING direction and must stay",
    "ACCOUNT_SPENDERS — two hand-kept spender names, each behind existsSync, and a"
    + " name that has gone missing REPORTS as a finding rather than throwing (the"
    + " #345 note at the site)",
  ],
  /*
     ⚠ EIGHT ROWS, NOT ONE BLANKET LINE — the card's own bar (#594), because the
     whole question about this module is WHICH of its ten reads were listed
     entries. Read call by call: three were (the two `listFiles(SOURCE_DIR)`
     sweeps and the `listFiles(server)` sweep behind `pinningTests`) and now go
     through `readIfPresent`; these eight are FIXED names and must keep throwing.
     A census whose declared-source file has vanished is broken, and reporting a
     short door list as a complete one is the failure the whole atlas exists to
     prevent — so the tolerance stops exactly at the walk.
  */
  "scripts/lib/capabilityAtlas.mts": [
    "codeLinesOf — the STRICT twin, kept for its two fixed callers"
    + " (refineInterpreter.ts, refineDelta.ts); the listed-entry callers use"
    + " codeLinesIfPresent",
    "castingV2Scope.ts — the flag declarations, by fixed name",
    "ROLL_ENTRANCE_FILE — behind its own existsSync, which throws a NAMED error"
    + " saying the five walls would silently lose every citation",
    "briefRefusalCopy.ts — the roll copy table, by fixed name",
    "conceptDescribeCopy.ts — the concept copy table, by fixed name",
    "refineDelta.ts — the union members’ own type lines, by fixed name",
    "cannotSayCopy.ts — the cannot-say copy table, by fixed name",
    "CAPABILITY_JSON — the committed atlas, behind existsSync in readCommittedAtlas",
  ],
  "server/patrolClocks.test.ts": [
    "REAL_LOGS — the four patrol logs by fixed name; one going missing is the defect and must throw",
  ],
};

/*
  ⚠ THE ARGUMENT TEXT IS READ TO ITS MATCHING PARENTHESIS, not to the first
  one. `[^)]*` stopped at the `)` inside `statSync(path.join(root, entry), {
  throwIfNoEntry: false })` and reported a CORRECT call as an offender —
  measured on the gate, on a suite that was already doing the right thing.
  The nested call is the ordinary way to write this, so the false alarm
  would have met every future suite in the class; it fires in the safe
  direction, which is exactly why it would have been worked around at each
  site rather than fixed here.
*/
const statCalls = (source: string): string[] => {
  const found: string[] = [];
  const opener = /statSync\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < source.length && depth > 0) {
      if (source[index] === "(") depth += 1;
      else if (source[index] === ")") depth -= 1;
      index += 1;
    }
    found.push(source.slice(start, index - 1));
  }
  return found;
};


const bareReadCount = (source: string): number =>
  [...source.matchAll(/\breadFileSync\s*\(/g)].length;

/*
  BOTH SPELLINGS OF THE TOLERANCE COUNT, and the second one is why this is a
  function rather than a regex inline (#591). `server/` reads listed entries
  through `readListedSource`; `scripts/` cannot import that module, so it has
  its own ENOENT-only twin in `scripts/lib/listedEntry.mts`. A guard that knew
  only the server spelling would have reported `stopline.mts`'s CORRECT helper
  as an offender the moment it entered the population — the shape of false
  alarm that gets a guard worked around at each site instead of fixed.
*/
const readsThroughAHelper = (source: string): boolean =>
  /\breadListedSource\s*\(/.test(source)
  || /\breadIfPresent\s*\(/.test(source)
  /* ⚠ THE STAT SPELLING COUNTS TOO (PR #592 review, finding 4). A walker
     that CLASSIFIES listed entries and never reads their bytes — every
     touch correctly through `statIfPresent` — would otherwise be told by
     the arm below to adopt a read helper it has no use for. Population is
     zero today, and that is precisely when a false alarm is cheap to
     prevent and expensive to meet: this file already records one shipping
     and being met on the gate. */
  || /\bstatIfPresent\s*\(/.test(source);

describe("the class cannot come back through an eighth suite", () => {
  it("finds the walkers at all — a guard over an empty list is not a guard", () => {
    /* Invariant 7 in miniature: if a rename empties this scan, the assertion
       below passes vacuously and the ENOENT refusal comes straight back. */
    expect(candidates().length).toBeGreaterThanOrEqual(8);
  });

  it("finds the scripts/lib walkers too — the half that was blind is not vacuous", () => {
    /*
      THE ARM THAT MAKES THE EXTENSION REAL. Everything #591 added lives behind
      `scriptLibWalkers()`, and if it stops finding anything — a rename, a move
      to `.ts`, a predicate that drifts — every arm below keeps passing over a
      population that has quietly lost its scripts half. That is exactly the
      state the guard was in on the morning #589 refused the rite.

      Both are named rather than counted. `stopline.mts` is the module the
      incident came through; `productionMention.mts` is the one an import-graph
      reading could never have reached, and naming it is what stops the
      population quietly narrowing back to the imported ones.
    */
    const walkers = scriptLibWalkers();
    expect(walkers, "no scripts/lib walker is in the population — the #591 half is blind").not.toEqual([]);
    expect(walkers).toContain("scripts/lib/stopline.mts");
    expect(walkers).toContain("scripts/lib/productionMention.mts");
    /*
      ⚠ THESE TWO ARE THE POSITIVE CONTROL FOR #594 ITSELF, and they are the
      reason that card is closed rather than merely described. Neither names a
      scripts root, so both are in the population ONLY because the walk above
      dropped `namesAScriptsRoot`. Put it back and these two arms redden — which
      is the point: without them the requirement could be restored and the only
      symptom would be two modules quietly ceasing to be watched, the exact
      silent-narrowing failure this whole file is built against.

      `importerCountDiff.mts`'s pin below is kept but RE-ARGUED: PR #592 gave it
      one because its membership hung on a backticked `scripts/` in its docblock,
      and that hole is fixed here, so its old reason is spent. Its new reason is
      the one every pin above carries — see the note at the pin itself.
    */
    expect(walkers).toContain("scripts/lib/declaredEnvNames.mts");
    expect(walkers).toContain("scripts/lib/capabilityAtlas.mts");
    /*
      ⚠ AND `importerCountDiff.mts` KEEPS ITS PIN — FOR A DIFFERENT REASON
      THAN IT WAS GIVEN ONE (PR #617 review, finding 1). The first cut of this
      change deleted it, on the argument that PR #592 pinned it to patch the
      prose-membership hole and the hole is now fixed. True, and it missed that
      the pin was doing a SECOND job its comment never stated.

      Every member above is pinned, so each one reddens if it leaves the
      population. Deleting this one left exactly one member that could leave
      silently — and it is the likeliest to, because membership now hangs on a
      module's OWN walk shape: extract its `readdirSync` into a shared helper
      and `walksAndTouches` stops matching its text. That is the delegated-walk
      shape this file already records as structurally invisible, and it is how
      #589 refused the deploy rite on a clean tree twice in one morning with
      every test green. A bare read added afterwards would go unwatched.

      The lesson is the general one and it is why this comment is long: the
      argument for deleting a guard was read off the guard's own COMMENT, and
      the comment was an incomplete account of what the guard did.
    */
    expect(walkers).toContain("scripts/lib/importerCountDiff.mts");
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
      .filter((file) => !readsThroughAHelper(readFileSync(path.join(repoRoot, file), "utf8")));

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
      for (const args of statCalls(source)) {
        if (!args.includes("throwIfNoEntry")) offenders.push(`${file}: statSync(${args.trim()})`);
      }
    }

    expect(
      offenders,
      "A listed entry can vanish before it is stat'ed, and the ENOENT refuses the deploy rite on"
      + " a clean tree (#223). Pass `{ throwIfNoEntry: false }` and skip the empty answer:\n"
      + offenders.map((row) => `  ${row}`).join("\n"),
    ).toEqual([]);
  });

  it("the helper rule accepts all three spellings and only those — DRIVEN DIRECTLY", () => {
    /*
      ⚠ THE STAT-ONLY CLAUSE HAS NO MEMBER TO DRIVE IT, SO IT IS DRIVEN HERE
      (PR #592 review, finding 4). All three walkers in the population today
      read bytes, so a sabotage that removes `statIfPresent` from the predicate
      reddens NOTHING — an untested clause sitting inside a tested guard, which
      is working law 3 exactly. Asserting the predicate against source strings
      costs nothing and closes it.

      The negative arm is the one that matters: `statSync` alone must NOT
      satisfy this, or the guard would wave through the bare call it exists to
      catch.
    */
    expect(readsThroughAHelper("const s = statIfPresent(full);")).toBe(true);
    expect(readsThroughAHelper("const t = readIfPresent(file);")).toBe(true);
    expect(readsThroughAHelper("const u = readListedSource(file);")).toBe(true);
    expect(readsThroughAHelper("const v = statSync(full);")).toBe(false);
    expect(readsThroughAHelper("const w = readFileSync(file, \"utf8\");")).toBe(false);
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

describe("the statSync matcher itself", () => {
  /*
    THE ARM THAT KEEPS THE FALSE ALARM FROM COMING BACK. No file in the class
    writes the nested shape today, so the fix above would sit unexercised and
    the `[^)]*` version would read as equally green - a guard whose repair
    nothing drives is a guard that quietly un-repairs itself.
  */
  /*
    ⚠ A STATED LIMIT: the bracket count is naive about STRING AND REGEX
    LITERALS, so `statSync(x.match(/\(/))` over-extends past the real close. It
    fails toward GREEN — a swallowed neighbour could carry the `throwIfNoEntry`
    that clears an offender — and no file in the class writes that shape. It is
    named here rather than guarded, because a literal-aware scanner is a
    tokenizer, and inventing one for a population of zero is what this repository
    does not do.
  */
  it("reads a nested call to its MATCHING parenthesis, so a correct call is not an offender", () => {
    const source = "const s = statSync(path.join(root, entry), { throwIfNoEntry: false });";
    expect(statCalls(source)).toHaveLength(1);
    expect(statCalls(source)[0]).toContain("throwIfNoEntry");
  });

  it("POSITIVE CONTROL - a nested call with no throwIfNoEntry is still caught", () => {
    const source = "const s = statSync(path.join(root, entry));";
    expect(statCalls(source)).toHaveLength(1);
    expect(statCalls(source)[0]).not.toContain("throwIfNoEntry");
  });

  it("finds every call in a file, not only the first", () => {
    const source = "statSync(a, { throwIfNoEntry: false }); statSync(path.join(b, c));";
    expect(statCalls(source)).toHaveLength(2);
  });
});
