/**
 * staffPagesLazy — the staff pages are lazy, the customer pages are not (#744).
 *
 * The client shipped as ONE 636.9 kB (gzip) chunk until 2026-09-12, and the
 * chunk carried the admin panel — and `recharts`, its single largest owner —
 * to every visitor. Making the staff pages lazy in `App.tsx` took the entry
 * chunk to 451.6 kB (−29%) with nothing a customer can see changing.
 *
 * Three one-line ways to undo that silently, and an arm for each:
 *
 *   1. A staff page added (or put back) as a static import — under its own
 *      name or any other: the arm matches the MODULE PATH in an `import … from`
 *      statement, not the identifier (PR #832 review finding 2).
 *   2. A customer page made lazy without a measurement — route splitting can
 *      make navigation SLOWER (the card's own caveat), and a customer route
 *      going lazy is a separate decision with its own before/after.
 *   3. `recharts` reached from a customer-facing module. The weight left the
 *      entry chunk only because its importers are all staff-only; one import
 *      from a shared component puts 116 kB back on every visitor with every
 *      route line unchanged. The arm holds its importers to the staff tree.
 *
 * The population is DERIVED from `App.tsx`'s own route lines rather than
 * transcribed (working law 4). ⚠ The reader sees TWO route shapes — the
 * self-closing `<Route path="…" component={X} />` and the children form
 * `<Route path="…">{(params) => <X …` — and a third shape would escape it; the
 * floor arms say what each shape must find, so a route rewritten into a new
 * shape shows up as a missing one rather than as nothing.
 *
 * Reads are newline-normalised: the assertions are about tokens on a line,
 * and a CRLF working copy (issue #71) must not fail them.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** Comments quote the rule; matching on them would pass on the promise. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

const SRC = resolve(__dirname);
const appSource = code(read(resolve(SRC, "App.tsx")));

/**
 * A page only staff can reach. Every `/admin/*` page and `/moderator` own a
 * role guard (`appRoutes.test.ts` pins it); `/studio` is the legacy studio,
 * sealed to admins by #364. A path outside these is a customer's.
 */
const isStaffPath = (path: string) =>
  path === "/moderator" || path === "/studio" || path.startsWith("/admin/");

/**
 * Every routed page in a source, as (path, component), in both shapes the
 * router uses today. A `<Route path="/admin">` carrying a Redirect matches
 * neither and is not a page.
 */
const routedComponents = (source: string) => [
  ...[...source.matchAll(/<Route path="([^"]+)" component=\{([A-Za-z0-9]+)\} \/>/g)].map((m) => ({
    path: m[1],
    component: m[2],
    shape: "component" as const,
  })),
  ...[...source.matchAll(/<Route path="([^"]+)">\s*\{\(params\) => <([A-Za-z0-9]+)[\s/>]/g)].map((m) => ({
    path: m[1],
    component: m[2],
    shape: "children" as const,
  })),
];

const lazyDeclaration = (component: string) =>
  `const ${component} = staffPage(() => import("./pages/${component}"));`;

/** A static `import … from "./pages/X"` (or the alias form) — whatever the local name. */
const staticPageImport = (component: string) =>
  new RegExp(`^import [^;]* from "(?:\\./|@/)pages/${component}";`, "m");

/** Every .ts/.tsx source under client/src, minus tests. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });

const CHART_IMPORT = /from "(?:recharts|@\/components\/ui\/chart)"/;

describe("#744 — the staff pages are lazy", () => {
  const staff = routedComponents(appSource).filter((r) => isStaffPath(r.path));

  it("finds the staff routes it is supposed to find", () => {
    /* A matcher that silently matches nothing is a green suite proving nothing. */
    const paths = staff.map((r) => r.path);
    expect(paths).toContain("/admin/overview");
    expect(paths).toContain("/moderator");
    expect(paths).toContain("/studio");
    expect(staff.length).toBeGreaterThanOrEqual(10);
  });

  it("declares every staff page with staffPage(() => import(…)) and never imports its module statically", () => {
    for (const { path, component } of staff) {
      expect(appSource, `${path} → ${component} must be a staffPage() route (#744)`).toContain(
        lazyDeclaration(component),
      );
      expect(
        appSource,
        `${path} → ${component}: its module is also imported statically — the lazy route is doing nothing`,
      ).not.toMatch(staticPageImport(component));
    }
  });

  it("mounts a Suspense boundary around the Switch — a lazy page with no boundary throws at render", () => {
    const suspense = appSource.indexOf("<Suspense fallback={null}>");
    const sw = appSource.indexOf("<Switch location={location}>");
    const closeSw = appSource.indexOf("</Switch>");
    const closeSuspense = appSource.indexOf("</Suspense>");
    expect(suspense).toBeGreaterThan(-1);
    expect(sw).toBeGreaterThan(suspense);
    expect(closeSuspense).toBeGreaterThan(closeSw);
  });
});

describe("#744 — the customer pages stay static, on purpose", () => {
  const customer = routedComponents(appSource).filter((r) => !isStaffPath(r.path));

  it("finds the customer routes it is supposed to find, in both shapes", () => {
    const paths = customer.map((r) => r.path);
    expect(paths).toContain("/app");
    expect(paths).toContain("/casting");
    expect(paths).toContain("/app/board/:id");
    /* The children shape — the sheet and the room — must be seen too (finding 3). */
    expect(customer.filter((r) => r.shape === "children").map((r) => r.path)).toEqual(
      expect.arrayContaining(["/casting/s/:sessionId", "/casting/cast/:castId"]),
    );
  });

  it("no customer page is lazy — splitting a customer route is a measured decision, not a tidy-up", () => {
    for (const { path, component } of customer) {
      expect(appSource, `${path} → ${component} went lazy without a measurement (#744)`).not.toMatch(
        new RegExp(`const ${component} = (?:staffPage|lazy)\\(`),
      );
    }
  });
});

describe("#744 — recharts stays inside the staff tree", () => {
  /*
    The weight left the entry chunk only because every importer of `recharts`
    — and of the shadcn `components/ui/chart.tsx` wrapper around it — is
    reached solely from a staff page. A customer-facing module importing
    either puts the library back on every visitor with no route line changing.
    The staff tree is `features/admin/`, `features/moderator/`, `features/staff/`,
    the staff pages themselves, and the wrapper. Everything else is a customer
    module until a measurement says otherwise.
  */
  const STAFF_TREE = [
    "features/admin/",
    "features/moderator/",
    "features/staff/",
    "components/ui/chart.tsx",
    "pages/Admin",
    "pages/Moderator",
    "pages/DrapeStudio",
  ];

  it("every module importing recharts or the chart wrapper is in the staff tree", () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => CHART_IMPORT.test(code(read(f))))
      .map((f) => relative(SRC, f).replace(/\\/g, "/"))
      .filter((rel) => !STAFF_TREE.some((prefix) => rel.startsWith(prefix)));
    expect(
      offenders,
      "a customer-reachable module imports recharts — the entry chunk grows by ~116 kB gzip",
    ).toEqual([]);
  });

  it("finds the importers it is supposed to find", () => {
    const importers = sourceFiles(SRC).filter((f) => CHART_IMPORT.test(code(read(f))));
    expect(importers.length).toBeGreaterThanOrEqual(4);
  });
});

describe("#744 — the matchers can fail (working law 2)", () => {
  it("the route reader finds both shapes in a fixture, and the classifier sorts both kinds", () => {
    /* `CastingV2` carries a digit — the first draft of this reader was
       `[A-Za-z]+` and dropped it, which the customer arm's own control caught.
       The same class once cost the Atlas every `castingV2.*` operation kind. */
    const fixture = `
      <Route path="/admin/overview" component={AdminOverview} />
      <Route path="/app" component={AppLobby} />
      <Route path="/casting" component={CastingV2} />
      <Route path="/casting/s/:sessionId">
        {(params) => <CastingSheet key={params.sessionId} />}
      </Route>
      <Route path="/admin">
        <Redirect to="/admin/overview" replace />
      </Route>
    `;
    expect(routedComponents(fixture)).toEqual([
      { path: "/admin/overview", component: "AdminOverview", shape: "component" },
      { path: "/app", component: "AppLobby", shape: "component" },
      { path: "/casting", component: "CastingV2", shape: "component" },
      { path: "/casting/s/:sessionId", component: "CastingSheet", shape: "children" },
    ]);
    expect(isStaffPath("/admin/overview")).toBe(true);
    expect(isStaffPath("/moderator")).toBe(true);
    expect(isStaffPath("/studio")).toBe(true);
    expect(isStaffPath("/app")).toBe(false);
    expect(isStaffPath("/casting")).toBe(false);
    /* `/admin` bare is the Redirect, not a page; it must not be read as staff-lazy. */
    expect(isStaffPath("/admin")).toBe(false);
  });

  it("the static-import matcher finds the module under any local name, and not the lazy form", () => {
    const m = staticPageImport("AdminOverview");
    expect(m.test('import AdminOverview from "./pages/AdminOverview";')).toBe(true);
    expect(m.test('import AO from "./pages/AdminOverview";')).toBe(true);
    expect(m.test('import { Something } from "@/pages/AdminOverview";')).toBe(true);
    expect(m.test('const AdminOverview = staffPage(() => import("./pages/AdminOverview"));')).toBe(false);
    expect(m.test('import AdminOverviewCard from "./pages/AdminOverviewCard";')).toBe(false);
  });

  it("the recharts matcher finds both import forms and ignores a mention in prose", () => {
    expect(CHART_IMPORT.test('import { Bar } from "recharts";')).toBe(true);
    expect(CHART_IMPORT.test('import { ChartContainer } from "@/components/ui/chart";')).toBe(true);
    expect(CHART_IMPORT.test("// recharts is heavy")).toBe(false);
  });
});
