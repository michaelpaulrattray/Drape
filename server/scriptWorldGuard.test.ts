import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "./testing/listedSource";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { runHook } from "./testing/hookDriver";

/* This suite drives a real child process, so it declares the class's timeout
   rather than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * A SCRIPT THAT READS THE APP'S DATABASE DECLARES WHICH WORLD IT IS IN.
 *
 * `railway run --service MySQL` injects that service's variables and **no
 * `DATABASE_URL`**. A script that loads `.env` for anything else — a `FAL_KEY`,
 * an R2 credential — then reaches for `DATABASE_URL` gets the DEV database
 * back, under a command whose entire purpose was to read production, with
 * nothing in the output to say so. That is how a "production is empty" reading
 * was once taken from dev.
 *
 * `assertOneWorld` (`scripts/lib/worldGuard.mts`) refuses that process by name.
 * It is inert outside a Railway run, so a plain `npx tsx` against dev never
 * sees it — which is exactly why it is cheap to require and easy to forget.
 *
 * # Why a scan and not a list
 *
 * A roadmap line has said "11 dev-fixture `getDb()` scripts still lack world
 * guards — guard when next touched, or burn down in one sitting" since
 * 2026-08-09. By 2026-08-16 it was **thirty-four**, and the line had not
 * changed. A burn-down without a guard is a burn-down with a schedule for
 * coming back.
 *
 * # The scope is derived twice, and neither half is a hand list
 *
 * IN scope: a file under `scripts/` whose text calls `getDb()` — the app's own
 * pool, which reads `DATABASE_URL` and nothing else. The scan decides that, so
 * a script written tomorrow is in scope the moment it calls it.
 *
 * OUT of scope: a file the repository does not contain — an untracked one-shot
 * bench. The module's own header makes the argument for excluding them: *"a
 * guard people learn to work around is a guard that is off."* A bench that ran
 * once against dev and will never be run again does not need a ceremony, and
 * requiring one on hundreds of files is how the ceremony stops being read.
 *
 * This was keyed on the `-disposable.mts` SUFFIX until 2026-08-19, and the
 * suffix is not the sentence — see `trackedScripts` for the day the two came
 * apart and what it cost. Both halves of the scope are now derived, and neither
 * is a hand list.
 *
 * The residue — a permanent script that genuinely should not carry the guard —
 * goes in `EXEMPT` with a reason, and the reason is asserted to exist.
 */

const repoRoot = path.resolve(import.meta.dirname, "..");
const scriptsDir = path.join(repoRoot, "scripts");

/**
 * Permanent scripts that call `getDb()` and deliberately carry no guard.
 *
 * Empty on purpose as of 2026-08-16: the burn-down closed all twenty-one. An
 * entry here is a decision, not a backlog.
 */
const EXEMPT: Record<string, string> = {};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.m?ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Everything under `scripts/` that reaches the app's own pool. */
export function databaseScripts(root: string): string[] {
  return walk(root)
    /* A file this walk just listed can be gone by the time it is read (#223).
       This suite's own control no longer plants in the real `scripts/`
       (#2361), but the tree's untracked one-shot benches still come and go
       under a running walk, so the tolerance stays. */
    .filter((file) => readListedSource(file)?.includes("getDb()") ?? false)
    .map((file) => path.relative(root, file).split(path.sep).join("/"));
}

/**
 * Does this file CALL the guard — not merely import it?
 *
 * The distinction is the whole point, and the first cut of this checker missed
 * it: matching the bare identifier `assertOneWorld` is satisfied by the import
 * line alone. Deleting the call and leaving the import — which is exactly what
 * a careless edit or a bad merge produces — left the scan green. Found by
 * sabotaging a guarded script and watching nothing happen. Invariant 7: a
 * control that is not invoked does not exist.
 */
function callsTheGuard(source: string): boolean {
  return /\bassertOneWorld\s*\(/.test(source);
}

/**
 * THE ONE-SHOTS, BY WHAT MAKES THEM ONE-SHOTS — not by how they are spelled.
 *
 * The exemption above used to read `relative.endsWith("-disposable.mts")`, and
 * the argument for it was never about the letters: *"a bench that ran once
 * against dev and will never be run again does not need a ceremony."* A bench
 * that will never be run again is a file **the repository does not contain**.
 * Tracking status is that sentence; the suffix is a convention that agrees with
 * it right up until it does not.
 *
 * It stopped agreeing on 2026-08-19. Twenty-four `-disposable.mts` files were
 * promoted into the repository because tracked source and standing design notes
 * cite them by name — they are standing instruments now, and three of them read
 * the app's database. Under the old key they kept a one-shot's exemption
 * forever: guard calls were added to all three, and **deleting those calls
 * would not have reddened anything.** That is invariant 7 in the same shape the
 * sabotage found once already — an import without a call is not a guard, and a
 * guard nothing can fail is not a control.
 *
 * A rename would have closed it for those three files and left the class open
 * for the twenty-fifth promotion. This closes the class: the names stay as the
 * citers spell them, and the suffix is now residue.
 */
function trackedScripts(root: string, repo: string = repoRoot): Set<string> {
  /* Through `runHook` like every other child in this suite: a git that never
     ran throws, and a git that ran and failed is refused by its exit code —
     both before an empty listing could exempt the tree. (A listing past
     spawnSync's 1 MB default buffer kills the child, which `runHook` also
     throws on; the listing is ~24 KB today.)

     `repo` is a parameter so the positive control can drive this exact
     function at a scratch repository instead of planting in the real
     `scripts/` (#2361). The pathspec is derived from `root`, so the real call
     still asks git for `scripts` and nothing else. */
  const pathspec = path.relative(repo, root).split(path.sep).join("/");
  const run = runHook("git", ["ls-files", "--", pathspec], { cwd: repo });
  if (run.status !== 0) throw new Error(`git ls-files exited ${run.status} — the exemption cannot be decided`);
  const listed = run.stdout;
  const names = listed
    .split(/\r?\n/)
    .filter((line) => line !== "")
    .map((line) => path.relative(root, path.join(repo, line)).split(path.sep).join("/"));
  /*
    REFUSE, DO NOT ALLOW, WHEN THE DEPENDENCY IS MISSING. This predicate decides
    who is EXEMPT, so an empty answer — git absent, a detached export, a build
    context that is not a checkout — would exempt every script in the tree and
    turn the whole suite green by making it blind. Invariant 7's other half.
  */
  if (names.length === 0) throw new Error("git ls-files returned no scripts — the exemption cannot be decided");
  return new Set(names);
}

/** In scope, unguarded, and not a one-shot bench. */
export function unguardedScripts(root: string, repo: string = repoRoot): string[] {
  const tracked = trackedScripts(root, repo);
  return databaseScripts(root).filter((relative) => {
    if (!tracked.has(relative)) return false;
    if (relative in EXEMPT) return false;
    const source = readListedSource(path.join(root, relative));
    if (source === null) return false; // gone since the walk listed it (#223)
    return !callsTheGuard(source);
  });
}

describe("a script that reads the app's database declares its world", () => {
  it("every permanent getDb() script calls assertOneWorld", () => {
    const unguarded = unguardedScripts(scriptsDir);
    expect(
      unguarded,
      `Add \`assertOneWorld(["DATABASE_URL"])\` after the imports — it is inert `
        + `locally and refuses a half-production process under \`railway run\`. `
        /* The remedy by path (fable-1038 §4): a guard that names its remedy
           gets followed, one that only refuses gets worked around. */
        + `\`scripts/SKELETON-disposable.mts\` is the shape both script guards `
        + `want; copy it rather than starting from a blank file:\n`
        + unguarded.map((f) => `  scripts/${f}`).join("\n"),
    ).toEqual([]);
  });

  /*
    POSITIVE CONTROL, on real files in a real git repository rather than a string.

    Without it the assertion above is what a scan that found NOTHING prints,
    and a walk that silently stopped reading — a renamed directory, a changed
    extension — is indistinguishable from a fully guarded repository.

    The first cut of this control leaned on the untracked one-shot benches as
    a known-positive population — which exists only on a working dev machine.
    A clean checkout (CI) has no litter, so the control failed there for lack
    of a fixture rather than for a blind reader; the second cut PLANTED an
    untracked unguarded script in the real `scripts/` and removed it after.

    ⚠ AND THE PLANT WAS A FIXTURE EVERY OTHER WALKER OF `scripts/` COULD SEE.
    vitest runs test FILES in parallel, and several suites walk that directory.
    #223 and #589 were the plant VANISHING mid-walk (an ENOENT that refused the
    deploy rite on a clean tree), repaired by tolerating absence. #2361 is the
    same race the other way: the plant was PRESENT while
    `scriptExitDiscipline.test.ts` walked, and was judged as a real breach —
    "last statement does not exit: const db = getDb();" — 5 runs out of 5 with
    the three script guards in one invocation. Tolerating absence does nothing
    about presence, and excluding this one filename from that one walker would
    leave the class open for the next fixture.

    So the control no longer touches the real tree at all. It builds a scratch
    repository under the OS temp directory and drives THE SAME FUNCTIONS the
    main assertion runs — `unguardedScripts` and `trackedScripts`, git and all —
    at it. That is stronger than the plant, not merely safer: the plant could
    only prove the reader finds an UNTRACKED file, while the main assertion is
    about TRACKED ones. This proves the main path itself reports a tracked,
    unguarded script, and stays quiet on a guarded one, on one that never
    reaches the pool, on a one-shot bench, and on a file outside the root.
  */
  it("POSITIVE CONTROL — the main path does find a tracked, unguarded getDb() script", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "drape-2361-world-guard-"));
    try {
      const git = (...args: string[]) => {
        const run = runHook("git", args, { cwd: repo });
        if (run.status !== 0) throw new Error(`git ${args.join(" ")} exited ${run.status}: ${run.stderr}`);
      };
      git("init", "-q");
      const scripts = path.join(repo, "scripts");
      mkdirSync(path.join(scripts, "lib"), { recursive: true });
      writeFileSync(path.join(scripts, "unguarded.mts"), "const db = getDb();\n");
      writeFileSync(path.join(scripts, "lib", "nested-unguarded.mts"), "const db = getDb();\n");
      writeFileSync(path.join(scripts, "guarded.mts"), 'assertOneWorld(["DATABASE_URL"]);\nconst db = getDb();\n');
      writeFileSync(path.join(scripts, "no-database.mts"), "console.log(1);\n");
      /* The index is what `git ls-files` reads; no commit is needed. */
      git(
        "add", "--",
        "scripts/unguarded.mts", "scripts/lib/nested-unguarded.mts", "scripts/guarded.mts", "scripts/no-database.mts",
      );
      /* A one-shot bench: unguarded, and deliberately never added. */
      writeFileSync(path.join(scripts, "bench-disposable.mts"), "const db = getDb();\n");
      /* Tracked and unguarded, but outside the scripts root — not this guard's business. */
      writeFileSync(path.join(repo, "outside.mts"), "const db = getDb();\n");
      git("add", "--", "outside.mts");

      /* POSITIVE, and exact: both tracked unguarded scripts, the nested one
         included, and nothing else. */
      expect(unguardedScripts(scripts, repo).sort()).toEqual(["lib/nested-unguarded.mts", "unguarded.mts"]);
      /* The bench IS seen by the reader, and is exempt only for being untracked. */
      expect(databaseScripts(scripts)).toContain("bench-disposable.mts");
      const tracked = trackedScripts(scripts, repo);
      expect(tracked.has("bench-disposable.mts"), "the bench must read as untracked").toBe(false);
      expect(tracked.has("guarded.mts"), "a tracked file must read as tracked").toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  /*
    THE EXEMPTION PREDICATE'S OWN CONTROL — and it is the one that matters most,
    because this predicate decides who is exempt and it fails in the SILENT
    direction. `trackedScripts` returning nothing does not redden anything: it
    exempts the entire tree, and "every permanent getDb() script calls
    assertOneWorld" passes because the reader has gone blind. The refusal inside
    the function is the guard; this proves the refusal is reachable and that a
    real answer discriminates in both directions.
  */
  it("the tracked/untracked split is real in both directions", () => {
    const tracked = trackedScripts(scriptsDir);
    /* POSITIVE: a file this suite cannot run without is tracked. */
    expect(tracked.has("lib/worldGuard.mts"), "the guard module itself reads as untracked").toBe(true);
    /* NEGATIVE: a name git has never seen is not tracked — the set is not "everything". */
    expect(tracked.has("no-such-script-a4f19c-disposable.mts")).toBe(false);
    expect(tracked.size, "suspiciously few tracked scripts — is the walk in the right tree?")
      .toBeGreaterThan(50);
  });

  /* The scan must reach the tree: zero files read is zero violations found. */
  it("the scan reads the scripts tree", () => {
    expect(walk(scriptsDir).length).toBeGreaterThan(100);
    expect(databaseScripts(scriptsDir).length).toBeGreaterThan(10);
  });

  /*
    The hole the sabotage found, pinned so it cannot come back: an import
    without a call is not a guard. Driven directly rather than through the
    tree, because the tree is (correctly) free of the shape.
  */
  it("an import without a call does not count as guarded", () => {
    const importOnly = `import { assertOneWorld } from "./lib/worldGuard.mts";\nconst db = await getDb();\n`;
    expect(callsTheGuard(importOnly), "the import line must not satisfy the check").toBe(false);
    expect(callsTheGuard(`${importOnly}assertOneWorld(["DATABASE_URL"]);\n`)).toBe(true);
  });

  it("every exemption names a file that still exists, with a reason", () => {
    for (const [relative, reason] of Object.entries(EXEMPT)) {
      expect(databaseScripts(scriptsDir), `stale exemption: ${relative}`).toContain(relative);
      expect(reason.length, `exemption without a reason: ${relative}`).toBeGreaterThan(10);
    }
  });
});

/**
 * THE GUARD, DRIVEN ON THE CALLER'S OWN PATH (#2156).
 *
 * Each arm runs `assertOneWorld` in a real child process, with a real `.env`
 * file in its working directory and a process environment shaped like one
 * Railway invocation — so the declaration a caller makes, the file reader and
 * the refusal are all the shipped code, not a constant passed in by hand.
 *
 * Every value is a FAKE written by this suite, the child is given no
 * environment but these fakes (the parent's own `.env`-loaded values never
 * reach it), and the refusal is read by KEY NAME. An arm also checks that no
 * value — fake or otherwise — is ever echoed into the refusal.
 *
 * The fakes have the measured shape: production and dev share the R2 endpoint
 * and credential, and differ on the database, the bucket and its base.
 */
describe("the world guard on the caller's path (#2156)", () => {
  const dev = {
    DATABASE_URL: "mysql://fake-dev-2156",
    R2_BUCKET: "fake-bucket-dev-2156",
    R2_PUBLIC_URL: "https://fake-pub-dev-2156.example",
  };
  const production = {
    DATABASE_URL: "mysql://fake-production-2156",
    R2_BUCKET: "fake-bucket-production-2156",
    R2_PUBLIC_URL: "https://fake-pub-production-2156.example",
  };
  /* One R2 account serves both worlds — identical on purpose. */
  const shared = {
    R2_ENDPOINT: "https://fake-endpoint-2156.example",
    R2_ACCESS_KEY_ID: "fake-access-key-2156",
    R2_SECRET_ACCESS_KEY: "fake-secret-2156",
  };
  /* A declared key that is not a world-key at all: still guarded. */
  const other = { FAKE_OTHER_KEY_2156: "fake-other-2156" };
  const everyFakeValue = [dev, production, shared, other].flatMap((set) => Object.values(set));

  const guardUrl = pathToFileURL(path.join(scriptsDir, "lib", "worldGuard.mts")).href;
  const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;

  /** `declaration`: "app-write-path" | "default" | a JSON list of keys. */
  function drive(environment: Record<string, string>, declaration: string): { refused: string[] | null; output: string } {
    const dir = mkdtempSync(path.join(tmpdir(), "world-guard-2156-"));
    try {
      writeFileSync(path.join(dir, ".env"), Object.entries({ ...dev, ...shared, ...other })
        .map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
      writeFileSync(path.join(dir, "drive.mts"), [
        `import { assertOneWorld, APP_WRITE_PATH_KEYS } from ${JSON.stringify(guardUrl)};`,
        `const declaration = process.argv[2];`,
        `try {`,
        `  if (declaration === "app-write-path") assertOneWorld(APP_WRITE_PATH_KEYS);`,
        `  else if (declaration === "default") assertOneWorld();`,
        `  else assertOneWorld(JSON.parse(declaration));`,
        `  console.log("ALLOWED");`,
        `} catch (error) {`,
        `  console.log("REFUSED " + (error as Error).message);`,
        `}`,
      ].join("\n"));
      /* Through `runHook`, so a child that never ran THROWS rather than
         handing back a status this arm could misread (#640). */
      const child = runHook(process.execPath, ["--import", tsxLoader, "drive.mts", declaration], {
        cwd: dir,
        env: {
          PATH: process.env.PATH ?? "",
          SystemRoot: process.env.SystemRoot ?? "",
          ...environment,
        },
      });
      const output = `${child.stdout}${child.stderr}`;
      expect(child.status, output).toBe(0);
      if (/^ALLOWED/m.test(output)) return { refused: null, output };
      const match = /^REFUSED Mixed worlds: (.+?) currently hold/m.exec(output);
      expect(match, `the child neither allowed nor refused in the guard's words:\n${output}`).not.toBeNull();
      return { refused: match![1]!.split(", ").sort(), output };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const inRailway = { RAILWAY_ENVIRONMENT_NAME: "production", RAILWAY_SERVICE_NAME: "fake" };
  /* `railway run --service Drape`: the service defines all six itself. */
  const serviceDrape = { ...inRailway, ...production, ...shared };
  /* `railway run --service MySQL` + dotenv: the service defines none of the
     six, so every one of them is the `.env` value. */
  const serviceMySql = { ...inRailway, ...dev, ...shared };

  it("ALLOWS the correct `--service Drape` run of APP_WRITE_PATH_KEYS — the false refusal of the card", () => {
    expect(drive(serviceDrape, "app-write-path").refused).toBeNull();
  });

  it("REFUSES `--service MySQL` by the three keys that differ, and never the three that cannot", () => {
    expect(drive(serviceMySql, "app-write-path").refused)
      .toEqual(["DATABASE_URL", "R2_BUCKET", "R2_PUBLIC_URL"]);
  });

  it("REFUSES the third bite: rows pointed at production by hand, the bucket left to .env", () => {
    expect(drive({ ...serviceMySql, DATABASE_URL: production.DATABASE_URL }, "app-write-path").refused)
      .toEqual(["R2_BUCKET", "R2_PUBLIC_URL"]);
  });

  it("the default declaration gets the same answer in both directions", () => {
    expect(drive(serviceDrape, "default").refused).toBeNull();
    expect(drive(serviceMySql, "default").refused).toEqual(["DATABASE_URL", "R2_BUCKET", "R2_PUBLIC_URL"]);
  });

  /* Only the measured-shared keys are skipped — a subtraction, not an
     intersection, so a caller's non-world key is exactly as guarded as before. */
  it("a declared key outside the world-keys is still refused when .env supplied it", () => {
    expect(drive({ ...serviceDrape, ...other }, JSON.stringify(["FAKE_OTHER_KEY_2156"])).refused)
      .toEqual(["FAKE_OTHER_KEY_2156"]);
  });

  it("stays inert outside a Railway run, as before", () => {
    const { RAILWAY_ENVIRONMENT_NAME: _env, RAILWAY_SERVICE_NAME: _service, ...local } = serviceMySql;
    expect(drive(local, "app-write-path").refused).toBeNull();
  });

  it("names keys, never values, in the refusal", () => {
    const { output } = drive({ ...serviceMySql, ...other }, JSON.stringify([...Object.keys(dev), ...Object.keys(shared), ...Object.keys(other)]));
    for (const value of everyFakeValue) expect(output.includes(value), "a value reached the refusal").toBe(false);
  });
});
