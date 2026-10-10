import { execFileSync } from "node:child_process";
import { join } from "node:path";

import ts from "typescript";

import { readListedSource } from "./listedSource";

/**
 * A LAUNCHER THAT NEEDS A SHELL, HANDED A PATH THAT HAS NO SHELL ON IT — the
 * derived population behind `server/shellLessPathLaunch.test.ts` (#2227).
 *
 * # The class, and both of its instances cost a gate run
 *
 * An arm that proves a child cannot reach some binary does it by handing the
 * child a PATH that cannot reach it — usually `dirname(process.execPath)`, so
 * node itself still works and nothing else does. Launch the script under test
 * through `npx` in that environment and the launch fails before the script
 * starts: **`npx` spawns `sh` to run the bin, and `sh` lives in `/bin`, which
 * that PATH deliberately withholds.** The arm then reports its launcher's
 * failure as the subject's verdict.
 *
 * ⚠ **AND IT IS LINUX-ONLY, WHICH IS THE SLOWEST POSSIBLE WAY TO LEARN IT.** On
 * Windows the same arm passes, because `runHook` is given `shell: true` there
 * and `cmd` is found by absolute path. So the author sees green and CI sees red.
 *
 * | | where | how it arrived |
 * |---|---|---|
 * | 1 | `server/nextUpEscalation.test.ts` | `spawn sh ENOENT`, empty stdout — run 36219309593 |
 * | 2 | `server/patrolClocks.test.ts` | `expected 254 to be +0` — run 38047540460, PR #2213 |
 *
 * Instance 1's reasoning was written into a comment that only that file
 * carries, and instance 2 was written months later by a seat that had no way to
 * know the first existed. That is the shape a derived guard answers and a
 * comment does not.
 *
 * # ⚠ WHY THIS IS A PARSER AND NOT A REGEX, MEASURED RATHER THAN PREFERRED
 *
 * The card proposed keying on two facts in one FILE — *assigns a PATH without
 * the shell's directory* AND *launches `"npx"`*. Driven over the tree the day
 * this was written, that key returns **exactly two files: the two already
 * repaired.** Both still launch `npx` from an ordinary helper under the
 * inherited PATH — `patrolClocks.test.ts`'s own helper has 24 green arms on it
 * — and both build a stripped env for one arm that correctly uses
 * `process.execPath`. So a file-level reading is **2 false positives out of 2
 * flags and 0 true positives**: it would have to be allowlisted onto both
 * subjects on the day it shipped, which is `fix-drops-subject-from-guard`
 * arriving before the fix.
 *
 * The question is syntactic — *is the env handed to THIS launch the stripped
 * one?* — so it is asked of the call, with TypeScript's own parser, which is
 * the fidelity law's answer and the same one
 * `server/testing/errorMessageInterpolations.ts` reached for. Measured with the
 * call-level key: **0 flags on the repaired tree**, and both instances' real
 * pre-repair bytes flag, which the guard's arms drive as fixtures.
 *
 * # THE LAUNCHERS, and why the list is not just `npx`
 *
 * `npm` and `pnpm` are the same shim shape — a shell script on POSIX — so a
 * guard that knew only `npx` would let the next instance through for the sake
 * of one word. **Neither has a live instance today**, which is stated because a
 * population of zero is the honest reading rather than coverage.
 *
 * ⚠ **AND A BARE BINARY NAME IS DELIBERATELY NOT ON THIS LIST.** `git`, `gh`
 * and friends are unreachable under a stripped PATH too — and in both instances
 * that is **the subject of the arm**, proven unreachable on purpose before the
 * launch under test. A guard that flagged those would be indicting the test for
 * testing.
 *
 * # ITS LIMITS, declared rather than discovered
 *
 * 1. **A spread carries nothing.** `{ ...stripped }` with no `PATH` of its own
 *    reads as an ordinary env; only an object that assigns `PATH`/`Path`
 *    itself, or a reference to one that does, is seen.
 * 2. **One hop, by name, inside one file.** A stripped env built by a helper
 *    function and returned, or passed in as a parameter, is invisible here.
 * 3. **Shorthand `{ PATH }` reads as unknown**, not as stripped — the value is
 *    an identifier whose contents this reader does not follow.
 * 4. **Last-write-wins is not modelled**: an object assigning `PATH` twice, the
 *    second from the real one, reads as stripped. No live instance.
 *
 * So a clean reading is a FLOOR and not coverage, which is the house sentence
 * for every reader in this family.
 */

/**
 * Launchers that are resolved THROUGH A SHELL rather than exec'd directly, so a
 * PATH without the shell on it cannot start them whatever else it carries.
 */
export const SHELL_RESOLVED_LAUNCHERS = ["npx", "npm", "pnpm"] as const;

/** Where the population is read from. */
const SOURCE_GLOBS = ["*.ts", "*.tsx", "*.mts", "*.mjs"];

export type LaunchSite = {
  /** Repo-relative, forward-slashed. */
  file: string;
  /** 1-indexed line of the launch. */
  line: number;
  /** Which launcher — one of `SHELL_RESOLVED_LAUNCHERS`. */
  launcher: string;
  /** How the stripped env reached it, for the message the guard prints. */
  via: "inline" | string;
};

function isProcessEnv(node: ts.Node): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === "env" &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process"
  );
}

/** Does this expression reach for the REAL PATH anywhere inside itself? */
function derivesFromRealPath(node: ts.Node): boolean {
  let found = false;
  const walk = (child: ts.Node): void => {
    if (found) return;
    /* `process.env.PATH`, and the Windows twin. */
    if (ts.isPropertyAccessExpression(child) && /^(?:PATH|Path)$/.test(child.name.text)) {
      if (isProcessEnv(child.expression)) found = true;
    }
    /* `process.env["PATH"]` — the same fact spelled as an element access. */
    if (ts.isElementAccessExpression(child) && isProcessEnv(child.expression)) found = true;
    ts.forEachChild(child, walk);
  };
  walk(node);
  return found;
}

/** The name of a property, whether it is written bare or quoted. */
function propertyName(name: ts.PropertyName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  return null;
}

/**
 * Does this object literal assign a PATH that cannot reach a shell?
 *
 * Exported so the guard can drive it on its own, because an arm that only ever
 * reaches this through the tree walk cannot tell a reader that answers wrongly
 * from a tree that has nothing in it to find (law 2).
 */
export function stripsTheShell(object: ts.ObjectLiteralExpression): boolean {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyName(property.name);
    if (name !== "PATH" && name !== "Path") continue;
    if (!derivesFromRealPath(property.initializer)) return true;
  }
  return false;
}

/** The text an env is referred to by, for keying one reference against another. */
function envKey(node: ts.Node): string | null {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    const base = envKey(node.expression);
    return base === null ? null : `${base}.${node.name.text}`;
  }
  return null;
}

/**
 * Every env in this file that has had its shell taken away, keyed by the text
 * it is referred to by — `env`, `process.env`, `fixture.env`.
 */
function strippedEnvsIn(sourceFile: ts.SourceFile): Set<string> {
  const stripped = new Set<string>();
  const visit = (node: ts.Node): void => {
    /* `const env = { ...process.env, PATH: nodeDir }` — instance 2's spelling. */
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer) &&
      stripsTheShell(node.initializer)
    ) {
      stripped.add(node.name.text);
    }
    /* `env.PATH = nodeDir` — the assignment spelling, which is instance 1's. */
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      /^(?:PATH|Path)$/.test(node.left.name.text) &&
      !derivesFromRealPath(node.right)
    ) {
      const key = envKey(node.left.expression);
      if (key !== null) stripped.add(key);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return stripped;
}

/** Which env a call's options hand over, if this call hands one over at all. */
function envHandedTo(
  call: ts.CallExpression,
): { inline: ts.ObjectLiteralExpression } | { named: string } | null {
  for (const argument of call.arguments) {
    if (!ts.isObjectLiteralExpression(argument)) continue;
    for (const property of argument.properties) {
      if (ts.isShorthandPropertyAssignment(property) && property.name.text === "env") {
        return { named: property.name.text };
      }
      if (!ts.isPropertyAssignment(property)) continue;
      if (propertyName(property.name) !== "env") continue;
      if (ts.isObjectLiteralExpression(property.initializer)) return { inline: property.initializer };
      const key = envKey(property.initializer);
      if (key !== null) return { named: key };
    }
  }
  return null;
}

/** Is this call's first argument one of the shell-resolved launchers? */
function launcherOf(call: ts.CallExpression): string | null {
  const first = call.arguments[0];
  if (!first || !ts.isStringLiteral(first)) return null;
  return (SHELL_RESOLVED_LAUNCHERS as readonly string[]).includes(first.text) ? first.text : null;
}

/**
 * The launches in ONE file that cannot start. Exported for the guard's fixture
 * arms, which drive the two instances' real pre-repair bytes.
 */
export function shellLessPathLaunchesIn(file: string, source: string): LaunchSite[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const stripped = strippedEnvsIn(sourceFile);
  const sites: LaunchSite[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const launcher = launcherOf(node);
      if (launcher !== null) {
        const handed = envHandedTo(node);
        let via: LaunchSite["via"] | null = null;
        if (handed === null) via = null;
        else if ("inline" in handed) via = stripsTheShell(handed.inline) ? "inline" : null;
        else via = stripped.has(handed.named) ? handed.named : null;
        if (via !== null) {
          sites.push({
            file,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            launcher,
            via,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return sites;
}

/** How many shell-resolved launches a file makes, stripped env or not. */
export function countShellResolvedLaunches(file: string, source: string): number {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let found = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && launcherOf(node) !== null) found += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * The reading over the whole tree, with the FLOOR beside it.
 *
 * `launches` is how many shell-resolved launches the walk saw at all. A reader
 * that silently stopped parsing reports a clean tree, and this is the number
 * that says otherwise — the same half every reader in this family carries.
 */
export function shellLessPathLaunches(repoRoot: string): {
  sites: LaunchSite[];
  files: number;
  launches: number;
} {
  const tracked = execFileSync("git", ["ls-files", ...SOURCE_GLOBS], {
    encoding: "utf8",
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .map((line) => line.trim().replace(/\\/g, "/"))
    .filter((line) => line.length > 0);

  if (tracked.length === 0) {
    /* A sweep over no files answers every question with "clean". */
    throw new Error(
      `shellLessPathLaunches: git ls-files returned no source under ${repoRoot}. ` +
        "A population of zero is a broken reading, not a clean tree.",
    );
  }

  const sites: LaunchSite[] = [];
  let files = 0;
  let launches = 0;

  for (const file of tracked) {
    const source = readListedSource(join(repoRoot, file));
    if (source === null) continue;
    files += 1;
    launches += countShellResolvedLaunches(file, source);
    sites.push(...shellLessPathLaunchesIn(file, source));
  }

  return { sites, files, launches };
}
