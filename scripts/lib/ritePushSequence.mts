/**
 * THE RITE PUSHES ITS REFS IN ORDER AND MUST STOP AT THE FIRST FAILURE (#317).
 *
 * ⚠ **SINCE 2026-09-06 THERE IS ONE REF — `main` — AND PRODUCTION BUILDS FROM
 * IT DIRECTLY** (deploy-on-merge, #508 D6/D7: Railway watches `main`, a merge
 * is a deploy, and `local-migration` is deleted). The sequence machinery below
 * is kept as written: a `BRANCHES` list of one still goes through it, the
 * order guard still asserts production's ref is LAST, and the day a second ref
 * returns nothing here has to be rediscovered. The history that follows is the
 * two-ref era and is true of it.
 *
 * `scripts/deploy-rite.mts` pushed `main` and then `main:local-migration`.
 * **Production built from `local-migration`** (the rite's own verify block
 * said so), so the two refs were not interchangeable: the one that shipped was
 * the SECOND one. Until this module existed the loop had no early exit and could
 * not have had one — `run()` wraps `execFileSync` in a `try/catch` and
 * RETURNS the stderr as a string, so `gitPush` reported a rejected push and a
 * successful one with the same type and no status:
 *
 *     if (!DRY) for (const branch of BRANCHES)
 *       say(`  push ${branch}: ${gitPush("origin", branch) || "ok"}`);
 *
 * A `main` push rejected as non-fast-forward was therefore PRINTED and the
 * loop went on to ship `local-migration` on its own.
 *
 * # It has fired three times, and every time it blocked somebody else
 *
 * - **2026-08-30** (foreman-129): #279's squash landed on `origin/main` while
 *   the shift's tree sat one commit behind. `main` was rejected;
 *   `local-migration` took `70b9638c` — that shift's pre-rebase commit, an
 *   ancestor of nothing.
 * - **2026-09-05 evening** (foreman-20260905-2200): PR #563's squash, same
 *   race. Production sat ~6 minutes on `20760ad8` — edition 261 WITHOUT #563 —
 *   while the founder's page said that fix was merged.
 * - **2026-09-05 night** (warden-20260906-0340): PR #569's squash. Production
 *   was handed edition 265 on a tree missing #420, and `main` then carried a
 *   commit production was not building.
 *
 * ⚠ **The cost is never paid by the shift that causes it.** Once the refs
 * diverge, the verify block `die()`s for ANYONE who runs the rite, and
 * doc/record pushes to `main` have no other road (standing orders: *"never a
 * bare push, never piped"*). That is standing-exception band 2 — an instrument
 * that blocks every merge — reached by an ordinary race between a squash merge
 * and a shift's push. #543 made a shift merge its own PRs mid-session, so a
 * shift now races ITSELF at least as often as it races anyone else.
 *
 * # THE CONTRACT, STATED EXACTLY
 *
 * 1. The refs are pushed in order and the sequence **STOPS at the first
 *    failure**. A ref after a failed one is never attempted, so
 *    `local-migration` cannot advance past a `main` that did not land.
 * 2. Failure is read from the child's **exit status**, never from its output.
 *    A successful `git push` writes to stderr too (`To github.com…`), so any
 *    reading that matches on text is a coin flip — and an up-to-date push
 *    writes nothing at all, which is indistinguishable from a spawn that never
 *    happened.
 * 3. The ref production builds from is **LAST** in the order. That is the whole
 *    reason stopping helps, and it is asserted against the rite's own
 *    `BRANCHES` constant rather than restated here (working law 4: a second
 *    list shadowing a source of truth always drifts from it).
 *
 * Nothing in this module runs a command or touches git. The rite injects a
 * pusher; the tests inject a fake one, which is how the STOP can be proven to
 * fire without a network or a remote.
 */

/**
 * What production is built from. Railway watches this branch (flipped
 * 2026-09-06, #508); the rite pushes it and every other reader derives the
 * deploying ref from here (`server/deployTriggerClaims.test.ts`).
 */
export const DEPLOY_SOURCE_REF = "main";

/** The remote ref a `local:remote` refspec lands on (`main` → `main`). */
export const refOf = (branch: string): string =>
  branch.includes(":") ? branch.split(":")[1]! : branch;

export type PushOutcome = { ok: boolean; output: string };
export type PushAttempt = { branch: string; ok: boolean; output: string };

export type PushSequence = {
  /** Every branch actually attempted, in order. Stops after the first failure. */
  attempts: PushAttempt[];
  /** The attempt that failed, or null when all of them landed. */
  failed: PushAttempt | null;
  /** Branches never attempted because an earlier one failed. */
  skipped: string[];
};

/**
 * Push each branch in order, stopping at the first failure.
 *
 * `push` returns a status, not text — see contract 2. The rite's own
 * `gitPush` could not satisfy this signature, which is exactly why the bug
 * existed and why the repair is a type change rather than a condition.
 */
export function pushInSequence(
  branches: readonly string[],
  push: (branch: string) => PushOutcome,
): PushSequence {
  const attempts: PushAttempt[] = [];
  for (const [index, branch] of branches.entries()) {
    const outcome = push(branch);
    const attempt: PushAttempt = { branch, ok: outcome.ok, output: outcome.output };
    attempts.push(attempt);
    if (!outcome.ok) {
      return { attempts, failed: attempt, skipped: [...branches.slice(index + 1)] };
    }
  }
  return { attempts, failed: null, skipped: [] };
}

/**
 * Contract 3, derived from the order the rite actually uses.
 *
 * Returns a reason when the order is unsafe, or null when it is fine. The
 * danger is asymmetric: stopping only protects production when the ref
 * production BUILDS FROM is the last one attempted. Reorder `BRANCHES` and the
 * STOP above silently stops helping — nothing else in the tree would notice.
 */
export function deployRefOrderProblem(branches: readonly string[]): string | null {
  if (branches.length === 0) return "BRANCHES is empty — the rite would push nothing.";
  const refs = branches.map(refOf);
  const index = refs.indexOf(DEPLOY_SOURCE_REF);
  if (index === -1) {
    return `BRANCHES pushes ${refs.join(", ")} — none of them is ${DEPLOY_SOURCE_REF}, `
      + "which is the ref production builds from.";
  }
  if (index !== refs.length - 1) {
    return `BRANCHES pushes ${DEPLOY_SOURCE_REF} at position ${index + 1} of ${refs.length} `
      + `(${refs.join(" → ")}) — production's own ref must be LAST, or a stop after it `
      + "has already shipped the tree it was meant to withhold.";
  }
  return null;
}

/**
 * WHY THE PUSH FAILED — READ, NEVER ASSUMED (#577).
 *
 * The recovery for a rejected push and the recovery for a dead network are
 * different, and one of them actively wastes the reader's time: on
 * 2026-09-05 a rite run died on `Could not resolve host: github.com` and then
 * printed the ordinary-race diagnosis, whose first instruction is `git fetch
 * origin` — **which fails for exactly the same reason the push did.** Worse
 * than useless: it reads as though the tree were at fault when the tree was
 * fine, and CLAUDE.md keeps a whole section on a road asserted from a shape
 * instead of read at the bytes.
 *
 * Three classes, and the third is the point:
 *
 * - `race` — the remote moved under us (`[rejected]`, `fetch first`,
 *   `non-fast-forward`). One merge repairs it and no history moves.
 * - `network` — nothing reached GitHub at all (DNS, connect, timeout, reset).
 *   The tree is innocent, no merge helps, and the repair is to wait.
 * - `unknown` — **everything else, including anything matching BOTH.** A wrong
 *   confident diagnosis costs more than an honest shrug, so this fails toward
 *   the shrug: print the raw error and say the cause was not recognised.
 *
 * Note what is deliberately NOT here: `unable to access`, which git prints
 * over a 403 as readily as over a dead DNS, and `could not read from remote
 * repository`, which is usually authentication. Both land in `unknown`, where
 * a tired reader is told to look rather than told something false.
 *
 * A pure function of the error text — no network, no git, so its arms are
 * fixture strings.
 */
export type PushFailureCause = "race" | "network" | "unknown";

const RACE_SIGNS = [
  /!\s*\[rejected\]/i,
  /\bnon-fast-forward\b/i,
  /\bfetch first\b/i,
  /updates were rejected/i,
  /behind its remote counterpart/i,
] as const;

const NETWORK_SIGNS = [
  /could not resolve host/i,
  /failed to connect/i,
  /connection (?:timed out|refused|reset)/i,
  /operation timed out/i,
  /network is unreachable/i,
  /(?:recv|send) failure/i,
  /temporary failure in name resolution/i,
] as const;

export function classifyPushFailure(output: string): PushFailureCause {
  const text = output ?? "";
  const race = RACE_SIGNS.some((sign) => sign.test(text));
  const network = NETWORK_SIGNS.some((sign) => sign.test(text));
  /* Both at once is not a third diagnosis, it is a reason to stop guessing. */
  if (race === network) return "unknown";
  return race ? "race" : "network";
}

/**
 * THE MESSAGE A SHIFT READS AT 5AM (#317, proposal 2).
 *
 * The card's own reason for asking: *"the recovery … is not discoverable from
 * the error message, and the tempting alternative is destructive."* A shift
 * that reads `! [rejected] main -> main (fetch first)` at five in the morning
 * reaches for `--force`, which is the one thing it must not do.
 *
 * Two shapes, because the recoveries genuinely differ:
 *
 * - **Nothing shipped** (the failure was the first ref) — the ordinary race.
 *   Merge the remote tip and re-run. No history moves and production was never
 *   handed anything.
 * - **Something shipped already** — `main` landed and `local-migration` was
 *   rejected. The fuller orphan-recovery is named, with the two readings that
 *   prove it was a content no-op (recorded on #317 by the shift that used it).
 *
 * ⚠ **BOTH MERGE THE REMOTE TIP OF THE REF THAT FAILED, AND THE FIRST DRAFT
 * MERGED `origin/main` IN BOTH** (found by the reviewer on PR #570). In the
 * shipped case that is a guaranteed no-op: `main` landed one line earlier, so
 * `origin/main` IS `HEAD` — "Already up to date", then a re-run that hits the
 * identical rejection. The orphan is on `origin/local-migration`, the ref that
 * did NOT land. A message whose one reachable scenario prints a loop is worse
 * than no message, because this one exists precisely for a shift too tired to
 * check it.
 *
 * ⚠ **AND THE RECOVERY IS CHOSEN BY THE CAUSE, NOT BY THE SHAPE (#577).** What
 * SHIPPED is read from the sequence and is true whatever went wrong, so it is
 * stated first and unconditionally. What to DO about it comes from
 * `classifyPushFailure`, because the merge repair is right for a race, useless
 * for a dead network, and a guess for anything else.
 */
export function pushFailureMessage(sequence: PushSequence): string {
  const failed = sequence.failed;
  if (!failed) return "";
  const shipped = sequence.attempts.filter((a) => a.ok).map((a) => a.branch);
  const lines: string[] = [
    `push of ${failed.branch} FAILED — stopping before ${sequence.skipped.join(", ") || "anything else"} `
    + "is pushed (#317).",
    "",
    failed.output.trim() || "(git printed nothing)",
    "",
  ];

  /* THE TIP TO MERGE IS THE ONE THAT DID NOT LAND — never `origin/main` by
     reflex. See the ⚠ in this function's docblock. */
  const orphanRef = `origin/${refOf(failed.branch)}`;
  const nothingShipped = shipped.length === 0;
  /* The tip that DID land — derived, so a third ref cannot make this a lie. */
  const landedRef = nothingShipped ? "" : `origin/${refOf(shipped[shipped.length - 1]!)}`;

  /* ── the FACT half: read from the sequence, so it holds whatever went wrong ── */
  if (nothingShipped) {
    lines.push(
      "NOTHING WAS PUSHED. Production is untouched and still builds the previous commit.",
      "",
    );
  } else {
    lines.push(
      `⚠ ALREADY PUSHED: ${shipped.join(", ")}.`,
      `${refOf(failed.branch) === DEPLOY_SOURCE_REF
        ? "That means production's own ref is the one that did NOT land, so production"
          + "\nis still on its previous commit while the refs that landed have moved ahead."
        : shipped.map(refOf).includes(DEPLOY_SOURCE_REF)
          ? `Production's ref (${DEPLOY_SOURCE_REF}) is among them, so production is building this`
            + "\ncommit; the ref that failed is not the one production builds from."
          /* Under contract 3 production's ref is LAST, so a non-production failure
             leaves it in `skipped` — derived, never assumed (PR #597 review, 3). */
          : `Production's ref (${DEPLOY_SOURCE_REF}) was NOT pushed — it sits after the ref that`
            + "\nfailed — so production is still on its previous commit while the refs that landed"
            + "\nmoved ahead of it."}`,
      "",
    );
  }

  /* ── the DIAGNOSIS half: chosen by the cause, never by the shape (#577) ── */
  const cause = classifyPushFailure(failed.output);

  if (cause === "network") {
    lines.push(
      "THE NETWORK IS DOWN — nothing is wrong with this tree, and no merge helps.",
      "git never got an answer, so `git fetch` would fail for the same reason this",
      "push did. Whether the remote moved at all is what the check below settles —",
      "a mid-transfer reset can land a ref before the wire dies, and the retry then",
      "reports it as already up to date. Either way this tree is intact.",
      "",
      "Wait a minute, prove the network is back, then re-run the rite unchanged:",
      "",
      "    git ls-remote origin -h refs/heads/main    # succeeds once it is back",
      "    npx tsx scripts/deploy-rite.mts",
      ...(nothingShipped
        ? []
        : ["", "The retry pushes the ref that did not land; the one that did is already correct."]),
    );
  } else if (cause === "race") {
    if (nothingShipped) {
      lines.push(
        "This is the ordinary race: a squash merge landed on",
        `${orphanRef} while this tree sat a commit behind. The repair is one merge,`,
        "and it rewrites no history:",
        "",
        "    git fetch origin",
        `    git merge ${orphanRef} --no-edit     # the atlas has a merge driver; if it`,
        "                                        # asks, git commit --no-edit",
        "    npx tsx scripts/deploy-rite.mts",
      );
    } else {
      lines.push(
        `The orphaned tip is on ${orphanRef} — the ref that failed. Merging`,
        `${landedRef} would be a no-op here, because it is what just landed. Merge the tip that did`,
        "not, so it becomes an ancestor again, and prove the merge changed no content:",
        "",
        "    git fetch origin",
        `    git merge ${orphanRef} --no-edit`,
        `    git diff <pre-merge-tip> HEAD --stat                 # must be EMPTY`,
        `    git merge-base --is-ancestor ${orphanRef} HEAD    # must succeed`,
        "    npx tsx scripts/deploy-rite.mts",
      );
    }
  } else {
    lines.push(
      "THE CAUSE WAS NOT RECOGNISED — the error above is neither the ordinary race",
      "nor a network failure, so this message is not going to guess at a repair.",
      "Read it, and only then decide. Two roads it is NOT allowed to assume for you:",
      "a rejection wants a merge, a dead network wants a wait, and an authentication",
      "failure wants neither.",
      "",
      "    npx tsx scripts/deploy-rite.mts    # once you know what the error says",
    );
  }

  lines.push(
    "",
    "⚠ DO NOT force push. A shift must never rewrite either deploy ref — whatever",
    "  the cause turns out to be, forcing loses work and repairs nothing.",
  );
  return lines.join("\n");
}

/**
 * The same guidance for the VERIFY block, which catches a divergence that
 * ALREADY exists — including one left behind before this module shipped.
 *
 * ⚠ The ref to merge is `origin/<the ref that disagrees>`, for the same reason
 * as above: when `local-migration` is the one out of step, `git merge
 * origin/main` is a no-op and sends the reader round the loop again.
 */
export function divergedRefMessage(ref: string, remote: string, shortSha: string): string {
  return [
    `origin/${ref} is at ${remote.slice(0, 8) || "(absent)"} — not ${shortSha}`,
    "",
    ref === DEPLOY_SOURCE_REF
      ? "Production builds from this ref, so it is the one that matters most."
      : "This ref did not land. Production builds from " + DEPLOY_SOURCE_REF + ".",
    "",
    `Recover by merging the tip that disagrees — origin/${ref}, not origin/main by`,
    "reflex — and never by forcing:",
    "",
    "    git fetch origin",
    `    git merge origin/${ref} --no-edit`,
    `    git diff <pre-merge-tip> HEAD --stat              # must be EMPTY`,
    `    git merge-base --is-ancestor origin/${ref} HEAD    # must succeed`,
    "    npx tsx scripts/deploy-rite.mts",
    "",
    "⚠ DO NOT force push either deploy ref. See #317.",
  ].join("\n");
}
