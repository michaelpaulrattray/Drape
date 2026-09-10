import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { showsMenuCount } from "@/foundation/menuCount";
import { readFlagCounts } from "./useModeratorFlagCounts";

/**
 * card 416 — THE ACCOUNT MENU'S TWO BADGES, WHICH WERE WIRED TO NOTHING.
 *
 * **His ask, 2026-09-01, verbatim:** *"the moderator pages should also have
 * notifications which show any flags thats come up that need attention. in the
 * profile drop down menu in the top bar next to admin and moderator the
 * notification count should sit next to each also e.g admin 4 or moderator 6"*
 *
 * # What went wrong, and why nothing was red
 *
 * `UserCard` DECLARED both counts, rendered a pill for each and omitted at
 * zero. `AppChrome` — its one call site — passed neither. They arrived
 * `undefined`, both pills omitted, and the badges never once showed a number.
 * Invariant 7 in its gentlest form: written, styled, rendered, **wired never.**
 *
 * ⚠ **EVERY ARM BELOW THAT COULD BE WRITTEN AS AN ABSENCE IS WRITTEN AS A
 * PRESENCE INSTEAD**, because the shipped state of this defect passes every
 * absence assertion there is. A test saying "the menu does not show a wrong
 * number" was green for the entire life of the bug.
 *
 * ⚠ **AND THE ARITHMETIC IS DRIVEN, NOT GREPPED.** `pnpm test` runs with no DOM
 * by config, so the hook cannot be rendered here — which is exactly why the
 * part that can be wrong was pulled out into `readFlagCounts`. Grepping the
 * hook's source for a `?? 0` would be a guard on a spelling.
 *
 * ⚠ **The titles say "card 416" rather than the hash form on purpose** — a
 * three-digit hex in a `describe` STRING reads to `token-guard.test.ts` as a
 * colour literal on a guarded staff file, and exempting a whole file to spare
 * four characters blinds that guard to everything else in it. Same prescription
 * `counts415-guard.test.ts` records.
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..", "..");
const SERVER = path.resolve(HERE, "..", "..", "..", "..", "server");
const read = (relative: string) => fs.readFileSync(path.resolve(CLIENT_SRC, relative), "utf8");

/** Strip comments, so a docblock explaining a rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Every non-test source file under a root, walked rather than listed. */
function sources(root: string): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (/\.test\.tsx?$/.test(entry.name)) continue;
      out.push({
        name: path.relative(root, full).replace(/\\/g, "/"),
        text: fs.readFileSync(full, "utf8"),
      });
    }
  };
  walk(root);
  return out;
}

describe("card 416 — the counts are DRIVEN, with non-zero numbers", () => {
  it("reads the referral count off the unbounded total, not off the page it asked for", () => {
    /*
      ⚠ THE HOOK ASKS FOR ONE ROW. If the count came off the returned page's
      length this would read 1 while seven referrals sat flagged — a badge
      quietly capped at whatever page size somebody chose, which is a wrong
      number rather than a missing one. The procedure computes its total with
      its own COUNT(*), separately from the page.
    */
    const counts = readFlagCounts({ items: [{ id: 9 }], total: 7 } as never, { users: [] });
    expect(counts.flaggedReferrals).toBe(7);
    expect(counts.total).toBe(7);
    expect(showsMenuCount(counts.total), "seven flagged referrals must draw a pill").toBe(true);
  });

  it("reads the discrepancy count off the flagged accounts, never off scannedCount", () => {
    /*
      ⚠ `scannedCount` is how many accounts were EXAMINED. On production today
      it is 4 while exactly 1 account is flagged, so this confusion produces a
      badge that is never zero and therefore says nothing — the same defect the
      hook's docblock rejects audit volume for.
    */
    const counts = readFlagCounts({ total: 0 } as never, {
      users: [{ userId: 1 }, { userId: 2 }],
      scannedCount: 400,
    } as never);
    expect(counts.flaggedDiscrepancies).toBe(2);
    expect(counts.total).toBe(2);
  });

  it("sums the two sources — the badge is one number for both kinds of flag", () => {
    const counts = readFlagCounts({ total: 4 } as never, {
      users: [{ userId: 1 }, { userId: 2 }],
    } as never);
    expect(counts).toEqual({ flaggedReferrals: 4, flaggedDiscrepancies: 2, total: 6 });
    expect(showsMenuCount(counts.total)).toBe(true);
  });

  it("is 0 — not NaN — while both queries are unanswered, so the pill omits rather than lies", () => {
    /*
      ⚠ A NaN total is FALSE against a greater-than test, so a dropped fallback
      omits the pill and looks exactly like the correct loading state. It would
      only show itself on the day the badge was supposed to say something.
    */
    const counts = readFlagCounts(undefined, undefined);
    expect(counts).toEqual({ flaggedReferrals: 0, flaggedDiscrepancies: 0, total: 0 });
    expect(Number.isNaN(counts.total)).toBe(false);
    expect(showsMenuCount(counts.total), "nothing known yet draws NO pill").toBe(false);
  });

  it("draws no pill when both sources have answered zero", () => {
    const counts = readFlagCounts({ total: 0 } as never, { users: [], scannedCount: 4 } as never);
    expect(counts.total).toBe(0);
    expect(showsMenuCount(counts.total)).toBe(false);
  });
});

describe("card 416 — the call site passes both props", () => {
  it("AppChrome hands UserCard both counts", () => {
    /*
      ⚠ THIS IS THE DEFECT ITSELF, ASSERTED AS A PRESENCE. For the whole life of
      the bug this file rendered the account menu correctly, with four handlers
      and a role, and simply never named these two. Nothing else in the suite
      could see it.
    */
    const chrome = code(read("components/AppChrome.tsx"));
    const start = chrome.indexOf("<UserCard");
    expect(start, "AppChrome still renders the account menu").toBeGreaterThan(-1);
    const element = chrome.slice(start, chrome.indexOf("/>", start));
    expect(element, "the Admin badge is handed a number").toMatch(/adminCount=\{/);
    expect(element, "the Moderation badge is handed a number").toMatch(/moderationCount=\{/);
  });

  it("UserCard is still the ONE consumer of those props, so one wire is the whole fix", () => {
    const consumers = sources(CLIENT_SRC)
      .filter(({ text }) => /<UserCard\b/.test(code(text)))
      .map(({ name }) => name)
      .sort();
    expect(
      consumers,
      "A second call site renders the account menu. It must pass the counts too,\n" +
        "or one of the two menus goes back to showing nothing:\n" +
        consumers.join("\n"),
    ).toEqual(["components/AppChrome.tsx"]);
  });

  it("the counts reach the menu through a composer that issues no query of its own", () => {
    /*
      ⚠ NOT STYLE. `counts415-guard` derives from the tree that exactly ONE
      module both names the pending count and calls tRPC. `AppChrome` calls tRPC
      for credits and profile, so reading the field there would have reddened
      that arm — and the tempting repair is to widen the arm's expected list,
      which turns a derived guard back into the hand-kept list it replaced.
    */
    const composer = code(read("features/staff/useAccountMenuCounts.ts"));
    expect(composer, "the composer names the shared admin fact").toMatch(/pendingChangeRequests/);
    expect(composer, "and fetches nothing itself — it composes hooks").not.toMatch(/\btrpc\./);

    const chrome = code(read("components/AppChrome.tsx"));
    expect(
      chrome,
      "AppChrome must not name the pending count; it calls tRPC, so naming it\n" +
        "would make it a second reader by the derived arm in counts415-guard.",
    ).not.toMatch(/pendingChangeRequests/);
  });
});

describe("card 416 — one threshold, not two", () => {
  it("exactly one module declares the discrepancy default", () => {
    /*
      The badge counts at the default and the card OPENS on it. Two literals
      would drift the moment one moved — working law 4, with a money-adjacent
      number in it. Derived from the tree so a third copy reddens this.
    */
    const declarers = sources(CLIENT_SRC)
      .filter(({ text }) => /DEFAULT_DISCREPANCY_THRESHOLD\s*=/.test(code(text)))
      .map(({ name }) => name)
      .sort();
    expect(
      declarers,
      "More than one module declares the threshold:\n" + declarers.join("\n"),
    ).toEqual(["features/moderator/flagThresholds.ts"]);
  });

  it("the card and the hook both import it rather than writing a number", () => {
    const card = code(read("features/moderator/FlaggedDiscrepanciesCard.tsx"));
    expect(card).toMatch(/DEFAULT_DISCREPANCY_THRESHOLD/);
    expect(card, "the card no longer holds its own literal").not.toMatch(/=\s*500\b/);

    const hook = code(read("features/staff/useModeratorFlagCounts.ts"));
    expect(hook).toMatch(/threshold:\s*DEFAULT_DISCREPANCY_THRESHOLD/);
  });

  it("the SERVER declares no default of its own for the threshold", () => {
    /*
      ⚠ THE ARM THAT WAS MISSING, AND THE GATE REVIEW OF PR #463 FOUND ITS
      ABSENCE. The two arms above walk `client/src` only — so
      `moderatorReconciliation.getFlaggedUsers` could declare its own
      `.default(50)` one layer down, disagreeing with the product's 500, and
      every single-source arm here stayed green. It did exactly that.

      That is working law 4 on the exact number this card consolidated, and the
      guard could not see it. **A single-source guard that walks one tree is a
      guard on one tree.**

      It asserts NO default rather than a matching one on purpose: the shared
      constant lives under `client/`, which server code must not import, so an
      "aligned" server default would be a FOURTH copy — the same defect wearing
      the right number. Required is the only state with no second source in it.

      ⚠ Safe to require because it was read at the bytes first, not assumed:
      `git log -S` over `client/src` returns four commits touching this call and
      every one of them sends the field, from the commit that created the
      procedure onward. The default has never once been reached.
    */
    const router = fs.readFileSync(
      path.join(SERVER, "routes", "moderatorReconciliation.ts"),
      "utf8",
    );
    const start = router.indexOf("getFlaggedUsers:");
    expect(start, "the procedure still exists under this name").toBeGreaterThan(-1);
    const procedure = code(router.slice(start, router.indexOf(".query(", start)));

    expect(procedure, "the threshold input is still declared").toMatch(/threshold:\s*z\.number\(\)/);
    expect(
      procedure,
      [
        "The server declares its own default for the threshold. The product",
        "declares it once, in features/moderator/flagThresholds.ts, and a second",
        "one here is invisible to every arm that walks client/src.",
        "Make the field REQUIRED rather than aligning the number — the constant",
        "is client-side, so an aligned copy here would be a fourth source.",
      ].join("\n"),
    ).not.toMatch(/threshold:[^,\n]*\.default\(/);
  });

  it("the default is one of the lenses the card offers", () => {
    /*
      A default outside the chip row would render a card whose current setting
      no chip shows as pressed — a control that cannot describe its own state.
    */
    const source = code(read("features/moderator/flagThresholds.ts"));
    const list = source.match(/DISCREPANCY_THRESHOLDS\s*=\s*\[([^\]]+)\]/);
    expect(list, "the lens list is declared").not.toBeNull();
    const values = list![1].split(",").map((n) => Number(n.trim()));
    const fallback = source.match(/DEFAULT_DISCREPANCY_THRESHOLD\s*=\s*(\d+)/);
    expect(fallback, "the default is declared").not.toBeNull();
    expect(values).toContain(Number(fallback![1]));
  });
});

describe("card 416 — the moderator hook sets no option that reaches another surface", () => {
  it("both queries set only observer-scoped options", () => {
    /*
      ⚠ THE DEFECT THIS CATCHES ALREADY SHIPPED ONCE, on #415's hook, and the
      gate review found it. Retry and its family are FETCH-level: TanStack
      resolves them from the LAST observer on a key. `getFlaggedUsers` is
      observed by `FlaggedDiscrepanciesCard` at this same key and this hook
      mounts inside the page that renders it — so a fetch-level option set here
      changes that card's behaviour on the moderator dashboard.

      ⚠ **THIS ARM USED TO ASSERT `keys === ["staleTime"]`, AND #752 IS WHY IT NO
      LONGER DOES — the change is a TIGHTENING, not a relaxation.** An exact list
      of one pins the CONTENTS of this hook; the rule it exists to protect is
      about the SCOPE of an option. Those came apart the moment a second
      observer-scoped option was genuinely correct here: #752 adds
      `refetchInterval` so a flag raised while a moderator sits still reaches her
      badge, and `refetchInterval` is observer-scoped — each observer keeps its
      own timer, so the card's poll is untouched.

      Under the old shape the only way to land that was to edit the expected list
      to `["refetchInterval", "staleTime"]`, which would have gone green for a
      FETCH-level option added next year just as readily. The allowlist below
      names the scope instead, so an unrecognised option still reddens — which is
      the behaviour the note above actually promises — and a fetch-level one is
      refused BY NAME with the reason attached.

      An option not on either list reddens on purpose: it may well be correct,
      and it must be checked against every consumer of the key before it lands.
    */
    /**
     * Resolved PER OBSERVER by TanStack — each observer keeps its own, so
     * setting one here cannot reach `FlaggedDiscrepanciesCard`.
     */
    const OBSERVER_SCOPED = [
      "enabled",
      "notifyOnChangeProps",
      "placeholderData",
      "refetchInterval",
      "refetchOnMount",
      "refetchOnReconnect",
      "refetchOnWindowFocus",
      "select",
      "staleTime",
    ];
    /*
      Resolved from the LAST observer to set them — they live on the Query, not
      the observer — so setting one here reaches `FlaggedDiscrepanciesCard`.
      Named rather than left to the catch-all so the failure says WHY, not just
      "unexpected key".

      ⚠ **This list is the one `counts415-guard.test.ts` already names in its own
      failure message** (`retry, retryDelay, networkMode, gcTime,
      structuralSharing`) — kept in agreement with it deliberately, and the first
      draft of this arm disagreed with it in both directions: it had
      `refetchOnWindowFocus` here (it is observer-scoped — each observer decides
      for itself whether a focus event refetches) and omitted
      `structuralSharing` (which is fetch-level). Both are corrected above. The
      two guards ask different questions — that one pins its hook's options
      exhaustively, this one classifies by scope — so they are not a mirrored
      list in working law 4's sense; where they overlap they must still agree.
    */
    const FETCH_LEVEL = ["gcTime", "networkMode", "retry", "retryDelay", "structuralSharing"];

    const hook = code(read("features/staff/useModeratorFlagCounts.ts"));
    const optionBlocks = Array.from(hook.matchAll(/\{\s*(enabled,[^}]*)\}/g)).map((m) => m[1]);
    expect(optionBlocks.length, "both queries pass an options object").toBe(2);
    for (const block of optionBlocks) {
      const keys = Array.from(block.matchAll(/([A-Za-z]+):\s/g))
        .map((m) => m[1])
        .sort();

      const fetchLevel = keys.filter((k) => FETCH_LEVEL.includes(k));
      expect(
        fetchLevel,
        [
          "FETCH-level option(s) set on a SHARED query key: " + fetchLevel.join(", "),
          "TanStack resolves these from the last observer to set them, not per",
          "observer — so this reaches FlaggedDiscrepanciesCard on the moderator",
          "dashboard, which observes getFlaggedUsers at this same key.",
          "This exact defect shipped once already (#415, PR #456).",
        ].join("\n"),
      ).toEqual([]);

      const unknown = keys.filter((k) => !OBSERVER_SCOPED.includes(k));
      expect(
        unknown,
        [
          "Option(s) this guard does not classify: " + unknown.join(", "),
          "Before adding one, check it against EVERY consumer of this query key",
          "— `FlaggedDiscrepanciesCard` observes getFlaggedUsers here too. If it",
          "is resolved per observer, add it to OBSERVER_SCOPED with the reason.",
          "If TanStack resolves it from the last observer, it does not belong in",
          "this hook at all; add it to FETCH_LEVEL so the next reader is told.",
        ].join("\n"),
      ).toEqual([]);

      expect(keys, "every query still sets staleTime: " + keys.join(", ")).toContain("staleTime");
      /*
        ⚠ AND THE POLL ITSELF IS PINNED, ON BOTH QUERIES (#752). Without this the
        arms above are all satisfied by a hook that has no `refetchInterval` at
        all — which is precisely the state #752 was filed about, and every
        absence-only assertion is green against it.

        The SHARED switch and the SHARED constant, never a literal: a `30_000`
        here would be a fifth reader of a number the panel's own label states,
        which is #455's defect. Same shape as `useStaffCounts` under #457.
      */
      expect(
        block,
        "a flag raised while she sits still must reach her badge (#752): " + block,
      ).toMatch(/refetchInterval:\s*autoRefresh\s*\?\s*STAFF_REFRESH_INTERVAL_MS\s*:\s*false/);
    }

    expect(hook, "the switch is the shared store, not a local useState").toMatch(
      /useStaffAutoRefresh\(\)/,
    );
    expect(hook, "the interval is imported, never written as a literal").not.toMatch(
      /refetchInterval:[^,\n]*\d{2,}/,
    );
  });

  it("the query is gated to the roles that may ask it", () => {
    /*
      Both procedures are `moderatorProcedure` and would refuse anyone else. The
      gate is about not spending two round trips per customer render learning
      something the client already knows — and admins are IN, because admins
      inherit the entire moderator surface (the capability grid).
    */
    const hook = code(read("features/staff/useModeratorFlagCounts.ts"));
    /*
      #699 — this arm used to match the two role literals HERE, which pinned
      the SPELLING of a rule rather than the rule. The rule now lives in
      `staffRole.ts` and is driven (`staffRole.test.ts` proves moderator and
      admin are admitted and everything else refused, and the extraction is
      sabotage-proven). What this arm still owns, and what it should always
      have owned, is that THIS hook asks the shared rule about THIS user —
      the argument is half the assertion, since `isStaffRole(undefined)` would
      typecheck and gate the query to nobody.
    */
    expect(hook).toMatch(/isStaffRole\(user\?\.role\)/);
    expect(hook).toMatch(/enabled\s*=\s*isAuthenticated\s*&&\s*isStaff/);
  });
});
