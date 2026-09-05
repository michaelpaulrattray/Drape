/**
 * THE ROUND CAP IS WIRED (#543 item 5, founder-ordered and urgent).
 *
 * The counting rule itself is already driven in `server/prMergeOrder.test.ts`,
 * beside the merge tool that reads the same fact. What this suite guards is the
 * thing that suite cannot see: **that the notice has a CALL SITE**.
 *
 * ⚠ THAT IS THE WHOLE POINT OF IT, AND IT IS INVARIANT 7. `decideRoundNotice`
 * and `FINAL_ROUND_MESSAGE` shipped with #543 item 3 as *declared* scaffolding
 * — written, tested, invoked by nothing — on the explicit promise that item 5
 * would wire them or delete them. A promise like that is exactly how a control
 * ends up on CLAUDE.md's "Currently not enforced" list: helper written, docs
 * written, todo ticked, call site never added. So the arms below read the real
 * `review.yml` and the real script and refuse if the chain breaks anywhere
 * along it.
 *
 * Every arm reads an artifact. Nothing here is a fixture of the workflow.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FINAL_ROUND_MESSAGE,
  ROUND_NOTICE_MARKER,
  alreadyNoticed,
  decideRoundNotice,
  roundNoticeBody,
} from "../scripts/lib/reviewRounds.mts";

const ROOT = join(__dirname, "..");
const REVIEW_YML = ".github/workflows/review.yml";
const NOTICE_SCRIPT = "scripts/review-round-notice.mts";

const reviewYml = readFileSync(join(ROOT, REVIEW_YML), "utf8");
const notice = readFileSync(join(ROOT, NOTICE_SCRIPT), "utf8");

describe("the cap has a call site (invariant 7)", () => {
  it("review.yml runs the notice script", () => {
    expect(reviewYml).toContain(`node ${NOTICE_SCRIPT}`);
  });

  it("it passes the pull request number, which is the only thing it needs", () => {
    expect(reviewYml).toMatch(/node scripts\/review-round-notice\.mts --pr "\$PR_NUMBER"/);
    expect(reviewYml).toMatch(/PR_NUMBER: \$\{\{ github\.event\.pull_request\.number \}\}/);
  });

  it("⚠ and it passes it through `env`, never interpolated into the run block", () => {
    // zizmor's template-injection audit reddened the gate on this step's first
    // push: a `${{ … }}` expansion inside `run:` is textual substitution into
    // the shell, and the rule holds whatever the field's type is. Preflight
    // cannot see this — the workflow linters are on its excused list — so the
    // arm lives here, where a local run reaches it.
    expect(reviewYml).not.toContain(
      "review-round-notice.mts --pr ${{ github.event.pull_request.number }}",
    );
  });

  it("the script actually calls the shared decision — not a copy of the rule", () => {
    // A second implementation of "is this the second verdict" would drift from
    // the merge tool's (working law 4), and both read the same PRs.
    expect(notice).toContain("decideRoundNotice");
    expect(notice).toContain('from "./lib/reviewRounds.mts"');
    // And it must not restate the message.
    expect(notice).not.toContain("second and final review round");
  });

  it("the message it would post is the shared constant", () => {
    const decided = decideRoundNotice(2);
    expect(decided.kind).toBe("final-round");
    expect(decided.kind === "final-round" && decided.message).toBe(FINAL_ROUND_MESSAGE);
  });
});

describe("the step cannot change what the `review` check means (#219)", () => {
  /** The step block, from its name to the start of the next step. */
  const stepBlock = (() => {
    const start = reviewYml.indexOf("      - name: Say when this is the second and final review round");
    expect(start, "the round-cap step is missing from review.yml").toBeGreaterThan(-1);
    const next = reviewYml.indexOf("\n      - ", start + 10);
    return reviewYml.slice(start, next === -1 ? reviewYml.length : next);
  })();

  it("it is continue-on-error, so a failed notice cannot redden the check", () => {
    expect(stepBlock).toContain("continue-on-error: true");
  });

  it("⚠ and so is the setup-node step BEFORE it — every step this feature added", () => {
    // Found by hand-reviewing this change, which is the review it can never
    // get from the reviewer (#165). Without it, a failed setup-node fails the
    // JOB, so `review` goes RED after a review that actually ran and produced
    // findings — which reads as "no verdict" (#219) and is the worst thing
    // this step could possibly cause.
    const nodeStep = (() => {
      const start = reviewYml.indexOf("      - uses: actions/setup-node@");
      expect(start, "the setup-node step is missing from review.yml").toBeGreaterThan(-1);
      const next = reviewYml.indexOf("\n      - ", start + 10);
      return reviewYml.slice(start, next === -1 ? reviewYml.length : next);
    })();
    expect(nodeStep).toContain("continue-on-error: true");
    expect(nodeStep).toContain("steps.fable.outcome == 'success'");
  });

  it("it runs only when the reviewer actually produced a verdict", () => {
    // The self-skip branch (#165) and any outage are outcomes other than
    // success, and neither of those is a round.
    expect(stepBlock).toContain("steps.fable.outcome == 'success'");
  });

  it("the script's last statement is a ZERO exit, on every path", () => {
    // The script guards require the last statement to end the process; this
    // adds the value: it must be 0. A bookkeeping step that could exit non-zero
    // would give the `review` check a third meaning.
    expect(notice.trimEnd().endsWith("process.exit(0);")).toBe(true);
    // No other exit code appears anywhere in it.
    expect(notice).not.toMatch(/process\.exit\((?!0\))/);
  });
});

describe("the step needs no dependency install", () => {
  it("it runs under bare node, not npx", () => {
    // Node 24 strips types natively and the shared reader imports nothing
    // outside the standard library, so the review job needs no install.
    expect(reviewYml).toContain(`node ${NOTICE_SCRIPT}`);
    expect(reviewYml).not.toContain(`npx tsx ${NOTICE_SCRIPT}`);
  });

  it("and review.yml sets up a node that can strip types", () => {
    expect(reviewYml).toMatch(/actions\/setup-node@[0-9a-f]{40}/);
    expect(reviewYml).toMatch(/node-version:\s*2[4-9]/);
  });

  it("the notice script and its lib import nothing outside node's standard library", () => {
    // If either grew a package import, the bare-node step would fail at the
    // first line with no install in the job — and this arm is cheaper than
    // discovering it on the run that was supposed to say something useful.
    const lib = readFileSync(join(ROOT, "scripts/lib/reviewRounds.mts"), "utf8");
    for (const [name, source] of [
      [NOTICE_SCRIPT, notice],
      ["scripts/lib/reviewRounds.mts", lib],
    ] as const) {
      const specifiers = [...source.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((m) => m[1]!);
      for (const specifier of specifiers) {
        expect(
          specifier.startsWith("node:") || specifier.startsWith("./") || specifier.startsWith("../"),
          `${name} imports ${specifier}, which the review job has no install for`,
        ).toBe(true);
      }
    }
  });
});

describe("the notice is posted once, ever", () => {
  // ⚠ THESE ARMS DRIVE THE DECISION, THEY DO NOT LOOK FOR THE MARKER STRING.
  // The first shape of this suite did the second, and a sabotage that deleted
  // the whole idempotence check from the script reddened NOTHING — a broken
  // guard keeps its constant. The decision moved into the shared lib for
  // exactly this reason.
  const posted = roundNoticeBody({
    kind: "final-round",
    verdictsSoFar: 2,
    message: FINAL_ROUND_MESSAGE,
  });

  it("recognises its own comment", () => {
    expect(alreadyNoticed([posted])).toBe(true);
  });

  it("finds it among other comments, in any position", () => {
    expect(alreadyNoticed(["a review", posted, "a reply"])).toBe(true);
    expect(alreadyNoticed([posted, "later"])).toBe(true);
  });

  it("is false on a PR that has never had one", () => {
    expect(alreadyNoticed([])).toBe(false);
    expect(alreadyNoticed(["a Gatekeeper review", "**Round 2.** something else"])).toBe(false);
  });

  it("the marker is HIDDEN — the founder and the reviewer never see it", () => {
    expect(ROUND_NOTICE_MARKER.startsWith("<!--")).toBe(true);
    expect(ROUND_NOTICE_MARKER.endsWith("-->")).toBe(true);
  });

  it("the body it writes carries the marker it searches for — one constant, not two", () => {
    expect(posted).toContain(ROUND_NOTICE_MARKER);
    expect(posted).toContain(FINAL_ROUND_MESSAGE);
    expect(posted).toContain("**Round 2.**");
  });

  it("the script calls the shared idempotence check rather than its own", () => {
    expect(notice).toContain("alreadyNoticed(");
    expect(notice).toContain("roundNoticeBody(");
    // And holds no second copy of the marker.
    expect(notice).not.toContain("<!-- review-round-cap -->");
  });
});
