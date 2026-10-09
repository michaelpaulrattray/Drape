import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "./testing/listedSource";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

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
    /* A file this walk just listed can be gone by the time it is read: the
       positive control below plants one in this very directory while six other
       suites are walking it in parallel workers (#223). */
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
function trackedScripts(root: string): Set<string> {
  const listed = execFileSync("git", ["ls-files", "--", "scripts"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const names = listed
    .split(/\r?\n/)
    .filter((line) => line !== "")
    .map((line) => path.relative(root, path.join(repoRoot, line)).split(path.sep).join("/"));
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
export function unguardedScripts(root: string): string[] {
  const tracked = trackedScripts(root);
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
    POSITIVE CONTROL, on a real unguarded file rather than a string.

    Without it the assertion above is what a scan that found NOTHING prints,
    and a walk that silently stopped reading — a renamed directory, a changed
    extension — is indistinguishable from a fully guarded repository.

    The first cut of this control leaned on the untracked one-shot benches as
    a known-positive population — which exists only on a working dev machine.
    A clean checkout (CI) has no litter, so the control failed there for lack
    of a fixture rather than for a blind reader; its own failure message said
    to swap in a synthetic one, and this is that swap: the control now PLANTS
    an untracked unguarded script, proves the reader finds it, and removes it.
    The main assertion above filters to tracked files, so the plant can never
    redden it, even mid-flight.

    ⚠ AND THAT SENTENCE WAS TRUE OF THIS SUITE AND SILENT ABOUT EVERY OTHER ONE
    (#223, 2026-08-29). vitest runs test FILES in parallel, and six other suites
    walk this same directory: they list (the plant is there), then read each
    entry (the plant is gone). The ENOENT came out of a `.filter()` in
    `uploadRefusalCopy.test.ts` and REFUSED THE DEPLOY RITE ON A CLEAN TREE.
    The plant stays in the real tree — that is what makes this control worth
    having — and the readers now tolerate a listed file that has left, through
    `readListedSource` (`server/testing/listedSource.ts`), which carries the
    receipt and the reasoning.
  */
  it("POSITIVE CONTROL — the reader does find an unguarded getDb() script", () => {
    const plantedName = `_scriptworldguard-positive-control-${process.pid}-disposable.mts`;
    const plantedPath = path.join(scriptsDir, plantedName);
    writeFileSync(
      plantedPath,
      "// synthetic fixture planted by scriptWorldGuard.test.ts — deleted by the same test\nconst db = getDb();\n",
    );
    try {
      const tracked = trackedScripts(scriptsDir);
      expect(tracked.has(plantedName), "the planted fixture must read as untracked").toBe(false);
      const benches = databaseScripts(scriptsDir)
        .filter((relative) => !tracked.has(relative))
        .filter((relative) => {
          const source = readListedSource(path.join(scriptsDir, relative));
          return source !== null && !callsTheGuard(source);
        });
      expect(benches).toContain(plantedName);
    } finally {
      unlinkSync(plantedPath);
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
      const child = spawnSync(process.execPath, ["--import", tsxLoader, "drive.mts", declaration], {
        cwd: dir,
        encoding: "utf8",
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
