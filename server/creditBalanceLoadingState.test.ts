import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import { withoutComments } from "./testing/withoutComments";

/* It walks the whole client tree in process, and under the parallel run that
   cost multiplies against vitest's 5,000 ms default. File level, never per arm:
   a number typed onto one `it(…)` is not inherited by its neighbour (#741). */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/**
 * ⚠ **A CREDIT BALANCE NOBODY HAS READ YET IS NOT A BALANCE OF ZERO — #1703,
 * 2026-10-01.**
 *
 * # What a customer was told
 *
 * Open **Add credits** and for about a second the pane said **"0 credits on the
 * balance today."** to an account holding **3,688** — while the header chip
 * directly above it read 3,688. `status?.balance ?? 0`: the query was in flight,
 * `status` was `undefined`, and the `?? 0` printed a confident zero on the one
 * screen whose entire job is to talk about a customer's balance.
 *
 * # Why this is a guard and not a one-line patch
 *
 * **The grep found four sites, and the card that filed it found one.** Its own
 * body says so plainly — *"a sweep for siblings is part of the fix, and I have
 * not done it … I name it rather than claim it"* — and the sweep is the whole
 * value here, because the same idiom was printing the same zero in the account
 * menu, the billing pane and the studio chrome.
 *
 * **And the repository had already answered this question correctly three
 * times**, which is what makes a hand-kept fix untrustworthy:
 *
 *  - `BoardHeader.tsx` takes `number | null` and draws an em dash — it has been
 *    right all along, while `StudioSlimHeader`, its own sibling chrome, took
 *    `|| 0` and printed the zero.
 *  - `UsageSection` carries the rule in capitals — *"NOT KNOWN YET IS NOT ZERO,
 *    AND THIS PANE USED TO PRINT THE ZERO"* — and fixed its own two figures.
 *  - `useCycleSpend`'s docblock states it as law — *"`null` MEANS 'NOT KNOWN
 *    YET', NEVER 'SPENT NOTHING'. They are opposite facts on this surface"* —
 *    in the very hook the broken modal calls.
 *
 * So the rule was written down, in the same feature, by three different hands,
 * and the idiom kept coming back anyway. That is the definition of something a
 * guard should hold rather than a comment.
 *
 * ⚠ **`spendWindowCopy` is the sharpest instance and the reason the ban is on
 * the IDIOM rather than on a list of files.** It guards the window's provenance
 * explicitly — a `null` basis gets no window words, with a docblock about
 * exactly this class — and then quoted a `balance` it had not checked, because
 * the basis and the balance come from two different queries. **Guarding the
 * words and not the number they quote is half a guard**, and no file-by-file
 * review was ever going to notice that the guarded thing and the unguarded
 * thing sat on the same line.
 *
 * # What it bans, and the honest floor
 *
 * One idiom, under `client/src` only: a **balance** defaulted to **0** by `??`
 * or `||`. In the render layer that is always the defect — a zero balance is a
 * real and different fact from a balance not yet read, and the only way to say
 * the second is to keep it `null` and let the surface decline to claim anything.
 *
 * ⚠ **The floor, stated rather than implied: this is the measured IDIOM, not a
 * proof of the property.** A surface could still reach a rendered zero another
 * way — a non-null assertion, a `Math.max(0, …)`, a prop typed `number` fed by
 * something that is 0 before it is known. What the arm guarantees is that the
 * four instances measured on 2026-10-01 cannot come back in the shape they came
 * in, which is the shape that survived three written warnings. Comments are
 * stripped before the test, deliberately: the paragraphs explaining this defect
 * quote the broken line, and a guard that cannot be written about is a guard
 * people stop writing about.
 */

const CLIENT_SRC = path.resolve(__dirname, "..", "client", "src");

/**
 * A balance defaulted to zero. `\bbalance\b` catches `status?.balance ?? 0`,
 * `creditsBalance || 0` and a bare `balance ?? 0` alike; the case fold catches
 * `creditsBalance`. `?? null` — the repair — is not matched, and neither is a
 * `0` that is a real literal somewhere else on the line.
 */
const BALANCE_DEFAULTED_TO_ZERO = /\w*balance\w*\s*(?:\?\?|\|\|)\s*0\b/i;

/**
 * ⚠ **THE FOUR LINES THIS GUARD WAS WRITTEN ABOUT, VERBATIM — card 1733.**
 *
 * They are the `-` side of #1703's own diff, not a paraphrase: the arm below
 * holds the reader to still matching each of them, and to NOT matching the `+`
 * side beside it. Without that, the pattern and the defect it was written for
 * are only connected by a sentence, and **a reader that has stopped reading is
 * indistinguishable from a clean tree** — this suite's whole verdict is *no
 * client surface does this*, so matching nothing IS passing.
 *
 * Driven on main before this arm existed: blind `BALANCE_DEFAULTED_TO_ZERO`
 * — replace it with a pattern that matches nothing anywhere — and the suite
 * returned **3 passed (3)**, green, unchanged. Its three arms were a floor on
 * the WALK, the exemption's precondition, and the offence list; none of them
 * held the PATTERN.
 */
const MEASURED_SPECIMENS: ReadonlyArray<{ readonly before: string; readonly after: string }> = [
  {
    /* `UserCard`, through `AppChrome` — the account menu's own figure. */
    before: "                  creditsBalance={creditsData?.balance ?? 0}",
    after: "                  creditsBalance={creditsData?.balance ?? null}",
  },
  {
    /* The Add credits sentence this card was filed about. */
    before: "            {formatCredits(displayBalance(status?.balance ?? 0))} credits on the balance today.",
    after: "            {formatCredits(displayBalance(status.balance))} credits on the balance today.",
  },
  {
    /* `AccountSurfaces` → `SettingsModal`, the billing pane's prop. */
    before: "          balance={status?.balance ?? 0}",
    after: "          balance={status?.balance ?? null}",
  },
  {
    /* `StudioSlimHeader` — the `||` spelling, which is why the ban is on both. */
    before: "                  creditsBalance={creditsData?.balance || 0}",
    after: "                  creditsBalance={creditsData?.balance ?? null}",
  },
];

/**
 * ⚠ **THE ONE MEASURED EXEMPTION, WITH THE PRECONDITION THAT MAKES IT SAFE —
 * and the precondition is held by its own arm below, which is the only reason
 * an exemption is allowed to exist here at all.**
 *
 * `readCycle` in `planMath.ts` writes `remaining: Math.max(0, status.balance ?? 0)`,
 * and it is NOT this defect: four lines above it the function returns `null`
 * unless `status.currentPeriodStart` and `status.currentPeriodEnd` are both
 * present, so it cannot produce a cycle at all until `getStatus` has answered.
 * By the time that line runs the balance is a real figure from the server and
 * the `?? 0` is a type-level default that never fires. The `?` on the field is
 * defensive typing, not a loading state.
 *
 * **An exemption that only says "this one is fine" rots the moment somebody
 * moves the early return**, which is exactly how a guarded thing and an
 * unguarded thing come to share a line (see `spendWindowCopy` above). So the
 * exemption names the guard it leans on, and the arm below holds that guard to
 * still being there. Remove the early return and this suite reddens — which is
 * the moment the `?? 0` genuinely becomes a loading zero.
 */
const EXEMPT = {
  file: "features/settings/planMath.ts",
  /* The verbatim early return the exemption rests on. */
  precondition: "if (!status?.currentPeriodStart || !status?.currentPeriodEnd) return null;",
} as const;

function tsSourcesUnder(dir: string): string[] {
  /* ⚠ A listing can name a file that is gone by the time it is stat-ed, not
     only by the time it is read (#223's list-side twin): this tree is shared by
     several sessions. `throwIfNoEntry: false` and the `null` skip are the two
     halves, and `readListedSource` is the other one. */
  const entries = readdirSync(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const stat = statSync(full, { throwIfNoEntry: false });
    if (stat === undefined) continue;
    if (stat.isDirectory()) {
      found.push(...tsSourcesUnder(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    found.push(full);
  }
  return found;
}

type Offence = { readonly file: string; readonly line: number; readonly text: string };

function offences(): { readonly offences: Offence[]; readonly read: number; readonly printers: number } {
  let read = 0;
  let printers = 0;
  const found: Offence[] = [];
  for (const file of tsSourcesUnder(CLIENT_SRC)) {
    const source = readListedSource(file);
    /* `null` is "no longer there", never "holds nothing" — counting it as read
       is how a walk goes quiet and passes. */
    if (source === null) continue;
    read += 1;
    const code = withoutComments(source);
    /* The positive half of the floor: a file that formats a balance for a
       customer is one this walk must be able to see into. */
    if (code.includes("displayBalance(")) printers += 1;
    code.split("\n").forEach((text, index) => {
      if (BALANCE_DEFAULTED_TO_ZERO.test(text)) {
        found.push({ file: path.relative(CLIENT_SRC, file).replace(/\\/g, "/"), line: index + 1, text: text.trim() });
      }
    });
  }
  return { offences: found, read, printers };
}

describe("a credit balance nobody has read yet is not a balance of zero (#1703)", () => {
  /**
   * ⚠ **THE POSITIVE CONTROL ON THE READER ITSELF — card 1733, and it comes
   * before the floor because it is the one this suite did not have.**
   *
   * The floor below holds the WALK: that it found files, and files that print a
   * balance. Nothing held the PATTERN. So a hand edit that narrowed
   * `BALANCE_DEFAULTED_TO_ZERO` — a stray anchor, a lost alternation, a `\b`
   * in the wrong place — left every arm green and every verdict worthless,
   * which is working law 2 exactly: *a green suite proves nothing if the
   * checker cannot fail.*
   *
   * Both directions, because only the pair is a control: a reader that matches
   * the defect but also matches the repair would redden the whole tree on the
   * day it shipped and be deleted rather than believed.
   */
  it("still reads the four lines it was written about, and none of their repairs", () => {
    /* ⚠ The loop below asserts NOTHING over an empty list, which is how a
       control quietly becomes a comment. Four is the measured population of
       #1703's own diff; a fifth is welcome and a fourth going missing is not. */
    expect(
      MEASURED_SPECIMENS.length,
      "the specimen list has shrunk below the four lines #1703 measured — the arm below"
      + " iterates it, so an empty list passes while proving nothing. Card 1733.",
    ).toBeGreaterThanOrEqual(4);

    for (const { before, after } of MEASURED_SPECIMENS) {
      expect(
        after,
        `a specimen's repair is identical to its defect, so the pair proves nothing:\n  ${before.trim()}`,
      ).not.toBe(before);
      expect(
        BALANCE_DEFAULTED_TO_ZERO.test(before),
        `the reader no longer matches a line #1703 measured:\n  ${before.trim()}\n`
        + "A pattern that has stopped reading and a clean tree are the same green here.",
      ).toBe(true);
      expect(
        BALANCE_DEFAULTED_TO_ZERO.test(after),
        `the reader matches the REPAIR of a line #1703 measured:\n  ${after.trim()}\n`
        + "Keeping the balance `null` is the fix, so a reader that flags it would redden"
        + " the tree on the day it shipped.",
      ).toBe(false);
    }

    /* And it is not simply matching every line with a zero on it. */
    expect(BALANCE_DEFAULTED_TO_ZERO.test("  const dryDays = Math.max(0, cycle.daysLeft);")).toBe(false);
    expect(BALANCE_DEFAULTED_TO_ZERO.test("  const remainingShare = balance / allowance;")).toBe(false);
  });

  /**
   * ⚠ THE FLOOR COMES FIRST, because for a guard whose verdict is "nothing under
   * `client/src` does this", **reading less IS passing**. A walk that resolved
   * the wrong root, or that silently skipped every file, is indistinguishable
   * from a clean tree — and this repository has shipped exactly that twice.
   */
  it("reads the client tree, and can see into the files that print a balance", () => {
    const { read, printers } = offences();
    expect(read, "the walk found almost no client source — check the root, not the tree").toBeGreaterThan(200);
    expect(
      printers,
      "the walk cannot see a single call to `displayBalance` — a verdict about balances"
      + " rendered from a walk that cannot find one is a vacuous pass",
    ).toBeGreaterThan(4);
  });

  /**
   * The exemption's own ground, held rather than asserted. `planMath.ts`'s
   * `?? 0` is safe because the function refuses to return a cycle before the
   * period dates are known; if that early return goes, the default becomes a
   * loading zero on the burn sentence's denominator and this arm says so.
   */
  it("the one exemption still rests on the early return it claims", () => {
    const source = readListedSource(path.join(CLIENT_SRC, EXEMPT.file));
    expect(source, `${EXEMPT.file} is gone — re-read the exemption, do not delete the arm`).not.toBeNull();
    expect(
      withoutComments(source ?? ""),
      `${EXEMPT.file} no longer refuses a cycle before the billing period is known, so its`
      + ` \`balance ?? 0\` is now a loading zero rather than a dead default. Either restore the`
      + ` early return or fix the default and drop the exemption.`,
    ).toContain(EXEMPT.precondition);
  });

  it("no client surface defaults a balance to zero", () => {
    const { offences: found } = offences();
    expect(
      found
        .filter((o) => o.file !== EXEMPT.file)
        .map((o) => `${o.file}:${o.line}  ${o.text}`),
      "a balance is defaulted to 0 where it is not yet known. A zero balance and an unread"
      + " balance are opposite facts on a money surface: keep it `null` and let the surface"
      + " decline to claim anything (`BoardHeader` draws an em dash; the Add credits sentence"
      + " renders nothing). #1703.",
    ).toEqual([]);
  });
});
