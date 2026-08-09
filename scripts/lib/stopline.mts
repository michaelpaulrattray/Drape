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
import { existsSync, readFileSync } from "node:fs";
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

if (process.argv.includes("--prove")) {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { readdirSync, statSync } = await import("node:fs");

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
    7: AND THE SCRIPTS THAT CAN CHARGE AN ACCOUNT USE THE STRICT DOOR.

    The fixture exemption is one sentence away from being a bypass, so the
    scripts it must never cover are named and checked. A walk or a roll that
    quietly moved to the fixture door would fail here rather than at 150
    credits.
  */
  const ACCOUNT_SPENDERS = [
    "scripts/drive-self-walk.mts",
    "scripts/calibration/bespectacled-roll-production.mts",
    "scripts/prove-caption-governs-disposable.mts",
  ];
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const wrongDoor = ACCOUNT_SPENDERS.filter((relative) => {
    const source = readFileSync(join(root, relative), "utf8");
    return !source.includes("spendAuthorized(") || source.includes("fixtureSpendAuthorized(");
  });
  check(
    "ACCOUNT SPENDERS — the walk, the roll and the prover use the STRICT door",
    wrongDoor.length === 0,
    wrongDoor.length ? `wrong door: ${wrongDoor.join(", ")}` : `${ACCOUNT_SPENDERS.length} checked`,
  );

  /*
    8: THE ROSTER, DERIVED. Every script that can spend has a `--spend` gate;
    every `--spend` gate must be this module's. A hand-kept list of guarded
    scripts is the exact shape that bit `worldGuard` three times.
  */
  const scriptFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".mts") || entry.endsWith(".ts")) scriptFiles.push(full);
    }
  };
  walk(fileURLToPath(new URL("..", import.meta.url)));

  const selfPath = fileURLToPath(import.meta.url);
  const unguarded: string[] = [];
  for (const file of scriptFiles) {
    if (file === selfPath) continue;
    const source = readFileSync(file, "utf8");
    if (!source.includes('"--spend"') && !source.includes("'--spend'")) continue;
    if (source.includes("lib/stopline.m")) continue;
    unguarded.push(file.replace(fileURLToPath(new URL("../..", import.meta.url)), "").replace(/^[\\/]/, ""));
  }
  check(
    "ROSTER — every `--spend` gate in scripts/ routes through this module",
    unguarded.length === 0,
    unguarded.length ? `unguarded: ${unguarded.join(", ")}` : `${scriptFiles.length} files swept`,
  );

  rmSync(scratch, { recursive: true, force: true });
  console.log(failures === 0
    ? "\nThe freeze stops a spend, leaves a dry run alone, and no spender in the tree can miss it."
    : `\n${failures} control(s) failed — the stop-the-line is not enforceable.`);
  process.exit(failures === 0 ? 0 : 1);
}
