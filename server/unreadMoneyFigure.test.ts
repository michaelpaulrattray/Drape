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
 * ⚠ **A CHARGE NOBODY HAS READ YET IS NOT A CHARGE OF ZERO — #1725, and it is
 * #1703 ONE NOUN OVER.**
 *
 * # What a customer was told
 *
 * Open **Add credits** on a subscription and the pane said **"$0.00 due
 * today"**, in a 30px tabular figure, for the beat the quote was in flight.
 * Driven on the dev subscriber fixture before the fix, both themes: the figure
 * that replaced it was **$852.33**. `preview?.immediateCharge ?? 0` — the query
 * was in flight, `preview` was `undefined`, and the default printed a confident
 * price on the one line of the surface that states a price.
 *
 * # Why a second guard rather than a wider regex on the first
 *
 * `creditBalanceLoadingState.test.ts` (#1703, the day before) bans this exact
 * idiom for the noun **balance** and its docblock says the ban is on the IDIOM
 * rather than on a list of files. It still could not see this one: the regex is
 * `\w*balance\w*`, and a charge is not a balance. **The idiom was right and the
 * NOUN was the scope** — so this is its sibling for the price family, written
 * as a separate suite because the two have different remainders and a shared
 * one would have to be read twice to know which.
 *
 * # What it bans, and what it deliberately does not
 *
 * One idiom, under `client/src` only: a **charge, price, cost, amount, fee,
 * refund or cents figure** defaulted to **0** by `??` or `||`. In the render
 * layer a zero price is a real and different fact from a price not yet read,
 * and the only way to say the second is to keep it `null` and let the surface
 * decline to claim anything — an em dash in the figure's own slot, which is
 * what `BoardHeader`, `UserCard` and `StudioSlimHeader` already draw.
 *
 * ⚠ **THE CREDIT-GRANT NOUNS ARE NOT IN THIS BAN AND THAT IS A STATED LIMIT,
 * NOT AN OVERSIGHT.** `allowance`, `earned`, `reward` and `creditsAwarded` are
 * figures a customer reads and three of them are defaulted to zero today
 * (`features/settings/ReferralBlock.tsx`, `features/settings/AccountSurfaces.tsx`).
 * They are a third noun group with their own surfaces and their own frames, and
 * they are carded rather than swept in here — see `DECLARED` below.
 *
 * ⚠ **AND THE FLOOR IS THE SAME ONE #1703 STATED: this is the measured IDIOM,
 * not a proof of the property.** A surface can still reach a rendered zero
 * another way — a `Math.max(0, …)`, a prop typed `number` fed by something
 * zero before it is known. What this holds is that the shape which printed
 * `$0.00` over a real `$852.33` cannot come back unannounced.
 */

const CLIENT_SRC = path.resolve(__dirname, "..", "client", "src");

/**
 * A money figure defaulted to zero. The capture is the identifier, so the
 * declaration below can key on something stable across reformatting rather than
 * on a line number that moves whenever a docblock above it grows.
 *
 * `?? null` — the repair — is not matched, and neither is a `0` that is a real
 * literal elsewhere on the line.
 */
const MONEY_DEFAULTED_TO_ZERO =
  /(\w*(?:charge|price|cost|amount|due|fee|refund|cents)\w*)\s*(?:\?\?|\|\|)\s*0\b/i;

/**
 * ⚠ **THE MEASURED REMAINDER, AND IT ONLY SHRINKS.**
 *
 * Every site the walk finds must be on this list with a reason, and every entry
 * on this list must still be findable — so fixing one means DELETING its line,
 * and a new one anywhere under `client/src` reddens with no edit needed here.
 * That is the `KNOWN_DEBTS` shape the capability atlas already uses, and it is
 * the reason this guard can ship before the whole class is repaired instead of
 * waiting for a diff nobody would want to review in one piece.
 *
 * Two verdicts, and they are not the same claim:
 *
 *  - **`safe`** — the zero cannot reach a customer, and the entry names the
 *    gate that stops it. An arm below holds each of those gates to still being
 *    there, because an exemption that only says "this one is fine" rots the
 *    moment somebody moves the thing it leans on.
 *  - **`debt`** — a real instance of #1725's defect, measured, on another
 *    feature's surface, carded rather than fixed here. Each needs its own
 *    frames in both themes, which is why they are not folded into a card about
 *    the Add-credits modal (his rule of 2026-10-01: a finding that is not this
 *    card's work is its own card).
 */
const DECLARED: ReadonlyArray<{
  readonly file: string;
  readonly symbol: string;
  readonly verdict: "safe" | "debt";
  readonly why: string;
  /** For `safe`: the verbatim gate the exemption rests on, held by its own arm. */
  readonly gate?: string;
}> = [
  {
    file: "features/billing/AddCreditsModal.tsx",
    /* The capture is the identifier the default sits on — `…?.price ?? 0` —
       rather than the `currentPrice` it is assigned to. */
    symbol: "price",
    verdict: "safe",
    why:
      "`currentPrice` is never formatted. Its only reader is the `up from` clause, which is drawn"
      + " solely when the figure is above zero — so an unread catalogue omits the"
      + " clause rather than quoting a price of nothing, which is #1703's own"
      + " `a sentence renders nothing` convention.",
    gate: "currentPrice > 0",
  },
  {
    file: "pages/CastingSheet.tsx",
    symbol: "priceCredits",
    verdict: "safe",
    why:
      "The per-slice figure is converted to `undefined` before it travels, so a"
      + " zero draws no price at all rather than a price of zero.",
    gate: "const retryPrice = sliceCredits > 0 ? sliceCredits : undefined;",
  },
  {
    file: "features/studio/components/CastModelModal.tsx",
    symbol: "cost",
    verdict: "safe",
    why:
      "Not a figure on its way to a customer: the `?? 0` feeds a `> 0` predicate"
      + " that decides whether a tier generates at all. An unread catalogue makes"
      + " it false, which draws no claim about money either way.",
    gate: "(tiers?.[tier]?.cost ?? 0) > 0",
  },
  {
    file: "features/casting/components/PackageHealthDialog.tsx",
    symbol: "cost",
    verdict: "debt",
    why:
      "#1727 — three sites, and all three put the figure on a PAID BUTTON:"
      + " `Refresh all · 0 credits` and `Preview · 0 credits` while the plan"
      + " query is in flight.",
  },
  {
    file: "features/settings/AccountSurfaces.tsx",
    symbol: "price",
    verdict: "debt",
    why:
      "#1727 — `planPriceInCents` reaches the settings and billing panes, so a"
      + " paying customer reads their plan as costing nothing for the beat"
      + " `getStatus` is in flight. #1703 fixed `balance` on the line beside it.",
  },
  {
    file: "pages/CastingSheet.tsx",
    symbol: "signPriceCredits",
    verdict: "debt",
    why: "#1727 — the Sign price, on the paid button, before `config` answers.",
  },
  {
    file: "pages/CastingSheet.tsx",
    symbol: "refinePriceCredits",
    verdict: "debt",
    why: "#1727 — the Refine price, on the paid button, before `config` answers.",
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
  readonly printers: number;
} {
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
    /* The positive half of the floor: a file that formats money or a price for
       a customer is one this walk must be able to see into. */
    if (code.includes("formatDollars(") || code.includes("displayPrice(")) printers += 1;
    code.split("\n").forEach((text, index) => {
      const hit = MONEY_DEFAULTED_TO_ZERO.exec(text);
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
  return { offences: found, read, printers };
}

/** A declaration matches an offence on the pair, never on a line number. */
const keyOf = (o: { file: string; symbol: string }) => `${o.file}::${o.symbol}`;

describe("a charge nobody has read yet is not a charge of zero (#1725)", () => {
  /**
   * ⚠ THE FLOOR COMES FIRST, because for a guard whose verdict is "nothing new
   * under `client/src` does this", **reading less IS passing**. A walk that
   * resolved the wrong root, or silently skipped every file, is
   * indistinguishable from a clean tree — and this repository has shipped
   * exactly that twice.
   */
  it("reads the client tree, and can see into the files that print money", () => {
    const { read, printers } = scan();
    expect(read, "the walk found almost no client source — check the root, not the tree").toBeGreaterThan(200);
    expect(
      printers,
      "the walk cannot see a single call to `formatDollars` or `displayPrice` — a verdict"
      + " about prices rendered from a walk that cannot find one is a vacuous pass",
    ).toBeGreaterThan(3);
  });

  /**
   * The ban itself. A new site, anywhere under `client/src`, needs no edit here
   * to be caught — which is the half that makes this a guard rather than a
   * record of one afternoon.
   */
  it("no undeclared client surface defaults a money figure to zero", () => {
    const declared = new Set(DECLARED.map(keyOf));
    expect(
      scan()
        .offences.filter((o) => !declared.has(keyOf(o)))
        .map((o) => `${o.file}:${o.line}  ${o.text}`),
      "a charge, price or cost is defaulted to 0 where it is not yet known. A zero price and"
      + " an unread price are opposite facts on a money surface: keep it `null` and let the"
      + " surface decline to claim anything — the Add credits figure draws an em dash in its"
      + " own slot, so nothing below it moves when the real charge lands. If this site is"
      + " genuinely unreachable as a loading zero, add it to DECLARED with the gate that"
      + " makes it so. #1725.",
    ).toEqual([]);
  });

  /**
   * ⚠ **AND THE LIST ONLY SHRINKS.** A declaration whose site is gone is a line
   * that would otherwise sit here forever, quietly licensing a shape nobody
   * writes any more — and, worse, licensing it again if somebody reintroduces
   * it under the same name. Fixing one of these means deleting its entry.
   */
  it("every declared site is still there, so the list cannot outlive its reasons", () => {
    const live = new Set(scan().offences.map(keyOf));
    expect(
      DECLARED.filter((entry) => !live.has(keyOf(entry))).map((entry) => `${entry.file}::${entry.symbol}`),
      "a DECLARED site no longer defaults a money figure to zero — delete its entry."
      + " A standing exemption for code that is gone is how a ban comes to cover less"
      + " than it claims. #1725.",
    ).toEqual([]);
  });

  /**
   * Each `safe` verdict leans on a gate in the same file, and the gate is held
   * rather than described. Move the gate and this reddens — which is the moment
   * the `?? 0` beside it genuinely becomes a loading zero. (#1703 holds its one
   * exemption the same way, and the reason is the same: `spendWindowCopy` put a
   * guarded thing and an unguarded thing on one line and no review caught it.)
   */
  it("every safe verdict still rests on the gate it names", () => {
    for (const entry of DECLARED) {
      if (entry.verdict !== "safe" || !entry.gate) continue;
      const source = readListedSource(path.join(CLIENT_SRC, entry.file));
      expect(source, `${entry.file} is gone — re-read the exemption, do not delete the arm`).not.toBeNull();
      expect(
        withoutComments(source ?? ""),
        `${entry.file} no longer carries the gate that makes its \`${entry.symbol}\` default`
        + ` safe, so that default is now a loading zero on a money surface. Either restore`
        + ` the gate or fix the default and drop the exemption. #1725.`,
      ).toContain(entry.gate);
    }
  });

  /**
   * The positive control on the fix itself: the figure this card was filed
   * about must draw an em dash rather than a formatted zero. The ban above
   * catches a restored `?? 0`; this catches the other way of reopening it —
   * keeping the `null` and formatting it anyway.
   */
  it("the Add credits figure declines to name a price it has not been told", () => {
    const source = readListedSource(
      path.join(CLIENT_SRC, "features", "billing", "AddCreditsModal.tsx"),
    );
    const code = withoutComments(source ?? "");
    expect(
      code,
      "the `due today` figure no longer draws an em dash while the charge is unknown."
      + " It printed `$0.00` over a real $852.33 before #1725.",
    ).toContain('{dueToday !== null ? formatDollars(dueToday) : "—"}');
    expect(
      code,
      "the button's price is no longer gated on the figure existing, so it can state a"
      + " charge the surface does not have. #1725.",
    ).toContain("quoteReady && dueToday !== null");
  });

  /**
   * ⚠ **BOTH BRANCHES OF THE TERNARY, AND THE SECOND ONE WAS A MEASURED HOLE IN
   * THIS VERY SUITE.**
   *
   * `dueToday` has two branches and only the subscriber's is written with `??`.
   * The checkout branch ends `: null` — a bare ternary fallback, which the
   * `MONEY_DEFAULTED_TO_ZERO` regex cannot see because there is no `??` or `||`
   * in front of the zero. **Driven after #1725 merged**: flipping that one
   * token back to `: 0` restored the full defect — a customer with no plan
   * catalogue reads `$0.00 due today` under a pressable `Add credits · $0.00`,
   * because `dueToday` is then `0` rather than `null` and `quoteReady` opens —
   * **and all five arms stayed green.**
   *
   * The review had read that limit as covered by the two assertions above. It
   * is not: neither of them moves when only this branch flips. So the shape of
   * the whole declaration is held here, which is the one reading that does.
   *
   * It is deliberately a FILE-SPECIFIC arm rather than a widened regex. "A
   * money-named identifier whose ternary fallback is zero" is not a shape a
   * line-wise walk can judge — the branches sit on different lines, and a
   * regex loose enough to catch it would redden on every `: 0` in the tree.
   * The ban stays the idiom; this holds the one surface it was written for.
   */
  it("the Add credits figure keeps BOTH of its branches unknown-until-read", () => {
    const source = readListedSource(
      path.join(CLIENT_SRC, "features", "billing", "AddCreditsModal.tsx"),
    );
    expect(
      withoutComments(source ?? ""),
      "`dueToday` no longer holds `null` on both branches. The checkout branch's fallback is"
      + " a bare ternary `: 0`, which the idiom ban cannot see — and a zero there is the same"
      + " $0.00 the subscriber branch was fixed for, under a button that looks pressable."
      + " #1725.",
    ).toMatch(
      /const dueToday: number \| null = hasSubscription\s*\?\s*\(preview\?\.immediateCharge \?\? null\)\s*:\s*selected[\s\S]{0,160}?:\s*null;/,
    );
  });
});
