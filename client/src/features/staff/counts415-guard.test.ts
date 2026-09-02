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

  it("the hook sets no option that would reach Overview's OWN poll", () => {
    /*
      ⚠ THE DEFECT THIS CATCHES SHIPPED IN THIS BRANCH AND THE GATE REVIEW FOUND
      IT. The hook carried `retry: false`. `retry` is a FETCH-level option —
      TanStack resolves it from the LAST OBSERVER to set options on the query,
      not per observer the way `staleTime` works. On `/admin/overview` this hook
      and the page observe the SAME KEY, and the bar renders as a child of the
      page, so `retry: false` landed last and stripped the page's three default
      retries. One transient blip on its 30s poll would have drawn "The
      dashboard could not load." over a dashboard still showing live data.

      **Sharing a query key shares more than the request**, and that is the
      class. So this arm does not ban `retry` by name — it holds the option
      object to the two options that are OBSERVER-scoped and therefore cannot
      reach another page. A third one reddens this on purpose: it may be
      correct, and it must be checked against every consumer of the key first.
    */
    const hook = read("features/staff/useStaffCounts.ts");
    const start = hook.indexOf("useQuery(undefined, {");
    expect(start, "the hook still calls useQuery with an options object").toBeGreaterThan(-1);
    const body = code(hook.slice(start + "useQuery(undefined, {".length));
    const close = body.indexOf("});");
    expect(close, "the options object is closed").toBeGreaterThan(-1);

    /* Top-level keys only — nothing here nests, and a nested key would not be
       an option on this query anyway. */
    const keys = Array.from(body.slice(0, close).matchAll(/^\s{4}([A-Za-z]+):/gm)).map((m) => m[1]);
    expect(
      keys.sort(),
      [
        "This hook shares `admin.getOverview` with AdminOverview. Only",
        "observer-scoped options are safe to set here; a fetch-level one",
        "(retry, retryDelay, networkMode, gcTime, structuralSharing) is",
        "resolved from the last observer and changes the PAGE's behaviour.",
        `Options set: ${keys.join(", ")}`,
      ].join(String.fromCharCode(10)),
    ).toEqual(["enabled", "staleTime"]);
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

describe("card 415 — the pill is INVALIDATED by the acts that move it", () => {
  /*
    ⚠ THE DEFECT THIS DESCRIBE EXISTS FOR SHIPPED IN THIS BRANCH'S FIRST COMMIT
    AND WAS CAUGHT BY THE GATE REVIEW OF PR #456.

    `useStaffCounts` holds `staleTime` and no interval. **`staleTime` makes a
    refetch PERMISSIBLE at the next trigger; it does not schedule one** — and
    the QueryClient is stock, so the triggers are remount and window refocus.
    Neither fires while he stays on one page.

    So: five requests pending, he approves all five on `/admin/change-requests`,
    the list empties and the bar still reads `Change requests 5`. **The one
    action the pill exists to drive was the one action that left it lying.**

    The arms below are derived from the CLIENT TREE, not from a list of two
    file names, so a third resolving mutation cannot arrive without one.
  */

  /** Every client mutation on a procedure that RESOLVES a change request. */
  const RESOLVING = /trpc\.admin\.(reviewChangeRequest|executeChangeRequestAfterSlack)\.useMutation/;

  const resolvingFiles = () =>
    sources(CLIENT_SRC).filter(({ text }) => RESOLVING.test(code(text)));

  it("the population is real — some client file resolves change requests", () => {
    /* An absence arm over an empty set is the cheapest false pass there is. */
    const names = resolvingFiles().map((f) => f.name);
    expect(names.length, `files resolving change requests: ${names.join(", ")}`).toBeGreaterThan(0);
    expect(names).toContain("pages/AdminChangeRequests.tsx");
  });

  it("every file that resolves a request invalidates the query the pill reads", () => {
    /*
      ⚠ THE INVALIDATE MUST NAME `getOverview`, not merely exist. A page
      refetching its own list is what the broken version already did — the
      whole defect is that the LIST refreshed and the BAR did not.
    */
    const offenders = resolvingFiles()
      .filter(({ text }) => !/utils\.admin\.getOverview\.invalidate\(\)/.test(code(text)))
      .map(({ name }) => name);
    expect(
      offenders,
      [
        "This file resolves a change request and never invalidates the query the",
        "staff bar's pill reads, so the bar keeps the old number on the very page",
        "where he changed it:",
        ...offenders,
      ].join("\n"),
    ).toEqual([]);
  });

  it("BOTH handlers invalidate — one of two is a bar that lies half the time", () => {
    /*
      A file-level arm passes when one of a file's two resolving mutations is
      wired. Counting them is what makes it a reading rather than a shape match:
      `reviewChangeRequest` and `executeChangeRequestAfterSlack` are two
      different roads out of `pending`, and the Slack road is the rarer one that
      nobody would notice going stale.
    */
    const page = code(read("pages/AdminChangeRequests.tsx"));
    const mutations = page.match(/\.useMutation\(/g) ?? [];
    const invalidations = page.match(/utils\.admin\.getOverview\.invalidate\(\)/g) ?? [];
    expect(mutations.length, "the two resolving mutations on this page").toBe(2);
    expect(invalidations.length, "one per handler").toBe(2);
  });

  it("the MODERATOR's create is deliberately outside, and the reason is structural", () => {
    /*
      ⚠ AN ENUMERATED EXCLUSION, NOT AN OVERSIGHT. `moderator.createChangeRequest`
      RAISES the same count, so a naive sweep would demand an invalidate here
      too. It runs in the MODERATOR's session, on a page drawing
      `StaffBarModeration`, which carries no admin pill — a moderator's browser
      cannot invalidate an admin's cache, and adding the call would be a control
      that looks like one and does nothing (invariant 7 in miniature).

      The arrival direction is a real gap and it is #457, with a recommendation.
    */
    const moderator = code(read("pages/ModeratorDashboard.tsx"));
    expect(moderator).toMatch(/trpc\.moderator\.createChangeRequest\.useMutation/);
    expect(moderator, "the moderator bar carries no count today").not.toMatch(
      /useStaffCounts/,
    );
    const bar = code(read("features/staff/StaffBar.tsx"));
    const moderationBar = bar.slice(bar.indexOf("export function StaffBarModeration"));
    expect(moderationBar, "the moderation bar takes its segments from its caller").not.toMatch(
      /adminSegments|useStaffCounts/,
    );
  });

  it("the hook still schedules NO poll — the fix is invalidation, not a timer", () => {
    /*
      The tempting repair is `refetchInterval`, which would put seven
      aggregations on a 30s timer across eight admin pages. That is a decision
      about cost and it is #457's, not this card's. If a later shift takes it,
      this arm goes red and that shift updates it on purpose.
    */
    const hook = code(read("features/staff/useStaffCounts.ts"));
    expect(hook, "no interval — see card 457").not.toMatch(/refetchInterval/);
    expect(hook).toMatch(/staleTime:\s*STALE_MS/);
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
