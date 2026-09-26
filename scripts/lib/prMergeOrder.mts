/**
 * MERGE THE SHIFT'S OPEN PRs IN THE ORDER THEY WERE OPENED — the decision
 * half (#543 item 3, founder-ordered and urgent).
 *
 * WHY IT EXISTS. His order was *"investigate our current process and optimize
 * it as urgent"*, and the investigation found the shift idle for 52% of its
 * mean: 27 minutes median, 42 mean, waiting on a gate with nothing else on the
 * bench. The answer written into the standing orders is OVERLAP — cut a second
 * worktree and take the next card while the first PR's gate runs. That answer
 * creates its own problem, which this module is: two or three PRs in flight at
 * once, each needing its gate watched, each needing main merged in when an
 * earlier one lands, and all of them needing to merge in a fixed order. The
 * card's own words: *"the overlap rule without this is a shift juggling four
 * terminals."*
 *
 * ⚠ WHAT IT DELIBERATELY DOES NOT DO: JUDGE. It never reads a review's
 * findings, never decides a red gate was spurious, never retries anything, and
 * never merges past a verdict a human has not read. Where judgement is
 * required it STOPS and says which PR and why, in the words the shift then
 * uses. The whole value is in removing the WAITING and the BOOKKEEPING, and
 * the moment a tool that merges starts deciding, its cost stops being bounded.
 *
 * THE ORDER OF THE BRANCHES IN `decideMergeAction` IS THE CONTRACT, the way
 * `gateStall.mts`'s is: every cheap, certain refusal is answered before any
 * expensive or ambiguous one, so no clock and no GitHub eventual-consistency
 * window can turn a refusal into a merge.
 *
 * Pure — readings in, actions out, no `gh`, no `git`, no network (law 3). The
 * CLI beside it does the I/O.
 */
import { type ReviewPresence } from "./reviewRounds.mts";
/*
  ⚠ THE CONFLICT TEST IS THE DECLARATION'S, THE REST OF THIS FILE'S VERDICTS
  ARE NOT (#1103). This module asks a richer question than "is it conflicting"
  — it separates BEHIND, BLOCKED and UNKNOWN into three verdicts with three
  remedies, because it is deciding whether to MERGE rather than whether to
  warn. Only the CONFLICTING/DIRTY predicate is shared; the three branches
  below keep their own reads on purpose, and folding them would lose the
  distinctions the skips are built on.
*/
import { readPullRequestConflict } from "../../shared/crewShiftState.js";

/** What a named check says on the PR's CURRENT head commit. */
export type GateState = "green" | "red" | "running" | "absent";

/**
 * Socket's reading has a FIFTH state the gate's jobs do not: `skipped`. Socket
 * reads a PR seconds after it opens, and when GitHub has not yet computed
 * mergeability — or cannot yet see the base commit — it posts `NEUTRAL` with
 * the title *"Skipped"* and never reads that head again (#1051). That is no
 * verdict, but it is not `absent` either: `absent` means NO check was posted
 * (the outside service down or uninstalled), and the two have different
 * remedies. Kept off `GateState` on purpose, so a gate job concluding
 * `NEUTRAL` still reads `red` — a job that did not run to a pass is not one.
 *
 * Measured over the 60 PRs before this type existed (104 head commits, every
 * `Socket Security: Pull Request Alerts` check-run read): 92 `SUCCESS`
 * "no net changes to dependencies", 3 `SUCCESS` "no new dependency alerts",
 * **5 `NEUTRAL` skips** (3 "un-mergeable pull request", 2 "missing parent
 * commit"), 4 heads with no Socket check at all, and **not one `FAILURE`** —
 * so every time the tool's "Socket REFUSED" stop had fired, it was a skip.
 */
export type SupplyChainState = GateState | "skipped";

/**
 * One entry of `gh pr view --json statusCheckRollup` — the GraphQL shape, so
 * `status`/`conclusion` are UPPER CASE (`COMPLETED`, `NEUTRAL`), unlike the
 * REST check-runs payload. No `title` and no `summary` ride on it, which is
 * why the readers below key on the conclusion alone.
 */
export type Rollup = {
  __typename?: string;
  name?: string;
  status?: string;
  conclusion?: string | null;
  startedAt?: string;
  workflowName?: string;
};

function newestCheckRun(rollup: readonly Rollup[], name: string): Rollup | undefined {
  const runs = rollup
    .filter((c) => c.__typename === "CheckRun" && c.name === name)
    .sort((a, b) => new Date(a.startedAt ?? 0).getTime() - new Date(b.startedAt ?? 0).getTime());
  return runs[runs.length - 1];
}

/**
 * The named check on the PR's current head: no run is `absent`, an unfinished
 * one is `running`, `SUCCESS` is `green` and EVERY other conclusion is `red` —
 * `FAILURE`, `CANCELLED`, `TIMED_OUT`, `NEUTRAL`, `SKIPPED` alike. For a gate
 * job that is the safe reading: a job that did not run to a pass is not a
 * pass. Lived inside `pr-merge-in-order.mts` as `gateStateOf`, untested, until
 * #1051 found it pointed at Socket.
 */
export function checkStateOf(rollup: readonly Rollup[], name: string): GateState {
  const newest = newestCheckRun(rollup, name);
  if (!newest) return "absent";
  if (newest.status !== "COMPLETED") return "running";
  return newest.conclusion === "SUCCESS" ? "green" : "red";
}

/**
 * Socket's check on the PR's current head, with `NEUTRAL` read as `skipped`
 * rather than `red` (see `SupplyChainState`). Every other conclusion reads as
 * `checkStateOf` reads it: a `FAILURE` is still a refusal, and stays one.
 */
export function supplyChainStateOf(rollup: readonly Rollup[], name: string): SupplyChainState {
  const newest = newestCheckRun(rollup, name);
  if (newest?.status === "COMPLETED" && newest.conclusion === "NEUTRAL") return "skipped";
  return checkStateOf(rollup, name);
}

export type PrReading = {
  number: number;
  /** ISO. The order opened, which is the merge order. */
  createdAt: string;
  headRefName: string;
  isDraft: boolean;
  /** GitHub's `state`: OPEN | MERGED | CLOSED. */
  state: string;
  /** GitHub's `mergeable`: MERGEABLE | CONFLICTING | UNKNOWN. */
  mergeable: string;
  /** GitHub's `mergeStateStatus`: CLEAN | BEHIND | BLOCKED | DIRTY | UNSTABLE | UNKNOWN. */
  mergeStateStatus: string;
  /** Every path the PR touches, for the shared-file prediction below. */
  files: readonly string[];
  /**
   * Each changed file's unified-diff PATCH, from the same REST payload `files`
   * is read from — the money hold's second half reads the changed lines (#987).
   * `patch` is `null` where GitHub omits it (binary files, very large diffs).
   */
  patches: readonly FilePatch[];
  gate: GateState;
  /**
   * THE WARDEN'S SEMGREP READING on this head — gate.yml's `static-shapes`
   * job, its own job beside `gate-checks` since #1034 so a ~100 s reading no
   * longer sits in front of the tests on one serial runner.
   *
   * ⚠ READ HERE FOR THE SAME REASON `supplyChain` IS. A job the merge road
   * does not read is a decoration: the merging account is an admin and
   * `enforce_admins` on `main` is off (#460), so registering the job as a
   * required check binds nobody who merges here. Splitting semgrep out of
   * `gate-checks` without this field would have turned a blocking finding
   * into a red badge — the exact "installed and never connected" shape the
   * field below was written to avoid. Same four states, same three roads:
   * running waits, red stops, absent is judged after mergeability.
   */
  staticShapes: GateState;
  /**
   * THE BUNDLE BUDGET on this head — gate.yml's `bundle-budget` job (#1035),
   * which builds the client and refuses when the JS a customer downloads
   * before first paint exceeds the budget declared in
   * `scripts/lib/bundleBudget.mts`.
   *
   * Read here for `staticShapes`' reason, which is `supplyChain`'s reason: a
   * job the merge road does not read is a decoration on this repository,
   * where the merging account is an admin and `enforce_admins` is off (#460).
   * Same four states, same three roads: running waits, red stops, absent is
   * judged after mergeability.
   */
  bundleBudget: GateState;
  /**
   * SOCKET'S OWN SUPPLY-CHAIN VERDICT on this head (`Socket Security: Pull
   * Request Alerts`) — the founder's ruling on #35, verbatim and entire: **"A"**,
   * which is *"just let Socket's own verdict do the blocking"*.
   *
   * ⚠ **IT IS READ HERE BECAUSE A REQUIRED STATUS CHECK ALONE WOULD NOT HAVE
   * BOUND US.** Measured the night the ruling landed: the account that performs
   * every merge in this repository is an **admin** (`permissions.admin: true`)
   * and `enforce_admins` on `main` is **false**, so GitHub's own branch
   * protection lets it merge straight through a failing required check. Adding
   * the context and stopping there would have been the fifth entry on this
   * project's list of safety nets that were installed and never connected —
   * which is the exact list his own card invoked when he chose A.
   *
   * The context IS registered on `main` as well (it binds anyone who is not an
   * admin, and it is what makes the verdict a rule rather than a decoration).
   * This field is the half that binds the road we actually merge on, and it
   * runs no second scan and needs no token: it reads a verdict Socket already
   * posted for free.
   *
   * Five states, not four: `skipped` is Socket declining to read a head it saw
   * too early (#1051), stopped at step 5.5 beside `absent` with its own remedy.
   */
  supplyChain: SupplyChainState;
  review: ReviewPresence;
  /** How many reviewer verdicts exist for this PR right now. */
  verdictCount: number;
  /**
   * ⚠ AN ACKNOWLEDGEMENT IS PINNED TO WHAT WAS READ, NOT TO THE PR.
   *
   * The verdict count at the moment `--acknowledge <n>` was honoured, or
   * `null` when the shift did not acknowledge this PR. The first shape of this
   * field was a plain boolean fixed at process start, and the gate review of
   * PR #558 named the hole: this tool can run for 45 minutes, so a SECOND
   * verdict landing mid-run — a `needs-fable` re-add, or a review that was
   * still in flight when the shift acknowledged — was auto-waived by an
   * acknowledgement given before it existed. `--acknowledge` says "I have read
   * what is there", and a number is the only honest record of what "there"
   * meant.
   */
  acknowledgedAtVerdictCount: number | null;
  /**
   * The registered `git worktree` holding this branch, or `null`. Merging main
   * into a branch needs a checkout, and this tool refuses to create one — a
   * worktree it did not cut is not one it should take down.
   */
  worktreePath: string | null;
};

export type MergeAction =
  /**
   * Squash-merge it now.
   *
   * `notice` is a line the caller MUST print when it merges — something true
   * about this merge that the shift would otherwise have to query the API to
   * learn. It is not a hold and it is not a warning: everything that holds a
   * PR is a `stop` or a `wait` above. `null` when there is nothing to say.
   */
  | { kind: "merge"; notice: string | null }
  /** Nothing to do here; move to the next PR. */
  | { kind: "skip"; reason: string }
  /** Poll again; something is legitimately in flight. */
  | { kind: "wait"; reason: string }
  /** `git merge origin/main` in the named worktree, commit, push. */
  | { kind: "sync-main"; reason: string; worktreePath: string }
  /** A human decision is required. Print it and exit; never guess. */
  | { kind: "stop"; reason: string };

/**
 * The self-skip case (#165): a PR whose diff touches the reviewer's own
 * workflow can never earn a green review — claude-code-action refuses to run
 * on it, the review job fails honestly, and `gate.yml` labels the PR
 * `review-skipped` with a hand-review obligation. That obligation is a
 * judgement, so this tool stops on it and takes `--acknowledge` as the answer.
 */
export const REVIEWER_WORKFLOW_PATH = ".github/workflows/review.yml";

/** The one file that declares what a money/auth diff is (#958). */
export const MONEY_DECLARATION_PATH = ".github/money-surfaces.sh";

/** The one file that declares which diffs a CUSTOMER sees (#1328). */
export const CUSTOMER_SURFACE_DECLARATION_PATH = ".github/customer-surfaces.sh";

/**
 * ⚠ THE MONEY/AUTH PATTERN IS EXTRACTED, NEVER COPIED.
 *
 * A second copy of a rule always drifts from the first (working law 4), and
 * this particular rule decides whether a PR with no reviewer verdict may
 * merge — the exact place a silent drift costs the most.
 *
 * ⚠ IT MOVED HOUSE ON 2026-09-15 (#958) AND THAT IS THE WHOLE POINT OF THIS
 * NOTE. It used to be read off a `MONEY='…'` line inside `review.yml`, which
 * was itself a byte-identical copy of `gate.yml`'s — so the repository had
 * THREE readers of one rule and two of them were copies. The declaration now
 * lives once, in `.github/money-surfaces.sh`, and `gate.yml`, `review.yml` and
 * this tool all read those bytes.
 *
 *     MONEY_PATHS='^server/routes/(billing|credits|auth|…)|…'
 *
 * This is the PATH half. The declaration also carries `MONEY_SYMBOLS`, a
 * reading of the diff's added and removed lines — see `extractMoneySymbols`
 * below. Until #987 this tool read the path half only and said so here.
 *
 * The extraction REFUSES rather than returning a default when the shape moves,
 * because a pattern that quietly matches nothing would let every money PR
 * through as ordinary. `server/prMergeOrder.test.ts` runs it against the real
 * declaration, so a rename reddens the suite instead of the gate.
 */
export function extractMoneyPattern(declarationText: string): string {
  const match = /^\s*MONEY_PATHS='([^']+)'\s*$/m.exec(declarationText);
  if (!match) {
    throw new Error(
      `could not find the MONEY_PATHS='…' line in ${MONEY_DECLARATION_PATH}. It is the ` +
        `single declaration of which diffs are money/auth diffs, and this tool ` +
        `refuses to guess at one rather than mirror it (working law 4).`,
    );
  }
  return match[1]!;
}

/** Does this PR touch a money/auth surface, by the reviewer's own pattern? */
export function touchesMoney(files: readonly string[], moneyPattern: string): boolean {
  const re = new RegExp(moneyPattern);
  return files.some((f) => re.test(f));
}

/**
 * THE SECOND HALF OF THE MONEY RULE — WHERE MONEY IS DECIDED (#987).
 *
 * `MONEY_PATHS` answers where money is stored and bought. `MONEY_SYMBOLS` names
 * the credit API, and the gate and `review.yml` both ask whether an added or
 * removed line mentions it (`git diff -G"$MONEY_SYMBOLS"`). Until #987 this
 * tool asked only the path question, so a casting refund fix the gate LABELS
 * `founder-review` passed its money hold as an ordinary diff. Measured on the
 * card the day it was taken: 5 of the 60 newest merged PRs — #986, #954,
 * #924, #874, #872.
 *
 * Extracted from the same declaration, never copied, and it REFUSES when the
 * line is missing for the same reason `extractMoneyPattern` does.
 */
export function extractMoneySymbols(declarationText: string): string {
  const match = /^\s*MONEY_SYMBOLS='([^']+)'\s*$/m.exec(declarationText);
  if (!match) {
    throw new Error(
      `could not find the MONEY_SYMBOLS='…' line in ${MONEY_DECLARATION_PATH}. It is the ` +
        `half of the money rule that names the credit API, and this tool refuses to ` +
        `run its money hold on the path half alone without saying so.`,
    );
  }
  return match[1]!;
}

/**
 * ⚠ THE DIRECTORIES THE GATE SCOPES ITS SYMBOL READING TO — A MIRROR, AND HELD.
 *
 * Both workflows run `git diff -G"$MONEY_SYMBOLS" … -- server shared`. The
 * scope is a literal in each of them rather than a line in the declaration, so
 * this constant is a third copy of it; `server/prMergeOrder.test.ts` reads the
 * pathspec back out of BOTH workflows and reddens if any of the three differ.
 * Without the scope this tool would hold a PR the gate does not label (a
 * script or a client file mentioning `addCredits`), which is two readers of
 * one rule giving two answers.
 */
export const MONEY_SYMBOL_ROOTS: readonly string[] = ["server", "shared"];

/** One changed file as the PR-files payload gives it. */
export type FilePatch = {
  filename: string;
  patch: string | null;
};

/**
 * ⚠ **THE SIZE RULE USED TO LIVE HERE AND THE FOUNDER DROPPED IT (#1328,
 * 2026-09-26).**
 *
 * #1194 gave the size obligation a second reader in this file, on the ground
 * that a PR which never got a triage run — a PR born CONFLICTING gets no
 * `pull_request` run for any event (#566) — was announced to nobody while this
 * tool printed `review=declined`, the same word it uses for a diff that
 * genuinely earned no look. That argument was right and it is why this limb
 * exists at all. **The QUESTION changed, not the shape.**
 *
 * His ruling, verbatim, asked whether a review on every PR was worth the
 * credits and shown the day's tally (22 seat PRs reviewed, 0 code defects
 * found): **"drop it"**. So `REVIEW_SIZE_LINE`, `REVIEW_NON_CODE`,
 * `changedCodeLines` and `exceedsReviewSizeLine` are gone, and with them the
 * `additions`/`deletions` columns of `FilePatch` and the parse refusal that
 * guarded them — **named here because a refusal standing over a reading nobody
 * performs is the dead-control-with-a-live-reputation shape (law 7's ruling
 * sweep), not because they were in the way.**
 *
 * What is asked instead is the one obligation none of the four mechanical
 * checks can discharge: **does this diff touch a surface a CUSTOMER sees?**
 * Working law 6 (render before shipping anything visual) and law 9 (his eye is
 * king) cannot be run in CI at all, so a customer-visible diff earns
 * `needs-fable` and the obligation is named as the relay's eye on the rendered
 * frames, both themes.
 *
 * ⚠ **IT CHANGES WHAT IS REPORTED, NOT WHAT MERGES**, exactly as #1194's half
 * did. An ordinary customer-visible PR with no verdict still merges on the gate
 * alone — the standing orders' own rule — but it reads `no-verdict`, which is
 * true, instead of `declined`, which claims triage decided something it may
 * never have seen.
 *
 * The extraction REFUSES rather than defaulting, for `extractMoneyPattern`'s
 * reason: a pattern that quietly matched nothing would make every customer diff
 * read as ordinary, which is the permissive direction.
 */
export function extractCustomerSurfacePattern(declarationText: string): string {
  const match = /^\s*CUSTOMER_SURFACE_PATHS='([^']+)'\s*$/m.exec(declarationText);
  if (!match) {
    throw new Error(
      `could not find the CUSTOMER_SURFACE_PATHS='…' line in ${CUSTOMER_SURFACE_DECLARATION_PATH}. ` +
        `It is the single declaration of which diffs a customer sees, and this tool refuses to ` +
        `guess at one rather than mirror it (working law 4).`,
    );
  }
  return match[1]!;
}

/**
 * The exemptions inside the prefix: the client's own test files and the staff
 * panels under `client/src/features/admin/`.
 *
 * It refuses when absent rather than treating "no exemptions" as the answer.
 * Without it every client test file would earn a hand review — the noisy
 * direction, but still a rule nobody wrote — and, worse, a reader that silently
 * dropped the exemption would disagree with triage about the same diff, which
 * is the two-readers-one-rule failure this declaration exists to prevent.
 */
export function extractCustomerSurfaceExemptPattern(declarationText: string): string {
  const match = /^\s*CUSTOMER_SURFACE_EXEMPT='([^']+)'\s*$/m.exec(declarationText);
  if (!match) {
    throw new Error(
      `could not find the CUSTOMER_SURFACE_EXEMPT='…' line in ${CUSTOMER_SURFACE_DECLARATION_PATH}. ` +
        `Without it this tool cannot tell a customer surface from the client's own tests or the ` +
        `staff panels, and it would disagree with triage about the same diff.`,
    );
  }
  return match[1]!;
}

/**
 * Does this diff touch a surface a customer sees?
 *
 * The same two greps triage runs, in the same order: matched by the prefix,
 * then dropped by the exemption. A file must survive both — the two readers
 * answer one question or the second one is a different rule wearing the first
 * one's name.
 */
export function touchesCustomerSurface(
  files: readonly string[],
  pathPattern: string,
  exemptPattern: string,
): boolean {
  const surface = new RegExp(pathPattern);
  const exempt = new RegExp(exemptPattern);
  return files.some((f) => surface.test(f) && !exempt.test(f));
}

/**
 * The files under `MONEY_SYMBOL_ROOTS` whose added or removed lines name the
 * credit API — this tool's reading of `git diff -G"$MONEY_SYMBOLS" -- server shared`.
 *
 * The same shape as `-G`: the `+`/`-` marker is stripped and the rest of the
 * line is tested, hunk headers (`@@ … @@ function recordRefund`) and the
 * `\ No newline at end of file` marker are not changed lines, and a line
 * removed and re-added with the symbol on both sides still counts.
 *
 * ⚠ ITS ONE STATED LIMIT: GitHub OMITS `patch` for binary files and for very
 * large diffs. Such a file contributes no symbol hit and falls back to the path
 * reading — which is exactly this tool's behaviour before #987, so the failure
 * direction is unchanged rather than widened. The gate's `git diff` has no such
 * limit, so on that one shape the gate can label a PR this tool does not hold.
 */
export function moneySymbolHits(patches: readonly FilePatch[], symbolPattern: string): string[] {
  const re = new RegExp(symbolPattern);
  return patches
    .filter((f) => MONEY_SYMBOL_ROOTS.some((root) => f.filename.startsWith(`${root}/`)))
    .filter(
      (f) =>
        f.patch !== null &&
        f.patch
          .split(/\r?\n/)
          .some((line) => (line.startsWith("+") || line.startsWith("-")) && re.test(line.slice(1))),
    )
    .map((f) => f.filename);
}

export function touchesReviewerWorkflow(files: readonly string[]): boolean {
  return files.includes(REVIEWER_WORKFLOW_PATH);
}

/**
 * ⚠ THE CHECK NAMES THIS TOOL KEYS ON ARE DERIVED FROM THE WORKFLOW FILES.
 *
 * The gate review of PR #558 found the first shape mirroring them — `"review"`
 * and `"gate-checks"` as literals, with the suite header claiming an arm read
 * them from source when none did. The `review` one fails in the SILENT,
 * PERMISSIVE direction, which is the direction that costs: rename that job and
 * every run reads as "no verdict" forever, so ordinary PRs with real verdicts
 * merge unread and nothing anywhere reddens.
 *
 * A workflow's check name is the job's `name:` if it declares one, else the job
 * key. This returns every job name a workflow declares, so the caller can
 * REFUSE at startup when the name it needs is not among them — a fail-closed
 * check rather than a second copy of a string.
 */
export function extractJobNames(workflowYaml: string): string[] {
  const lines = workflowYaml.split(/\r?\n/);
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start === -1) {
    throw new Error("workflow declares no top-level `jobs:` block — read it by hand");
  }
  const names: string[] = [];
  let key: string | null = null;
  let named = false;
  const flush = () => {
    if (key !== null && !named) names.push(key);
    key = null;
    named = false;
  };
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) && line.trim() !== "") break; // back to top level
    const jobKey = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobKey) {
      flush();
      key = jobKey[1]!;
      continue;
    }
    const jobName = /^ {4}name:\s*(.+?)\s*$/.exec(line);
    if (jobName && key !== null && !named) {
      names.push(jobName[1]!.replace(/^["']|["']$/g, ""));
      named = true;
    }
  }
  flush();
  if (names.length === 0) throw new Error("workflow declares no jobs — read it by hand");
  return names;
}

/**
 * Refuse at startup rather than reading a renamed job as an absent one.
 * Returns a refusal reason, or `null` when the name is declared.
 */
export function refuseUnknownJobName(
  needed: string,
  declared: readonly string[],
  workflowPath: string,
): string | null {
  if (declared.includes(needed)) return null;
  return (
    `${workflowPath} declares no job named \`${needed}\` — it declares ` +
    `${declared.map((n) => `\`${n}\``).join(", ")}. This tool keys on that name, and reading a ` +
    `renamed job as an absent one fails SILENTLY in the permissive direction, so it refuses ` +
    `instead. Update the constant beside the rename.`
  );
}

/** The merge order is the order opened; the number breaks a same-second tie. */
export function orderByOpened(prs: readonly PrReading[]): PrReading[] {
  return [...prs].sort((a, b) => {
    const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return d !== 0 ? d : a.number - b.number;
  });
}

/**
 * Whether a later PR will need main merged into it once an earlier one lands.
 *
 * ⚠ IN THIS REPOSITORY THE ANSWER IS ALMOST ALWAYS YES, AND THAT IS BY
 * DESIGN, NOT A BUG IN THE PREDICTOR. The pre-commit hook regenerates both
 * generated maps on any commit touching a path they are built from (#501), so
 * two concurrent branches nearly always both carry
 * `docs/architecture/drape-architecture.json`. That is exactly why PR #550
 * went CONFLICTING the moment #549 merged. The predictor is here so the tool
 * can say WHY before GitHub has finished recomputing `mergeable`; the
 * artifact — `mergeable: CONFLICTING` / `mergeStateStatus: BEHIND` — is what
 * actually triggers the sync, because a report is a claim and the artifact is
 * the fact (working law 1).
 */
export function sharesFiles(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set(a);
  return b.filter((f) => set.has(f)).sort();
}

export type MergeContext = {
  /** From `extractMoneyPattern`, so the money rule cannot drift. */
  moneyPattern: string;
  /** From `extractMoneySymbols` — the rule's second half (#987). */
  moneySymbols: string;
};

/**
 * THE ABSENCE SAID OUT LOUD ON THE MERGE ITSELF — #566's second half, and the
 * whole of what that card asked for: *"a shift should not have to query the
 * API to learn there is no reviewer."*
 *
 * ⚠ A NOTICE IS NOT A HOLD, AND KEEPING THOSE TWO APART IS THE DESIGN
 * DECISION HERE. The standing orders merge an ordinary PR on the gate alone
 * when the reviewer is down, and this does not change that by one PR — every
 * refusal still lives in a `stop` or a `wait` above, and a money/auth diff is
 * already held whichever absence it carries. What changes is that the merge
 * says WHICH of the two happened, at the moment it happens, in the shift's own
 * log. Silence was the defect: PR #563 merged on its gate with no reviewer,
 * correctly by the orders and unknowably by the transcript, and it took a hand
 * query at the API a day later to find out.
 *
 * `declined` earns no notice. It is the design working — a diff that touches no
 * money/auth surface, no customer surface and no review rule is SUPPOSED not to
 * be reviewed (a docs change, a server test, a crew script), and a line about it
 * on every such merge is noise that would teach shifts to skip reading these.
 *
 * ⚠ AND IT STATES THE FACT, NEVER THE BASIS OF THE MERGE (PR #665's review,
 * finding 2). The first wording said this was *"merging on the gate alone,
 * which the standing orders permit for a non-money diff"* — and that is FALSE
 * on a road this function is reachable from: a money/auth PR whose review is
 * absent is held at 4b, and a shift that hand-reviews it and re-runs with
 * `--acknowledge` clears that hold and arrives here. Both halves would then
 * be wrong — it IS a money diff, and it merged on the gate PLUS a hand review.
 * **`mergeNotice` cannot see whether the caller acknowledged or which files
 * moved, so it must not narrate either.** That is the same
 * confident-wrong-diagnosis shape as the `skip-review` sentence this PR
 * retires, which is why it was worth a push rather than a note.
 */
export function mergeNotice(pr: PrReading): string | null {
  // `absent` was the one state that carried a notice, and it is retired with
  // the action reviewer (#1065): nothing can fail to be created any more. Kept
  // as a function because the CLI prints it and an arm pins it silent.
  void pr;
  return null;
}

/**
 * WHY THERE IS NO VERDICT, in the words a shift can act on (#566).
 *
 * The two absences read identically on the checks page and want opposite next
 * moves: `declined` means the reviewer LOOKED and this diff did not earn a
 * look, so the remedy is a label; `absent` means nothing ran, so the remedy is
 * to make something run — and the old wording sent a shift hunting a
 * `skip-review` label that was never applied.
 *
 * ⚠ IT RETURNS A CLAUSE, NOT A SENTENCE, and it is deliberately EMPTY for
 * `no-verdict` and for the two live states. A caller appends it inside its own
 * reason and owns the full stop; a helper that guessed at punctuation would be
 * a second place that knows how these sentences are built.
 */
export function reviewAbsenceClause(review: ReviewPresence): string {
  switch (review) {
    case "declined":
      return (
        " (triage did not label this diff `needs-fable`, so by its own rule nobody owed it a " +
        "look — but a money/auth diff ALWAYS does, whatever the label says)"
      );
    default:
      return "";
  }
}

/**
 * THE DECISION. Branch order is the contract — read the module header.
 */
export function decideMergeAction(pr: PrReading, ctx: MergeContext): MergeAction {
  // 1. Already resolved. Nothing here can be waited on or acted on.
  if (pr.state === "MERGED") return { kind: "skip", reason: "already merged" };
  if (pr.state !== "OPEN") {
    return { kind: "skip", reason: `state is ${pr.state}, not OPEN — nothing to merge` };
  }

  // 2. A draft is the shift itself saying the diff is not finished, and it is
  //    also what suppresses the reviewer. Marking it ready is a judgement
  //    (it spends a review round), so it is never done from here.
  if (pr.isDraft) {
    return {
      kind: "stop",
      reason:
        "it is a DRAFT. Marking a PR ready spends a review round, so it is the shift's " +
        `act: \`gh pr ready ${pr.number}\` when the diff is finished, then re-run.`,
    };
  }

  // 3. The gate, before anything that costs a network round trip or a clock —
  //    but only the two states that are readings of THIS head. `absent` moved
  //    below mergeability; see step 5.5 for the measurement that moved it.
  if (pr.gate === "running") {
    return { kind: "wait", reason: "gate-checks is running" };
  }
  if (pr.gate === "red") {
    return {
      kind: "stop",
      reason:
        "gate-checks FAILED. This tool never retries a gate and never merges past one — " +
        "read the run, fix it, push. `pnpm preflight` catches the cheap causes before the push.",
    };
  }
  // 3.2 The semgrep job, immediately after the gate and read exactly like it:
  //     a reading of THIS head, split out of `gate-checks` by #1034. Answered
  //     after the gate so a diff failing both is sent to the run with the
  //     test output first.
  if (pr.staticShapes === "running") {
    return { kind: "wait", reason: "static-shapes (semgrep) is running" };
  }
  if (pr.staticShapes === "red") {
    return {
      kind: "stop",
      reason:
        "static-shapes FAILED — semgrep found a shape it refuses. This tool never merges past " +
        "a red gate job — read the run, fix it at the line (`// nosemgrep: <rule.id> -- <reason>` " +
        "where the finding is wrong), push. `pnpm warden:semgrep` reads the same bytes locally.",
    };
  }
  // 3.3 The bundle budget, read exactly like the semgrep job: a reading of THIS
  //     head (#1035). After semgrep so a diff failing several is told about
  //     them in the gate's own order.
  if (pr.bundleBudget === "running") {
    return { kind: "wait", reason: "bundle-budget (the first download's size) is running" };
  }
  if (pr.bundleBudget === "red") {
    return {
      kind: "stop",
      reason:
        "bundle-budget FAILED — the JS a customer downloads before first paint is over the " +
        "budget in scripts/lib/bundleBudget.mts. This tool never merges past a red gate job — " +
        "read the run's verdict line, find what went eager (`pnpm machinist:bundle` names the " +
        "owners), push. `npx tsx scripts/bundle-budget.mts` reads the same bytes locally.",
    };
  }
  // 3.5 Socket's supply-chain verdict, immediately after the gate and for the
  //     same reason: it is a reading of THIS head that costs nothing to consult.
  //     See `supplyChain` above for why this is read here rather than left to
  //     branch protection.
  if (pr.supplyChain === "running") {
    return { kind: "wait", reason: "Socket's supply-chain verdict is still running" };
  }
  if (pr.supplyChain === "red") {
    return {
      kind: "stop",
      reason:
        "Socket REFUSED this diff — its supply-chain verdict on this head is failing. " +
        "Read the alerts on the PR: something in the dependency tree does more than it " +
        "used to, or a package changed hands. This tool never merges past that verdict " +
        "(founder ruling on #35: \"A\").",
    };
  }
  /* `absent` is NOT read here — it moved to step 5.5 beside the gate's own
     absent, for the identical reason. See the note there. `skipped` is read
     there too, for the same reason again: a head Socket skipped on open is a
     head that may be about to be replaced by the sync at step 5. */

  // 4. The reviewer. Green is not a pass (#219): a verdict exists to be READ,
  //    and reading it is the one thing here that is not mechanical.
  //
  //    4a. IN FLIGHT IS NOT DOWN, and it comes first. The gate finishes while
  //    a PR is still a draft; `gh pr ready` then starts the review and starts
  //    NO new gate run — so "green gate, review mid-run" is the team's routine
  //    first-round state, not a tail case, and reading it as "no verdict" is
  //    how this tool would have merged past a review by default (#558 review,
  //    finding 1).
  if (pr.review === "verdict") {
    if (pr.acknowledgedAtVerdictCount === null) {
      return {
        kind: "stop",
        reason:
          "a hand verdict exists and has not been acknowledged. A verdict is never a pass by " +
          "itself — its findings are in the comment headed `**Fable review — by hand`. Read it, " +
          `then re-run with --acknowledge ${pr.number}.`,
      };
    }
    if (pr.acknowledgedAtVerdictCount < pr.verdictCount) {
      return {
        kind: "stop",
        reason:
          `a NEWER verdict landed after your acknowledgement (${pr.verdictCount} verdicts now, ` +
          `${pr.acknowledgedAtVerdictCount} when you acknowledged). An acknowledgement is pinned ` +
          "to what was read, not to the PR. Read the newest hand verdict and re-run.",
      };
    }
  }
  // 4b. No verdict at all. Two populations are held rather than merged, and
  //     the second of them keys on `declined` and `absent` as well as on
  //     `no-verdict`: triage honours a `skip-review` label BEFORE it tests the
  //     money pattern, so a stale label on a PR that later gains a money file
  //     produces a money diff with a DECLINED review and no verdict anywhere
  //     (#558 review, finding 5). Where a human used to click merge, this tool
  //     now does.
  if (pr.review === "no-verdict" || pr.review === "declined") {
    const acknowledged = pr.acknowledgedAtVerdictCount !== null;
    // ⚠ THIS STOP COVERS `declined` AND `absent` AS WELL AS `no-verdict`, and
    //    the round-three review of #558 is why: the round-two fix taught the
    //    MONEY hold that lesson and left its sibling one clause away — working
    //    law 7's own shape, a class fixed at one of its two members. THREE
    //    roads now reach a `review.yml` PR with no verdict: a stale
    //    `skip-review` label (triage honours it BEFORE the self-skip check)
    //    and a triage-job outage, both of which leave a run that DECLINED;
    //    and — #566 — a trigger event GitHub never turned into a run at all,
    //    which leaves nothing. Every one of them would have merged the
    //    reviewer's own workflow with no verdict and no hand review, so the
    //    #566 split changes what is SAID here and deliberately not what is
    //    HELD: an absence is at least as bad as a decision, never less.
    if (touchesReviewerWorkflow(pr.files) && !acknowledged) {
      return {
        kind: "stop",
        reason:
          `it touches ${REVIEWER_WORKFLOW_PATH} — the rules of the review itself — and no fresh ` +
          "hand verdict exists. The relay reviews a change to its own rules at its next sitting " +
          `and posts the verdict; then re-run with --acknowledge ${pr.number}.`,
      };
    }
    // #987: either half of the money rule holds, never only the first. A PR the
    // path list misses but whose changed lines name the credit API is the
    // casting refund fix the gate labels `founder-review` — say which file, so
    // the shift is not left hunting for why an unfamiliar path is money.
    const symbolHits = moneySymbolHits(pr.patches, ctx.moneySymbols);
    const byPath = touchesMoney(pr.files, ctx.moneyPattern);
    if ((byPath || symbolHits.length > 0) && !acknowledged) {
      return {
        kind: "stop",
        reason:
          (byPath
            ? "it touches a money/auth surface"
            : `it touches a money/auth surface — a changed line in ${symbolHits[0]} names the ` +
              "credit API") +
          " and NO reviewer verdict exists" +
          reviewAbsenceClause(pr.review) +
          ". The standing orders merge an ordinary PR on the gate alone and HOLD a money/auth " +
          "one: the relay reviews it at its next sitting and posts a comment headed " +
          "`**Fable review — by hand` (#1065). A shift neither merges it nor posts that comment. " +
          `Once the verdict is on the PR, re-run with --acknowledge ${pr.number}.` +
          /*
            ⚠ ONE OF THOSE TWO REMEDIES CANNOT FIRE ON A CONFLICTING HEAD, AND
            SAYING SO IS THIS FIX'S OWN PREMISE TURNED ON ITSELF (PR #631's
            review, finding 1). Moving the absent-gate wait DOWN made this stop
            reachable on a conflicting PR for the first time — an improvement,
            since before it hung above here for ever. But GitHub creates no
            check suite for a conflicting head, which is exactly why the gate
            reads `absent`, and the reviewer runs on that same machinery: a
            re-added `needs-fable` used to produce nothing to wait for. With the
            action retired (#1065) the hand-review road is the only road, and a
            re-run then reaches the sync below.
          */
          (readPullRequestConflict(pr) === true
            ? " ⚠ This PR is also CONFLICTING; the sync happens after the acknowledgement."
            : ""),
      };
    }
  }

  // 5. Mergeability. UNKNOWN is GitHub still computing, which it always is for
  //    a few seconds after a merge lands on main — waiting is the correct
  //    reading of it, and treating it as clean is how a tool merges a conflict.
  /* `=== true` rather than truthiness: the declaration's third state is `null`
     for "not knowable", and `if (x)` would read that as clean — which on the
     tool that MERGES is the direction that merges a conflict. */
  if (readPullRequestConflict(pr) === true) {
    return syncOrStop(
      pr,
      "it is CONFLICTING with main — in this repository that is nearly always the two " +
        "generated maps, which the merge driver and the pre-commit hook resolve on the " +
        "merged tree (#100/#501)",
    );
  }
  if (pr.mergeStateStatus === "BEHIND") {
    return syncOrStop(pr, "it is BEHIND main and the branch must be updated before it merges");
  }

  /*
    5.5 · ⚠ AN ABSENT GATE IS READ **HERE**, AFTER THE CONFLICT, AND NOT UP AT
    STEP 3 — BECAUSE A CONFLICTING PR NEVER GETS A GATE RUN AT ALL.

    Measured 2026-09-07, on the very case this tool was built for. PR #627
    merged; #628 went CONFLICTING on the generated atlas fingerprint seconds
    later — the collision this module's own header calls *"nearly always
    non-empty in this repository"* — and GitHub therefore created no check
    suite for it. With the `absent` wait at step 3 the tool printed

        #628 WAIT — no gate-checks run on this head commit yet.

    every 32 seconds, for ever, **while holding the one action that would have
    produced a gate run.** The sync road at step 5 is the reason this tool
    exists, and it was unreachable in the commonest case of the exact scenario
    it was written for: a later PR sharing the maps with an earlier one.

    ⚠ **ONLY `absent` MOVED, AND THAT IS THE WHOLE CARE IN THIS FIX.**
    `running` and `red` stay at step 3, because each is a real reading of the
    head this branch has NOW: syncing past a red would look exactly like the
    gate retry this tool refuses to perform, and syncing past a running one
    would throw away a run that is about to answer. `absent` is the only gate
    state a conflict can CAUSE, so it is the only one whose meaning depends on
    a question asked further down.

    Below here the branch is mergeable, so an absent gate is the genuine stall
    (#368) and the sentence is unchanged.
  */
  if (pr.gate === "absent") {
    return {
      kind: "wait",
      reason:
        "no gate-checks run on this head commit yet. " +
        `\`gate-stall-check --pr ${pr.number} --watch\` is the reading that tells a slow ` +
        "start from one that will never arrive (#368).",
    };
  }
  /*
    ⚠ AND SOCKET'S ABSENT IS READ HERE FOR THE IDENTICAL REASON — PR #761
    review, finding 1, which caught it sitting up at step 3.5 where it would
    have wedged this tool's own primary road.

    The scenario is deterministic rather than hypothetical, and it is the one
    this module exists for: two overlapping PRs, both green; A merges; B goes
    CONFLICTING on the generated maps (the collision this header calls "nearly
    always non-empty here"); B's OLD head still carries a green Socket check so
    it passes 3.5 and reaches the sync at step 5; `syncMain` pushes a NEW head.
    Thirty seconds later that head has no checks at all — `gate=absent` AND
    `socket=absent` — and an absent-stop above the sync would abandon the whole
    remaining order while printing "the outside service is down or uninstalled"
    about a commit thirty seconds old. **A confidently wrong diagnosis**, which
    is the class this module has already retired twice by name.

    So the rule that moved the gate's absent moves this one: an absent reading a
    CONFLICT can cause is meaningless until the conflict is answered. `red` and
    `running` stay at 3.5, because each is a true reading of the head as it
    stands.

    Below here the branch is mergeable, so this absence is the real one.
  */
  /* The semgrep job's absent is read on the gate's own road, for the gate's own
     reason: both are jobs of ONE workflow run, so `gate=absent` and
     `staticShapes=absent` are one fact (no run on this head yet) and the
     stall reader below is the answer to both. Only a head whose gate has
     RUN and whose semgrep job has not — a workflow edited to drop the job —
     reaches this line, and that is a refusal, not a wait. */
  if (pr.staticShapes === "absent") {
    return {
      kind: "stop",
      reason:
        "gate-checks ran on this head but no `static-shapes` job did, and this tool will not " +
        "read that silence as a pass. Either the head was gated by a workflow from before " +
        "#1034 (merge main into the branch and let the gate run again) or gate.yml on this " +
        "branch has lost the semgrep job (read it).",
    };
  }
  /* And the bundle budget's absent, on the same road for the same reason: one
     workflow run, so a head whose gate RAN without this job is a workflow
     that lost it, not a run that has not started. */
  if (pr.bundleBudget === "absent") {
    return {
      kind: "stop",
      reason:
        "gate-checks ran on this head but no `bundle-budget` job did, and this tool will not " +
        "read that silence as a pass. Either the head was gated by a workflow from before " +
        "#1035 (merge main into the branch and let the gate run again) or gate.yml on this " +
        "branch has lost the bundle-budget job (read it).",
    };
  }
  if (pr.supplyChain === "skipped") {
    /* ⚠ A SKIP IS NOT A REFUSAL, AND UNTIL #1051 THIS TOOL SAID IT WAS. Socket
       reads a PR on `opened`, seconds after the draft exists; if GitHub has
       not computed mergeability yet, or the base commit is not visible to it
       yet, it posts `NEUTRAL` titled "Skipped" and does not read again on
       `ready_for_review` — only a push makes it look. The old reading was
       `red`, and the stop said "Socket REFUSED this diff … read the alerts",
       which sent a shift to read alerts that did not exist (~25 minutes and
       two gate runs on #1048 + #1050). It stops here still — a skip is no
       verdict and this tool never merges past no verdict — but it says what
       it is and names the one remedy there is. `rerequest` is 404 for this
       app; a new head is the only road. */
    return {
      kind: "stop",
      reason:
        "Socket SKIPPED this head rather than reading it — it posted NEUTRAL, which is no " +
        "verdict, not a refusal: there are no alerts to read. It reads a PR seconds after " +
        "it opens, before GitHub has computed mergeability (or before it can see the base " +
        "commit), and it never reads that head again. Push a NEW head — an empty commit " +
        "(`git commit --allow-empty`) is enough — and Socket reads it on the push. This tool " +
        "never merges past a missing verdict (founder ruling on #35: \"A\").",
    };
  }
  if (pr.supplyChain === "absent") {
    /* ⚠ HIS OWN STATED RISK, MADE LOUD RATHER THAN SILENT. Option A's
       consequence line names it: *"it is an outside service, so if it ever
       fails to post its verdict a change would sit waiting until it does"*.
       Measured before the ruling was executed: 4 of 4 PRs since the app was
       installed carried both Socket checks, so absent is genuinely rare — and
       #566 is this repository's own lesson that an absent check is the one
       state that reads exactly like no control at all. So it STOPS and says
       which of the two it is, rather than waiting silently or merging. */
    return {
      kind: "stop",
      reason:
        "Socket posted NO supply-chain verdict on this head — that is not a pass, it is " +
        "no answer, and this branch is mergeable so no conflict explains it. Every PR " +
        "since the app was installed has carried one, so this is the outside service " +
        "being down or uninstalled rather than a diff it ignored. Re-run it, or if Socket " +
        "is gone the required check on `main` has to go with it — never read silence as " +
        "approval.",
    };
  }
  // ⚠ UNSTABLE is deliberately NOT a hold, and the reason is written down
  //    because the #558 review raised it as the thing that failed to rescue
  //    finding 1. It means a NON-REQUIRED check is pending or red — and in
  //    this repository the usual non-required check is `review`, which is red
  //    BY DESIGN on any PR touching the reviewer's own workflow (#165). Holding
  //    on UNSTABLE would deadlock exactly those PRs forever. The two states it
  //    stands for are both read at their own source instead: the gate directly,
  //    and the review through `pending`/`verdict` above.
  if (pr.mergeable === "UNKNOWN" || pr.mergeStateStatus === "UNKNOWN") {
    return {
      kind: "wait",
      reason: "GitHub has not finished computing mergeability (mergeable=UNKNOWN)",
    };
  }
  if (pr.mergeStateStatus === "BLOCKED") {
    return {
      kind: "stop",
      reason:
        "branch protection reports BLOCKED with the gate green — a required check is still " +
        "missing or a review is required. Read the PR's own checks page; this tool will not " +
        "merge past branch protection.",
    };
  }

  return { kind: "merge", notice: mergeNotice(pr) };
}

function syncOrStop(pr: PrReading, why: string): MergeAction {
  if (pr.worktreePath === null) {
    return {
      kind: "stop",
      reason:
        `${why}, but no registered git worktree holds ${pr.headRefName}, so there is nowhere ` +
        "to merge main in. This tool never cuts a worktree it would then have to take down: " +
        `\`npx tsx scripts/shift-worktree.mts add ${pr.headRefName.replace(/^team\//, "")}\`, ` +
        "merge main there, push, and re-run.",
    };
  }
  return { kind: "sync-main", reason: why, worktreePath: pr.worktreePath };
}

/**
 * ⚠ THE PUSH THIS TOOL PERFORMS CAN NEVER BE A PUSH TO `main`, AND THAT IS
 * MADE STRUCTURAL HERE RATHER THAN ARGUED IN A COMMENT.
 *
 * `syncMain` runs a bare `git push` inside a worktree, which pushes that
 * worktree's CURRENT branch. Every reachable path sets that worktree from a
 * PR's own head branch, and a PR's head is never `main` — but "never by
 * construction elsewhere" is exactly the shape of reasoning the enumerated
 * push-path list exists to distrust (#263, and the founder's bar: the answer
 * must come from a search, not an assumption). So the branch is READ back
 * immediately before the push and compared against the refs
 * `.githooks/pre-push` guards, derived from the hook itself rather than
 * restated (`readProtectedRefs`, working law 4).
 *
 * The deploy rite remains the only door to main. This is the lock that keeps
 * that sentence true of this file.
 */
export function refuseProtectedPush(
  currentBranch: string,
  protectedRefs: readonly string[],
): string | null {
  if (!protectedRefs.includes(currentBranch)) return null;
  return (
    `REFUSING to push: the worktree is on \`${currentBranch}\`, which .githooks/pre-push ` +
    `guards. The deploy rite (\`npx tsx scripts/deploy-rite.mts\`) is the only road to a ` +
    `protected ref, and this tool is not it.`
  );
}

/**
 * ⚠ A DIRTY WORKTREE IS A STOP, NEVER A MERGE (#558 review, finding 4).
 *
 * The overlap rule makes these worktrees a shift's ACTIVE workspace — that is
 * the whole point of them. A merge commit folds whatever is staged into
 * itself, so merging main into a branch whose worktree carries half-finished
 * work pushes that work onto the PR silently, in a commit whose message says
 * "Merge branch main". There is no reading of the shift's intent that belongs
 * in a tool, so it names the files and stops.
 *
 * Takes `git status --porcelain` output; returns a refusal or `null`.
 */
export function refuseDirtyWorktree(porcelain: string): string | null {
  const entries = porcelain
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (entries.length === 0) return null;
  return (
    `the worktree is not clean (${entries.length} entr${entries.length === 1 ? "y" : "ies"}): ` +
    `${entries.join("; ")}. A merge would fold uncommitted work into the merge commit and push ` +
    `it onto the PR. Commit or stash it, then re-run.`
  );
}

/**
 * ⚠ A MERGE THAT STOPPED AND A MERGE THAT NEVER STARTED LOOK IDENTICAL FROM
 * AN EXIT CODE, AND THEY NEED OPPOSITE THINGS (#558 review, finding 4).
 *
 * The atlas merge driver accepts a placeholder and leaves the regenerated map
 * STAGED with `MERGE_HEAD` written, waiting for `git commit --no-edit` — git
 * does not re-read the index after `pre-merge-commit`, so that commit is the
 * documented next step and not a workaround. A merge that REFUSED to begin —
 * local changes would be overwritten, an unborn branch — writes no `MERGE_HEAD`
 * at all, and firing a blind commit at it produced a misleading "unresolved
 * paths" message in the first shape of this tool.
 */
export type MergeOutcome = "clean" | "conflict" | "atlas-driver-stop" | "never-started";

export function classifyMergeOutcome(input: {
  exitCode: number;
  /** `git diff --name-only --diff-filter=U` output. */
  unmergedPaths: string;
  /** Whether the path `git rev-parse --git-path MERGE_HEAD` names exists. */
  mergeHeadExists: boolean;
}): MergeOutcome {
  if (input.unmergedPaths.trim() !== "") return "conflict";
  if (input.exitCode === 0) return "clean";
  return input.mergeHeadExists ? "atlas-driver-stop" : "never-started";
}

/** One line, in the words the mailbox entry and the briefing use. */
export function describeAction(pr: PrReading, action: MergeAction): string {
  switch (action.kind) {
    case "merge":
      // ⚠ THE NOTICE RIDES THE SAME LINE THE MERGE ALREADY PRINTS (#566), so
      //    it lands in the shift's log without a second call site to forget.
      //    `describeAction` is the ONE printer the CLI uses for every action,
      //    which is why the notice is attached here and not beside `mergePr`:
      //    a shift's transcript is the artifact that was silent, and this is
      //    the line that was in it.
      return (
        `#${pr.number} MERGE — gate green, nothing unread, mergeable.` +
        (action.notice === null ? "" : `
    ⚠ ${action.notice}`)
      );
    case "skip":
      return `#${pr.number} SKIP — ${action.reason}.`;
    case "wait":
      return `#${pr.number} WAIT — ${action.reason}.`;
    case "sync-main":
      return `#${pr.number} SYNC MAIN — ${action.reason}. Worktree: ${action.worktreePath}`;
    case "stop":
      return `#${pr.number} STOP — ${action.reason}`;
  }
}

/**
 * ⚠ **A FAILURE AFTER THE IRREVERSIBLE ACT LOOKS EXACTLY LIKE A FAILURE BEFORE
 * IT, AND THAT IS THE WHOLE OF #568.**
 *
 * `gh pr merge --delete-branch` does two things under one exit code: it merges
 * the pull request on GitHub, and then it tidies up LOCALLY — switching the
 * checkout off the branch it is about to delete. In a shift's worktree that
 * second half cannot work, because the main tree holds `main` by the standing
 * orders' own rule, and git refuses:
 *
 *     fatal: 'main' is already used by worktree at 'C:/Users/Admin/Drape'
 *
 * Measured on PR #567 (shift `foreman-20260905-2329`): **the merge landed**
 * (`49acd1d1`, `MERGED 2026-09-05T14:42:16Z`) and the tool threw a raw
 * `execFileSync` dump naming the merge call. The shift had no way to tell that
 * from a merge that never happened, and only learned the truth by asking
 * `gh pr view` by hand — a report contradicting its own artifact, which is
 * working law 1's whole subject.
 *
 * So the exit code is never the receipt. **GitHub's own answer is**, and this
 * function is the reading of it: what `gh` did is one input, what the record
 * says is the other, and only their combination names a state.
 *
 * The four states, and why each is separate rather than folded into a
 * neighbour:
 *
 *   * `merged` — the ordinary road. `gh` returned, GitHub says MERGED.
 *   * `merged-then-failed` — **the #568 state.** The PR is merged and
 *     something after it failed. The caller reports the receipt and carries
 *     on; treating this as a failure is what cost the shift its diagnosis.
 *   * `not-merged` — `gh` failed and the record agrees nothing landed. A real
 *     failure, and the raw output is the useful part.
 *   * `merge-state-unknown` — the read-back itself failed, so **neither**
 *     answer is established. It is deliberately NOT folded into `not-merged`:
 *     a broken reader voting for "nothing happened" is how an instrument stops
 *     being able to fail (working law 2), and here it would send a shift to
 *     re-merge a pull request that may already be in `main`.
 *
 * ⚠ **THAT LAST NAME IS DELIBERATE AND IT USED TO BE `unreadable`** (PR #612
 * review, finding 2). The capability atlas counts any `server/*.test.ts`
 * containing a QUOTED door id as a test PINNING that door, and `unreadable` is
 * the casting studio's own interpreter-refusal door — so this suite silently
 * became its 23rd pin (22 → 23, read at the generated diff). A door pinned by a
 * merge-tool test that never drives it is an instrument arm quietly disabled:
 * delete the real pins and `unpinned-refusal` still would not fire. The
 * collector's shape-match class is the root cause and is filed separately;
 * this name is the part that belongs in this PR.
 */
export type PrMergeReceipt =
  | { kind: "merged" }
  | { kind: "merged-then-failed"; detail: string }
  | { kind: "not-merged"; detail: string }
  | { kind: "merge-state-unknown"; detail: string };

export function classifyPrMergeReceipt(input: {
  /** What `gh pr merge` threw, or `null` when it returned cleanly. */
  readonly mergeError: string | null;
  /** `state` read back from `gh pr view`, or `null` when THAT read failed. */
  readonly stateAfter: string | null;
}): PrMergeReceipt {
  if (input.stateAfter === null) {
    return {
      kind: "merge-state-unknown",
      detail: input.mergeError === null
        ? "gh pr merge returned, but the state could not be read back."
        : `gh pr merge failed AND the state could not be read back: ${input.mergeError}`,
    };
  }
  if (input.stateAfter === "MERGED") {
    return input.mergeError === null
      ? { kind: "merged" }
      : { kind: "merged-then-failed", detail: input.mergeError };
  }
  return {
    kind: "not-merged",
    detail: input.mergeError === null
      ? `gh reported no error but GitHub says state=${input.stateAfter}`
      : input.mergeError,
  };
}

/**
 * ⚠ **AND THE CLEANUP IS DONE WHERE IT IS LEGAL, WHICH MEANS NOT ASKING `gh`
 * TO TOUCH THE LOCAL CHECKOUT AT ALL (#568, recommendation 2).**
 *
 * This tool's own help has always said what it intends: *"also delete the
 * REMOTE branch on merge"*. `gh pr merge --delete-branch` does more than that —
 * it deletes the remote ref and then deletes the local branch, switching the
 * checkout to the default branch first. Neither half of that local work is
 * legal from a shift worktree, and neither is wanted: `shift-worktree remove`
 * deliberately KEEPS the local branch (its own comment says so), so a local
 * delete here would contradict the other half of the shift's tooling.
 *
 * Deleting the ref through the API does exactly the documented thing and
 * touches nothing local, so the failure above cannot occur at all. The receipt
 * classifier stays regardless — it guards the class, not this one call.
 *
 * ⚠ **A REF THAT IS ALREADY GONE IS A SUCCESS, NOT A FAILURE.** A repository
 * with *Automatically delete head branches* on removes it during the merge, and
 * a shift that ran `--delete-branch` on a second pass would then see a 422. The
 * post-condition this tool cares about is *the remote branch is not there*, and
 * both roads satisfy it. Failing on the second would turn a tidy repository
 * into an error message.
 *
 * ⚠ **AND A FAILED DELETE IS NEVER FATAL.** It happens strictly AFTER the
 * merge, so exiting non-zero on it would recreate #568's defect one call to the
 * right: a shift reading a failure over a pull request that is already in
 * `main`. It is reported and the run continues.
 */
export type RemoteBranchDeletion = "deleted" | "already-gone" | "failed";

export function classifyRemoteBranchDeletion(input: {
  readonly exitCode: number;
  /** Combined stdout+stderr from the `gh api` call. */
  readonly output: string;
}): RemoteBranchDeletion {
  if (input.exitCode === 0) return "deleted";
  /*
    ⚠ **ONLY THE UNAMBIGUOUS ANSWER COUNTS AS ALREADY-GONE, AND `404` IS NOT
    ONE** (PR #612 review, finding 3). GitHub answers an absent ref with 422
    "Reference does not exist" on the git-refs endpoint — that is the one shape
    that can only mean the branch is not there. It also answers **404 for a
    DELETE the token lacks push permission on**, which means the branch very
    much IS there, and the first shape of this function read that as tidied.

    The two errors are not symmetric. Reporting a surviving branch as deleted
    is a lie a shift acts on; reporting a deleted branch as needing a look
    costs one glance and is never fatal either way. So the ambiguous answers
    fall to `failed`, and the message below names both possibilities rather
    than asserting one.
  */
  return /reference does not exist/i.test(input.output) ? "already-gone" : "failed";
}
