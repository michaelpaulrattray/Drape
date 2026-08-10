/**
 * A SABOTAGE MUST PROVE IT LANDED.
 *
 * # Three strikes in one night
 *
 * The pattern: copy the file, patch out the guard, run the suite, watch it go
 * red, restore. It is how this program distinguishes a test that drives its
 * subject from a test that merely sits near it.
 *
 * Three times in one night the patch **silently did not apply** — the search
 * string used `\n` and the file on disk uses `\r\n` — the suite stayed green,
 * and green is exactly what a successful sabotage is NOT. Twice I nearly wrote
 * "sabotage-verified" on the strength of it. The third time I caught it only
 * because I had started expecting it.
 *
 * My own sentence is the specification: **a sabotage that never landed is
 * indistinguishable from a fix that was not needed.** So "landed" stops being
 * something I remember to check and becomes something the harness asserts.
 *
 * # Why a helper rather than care
 *
 * "I now do it CRLF-aware" is per-case vigilance, and this program's whole
 * argument is that per-case vigilance is what fails on the case nobody was
 * thinking about. The next silent non-application will not be line endings; it
 * will be a renamed symbol, a reformatted argument list, or a string that moved
 * behind a helper. One helper catches all of them, because it does not care WHY
 * the mutation missed — only that the bytes changed.
 *
 *   const done = await sabotage("server/castingV2/refineService.ts", [
 *     { find: "if (!answered && isUpsweptAsk(", replace: "if (isUpsweptAsk(" },
 *   ]);
 *   // …run the suite, assert it goes RED…
 *   await done.restore();
 *
 * It throws if a mutation matched nothing, and it throws if the file is
 * unchanged afterwards. Both are the same finding wearing different clothes.
 */
import { readFileSync, writeFileSync } from "node:fs";

export type Mutation = {
  /** Matched against the file with line endings normalised to `\n`. */
  find: string;
  /** Omit to DELETE the matched text — the commonest sabotage. */
  replace?: string;
  /** Expected occurrences. Defaults to 1; a find that hits three places when
   *  you meant one is its own kind of silent wrong. */
  count?: number;
};

export type AppliedSabotage = {
  /** Which mutations landed, and how many times each. */
  landed: Array<{ find: string; hits: number }>;
  /** Bytes removed or added, so "it changed" is a number rather than a claim. */
  delta: number;
  restore: () => Promise<void>;
};

/**
 * Apply mutations, PROVE they landed, and hand back a restore.
 *
 * The proof is deliberately two independent checks. A find that matches could
 * still replace text with itself, and a file that changed could have changed
 * for an unrelated reason — so both the per-mutation hit count and the
 * whole-file byte difference have to be non-zero.
 */
export async function sabotage(
  file: string,
  mutations: readonly Mutation[],
): Promise<AppliedSabotage> {
  if (mutations.length === 0) throw new Error("sabotage: no mutations — nothing would be proven");

  const original = readFileSync(file, "utf8");
  /* Normalised for MATCHING only; the file is written back in its own endings,
     because a sabotage that reformats the whole file makes the suite's red
     mean something other than the mutation. */
  const crlf = original.includes("\r\n");
  let working = crlf ? original.replace(/\r\n/g, "\n") : original;

  const landed: Array<{ find: string; hits: number }> = [];
  for (const mutation of mutations) {
    const wanted = mutation.count ?? 1;
    const hits = working.split(mutation.find).length - 1;
    if (hits === 0) {
      throw new Error(
        `sabotage did not land in ${file}: nothing matched\n  ${mutation.find.slice(0, 120)}\n`
        + "A sabotage that never applied is indistinguishable from a fix that was not needed — "
        + "the green you are about to see would mean nothing.",
      );
    }
    if (hits !== wanted) {
      throw new Error(
        `sabotage matched ${hits} times in ${file}, expected ${wanted}:\n  ${mutation.find.slice(0, 120)}\n`
        + "Mutating more places than intended makes the red ambiguous.",
      );
    }
    working = working.split(mutation.find).join(mutation.replace ?? "");
    landed.push({ find: mutation.find.slice(0, 80), hits });
  }

  const next = crlf ? working.replace(/\n/g, "\r\n") : working;
  const delta = original.length - next.length;
  if (delta === 0 && next === original) {
    throw new Error(
      `sabotage changed nothing in ${file} — every mutation matched but the bytes are identical. `
      + "Replacing text with itself proves as little as not matching at all.",
    );
  }

  writeFileSync(file, next);
  /* A SAME-LENGTH SUBSTITUTION IS A LANDED SABOTAGE (`0.35` → `0.34`), and this
     line used to announce it as "0 bytes added" — which reads exactly like the
     silent non-application the helper exists to catch. The check above is the
     honest one (`next === original`); the message now agrees with it. */
  console.log(
    `sabotage applied to ${file}: ${landed.map((m) => `${m.hits}x`).join(", ")}, `
    + (delta === 0
      ? "same length, content changed"
      : `${Math.abs(delta)} bytes ${delta > 0 ? "removed" : "added"}`),
  );

  /*
    AND THE FILE GOES BACK EVEN IF THIS PROCESS NEVER REACHES ITS RESTORE.
    (2026-08-09, from the incident that made it necessary.)

    `npx tsx prove-…mts | grep … | tail -8` kills the driver with SIGPIPE the
    moment `tail` has what it needs. That happened here mid-sweep, and the
    working tree was left carrying a DELIBERATE DEFECT — `reachPx: departedReach`,
    a real removal bug — through a full suite run that was then reported as
    4,861 green. Nothing was wrong with the suite; it was measuring sabotaged
    source, and the only tell was `git status`.

    The `restore()` handle is right for the happy path and cannot cover a death.
    So every applied sabotage also registers a synchronous writer on the ways a
    node process actually ends. Idempotent, because a normal `restore()` will
    usually get there first, and cheap enough to be unconditional — a leftover
    mutation is the single most expensive thing this helper can produce.
  */
  let live = true;
  const putBack = () => {
    if (!live) return;
    live = false;
    try {
      writeFileSync(file, original);
      console.error(`sabotage: restored ${file} on process exit — the run did not finish`);
    } catch { /* exiting anyway; a failed write here is visible in `git status` */ }
  };
  const onSignal = () => { putBack(); process.exit(1); };
  const onThrow = (error: unknown) => { putBack(); throw error; };
  const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP", "SIGPIPE"] as const;
  /* Detached on restore, or a 22-guard sweep leaves 22 sets behind and node
     starts warning about a leak in the middle of the evidence. */
  const detach = () => {
    process.off("exit", putBack);
    for (const signal of SIGNALS) process.off(signal, onSignal);
    process.off("uncaughtException", onThrow);
  };
  process.once("exit", putBack);
  for (const signal of SIGNALS) process.once(signal, onSignal);
  process.once("uncaughtException", onThrow);

  return {
    landed,
    delta,
    restore: async () => {
      live = false;
      detach();
      writeFileSync(file, original);
      const back = readFileSync(file, "utf8");
      /* Restoring is the half nobody checks, and a half-restored source file is
         a far worse outcome than an unproven test. */
      if (back !== original) throw new Error(`sabotage: ${file} did not restore cleanly`);
      console.log(`sabotage restored ${file}`);
    },
  };
}
