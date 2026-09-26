/**
 * THE SCRIPTS TYPECHECK, OVER THE SCRIPTS THIS REPOSITORY ACTUALLY HAS (#1231).
 *
 * # The defect
 *
 * `tsconfig.scripts.json` includes `scripts/**​/*`, and a tsconfig cannot tell a
 * committed file from a scratch file. A shift's disposable — `npx tsx
 * scripts/_1015-something-disposable.mts`, written, run, and left on disk — is
 * therefore part of the project, so `check:scripts` turns RED on somebody else's
 * unfinished scratch work.
 *
 * ⚠ **And it fails in the worst possible direction: only locally.** CI clones
 * the repository and never sees an untracked file, so the gate is green while a
 * shift opening the tree finds one of the two checks it is told to run before it
 * closes already broken by nobody's change. #1231 was reported in FOUR
 * consecutive shift entries — 17 errors across six files, none of them the
 * reporting shift's work — and the reason nothing moved is that the reports were
 * all correct and none of them was the fix.
 *
 * ⚠ **The measured reason a baseline matters, rather than the tidy reason:**
 * #335 wrote it down — *"a shift cannot use `pnpm check` as a clean baseline when
 * it is already red, which is how a shift comes to read its own breakage as
 * noise, or stop running it"*.
 *
 * # Why the population rule is TRACKED, and not a naming convention
 *
 * The tempting one-liner is `"exclude": ["scripts/**​/*-disposable.mts"]`, and it
 * was measured before being rejected: **277 of the 544 tracked files under
 * `scripts/` are named `*-disposable.mts`**. Excluding the convention would drop
 * HALF the project — including every committed sabotage driver and court — to fix
 * a handful of scratch files. A disposable being committed is the normal end of
 * its life here: its docblock is the receipt for a measurement.
 *
 * So the rule is the honest one: **the project is the scripts this repository
 * has committed.** An untracked file is by definition not part of the
 * repository, and it is exactly the set CI does not have. The moment a shift
 * commits a disposable it is typechecked like everything else — which is the
 * behaviour the project was created for, since these are `.mts` files run by
 * `tsx` and several of them spend money.
 *
 * # What this does NOT do
 *
 * It does not delete anybody's file, and it never will. Six untracked
 * disposables in the founder's main tree are other seats' working files; #1231's
 * own body asks for a manifest before a deletion, and the right answer to
 * *"another shift's scratch reddens my baseline"* is that the scratch was never
 * in the project, not that the scratch must die.
 *
 * It also does not weaken the check for anything committed. The derived project
 * EXTENDS `tsconfig.scripts.json` and adds to its `exclude`; every compiler
 * option, lib and path stays in the one file that declares them (working law 4 —
 * a second copy of `dom.iterable` here would be the drift that config's own
 * comment is about).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

/**
 * The scripts on disk that the repository does not have: untracked and not
 * ignored, which is precisely the set a fresh clone lacks.
 *
 * Read from git rather than from a filename pattern — the pattern was measured
 * and covers half the committed tree (see the docblock). `--exclude-standard`
 * applies `.gitignore`, so an ignored path is not reported here at all; it was
 * never in the project either way, since tsc's own `exclude` has `node_modules`
 * and git's has `output/`.
 */
export function untrackedScriptFiles(cwd: string = repoRoot): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "--", "scripts"],
    { cwd, encoding: "utf8" },
  );
  return out.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

/** The derived project, written beside the one it extends so relative paths in
 *  `include`/`exclude` resolve against the same directory. */
const DERIVED = "tsconfig.scripts.tracked.json";

/**
 * The `exclude` the scripts project actually runs with, read off the config
 * chain rather than restated here.
 *
 * ⚠ **This is the whole reason the first shape of this runner was wrong, and it
 * was caught by running it rather than by reading it.** An extending config's
 * `exclude` REPLACES the inherited one — it does not merge — so a derived config
 * that wrote `["node_modules", "build", "dist", …untracked]` silently dropped
 * `**​/*.test.ts` from `tsconfig.json` and pulled every server test file into the
 * scripts project. It printed 414 errors in files nobody had touched, in 113
 * seconds, and read exactly like the defect it was written to fix.
 *
 * So the list is DERIVED from the chain (working law 4). `tsconfig.scripts.json`
 * declares no `exclude` of its own today; if it grows one, the nearest wins,
 * which is what tsc itself does.
 */
function inheritedExclude(configPath: string, seen = new Set<string>()): string[] {
  const resolved = path.resolve(repoRoot, configPath);
  if (seen.has(resolved)) throw new Error(`circular tsconfig extends at ${resolved}`);
  seen.add(resolved);
  const config = JSON.parse(readFileSync(resolved, "utf8")) as {
    exclude?: string[];
    extends?: string;
  };
  if (config.exclude) return config.exclude;
  if (config.extends) return inheritedExclude(path.resolve(path.dirname(resolved), config.extends), seen);
  throw new Error(`no exclude found on the extends chain from ${configPath}`);
}

function main(): void {
  const untracked = untrackedScriptFiles();
  const derivedPath = path.join(repoRoot, DERIVED);

  writeFileSync(
    derivedPath,
    `${JSON.stringify({
      "//": "GENERATED by scripts/typecheck-scripts.mts. Do not edit and do not commit "
        + "(.gitignore). It is tsconfig.scripts.json with the files this clone has on disk "
        + "but has not committed added to its exclude — see that runner's docblock for why "
        + "the population is TRACKED rather than a filename pattern.",
      extends: "./tsconfig.scripts.json",
      /* The chain's own exclude, plus this clone's scratch. An extending config
         REPLACES `exclude` rather than merging it, so restating a shortened list
         here would quietly widen the project — measured, see `inheritedExclude`. */
      exclude: [...inheritedExclude("tsconfig.scripts.json"), ...untracked],
    }, null, 2)}\n`,
    "utf8",
  );

  if (untracked.length > 0) {
    /* Said out loud rather than silently skipped: a check that quietly narrows
       its own population is the shape this repository keeps paying for. The list
       is capped because a tree can hold dozens and the point is the number. */
    console.log(
      `[check:scripts] ${untracked.length} untracked file(s) under scripts/ are not in the `
      + `project — they are not in the repository either:`,
    );
    for (const file of untracked.slice(0, 10)) console.log(`  ${file}`);
    if (untracked.length > 10) console.log(`  … and ${untracked.length - 10} more`);
  }

  try {
    execFileSync(
      process.execPath,
      [path.join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", DERIVED],
      { cwd: repoRoot, stdio: "inherit" },
    );
  } catch {
    /* tsc has already printed its own errors to the inherited stdio; a second
       message here would only bury them. */
    rmSync(derivedPath, { force: true });
    process.exit(1);
  }
  rmSync(derivedPath, { force: true });
}

/* Importable for its guard (`server/scriptsTypecheckPopulation.test.ts`), which
   drives `untrackedScriptFiles` against real temporary repositories — so the
   rule is proven at git rather than at a comment. */
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main();
}
