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
 * ⚠ **THE SUBSCRIPTION FACT, COLLAPSED OUT OF AN UNREAD QUERY — #1749, and
 * it is the FOURTH idiom in this family rather than a fourth noun.**
 *
 * The three suites before it each ban a DEFAULT: `?? 0` for a balance (#1703),
 * `?? 0` for a price (#1725/#1727), `?? "free"` for a plan name (#1741). This
 * one is not a default at all. `!!status?.hasSubscription` has no `??` in it,
 * so every one of those three readers walks straight past it — **and the
 * answer it produces is the same kind of lie**: `false`, meaning *this customer
 * has no subscription*, said about a customer nobody has read.
 *
 * It belongs in THIS suite rather than a fifth file because it is the same
 * query, the same two surfaces and the same fix as #1747 one line below: the
 * plan rung and the subscription fact are read off one `getStatus`, were
 * collapsed by one commit's worth of idiom, and are repaired together.
 *
 * # What it cost
 *
 * A Pro subscriber opened Add credits and the renewal line under the figure
 * read **"Charged today, then on the same date each period."** — the checkout
 * road's sentence, true of a new subscription and false of theirs — while the
 * figure beside it already drew an honest em dash and the button already held.
 * One line on the surface spoke from the unanswered query, and it was the one
 * that named a charging schedule.
 *
 * # ⚠ WHY IT IS `=== false` RATHER THAN A GATE AT THE OFFENDING LINE
 *
 * `AddCreditsModal` has SEVEN readers of this fact and `ChangePlanModal` five.
 * Six of the seven were right **by construction and not one of them said so**:
 * #1747 made `currentId` null, which empties `options`, which nulls `selected`,
 * which em-dashes the figure and inerts the button. Gating one line leaves the
 * next reader to rediscover that `false` has two meanings. `boolean | null`
 * makes the compiler ask all twelve.
 *
 * # The floor, and it is the narrowest one in this family
 *
 * This is the OPTIONAL-CHAIN COLLAPSE only — `!!x?.hasSubscription`. Measured
 * under `client/src` the day it was written: **11 sites** use `!!x?.y` at all,
 * of which **3** read `hasSubscription` and the remaining 8 read store state or
 * already-resolved data, where `false`-while-absent is the right answer. A
 * surface can still reach the same wrong fact another way — `status?.x === true`
 * read before the query answers, or a prop typed `boolean` fed a collapse in
 * its parent. What this holds is that the shape which told a subscriber they
 * had no subscription cannot come back unannounced.
 */
/* The whitespace is `\s*` at every joint, and that is not decoration: the
   narrowness control below asserted `!! status ?. hasSubscription` matches and
   the first draft of this pattern did not — it had `\?\.` butted against
   `\w+`. A guard that only sees the formatter's output is a guard on the
   formatter. */
const SUBSCRIPTION_COLLAPSED_FROM_UNREAD = /!!\s*\w+\s*\?\s*\.\s*hasSubscription/;

/**
 * ⚠ **THE BILLING INTERVAL, COLLAPSED OUT OF AN UNREAD QUERY — #1755, and
 * it is the FIFTH idiom in this family.**
 *
 * `status?.billingInterval === "year"` is `undefined === "year"` while the
 * query is in flight, which is **false** — and on a billing surface `false`
 * there does not mean *we have not been told*, it means **this customer is
 * billed monthly**. Neither of the first four readers can see it: there is no
 * `??` and no `!!`, only a comparison that answers confidently about nothing.
 *
 * # What it cost
 *
 * A **yearly** subscriber opened Add credits and the billing toggle sat in the
 * MONTHLY position — a `role="switch"` with `aria-checked={false}`, which is
 * an assertion and not a held state — then flipped under them when the status
 * landed. ✅ **#664's own comment three lines above that line says this is
 * the thing to prevent**, verbatim: *"the toggle opens on the interval the
 * customer is BILLED on (#664) — `null` until they touch it, so an annual
 * subscriber is not shown a monthly purchase they did not choose."* The
 * `annualChoice` half did exactly that; the fallback undid it for the unread
 * beat.
 *
 * # ⚠ What this reader does NOT see, stated because the remainder is real
 *
 * This is the OPTIONAL-CHAIN COMPARISON only. The sibling idiom — an interval
 * read correctly as `null` and then defaulted a line later
 * (`intervalChoice ?? billedInterval ?? "monthly"`) — is invisible to it.
 * ✅ **It is no longer a gap: the SIXTH reader below covers it (#1763), and
 * `ChangePlanModal`'s instance of it is repaired.** The reason it is a second
 * reader rather than a widened regex is the one this file gives for every
 * split: the two idioms differ in what makes them safe, so one reader cannot
 * state both verdicts — a `?? "monthly"` is a defect at the end of a nullable
 * chain and correct inside a branch that has already answered for the unread
 * state. A clean run here is still a floor, as it is for all four readers
 * above.
 */
const INTERVAL_COLLAPSED_FROM_UNREAD = /\w+\s*\?\s*\.\s*billingInterval\s*===/;

/**
 * The declared remainder for the reader above — same two verdicts and the same
 * rule as `DECLARED`: an entry whose site is gone reddens, so a fix means
 * deleting its line.
 */
const INTERVAL_DECLARED: ReadonlyArray<{
  readonly file: string;
  readonly why: string;
  readonly gate?: readonly string[];
}> = [
  {
    file: "features/billing/ChangePlanModal.tsx",
    why:
      "THE EXPRESSION IS SAFE, and it is the three-way ladder that makes it so:"
      + " the comparison's third branch is `null`, so an unread status lands"
      + " there rather than on `monthly` — this reader's verdict is correct about"
      + " these two lines. ✅ The line BELOW them put the collapse straight back"
      + " (`intervalChoice ?? billedInterval ?? \"monthly\"`), which drew the"
      + " Monthly segment `--on` with `aria-pressed` true for a yearly"
      + " subscriber's first frame; #1755 filed it and #1763 FIXED it, and the"
      + " sixth reader below is what keeps it fixed. #1755, #1763.",
    gate: [": null;"],
  },
];

/**
 * ⚠ **AN INTERVAL READ HONESTLY AS `null` AND THEN DEFAULTED A LINE LATER —
 * #1763, and it is the SIXTH idiom in this family.**
 *
 * `ChangePlanModal` got the hard half right and gave it back one line down:
 *
 * ```ts
 * const billedInterval: Interval | null = … : null;        // correct
 * const interval: Interval = intervalChoice ?? billedInterval ?? "monthly";
 * ```
 *
 * The fifth reader cannot see this and says so in its own docblock: there is no
 * optional chain here, only a default onto a value that was already honest. And
 * the result was typed `Interval`, so **not one of the readers below it was ever
 * asked** — thirteen of them at the measurement, from the segment's
 * `aria-pressed` to the interval a checkout is sent at.
 *
 * # Why it is a reader and not one widened regex
 *
 * Because the same characters are correct one branch over. `?? "monthly"` at
 * the END of a nullable chain is a guess about an unread query; the same
 * default INSIDE a branch that has already answered for the unread state is the
 * opposite — it names the cycle on offer to an account that has none of its own
 * (a free account, or the server's own *"null means unknown"* subscription).
 * A regex cannot tell those apart, so the safe site is DECLARED with the gate
 * it rests on, and an arm proves that gate is still there.
 *
 * # What this reader does NOT see
 *
 * `|| "monthly"` and a ternary spelling of the same default. Both are the same
 * wrong answer; neither appears in the tree, and the narrowness arm drives them
 * as the stated floor rather than leaving them to prose.
 */
const INTERVAL_DEFAULTED_TO_A_CYCLE = /\?\?\s*"(monthly|annual)"/;

/**
 * The declared remainder for the reader above — same two verdicts and the same
 * rule as `DECLARED`: an entry whose site is gone reddens, so a fix means
 * deleting its line.
 */
const INTERVAL_DEFAULT_DECLARED: ReadonlyArray<{
  readonly file: string;
  readonly why: string;
  readonly gate?: readonly string[];
}> = [
  {
    file: "features/billing/ChangePlanModal.tsx",
    why:
      "THE DEFAULT SITS INSIDE THE READ, which is the whole repair (#1763)."
      + " `status === undefined ? null : billedInterval ?? \"monthly\"` answers"
      + " `null` while the query is in flight and only then offers monthly as the"
      + " cycle on offer — a claim about nothing, for an account that has no cycle"
      + " of its own. The gate below is that null branch: lose it and this is the"
      + " defect again, with the ban unable to tell the difference.",
    gate: ["status === undefined ? null :", "const interval: Interval | null ="],
  },
];

/**
 * The declared remainder for the reader above. Same two verdicts and the same
 * rule as `DECLARED`: an entry whose site is gone reddens, so a fix means
 * deleting its line.
 */
const SUBSCRIPTION_DECLARED: ReadonlyArray<{
  readonly file: string;
  readonly why: string;
  readonly gate?: readonly string[];
}> = [
  {
    file: "features/billing/ChangePlanModal.tsx",
    why:
      "⚠ READ AT THE CODE AND LEFT ON PURPOSE — `hasSubscriptionForQuote` answers a"
      + " query's `enabled`, and that is the ONE consumer for which unread and"
      + " no-subscription genuinely want the same behaviour: do not ask Stripe to price"
      + " a plan change until we know there is a plan to change. Three-state here would"
      + " buy nothing and would put a `null` into a prop typed `boolean`. It is a"
      + " separate function with a separate name for exactly this reason, and its"
      + " return is its only reader — the surface's own `hasSubscription` is"
      + " `boolean | null` three lines down and is what every RENDER reads.",
    gate: [
      "function hasSubscriptionForQuote(status: { hasSubscription?: boolean } | undefined): boolean {",
      "const hasSubscription: boolean | null = status ? status.hasSubscription : null;",
    ],
  },
];

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
 *
 * ⚠ **THE LIST HAS SHRUNK ONCE AND THE SHAPE OF THAT IS WORTH KEEPING — #1747,
 * 2026-10-02.** Both `debt` rows — `AddCreditsModal` and `ChangePlanModal` —
 * were fixed and their entries DELETED, which is what the "list only shrinks"
 * arm below turns into the receipt: with the sites repaired, leaving the rows
 * here would redden. The declining branches each one now takes are held by the
 * two arms at the foot of this suite, because deleting a row proves the `??
 * "free"` is gone and proves nothing about what the surface then does with the
 * `null` — this suite's own inherited lesson from #1727.
 *
 * What the repair turned out to need beyond the one-line default, and it is the
 * part a future reader of this list should not have to rediscover: the three
 * shared ladder helpers (`recommendPlan`, `cardTrio`, `compareWindow`) all began
 * with `findIndex`, which answers **-1** both for an unread rung and for #391's
 * HIDDEN rung — two situations wanting opposite answers, and `cardTrio`'s -1
 * path deliberately draws the bottom three. Defaulting to `null` without
 * teaching them the difference would have routed the unread state into the
 * hidden rung's arrangement: the same wrong ladder by another road.
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

  /**
   * ⚠ **THE TWO MONEY SURFACES, AND THEY NEEDED MORE THAN THE DEFAULT — #1747.**
   *
   * The arm above covers the Settings surfaces, where the defaulted id reached
   * CAPTIONS. On these two it reached the OFFER: which rungs exist above the
   * account, which card is marked current, which plan the one ink button sells.
   * So each of these holds a declining branch that the `?? null` alone does not
   * give, and every one of them was a reachable wrong claim before this card:
   *
   * | surface | what it told a Pro subscriber |
   * |---|---|
   * | Change plan | header **"Free today"**, `Current plan` on the free card, and the one ink button reading **"Upgrade to Free"** |
   * | Add credits | a pre-selected **Starter** top-up, its delta against the free grant |
   */
  it("the two money surfaces decline to arrange a ladder around a plan they have not been told", () => {
    const read = (...parts: string[]) =>
      withoutComments(readListedSource(path.join(CLIENT_SRC, ...parts)) ?? "");

    const ladder = read("features", "settings", "planLadder.ts");
    /*
      ⚠ **EACH HELPER IS SLICED OUT BEFORE IT IS ASSERTED ON, AND A FILE-WIDE
      `toContain` WAS MEASURED SURVIVING SABOTAGE HERE.** `cardTrio` and
      `compareWindow` both decline with the identical line `if (currentId ===
      null) return [];` — so an arm reading the whole file stayed GREEN with
      `cardTrio`'s deleted, satisfied by its neighbour's copy. That is the
      `:not(:disabled)` class this repository has shipped before: a guard whose
      subject is one of several identical lines cannot name which one it found.
    */
    const bodyOf = (name: string) => {
      const from = ladder.indexOf(`export function ${name}(`);
      expect(from, `planLadder no longer declares ${name} — #1747's arms cannot read it`)
        .toBeGreaterThan(-1);
      /* The next top-level `export` is the end of this body. Anchored at the
         start of a line so a mention inside a docblock cannot cut it short. */
      const rest = ladder.slice(from + 1);
      const next = rest.search(/^export /m);
      return next === -1 ? ladder.slice(from) : ladder.slice(from, from + 1 + next);
    };

    expect(
      bodyOf("cardTrio"),
      "`cardTrio` no longer separates an UNREAD rung from #391's HIDDEN rung. Both make"
      + " `findIndex` answer -1, and the -1 path draws the bottom three cards on purpose —"
      + " so without this line an unread rung inherits that arrangement and a Pro"
      + " subscriber is shown the free rung's ladder by another road. #1747.",
    ).toContain("if (currentId === null) return [];");
    expect(
      bodyOf("compareWindow"),
      "`compareWindow` no longer declines on an unread rung, so the five-column comparison"
      + " is centred on nothing — and `Math.max(0, -1)` below reads an unknown rung as the"
      + " BOTTOM one. #1747.",
    ).toContain("if (currentId === null) return [];");
    expect(
      bodyOf("recommendPlan"),
      "`recommendPlan` no longer declines on an unread rung. #1747.",
    ).toContain("if (currentId === null) return null;");
    /* The narrow half: `cardTrio`'s own -1 fallback must still be there, or this
       card has quietly taken #391's hidden-rung behaviour with it. */
    expect(
      bodyOf("cardTrio"),
      "#391's hidden-rung fallback is gone. An account on the unpriced top rung is not on"
      + " the offered ladder and is deliberately shown the first three with nothing marked"
      + " current — that is a KNOWN rung and is not what #1747 changed.",
    ).toContain("if (currentIndex < 0) return ladder.slice(0, 3);");

    const change = read("features", "billing", "ChangePlanModal.tsx");
    expect(
      change,
      "the ladder is keyed on a DEFAULTED tier again, so the free card is marked `Current"
      + " plan` on a subscriber's screen and the whole trio is arranged around the bottom"
      + " rung. #1747.",
    ).toContain("const currentId = status?.planTier ?? null;");
    expect(
      change,
      "⚠ the ONE reader the helpers cannot cover: `offered` does its own arithmetic, and"
      + " `currentIndex + 1` is 0 when the rung is unknown — so the single ink button on a"
      + " paying customer's screen reads `Upgrade to Free`. It is the loudest thing on the"
      + " surface and the exact opposite of an upgrade. #1747.",
    ).toContain(": recommended ?? ladder.find((plan, index) => index === currentIndex + 1)");

    const topup = read("features", "billing", "AddCreditsModal.tsx");
    expect(
      topup,
      "the top-up surface keys the rung lookup on a defaulted tier again, so every paid"
      + " rung reads as above the customer's and a Pro subscriber is offered a Starter"
      + " top-up. #1747.",
    ).toContain("const currentId = status?.planTier ?? null;");
    expect(
      topup,
      "⚠ `No higher plan` is claimed off an empty ladder again. #1734 gave that claim three"
      + " states and gated it on `plans`; an unread RUNG is a third cause of the same empty"
      + " `options`, and with the catalogue answered the old `Boolean(plans)` told a"
      + " subscriber there is nothing above them. #1747.",
    ).toContain("const laddered = Boolean(plans) && currentId !== null;");
    expect(
      topup,
      "the allowance is read out of the catalogue by a defaulted rung again — and that is a"
      + " real number from the WRONG PLAN, which `?? 0` cannot be told from a zero. The"
      + " delta on the button is then out by a whole plan. #1747.",
    ).toContain("currentCredits !== null ? selected.credits - currentCredits : null");
  });

  /**
   * ⚠ **THE TWO REPAIRS THE SOURCE READ COULD NOT HAVE FOUND — both came from
   * LOOKING at the surfaces, which is working law 6 earning its place (#1747).**
   *
   * Keying the lookup on `null` is correct and, on its own, shipped two states
   * no customer should be shown. Each is held here because each is a branch a
   * later edit can quietly delete without any other arm noticing:
   *
   * 1. **Add credits** — making `laddered` require the rung takes `nothingAbove`
   *    false, and the button then fell through to **"Checking the charge…"
   *    permanently**: no rung means no `selectedId`, so the preview never runs
   *    and no quote is ever coming. That is #1734's own defect, reached by a
   *    third road, opened by this card's fix.
   * 2. **Change plan** — the ladder correctly drew NOTHING, which rendered as a
   *    modal with a heading and a hole. Honest and unreadable: a customer reads
   *    it as broken rather than waiting.
   */
  it("neither surface renders an honest blank a customer would read as broken", () => {
    const read = (...parts: string[]) =>
      withoutComments(readListedSource(path.join(CLIENT_SRC, ...parts)) ?? "");

    const topup = read("features", "billing", "AddCreditsModal.tsx");
    /* ⚠ Read as an ORDER rather than as a block of text: what makes this branch
       correct is that it is asked BEFORE `nothingAbove`, and a `toContain` over
       the formatted chain breaks the moment prettier re-indents it.

       ⚠ `lastIndexOf`, measured rather than assumed: `{working` appears three
       times in this file and the FIRST is `busy={working}` on the modal body, so
       an `indexOf` slice swallowed the PICKER's own `nothingAbove` branch and
       read its position as the button's. The arm then failed against a correct
       tree, which is the direction that wastes a shift. */
    const buttonAt = topup.lastIndexOf("{working", topup.indexOf("Checking the charge"));
    const label = topup.slice(buttonAt, topup.indexOf("Checking the charge"));
    expect(label.length, "the confirm button's label chain could not be found").toBeGreaterThan(0);
    expect(
      label.indexOf("currentId === null"),
      "the confirm button no longer answers for an unknown rung at all, so it falls through"
      + " to `Checking the charge…` and waits forever on a quote that cannot be asked for:"
      + " no rung means no `selectedId`, so the preview never runs. That is #1734's defect"
      + " reached by a third road, and this card's own fix is what opened it. #1747.",
    ).toBeGreaterThan(-1);
    expect(
      label.indexOf("currentId === null"),
      "the unknown-rung branch has moved BELOW `nothingAbove`, which is where it stops"
      + " working: `nothingAbove` is false in that state and `quoteReady` is false too, so"
      + " the first matching branch becomes the waiting one again. The order is the whole"
      + " of the repair. #1747.",
    ).toBeLessThan(label.indexOf("nothingAbove"));

    const change = read("features", "billing", "ChangePlanModal.tsx");
    expect(
      change,
      "the Change plan modal draws a hole where the ladder would be. Correct about the"
      + " facts and unreadable on screen — a heading, a billing toggle and nothing else."
      + " #1747.",
    ).toContain("cannotArrange ?");
    expect(
      change,
      "⚠ the held line's condition is no longer the CATALOGUE having answered. That is what"
      + " keeps it off the ordinary loading beat: both queries ride one batch reply, so"
      + " `ladder` is empty while `status` is unread and this branch cannot be reached until"
      + " they come apart. A timer or a bare `currentId === null` flashes it on every open."
      + " #1747.",
    ).toContain("const cannotArrange = ladder.length > 0 && currentId === null;");
    expect(
      change,
      "the held line names no machinery and tells the customer what to do — the"
      + " disappearing-technology law's refusal clause. #1747.",
    ).toContain("We could not read which plan you are on just now");
  });

  /**
   * ⚠ **THE SITE THIS SUITE'S READER CANNOT SEE, PINNED BY HAND — #1747's law-7
   * sweep, and it is the stated floor with a live instance behind it.**
   *
   * `ChangePlanModal` passes the confirm dialog's quote input as
   * `(confirming?.id ?? null) as never`. The identifier before the `??` is `id`,
   * which carries neither "plan" nor "tier", so `PLAN_DEFAULTED_TO_A_NAME` walks
   * straight past it however the default is spelled — the walk above would be
   * silent if it read `?? "starter"` again, which is what it read before this
   * card.
   *
   * It was never a live defect and the sweep says so: the query's `enabled` is
   * false on exactly the condition that makes the default apply, so nothing
   * travelled. What is held here is the PAIR of facts that keeps it that way —
   * the placeholder carries no plan name, AND the gate is still the thing that
   * stops it. Either one alone is a trap: a name behind a gate becomes a wrong
   * answer the day somebody prefetches, and a gate with nothing behind it is
   * fine until the placeholder grows a name again.
   */
  it("the confirm quote's placeholder names no plan, and its gate is still what stops it", () => {
    const change = withoutComments(
      readListedSource(path.join(CLIENT_SRC, "features", "billing", "ChangePlanModal.tsx")) ?? "",
    );

    expect(
      change,
      "the confirm dialog's quote input defaults to a plan NAME again. Unreachable today"
      + " because the query is disabled when `confirming` is null — and that is exactly the"
      + " trap: it becomes a Starter quote shown to a customer confirming something else the"
      + " day that gate moves, with nothing on screen looking wrong. `null` fails loudly"
      + " instead. #1747.",
    ).toContain("newPlan: (confirming?.id ?? null) as never");
    expect(
      change,
      "the confirm quote is no longer gated on there BEING something to confirm, so the"
      + " placeholder above now travels. Restore the gate or stop sending a placeholder."
      + " #1747.",
    ).toContain("enabled: hasSubscriptionForQuote(status) && confirming !== null");
  });
  /**
   * ⚠ **THE SUBSCRIPTION FACT — #1749. The sibling arms, and they use the
   * second vocabulary rather than the first.** `SUBSCRIPTION_COLLAPSED_FROM_UNREAD`'s
   * own docblock carries why this is an idiom and not a noun; these hold it.
   */
  it("no client surface collapses the subscription fact out of an unread status", () => {
    const declared = new Set(SUBSCRIPTION_DECLARED.map((entry) => entry.file));
    const offences: string[] = [];
    let read = 0;
    for (const file of tsSourcesUnder(CLIENT_SRC)) {
      const source = readListedSource(file);
      if (source === null) continue;
      read += 1;
      const relative = path.relative(CLIENT_SRC, file).replace(/\\/g, "/");
      if (declared.has(relative)) continue;
      withoutComments(source)
        .split("\n")
        .forEach((text, index) => {
          if (SUBSCRIPTION_COLLAPSED_FROM_UNREAD.test(text)) {
            offences.push(`${relative}:${index + 1}  ${text.trim()}`);
          }
        });
    }
    /* The floor, first and in the same arm: a walk that read nothing passes
       this ban vacuously, which is #1733's class. */
    expect(read, "the walk found almost no client source — check the root").toBeGreaterThan(200);
    expect(
      offences,
      "the subscription fact is collapsed to `false` where it is not yet known. An unread"
      + " status and an account with no subscription are opposite facts on a billing"
      + " surface: one of them is charged today at a brand-new subscription's price, the"
      + " other has a plan already. Keep it `boolean | null` and let each reader answer"
      + " for `null` in its own words. If this site genuinely wants them identical — a"
      + " query's `enabled` is the one that does — add it to SUBSCRIPTION_DECLARED with"
      + " the gate that makes it so. #1749.",
    ).toEqual([]);
  });

  /**
   * ⚠ Negative and positive control on the second reader before its verdicts
   * count (working law 2). The arm above can only be trusted if it reddens on
   * the collapse and stays quiet on the repair — and here the two differ by
   * punctuation rather than by a word, which is the condition under which a
   * guard most easily comes to cover its own fix.
   */
  it("the subscription ban is exactly as narrow as it says", () => {
    const matches = (line: string) => SUBSCRIPTION_COLLAPSED_FROM_UNREAD.test(line);

    expect(
      matches("  const hasSubscription = !!status?.hasSubscription;"),
      "the card's own defect",
    ).toBe(true);
    expect(matches("  return !! status ?. hasSubscription ;"), "whitespace is not a loophole").toBe(true);
    expect(
      matches("  const hasSubscription: boolean | null = status ? status.hasSubscription : null;"),
      "the repair must not read as the defect, or this suite covers its own fix",
    ).toBe(false);
    expect(
      matches("  const on = !!status?.hasSubscription === true;"),
      "the collapse is the collapse however it is then compared",
    ).toBe(true);
    expect(
      matches("  if (hasSubscription === null) return;"),
      "a three-state read is the repair",
    ).toBe(false);
    /* ⚠ THE STATED FLOOR, DRIVEN RATHER THAN ASSERTED IN PROSE: this reads the
       optional-chain collapse and nothing else. A truthiness test written without
       `!!`, or on a destructured field, is invisible to it — so a clean run here
       is a floor and not a proof. */
    expect(
      matches("  const hasSubscription = Boolean(status?.hasSubscription);"),
      "the floor: Boolean(…) is the same collapse and this reader cannot see it",
    ).toBe(false);
    expect(
      matches("  if (status?.hasSubscription) {"),
      "the floor: a bare truthiness test is the same collapse and this reader cannot see it",
    ).toBe(false);
  });

  it("every declared subscription site is still there, and still rests on its gates", () => {
    for (const entry of SUBSCRIPTION_DECLARED) {
      const source = readListedSource(path.join(CLIENT_SRC, entry.file));
      expect(
        source,
        `${entry.file} is gone — re-read the exemption, do not delete the arm`,
      ).not.toBeNull();
      const code = withoutComments(source ?? "");
      expect(
        SUBSCRIPTION_COLLAPSED_FROM_UNREAD.test(code),
        `${entry.file} no longer collapses the subscription fact — delete its`
        + ` SUBSCRIPTION_DECLARED entry. A standing exemption for code that is gone is how`
        + ` a ban comes to cover less than it claims. #1749.`,
      ).toBe(true);
      for (const gate of entry.gate ?? []) {
        expect(
          code,
          `${entry.file} no longer carries a gate its exemption names, so that collapse is`
          + ` now a guess about an unread status. Either restore the gate or fix the`
          + ` collapse and drop the exemption. #1749. Missing: ${gate}`,
        ).toContain(gate);
      }
    }
  });

  /**
   * ⚠ **AND THE BAN PROVES THE COLLAPSE IS GONE, NOT WHAT THE SURFACE THEN
   * SAYS — #1727's lesson, inherited for the third time.** `boolean | null`
   * with every reader still written `!hasSubscription` is the same wrong
   * sentence with a wider type: `!null` is `true`. So each reader's declining
   * spelling is held here, file-specific, for the reason both siblings give.
   */
  it("no client surface collapses the billing interval out of an unread status", () => {
    const declared = new Set(INTERVAL_DECLARED.map((entry) => entry.file));
    const offences: string[] = [];
    let read = 0;
    for (const file of tsSourcesUnder(CLIENT_SRC)) {
      const source = readListedSource(file);
      if (source === null) continue;
      read += 1;
      const relative = path.relative(CLIENT_SRC, file).replace(/\\/g, "/");
      if (declared.has(relative)) continue;
      withoutComments(source)
        .split("\n")
        .forEach((text, index) => {
          if (INTERVAL_COLLAPSED_FROM_UNREAD.test(text)) {
            offences.push(`${relative}:${index + 1}  ${text.trim()}`);
          }
        });
    }
    /* The floor, first and in the same arm: a walk that read nothing passes
       this ban vacuously, which is #1733's class. */
    expect(read, "the walk found almost no client source — check the root").toBeGreaterThan(200);
    expect(
      offences,
      "the billing interval is compared through an optional chain, so it answers"
      + " `monthly` about a customer nobody has read. On this surface that is not a"
      + " cosmetic flicker: it is the position of a two-state CONTROL, the gate on a"
      + " struck-through price, and the interval a checkout or plan change is sent at."
      + " Read it `boolean | null` — `status ? status.billingInterval === \"year\" :"
      + " null` — and let each reader answer for `null` in its own words. #1755.",
    ).toEqual([]);
  });

  /**
   * ⚠ Negative and positive control on the fifth reader before its verdicts
   * count (working law 2), and here the defect and the repair differ by
   * punctuation rather than by a word — the condition under which a guard most
   * easily comes to cover its own fix.
   */
  it("the interval ban is exactly as narrow as it says", () => {
    const matches = (line: string) => INTERVAL_COLLAPSED_FROM_UNREAD.test(line);

    expect(
      matches('  const annual = annualChoice ?? status?.billingInterval === "year";'),
      "the card's own defect",
    ).toBe(true);
    expect(
      matches('  return x ?. billingInterval === "month" ;'),
      "whitespace is not a loophole",
    ).toBe(true);
    expect(
      matches('    annualChoice ?? (status ? status.billingInterval === "year" : null);'),
      "the repair must not read as the defect, or this suite covers its own fix",
    ).toBe(false);
    /* ⚠ THE STATED FLOOR, DRIVEN RATHER THAN ASSERTED IN PROSE. */
    expect(
      matches('  const interval = intervalChoice ?? billedInterval ?? "monthly";'),
      "the floor: a correctly-null interval defaulted a line later is the same wrong"
      + " answer and this reader cannot see it -- the SIXTH reader below is what"
      + " covers it (#1763), and this arm is what proves the two do not overlap",
    ).toBe(false);
    expect(
      matches('  const annual = status?.billingInterval ? true : false;'),
      "the floor: a truthiness test is the same collapse and this reader cannot see it",
    ).toBe(false);
  });

  it("every declared interval site is still there, and still rests on its gates", () => {
    for (const entry of INTERVAL_DECLARED) {
      const source = readListedSource(path.join(CLIENT_SRC, entry.file));
      expect(
        source,
        `${entry.file} is gone — re-read the exemption, do not delete the arm`,
      ).not.toBeNull();
      const code = withoutComments(source ?? "");
      expect(
        INTERVAL_COLLAPSED_FROM_UNREAD.test(code),
        `${entry.file} no longer compares the interval through an optional chain --`
        + ` delete its INTERVAL_DECLARED entry. A standing exemption for code that is`
        + ` gone is how a ban comes to cover less than it claims. #1755.`,
      ).toBe(true);
      for (const gate of entry.gate ?? []) {
        expect(
          code,
          `${entry.file} no longer carries a gate its exemption names, so that`
          + ` comparison is now a guess about an unread status. #1755. Missing: ${gate}`,
        ).toContain(gate);
      }
    }
  });

  it("no client surface defaults a billing cycle onto an interval it read as unknown", () => {
    const declared = new Set(INTERVAL_DEFAULT_DECLARED.map((entry) => entry.file));
    const offences: string[] = [];
    let read = 0;
    for (const file of tsSourcesUnder(CLIENT_SRC)) {
      const source = readListedSource(file);
      if (source === null) continue;
      read += 1;
      const relative = path.relative(CLIENT_SRC, file).replace(/\\/g, "/");
      if (declared.has(relative)) continue;
      withoutComments(source)
        .split("\n")
        .forEach((text, index) => {
          if (INTERVAL_DEFAULTED_TO_A_CYCLE.test(text)) {
            offences.push(`${relative}:${index + 1}  ${text.trim()}`);
          }
        });
    }
    /* The floor, first and in the same arm: a walk that read nothing passes
       this ban vacuously, which is #1733's class. */
    expect(read, "the walk found almost no client source — check the root").toBeGreaterThan(200);
    expect(
      offences,
      "a billing cycle is defaulted onto an interval that was read as unknown, so"
      + " the surface asserts a cycle nobody has been told. The honest shape is the"
      + " default INSIDE the read — `status === undefined ? null : billed ?? \"monthly\"`"
      + " — and a type of `Interval | null`, so every reader below is asked rather"
      + " than inheriting the guess. #1763.",
    ).toEqual([]);
  });

  /**
   * ⚠ Negative and positive control on the sixth reader before its verdicts
   * count (working law 2). The defect and the repair share the characters this
   * reader keys on, which is why the safe site is declared with a gate rather
   * than written into the regex.
   */
  it("the cycle-default ban is exactly as narrow as it says", () => {
    const matches = (line: string) => INTERVAL_DEFAULTED_TO_A_CYCLE.test(line);

    expect(
      matches('  const interval: Interval = intervalChoice ?? billedInterval ?? "monthly";'),
      "the card's own defect",
    ).toBe(true);
    expect(
      matches('  const i = choice ??  billed ??   "annual" ;'),
      "whitespace and the other cycle are not loopholes",
    ).toBe(true);
    expect(
      matches('  const interval: Interval | null = intervalChoice ?? billedInterval;'),
      "the repair must not read as the defect, or this suite covers its own fix",
    ).toBe(false);
    /* ⚠ THE STATED FLOOR, DRIVEN RATHER THAN ASSERTED IN PROSE. Neither
       spelling is in the tree; both are the same wrong answer. */
    expect(
      matches('  const interval = intervalChoice || billedInterval || "monthly";'),
      "the floor: the same default written with `||` is invisible to this reader",
    ).toBe(false);
    expect(
      matches('  const interval = billedInterval === null ? "monthly" : billedInterval;'),
      "the floor: the same default written as a ternary is invisible to this reader",
    ).toBe(false);
  });

  it("every declared cycle-default site is still there, and still rests on its gates", () => {
    for (const entry of INTERVAL_DEFAULT_DECLARED) {
      const source = readListedSource(path.join(CLIENT_SRC, entry.file));
      expect(
        source,
        `${entry.file} is gone — re-read the exemption, do not delete the arm`,
      ).not.toBeNull();
      const code = withoutComments(source ?? "");
      expect(
        INTERVAL_DEFAULTED_TO_A_CYCLE.test(code),
        `${entry.file} no longer defaults a billing cycle -- delete its`
        + ` INTERVAL_DEFAULT_DECLARED entry. A standing exemption for code that is`
        + ` gone is how a ban comes to cover less than it claims. #1763.`,
      ).toBe(true);
      for (const gate of entry.gate ?? []) {
        expect(
          code,
          `${entry.file} no longer carries a gate its exemption names, so its`
          + ` default is now a guess about an unread status. #1763. Missing: ${gate}`,
        ).toContain(gate);
      }
    }
  });

  /**
   * ⚠ **AND THE BAN PROVES THE COLLAPSE IS GONE, NOT WHAT THE SURFACE THEN
   * SAYS — #1727's lesson, inherited for the fifth time.** `Interval | null`
   * with the segment still written `interval === "monthly"` is the same wrong
   * control with a wider type: `null === "monthly"` is `false`, which paints
   * and announces exactly what the defect painted and announced.
   */
  it("Change plan declines to press a billing interval it was not told", () => {
    const plan = withoutComments(
      readListedSource(path.join(CLIENT_SRC, "features/billing/ChangePlanModal.tsx")) ?? "",
    );
    expect(plan, "ChangePlanModal is gone or renamed — #1763's arms cannot read it")
      .not.toEqual("");

    /* The three-state read itself, in the one spelling that puts the default
       inside the branch that has already answered. */
    expect(
      plan,
      "the interval is collapsed to a cycle again, so every reader below inherits"
      + " a guess about an unread status. #1763.",
    ).toContain(
      'intervalChoice ?? (status === undefined ? null : billedInterval ?? "monthly")',
    );
    expect(
      plan,
      "the interval is typed non-null again, which is what stopped the readers"
      + " below from ever being asked. #1763.",
    ).toContain("const interval: Interval | null =");

    /* ⚠ THE CONTROL IS NOT DRAWN AT ALL while the cycle is unknown: both of its
       `aria-pressed` values are assertions and ARIA has no held state for a
       pressed button, which is the same answer #1755 took on Add credits. */
    expect(
      plan,
      "the segmented control is drawn before the cycle is known, so one of its two"
      + " segments is announced pressed about a customer nobody has read. #1763.",
    ).toContain("{interval === null ? null : (");

    /* The two money roads, each refusing rather than inheriting. */
    expect(
      plan,
      "a plan change or a checkout can be sent at a cycle derived from an unread"
      + " status — the one mistake here a customer cannot click back. #1763.",
    ).toContain("if (interval === null) return;");
    expect(
      plan,
      "the plan-change preview can fire against a guessed cycle again. #1763.",
    ).toContain("confirming !== null && interval !== null");
    expect(
      plan,
      "the confirm dialog names a cycle (`— billed monthly`) beside a charge"
      + " before the status has answered. #1763.",
    ).toContain("confirming && changeQuote.data && interval !== null ?");
    expect(
      plan,
      "the comparison table prices every column by a cycle nobody has read. #1763.",
    ).toContain("compare && interval !== null ?");
  });

  /**
   * ⚠ **AND THE BAN PROVES THE COLLAPSE IS GONE, NOT WHAT THE SURFACE THEN
   * SAYS — #1727's lesson, inherited for the fourth time.** `boolean | null`
   * with every reader still written `annual ?` is the same wrong control with a
   * wider type: `!null` is `true`, and `annual ? a : b` takes `b`. So each
   * reader's declining spelling is held here.
   */
  it("Add credits declines to put its billing toggle in a position it was not told", () => {
    const topup = withoutComments(
      readListedSource(path.join(CLIENT_SRC, "features", "billing", "AddCreditsModal.tsx")) ?? "",
    );

    expect(
      topup,
      "the interval is a plain boolean again, so `false` means both `billed monthly`"
      + " and `not read yet`, and a two-state control cannot tell them apart. #1755.",
    ).toContain('annualChoice ?? (status ? status.billingInterval === "year" : null);');

    /* ⚠ The toggle row is SLICED OUT before it is asserted on. A file-wide
       `toContain` for a declining branch was measured surviving sabotage on this
       very suite at #1747, satisfied by an identical line in a neighbouring
       function — and `annual !== null` appears more than once in this file. */
    const rowFrom = topup.indexOf('<div className="dp-topup__adjust">');
    expect(
      rowFrom,
      "the billing-adjustment block is gone or renamed — #1755's arms cannot read it",
    ).toBeGreaterThan(-1);
    const rowEnd = topup.indexOf('className="dp-topup__pricerow"', rowFrom);
    expect(rowEnd, "the price row no longer follows the toggle").toBeGreaterThan(rowFrom);
    const row = topup.slice(rowFrom, rowEnd);

    expect(
      row,
      "THE CARD'S OWN DEFECT. A `role=\"switch\"` has two states and both are"
      + " assertions: `aria-checked={false}` says the customer is billed MONTHLY, it"
      + " does not say `we have not been told`. ARIA does not allow `mixed` on a"
      + " switch, so the row is not drawn at all until the interval is known — which"
      + " is the card's other option in its own words. #1755.",
    ).toContain("{annual !== null ? (");
    expect(
      row,
      "the toggle is drawn unconditionally again, so the unread state is announced as"
      + " a position the customer never chose. #1755.",
    ).toMatch(/\{annual !== null \? \([\s\S]*aria-checked=\{annual\}/);

    const priceRowFrom = topup.indexOf('className="dp-topup__pricerow"');
    const priceRowEnd = topup.indexOf('className="dp-topup__duenote"', priceRowFrom);
    expect(priceRowEnd, "the price row does not close where it used to").toBeGreaterThan(priceRowFrom);
    expect(
      topup.slice(priceRowFrom, priceRowEnd),
      "the struck full-year price rests on `annual &&` again. It declines while unread"
      + " today for a reason that is not about the interval at all, and a gate that"
      + " happens to hold is not a gate — this line strikes out a year's list price"
      + " BECAUSE the customer chose annual. #1755.",
    ).toContain("{annual === true && hasSubscription === false && fullYear > 0 ? (");

    /* The money path: an interval is never SENT off an unread status. */
    expect(
      topup,
      "`submit` no longer refuses on an unread interval. The two sends below it name"
      + " what the customer is charged and over what period, and `quoteReady` keeping"
      + " that unreachable today is an implication rather than a gate. #1755.",
    ).toContain("hasSubscription === null || annual === null) return;");
    expect(
      topup,
      "the plan-change preview can fire against a guessed interval again. #1755.",
    ).toContain("hasSubscription === true && annual !== null && !!selectedId");
  });

  it("the two billing surfaces decline to name a charging road they have not been told", () => {
    const read = (...parts: string[]) =>
      withoutComments(readListedSource(path.join(CLIENT_SRC, ...parts)) ?? "");

    const topup = read("features", "billing", "AddCreditsModal.tsx");

    expect(
      topup,
      "the subscription fact is a plain boolean again, so `false` means both `no"
      + " subscription` and `not read yet` and the renewal line cannot tell them apart."
      + " #1749.",
    ).toContain("const hasSubscription: boolean | null = status ? status.hasSubscription : null;");
    expect(
      topup,
      "`planRead` is no longer DERIVED from the fact above it. Two reads of one query"
      + " drift the moment one is edited — working law 4, and the yearly clause below is"
      + " the consumer that needs *has it answered* rather than *is there a plan*. #1749.",
    ).toContain("const planRead = hasSubscription !== null;");

    /* ⚠ The renewal line is SLICED OUT before it is asserted on. A file-wide
       `toContain` for a declining branch was measured surviving sabotage on this
       very suite at #1747, satisfied by an identical line in a neighbouring
       function — and `hasSubscription === false` appears twice in this file. */
    const renewalFrom = topup.indexOf('<p className="dp-topup__renewal">');
    expect(
      renewalFrom,
      "the renewal paragraph is gone or renamed — #1749's arms cannot read it",
    ).toBeGreaterThan(-1);
    const renewalEnd = topup.indexOf("</p>", renewalFrom);
    expect(renewalEnd, "the renewal paragraph does not close").toBeGreaterThan(renewalFrom);
    const renewal = topup.slice(renewalFrom, renewalEnd);

    expect(
      renewal,
      "THE CARD'S OWN DEFECT. The renewal line takes the checkout road's sentence on"
      + " `!hasSubscription`, which is true while the status is unread — so a paying"
      + " subscriber reads the new-subscription charging schedule about their own"
      + " account. `=== false` is the whole repair; the unread state then falls through"
      + " to this line's existing `null`. #1749.",
    ).toContain(": hasSubscription === false");
    expect(
      renewal,
      "the renewal line is back on a negated truthy read, which answers the unread state"
      + " as `no subscription`. #1749.",
    ).not.toContain("!hasSubscription");
    expect(
      renewal,
      "the interval-switch branch no longer requires the fact to be KNOWN true. #1749.",
    ).toContain("hasSubscription === true &&");
    /*
      ⚠ **RE-AIMED BY #1755, NOT WEAKENED, and this file carries the precedent
      in its own words one screen up**: *"an arm whose subject a founder ruling
      removes is not weakened, it is re-aimed at what still holds."*

      It pinned `planRead && !annual ?`. #1755 made the interval `boolean |
      null`, so `!annual` is `true` for the unread state — the same two meanings
      of false this family exists about, now visible in the type — and the
      condition says what it means: `annual === false`.

      **Both halves are still held and the reason for each is unchanged.**
      `planRead` stays because the two facts are genuinely different — an
      account with no subscription has a KNOWN monthly interval and still gets
      the nudge — and the interval test stays because a YEARLY subscriber must
      not be offered the yearly deal they already pay for.
    */
    expect(
      renewal,
      "the yearly nudge is no longer gated on the status having answered — so a YEARLY"
      + " subscriber is offered the yearly deal they already pay for, and after the fix"
      + " above it is the only text left in this paragraph. #664's own note on that"
      + " default says the toggle exists to stop exactly this. #1749, re-aimed by #1755.",
    ).toContain("planRead && annual === false ?");
    expect(
      renewal,
      "the nudge is back on `!annual`, which is TRUE for an unread interval — the"
      + " negation reads a null as monthly. #1755.",
    ).not.toContain("!annual");

    /* The money road. Sliced the same way, and from the LAST occurrence of the
       token so a comment quoting it cannot move the window. */
    const submitFrom = topup.lastIndexOf("const submit = () => {");
    expect(submitFrom, "`submit` is gone — #1749's arm cannot read it").toBeGreaterThan(-1);
    /*
      ⚠ **THE WINDOW IS ANCHORED ON CONTENT, NOT ON A CHARACTER COUNT — #1755.**
      It read `submitFrom + 400`, and a comment added INSIDE `submit` pushed the
      guard line past 400: the arm reddened over a function whose gate had
      gotten stricter, which is the same false red #1725 and #1749 each left
      behind in this file. `changePlan.mutate(` is the last statement of the
      function and sits AFTER the guard, so the slice still cannot reach a
      neighbour's identical line — which is the reason the count was there.
    */
    const submitEnd = topup.indexOf("changePlan.mutate(", submitFrom);
    expect(submitEnd, "`submit` no longer ends in a plan change").toBeGreaterThan(submitFrom);
    expect(
      topup.slice(submitFrom, submitEnd),
      "`submit` picks between BUYING a subscription and CHANGING one on a fact it may not"
      + " have. Unreachable while `quoteReady` needs the rung — which is exactly why it is"
      + " refused here rather than left to that gate. #1749.",
    ).toContain("hasSubscription === null");

    const change = read("features", "billing", "ChangePlanModal.tsx");
    expect(
      change,
      "Change plan's subscription fact is a plain boolean again. #1749.",
    ).toContain("const hasSubscription: boolean | null = status ? status.hasSubscription : null;");

    const actFrom = change.lastIndexOf("const act = (plan: LadderPlan) => {");
    expect(actFrom, "`act` is gone — #1749's arm cannot read it").toBeGreaterThan(-1);
    expect(
      change.slice(actFrom, actFrom + 400),
      "⚠ THE SHARPEST SITE IN THE SWEEP. `act` sends an account with no subscription to"
      + " Stripe CHECKOUT and a subscriber to the confirm step — so an unread subscriber"
      + " was on the checkout road, which creates a SECOND subscription instead of changing"
      + " the one they have. Unreachable today only because #1747 made the ladder decline"
      + " on a null rung and the plan buttons are not drawn; a wrong value behind a gate"
      + " becomes a wrong answer the day the gate moves. #1749.",
    ).toContain("hasSubscription === null) return;");
  });
});
