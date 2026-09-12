import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE REFRESH-REACH GUARD (#766): every query a staff page declares is
 * reached by that page's own Refresh button.
 *
 * # The class this ends
 *
 * A staff Refresh button that silently misses queries on its own page. Three
 * instances, each found by hand: #747 (`blockedIpsQuery` under both controls
 * and reached by neither), #759 (eight more), PR #763 (ten, not eight — the
 * hand sweep before it was blind to two pages). The instrument doing the
 * counting was wrong TWICE, in opposite directions: once it required
 * `const handleRefresh = () => {` and `AdminOverview`'s handler is a
 * `useCallback`; once it looked for a NAMED handler and five pages declare
 * theirs inline as `onRefresh: () => { … }` — two of those five carried the
 * defect. So the count was wrong every time it was taken by hand, and it was
 * taken by hand three times. This is the fourth reading, and it runs on every
 * commit instead of when somebody remembers.
 *
 * # What it holds
 *
 * For each staff page (derived from `pages/` — anything `Admin*` or
 * `Moderator*`, the same population `section05-guard.test.ts` measures):
 *
 *   1. collect every QUERY HANDLE the page declares —
 *        `const q = trpc.<path>.useQuery(…)` / `.useInfiniteQuery(…)`,
 *        `const { data } = trpc.<path>.useQuery(…)` (no handle; reachable
 *        only by `invalidate`), and `const q = useSomething(…)` where the page
 *        then treats `q` as a query (`q.refetch` / `q.dataUpdatedAt` /
 *        `q.isFetching` / …) — that last shape is `AdminCrew`'s `useCrewState`;
 *   2. find the body of the function passed as `onRefresh` — BOTH shapes, the
 *      named handler (plain arrow or `useCallback`) and the inline arrow;
 *   3. assert each handle is reached inside that body: `q.refetch(` or
 *      `utils.<path>.invalidate(`. A conditional reach (`if (selectedUserId)
 *      q.refetch()`) is a reach — the condition is input validity, which
 *      `ModeratorDashboard`'s handler explains in place.
 *
 * # ⚠ The exemption register is read out of the SOURCE, never listed here
 *
 * Working law 4. A query a page deliberately does not reach from its button
 * carries, in the comment directly above its declaration:
 *
 *     // refresh-reach-exempt: <the reason, in a sentence>
 *
 * The reason is REQUIRED — a bare marker is a finding, not an exemption. The
 * card that ordered this guard named two exemptions; read at the tree the day
 * it was built there are **zero**: `slackStatusQuery` left with the Slack
 * retirement (#800), and the discrepancies card's query on `ModeratorDashboard`
 * is declared inside the card component, not on the page, so this reader never
 * sees it. The grammar exists so the first real one has somewhere to go, and
 * the fixture arms below prove both halves of it work before it has a user.
 *
 * # Limits, stated
 *
 * A SOURCE read. It cannot see a query owned by a child component in another
 * file (the discrepancies card) — that is a different class, and the page
 * reaches such a thing by `invalidate`, which is what `ModeratorDashboard`
 * does. A query declared in a same-file child component IS counted as the
 * page's: reach it from the handler by `invalidate`, or annotate it. And a
 * handler that reaches queries through a helper (`refetchAll()`) is not read
 * through — no page does that today, and one that starts to will redden here
 * and be read by a person.
 *
 * ⚠ **EVERY ABSENCE ARM IS PAIRED WITH A CONTROL THAT MUST GO RED.** The card's
 * own bar (working law 2): delete one `refetch()` from a page and prove the
 * guard reddens. The fixture arms do that against synthetic pages on every run;
 * the real sabotage against `AdminAuditLogs.tsx` was driven once before this
 * file's verdict was allowed to count, and its output is on #766's card.
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..", "..");
const PAGES = path.resolve(CLIENT_SRC, "pages");

/** Strip comments, so a docblock explaining a rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The marker a page puts above a query it deliberately does not reach. */
export const EXEMPT_MARKER = "refresh-reach-exempt:";

type QueryHandle = {
  /** The variable name, or null for a destructured `const { data } = …`. */
  name: string | null;
  /** The tRPC path (`admin.getBugReports`), or null for a custom-hook handle. */
  path: string | null;
  /** Declared through a custom hook the page then treats as a query. */
  viaHook: boolean;
};

type Exemption = { name: string; reason: string };

type RefreshReach = {
  handles: QueryHandle[];
  exemptions: Exemption[];
  /** Exempt markers whose reason is empty — each one is a finding. */
  bareMarkers: string[];
  /** How many `onRefresh:` sites the page has. One is the expected shape. */
  handlerSites: number;
  /** The handler body, comments stripped, or null when the page has none. */
  handlerBody: string | null;
  /** Handles neither reached by the handler nor exempted. */
  unreached: QueryHandle[];
};

/**
 * From `open` (the index of a `{`), return the index of its matching `}`,
 * skipping strings and template literals. Returns -1 when unbalanced.
 */
function matchBrace(text: string, open: number): number {
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
      // A template literal: `${` re-enters code until its own `}` closes.
      i++;
      while (i < text.length && text[i] !== "`") {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === "$" && text[i + 1] === "{") {
          const end = matchBrace(text, i + 1);
          if (end < 0) return -1;
          i = end;
        }
        i++;
      }
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** The body of the arrow function that begins at or after `from`. */
function arrowBodyFrom(text: string, from: number): string | null {
  const arrow = text.indexOf("=>", from);
  if (arrow < 0) return null;
  let i = arrow + 2;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] === "{") {
    const end = matchBrace(text, i);
    return end < 0 ? null : text.slice(i + 1, end);
  }
  // An expression body: read to the end of the statement/property.
  const end = text.slice(i).search(/[,;\n]/);
  return end < 0 ? text.slice(i) : text.slice(i, i + end);
}

/** The body of the function a page passes as `onRefresh`, in either shape. */
function refreshHandlerBody(body: string): { sites: number; text: string | null } {
  const sites = [...body.matchAll(/\bonRefresh\s*:\s*/g)];
  if (sites.length === 0) return { sites: 0, text: null };
  const site = sites[0];
  const after = site.index! + site[0].length;
  const rest = body.slice(after);

  // Inline: `onRefresh: () => { … }` / `onRefresh: async () => …`
  if (/^(async\s*)?\(/.test(rest)) {
    return { sites: sites.length, text: arrowBodyFrom(body, after) };
  }

  // Named: `onRefresh: handleRefresh` → find its declaration.
  const ident = /^(\w+)/.exec(rest)?.[1];
  if (!ident) return { sites: sites.length, text: null };
  const decl = new RegExp(`\\bconst\\s+${escapeRe(ident)}\\s*=\\s*(useCallback\\s*\\()?`).exec(body);
  if (!decl) return { sites: sites.length, text: null };
  return { sites: sites.length, text: arrowBodyFrom(body, decl.index + decl[0].length) };
}

/** Every query handle the page declares — see the docblock for the three shapes. */
function queryHandles(body: string): QueryHandle[] {
  const handles: QueryHandle[] = [];
  const seen = new Set<string>();

  // `const q = trpc.<path>.useQuery(` / `.useInfiniteQuery(`
  for (const m of body.matchAll(/\bconst\s+(\w+)\s*=\s*trpc\.([\w.]+)\.use(?:Infinite)?Query\s*\(/g)) {
    handles.push({ name: m[1], path: m[2], viaHook: false });
    seen.add(m[1]);
  }
  // `const { data } = trpc.<path>.useQuery(` — no handle, invalidate-only
  for (const m of body.matchAll(/\bconst\s*\{[^}]*\}\s*=\s*trpc\.([\w.]+)\.use(?:Infinite)?Query\s*\(/g)) {
    handles.push({ name: null, path: m[1], viaHook: false });
  }
  // `const q = useSomething(` where the page treats `q` as a query
  for (const m of body.matchAll(/\bconst\s+(\w+)\s*=\s*use[A-Z]\w*\s*\(/g)) {
    const name = m[1];
    if (seen.has(name)) continue;
    const asQuery = new RegExp(`\\b${escapeRe(name)}\\.(refetch|dataUpdatedAt|isFetching|isRefetching|isLoading)\\b`);
    if (asQuery.test(body)) {
      handles.push({ name, path: null, viaHook: true });
      seen.add(name);
    }
  }
  return handles;
}

/** Exemptions, read from the RAW text: the marker binds to the next `const`. */
function exemptions(raw: string): { exemptions: Exemption[]; bareMarkers: string[] } {
  const out: Exemption[] = [];
  const bare: string[] = [];
  for (const m of raw.matchAll(new RegExp(`${escapeRe(EXEMPT_MARKER)}([^\\n]*)`, "g"))) {
    const reason = m[1].replace(/\*\/.*$/, "").trim();
    const next = /\bconst\s+(\w+)\s*=/.exec(raw.slice(m.index! + m[0].length));
    const name = next?.[1] ?? "(no declaration follows)";
    if (!reason) bare.push(name);
    else out.push({ name, reason });
  }
  return { exemptions: out, bareMarkers: bare };
}

function reached(handle: QueryHandle, handlerBody: string): boolean {
  if (handle.name && new RegExp(`\\b${escapeRe(handle.name)}\\.refetch\\s*\\(`).test(handlerBody)) return true;
  if (handle.path && new RegExp(`\\.${escapeRe(handle.path)}\\.invalidate\\s*\\(`).test(handlerBody)) return true;
  return false;
}

/** THE READER. Pure over source text so the fixture arms can drive it. */
export function readRefreshReach(raw: string): RefreshReach {
  const body = code(raw);
  const handles = queryHandles(body);
  const ex = exemptions(raw);
  const exempt = new Set(ex.exemptions.map((e) => e.name));
  const handler = refreshHandlerBody(body);
  const unreached = handles.filter((h) => {
    if (h.name && exempt.has(h.name)) return false;
    if (handler.text === null) return true;
    return !reached(h, handler.text);
  });
  return {
    handles,
    exemptions: ex.exemptions,
    bareMarkers: ex.bareMarkers,
    handlerSites: handler.sites,
    handlerBody: handler.text,
    unreached,
  };
}

const describeHandle = (h: QueryHandle) =>
  h.name ? `${h.name}${h.path ? ` (${h.path})` : " (custom hook)"}` : `{ … } = ${h.path} (destructured; invalidate-only)`;

/**
 * THE POPULATION — derived from the pages folder rather than typed out, for
 * the reason `section05-guard.test.ts` gives: a typed list has the blind spot
 * of whoever typed it, and this class was missed twice by exactly that.
 */
const staffPages = () =>
  fs
    .readdirSync(PAGES)
    .filter((name) => /^(Admin|Moderator).*\.tsx$/.test(name))
    .map((name) => ({ name, text: fs.readFileSync(path.join(PAGES, name), "utf8") }));

describe("refresh-reach — the population is real and the reader is not empty", () => {
  it("finds the staff pages and reads a plausible number of queries off them", () => {
    /*
      A reach assertion over zero handles is the cheapest false pass there is —
      a broken declaration regex would report every page perfect. The floor is
      well under today's count (28 across nine pages) and well above zero.
    */
    const pages = staffPages();
    expect(pages.length, `staff pages: ${pages.map((p) => p.name).join(", ")}`).toBeGreaterThanOrEqual(9);
    const total = pages.reduce((n, p) => n + readRefreshReach(p.text).handles.length, 0);
    expect(total, "query handles read across all staff pages").toBeGreaterThanOrEqual(20);
  });

  it("every page that declares a query has exactly one onRefresh site", () => {
    const odd = staffPages()
      .map((p) => ({ name: p.name, r: readRefreshReach(p.text) }))
      .filter(({ r }) => r.handles.length > 0 && r.handlerSites !== 1)
      .map(({ name, r }) => `${name}: ${r.handles.length} queries, ${r.handlerSites} onRefresh site(s)`);
    expect(
      odd,
      "A page with queries and no Refresh (or two) is read by a person, not by this arm:\n" + odd.join("\n"),
    ).toEqual([]);
  });
});

describe("refresh-reach — every page-declared query is reached by the page's own Refresh", () => {
  it("no staff page declares a query its onRefresh handler does not refetch or invalidate", () => {
    const findings = staffPages().flatMap(({ name, text }) => {
      const r = readRefreshReach(text);
      const lines: string[] = [];
      if (r.handles.length > 0 && r.handlerBody === null) {
        lines.push(`${name}: ${r.handles.length} queries and the onRefresh handler could not be read`);
      }
      for (const h of r.unreached) lines.push(`${name}: ${describeHandle(h)} is not reached by onRefresh`);
      for (const b of r.bareMarkers) lines.push(`${name}: '${EXEMPT_MARKER}' above ${b} has no reason — a bare marker is not an exemption`);
      return lines;
    });
    expect(
      findings,
      "Issues 747, 759 and 763: a Refresh button that misses a query on its own page.\n" +
        "Reach it (`q.refetch()` or `utils.<path>.invalidate()`) inside the onRefresh handler,\n" +
        `or annotate the declaration with '// ${EXEMPT_MARKER} <reason>':\n` +
        findings.join("\n"),
    ).toEqual([]);
  });

  it("the exemption register is what the source says it is (zero today, and any growth is read here)", () => {
    const register = staffPages().flatMap(({ name, text }) =>
      readRefreshReach(text).exemptions.map((e) => `${name}: ${e.name} — ${e.reason}`),
    );
    /*
      Not an assertion that it is empty forever — an exemption with a written
      reason is the design. It is pinned so a NEW one changes this file's
      expectation and therefore gets read on the PR rather than slipping in
      as a comment nobody diffs.
    */
    expect(register).toEqual([]);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CONTROLS — the reader driven against synthetic pages, both directions.
   The card's own bar: "delete one refetch() from a page and prove the guard
   reddens." These arms do that on every run; if any of them stops going red,
   the arms above are green for the wrong reason.
   ─────────────────────────────────────────────────────────────────────────── */

const NAMED_PAGE = `
export default function Page() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logsQuery = trpc.admin.getAuditLogs.useQuery({ limit: 50 }, { refetchInterval: autoRefresh ? 30000 : false });
  const statsQuery = trpc.admin.getAuditStats.useQuery(undefined);
  const userDetailsQuery = trpc.admin.getUserDetails.useQuery({ userId: selected?.userId ?? 0 }, { enabled: !!selected });
  const utils = trpc.useUtils();
  const handleRefresh = () => {
    logsQuery.refetch();
    statsQuery.refetch();
    /* the selection gate is input validity, not visibility */
    if (selected?.userId) userDetailsQuery.refetch();
    toast.success(\`Data refreshed \${new Date().toISOString()}\`);
  };
  return <StaffBar refreshControls={{ onRefresh: handleRefresh, isRefetching: false }} />;
}`;

const USE_CALLBACK_PAGE = `
export default function Page() {
  const overviewQuery = trpc.admin.getOverview.useQuery(undefined, {});
  const timeSeriesQuery = trpc.admin.getTimeSeries.useQuery(undefined, {});
  const handleRefresh = useCallback(() => {
    overviewQuery.refetch();
    timeSeriesQuery.refetch();
    toast.success("Dashboard refreshed");
  }, [overviewQuery, timeSeriesQuery]);
  return <StaffBar refreshControls={{ onRefresh: handleRefresh }} />;
}`;

const INLINE_PAGE = `
export default function Page() {
  const listQuery = trpc.admin.getBugReports.useQuery({ status }, {});
  const countsQuery = trpc.admin.getBugReportCounts.useQuery(undefined, {});
  const { data: flags } = trpc.admin.getFlags.useQuery(undefined);
  const stateQuery = useCrewState(isAdmin, { live: autoRefresh });
  const utils = trpc.useUtils();
  const refreshControls = useStaffRefresh({
    autoRefresh,
    setAutoRefresh,
    dataUpdatedAt: stateQuery.dataUpdatedAt,
    isRefetching: listQuery.isFetching,
    onRefresh: () => {
      listQuery.refetch();
      countsQuery.refetch();
      void utils.admin.getFlags.invalidate();
      void stateQuery.refetch();
    },
  });
  return <StaffBar refreshControls={refreshControls} />;
}`;

describe("refresh-reach controls — the reader reads every shape the pages actually use", () => {
  it("a named handler: three handles, all reached, one of them behind a selection gate", () => {
    const r = readRefreshReach(NAMED_PAGE);
    expect(r.handles.map((h) => h.name)).toEqual(["logsQuery", "statsQuery", "userDetailsQuery"]);
    expect(r.handlerSites).toBe(1);
    expect(r.handlerBody).toContain("logsQuery.refetch()");
    expect(r.unreached).toEqual([]);
  });

  it("a useCallback handler — the shape the FIRST hand sweep could not see", () => {
    const r = readRefreshReach(USE_CALLBACK_PAGE);
    expect(r.handles.map((h) => h.name)).toEqual(["overviewQuery", "timeSeriesQuery"]);
    expect(r.handlerBody).toContain("timeSeriesQuery.refetch()");
    expect(r.unreached).toEqual([]);
  });

  it("an inline handler — the shape the SECOND hand sweep could not see — with all four handle kinds", () => {
    const r = readRefreshReach(INLINE_PAGE);
    expect(r.handles.map(describeHandle)).toEqual([
      "listQuery (admin.getBugReports)",
      "countsQuery (admin.getBugReportCounts)",
      "{ … } = admin.getFlags (destructured; invalidate-only)",
      "stateQuery (custom hook)",
    ]);
    expect(r.handlerSites).toBe(1);
    expect(r.unreached).toEqual([]);
  });

  it("a template literal with braces inside the handler does not truncate the body", () => {
    // NAMED_PAGE's toast carries `${new Date().toISOString()}` AFTER the gated refetch.
    const r = readRefreshReach(NAMED_PAGE);
    expect(r.handlerBody).toContain("toast.success");
  });

  it("a mutation's onSuccess refetch does NOT count as a reach — only the onRefresh body does", () => {
    const page = NAMED_PAGE.replace("statsQuery.refetch();\n", "").replace(
      "const utils = trpc.useUtils();",
      "const utils = trpc.useUtils();\n  const m = trpc.admin.x.useMutation({ onSuccess: () => { statsQuery.refetch(); } });",
    );
    const r = readRefreshReach(page);
    expect(r.unreached.map((h) => h.name)).toEqual(["statsQuery"]);
  });
});

describe("refresh-reach NEGATIVE CONTROLS — the guard goes red when a reach is deleted", () => {
  it("one refetch() removed from a named handler → exactly that query is unreached", () => {
    const sabotaged = NAMED_PAGE.replace("    statsQuery.refetch();\n", "");
    const r = readRefreshReach(sabotaged);
    expect(r.unreached.map((h) => h.name)).toEqual(["statsQuery"]);
  });

  it("the gated refetch removed → the detail query is unreached (a gate is a reach; its absence is not)", () => {
    const sabotaged = NAMED_PAGE.replace("if (selected?.userId) userDetailsQuery.refetch();", "");
    expect(readRefreshReach(sabotaged).unreached.map((h) => h.name)).toEqual(["userDetailsQuery"]);
  });

  it("one refetch() removed from a useCallback handler → red", () => {
    const sabotaged = USE_CALLBACK_PAGE.replace("timeSeriesQuery.refetch();", "");
    expect(readRefreshReach(sabotaged).unreached.map((h) => h.name)).toEqual(["timeSeriesQuery"]);
  });

  it("the invalidate removed from an inline handler → the destructured query is unreached", () => {
    const sabotaged = INLINE_PAGE.replace("void utils.admin.getFlags.invalidate();", "");
    expect(readRefreshReach(sabotaged).unreached.map(describeHandle)).toEqual([
      "{ … } = admin.getFlags (destructured; invalidate-only)",
    ]);
  });

  it("the custom-hook refetch removed → the hook handle is unreached", () => {
    const sabotaged = INLINE_PAGE.replace("void stateQuery.refetch();", "");
    expect(readRefreshReach(sabotaged).unreached.map((h) => h.name)).toEqual(["stateQuery"]);
  });

  it("a new query added and never reached → red, whichever shape declared it", () => {
    const grown = INLINE_PAGE.replace(
      "const utils = trpc.useUtils();",
      "const eleventhQuery = trpc.admin.getEleventh.useQuery(undefined, {});\n  const utils = trpc.useUtils();",
    );
    expect(readRefreshReach(grown).unreached.map((h) => h.name)).toEqual(["eleventhQuery"]);
  });

  it("a page with queries and NO onRefresh at all → every query is unreached", () => {
    const noButton = `
      export default function Page() {
        const q = trpc.admin.getThing.useQuery(undefined, {});
        return <div>{q.data}</div>;
      }`;
    const r = readRefreshReach(noButton);
    expect(r.handlerSites).toBe(0);
    expect(r.handlerBody).toBeNull();
    expect(r.unreached.map((h) => h.name)).toEqual(["q"]);
  });

  it("a reach mentioned only in a COMMENT is not a reach", () => {
    const sabotaged = NAMED_PAGE.replace("    statsQuery.refetch();\n", "    // statsQuery.refetch(); — turned off while investigating\n");
    expect(readRefreshReach(sabotaged).unreached.map((h) => h.name)).toEqual(["statsQuery"]);
  });
});

describe("refresh-reach — the exemption grammar, both halves, before it has a user", () => {
  it("a marker WITH a reason exempts exactly the declaration beneath it", () => {
    const annotated = NAMED_PAGE.replace("    statsQuery.refetch();\n", "").replace(
      "  const statsQuery =",
      `  // ${EXEMPT_MARKER} polls on its own 3s interval; the button cannot make it fresher\n  const statsQuery =`,
    );
    const r = readRefreshReach(annotated);
    expect(r.exemptions).toEqual([
      { name: "statsQuery", reason: "polls on its own 3s interval; the button cannot make it fresher" },
    ]);
    expect(r.unreached).toEqual([]);
    expect(r.bareMarkers).toEqual([]);
  });

  it("a marker WITHOUT a reason exempts nothing and is itself a finding", () => {
    const bare = NAMED_PAGE.replace("    statsQuery.refetch();\n", "").replace(
      "  const statsQuery =",
      `  // ${EXEMPT_MARKER}\n  const statsQuery =`,
    );
    const r = readRefreshReach(bare);
    expect(r.exemptions).toEqual([]);
    expect(r.bareMarkers).toEqual(["statsQuery"]);
    expect(r.unreached.map((h) => h.name)).toEqual(["statsQuery"]);
  });

  it("an exemption on one query does not leak onto its neighbour", () => {
    const annotated = NAMED_PAGE.replace("    statsQuery.refetch();\n", "").replace(
      "  const logsQuery =",
      `  // ${EXEMPT_MARKER} the list is the stamp's own reader and refetches itself\n  const logsQuery =`,
    );
    const r = readRefreshReach(annotated);
    expect(r.exemptions.map((e) => e.name)).toEqual(["logsQuery"]);
    expect(r.unreached.map((h) => h.name)).toEqual(["statsQuery"]);
  });
});
