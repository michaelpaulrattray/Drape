/**
 * A FROZEN LINE THE TOOLING CAN FEEL.
 *
 * # Why this exists (fable-117, after the second expensive miss)
 *
 * The mailbox's acknowledgment rule — list `fable-*.md` before every chunk —
 * has now failed twice in memory, and the second failure put **150 credits
 * through a stop-the-line the founder's own screenshots had ordered**. The
 * shift that missed it was not careless: it had checked the mailbox recently,
 * and a walk is the longest chunk there is, so "recently" and "before this
 * chunk" quietly came apart.
 *
 * Twice is a class, and the answer to a class is never "remember harder". So
 * the freeze moved out of memory and into a file:
 *
 *   `.agents/mailbox/STOPLINE` exists  →  nothing may spend.
 *
 * Only Fable creates or removes it, always paired with a numbered mailbox
 * message. Everything that can charge the founder's account asks this module
 * first, and refuses while the file is there.
 *
 * # The roster is DERIVED, not maintained
 *
 * `worldGuard`'s header records three bites of the same shape: a hand-kept list
 * of "the scripts that need the guard" is a second source of truth and it drifts
 * from the first one. So the roster here is not a list — it is the `--spend`
 * gate itself. A script that spends already has one, `spendAuthorized()` IS
 * that gate, and the control below sweeps `scripts/` for any file that still
 * parses `--spend` by hand. A new spender cannot quietly opt out; it has to
 * delete a passing control to do it.
 *
 * # What it deliberately does NOT do
 *
 * A dry run is not stopped. A frozen shift still has to read plans, count
 * costs and prepare the run that follows the thaw, and a guard that blocks
 * harmless work is a guard people learn to route around — which is how a guard
 * becomes decorative. The refusal lands on the *spend*, which is the only thing
 * the freeze is about.
 *
 * There is also no environment-variable bypass, on purpose. A bypass is a thing
 * a hurried shift can set, and the whole point is that this refusal cannot be
 * argued with by the party under time pressure.
 *
 * # Honest limit
 *
 * `.agents/` is untracked and machine-local, so on a machine with no mailbox
 * there is no file and this guard is inert. That is correct — a freeze is an
 * instruction to a shift, and a machine with no mailbox is running no shift —
 * but it means the guard protects THIS bench rather than the repository. The
 * path is resolved from this module's own location rather than the working
 * directory, so at least a run started from a subdirectory cannot read "no
 * freeze" out of a wrong CWD.
 *
 *   npx tsx scripts/lib/stopline.mts --prove   # controls, both directions
 */
import { existsSync, readFileSync, readdirSync, statSync, type Stats } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Resolved from the module, never from the CWD — see the header. */
export const STOPLINE_PATH = fileURLToPath(new URL("../../.agents/mailbox/STOPLINE", import.meta.url));

/**
 * The freeze, if there is one: the file's own words, which name the rulings.
 *
 * EXISTENCE is the signal, not the contents. An empty STOPLINE is still a
 * frozen line — a guard that required the file to say the right thing would be
 * one typo away from waving a spend through.
 */
export function readStopline(path: string = STOPLINE_PATH): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    /* Unreadable is not "absent". Refuse on what we know: the file is there. */
    return "(present, unreadable)";
  }
}

/**
 * Refuse to spend while the line is frozen.
 *
 * `what` names the thing that would have been charged, so the refusal reads as
 * an answer rather than a crash.
 */
export function assertLineIsRunning(what: string, path: string = STOPLINE_PATH): void {
  const frozen = readStopline(path);
  if (frozen === null) return;
  throw new Error(
    `STOP-THE-LINE: refusing to ${what} while ${path} exists.\n\n`
    + `${frozen.trim()}\n\n`
    + "Only Fable removes that file, by a numbered mailbox message saying so. "
    + "List `.agents/mailbox/fable-*.md` and read everything after your last acknowledged number.",
  );
}

/**
 * THE SPEND GATE AND THE FREEZE, IN ONE ANSWER.
 *
 * Callers used to write `process.argv.includes("--spend")`. They call this
 * instead, so the question "may I spend?" has exactly one implementation and
 * the freeze cannot be true for one script and invisible to another.
 */
export function spendAuthorized(what: string, argv: readonly string[] = process.argv): boolean {
  if (!argv.includes("--spend")) return false;
  assertLineIsRunning(what);
  return true;
}

/**
 * A SPEND'S OWN PRECONDITIONS, PROVED IN THE SAME INVOCATION.
 *
 * # Why this is not a boolean the caller checks
 *
 * The finding-replay walk costs 125 credits and is graded by instruments that
 * must be shown able to FAIL before its numbers mean anything — "a counter that
 * has never counted one earring is not a counter". So the walk executes its own
 * controls rather than consulting a `--controls` flag, and it must not be able
 * to spend on a red one.
 *
 * That guard cannot be exercised by the thing it guards: while the STOPLINE
 * exists `spendAuthorized` throws long before any control runs, and the only
 * other way to reach it is to spend. A backstop whose only test is the expensive
 * path is an untested backstop (working law 3), so the decision lives here as a
 * function with controls beside it and the driver holds no copy of the rule.
 *
 * **`null` is not "fine".** A precondition nobody ran is the invoked-but-inert
 * class — invariant 7, a control that is not invoked does not exist — so it
 * refuses exactly as loudly as a failed one, and says which of the two it was.
 */
export function assertPreconditionsProved(
  what: string,
  proved: boolean | null,
  detail = "",
): void {
  if (proved === true) return;
  throw new Error(
    `refusing to ${what}: its preconditions were ${proved === null ? "NEVER RUN" : "RED"} in this invocation.`
    + (detail ? `\n\n${detail}` : "")
    + "\n\nAn instrument that cannot fail cannot pass, and a spend graded on one measures nothing.",
  );
}

/**
 * THE ONE THING THE FREEZE DOES NOT COVER, WRITTEN DOWN RATHER THAN ASSUMED.
 *
 * fable-119, asked directly and answered directly: *"STOPLINE froze walks and
 * campaign credits; fal fixture spend was never frozen — the benches ran
 * through it all week."* A fixture paint charges the founder's provider
 * balance, never his account's credits, and it is how a frozen line gets the
 * evidence it needs to thaw.
 *
 * It is a SEPARATE, NAMED export rather than an option on the one above,
 * because an option is a thing a hurried shift passes without thinking and a
 * name is a thing it has to type on purpose. The roster control below accepts
 * either — so a fixture still cannot hand-roll `--spend` and answer to nobody.
 *
 * **A script that can charge an ACCOUNT does not belong here.** If you find
 * yourself reaching for this to make a roll or a refine run during a freeze,
 * the freeze is the answer and this is the wrong door.
 */
export function fixtureSpendAuthorized(what: string, argv: readonly string[] = process.argv): boolean {
  if (!argv.includes("--spend")) return false;
  const frozen = readStopline();
  if (frozen !== null) {
    console.log(
      `NOTE: the line is frozen, and this is a FIXTURE paint (${what}) — provider balance, `
      + "no campaign credits, no walk. Permitted by fable-119.",
    );
  }
  return true;
}

/* ---------------------------------------------------------------- controls */

/**
 * EVERY `--spend` GATE IN A SCRIPTS TREE THAT DOES NOT ROUTE THROUGH THIS
 * MODULE - the derived roster, hoisted out of `--prove` so CI can drive it
 * (#345, reviewer suggestion on PR #587).
 *
 * It was inside the controls block, and the controls block runs only at a
 * keyboard. That is the root cause the twelve-day crash exposed and the first
 * repair did not close: a new script hand-rolling `"--spend"` without importing
 * this module went green in CI throughout the dark fortnight, and would still.
 *
 * A hand-kept list of guarded scripts is the exact shape that bit `worldGuard`
 * three times, so this stays derived. Hoisting changes nothing about WHAT it
 * reads, only about who is allowed to ask.
 *
 * Returns repository-relative paths, so a failure names something openable.
 */
export function unguardedSpendGates(scriptsDir: string, repoRoot: string): string[] {
  const selfPath = fileURLToPath(import.meta.url);
  const unguarded: string[] = [];
  for (const file of scriptFilesUnder(scriptsDir)) {
    /* This module DECLARES the word. It is the door, not a caller of it. */
    if (file === selfPath) continue;
    const source = readIfPresent(file);
    if (source === null) continue; /* vanished between list and read (#589) */
    if (!asksToSpend(source)) continue;
    if (routesThroughTheFreeze(source)) continue;
    unguarded.push(file.replace(repoRoot, "").replace(/^[\\/]/, ""));
  }
  return unguarded;
}

/**
 * WHETHER A FILE CAN BE ASKED TO SPEND — all three spellings, because #345 made
 * a new one canonical (reviewer finding 1, second cycle on PR #587).
 *
 * The literal `"--spend"` was the only spelling there was until the paid drivers
 * moved to a strict argument spec. In that idiom the word appears as
 * `boolean: ["spend"]` and is read as `ARGS.flag("spend")`, with **no `--spend`
 * literal anywhere** — so the next paid driver, copied from `drive-self-walk.mts`
 * exactly as the `--prove` sweep says the next module always is, would have been
 * invisible to this roster and to the suite that pins it. The hole was
 * prospective and opened by the repair itself; no file in the tree used the new
 * spelling when it was found.
 */
function asksToSpend(source: string): boolean {
  if (source.includes('"--spend"') || source.includes("'--spend'")) return true;
  /* The strict-spec spelling, both halves: the declaration and the read. */
  if (/\bflag\(\s*["']spend["']\s*\)/.test(source)) return true;
  return /boolean\s*:\s*\[[^\]]*["']spend["']/.test(source);
}

/**
 * WHETHER A FILE IMPORTS THIS MODULE — an IMPORT, never a MENTION.
 *
 * The skip was `source.includes("lib/stopline.m")`, which is the #360 class
 * standing inside the control that #345 hoisted into CI: a rogue file whose
 * comment reads *"unlike lib/stopline.mts, this one..."* was skipped while
 * hand-rolling its own spend gate. Pre-existing text, and hoisting it into a
 * pinned control is what raised the cost of a false negative here.
 *
 * Both real shapes are matched — a static `from "…stopline.mts"` and a dynamic
 * `await import("…stopline.mts")` — and nothing else is.
 */
function routesThroughTheFreeze(source: string): boolean {
  if (/\bfrom\s+["'][^"']*stopline\.m[jt]s["']/.test(source)) return true;
  return /\bimport\(\s*["'][^"']*stopline\.m[jt]s["']\s*\)/.test(source);
}

/**
 * A FILE A LISTING NAMED CAN BE GONE BY THE TIME YOU READ IT (#223, #589).
 *
 * `scriptWorldGuard.test.ts`'s positive control plants a real file in the real
 * `scripts/` directory and unlinks it in `finally`; vitest runs suites in
 * parallel, so this module's walk can see the plant at `readdirSync` and miss
 * it at `statSync`/`readFileSync`. That threw, and the throw REFUSED the
 * deploy rite on a clean tree twice on 2026-09-06 (receipts
 * `2026-09-06T04-57-28-138Z` and `2026-09-06T04-58-57-115Z`) — #223's class
 * exactly, reintroduced because this walker was written after that repair
 * reached the six walkers that existed then (`server/testing/listedSource.ts`
 * carries the full argument).
 *
 * ENOENT ONLY, and that bound is the whole design: a file gone at the read was
 * not part of the tree at the moment of the reading, and skipping it is the
 * correct answer — while EACCES, EISDIR or a decode failure still throw,
 * because a tolerance that swallowed everything would turn the roster green by
 * making it blind (invariant 7). The suite drives both directions.
 */
export function statIfPresent(path: string): Stats | null {
  try {
    return statSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** `readFileSync` with #589's ENOENT-only tolerance — see `statIfPresent`. */
export function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Every `.ts`/`.mts` under a directory. A clean sweep with no population is not a sweep. */
export function scriptFilesUnder(dir: string): string[] {
  const files: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at)) {
      const full = join(at, entry);
      const stat = statIfPresent(full);
      if (stat === null) continue; /* vanished between list and stat (#589) */
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith(".mts") || entry.endsWith(".ts")) files.push(full);
    }
  };
  walk(dir);
  return files;
}

/*
  THE CONTROLS RUN ONLY WHEN THIS FILE IS THE ONE THAT WAS INVOKED (#345,
  reviewer finding 2 on PR #587).

  This block reads argv at MODULE SCOPE, so until now it read the IMPORTER's.
  `npx tsx scripts/drive-self-walk.mts --prove --spend` therefore ran the
  freeze's own self-controls and exited before the walk's strict parse ever saw
  the unknown word: the driver neither walked nor refused. Harmless in money
  terms, confusing in every other, and a sibling of exactly the class the strict
  parse closes - one word bypassing a refusal. Every importer keeps its own
  vocabulary now.
*/
const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

/* The guard fails toward SILENCE - a symlinked checkout or a drive-letter
   casing difference on Windows would exit 0 having proven nothing. Asked for,
   and not run, is the one state worth saying out loud. */
if (!invokedDirectly && process.argv.includes("--prove")) {
  console.error(
    "NOTE: --prove was passed, but this module was imported rather than invoked"
    + ` (argv[1] is ${process.argv[1] ?? "unset"}). Its controls did NOT run.`
    + " Run `npx tsx scripts/lib/stopline.mts --prove` directly.",
  );
}

if (invokedDirectly && process.argv.includes("--prove")) {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");

  const scratch = mkdtempSync(join(tmpdir(), "stopline-"));
  const present = join(scratch, "STOPLINE");
  const empty = join(scratch, "STOPLINE-empty");
  const absent = join(scratch, "no-such-file");
  writeFileSync(present, "FROZEN by fable-112, widened by 114/115/116.\n");
  writeFileSync(empty, "");

  let failures = 0;
  const check = (name: string, pass: boolean, detail = "") => {
    if (!pass) failures += 1;
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  };
  const throws = (run: () => void): string | null => {
    try {
      run();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };

  /* 1–3: the reading itself, both directions plus the typo case. */
  check("NEGATIVE — no file: the line is running", throws(() => assertLineIsRunning("walk", absent)) === null);
  const message = throws(() => assertLineIsRunning("spend 150 credits walking", present));
  check("POSITIVE — the file exists: refuses", message !== null);
  check(
    "POSITIVE — the refusal quotes the freezing rulings and names the act",
    !!message?.includes("fable-112") && !!message?.includes("spend 150 credits walking"),
  );
  check("POSITIVE — an EMPTY stopline still stops", throws(() => assertLineIsRunning("walk", empty)) !== null);

  /* 4–5: the gate. A frozen line stops a spend and leaves a dry run alone. */
  check("NEGATIVE — dry run under a freeze: no throw, no spend", (() => {
    let threw = false;
    let authorized: boolean | null = null;
    try {
      authorized = spendAuthorized("walk", ["node", "script"]);
    } catch { threw = true; }
    return !threw && authorized === false;
  })());
  check("POSITIVE — `--spend` under the REAL freeze refuses", (() => {
    if (readStopline() === null) {
      console.log("       (no live STOPLINE right now — this control is asserted against a fixture below)");
      return throws(() => { spendAuthorized("walk", ["node", "script", "--spend"]); }) === null;
    }
    return throws(() => { spendAuthorized("walk", ["node", "script", "--spend"]); }) !== null;
  })(), readStopline() === null ? "line running" : "line frozen");

  /* 6: the fixture door — open under a freeze, and shut without `--spend`. */
  check("NEGATIVE — the fixture door is still shut without `--spend`",
    fixtureSpendAuthorized("a fixture paint", ["node", "script"]) === false);
  check("POSITIVE — a FIXTURE paint is permitted under the freeze (fable-119)",
    throws(() => { fixtureSpendAuthorized("a fixture paint", ["node", "script", "--spend"]); }) === null);

  /*
    7: THE PRECONDITION GATE, ALL THREE OF ITS ANSWERS.

    Driven directly rather than through the 125-credit walk that uses it — the
    walk cannot exercise this gate without either lifting the freeze or spending,
    which is precisely the shape working law 3 forbids.
  */
  check("NEGATIVE — preconditions PROVED: the spend proceeds",
    throws(() => { assertPreconditionsProved("walk", true); }) === null);
  const red = throws(() => { assertPreconditionsProved("spend 125 credits walking", false, "control A failed"); });
  check("POSITIVE — preconditions RED: refuses, and says which", !!red?.includes("RED"));
  check("POSITIVE — the red refusal names the act and quotes the detail",
    !!red?.includes("spend 125 credits walking") && !!red?.includes("control A failed"));
  check("POSITIVE — preconditions NEVER RUN refuses just as hard (invariant 7)",
    throws(() => { assertPreconditionsProved("walk", null); })?.includes("NEVER RUN") === true);

  /*
    8: AND THE SCRIPTS THAT CAN CHARGE AN ACCOUNT USE THE STRICT DOOR.

    The fixture exemption is one sentence away from being a bypass, so the
    scripts it must never cover are named and checked. A walk or a roll that
    quietly moved to the fixture door would fail here rather than at 150
    credits.
  */
  /*
    ⚠ A NAMED SPENDER THAT IS GONE IS A FINDING, NOT AN EXCEPTION (#345).

    This list is hand-kept — deliberately, because it is the thing arm 9's
    derived roster is checked against. But the reader below used to
    `readFileSync` each name straight, so a name that stopped existing THREW,
    and the throw landed BEFORE arms 8 and 9 ever ran.

    That is what happened. The litter purge of 2026-08-25 (`989e70a0`) deleted
    `scripts/calibration/bespectacled-roll-production.mts` and
    `scripts/prove-caption-governs-disposable.mts` — correctly, one a finished
    campaign script and one a disposable — and from that morning
    `stopline --prove` died on a stack trace at arm 8. **The derived roster, the
    one arm that can find a NEW spender with no freeze on it, had not run for
    twelve days**, and nothing said so: nothing in CI drives `--prove`, and the
    crash's non-zero exit looks like any other failing script. A path-three
    death (CLAUDE.md's third road), found by driving the control rather than
    citing it.

    Both names are off the list, each read at the tree and at `git log` before
    it went. A name that goes missing now REPORTS, so the next deletion costs a
    line of output instead of two arms.
  */
  const ACCOUNT_SPENDERS = [
    "scripts/drive-self-walk.mts",
    "scripts/drive-finding-replay.mts",
  ];
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const missingSpender = ACCOUNT_SPENDERS.filter((relative) => !existsSync(join(root, relative)));
  const wrongDoor = ACCOUNT_SPENDERS.filter((relative) => {
    if (!existsSync(join(root, relative))) return false;
    const source = readFileSync(join(root, relative), "utf8");
    return !source.includes("spendAuthorized(") || source.includes("fixtureSpendAuthorized(");
  });
  check(
    "ACCOUNT SPENDERS — every named spender still exists",
    missingSpender.length === 0,
    missingSpender.length
      ? `gone (delete the name, or restore the file): ${missingSpender.join(", ")}`
      : `${ACCOUNT_SPENDERS.length} named`,
  );
  check(
    "ACCOUNT SPENDERS — the walk and the replay use the STRICT door",
    wrongDoor.length === 0,
    wrongDoor.length ? `wrong door: ${wrongDoor.join(", ")}` : `${ACCOUNT_SPENDERS.length} checked`,
  );

  /*
    9: THE ROSTER, DERIVED. Every script that can spend has a `--spend` gate;
    every `--spend` gate must be this module's. A hand-kept list of guarded
    scripts is the exact shape that bit `worldGuard` three times.
  */
  const scriptsDir = fileURLToPath(new URL("..", import.meta.url));
  const unguarded = unguardedSpendGates(scriptsDir, fileURLToPath(new URL("../..", import.meta.url)));
  check(
    "ROSTER — every `--spend` gate in scripts/ routes through this module",
    unguarded.length === 0,
    unguarded.length ? `unguarded: ${unguarded.join(", ")}` : `${scriptFilesUnder(scriptsDir).length} files swept`,
  );

  rmSync(scratch, { recursive: true, force: true });
  console.log(failures === 0
    ? "\nThe freeze stops a spend, leaves a dry run alone, and no spender in the tree can miss it."
    : `\n${failures} control(s) failed — the stop-the-line is not enforceable.`);
  process.exit(failures === 0 ? 0 : 1);
}
