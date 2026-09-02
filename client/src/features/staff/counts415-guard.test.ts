import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { adminSegments } from "./StaffBar";

/**
 * #415 — THE COUNT PILL AND CREW'S FOLD-IN.
 *
 * **His two asks, 2026-09-01, verbatim:**
 *
 * > *"the notification button needs to count any requests sent from moderators
 * > to admin. e.g if mods sent 5 requests to the admin panel it shold show 5
 * > requests pending …"*
 *
 * > *"even thought crew has its own refresh principles should we just fold it
 * > into the same as overview so everything is consistent"*
 *
 * # What these arms are actually defending
 *
 * The card's own bar names two failures, and both are the kind that ship green:
 *
 * 1. **A badge that renders nothing forever.** The account-menu badges (#416)
 *    are the worked specimen — declared, styled, rendered, and handed no props
 *    by their one call site, so they have never once shown a number. Nothing is
 *    broken on screen and no test is red. **An absence-only assertion is green
 *    in exactly that state**, so every arm about the pill here is DRIVEN with a
 *    non-zero count.
 * 2. **A second reader of one fact.** A bar saying `5` over a card saying `4`
 *    is worse than a bar saying nothing (working law 4). The `oneReader`
 *    describe below is derived from the tree, so a second counter appearing
 *    anywhere reddens it without anyone remembering to update a list.
 *
 * ⚠ **THE TITLES BELOW SAY "card 415" RATHER THAN "#415", AND THAT IS THE
 * TOKEN GUARD, NOT A STYLE.** `#415` is a valid three-digit hex, a `describe`
 * title is a STRING rather than a comment, and `token-guard.test.ts` strips
 * comments before it looks — so the card number in a title reads to it as a
 * colour literal on a guarded staff file. Its own documented prescription is to
 * move the reference into a comment, which is what this docblock is;
 * **the carve-out was deliberately NOT taken**, because exempting a whole file
 * to spare four characters blinds the colour guard to everything else in it.
 *
 * ⚠ **The pill's own PIXELS are not proven here and cannot be** — `pnpm test`
 * runs with no DOM by config. What is proven here is the segment a bar would be
 * given; that it draws as a pill in both themes is the browser drive's job, and
 * the frames are in `docs/specs/STAFF_COUNT_PILL_415_EVIDENCE.md`.
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
      if (/\.(test|spec)\.tsx?$/.test(entry.name)) continue;
      out.push({ name: path.relative(root, full).replace(/\\/g, "/"), text: fs.readFileSync(full, "utf8") });
    }
  };
  walk(root);
  return out;
}

const CHANGE_REQUESTS = "/admin/change-requests";

describe("card 415 — the count pill is DRIVEN, never merely absent", () => {
  it("five pending requests put a 5 on Change requests and on nothing else", () => {
    /*
      ⚠ THE POSITIVE CONTROL, and it is the whole reason `adminSegments` was
      pulled out of the component. His sentence is the fixture: *"if mods sent
      5 requests to the admin panel it shold show 5 requests pending"*.
    */
    const segments = adminSegments({ crewVisible: false, pendingChangeRequests: 5 });

    const counted = segments.filter((s) => s.count !== undefined && s.count !== 0);
    expect(counted.map((s) => s.value)).toEqual([CHANGE_REQUESTS]);
    expect(counted[0]?.count).toBe(5);
  });

  it("zero pending requests draw no pill — omitted, never `(0)`", () => {
    /*
      His rule, in the brief and in the foundation: *"Omitted at zero, never
      `(0)`"*. This arm proves the value reaching the renderer is falsy; the arm
      below proves the renderer is the thing that acts on it.
    */
    const segments = adminSegments({ crewVisible: false, pendingChangeRequests: 0 });
    expect(segments.every((s) => !s.count)).toBe(true);
  });

  it("omit-at-zero is enforced where the pill is DRAWN, not at this caller", () => {
    /*
      ⚠ A RULE HELD AT EACH CALLER IS A RULE THAT HOLDS UNTIL THE NEXT CALLER.
      `adminSegments` passes `0` through unchanged on purpose — `segmentBody`
      decides. If that gate ever moved out of the foundation, the next surface
      to carry a pill would have to remember the rule, and the one before it
      would keep working, which is how a convention rots invisibly.
    */
    const primitives = code(read("foundation/primitives.tsx"));
    expect(primitives).toMatch(/option\.count\s*\?\s*<span className="dp-segmented__count">/);
  });

  it("the pill follows the ROUTE through a reorder, never an index", () => {
    /*
      ⚠ **AN EARLIER DRAFT OF THIS COMMENT CLAIMED THE INDEX FORM IS ALREADY
      BROKEN TODAY, AND THAT WAS FALSE** — the sabotage driver caught it by
      failing to break anything. `CREW_TAB_INDEX` is 2, so Crew splices in
      AFTER Change requests and `index 1` is Change requests either way. The
      claim was written from the shape of the code rather than read off it,
      which is the mistake this repository names most often; it is kept here
      rather than quietly deleted.

      **The real reason is the reorder, and it is enough.** The list above is
      "the founder's §5 order" — an order he has already changed once and may
      change again, and #416 adds a second counted tab. On the day either
      happens, a positional pill moves onto the wrong tab silently, because
      nothing about a number sitting beside the wrong word looks broken.

      Both arms are driven, and the assertion is that the ANSWER does not move
      when the list around it does.
    */
    const without = adminSegments({ crewVisible: false, pendingChangeRequests: 3 });
    const with_ = adminSegments({ crewVisible: true, pendingChangeRequests: 3 });

    expect(with_.length).toBe(without.length + 1);
    expect(with_.some((s) => s.value === "/admin/crew")).toBe(true);

    for (const segments of [without, with_]) {
      const carrying = segments.filter((s) => s.count).map((s) => s.value);
      expect(carrying).toEqual([CHANGE_REQUESTS]);
    }
  });

  it("every segment is still a ROUTE — the pill did not cost the deep links", () => {
    /*
      Brief 05 §6: the admin sections ARE seven URLs. A `count` added to the
      segment type must not tempt anyone into rebuilding them as local state.
    */
    const segments = adminSegments({ crewVisible: true, pendingChangeRequests: 2 });
    expect(segments.every((s) => s.href === s.value)).toBe(true);
  });
});

describe("card 415 — ONE reader of the pending-request count", () => {
  it("exactly one module in the product COUNTS pending change requests", () => {
    /*
      ⚠ DERIVED FROM THE SERVER TREE, so a second counter reddens this without
      anyone remembering a list exists. This is the arm the card asked for in
      those words: *"proven by a test that would fail if a second reader
      appeared"*.

      The one producer is `getGovernanceMetrics`. The pill, Overview's
      `NeedsHuman` card and its `GovernanceCard` tile all descend from that one
      call — three surfaces, one statement.
    */
    const producers = sources(SERVER)
      .filter(({ text }) => /pendingChangeRequests/.test(code(text)))
      .map(({ name }) => name)
      .sort();
    expect(
      producers,
      "More than one server module produces this count. Three admin surfaces\n" +
        "draw it and they must not be able to disagree:\n" +
        producers.join("\n"),
    ).toEqual(["db/adminOverviewQueries.ts"]);
  });

  it("exactly one module on the client reads it off a QUERY", () => {
    /*
      The distinction that matters: `GovernanceCard` and `NeedsHuman` MENTION
      the field, but they receive it as a prop from the page that already
      fetched it. Only a module that both calls tRPC and names the field is
      fetching this fact itself, and there must be one of those.
    */
    const fetchers = sources(CLIENT_SRC)
      .filter(({ text }) => {
        const body = code(text);
        return /pendingChangeRequests/.test(body) && /\btrpc\.[A-Za-z]/.test(body);
      })
      .map(({ name }) => name)
      .sort();
    expect(
      fetchers,
      "A second client module fetches the pending count for itself:\n" + fetchers.join("\n"),
    ).toEqual(["features/staff/useStaffCounts.ts"]);
  });

  it("the bar takes the number from the hook and issues no query of its own", () => {
    /*
      The bar renders on every admin page. A `trpc.` call appearing in it
      directly is how "read it once, high enough" quietly becomes a per-page
      query — the exact thing the card put out of scope.
    */
    const bar = code(read("features/staff/StaffBar.tsx"));
    expect(bar).toMatch(/useStaffCounts\(\)/);
    expect(bar, "the bar composes hooks; it does not fetch").not.toMatch(/\btrpc\./);
  });

  it("the hook returns 0 rather than a placeholder while the query is unanswered", () => {
    /*
      ⚠ THE ALTERNATIVE IS A BAR THAT FLASHES A NUMBER IT DOES NOT KNOW. `0`
      composes with omit-at-zero into "draw nothing until there is something to
      say", which is the honest state; `undefined` handling spread across
      callers would not be.
    */
    const hook = code(read("features/staff/useStaffCounts.ts"));
    expect(hook).toMatch(/query\.data\?\.governance\.pendingChangeRequests\s*\?\?\s*0/);
    expect(hook, "the bar must not fire this for non-admins on every render").toMatch(
      /enabled:\s*isAuthenticated\s*&&\s*user\?\.role\s*===\s*"admin"/,
    );
  });
});

describe("card 415 §3 — Crew states its freshness exactly once, and still names the shift", () => {
  const CREW = () => read("pages/AdminCrew.tsx");

  it("Crew is in the shared cluster — the bar's stamp, switch and manual button", () => {
    const crew = code(CREW());
    expect(crew).toMatch(/useStaffRefresh\(\{/);
    expect(crew).toMatch(/refreshControls=\{refreshControls\}/);
    /* The panel-wide switch, not a private copy — #453's rule, on the new page. */
    expect(crew).toMatch(/useStaffAutoRefresh\(\)/);
    expect(crew).not.toMatch(/useState\s*\(\s*(true|false)\s*\)[^\n]*autoRefresh/i);
  });

  it("the inline timestamp is GONE — the page does not say its freshness twice", () => {
    /*
      ⚠ THE HALF THAT HAD TO GO. #413 left Crew out of the cluster because it
      stated freshness inline; folding it in without deleting that line would
      have left the page saying when it last checked in two places, six inches
      apart, in two different notations (an absolute clock time in the bar, an
      elapsed "2 min ago" at the foot).

      POSITIVE CONTROL below: the line as it stood, so this arm is known to be
      able to see the thing it forbids.
    */
    const crew = code(CREW());
    const inlineStamp = /·\s*checked\s*\{checkedAgo\}/;
    expect(inlineStamp.test(crew), "Crew is stating its freshness twice again").toBe(false);
    expect(crew, "the elapsed-time formatter for the old stamp").not.toMatch(/checkedAgoOf/);

    const before = "{stateQuery.data.briefing.shift} · checked {checkedAgo}";
    expect(inlineStamp.test(before), "the line as it stood before card 415").toBe(true);
  });

  it("the SHIFT NAME survived, and that is the half the bar cannot say", () => {
    /*
      ⚠ THE QUIET COST THIS ARM EXISTS TO PREVENT. "Making it consistent" is a
      sentence that deletes things, and the founder's own reason for reading
      this page is knowing WHO wrote the briefing — authorship, not freshness.
      The bar's stamp has no room for it and no business with it.
    */
    const crew = code(CREW());
    expect(crew).toMatch(/written by\{"\s"\}\s*\n?\s*\{stateQuery\.data\.briefing\.shift\}/);
  });

  it("a FAILED check still says so — the bar's stamp cannot", () => {
    /*
      The stamp reports when data last LANDED; this reports whether the last
      ATTEMPT succeeded. A stamp reading 14:02 merely looks old, and cannot say
      "and I know it is stale". Different facts, so both are kept.
    */
    expect(code(CREW())).toMatch(/stateQuery\.isError\s*&&\s*"[^"]*last check failed/);
  });

  it("the page's clock keeps a consumer, and it is the shift strip", () => {
    /*
      ⚠ A SHARED TICKER WITH ONE CONSUMER LEFT IS STILL CORRECT, and this arm
      records why rather than leaving the next reader to wonder whether it
      should have gone with the stamp: `WORKING NOW` draws "started 14 min ago"
      AND a stalled verdict off the same instant, so it is still two readings
      that must agree (#272).
    */
    const crew = code(CREW());
    expect(crew).toMatch(/const now = useNow\(/);
    expect(crew).toMatch(/<CrewWorkingNow[^>]*now=\{now\}/s);
  });
});

describe("card 415 §3 — the switch's label and the page's timer are one number", () => {
  it("Crew polls at the interval the bar's switch NAMES", () => {
    /*
      ⚠ A CONTROL THAT LIES ABOUT ITSELF. The bar draws `AUTO 30s`; Crew polled
      at 60s. Folding Crew into that switch without moving the interval would
      have put a control reading "every 30 seconds" over a page refreshing every
      sixty — worse than the inconsistency he asked to remove, because it is
      unfalsifiable by looking.

      The repair is that there is now ONE number: Crew derives its interval from
      the staff constant rather than restating `30_000`, so the label and the
      timer cannot drift apart in a later edit.
    */
    const crewState = code(read("features/admin/components/crew/useCrewState.ts"));
    expect(crewState).toMatch(/CREW_LIVE_INTERVAL_MS\s*=\s*STAFF_REFRESH_INTERVAL_MS/);
    expect(crewState, "a restated literal is how the two drift apart").not.toMatch(
      /CREW_LIVE_INTERVAL_MS\s*=\s*\d/,
    );

    /* And the label the bar actually draws is the same period, said in seconds. */
    expect(code(read("features/staff/StaffBar.tsx"))).toMatch(/AUTO 30s/);
    expect(code(read("features/staff/useStaffRefresh.ts"))).toMatch(
      /STAFF_REFRESH_INTERVAL_MS\s*=\s*30_000/,
    );
  });

  it("the live re-read follows the shared switch, and the nav gate still never polls", () => {
    /*
      ⚠ THE REGRESSION THIS FORBIDS IS #133 REBUILT. `useCrewTabVisible` runs on
      EVERY admin page to decide whether the Crew tab exists. If folding the
      page into the switch had made `live` default true for that caller, every
      admin page would poll the briefing forever in the background.

      The page passes `live: autoRefresh`; the gate passes nothing and gets
      `false`.
    */
    const crew = code(read("pages/AdminCrew.tsx"));
    expect(crew).toMatch(/useCrewState\(isAdmin,\s*\{\s*live:\s*autoRefresh\s*\}\)/);

    const crewState = code(read("features/admin/components/crew/useCrewState.ts"));
    expect(crewState).toMatch(/const live = options\?\.live === true/);
    /* The gate's own call site, with no options object at all. */
    expect(crewState).toMatch(/useCrewState\(isAuthenticated && user\?\.role === "admin"\)/);
  });
});
