import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CUSTOMER_SURFACE_DECLARATION_PATH,
  extractCustomerSurfaceExemptPattern,
  extractCustomerSurfacePattern,
} from "../scripts/lib/prMergeOrder.mts";

/**
 * TRIAGE CAN BE REACHED AGAIN, AND ITS CUSTOMER-SURFACE RULE IS DECLARED ONCE
 * (#1194, then #1328).
 *
 * # The two halves of the card, and both are about an absence
 *
 * **A PR born CONFLICTING loses its triage for good.** `review.yml` triggered on
 * `opened` and `ready_for_review` only, and neither can fire again on a PR that
 * is already open and already ready — while a CONFLICTING PR gets no
 * `pull_request` workflow run for any event (#566). Measured on PR #1191:
 * opened as a draft `23:34:51Z`, marked ready `23:35:10Z`, and **no `Fable
 * Review` run created for either**, read at the Actions API over the whole
 * repository for that window. `gate.yml` recovered on its own because it also
 * triggers on `synchronize`; triage could not.
 *
 * ⚠ **And the documented recovery road had already closed.** The standing orders
 * say *"the Fable review's manual road is `gh pr edit <n> --add-label
 * needs-fable` and it works ONCE"*. It fired nothing: `review.yml` READS the
 * label as a reason a review is owed, but `labeled` left the trigger list at
 * #1065 when the label became triage's OUTPUT rather than its input. Two
 * documents described a road that did not exist.
 *
 * **And one of triage's limbs had exactly one reader.** The money rule and the
 * reviewer-workflow rule are asked again by `pr-merge-in-order.mts`; the
 * third limb was not, so an ordinary diff that lost its triage was announced to
 * nobody and the merge tool printed `review=declined` — the same word it uses
 * for a diff that genuinely earned no look.
 *
 * ⚠ **THE LIMB WAS SIZE AND THE FOUNDER DROPPED IT — #1328, 2026-09-26
 * (terminal), verbatim: "drop it".** Asked *"why must ever PR have a review a
 * fable review on PR's seems like a waste of credits doesnt it?"*, told the rule
 * and the day's tally (22 seat PRs reviewed, 0 code defects found, 2 prose
 * claims corrected, 22 of 22 instruments red under the relay's hand), then *"i
 * think opus 5 is comfrotable on more than 250 lines of code dont you?"* — and
 * on the recommendation to remove the trigger outright rather than raise it, the
 * two words above. So there is no `REVIEW_SIZE_LINE` and no line count in this
 * repository's review rules, and the arms below hold that it stays gone.
 *
 * **What took its place is the one obligation none of the four mechanical checks
 * can discharge**: a diff touching a surface a CUSTOMER sees earns `needs-fable`
 * and the comment names the obligation as the relay's eye on the rendered
 * frames, both themes — working law 6, and law 9's *his eyes are king*. Its
 * declaration is `.github/customer-surfaces.sh`, read by triage and by the merge
 * tool, neither keeping a copy (`money-surfaces.sh`'s shape, #958).
 *
 * # WHY THESE ARMS ARE SOURCE READS
 *
 * A workflow's triggers cannot be driven from vitest: the only instrument that
 * could is GitHub creating a run, which is the thing that was missing. So the
 * arms read the workflow's own bytes — the same road
 * `moneySurfaceClassifier.test.ts` takes for the money declaration — and the
 * BEHAVIOUR half (the customer-surface reading) is driven directly in
 * `server/prMergeOrder.test.ts` against the real declaration.
 */

const repoRoot = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");
const reviewYml = read(".github/workflows/review.yml");
const gateYml = read(".github/workflows/gate.yml");
const mergeTool = read("scripts/pr-merge-in-order.mts");
const customerDeclaration = read(CUSTOMER_SURFACE_DECLARATION_PATH);

describe("the escalation label reaches triage again", () => {
  it("⚠ `labeled` is in the trigger list — the manual road the orders promise", () => {
    const on = /^on:\n([\s\S]*?)\n\n/m.exec(reviewYml);
    expect(on, "review.yml's `on:` block could not be found — this arm is measuring nothing").not.toBeNull();
    expect(on![1]).toMatch(/types:\s*\[[^\]]*\blabeled\b[^\]]*\]/);
    /* The two that were always there stay: a shift's own "this is finished". */
    expect(on![1]).toMatch(/\bopened\b/);
    expect(on![1]).toMatch(/\bready_for_review\b/);
  });

  it("⚠ NOT `synchronize` — that would undo the founder's once-per-PR ruling", () => {
    /* His ruling, 2026-08-26: reduce its frequency. `synchronize` re-runs triage
       on every push, which is the opposite, and the card names it as option A
       precisely because it is the tempting one. */
    const on = /^on:\n([\s\S]*?)\n\n/m.exec(reviewYml)![1]!;
    expect(on).not.toMatch(/\bsynchronize\b/);
  });

  it("⚠ a `labeled` run is triage ONLY for `needs-fable`", () => {
    /* The gate labels `founder-review` on money diffs and `review-skipped` on
       others, and both would otherwise buy a triage run to reach the same
       verdict. The guard is on the job, so the run is created and answers in
       seconds rather than doing the work. */
    expect(reviewYml).toMatch(/github\.event\.action != 'labeled'/);
    expect(reviewYml).toMatch(/github\.event\.label\.name == 'needs-fable'/);
    /* And the labels the gate applies are named here so this arm keeps meaning
       something if either is renamed — they must NOT be the guard's label. */
    expect(gateYml).toContain("--add-label founder-review");
    expect(reviewYml).not.toMatch(/github\.event\.label\.name == 'founder-review'/);
  });

  it("the draft suppression survives the new trigger", () => {
    /* A draft is the shift saying the diff is not finished. Labelling a draft
       must not start a review round. */
    expect(reviewYml).toMatch(/!github\.event\.pull_request\.draft/);
  });
});

describe("the customer-surface rule is declared once and read twice", () => {
  it("⚠ CONTROL — the declaration exists and both halves parse as real regexes", () => {
    const paths = extractCustomerSurfacePattern(customerDeclaration);
    const exempt = extractCustomerSurfaceExemptPattern(customerDeclaration);
    expect(paths).toContain("client/src/");
    expect(exempt).toContain("features/admin/");
    expect(() => new RegExp(paths)).not.toThrow();
    expect(() => new RegExp(exempt)).not.toThrow();
  });

  /**
   * ⚠ THE STAFF EXEMPTION, PINNED ON THE WORKFLOW'S SIDE TOO — his "keep it with
   * you".
   *
   * `prMergeOrder.test.ts` DRIVES the tool's reader against these bytes. Triage's
   * reader is a shell pipeline that vitest cannot execute, so what is held here is
   * the DECLARATION it sources: every alternative the widening added, by name. A
   * prefix quietly deleted would make triage and the tool agree with each other
   * and both disagree with his ruling, which no behaviour arm on one reader can
   * see.
   *
   * The shell itself is driven out of band, in a scratch git repository per case,
   * with the verdict read out of a real `$GITHUB_OUTPUT` — the tallies are on the
   * PR, because a driver that needs `sh`, `git init` and a bare remote is not a
   * unit test.
   */
  it("⚠ the declaration exempts the staff PAGES as well as the staff directories", () => {
    const exempt = extractCustomerSurfaceExemptPattern(customerDeclaration);
    for (const alternative of [
      "^client/src/features/admin/",
      "^client/src/features/moderator/",
      "^client/src/pages/Admin",
      "^client/src/pages/Moderator",
    ]) {
      expect(
        exempt,
        `the exemption dropped ${alternative} — his ruling was "keep it with you", staff diffs merge on the gate`,
      ).toContain(alternative);
    }
    /* ⚠ And the page halves are NAME prefixes, never the whole directory: an
       exemption of `^client/src/pages/` would exempt every customer page there
       is, which is the one silent failure this limb cannot afford. */
    expect(exempt, "the exemption swallowed the whole pages directory").not.toMatch(
      /\^client\/src\/pages\/(\||$)/,
    );
  });

  it("review.yml sources it and keeps no copy of either half", () => {
    expect(reviewYml, "review.yml must source the customer-surface declaration").toContain(
      ". ./.github/customer-surfaces.sh",
    );
    expect(reviewYml).toMatch(/grep -E "\$CUSTOMER_SURFACE_PATHS"/);
    expect(reviewYml).toMatch(/grep -vE "\$CUSTOMER_SURFACE_EXEMPT"/);
    /* The anti-mirror arm: a local assignment is the copy that drifted on the
       money rule (#958), and the declaration exists so it cannot happen here. */
    expect(
      reviewYml,
      "review.yml declares its own customer-surface rule — that is the copy #958 removed one rule over",
    ).not.toMatch(/\n\s*CUSTOMER_SURFACE_(PATHS|EXEMPT)='/);
    /* And no literal of either half is typed into the triage step, or the
       sourced value would be decoration. */
    const step = reviewYml.slice(reviewYml.indexOf("Decide whether this diff earns a review"));
    expect(step).not.toMatch(/\^client\/src\//);
    expect(step).not.toMatch(/features\/admin\//);
  });

  it("the merge tool asks the customer-surface question itself, and refuses a declaration it cannot read", () => {
    expect(mergeTool).toContain("touchesCustomerSurface(");
    expect(mergeTool).toContain("extractCustomerSurfacePattern(");
    expect(mergeTool).toContain("extractCustomerSurfaceExemptPattern(");
    /* It must fail rather than default — a missing declaration that read as
       "nothing earns a look" is the silence #1194 closed. */
    expect(mergeTool).toMatch(/CUSTOMER_SURFACE_DECLARATION_PATH\} is missing/);
    /* ⚠ AND IT KEEPS NO COPY EITHER. The card's own instruction: the pattern is
       declared once under `.github/` and extracted. A literal here would be the
       #958 drift with a different file name. */
    expect(
      mergeTool,
      "pr-merge-in-order.mts types a customer-surface pattern of its own instead of extracting it",
    ).not.toMatch(/client\/src\//);
    expect(mergeTool).not.toMatch(/features\/admin\//);
  });

  /**
   * ⚠ ALL FOUR SECOND READERS, HELD TOGETHER — AND THE MONEY ONE HAD NO ARM AT
   * ALL UNTIL THIS COMMIT.
   *
   * The arm above is the one #1194 wrote for the size reading, re-pointed at the
   * limb that replaced it. Sabotaging this PR found that its SIBLINGS were
   * unguarded: deleting `touchesMoney(files, moneyPattern) ||` from the merge
   * tool's `reviewOwed` left **196 of 196 green** — the money hold's own second
   * reader, the thing #987 and #958 exist to protect, removable in silence.
   *
   * **The class is the shape of the mistake, not the size rule**: an arm written
   * for ONE second reader, beside three of the same shape with none. Working law
   * 7 says fix the class, so all four are read out of the tool here — money paths,
   * money symbols, the reviewer workflow and the customer surface — and a fifth
   * arriving will sit beside them rather than needing its own suite.
   *
   * They are SOURCE reads, because what is being held is that the disjunction
   * asks the question at all. `prMergeOrder.test.ts` drives what each answer
   * MEANS; neither is the other's substitute.
   */
  it("⚠ the merge tool's reviewOwed asks all FOUR questions, not three", () => {
    const owed = mergeTool.slice(
      mergeTool.indexOf("const reviewOwed ="),
      mergeTool.indexOf("const verdictCount ="),
    );
    expect(owed, "the reviewOwed disjunction could not be located — this arm is measuring nothing")
      .toContain("reviewOwed");
    for (const reader of [
      "touchesMoney(",
      "moneySymbolHits(",
      "touchesReviewerRules(",
      "touchesCustomerSurface(",
    ]) {
      expect(
        owed,
        `pr-merge-in-order.mts stopped asking ${reader} — a label someone removed cannot un-owe that diff`,
      ).toContain(reader);
    }
    /* And the escalation label, which is the one limb with no pattern behind it. */
    expect(owed).toContain('"needs-fable"');
  });

  it("⚠ the triage step names the obligation as the EYE ON THE FRAMES, not as a review of the code", () => {
    /* His ruling's whole point: the limb that survives is the one CI cannot do.
       A comment that said only "a review is owed" would lose the reason. */
    expect(reviewYml).toMatch(/EYE ON THE RENDERED FRAMES, BOTH THEMES/);
    expect(reviewYml).toMatch(/working law 6/);
    /* And it says out loud that a path is a proxy (the card's own word). */
    expect(reviewYml).toMatch(/PROXY/);
  });
});

/**
 * ⚠ THE SIZE TRIGGER IS GONE AND MUST NOT COME BACK — #1328, his word "drop it".
 *
 * These are ABSENCE arms, which is the weakest shape a guard can take, so each
 * one names the exact token a re-introduction would have to type. The reason they
 * are worth having anyway: a size limb is the easy thing to re-add from memory,
 * it would be invisible in a green suite, and it would spend his credits on the
 * rule he removed.
 */
describe("the size trigger stays dropped", () => {
  it("nothing declares a size line, and no reader reaches for the retired file", () => {
    /* ⚠ The DECLARATION arm is anchored to the start of a line, not to the bare
       token: `customer-surfaces.sh`'s header quotes the retired names while
       telling the history of its own rename, and an arm that banned the word
       would have to be loosened or the history dropped. A declaration is an
       assignment at column zero — which is the only thing a shell would read. */
    for (const [name, text] of [
      ["review.yml", reviewYml],
      ["pr-merge-in-order.mts", mergeTool],
      [CUSTOMER_SURFACE_DECLARATION_PATH, customerDeclaration],
    ] as const) {
      expect(text, `${name} declares a size line again`).not.toMatch(/^\s*REVIEW_SIZE_LINE=/m);
      expect(text, `${name} declares the non-code exclusion again`).not.toMatch(/^\s*REVIEW_NON_CODE=/m);
    }
    /* The READERS may not reach for the retired file by any road — `. ./` in the
       workflow, a `join(…)` in the tool. The declaration file is excluded from
       this one arm and only this one, for the reason above. */
    expect(reviewYml, "review.yml sources the retired size declaration").not.toContain("review-size.sh");
    expect(mergeTool, "the merge tool opens the retired size declaration").not.toContain("review-size.sh");
    /* ⚠ The needle is the exact spelling both readers used before this change —
       `. ./.github/review-size.sh` in the workflow and
       `join(REPO_ROOT, ".github", "review-size.sh")` in the tool — so a
       re-introduction by copy-paste is caught. A re-introduction that renames
       the file is NOT, which the size-declaration arms above cover instead; the
       two together are the guard and neither is it alone. The sabotage record on
       this PR drives both directions. */
  });

  it("⚠ the triage step counts no lines at all", () => {
    const step = reviewYml.slice(reviewYml.indexOf("Decide whether this diff earns a review"));
    /* `--numstat` and the awk fold were the size reading's whole mechanism. */
    expect(step, "triage counts diff lines again").not.toMatch(/--numstat/);
    expect(step).not.toMatch(/awk '\{s\+=/);
    /* And no arithmetic comparison against a line, whichever number is chosen. */
    expect(step, "triage compares a line count against a threshold again").not.toMatch(
      /-lt \S*(LINE|LINES)|\[ "\$LINES"/,
    );
  });

  it("the merge tool keeps no size reader and no line counts", () => {
    expect(mergeTool).not.toContain("exceedsReviewSizeLine");
    expect(mergeTool).not.toContain("changedCodeLines");
    /* ⚠ The `additions`/`deletions` columns and the parse refusal that stood over
       them went WITH the reading, on purpose: a refusal guarding a reading nobody
       performs is a dead control with a live reputation (law 7's ruling sweep).
       This arm is what stops them drifting back in as unread columns. */
    expect(mergeTool).not.toMatch(/\.additions, \.deletions\] \| @json/);
    expect(mergeTool).not.toMatch(/isSafeInteger\(additions\)/);
  });
});

/**
 * ⚠ THE CONTROL'S OWN KILL SWITCH — #1627.
 *
 * Both readings of *"this diff changes the rules of the review itself"* were an
 * exact match on `.github/workflows/review.yml`, written when the rules lived
 * in one file. **#958 then carved `money-surfaces.sh` out of both workflows
 * precisely so neither could keep its own copy, and #1328 carved out
 * `customer-surfaces.sh` beside it — and each extraction moved the bytes
 * without moving the guard that watched them.** So a diff that narrowed, or
 * emptied, the file deciding what counts as a money diff was triaged as an
 * ordinary diff and merged on the gate alone.
 *
 * Simulated at the bytes before the repair with `CHANGED='.github/money-surfaces.sh'`:
 * the rules check was silent (exact match on one filename), `MONEY_PATHS` was
 * silent (it lists product surfaces, correctly), the symbol half was silent
 * (scoped `-- server shared`, deliberately), and `customer-surfaces` was silent
 * (`^client/src/`). **None of the four is an oversight in isolation**, which is
 * why nothing anywhere reddened.
 *
 * ⚠ **ZERO INSTANCES WAS LUCK, NOT DESIGN.** The file has only ever been
 * widened — #958 created it, #1359 added the priced modules, #1622 the refund
 * decider — and #1622's own PR is caught ONLY because its test file happens to
 * name `recordRefund`. The one PR in this repository's history that edits the
 * declaration for a money reason proves the gap rather than closing it.
 *
 * These are SOURCE reads for the reason this file's header gives: a workflow's
 * shell cannot be driven from vitest. What each answer MEANS is driven in
 * `server/prMergeOrder.test.ts`, against the real `review.yml`, including the
 * end-to-end arm that a `money-surfaces.sh`-only PR is HELD rather than merged.
 */
describe("the rules of the review are every file it sources, not one filename (#1627)", () => {
  const decideStep = reviewYml.slice(
    reviewYml.indexOf("Decide whether this diff earns a review"),
    reviewYml.indexOf("Say on the PR that a review is owed"),
  );

  /*
    ⚠ COMMENTS OFF BEFORE THE ABSENCE ARM READS — the negation-contains-the-token
    class, and it fired on the first run of this suite. The step's own comment
    QUOTES the one-filename check it replaced, because deleting the record of
    why a guard changed is how the next reader re-introduces it; an arm reading
    that sentence as code would force the choice between a true assertion and a
    kept history. Line comments only, matched at the start of a line, so a `#`
    inside a shell string is left alone.
  */
  const decideCode = decideStep.replace(/^[ \t]*#.*$/gm, "");

  it("the arm is measuring something — the decide step was located", () => {
    expect(decideStep.length, "review.yml's decide step could not be sliced").toBeGreaterThan(500);
    expect(decideCode, "the comment stripper emptied the step — every absence arm below would pass")
      .toContain("GITHUB_OUTPUT");
  });

  it("⚠ the stripper drops prose and keeps code — driven before it is trusted", () => {
    expect(decideCode).not.toContain("the rules of the review itself, and this");
    expect(decideCode).toContain("RULES_HIT");
  });

  it("⚠ triage no longer matches ONE filename for the rules reading", () => {
    /* The exact line that shipped the hole. An absence arm, so it is pinned to
       the bytes it is about rather than to a paraphrase. */
    expect(decideCode, "the one-filename rules check is back — a diff editing money-surfaces.sh would merge on the gate")
      .not.toContain("grep -qxF '.github/workflows/review.yml'");
  });

  it("⚠ it DERIVES the set from what the workflow sources, and refuses an empty one", () => {
    /* Derived, because a typed list beside the workflow is the second list
       working law 4 warns about — and `reviewRuleFiles` reads the same lines
       out of the same file, so the two readers cannot disagree. */
    expect(decideCode).toMatch(/sed -n .*\.github\//);
    expect(decideCode, "the derivation does not read this workflow's own sourcing").toContain(
      ".github/workflows/review.yml",
    );
    /* An empty derivation must refuse, not fall back to the one-filename answer
       — that fallback IS the hole, restored in silence. */
    expect(decideCode).toMatch(/REFUSING: review\.yml sources no declaration/);
    expect(decideCode).toMatch(/exit 1/);
  });

  it("⚠ both declarations are still SOURCED, which is what makes them rules", () => {
    /* If either stops being sourced it stops being derived as a rule — loudly
       here rather than silently on some future PR. */
    expect(reviewYml).toContain(". ./.github/money-surfaces.sh");
    expect(reviewYml).toContain(". ./.github/customer-surfaces.sh");
  });

  it("⚠ the rules reading still HOLDS the PR — it is not merely labelled", () => {
    /* `held=yes` is what turns triage's comment into "this PR is HELD until the
       verdict is posted". A rules change that only earned a label would merge
       on the gate under the standing orders. */
    const rulesBranch = decideCode.slice(
      decideCode.indexOf("RULES_HIT"),
      decideCode.indexOf(". ./.github/money-surfaces.sh"),
    );
    expect(rulesBranch, "the rules branch could not be sliced").toContain("review=yes");
    expect(rulesBranch).toContain("held=yes");
  });
});
