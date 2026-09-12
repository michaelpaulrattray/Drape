/**
 * staffPagesLazy — the staff pages are lazy, the customer pages are not (#744).
 *
 * The client shipped as ONE 636.9 kB (gzip) chunk until 2026-09-12, and the
 * chunk carried the admin panel — and `recharts`, its single largest owner —
 * to every visitor. Making the staff pages `lazy()` in `App.tsx` took the
 * entry chunk to 451.6 kB (−29%) with nothing a customer can see changing.
 *
 * Two things can undo that silently, and each is one line:
 *
 *   1. A staff page added (or put back) as a static import — the next admin
 *      page written the old way puts its weight back on every customer.
 *   2. A customer page made lazy without a measurement — route splitting can
 *      make navigation SLOWER (the card's own caveat), and a customer route
 *      going lazy is a separate decision with its own before/after. This suite
 *      refuses it until that decision is written down here.
 *
 * The population is DERIVED from `App.tsx`'s own `<Route … component={X} />`
 * lines rather than transcribed (working law 4): a route added tomorrow is
 * classified by its path and checked, whichever way it was written.
 *
 * Reads are newline-normalised: the assertions are about tokens on a line,
 * and a CRLF working copy (issue #71) must not fail them.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** Comments quote the rule; matching on them would pass on the promise. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

const appSource = code(read(resolve(__dirname, "App.tsx")));

/**
 * A page only staff can reach. Every `/admin/*` page and `/moderator` own a
 * role guard (`appRoutes.test.ts` pins it); `/studio` is the legacy studio,
 * sealed to admins by #364. A path outside these is a customer's.
 */
const isStaffPath = (path: string) =>
  path === "/moderator" || path === "/studio" || path.startsWith("/admin/");

/** Every `<Route path="…" component={X} />` in a source, as (path, component). */
const routedComponents = (source: string) =>
  [...source.matchAll(/<Route path="([^"]+)" component=\{([A-Za-z0-9]+)\} \/>/g)].map((m) => ({
    path: m[1],
    component: m[2],
  }));

const lazyDeclaration = (component: string) =>
  `const ${component} = lazy(() => import("./pages/${component}"));`;

const staticImport = (component: string) => new RegExp(`^import \{? ?${component} ?\}? from "\./`, "m");

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

  it("declares every staff page with lazy(() => import(…)) and never as a static import", () => {
    for (const { path, component } of staff) {
      expect(appSource, `${path} → ${component} must be a lazy() page (#744)`).toContain(
        lazyDeclaration(component),
      );
      expect(appSource, `${path} → ${component} is also imported statically — the lazy() is doing nothing`).not.toMatch(
        staticImport(component),
      );
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

  it("finds the customer routes it is supposed to find", () => {
    const paths = customer.map((r) => r.path);
    expect(paths).toContain("/app");
    expect(paths).toContain("/casting");
    expect(paths).toContain("/app/board/:id");
  });

  it("no customer page is lazy — splitting a customer route is a measured decision, not a tidy-up", () => {
    for (const { path, component } of customer) {
      expect(appSource, `${path} → ${component} went lazy without a measurement (#744)`).not.toContain(
        `const ${component} = lazy(`,
      );
    }
  });
});

describe("#744 — the matchers can fail (working law 2)", () => {
  /* The staff arm above passes only if lazyDeclaration() matches the line App.tsx really carries. */
  it("the route reader finds a route in a fixture, and the classifier sorts both kinds", () => {
    const fixture = `
      <Route path="/admin/overview" component={AdminOverview} />
      <Route path="/app" component={AppLobby} />
    `;
    expect(routedComponents(fixture)).toEqual([
      { path: "/admin/overview", component: "AdminOverview" },
      { path: "/app", component: "AppLobby" },
    ]);
    expect(isStaffPath("/admin/overview")).toBe(true);
    expect(isStaffPath("/moderator")).toBe(true);
    expect(isStaffPath("/studio")).toBe(true);
    expect(isStaffPath("/app")).toBe(false);
    expect(isStaffPath("/casting")).toBe(false);
    /* `/admin` bare is the Redirect, not a page; it must not be read as staff-lazy. */
    expect(isStaffPath("/admin")).toBe(false);
  });

  it("the static-import matcher finds a static import when there is one", () => {
    expect(staticImport("AdminOverview").test('import AdminOverview from "./pages/AdminOverview";')).toBe(true);
    expect(staticImport("BoardPage").test('import { BoardPage } from "./features/boards/BoardPage";')).toBe(true);
    expect(staticImport("AdminOverview").test('const AdminOverview = lazy(() => import("./pages/AdminOverview"));')).toBe(false);
  });
});
