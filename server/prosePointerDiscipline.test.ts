/**
 * A POINTER ON A LIVE INSTRUCTION SURFACE NAMES A SYMBOL, NOT A LINE NUMBER.
 *
 * Ruled fable-1227 §2, from the opus-920 sweep. A `file.ts:123` written into
 * prose is a claim about the code, and it is the one kind of claim nothing
 * else in this repo can falsify: vitest does not read prose, `pnpm check` does
 * not read prose, and the Atlas is extracted from source rather than from
 * documents. So it rots in silence — and the failure is worse than a missing
 * pointer, because **a stale line number makes a TRUE sentence read as FALSE
 * to the next person who checks it.** That is how a live control gets re-filed
 * as a dead one.
 *
 * The measured instance that bought this arm: `shared/inkMannequinDeferral.ts`
 * carried a three-hop trace written *specifically* so the dead form-demand
 * tally could be re-verified in one read (ordered by fable-1114 §1). By
 * 2026-08-21 two of its three line numbers pointed at unrelated comment prose,
 * while every fact in the block was still true. The fact survived; its
 * checkability did not.
 *
 * # WHY THIS SHAPE AND NOT A POINTER-RESOLVER
 *
 * The obvious arm — resolve every pointer and check the line still holds
 * something — was BUILT, RUN, and REFUSED (opus-920 §5c, ratified fable-1227
 * §3). It found 46 broken pointers across the repo and **missed all three of
 * the live-surface instances**, because its blind spots are exactly where the
 * real ones live: a line that still holds *something else*, and a basename
 * matching two files. A green arm over a checker like that is
 * `velocityLimits.test.ts` with a fresh coat — a suite that cannot fail when
 * its subject breaks, lending a live reputation to a dead control.
 *
 * So this arm asserts the thing a machine can actually decide: **the bare form
 * is absent.** It cannot be fooled, because it never tries to judge whether a
 * pointer is correct — it removes the form that rots invisibly and leaves the
 * form that fails loudly, since a grep for a symbol that no longer exists
 * returns nothing and says so.
 *
 * # SCOPE, STATED RATHER THAN IMPLIED
 *
 * `CLAUDE.md` only, and that is a deliberate floor rather than the whole job:
 *
 *   - it is the surface every session loads before doing anything, so a wrong
 *     pointer there is read by every future seat;
 *   - `docs/specs/POST_SIGN_ROADMAP.md` is equally live and holds **32** bare
 *     pointers as of 2026-08-21. Converting them needs a per-pointer read to
 *     name the right symbol, which is its own sitting — recorded here with a
 *     count so this arm's green cannot be mistaken for that surface passing;
 *   - `.agents/mailbox/PROTOCOL.md` is named in the ruling but is **gitignored**
 *     (`.gitignore:.agents/`), so a tracked test asserting over it would fail
 *     on any clone that lacks it. It holds zero pointers today and stays under
 *     the rule by review;
 *   - source docblocks stay under the rule by review too (fable-1227 §3).
 *
 * A bare line number remains legitimate in a DATED record — an audit or plan
 * describing the state of the world on a stated day — which is why the ~30
 * broken pointers in `CASTING_SYSTEM_AUDIT.md` and the R6 execution plans are
 * not defects and are not in scope.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { LAW_SURFACES } from "../scripts/lib/lawText.mts";

const REPO_ROOT = join(__dirname, "..");

/** Surfaces under the rule mechanically. See the scope note above. */
/*
  ⚠ THE COMPANION IS IN SCOPE BECAUSE THE TEXT MOVED INTO IT (2026-08-31, #330).
  Two thirds of `CLAUDE.md` — the flag catalogue — was carved into
  `docs/architecture/FEATURE_FLAGS.md`. Leaving this arm at `CLAUDE.md` alone
  would have quietly narrowed the rule to a third of the prose it used to cover,
  with nothing going red: the pointers would simply have walked out of scope. The
  list comes from `scripts/lib/lawText.mts` so the next carve-out is one line
  there rather than an edit here that nobody remembers to make.
*/
const ENUMERATED_SURFACES = LAW_SURFACES;

/**
 * A bare prose pointer: a filename with a code-or-document extension, followed
 * by `:` and a line number.
 *
 * The trailing `(?![\d.])` keeps version-like text (`1.2.3:4`) and the leading
 * boundary keeps URLs and times out of it. It deliberately does NOT match
 * `users:1`, `03:35` or a commit sha — none of those carry an extension.
 */
const BARE_POINTER =
  /(?<![\w/.-])((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_-]+\.(?:ts|tsx|mts|mjs|js|yaml|json|sql|md)):(\d+)(?![\d.])/g;

export function barePointersIn(text: string): string[] {
  BARE_POINTER.lastIndex = 0;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = BARE_POINTER.exec(text)) !== null) found.push(`${m[1]}:${m[2]}`);
  return found;
}

describe("a pointer on a live instruction surface names a symbol", () => {
  /*
    THE RED CONTROL, FIRST. This arm is worth nothing unless the checker can
    fail, and "it passed" is indistinguishable from "it never looked" — so the
    planted pointer runs before the real assertion, not after it.
  */
  it("CAN FAIL — a planted bare pointer is caught", () => {
    const planted = "Admins pass the moderator middleware (`server/_core/trpc.ts:131`), so they inherit it.";
    expect(barePointersIn(planted)).toEqual(["server/_core/trpc.ts:131"]);
  });

  it("CAN FAIL — a planted bare pointer into a document is caught too", () => {
    expect(barePointersIn("(D-64, `docs/specs/DECISION_LOG.md:669`.)")).toEqual([
      "docs/specs/DECISION_LOG.md:669",
    ]);
  });

  /*
    AND THE NEGATIVE CONTROL, which is the half that makes the arm usable: the
    repaired forms must PASS, or the rule would forbid the sentence it asks
    for. These are the exact replacements landed on 2026-08-21.
  */
  it("does not fire on the symbol form the rule asks for", () => {
    const repaired = [
      "Admins pass the moderator middleware (`moderatorProcedure`, `server/_core/trpc.ts`).",
      "the `dependencies.mint` call in `inkUploadService.ts`",
      "By design (`server/storage.ts`'s header, *\"not presigned\"*)",
      "(D-64's *\"Deletion boundary\"* paragraph, `docs/specs/DECISION_LOG.md`.)",
      "server/db/generationOperations.ts, \"Resource lock refused without stealing it\"",
    ].join("\n");
    expect(barePointersIn(repaired)).toEqual([]);
  });

  it("does not fire on the non-pointer colons this repo is full of", () => {
    const noise = [
      "`CASTING_V2_SCOPE=users:1` and `R7_EVIDENCE_INGEST_SCOPE=users:<ids>`",
      "the sensitive-action gate at 03:35 in a file split",
      "`3cb0cdee` (2026-02-07 03:35)",
      "http://localhost:3000 and mysql://user@host:23768/db",
      "`fal-ai/aura-sr`, `esrgan` declared fallback",
    ].join("\n");
    expect(barePointersIn(noise)).toEqual([]);
  });

  /*
    ⚠ AND THE SURFACE LIST ITSELF IS PINNED — found by sabotaging it, not by
    foreseeing it (2026-08-31, #330).

    `ENUMERATED_SURFACES` decides what this rule COVERS, and narrowing it
    reddens nothing anywhere: a scan that scans less simply passes. Driven —
    `LAW_SURFACES` was cut back to `["CLAUDE.md"]` alone and every arm in the
    four re-pointed files stayed green, which would have silently taken two
    thirds of this repository's flag prose out of the rule.

    An `it.each` over an EMPTY list is the same failure one size worse: vitest
    generates no test and reports no test, which reads exactly like a pass.
    So the population is asserted before it is used, and the two members are
    named — the file every session loads, and the file most of it moved into.
  */
  it("⚠ CONTROL — the surface list is the real one, and narrowing it is caught", () => {
    expect(ENUMERATED_SURFACES.length).toBeGreaterThan(1);
    expect(
      ENUMERATED_SURFACES,
      "the surface every session loads before doing anything",
    ).toContain("CLAUDE.md");
    expect(
      ENUMERATED_SURFACES,
      "the flag catalogue — 122,893 bytes carved out of CLAUDE.md by #330, and out of this "
      + "rule's reach the moment it leaves LAW_SURFACES",
    ).toContain("docs/architecture/FEATURE_FLAGS.md");
  });

  it.each(ENUMERATED_SURFACES)("%s carries no bare file:line pointer", (surface) => {
    const text = readFileSync(join(REPO_ROOT, surface), "utf8");
    /*
      The failure message carries the REPAIR, not just the complaint — the
      whole point of the rule is that the next person can act on it without
      re-deriving why it exists.
    */
    expect(
      barePointersIn(text),
      `${surface} must point at a symbol a grep can re-find, never a line number `
        + `(fable-1227 §2). Replace \`file.ts:123\` with the function, constant or `
        + `quoted string that line holds — a line number rots silently, a symbol `
        + `fails loudly.`,
    ).toEqual([]);
  });
});
