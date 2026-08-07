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
  console.log(
    `sabotage applied to ${file}: ${landed.map((m) => `${m.hits}x`).join(", ")}, `
    + `${Math.abs(delta)} bytes ${delta > 0 ? "removed" : "added"}`,
  );

  return {
    landed,
    delta,
    restore: async () => {
      writeFileSync(file, original);
      const back = readFileSync(file, "utf8");
      /* Restoring is the half nobody checks, and a half-restored source file is
         a far worse outcome than an unproven test. */
      if (back !== original) throw new Error(`sabotage: ${file} did not restore cleanly`);
      console.log(`sabotage restored ${file}`);
    },
  };
}
