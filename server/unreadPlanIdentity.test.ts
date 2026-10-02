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
 * ⚠ **AN UNREAD PLAN IS NOT THE FREE PLAN — #1741, and it is
 * `server/unreadMoneyFigure.test.ts` (#1725) ONE NOUN OVER, exactly as that
 * suite was #1703's.**
 *
 * # What a customer was told
 *
 * A Pro subscriber opens Settings and the header reads **"Klieg Studio · Free
 * plan"** and their own plan card is titled **"Free"**, for the beat before
 * `billing.getStatus` answers. Both then become their real plan.
 *
 * ⚠ **IT IS CERTAIN RATHER THAN RACY, which is the part that makes it worth a
 * guard.** `getStatus` is gated on an account surface being OPEN
 * (`AccountSurfaces.tsx`, and that gate is itself a deliberate fix — mounting
 * the modals unconditionally cost a paying customer a Stripe proration read on
 * every page view). So the query is in flight for the FIRST PAINT OF EVERY
 * SINGLE OPEN, on any network.
 *
 * # Why a third suite rather than a wider regex on either of the first two
 *
 * `creditBalanceLoadingState.test.ts` (#1703) bans the idiom for the noun
 * **balance**; `unreadMoneyFigure.test.ts` (#1725/#1727) bans it for the
 * **price** family. Neither can see this one, and not because their regexes are
 * narrow — **because the wrong fact is not a zero.** A plan is named with a
 * STRING, so the default reads `?? "free"`, and a reader looking for `?? 0`
 * walks past it. The idiom was right, the noun was the scope, and the LITERAL
 * is the scope one step further out.
 *
 * Three suites rather than one widened walk, on #1725's own stated ground: each
 * has a different measured remainder, and a shared one would have to be read
 * twice to know which noun a line belonged to.
 *
 * # ⚠ THE ROOT SHAPE IS THE *LOOKUP KEY*, NOT THE RENDERED NAME
 *
 * This is the finding worth more than the card that produced it, and it is why
 * the ban is written on `planTier` as well as on `planName`.
 *
 * `AccountSurfaces` read `const planId = status?.planTier ?? "free"` and then
 * looked the plan catalogue up by it. `billing.getPlans` is a SEPARATE
 * procedure — and although both ride one batched request (`httpBatchLink`), a
 * tRPC batch reply carries one entry per call and either can fail alone. They
 * are not equally likely to: `getPlans` is a constant fold over
 * `SUBSCRIPTION_PRODUCTS` and `getStatus` reads the database. So the reachable
 * state is `plans` answered beside an unanswered `status`, ⚠ **and it is
 * PERMANENT for the life of the surface rather than one beat** — the same shape
 * #1727 recorded on the casting surfaces, where an unread `castingV2.config` is
 * forever because nothing gates the sheet on it. In that state every fallback
 * keyed on `planId` answered out of the **free rung's row**:
 *
 * | fallback | what it became | what it looked like |
 * |---|---|---|
 * | `tier?.name` | `"Free"` | the defect this card was filed about |
 * | `tier?.monthlyCredits` | the free grant | *"of 13,500 this billing period"* at a subscriber |
 * | `tier?.price` | `0` | **"No charge"** — i.e. #1727's own repair walked around |
 *
 * That last row is the one to keep: **#1727 set the price chain's FLOOR to
 * `null` and left its SOURCE a guess**, so the fix it shipped could still be
 * stepped around by a query landing in the other order. A floor is not a repair
 * while something above it can hand down a confident wrong number. Keying the
 * lookup on `status?.planTier ?? null` is what closes all three at once, and it
 * makes #391's mid-deploy fallback BETTER rather than weaker — it now resolves
 * against the real tier an older bundle did send, instead of against "free".
 *
 * # ⚠ THE EM DASH IS NOT A DEFAULT AND IS DELIBERATELY NOT MATCHED
 *
 * `?? "—"` is the house's HELD glyph — the repair, not the defect — the same
 * way `?? null` is not matched by the other two suites. So the regex excludes
 * it, and the arm **"the ban is exactly as narrow as it says"** below holds that
 * exclusion to one character by driving the reader over both strings. Without
 * that arm this suite would be one keystroke from reading its own fix as
 * coverage, which this repository has shipped before (the `:not(:disabled)`
 * guard that contained its own token).
 *
 * # Which convention a held plan name takes, and it is not taste
 *
 * #1727 settled the split and it applies unchanged: a name in its OWN SLOT
 * draws the em dash, so nothing below it moves when the real one lands (the
 * plan card's title, whose row carries the two money buttons); a name that is a
 * CLAUSE INSIDE A SENTENCE is OMITTED, because "Klieg Studio · — plan" claims
 * there is a plan called em dash. Both are held by the last arm here.
 *
 * # The floor
 *
 * Same one both siblings state: **this is the measured IDIOM, not a proof of the
 * property.** A surface can still reach a rendered "Free" another way — a
 * ternary fallback the line-wise reader cannot see, a prop typed `string` fed
 * something wrong before it is known. What this holds is that the shape which
 * captioned a subscriber's own plan "Free" cannot come back unannounced.
 */

const CLIENT_SRC = path.resolve(__dirname, "..", "client", "src");

/**
 * A plan identity defaulted to a string that NAMES something.
 *
 * The capture is the identifier, so `DECLARED` keys on something stable across
 * reformatting rather than on a line number that moves whenever a docblock
 * above it grows — `unreadMoneyFigure.test.ts`'s reason, and it has already
 * paid for itself there.
 *
 * ⚠ **THE EXCLUDED CHARACTER IS THE EM DASH AND NOTHING ELSE.** It is the
 * held glyph for a fact not yet known, so a site using it is repaired rather
 * than offending. Every other string is a claim: `"free"`, `"Free"`, `"starter"`
 * and `""` all assert something about a plan nobody has read.
 *
 * ⚠ **THE OPTIONAL `)` IS CARRIED OVER FROM #1727's MEASURED HOLE**, where a
 * chained fallback parenthesised before its default (`(a ? x : y) ?? "free"`)
 * walked straight past a reader whose `\s*` cannot match a bracket.
 */
const PLAN_DEFAULTED_TO_A_NAME =
  /(\w*(?:plan|tier)\w*)\s*\)?\s*(?:\?\?|\|\|)\s*(["'`])(?!—)/i;

/**
 * ⚠ **THE MEASURED REMAINDER, AND IT ONLY SHRINKS.**
 *
 * Every site the walk finds must be on this list with a reason, and every entry
 * must still be findable — so fixing one means DELETING its line, and a new one
 * anywhere under `client/src` reddens with no edit needed here.
 *
 * Two verdicts, and they are not the same claim:
 *
 *  - **`safe`** — the default cannot reach a customer as a wrong plan, and the
 *    entry names the gate that stops it. An arm below holds each of those gates
 *    to still being there.
 *  - **`debt`** — a real instance of #1741's defect on another feature's
 *    surface, read at the bytes, carded rather than fixed here. Each needs its
 *    own frames in both themes, which is why they are not folded into a card
 *    about the Settings surfaces (his rule of 2026-10-01: a finding that is not
 *    this card's work is its own card).
 *
 * ⚠ **AND EACH `safe` WAS READ AT THE CODE BEFORE IT WAS WRITTEN DOWN, BECAUSE
 * #1727 FILED THREE DEBTS THE CODE SAID WERE SAFE** and had to correct them in
 * its own guard. The moderator entry below is the one that changed class under
 * that reading: it looks identical to the two modals and is not the same fact.
 */
const DECLARED: ReadonlyArray<{
  readonly file: string;
  readonly symbol: string;
  readonly verdict: "safe" | "debt";
  readonly why: string;
  /** For `safe`: the verbatim gate(s) the exemption rests on. */
  readonly gate?: readonly string[];
}> = [
  {
    file: "features/billing/AddCreditsModal.tsx",
    symbol: "planTier",
    verdict: "debt",
    why:
      "#1741's shape on the top-up surface, read at the bytes: there is no loading"
      + " gate, and `options` is memoised on `[plans, currentId]`. While BOTH queries"
      + " are unread `options` is empty and the button reads `No higher plan`, which"
      + " claims nothing about a plan. The reachable defect is the ASYMMETRIC state —"
      + " `getPlans` answered, `getStatus` not, which one batch reply can carry"
      + " because `getPlans` is a constant fold and `getStatus` reads the database."
      + " There `currentId` is \"free\", `order.indexOf` answers 0, EVERY paid rung"
      + " reads as above the customer's, and a Pro subscriber is offered a"
      + " pre-selected Starter top-up whose `+ N credits a month` delta is computed"
      + " against the FREE grant — permanently, not for a beat. Carded rather than"
      + " fixed here: #1606 is rebuilding this surface, and the frames are its own.",
  },
  {
    file: "features/billing/ChangePlanModal.tsx",
    symbol: "planTier",
    verdict: "debt",
    why:
      "The same line on the ladder surface, and `currentId` reaches four readers:"
      + " `currentName` (`ladder.find(id === currentId)?.name` — so the header names"
      + " the customer's plan \"Free\"), `recommendPlan`, `cardTrio` and"
      + " `compareWindow`, plus `plan.id === currentId` which draws `Current plan` on"
      + " the FREE card. Same state as the row above and reachable for the same"
      + " reason: `ladder` is empty while `plans` is unread, so nothing is claimed"
      + " then — it is `plans` ANSWERED beside an unanswered `status` that turns a"
      + " defaulted id into a wrong answer rather than no answer. Its own card and"
      + " its own frames.",
  },
  {
    file: "features/moderator/UserInvestigationWidgets.tsx",
    symbol: "planTier",
    verdict: "safe",
    why:
      "⚠ NOT THIS CLASS, read at the bytes — the query has already ANSWERED."
      + " `UserDetailCard` returns null until it has, so `credits` is undefined only"
      + " when the resolved payload carries no billing row — and an account with no"
      + " billing row IS on free, which is the same answer `billing.getStatus` gives"
      + " itself (`if (!subscription) return { planTier: \"free\" … }`). So the string"
      + " is a fact about a read account, not a guess about an unread one. The"
      + " `balance` beside it em-dashes because a balance has no such default.",
    gate: ["if (userDetailsQuery.isLoading || !userDetailsQuery.data) return null;"],
  },
];

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

type Offence = {
  readonly file: string;
  readonly line: number;
  readonly symbol: string;
  readonly text: string;
};

function scan(): {
  readonly offences: Offence[];
  readonly read: number;
  readonly namers: number;
} {
  let read = 0;
  let namers = 0;
  const found: Offence[] = [];
  for (const file of tsSourcesUnder(CLIENT_SRC)) {
    const source = readListedSource(file);
    /* `null` is "no longer there", never "holds nothing" — counting it as read
       is how a walk goes quiet and passes. */
    if (source === null) continue;
    read += 1;
    const code = withoutComments(source);
    /* The positive half of the floor: a file that names a plan identity at all
       is one this walk must be able to see into. */
    if (/planName|planTier|planOrder/.test(code)) namers += 1;
    code.split("\n").forEach((text, index) => {
      const hit = PLAN_DEFAULTED_TO_A_NAME.exec(text);
      if (hit) {
        found.push({
          file: path.relative(CLIENT_SRC, file).replace(/\\/g, "/"),
          line: index + 1,
          symbol: hit[1] ?? "",
          text: text.trim(),
        });
      }
    });
  }
  return { offences: found, read, namers };
}

/** A declaration matches an offence on the pair, never on a line number. */
const keyOf = (o: { file: string; symbol: string }) => `${o.file}::${o.symbol}`;

describe("an unread plan is not the free plan (#1741)", () => {
  /**
   * ⚠ THE FLOOR COMES FIRST, because for a guard whose verdict is "nothing new
   * under `client/src` does this", **reading less IS passing**. A walk that
   * resolved the wrong root, or silently skipped every file, is
   * indistinguishable from a clean tree — and this repository has shipped
   * exactly that twice (#1733 is the most recent).
   */
  it("reads the client tree, and can see into the files that name a plan", () => {
    const { read, namers } = scan();
    expect(
      read,
      "the walk found almost no client source — check the root, not the tree",
    ).toBeGreaterThan(200);
    expect(
      namers,
      "the walk cannot find the files that name a plan identity at all — a verdict about"
      + " plan captions from a walk that cannot see one is a vacuous pass",
    ).toBeGreaterThan(3);
  });

  /**
   * The ban itself. A new site, anywhere under `client/src`, needs no edit here
   * to be caught — which is the half that makes this a guard rather than a
   * record of one afternoon.
   */
  it("no undeclared client surface defaults a plan identity to a name", () => {
    const declared = new Set(DECLARED.map(keyOf));
    expect(
      scan()
        .offences.filter((o) => !declared.has(keyOf(o)))
        .map((o) => `${o.file}:${o.line}  ${o.text}`),
      "a plan name or plan tier is defaulted to a string where it is not yet known."
      + " An unread plan and the free plan are opposite facts on an account surface:"
      + " keep it `null` and let the surface decline — a name in its own slot draws an"
      + " em dash, a name inside a sentence drops its clause. And a plan TIER default"
      + " is the worse half, because the catalogue lookup keyed on it then answers out"
      + " of the wrong plan for every field beneath it. If this site is genuinely"
      + " unreachable as a loading guess, add it to DECLARED with the gate that makes"
      + " it so. #1741.",
    ).toEqual([]);
  });

  /**
   * ⚠ **THE BAN IS EXACTLY AS NARROW AS IT SAYS, AND THIS ARM IS WHY THE
   * EXCLUSION IS SAFE TO HAVE.** The reader skips `?? "—"` because that is the
   * repair; one character's slip either way and it skips `?? "Free"` too, or
   * reddens on every repaired site. Negative and positive control on the
   * instrument before its verdicts count (working law 2) — and the specific
   * failure it guards is a guard whose exclusion swallows its own subject,
   * which has shipped here green through sabotage before.
   */
  it("the ban is exactly as narrow as it says: the em dash is the repair, every other string is a claim", () => {
    const matches = (line: string) => PLAN_DEFAULTED_TO_A_NAME.test(line);

    expect(matches('  label={planName ?? "—"}'), "the em dash is the held glyph, not a default").toBe(false);
    expect(matches('  const planId = status?.planTier ?? "free";'), "the card's own defect").toBe(true);
    expect(matches('  const planName = status?.planName ?? "Free";'), "the card's own defect, capitalised").toBe(true);
    expect(matches("  const planId = status?.planTier ?? 'free';"), "quote style is not a loophole").toBe(true);
    expect(
      matches('  const planId = (hidden ? hiddenTier : status?.planTier) ?? "free";'),
      "#1727's parenthesised hole: a chained fallback is routinely bracketed before its"
      + " default, and `\\s*` cannot match a bracket",
    ).toBe(true);
    /* ⚠ THE STATED LIMIT OF THAT OPTIONAL BRACKET, driven rather than assumed —
       the first draft of the arm above asserted this line matched and it does
       not. The reader keys on the identifier it finds immediately before the
       `)`, so a parenthesised chain whose LAST term is not plan-named is
       invisible to it. That is the floor this suite's docblock states, with a
       line to show what it looks like. */
    expect(
      matches('  const planId = (status ? status.planTier : other) ?? "free";'),
      "the floor: the bracket only helps when the plan-named term is the last one inside it",
    ).toBe(false);
    expect(matches('  const planId = status?.planTier || "free";'), "`||` is the same default").toBe(true);
    expect(matches('  const planName = status?.planName ?? "";'), "an empty name is still a claim about a plan").toBe(true);
    expect(matches("  const planId = status?.planTier ?? null;"), "`null` is the repair").toBe(false);
    expect(matches('  const tier = plans?.tiers?.[planId as keyof T];'), "a lookup is not a default").toBe(false);
  });

  /**
   * ⚠ **AND THE LIST ONLY SHRINKS.** A declaration whose site is gone is a line
   * that would otherwise sit here forever, quietly licensing a shape nobody
   * writes any more — and, worse, licensing it again if somebody reintroduces it
   * under the same name. Fixing one of these means deleting its entry.
   */
  it("every declared site is still there, so the list cannot outlive its reasons", () => {
    const live = new Set(scan().offences.map(keyOf));
    expect(
      DECLARED.filter((entry) => !live.has(keyOf(entry))).map(
        (entry) => `${entry.file}::${entry.symbol}`,
      ),
      "a DECLARED site no longer defaults a plan identity — delete its entry. A standing"
      + " exemption for code that is gone is how a ban comes to cover less than it"
      + " claims. #1741.",
    ).toEqual([]);
  });

  /**
   * Each `safe` verdict leans on a gate in the same file, and the gate is held
   * rather than described. Move the gate and this reddens — which is the moment
   * the default beside it genuinely becomes a loading guess.
   */
  it("every safe verdict still rests on every gate it names", () => {
    for (const entry of DECLARED) {
      if (entry.verdict !== "safe" || !entry.gate) continue;
      const source = readListedSource(path.join(CLIENT_SRC, entry.file));
      expect(
        source,
        `${entry.file} is gone — re-read the exemption, do not delete the arm`,
      ).not.toBeNull();
      const code = withoutComments(source ?? "");
      for (const gate of entry.gate) {
        expect(
          code,
          `${entry.file} no longer carries the gate \`${gate}\` that makes its`
          + ` \`${entry.symbol}\` default safe, so that default is now a guess about an`
          + ` unread plan. Either restore the gate or fix the default and drop the`
          + ` exemption. #1741.`,
        ).toContain(gate);
      }
    }
  });

  /**
   * ⚠ **THE OTHER WAY TO REOPEN A REPAIRED SITE, AND THE BAN ABOVE CANNOT SEE
   * IT — #1727's lesson, inherited.** Deleting a `debt` entry proves a `?? "free"`
   * is gone; it proves nothing about what the surface then DOES with the `null`.
   * Render it anyway and `{planName} plan` reads " plan", or a consumer reaches
   * for its own `?? "Free"` one file down and the walk's verdict is unchanged
   * because that file is not declared.
   *
   * So the two conventions are held at their own declining branches. These are
   * deliberately FILE-SPECIFIC text arms rather than a widened walk, for the
   * reason both siblings give: "a plan-named identifier whose render declines
   * when it is null" is not a shape a line-wise reader can judge.
   */
  it("the Settings surfaces each decline to name a plan they have not been told", () => {
    const read = (...parts: string[]) =>
      withoutComments(readListedSource(path.join(CLIENT_SRC, ...parts)) ?? "");

    expect(
      read("features", "settings", "AccountSurfaces.tsx"),
      "the plan catalogue is looked up by a DEFAULTED tier again, so every fallback"
      + " beneath it answers out of the free rung — including the price #1727 repaired."
      + " #1741.",
    ).toContain("const planId = status?.planTier ?? null;");
    expect(
      read("features", "settings", "AccountSurfaces.tsx"),
      "the plan name no longer holds `null` while `getStatus` is unread, so a subscriber"
      + " is captioned Free for the first paint of every open. #1741.",
    ).toContain("status === undefined ? null : (status.planName ?? tier?.name ?? \"Free\")");

    expect(
      read("features", "settings", "SettingsModal.tsx"),
      "the Settings header states a plan before it has one. It is a SENTENCE, so the"
      + " clause is dropped rather than em-dashed — `Klieg Studio · — plan` claims there"
      + " is a plan called em dash. #1741.",
    ).toContain("planName === null ? null :");

    expect(
      read("features", "settings", "sections", "BillingSection.tsx"),
      "the plan card titles itself before it has a name. It is its own SLOT, so it draws"
      + " the em dash rather than dropping — an absent title collapses the row and walks"
      + " the two money buttons up the card. #1741.",
    ).toContain('label={planName ?? "—"}');
    expect(
      read("features", "settings", "sections", "BillingSection.tsx"),
      "the allowance is quoted, or used as a denominator, before it is known — and an"
      + " allowance read off a defaulted plan id is another plan's grant, not a zero."
      + " #1741.",
    ).toContain("const granted = allowance !== null && allowance > 0;");

    expect(
      read("features", "settings", "usageWindow.ts"),
      "the Usage pane quotes `of N this billing period` off an allowance nobody has read."
      + " #1703 guarded the balance on this line and left the allowance beside it, which"
      + " is the same half-guard one noun over. #1741.",
    ).toContain("allowance !== null && allowance > 0");
  });
});
