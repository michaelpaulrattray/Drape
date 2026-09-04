/**
 * THE SURFACES THE DESIGN-LAW DRIVE MUST VISIT — DERIVED FROM THE ROUTER.
 *
 * The drive used to carry a hand-written list of three addresses (`/casting`,
 * the sheet, `/admin/foundation`) while `client/src/App.tsx` declared
 * twenty-four. Nothing anywhere compared the two, so every page the founder is
 * actually designing on — the lobby, the staff pages, the moderator dashboard
 * — was covered by source-text regexes alone. That is how the red focus ring
 * survived three appearances (#445) and how a stroked-pill status strip
 * reached his eye (#492).
 *
 * A second list shadowing a source of truth always drifts from it (working
 * law 4), so this module does not keep one. It READS the router and joins it
 * against a table that says, for each address, either how to drive it or why
 * it cannot be driven. `planSurfaces()` REFUSES in both directions:
 *
 *   - a route the router declares and this table does not mention — a new
 *     page is in scope the day it is added, without anyone remembering;
 *   - a table entry naming an address the router does not have — the mirror
 *     direction, so a deleted page does not leave a plan behind that quietly
 *     passes because the URL 404s into the catch-all.
 *
 * AND A "CANNOT BE DRIVEN" ENTRY IS A DECLARATION, NEVER A SKIP. It carries a
 * written reason a reader can disagree with. The failure this guards is the one
 * the old drive had in miniature: a surface silently absent from a run reports
 * exactly like a surface that passed.
 */
import fs from "node:fs";
import path from "node:path";

/** Repo root, from this file's own location — no cwd assumption. */
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
export const ROUTER_FILE = path.resolve(HERE, "..", "..", "client", "src", "App.tsx");

/**
 * Fixtures a parameterised address needs before it can be visited.
 *
 * Absent, the surface is REPORTED AS UNVISITED rather than skipped — the run
 * says which fixture it wanted, so "the sheet was never checked" can never read
 * as "the sheet passed".
 */
export type Fixtures = {
  /** A casting session id — the sheet. */
  session?: string;
  /** A signed Cast's public id — the room. */
  cast?: string;
  /** A board id — the canvas. */
  board?: string;
};

/**
 * The existential laws: the ones whose subject may legitimately be absent.
 *
 * A universal law ("no text field wears an inner ring", "no sentence is set in
 * mono") is quantified over whatever the surface holds and is never vacuous — a
 * page with no text fields genuinely satisfies it. An EXISTENTIAL law asserts
 * something is present AND behaves, so on a surface where it is required its
 * absence is the defect rather than a pass. The surfaces name what they hold.
 */
export type ExistentialSubject = "dock" | "briefEcho" | "retentionCopy";

export type SurfacePlan = {
  /** The router path, verbatim — the join key against `App.tsx`. */
  path: string;
  /** Human name in the run's output. */
  label: string;
} & (
  | {
      kind: "drive";
      /** The address to open relative to the base, or null when a fixture is missing. */
      url: (fixtures: Fixtures) => string | null;
      /** Named when `url` returns null, so the report can say what it wanted. */
      fixture?: keyof Fixtures;
      /** An admin session is required to RENDER this at all. */
      staff?: boolean;
      /** Page text to wait for before measuring — never a fixed sleep. */
      waitFor?: string;
      /** Subjects that MUST be present here; absent is a failure. */
      requires?: ExistentialSubject[];
    }
  | { kind: "declared"; reason: string }
);

/**
 * The table. Every address the router declares appears here exactly once.
 *
 * `staff: true` is a statement about RENDERING, not about permission: these
 * pages own their own role guards and redirect a non-admin to `/login` or
 * `/studio`, so driving them without an admin session measures the login page
 * and reports it as the admin page — a false reading, not a missing one.
 */
export const SURFACES: SurfacePlan[] = [
  // Public
  { path: "/", label: "home", kind: "drive", url: () => "/" },
  { path: "/login", label: "login", kind: "drive", url: () => "/login" },
  {
    path: "/verify-email",
    label: "verify email",
    kind: "declared",
    reason:
      "every state of this page is a function of a one-time token in the query string; " +
      "without one it renders its own failure copy, so a drive here would measure the " +
      "error state and report it as the page. Minting a live verification token is a " +
      "write against the users table, which a read-only design drive does not do.",
  },

  // Lobby. Five addresses, one component, one rail — and the surface the
  // founder spends the most time in outside casting.
  { path: "/app", label: "lobby", kind: "drive", url: () => "/app" },
  { path: "/app/boards", label: "lobby / boards", kind: "drive", url: () => "/app/boards" },
  { path: "/app/models", label: "lobby / models", kind: "drive", url: () => "/app/models" },
  { path: "/app/garments", label: "lobby / garments", kind: "drive", url: () => "/app/garments" },
  { path: "/app/looks", label: "lobby / looks", kind: "drive", url: () => "/app/looks" },

  {
    path: "/app/board/:id",
    label: "board canvas",
    kind: "drive",
    fixture: "board",
    url: (f) => (f.board ? `/app/board/${f.board}` : null),
  },

  { path: "/studio", label: "legacy studio", kind: "drive", url: () => "/studio" },

  // Casting. The three the drive already covered, plus what each must hold.
  {
    path: "/casting",
    label: "casting tab",
    kind: "drive",
    url: () => "/casting",
    waitFor: "Meet eight of them",
  },
  {
    path: "/casting/s/:sessionId",
    label: "casting sheet",
    kind: "drive",
    fixture: "session",
    url: (f) => (f.session ? `/casting/s/${f.session}` : null),
    /* `<Dock>` is rendered here (`CastingSheet.tsx:2785`) and on the gallery,
       and NOWHERE else — read at the code, not assumed. The casting TAB has no
       dock, which is why it does not claim one: a required subject that the
       page never had would fail this drive forever and teach a reader to
       ignore it. */
    requires: ["dock"],
  },
  {
    path: "/casting/cast/:castId",
    label: "casting room",
    kind: "drive",
    fixture: "cast",
    url: (f) => (f.cast ? `/casting/cast/${f.cast}` : null),
  },

  // Staff
  {
    path: "/admin",
    label: "admin (redirect)",
    kind: "declared",
    reason:
      "a bare <Redirect> with no markup of its own — it renders /admin/overview, which " +
      "is driven on its own row. Driving both measures the same page twice and would " +
      "report two verdicts about one surface.",
  },
  { path: "/admin/overview", label: "admin / overview", kind: "drive", staff: true, url: () => "/admin/overview" },
  { path: "/admin/audit-logs", label: "admin / audit logs", kind: "drive", staff: true, url: () => "/admin/audit-logs" },
  { path: "/admin/users", label: "admin / users", kind: "drive", staff: true, url: () => "/admin/users" },
  { path: "/admin/change-requests", label: "admin / change requests", kind: "drive", staff: true, url: () => "/admin/change-requests" },
  { path: "/admin/invite-codes", label: "admin / invite codes", kind: "drive", staff: true, url: () => "/admin/invite-codes" },
  { path: "/admin/bug-reports", label: "admin / bug reports", kind: "drive", staff: true, url: () => "/admin/bug-reports" },
  {
    path: "/admin/foundation",
    label: "primitive gallery",
    kind: "drive",
    staff: true,
    url: () => "/admin/foundation",
    waitFor: "Shared app foundation",
    /* The specimen sheet renders every primitive, the dock among them
       (`AdminFoundation.tsx:735`) — so here its absence is a regression in the
       gallery rather than a page that simply has no dock. */
    requires: ["dock"],
  },
  { path: "/admin/crew", label: "admin / crew", kind: "drive", staff: true, url: () => "/admin/crew" },
  { path: "/moderator", label: "moderator dashboard", kind: "drive", staff: true, url: () => "/moderator" },

  // 404
  { path: "/404", label: "not found", kind: "drive", url: () => "/404" },
];

/** A route in `App.tsx`: its literal path, or null for the catch-all. */
export type RouterRoute = { path: string | null; line: number };

/**
 * Read the routes the router actually declares.
 *
 * Deliberately a source read rather than an import: importing `App.tsx` pulls
 * the whole client bundle — three.js, React Flow, the tRPC client — into a node
 * process to learn twenty strings. Both `<Route path="..." component={...} />`
 * and the children form `<Route path="...">` are the same token here.
 *
 * Comments in that file quote route paths in prose ("/casting/foundation is
 * gone"), and a JSX comment block can hold a whole paragraph, so comments are
 * stripped before the scan rather than filtered afterwards.
 */
export function readRouterRoutes(file = ROUTER_FILE): RouterRoute[] {
  const source = fs.readFileSync(file, "utf8");
  /* Blank the comments rather than delete them, so line numbers survive. */
  const blanked = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "));
  const routes: RouterRoute[] = [];
  blanked.split(/\r?\n/).forEach((text, index) => {
    if (!/<Route[\s/>]/.test(text)) return;
    const withPath = /<Route[^>]*?\spath="([^"]+)"/.exec(text);
    routes.push({ path: withPath ? withPath[1] : null, line: index + 1 });
  });
  if (routes.length === 0) {
    throw new Error(
      `designLawSurfaces: no <Route> found in ${file}. A collector that can come up empty ` +
        `reports a complete list either way, so this refuses rather than returning nothing.`,
    );
  }
  return routes;
}

export type PlannedSurface = {
  plan: Extract<SurfacePlan, { kind: "drive" }>;
  /** The address to open, already joined onto the base. */
  url: string;
};

export type Plan = {
  /** Ready to visit, in router order. */
  visit: PlannedSurface[];
  /** Declared undriveable, with the written reason. */
  declared: { path: string; label: string; reason: string }[];
  /** Driveable in principle, held back for want of a fixture. */
  awaitingFixture: { path: string; label: string; fixture: string }[];
};

/**
 * Join the router against the table, refusing on drift in either direction.
 *
 * @param base      Origin to build absolute URLs against.
 * @param fixtures  Ids for the parameterised addresses.
 * @param routes    The router's own routes; injectable so the guard can drive
 *                  this against fixtures instead of against the live App.tsx.
 * @param surfaces  The table; injectable for the same reason. Its duplicate
 *                  check is otherwise untestable, and an untestable check is
 *                  one nobody knows still works.
 */
export function planSurfaces(
  base: string,
  fixtures: Fixtures = {},
  routes: RouterRoute[] = readRouterRoutes(),
  surfaces: SurfacePlan[] = SURFACES,
): Plan {
  const declaredPaths = routes.filter((r) => r.path !== null).map((r) => r.path as string);
  const declaredSet = new Set(declaredPaths);
  const tablePaths = surfaces.map((s) => s.path);
  const tableSet = new Set(tablePaths);

  const duplicates = [...new Set(tablePaths.filter((p, i) => tablePaths.indexOf(p) !== i))];
  if (duplicates.length > 0) {
    throw new Error(
      `designLawSurfaces: duplicate table entries for ${duplicates.join(", ")}. Two rows for ` +
        `one address means one of them is never read, and which one is an accident of order.`,
    );
  }

  const unmapped = [...declaredSet].filter((p) => !tableSet.has(p));
  if (unmapped.length > 0) {
    throw new Error(
      `designLawSurfaces: the router declares ${unmapped.length} address(es) this table does ` +
        `not mention — ${unmapped.join(", ")}. Add each to SURFACES: drive it, or declare in ` +
        `writing why it cannot be driven. A new page is in scope on the day it is added, not ` +
        `on the day somebody remembers it.`,
    );
  }
  const orphaned = tablePaths.filter((p) => !declaredSet.has(p));
  if (orphaned.length > 0) {
    throw new Error(
      `designLawSurfaces: this table names ${orphaned.length} address(es) the router does not ` +
        `have — ${orphaned.join(", ")}. A plan for a deleted page drives the 404 catch-all and ` +
        `passes, which reads exactly like the page passing.`,
    );
  }

  /* Router order, so the run reads down the file the way the file reads. */
  const order = new Map(declaredPaths.map((p, i) => [p, i]));
  const ordered = [...surfaces].sort((a, b) => (order.get(a.path) ?? 0) - (order.get(b.path) ?? 0));

  const plan: Plan = { visit: [], declared: [], awaitingFixture: [] };
  for (const surface of ordered) {
    if (surface.kind === "declared") {
      plan.declared.push({ path: surface.path, label: surface.label, reason: surface.reason });
      continue;
    }
    const relative = surface.url(fixtures);
    if (relative === null) {
      plan.awaitingFixture.push({
        path: surface.path,
        label: surface.label,
        fixture: surface.fixture ?? "(unnamed)",
      });
      continue;
    }
    plan.visit.push({ plan: surface, url: `${base.replace(/\/$/, "")}${relative}` });
  }
  return plan;
}
