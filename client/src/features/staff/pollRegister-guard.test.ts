import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE POLL-REGISTER GUARD (#769): every query a staff page declares says
 * whether it follows the AUTO 30s switch, and the guard holds it to its word.
 *
 * # The class this ends
 *
 * A watched list that does not move while a staff member sits still. Found
 * and fixed by a person FIVE times — #457 (the pending-request count), #747
 * (the blocked-IPs list), #752 (the Moderation badge), the review of #768
 * (flagged referrals and her own change requests), and the fifth by this
 * card's own read (`ModeratorDashboard`'s users list, while `AdminUserManagement`'s
 * twin polled). The last-but-one was caught by a reviewer reading a PR whose
 * own law-7 sweep had just claimed the class closed — it was wrong in good
 * faith, because nothing could check the claim. `section05-guard` pins that
 * the switch is single-source; it says nothing about WHICH queries consume it.
 *
 * # Why a register, and why it lives AT the query
 *
 * "Which queries are watched lists?" is a judgement about what the data MEANS,
 * not its shape — `flaggedReferrals` and `getUserFullDetails` are structurally
 * identical (`enabled` on a tab or an id, one procedure, one page). A regex
 * cannot see it, so the judgement is written down where the query is declared,
 * and the guard DERIVES from there (working law 4 — a register kept in a
 * separate file would rot the way every second list here has):
 *
 *     // staff-poll: watched — <why another session raises it>
 *     const flaggedReferralsQuery = trpc.moderator.getFlaggedReferrals.useQuery(…)
 *
 *     // staff-poll: owner-triggered — <why her own action brings it>
 *     const userDetailsQuery = trpc.moderator.getUserFullDetails.useQuery(…)
 *
 * The marker is the line DIRECTLY above the declaration — not "somewhere
 * above", so a marker cannot drift onto the wrong query when a declaration is
 * inserted between them. The reason is REQUIRED: a bare kind is a finding.
 *
 * # What it holds, per page-declared query
 *
 *   1. it carries a marker with a known kind and a written reason;
 *   2. `watched` → the call passes the shared expression
 *      `refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false`
 *      (one switch, one constant — a private interval is #413's class); a
 *      query declared through a custom hook (`useCrewState`) is `watched`
 *      only if the switch is an argument of the call, because the interval
 *      lives inside the hook where this reader cannot see it;
 *   3. `owner-triggered` → the call passes NO `refetchInterval` at all.
 *
 * And the owner-triggered set is PINNED below. The card's own asymmetry: a
 * watched query that should not poll costs a request every 30 s; an
 * owner-triggered one that should have polled leaves a moderator looking at a
 * stale screen believing it is current — and only the second has happened.
 * So it is the non-polling side whose growth must be read on a PR.
 *
 * # Limits, stated
 *
 * A SOURCE read over the pages `refreshReach-guard.test.ts` reads (named
 * `Admin*` / `Moderator*`), and the same three declaration shapes — but
 * anchored to ONE LINE each, where the reach guard matches body-wide. So a
 * declaration whose head wraps after the `=` is seen there and not here;
 * rather than silently leaving the register, that difference is COUNTED:
 * every `trpc.<path>.useQuery(` in the comment-blanked text must be a
 * registered entry, and a shortfall is a finding (PR #851 review, 1). A
 * marker with no registered declaration directly beneath it — the query
 * deleted, or a declaration slid in between — is a finding too (review, 2);
 * a register that can carry dead entries is documentation, not a register.
 *
 * Outside this population, stated so nobody concludes the class's own
 * birthplaces are uncovered (review, 3): the badge and count readers in
 * `useStaffCounts.ts` (#457's site) and `useModeratorFlagCounts.ts` (#752's)
 * declare their queries in hooks, not pages, and each is pinned to the shared
 * switch and constant by `counts415-guard` / `counts416-guard`. The
 * discrepancies card takes `autoRefreshInterval` from the page — the page's
 * decision. Swept and cleared by reading, owner-triggered by nature and not
 * registered: the three `enabled: false` CSV export queries (`AuditLogsTab`,
 * `CreditsSubTab`, `GenerationsSubTab` — fired by a click), the id-keyed
 * details in `ReconciliationSubTab` and `ChangeRequestAttachments`, and
 * `BannerManagement`'s list, which invalidates on its own writes. A
 * destructured query (`const { data } = …`) has no name and is refused rather
 * than bound.
 *
 * ⚠ EVERY ABSENCE ARM IS PAIRED WITH A CONTROL THAT MUST GO RED. The fixture
 * arms below drive each finding shape on synthetic pages every run; the real
 * sabotage (the `refetchInterval` deleted from `flaggedReferralsQuery`, the
 * #768 instance) was driven once before this file's verdict counted, and its
 * output is on #769's card.
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..", "..");
const PAGES = path.resolve(CLIENT_SRC, "pages");

/** The marker a page puts on the line directly above a query declaration. */
export const POLL_MARKER = "staff-poll:";
export const POLL_KINDS = ["watched", "owner-triggered"] as const;
type PollKind = (typeof POLL_KINDS)[number];

/** The one expression a watched query passes — the shared switch, the shared constant. */
const SHARED_INTERVAL = /\brefetchInterval\s*:\s*autoRefresh\s*\?\s*STAFF_REFRESH_INTERVAL_MS\s*:\s*false\b/;

type PollEntry = {
  /** The variable name, or null for a destructured `const { data } = …`. */
  name: string | null;
  /** The tRPC path, or null for a custom-hook handle. */
  path: string | null;
  viaHook: boolean;
  /** The marker's kind, or null when absent / unknown. */
  kind: PollKind | null;
  reason: string;
  /** The raw marker line above the declaration, or null when there is none. */
  markerLine: string | null;
  /** Its 0-based line index, or -1 — what the orphan sweep binds on. */
  markerIndex: number;
  /** The full call text, `(` to its matching `)`, comments blanked. */
  call: string;
};

type PollRegister = {
  entries: PollEntry[];
  findings: string[];
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * From `open` (the index of a `(`), return the index of its matching `)`,
 * skipping strings, template literals and nested brackets of every kind.
 * Returns -1 when unbalanced.
 */
function matchParen(text: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      const q = ch;
      i++;
      while (i < text.length && text[i] !== q) {
        if (text[i] === "\\") i++;
        i++;
      }
    } else if (ch === "`") {
      i++;
      while (i < text.length && text[i] !== "`") {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        i++;
      }
    } else if (ch === "(" || ch === "{" || ch === "[") {
      depth++;
    } else if (ch === ")" || ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return ch === ")" ? i : -1;
    }
    i++;
  }
  return -1;
}

/**
 * Comments blanked to spaces, LENGTH-PRESERVING, so a commented-out interval is
 * not one and an apostrophe in a comment cannot start a bogus string skip in
 * `matchParen` — while every line index stays where the raw text has it,
 * because the markers this reader binds to ARE comments and are read raw.
 * Strings and template literals are walked, so `"https://…"` is not a comment.
 */
function blankComments(text: string): string {
  let out = "";
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) out += text[k] === "\n" ? "\n" : " ";
  };
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      const stop = end < 0 ? text.length : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== ch && (ch === "`" || text[j] !== "\n")) {
        if (text[j] === "\\") j++;
        j++;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** The line directly above line index `i` (0-based), or null at the top. */
function lineAbove(lines: string[], i: number): string | null {
  return i > 0 ? lines[i - 1] : null;
}

function readMarker(line: string | null): { kind: PollKind | null; reason: string; present: boolean } {
  if (line === null) return { kind: null, reason: "", present: false };
  const m = new RegExp(`^\\s*//\\s*${escapeRe(POLL_MARKER)}\\s*(\\S+)?\\s*(?:—|-)?\\s*(.*)$`).exec(line);
  if (!m) return { kind: null, reason: "", present: false };
  const kindText = m[1] ?? "";
  const kind = (POLL_KINDS as readonly string[]).includes(kindText) ? (kindText as PollKind) : null;
  return { kind, reason: (m[2] ?? "").trim(), present: true };
}

/** THE READER. Pure over source text so the fixture arms can drive it. */
export function readPollRegister(raw: string): PollRegister {
  const lines = raw.split("\n");
  const blanked = blankComments(raw);
  const entries: PollEntry[] = [];
  const findings: string[] = [];

  const declare = (i: number, name: string | null, tRPCPath: string | null, viaHook: boolean, openParen: number) => {
    const close = matchParen(blanked, openParen);
    const call = close < 0 ? "" : blanked.slice(openParen, close + 1);
    const marker = readMarker(lineAbove(lines, i));
    entries.push({
      name,
      path: tRPCPath,
      viaHook,
      kind: marker.kind,
      reason: marker.reason,
      markerLine: marker.present ? lines[i - 1].trim() : null,
      markerIndex: marker.present ? i - 1 : -1,
      call,
    });
  };

  // Walk declarations line by line so "directly above" is a line, not a guess.
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const named = /^\s*const\s+(\w+)\s*=\s*trpc\.([\w.]+)\.use(?:Infinite)?Query\s*\(/.exec(line);
    const destructured = /^\s*const\s*\{[^}]*\}\s*=\s*trpc\.([\w.]+)\.use(?:Infinite)?Query\s*\(/.exec(line);
    const hook = /^\s*const\s+(\w+)\s*=\s*(use[A-Z]\w*)\s*\(/.exec(line);
    const openParen = offset + line.indexOf("(", named ? named[0].length - 1 : destructured ? destructured[0].length - 1 : hook ? hook[0].length - 1 : 0);
    if (named) {
      declare(i, named[1], named[2], false, openParen);
    } else if (destructured) {
      declare(i, null, destructured[1], false, openParen);
    } else if (hook) {
      // A custom hook is a query only when the page treats it as one.
      const asQuery = new RegExp(`\\b${escapeRe(hook[1])}\\.(refetch|dataUpdatedAt|isFetching|isRefetching|isLoading)\\b`);
      if (asQuery.test(raw)) declare(i, hook[1], null, true, openParen);
    }
    offset += line.length + 1;
  }

  /*
    THE COUNT CROSS-CHECK (PR #851 review, 1). The declaration regexes above
    are anchored to one line, so a head that wraps after the `=` would leave
    the register with nothing going red. Every `trpc.<path>.useQuery(` in the
    blanked text must therefore have become an entry; a shortfall is named,
    not absorbed by the population floor.
  */
  const tRPCCalls = blanked.match(/\btrpc\.[\w.]+\.use(?:Infinite)?Query\s*\(/g)?.length ?? 0;
  const tRPCEntries = entries.filter((e) => !e.viaHook).length;
  if (tRPCCalls !== tRPCEntries) {
    findings.push(
      `${tRPCCalls} trpc query call(s) in the file but ${tRPCEntries} registered — a declaration this reader cannot see (a head wrapped after the \`=\`, or a query not bound to a \`const\`)`,
    );
  }

  /*
    ORPHANED MARKERS (review, 2). A marker whose next line is not a registered
    declaration describes nothing — the query was deleted, or a declaration
    slid in between. The reach guard reports its stranded markers; so does this.
  */
  const bound = new Set(entries.map((e) => e.markerIndex).filter((i) => i >= 0));
  const markerRe = new RegExp(`^//\\s*${escapeRe(POLL_MARKER)}`);
  lines.forEach((l, i) => {
    if (markerRe.test(l.trim()) && !bound.has(i)) {
      findings.push(`'${l.trim()}' (line ${i + 1}) sits above no registered query — an orphaned marker is not a register entry`);
    }
  });

  for (const e of entries) {
    const label = e.name
      ? `${e.name}${e.path ? ` (${e.path})` : " (custom hook)"}`
      : `{ … } = ${e.path} (destructured)`;
    if (e.name === null) {
      findings.push(`${label}: a destructured query has no name to register — give it a handle`);
      continue;
    }
    if (e.markerLine === null) {
      findings.push(`${label}: no '${POLL_MARKER}' marker on the line directly above it`);
      continue;
    }
    if (e.kind === null) {
      findings.push(`${label}: '${e.markerLine}' names no known kind (${POLL_KINDS.join(" | ")})`);
      continue;
    }
    if (!e.reason) {
      findings.push(`${label}: '${POLL_MARKER} ${e.kind}' has no reason — a bare kind is not a register entry`);
      continue;
    }
    const hasInterval = /\brefetchInterval\s*:/.test(e.call);
    if (e.kind === "watched") {
      if (e.viaHook) {
        if (!/\bautoRefresh\b/.test(e.call)) {
          findings.push(`${label}: registered watched, but the shared switch (autoRefresh) is not an argument of the hook call`);
        }
      } else if (!SHARED_INTERVAL.test(e.call)) {
        findings.push(
          `${label}: registered watched, but the call does not pass \`refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false\`` +
            (hasInterval ? " (it passes a refetchInterval of its own — one switch, one constant)" : ""),
        );
      }
    } else if (hasInterval || (e.viaHook && /\bautoRefresh\b/.test(e.call))) {
      findings.push(`${label}: registered owner-triggered, but the call follows the switch — pick one`);
    }
  }

  return { entries, findings };
}

/**
 * THE POPULATION — derived from the pages folder rather than typed out, for
 * the reason `section05-guard.test.ts` gives: a typed list has the blind spot
 * of whoever typed it, and this class was missed five times by exactly that.
 */
const staffPages = () =>
  fs
    .readdirSync(PAGES)
    .filter((name) => /^(Admin|Moderator).*\.tsx$/.test(name))
    .map((name) => ({ name, text: fs.readFileSync(path.join(PAGES, name), "utf8") }));

describe("poll-register — the population is real and the reader is not empty", () => {
  it("finds the staff pages and reads a plausible number of queries off them", () => {
    /*
      A register assertion over zero entries is the cheapest false pass there
      is. The floor is well under today's count (28 across nine pages) and
      well above zero.
    */
    const pages = staffPages();
    expect(pages.length, `staff pages: ${pages.map((p) => p.name).join(", ")}`).toBeGreaterThanOrEqual(9);
    const total = pages.reduce((n, p) => n + readPollRegister(p.text).entries.length, 0);
    expect(total, "queries read across all staff pages").toBeGreaterThanOrEqual(20);
  });
});

describe("poll-register — every page-declared query says whether it follows the switch, and does what it says", () => {
  it("no staff page declares a query without a registered kind, and every kind is honoured at the call", () => {
    const findings = staffPages().flatMap(({ name, text }) =>
      readPollRegister(text).findings.map((f) => `${name}: ${f}`),
    );
    expect(
      findings,
      "Issue 769: a watched list that does not follow the AUTO 30s switch, five times by hand.\n" +
        `Put '// ${POLL_MARKER} watched — <reason>' or '// ${POLL_MARKER} owner-triggered — <reason>'\n` +
        "on the line directly above the declaration, and make the call match it:\n" +
        findings.join("\n"),
    ).toEqual([]);
  });

  it("the owner-triggered set is what the source says it is — growth on this side is read on the PR", () => {
    /*
      Pinned on purpose. Every entry here is a detail reader keyed on a row the
      staff member selected herself, and #759 put the Refresh button in reach
      of each. A NEW non-polling query changes this expectation and therefore
      gets read by a person, which is the one review this class has needed
      five times. The watched side is not pinned: a query that polls when it
      need not costs a request, and the card's own asymmetry says that is the
      cheaper mistake.
    */
    const register = staffPages()
      .flatMap(({ name, text }) =>
        readPollRegister(text)
          .entries.filter((e) => e.kind === "owner-triggered")
          .map((e) => `${name}: ${e.name} (${e.path})`),
      )
      .sort();
    expect(register).toEqual([
      "AdminAuditLogs.tsx: userDetailsQuery (admin.getUserDetails)",
      "AdminChangeRequests.tsx: detailQuery (admin.getChangeRequest)",
      "AdminUserManagement.tsx: userActivityQuery (admin.getUserActivity)",
      "AdminUserManagement.tsx: userDetailsQuery (admin.getUserFullDetails)",
      "ModeratorDashboard.tsx: creditHistoryQuery (moderator.getUserCreditHistory)",
      "ModeratorDashboard.tsx: generationHistoryQuery (moderator.getUserGenerationHistory)",
      "ModeratorDashboard.tsx: userActivityQuery (moderator.getUserActivity)",
      "ModeratorDashboard.tsx: userDetailsQuery (moderator.getUserFullDetails)",
    ]);
  });

  it("every registered query on the real pages has a reason a person wrote", () => {
    const thin = staffPages().flatMap(({ name, text }) =>
      readPollRegister(text)
        .entries.filter((e) => e.kind !== null && e.reason.length < 12)
        .map((e) => `${name}: ${e.name} — '${e.reason}'`),
    );
    expect(thin, "a reason shorter than a clause is a label, not a reason").toEqual([]);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CONTROLS — the reader driven against synthetic pages, both directions.
   If any of these stops going red, the arms above are green for the wrong
   reason.
   ─────────────────────────────────────────────────────────────────────────── */

const CLEAN_PAGE = `
export default function Page() {
  const [autoRefresh, setAutoRefresh] = useStaffAutoRefresh();
  // staff-poll: watched — rows are written by other sessions
  const logsQuery = trpc.admin.getAuditLogs.useQuery(
    { limit: 50 },
    { refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false }
  );
  /* a block comment explaining the tab gate, which the marker sits under */
  // staff-poll: watched — a block placed in another session
  const blockedIpsQuery = trpc.admin.listBlockedIPs.useQuery({ limit: 50 }, {
    enabled: activeTab === "blocked-ips",
    refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false,
  });
  // staff-poll: owner-triggered — keyed on the row she selected; Refresh reaches it
  const userDetailsQuery = trpc.admin.getUserDetails.useQuery({ userId: selected?.userId ?? 0 }, { enabled: !!selected });
  // staff-poll: watched — the briefing is written by a shift; the switch reaches the hook as live
  const stateQuery = useCrewState(isAdmin, { live: autoRefresh });
  return <StaffBar refreshControls={{ onRefresh: () => { logsQuery.refetch(); stateQuery.refetch(); }, isRefetching: stateQuery.isFetching }} />;
}`;

const findingsOf = (page: string) => readPollRegister(page).findings;

describe("poll-register — CONTROLS: the reader can fail, in every direction it is asked to", () => {
  it("a page that registers every query correctly is clean, and all four shapes are read", () => {
    const r = readPollRegister(CLEAN_PAGE);
    expect(r.entries.map((e) => `${e.name}:${e.kind}`)).toEqual([
      "logsQuery:watched",
      "blockedIpsQuery:watched",
      "userDetailsQuery:owner-triggered",
      "stateQuery:watched",
    ]);
    expect(r.findings).toEqual([]);
  });

  it("MUST GO RED: a query with no marker on the line directly above it", () => {
    const page = CLEAN_PAGE.replace("  // staff-poll: watched — a block placed in another session\n", "");
    expect(findingsOf(page)).toEqual([
      "blockedIpsQuery (admin.listBlockedIPs): no 'staff-poll:' marker on the line directly above it",
    ]);
  });

  it("MUST GO RED: a marker that is NOT directly above — a declaration slid in between", () => {
    const page = CLEAN_PAGE.replace(
      "  // staff-poll: owner-triggered — keyed on the row she selected; Refresh reaches it\n  const userDetailsQuery",
      "  // staff-poll: owner-triggered — keyed on the row she selected; Refresh reaches it\n  const selectedId = selected?.userId ?? 0;\n  const userDetailsQuery",
    );
    // Both halves are named: the query lost its marker AND the marker now describes nothing.
    expect(findingsOf(page)).toEqual([
      "'// staff-poll: owner-triggered — keyed on the row she selected; Refresh reaches it' (line 15) sits above no registered query — an orphaned marker is not a register entry",
      "userDetailsQuery (admin.getUserDetails): no 'staff-poll:' marker on the line directly above it",
    ]);
  });

  it("MUST GO RED: a query deleted with its marker left behind — an orphaned register entry (PR 851 review, 2)", () => {
    const page = CLEAN_PAGE.replace(
      "  const userDetailsQuery = trpc.admin.getUserDetails.useQuery({ userId: selected?.userId ?? 0 }, { enabled: !!selected });\n",
      "",
    );
    expect(findingsOf(page)).toEqual([
      "'// staff-poll: owner-triggered — keyed on the row she selected; Refresh reaches it' (line 15) sits above no registered query — an orphaned marker is not a register entry",
    ]);
  });

  it("MUST GO RED: a declaration head wrapped after the `=` cannot leave the register silently (PR 851 review, 1)", () => {
    /*
      The line-anchored regexes do not see this shape (the reach guard does).
      The count cross-check turns the silent exit into a finding; the marker
      above it is then orphaned too, and both are said.
    */
    const page = CLEAN_PAGE.replace(
      "  const userDetailsQuery = trpc.admin.getUserDetails.useQuery(",
      "  const userDetailsQuery =\n    trpc.admin.getUserDetails.useQuery(",
    );
    expect(findingsOf(page)).toEqual([
      "3 trpc query call(s) in the file but 2 registered — a declaration this reader cannot see (a head wrapped after the `=`, or a query not bound to a `const`)",
      "'// staff-poll: owner-triggered — keyed on the row she selected; Refresh reaches it' (line 15) sits above no registered query — an orphaned marker is not a register entry",
    ]);
  });

  it("MUST GO RED: a watched query whose interval was deleted — the instance the review of PR 768 found", () => {
    const page = CLEAN_PAGE.replace(
      "    enabled: activeTab === \"blocked-ips\",\n    refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false,\n",
      "    enabled: activeTab === \"blocked-ips\",\n",
    );
    expect(findingsOf(page)).toEqual([
      "blockedIpsQuery (admin.listBlockedIPs): registered watched, but the call does not pass `refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false`",
    ]);
  });

  it("MUST GO RED: a watched query on a private interval — one switch, one constant", () => {
    const page = CLEAN_PAGE.replace(
      "{ refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false }\n  );",
      "{ refetchInterval: 30_000 }\n  );",
    );
    const f = findingsOf(page);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatch(/^logsQuery \(admin\.getAuditLogs\): registered watched.*passes a refetchInterval of its own/);
  });

  it("MUST GO RED: an interval that is only commented out is not an interval", () => {
    const page = CLEAN_PAGE.replace(
      "    refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false,\n  });",
      "    // refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false,\n  });",
    );
    expect(findingsOf(page)).toHaveLength(1);
    expect(findingsOf(page)[0]).toMatch(/^blockedIpsQuery .*registered watched, but the call does not pass/);
  });

  it("MUST GO RED: an owner-triggered query that polls anyway", () => {
    const page = CLEAN_PAGE.replace(
      "{ enabled: !!selected });",
      "{ enabled: !!selected, refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false });",
    );
    expect(findingsOf(page)).toEqual([
      "userDetailsQuery (admin.getUserDetails): registered owner-triggered, but the call follows the switch — pick one",
    ]);
  });

  it("MUST GO RED: a watched hook query the switch does not reach", () => {
    const page = CLEAN_PAGE.replace("useCrewState(isAdmin, { live: autoRefresh })", "useCrewState(isAdmin, { live: true })");
    expect(findingsOf(page)).toEqual([
      "stateQuery (custom hook): registered watched, but the shared switch (autoRefresh) is not an argument of the hook call",
    ]);
  });

  it("MUST GO RED: a bare kind with no reason, and an unknown kind", () => {
    const bare = CLEAN_PAGE.replace("// staff-poll: watched — rows are written by other sessions", "// staff-poll: watched");
    expect(findingsOf(bare)).toEqual([
      "logsQuery (admin.getAuditLogs): 'staff-poll: watched' has no reason — a bare kind is not a register entry",
    ]);
    const unknown = CLEAN_PAGE.replace("// staff-poll: watched — rows are written by other sessions", "// staff-poll: polled — rows are written by other sessions");
    expect(findingsOf(unknown)).toEqual([
      "logsQuery (admin.getAuditLogs): '// staff-poll: polled — rows are written by other sessions' names no known kind (watched | owner-triggered)",
    ]);
  });

  it("MUST GO RED: a destructured query has nothing to register under", () => {
    const page = CLEAN_PAGE.replace(
      "const userDetailsQuery = trpc.admin.getUserDetails.useQuery(",
      "const { data } = trpc.admin.getUserDetails.useQuery(",
    );
    expect(findingsOf(page)).toEqual([
      "{ … } = admin.getUserDetails (destructured): a destructured query has no name to register — give it a handle",
    ]);
  });

  it("a custom hook the page never treats as a query is not read as one", () => {
    const page = CLEAN_PAGE.replace(
      "onRefresh: () => { logsQuery.refetch(); stateQuery.refetch(); }, isRefetching: stateQuery.isFetching",
      "onRefresh: () => { logsQuery.refetch(); }, isRefetching: false",
    ).replace("  // staff-poll: watched — the briefing is written by a shift; the switch reaches the hook as live\n", "");
    const r = readPollRegister(page);
    expect(r.entries.map((e) => e.name)).not.toContain("stateQuery");
    expect(r.findings).toEqual([]);
  });
});
