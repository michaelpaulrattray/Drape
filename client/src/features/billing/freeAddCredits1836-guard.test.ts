/**
 * A FREE ACCOUNT IS NEVER OFFERED CREDITS IT CANNOT BUY — #1836.
 *
 * # His word, 2026-10-03 (terminal), verbatim and entire
 *
 * > *"you shouldnt be able to use add credits if your on the free plan at all ,
 * > not sure why i could click the button it should be greyed out or only
 * > display plans when i click it im in a free account"*
 *
 * # What he pressed, read at the code rather than guessed
 *
 * **There is exactly one control in the product labelled `Add credits`** —
 * §6f's row at the foot of `ChangePlanModal`, *"Just need more credits / Buy a
 * one-off pack instead — your plan stays exactly as it is."* (The two in
 * `features/admin/` are staff tools and are not a customer's road.) A free
 * account pressing it opened `PlanStepUpPane`, headed **"Add more credits"**,
 * with a plan to buy and a button reading **`Add credits · $27.00`**.
 *
 * So three words lied in a row, and the card's own sentence is what to do about
 * it: *"the honest fix is in the button's word and its destination, not in the
 * pane."* The pane is right about WHAT it sells. It was wrong about what it is
 * called.
 *
 * # Why §6f is HIDDEN rather than relabelled
 *
 * Its own two sentences are statements about a subscriber. *"Buy a one-off pack
 * instead"* — instead of what? The ladder is on the same screen, and for a free
 * account it is the only road there is. *"your plan stays exactly as it is"* —
 * there is no plan to keep. On a free account the row is not a wrong
 * destination; it is two false sentences and a button that cannot do what it
 * says. Nothing is lost by its absence: the plans it would send them to are
 * already above it.
 *
 * # ⚠ THE CLASS, NOT THE INSTANCE — and why one rename reached every mount
 *
 * Every entrance to credits goes through ONE door, `AddCreditsModal`: the
 * header chip (`AppChrome`), the canvas profile popover (`BoardHeader`), the
 * studio balance (`StudioSlimHeader`, `CastingTakeover`), the low-balance toast
 * and §6f itself. So renaming the free pane fixes a free account's reading by
 * every road at once, which is the arm `the one door` below holds.
 *
 * ⚠ **AND THE REMAINDER IS DECLARED RATHER THAN LEFT QUIET** (the fidelity
 * law: a lesser path is permitted only when named). Four entrance WORDS still
 * say *top up* to a free account BEFORE the door opens. They are pinned in
 * {@link TOP_UP_WORDS_BEFORE_THE_DOOR} with the reason, in the repository's own
 * only-shrinks idiom, so the next shift finds them from the tree rather than
 * from a pull request nobody re-reads.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { topupEligibility } from "@shared/creditTopups";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "../../../../server/testing/childProcessTimeout";
import { readListedSource } from "../../../../server/testing/listedSource";
import { sourceBand, sourceTail } from "../../../../server/testing/sourceBand";

/* This suite runs `git ls-files` and reads the client tree, so it is in both
   #548's and #741's populations and declares the class's floor. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const REPO = join(__dirname, "..", "..", "..", "..");
const read = (relative: string) => readFileSync(join(REPO, relative), "utf8");

const DOOR = "client/src/features/billing/AddCreditsModal.tsx";
const PLAN = "client/src/features/billing/ChangePlanModal.tsx";

/**
 * The slice between two markers, so an arm cannot be satisfied by a sibling.
 *
 * ⚠ **IT IS THE SHARED READER SINCE #1845** — `server/testing/sourceBand.ts`,
 * which `card390-guard.test.ts` resolves to as well. This file's own copy was
 * the fifth under `client/src/features/billing/`, and the sixth was about to be
 * written for the pane read that card needs; the shared one REFUSES a missing
 * anchor rather than answering an empty string, which is the property every
 * negative arm below rests on. The three remaining private copies
 * (`burnCycle1739`, `creditPacks1606` and `workDivisor1758`) were a declared
 * remainder with a card of their own — **#1848, closed 2026-10-03** — because
 * a promotion across five guards is its own pass; all three call the shared
 * reader directly now and no `function band(` survives under `client/src`.
 * `monthlyDelta1761` resolves here too, from #1845's own commit.
 *
 * ⚠ This alias is the one thing #1848 did NOT change, and it is a call-site
 * forwarder rather than a second implementation: what it costs is the reader's
 * `label`, which defaults to `band` through it.
 */
const band = (source: string, from: string, to: string) => sourceBand(source, from, to);

/**
 * ⚠ **COMMENTS OUT BEFORE ANY NEGATIVE ARM, AND THIS IS NOT TIDINESS.**
 *
 * Every repair here is a COPY change, so the paragraph explaining it quotes the
 * copy it replaced. A `not.toContain("Add more credits")` over the whole band
 * therefore fails on the very docblock that records the fix — measured on this
 * card's sibling an hour earlier, where an arm asserting a file holds no
 * `execFileSync` went red on the sentence saying it holds none.
 *
 * **An arm a SENTENCE can break is measuring prose.**
 *
 * ⚠ **AND THE FIRST DRAFT OF THIS STRIPPER FAILED IN THE OTHER DIRECTION,
 * WHICH IS THE DANGEROUS ONE — the positive control below is the only reason it
 * was seen.** It opened with a JSX-comment pass — brace, whitespace, open
 * comment, anything, close comment, brace — and `PlanStepUpPane`'s own opening
 * brace is followed by whitespace and then the function's first block comment,
 * so ONE match ran from that brace to the first comment-close-then-brace in the
 * body and deleted **29,317 characters**: the whole render, `ModalScrim` and
 * all. Every negative arm then passed **by having no subject left**, which is a
 * green suite measuring nothing (working law 2).
 *
 * Stripping block comments alone is enough, because doing so empties a JSX
 * comment too and leaves a bare brace pair that no substring check here cares
 * about. **The narrower stripper is the safe one** — over-stripping fakes a
 * pass, while under-stripping only ever shows up as a red somebody has to read.
 *
 * (The expressions themselves are deliberately described rather than quoted:
 * this file's own first draft would not PARSE, because a comment-close written
 * inside a docblock ends the docblock.)
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

/** From a marker to the end of the file — for the last block in a module. */
const tail = (source: string, from: string) => sourceTail(source, from);

/**
 * THE DECLARED REMAINDER — entrance words that still say *top up* to a free
 * account before the door opens. **It only shrinks.**
 *
 * None of them is a surface *called* Add credits, which is what his sentence is
 * about; each is a label or a tooltip one layer out. Fixing them is not a copy
 * edit: every one sits on a page that does not read `billing.getStatus` today,
 * so each needs the rung fetched where it is not fetched — three new queries
 * across three pages, on the surface P2-1 (#1832) is rebuilding. That is its
 * own card, and this list is how it stays findable.
 */
const TOP_UP_WORDS_BEFORE_THE_DOOR: ReadonlyArray<{ file: string; text: string; why: string }> = [
  {
    file: "client/src/features/boards/BoardHeader.tsx",
    text: "Top up",
    why: "the canvas profile popover's action beside the balance line (D-45(2))",
  },
  {
    file: "client/src/features/studio/components/StudioSlimHeader.tsx",
    text: 'title="Credit balance — top up"',
    why: "the studio header balance button's tooltip",
  },
  {
    file: "client/src/features/studio/takeover/CastingTakeover.tsx",
    text: 'title="Credit balance — top up"',
    why: "the takeover header balance button's tooltip (D-45(1))",
  },
  {
    file: "client/src/features/billing/LowBalanceWarning.tsx",
    text: 'label: "Top Up"',
    why: "the low-balance toast's action, reached from three generation roads",
  },
];

/**
 * EVERY CLIENT SURFACE THAT DRAWS THE CREDITS PANE'S TITLE, READ OFF THE TREE
 * (#1845 — the hand list this replaces named the two that existed that hour).
 *
 * `sellers` is the subset that also reads the rung, which is the only thing
 * that can decide whether to offer a purchase. The population is TRACKED files
 * under `client/src`, so an untracked scratch component cannot redden it, and
 * each read goes through `readListedSource` because a file a listing named can
 * be gone by the time it is read (#223).
 *
 * Measured the day this landed: 2 drawers, 1 seller — `AddCreditsModal.tsx`
 * and `settings/sections/SecuritySection.tsx`, the second borrowing the scrim's
 * classes for its own dialog.
 */
function topupTitleDrawers(): { drawers: string[]; sellers: string[] } {
  const tracked = execFileSync("git", ["ls-files", "client/src"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll("\\", "/"))
    .filter((line) => line.endsWith(".ts") || line.endsWith(".tsx"))
    /* A guard that asserts the rule is not a surface that breaks it. */
    .filter((line) => !/\.test\.tsx?$/.test(line));

  if (tracked.length === 0) {
    throw new Error(
      "topupTitleDrawers: git ls-files returned no client source. "
      + "A population of zero is a broken reading, not a clean tree.",
    );
  }

  const drawers: string[] = [];
  const sellers: string[] = [];
  for (const file of tracked) {
    const source = readListedSource(join(REPO, file));
    if (source === null) continue;
    if (!source.includes("dp-topup__title")) continue;
    drawers.push(file);
    if (source.includes("topupEligibility")) sellers.push(file);
  }
  return { drawers, sellers };
}

describe("#1836 · the rule, and it is the one the door already reads", () => {
  it("free cannot buy a pack, a plan holder can, and an unread rung answers neither", () => {
    /* Asserted at the helper rather than at a copy of its answer, because this
       is the rule BOTH surfaces now key on and a second spelling would drift. */
    expect(topupEligibility("free")).toBe("needs-a-plan");
    expect(topupEligibility("pro")).toBe("may-buy");
    expect(topupEligibility(undefined)).toBe("unread");
    expect(topupEligibility("")).toBe("unread");
  });
});

describe("#1836 · the surface a free account opens says plan, not credits", () => {
  const pane = () => band(read(DOOR), "function PlanStepUpPane", "function CreditPacksPane");

  it("it is headed, labelled and eyebrowed as a plan", () => {
    const code = withoutComments(pane());
    expect(code).toContain('label="Choose a plan"');
    expect(code).toContain(">PLANS<");
    expect(code).toContain(">Choose a plan<");
  });

  it("nothing a free account READS on it promises credits any more", () => {
    const code = withoutComments(pane());
    for (const promise of ["Add more credits", "Add credits"]) {
      expect(code, `the free pane still promises "${promise}"`).not.toContain(promise);
    }
  });

  it("the button names the plan and the charge, in his own §6e shape", () => {
    /* `Upgrade to Agency · $122.58` is his example on `ChangePlanModal`; this is
       the same shape without `/ mo`, because `dueToday` is charged today. */
    const code = withoutComments(pane());
    expect(code).toContain("`Upgrade to ${selected.name} · ${formatDollars(dueToday)}`");
    expect(code, "the money must survive a null plan — that is the part to trust")
      .toContain("`Upgrade · ${formatDollars(dueToday)}`");
  });

  it("POSITIVE CONTROL — the stripper hides prose, keeps code, and does not eat the subject", () => {
    /* The arm that makes the three above instruments, in all three directions.
       Without (a) a relabel undone in CODE would pass because the prose was
       stripped; without (b) the paragraph recording the fix would redden it;
       without (c) an over-wide stripper passes every negative arm by deleting
       the render — which is exactly what the first draft of this file did. */
    /* (a) code survives */
    expect(withoutComments('<h2 className="dp-topup__title">Add more credits</h2>'))
      .toContain("Add more credits");
    /* (b) prose does not, in all three comment shapes */
    expect(withoutComments("/* it used to read Add more credits */")).not.toContain("Add more credits");
    expect(withoutComments("{/* it used to read Add more credits */}")).not.toContain("Add more credits");
    expect(withoutComments("  // it used to read Add more credits")).not.toContain("Add more credits");
    /* (c) and it cannot run away with the file. `PlanStepUpPane` opens with a
       brace, a newline and a block comment — the shape that cost 29,317
       characters — so the stripped pane must still hold every landmark only its
       render can provide. Asserted directly rather than as a surviving-bytes
       ratio: this repository's docblocks are most of its source (the pane is
       77% comment), so a ratio bound would be a proxy calibrated on prose. */
    const stripped = withoutComments(pane());
    for (const landmark of ["</ModalScrim>", "dp-topup__pane", "<Button", "label="]) {
      expect(stripped, `the stripper ate ${landmark} — every negative arm above is now vacuous`)
        .toContain(landmark);
    }
    /* And the defect itself, driven: the first draft's JSX pass loses the render
       on this very file. A control that cannot reproduce the bug is a claim. */
    const theFirstDraft = (source: string) => source
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
      .replace(/\/\*[\s\S]*?\*\//g, " ");
    /* ⚠ It is the OPENING tag that is lost, not the closing one: the swallowed
       match runs from the function's brace to the first comment-close-then-brace
       in the body, which lands before `</ModalScrim>`. Reading the closing tag
       is how the first draft of THIS control passed while the bug was live. */
    expect(
      theFirstDraft(pane()),
      "the over-wide stripper no longer swallows the render, so this control proves nothing",
    ).not.toContain('label="Choose a plan"');
    expect(stripped, "the honest stripper must keep what the over-wide one lost")
      .toContain('label="Choose a plan"');
    /* And the real pane must actually carry a paragraph quoting the old copy, or
       the stripper is being credited for work there was none of. */
    expect(pane()).toContain("*Add more credits*");
  });
});

describe("#1836 · a plan holder's Add credits is untouched", () => {
  it("the packs pane keeps its name and its button", () => {
    const packs = withoutComments(band(read(DOOR), "function CreditPacksPane", "export function AddCreditsModal"));
    expect(packs).toContain('label="Add credits"');
    expect(packs).toContain(">Add credits<");
    expect(packs).toContain("`Add credits · ${formatDollars(cents)}`");
  });
});

describe("#1836 · the unread beat claims nothing either", () => {
  it("the shell is headed with the noun both panes share, not with the offer", () => {
    const shell = withoutComments(tail(read(DOOR), "export function AddCreditsModal"));
    expect(shell).toContain('label="Credits"');
    expect(shell).toContain(">Credits<");
    expect(shell, "the unread shell promises a purchase to an account that may not make one")
      .not.toContain(">Add credits<");
  });

  it("the three answers are still three, and neither pane is drawn until the rung is known", () => {
    const shell = read(DOOR);
    expect(shell).toContain("topupEligibility(status?.planTier)");
    expect(shell).toContain('eligibility === "may-buy"');
    expect(shell).toContain('eligibility === "needs-a-plan"');
  });
});

describe("#1836 · §6f is not drawn to a free account", () => {
  const row = () => band(read(PLAN), 'className="dp-plan__cross"', "</div>");

  it("the row is behind the shared rule, and the row itself is unchanged for a subscriber", () => {
    const plan = read(PLAN);
    expect(plan, "the row draws unconditionally again").toContain(
      'topupEligibility(status?.planTier) === "may-buy" ? (',
    );
    /* Unchanged for the customer who may buy — this card narrows who sees it,
       never what it says. */
    expect(row()).toContain("Just need more credits");
    expect(row()).toContain("your plan stays exactly as it is");
    expect(row()).toContain("onClick={onAddCredits}");
  });

  it("the condition is the SHARED helper, never a local `free` test", () => {
    /*
      A local `planTier !== "free"` would answer the same question in a second
      spelling one file from the first (working law 4), and it would get the
      unread beat wrong in the direction that costs a subscriber their row.
    */
    const plan = read(PLAN);
    expect(plan).toContain('import { topupEligibility } from "@shared/creditTopups";');
    expect(withoutComments(plan), "a second spelling of the rule is back")
      .not.toContain('planTier !== "free"');
  });

  it("POSITIVE CONTROL — the reading goes red on a copy drawing the row unconditionally", () => {
    const real = read(PLAN);
    const unconditional = real.replace('topupEligibility(status?.planTier) === "may-buy" ? (', "true ? (");
    expect(unconditional).not.toContain('topupEligibility(status?.planTier) === "may-buy" ? (');
    expect(unconditional, "the doctored copy must still carry the row").toContain("Just need more credits");
  });
});

describe("#1836 · Settings → Billing offers a free account no credits either", () => {
  const SETTINGS = "client/src/features/settings/sections/BillingSection.tsx";

  /*
    ⚠ **THESE TWO WERE MISSED BY THE GREP AND FOUND BY THE RENDER (working law
    6).** A repository-wide search for `Add credits` was run on this card before
    a line was written, and it returned §6f and the modal's own titles — because
    it was reading for a SURFACE, and these are CONTROLS. They appeared the
    instant a free fixture opened Settings → Billing: a PRIMARY-weighted
    `Add credits` on the plan card beside `Change plan`, and `Add more credits`
    under the balance. The first is the loudest control on the page, which makes
    it the likeliest button his word is actually about.
  */
  it("the plan card's primary credits button is behind the shared rule", () => {
    /* ⚠ **THE OPENING ANCHOR WAS `"Change plan\n          </Button>"` AND
       #1936 BROKE IT ON INDENTATION ALONE** — that card put the pending-change
       undo in place of `Change plan` behind a ternary, which moved the closing
       tag two spaces and nothing else. The band REFUSED rather than reading
       empty and passing, which is `sourceBand`'s whole safety property doing
       its job; the repair is an anchor that is about the CONTROL rather than
       about its whitespace. */
    const card = band(read(SETTINGS), "onClick={onChangePlan}", "</SettingsCard>");
    expect(withoutComments(card), "a free account is offered credits on the plan card again")
      .toContain('topupEligibility(status?.planTier) === "may-buy" ? (');
    /* And `Change plan` is NOT behind it — the road must survive, or the fix
       leaves a free account on a card with no action at all. */
    const whole = withoutComments(read(SETTINGS));
    const changePlan = whole.indexOf("Change plan");
    const gate = whole.indexOf('topupEligibility(status?.planTier) === "may-buy"');
    expect(changePlan, "Change plan has moved behind the credits rule").toBeLessThan(gate);
  });

  it("the link under the balance takes the same rule, and the figure does not", () => {
    const mini = band(read(SETTINGS), "CREDITS REMAINING", "PAYMENT METHOD");
    const code = withoutComments(mini);
    expect(code).toContain('topupEligibility(status?.planTier) === "may-buy" ? (');
    /* The balance and its bar are TRUE for a free account and stay. */
    expect(code).toContain("formatCredits(displayBalance(balance))");
  });

  it("both read the rung from one query, and that query costs no request", () => {
    const source = read(SETTINGS);
    expect(source).toContain("const { data: status } = trpc.billing.getStatus.useQuery();");
    expect((source.match(/trpc\.billing\.getStatus\.useQuery\(\)/g) ?? []).length).toBe(1);
    expect((withoutComments(source).match(/topupEligibility\(status\?\.planTier\) === "may-buy"/g) ?? []).length)
      .toBe(2);
  });

  it("POSITIVE CONTROL — each reading goes red on a copy offering credits unconditionally", () => {
    const real = read(SETTINGS);
    const open = real.replace(/topupEligibility\(status\?\.planTier\) === "may-buy" \? \(/g, "true ? (");
    expect(withoutComments(open)).not.toContain('topupEligibility(status?.planTier) === "may-buy" ? (');
    expect(open, "the doctored copy must still carry both controls").toContain("Add more credits");
    const noQuery = real.replace("const { data: status } = trpc.billing.getStatus.useQuery();", "");
    expect(noQuery).not.toContain("const { data: status } = trpc.billing.getStatus.useQuery();");
  });
});

describe("#1836 · the one door, which is why one rename reached every mount", () => {
  it("no surface outside the door draws a credits-purchase pane", () => {
    /*
      ⚠ **THIS ARM SAID "DERIVED RATHER THAN LISTED" AND THEN LISTED TWO FILES
      BY HAND — corrected at #1845, which is the card that read it.** The two it
      named were the two that drew the class the hour it was written, so a THIRD
      file acquiring `dp-topup__title` — a credits pane this card never renamed,
      reachable by a free account — would have left it green. A hand list is a
      census with a timestamp; this reads the tree.

      The rule it holds is unchanged and is the one that matters: a surface may
      borrow the pane's title class, but only the DOOR may read the rung, so
      only the door can decide what to sell. `SecuritySection` is the standing
      example — it borrows the scrim's classes for its own dialog and cannot
      sell anything.
     */
    const { drawers, sellers } = topupTitleDrawers();

    /* THE FLOOR FIRST — a reader that found nothing answers every question
       below with "clean", which is working law 2's own failure. */
    expect(
      drawers.length,
      "the walk over client/src found no file drawing `dp-topup__title`, so the arms below prove nothing",
    ).toBeGreaterThan(0);
    expect(drawers, "the door itself left the derived population").toContain(DOOR);

    /* THE RULE — exactly one of them reads the rung, and it is the door. */
    expect(
      sellers,
      "a surface outside the door reads the credit rung and draws the credits pane, "
      + "so a free account can reach a credits surface #1836 never renamed",
    ).toEqual([DOOR]);
  });

  it("every mount of the door is handed a road to the plans", () => {
    /* A required prop is what makes this true by construction; the arm holds
       the declaration, as #1606's own guard does. */
    const shell = band(read(DOOR), "export function AddCreditsModal", "const { data: status }");
    expect(shell).toContain("onChangePlan: () => void;");
    expect(shell).not.toContain("onChangePlan?:");
  });
});

describe("#1836 · the declared remainder, and it only shrinks", () => {
  it("each entrance word is still where this card says it is", () => {
    /*
      ⚠ THIS ARM REDDENS WHEN ONE IS FIXED, AND THAT IS ITS JOB — the same
      only-shrinks idiom `KNOWN_DEBTS` runs on. A word repaired is a line
      deleted from the list above, which is one edit and a visible decision;
      silence would let the remainder be forgotten the way four mailbox
      mentions of a red were.
    */
    for (const entry of TOP_UP_WORDS_BEFORE_THE_DOOR) {
      expect(
        read(entry.file),
        `${entry.file} no longer carries ${JSON.stringify(entry.text)} (${entry.why}) — `
        + "if it was repaired, delete its line from TOP_UP_WORDS_BEFORE_THE_DOOR",
      ).toContain(entry.text);
    }
  });

  it("the remainder is NAMED with a reason, never a bare count", () => {
    /* A floor with no reasons is a number nobody can act on (the orders: a
       sweep's remainder is named with the reader that produced it, or it is
       called a floor). */
    expect(TOP_UP_WORDS_BEFORE_THE_DOOR).toHaveLength(4);
    for (const entry of TOP_UP_WORDS_BEFORE_THE_DOOR) {
      expect(entry.why.length, `${entry.file} has no stated reason`).toBeGreaterThan(20);
    }
  });
});
