import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A FIXTURE HOOK WITHOUT THE EXECUTABLE BIT IS IGNORED, AND THE ARM STILL
 * REPORTS A VERDICT (#673).
 *
 * Git does not fail on a hook it cannot execute. It prints
 * `hint: The '…' hook was ignored because it's not set as executable` and
 * carries on as though the hook were absent. **Windows sets
 * `core.filemode=false` and runs the hook anyway**, so a suite that installs a
 * fixture hook and forgets the mode passes locally every time and measures
 * NOTHING on ubuntu — while still printing a green arm.
 *
 * ⚠ **THE CLASS FAILS GREEN, AND IT HAS SHIPPED TWICE.**
 *   1. `server/atlasPushGate.test.ts` — *"a green REFUSES arm over a hook that
 *      was never invoked"*, its own comment, written after the gate caught it.
 *   2. `server/prepareCommitMsgGate.test.ts` (PR #671) — the `post-checkout`
 *      arm reported *"post-checkout cannot refuse"*, which is the claim the
 *      whole hook choice rests on, over a fixture git had ignored. The branch
 *      switched because nothing ran.
 *
 * Both were caught by CI. Nothing in the tree could catch a third, and that is
 * what this file is: the symptom was fixed twice and the SHAPE was never
 * named, which is working law 7 exactly.
 *
 * ⚠ **`.githooks` ALREADY HAS A GUARD AND IT CANNOT SEE THIS ONE.**
 * `preCommitGate.test.ts` and `prepareCommitMsgGate.test.ts` both assert every
 * TRACKED hook is `100755` in the index. Their population is a directory in
 * the repository, so a hook a TEST writes into a temp directory — which is
 * where both instances live — is outside it by construction.
 *
 * WHAT THIS READER CAN AND CANNOT SEE, said here rather than discovered:
 * it finds a write whose destination NAMES a hook as a string literal. A loop
 * copying `readdirSync(HOOKS_DIR)` under a variable is invisible to it (the
 * one in `prepareCommitMsgGate` routes through `installable` anyway). So a
 * clean run is a FLOOR, not coverage — the same thing the un-wiring differ's
 * docblock says about itself.
 */

const SERVER = new URL("./", import.meta.url);

/** Comments are stripped before anything is asserted: both files above QUOTE the
 *  defect in order to explain it, and quoting must never read as committing. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * The names git looks for. A file written under one of these basenames is a
 * hook, whatever the suite calls the variable holding it.
 */
const HOOK_NAMES = [
  "applypatch-msg",
  "pre-applypatch",
  "post-applypatch",
  "pre-commit",
  "pre-merge-commit",
  "prepare-commit-msg",
  "commit-msg",
  "post-commit",
  "pre-rebase",
  "post-checkout",
  "post-merge",
  "pre-push",
  "pre-receive",
  "update",
  "proc-receive",
  "post-receive",
  "post-update",
  "reference-transaction",
  "push-to-checkout",
  "pre-auto-gc",
  "post-rewrite",
  "sendemail-validate",
  "fsmonitor-watchman",
] as const;

/** The whole `writeFileSync(…)` / `copyFileSync(…)` call, parentheses balanced. */
function callAt(text: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex, i + 1);
    }
  }
  return text.slice(openIndex);
}

type Write = { file: string; call: string; hook: string; destination: string | null };

/**
 * Every place a suite writes a file named after a git hook.
 *
 * The DESTINATION is the argument carrying the hook name — `writeFileSync`'s
 * first, `copyFileSync`'s second — captured as text so a later
 * `installable(join(solo, "post-checkout"))` can be matched against it without
 * resolving anything.
 */
async function suites(dir: URL, prefix = "", out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      await suites(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`, out);
    } else if (entry.name.endsWith(".test.ts")) {
      out.push(`${prefix}${entry.name}`);
    }
  }
  return out;
}

async function hookWrites(): Promise<Write[]> {
  /* Every suite under `server/`, at any depth — today they all sit at the top,
     and a hook-driving suite filed in a subfolder joins this population by
     existing rather than by being added to a list. */
  const names = await suites(SERVER);
  const found: Write[] = [];
  for (const file of names) {
    const text = code(await readFile(new URL(file, SERVER), "utf8"));
    for (const match of text.matchAll(/\b(writeFileSync|copyFileSync)\s*\(/g)) {
      const call = callAt(text, match.index + match[0].length - 1);
      const hook = HOOK_NAMES.find((name) =>
        new RegExp(`["'\`]${name}["'\`]`).test(call),
      );
      if (!hook) continue;
      const destination = call.match(new RegExp(`join\\([^()]*["'\`]${hook}["'\`]\\s*\\)`))?.[0] ?? null;
      found.push({ file, call, hook, destination });
    }
  }
  return found;
}

describe("a fixture hook is written executable, or git ignores it and the arm lies", () => {
  it("FINDS THE REAL CALL SITES — a reader that returns nothing passes forever", async () => {
    /*
      This arm is the positive control for the one below it, and it is not
      optional: the arm below asserts an ABSENCE, and an absence over an empty
      population is the cheapest false pass there is. Rename a file, change how
      a fixture is written, break the walk — and "no offenders" would be the
      report either way.

      The two instances the card was filed about are named, because they are
      the two the class is known to have.
    */
    const writes = await hookWrites();
    expect(writes.length).toBeGreaterThan(0);
    const files = new Set(writes.map((w) => w.file));
    expect(files.has("atlasPushGate.test.ts"), "the pre-push fixture").toBe(true);
    expect(files.has("prepareCommitMsgGate.test.ts"), "the post-checkout fixture").toBe(true);
    expect(new Set(writes.map((w) => w.hook)).size).toBeGreaterThan(1);
  });

  it("every hook fixture either carries mode 0o755 or is chmod-ed to it", async () => {
    /*
      Two legitimate shapes, and both are in the tree today:

        writeFileSync(join(lone, "pre-push"), body, { mode: 0o755 })   — atlas
        copyFileSync(HOOK, join(solo, "prepare-commit-msg"));
        installable(join(solo, "prepare-commit-msg"));                 — pcm

      The second is why this arm does not simply demand `mode:` in the write.
      `copyFileSync` HAS no mode argument, so insisting on one would fail the
      correct call site and teach the next author to work around the guard.
    */
    const sources = new Map<string, string>();
    const offenders: string[] = [];
    for (const write of await hookWrites()) {
      if (/\bmode\s*:\s*0o755\b/.test(write.call)) continue;
      if (!sources.has(write.file)) {
        sources.set(write.file, code(await readFile(new URL(write.file, SERVER), "utf8")));
      }
      const text = sources.get(write.file) ?? "";
      const chmodded =
        write.destination !== null &&
        new RegExp(
          `(installable|chmodSync)\\s*\\(\\s*${write.destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        ).test(text);
      if (!chmodded) offenders.push(`${write.file} — ${write.hook}: ${write.call.slice(0, 90)}`);
    }
    expect(
      offenders,
      `git ignores a hook without the executable bit and the arm still reports a verdict:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("the reader can see the defect — the shape it caught twice", async () => {
    /*
      Driven against the two real shapes rather than reasoned about: a write
      with neither a mode nor a chmod is an offender, and the two shapes that
      ship today are not. Without this the arm above could be green because its
      matcher never matches anything.
    */
    const bad = `writeFileSync(join(solo, "post-checkout"), "#!/bin/sh\\nexit 1\\n");`;
    const good = `writeFileSync(join(lone, "pre-push"), body, { mode: 0o755 });`;
    expect(HOOK_NAMES.some((n) => bad.includes(`"${n}"`)), "the matcher must see it").toBe(true);
    expect(/\bmode\s*:\s*0o755\b/.test(bad)).toBe(false);
    expect(/\bmode\s*:\s*0o755\b/.test(good)).toBe(true);
    expect(
      /(installable|chmodSync)\s*\(\s*join\(solo, "post-checkout"\)/.test(
        `${bad}\ninstallable(join(solo, "post-checkout"));`,
      ),
      "the chmod road must be recognised",
    ).toBe(true);
  });
});
