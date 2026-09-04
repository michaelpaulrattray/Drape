import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  planSurfaces,
  readRouterRoutes,
  SURFACES,
  type RouterRoute,
} from "../scripts/lib/designLawSurfaces.mts";

/**
 * THE DESIGN-LAW DRIVE COVERS EVERY ADDRESS THE ROUTER DECLARES.
 *
 * This is the arm that makes #512 stay fixed. The drive visited three addresses
 * while `client/src/App.tsx` declared twenty-four, and nothing anywhere
 * compared the two — so the lobby, nine staff pages, the moderator dashboard
 * and the legacy studio were guarded by source-text regexes alone, which is how
 * the red focus ring survived three appearances (#445) and a stroked-pill
 * status strip reached the founder's eye (#492).
 *
 * The repair is not "remember to add new pages". It is that `planSurfaces()`
 * REFUSES when the router and the drive's table disagree, in either direction,
 * and this suite runs that refusal against the real tree. Add a `<Route>` and
 * the gate reddens until the surface is either driven or declared undriveable
 * IN WRITING.
 *
 * Working law 2 throughout: every arm that asserts an absence carries a
 * positive control in which the same assertion must fail, because a checker
 * that cannot fail proves nothing about the tree it just passed.
 */

/** A router fixture, so the drift arms do not depend on the real App.tsx. */
const route = (path: string | null, line = 1): RouterRoute => ({ path, line });

describe("the surface table is joined to the router, not copied from it", () => {
  it("REFUSES a route the table does not mention", () => {
    const routes = [...SURFACES.map((s) => route(s.path)), route("/app/newthing")];
    expect(() => planSurfaces("http://x", {}, routes)).toThrow(/does not mention/);
  });

  it("names the offending address, so the message is actionable", () => {
    const routes = [...SURFACES.map((s) => route(s.path)), route("/app/newthing")];
    expect(() => planSurfaces("http://x", {}, routes)).toThrow(/\/app\/newthing/);
  });

  it("REFUSES a table entry the router no longer has", () => {
    const routes = SURFACES.filter((s) => s.path !== "/moderator").map((s) => route(s.path));
    expect(() => planSurfaces("http://x", {}, routes)).toThrow(/does not\s+have|does not have/);
  });

  it("REFUSES two table rows claiming one address", () => {
    /* A duplicate means one row is never read, and which one is an accident of
       order. The table is injected here because a check nobody can drive is a
       check nobody knows still works. */
    const routes = SURFACES.map((s) => route(s.path));
    const table = [...SURFACES, SURFACES[0]];
    expect(() => planSurfaces("http://x", {}, routes, table)).toThrow(/duplicate/);
    expect(() => planSurfaces("http://x", {}, routes, table)).toThrow(SURFACES[0].path);
  });

  it("POSITIVE CONTROL: the same table without the duplicate passes", () => {
    const routes = SURFACES.map((s) => route(s.path));
    expect(() => planSurfaces("http://x", {}, routes, [...SURFACES])).not.toThrow();
  });

  it("POSITIVE CONTROL: the agreement arms pass on a router that matches", () => {
    const routes = SURFACES.map((s) => route(s.path));
    expect(() => planSurfaces("http://x", {}, routes)).not.toThrow();
  });

  it("the catch-all <Route> with no path is not treated as an address", () => {
    const routes = [...SURFACES.map((s) => route(s.path)), route(null)];
    expect(() => planSurfaces("http://x", {}, routes)).not.toThrow();
  });
});

describe("against the real tree", () => {
  it("reads the routes out of App.tsx, and there are many of them", () => {
    const routes = readRouterRoutes();
    expect(routes.length).toBeGreaterThan(15);
    expect(routes.some((r) => r.path === "/casting")).toBe(true);
    expect(routes.some((r) => r.path === "/admin/users")).toBe(true);
    /* The catch-all is a real <Route> and must be seen as pathless, not lost. */
    expect(routes.some((r) => r.path === null)).toBe(true);
  });

  it("does not mistake a route path QUOTED IN A COMMENT for a route", () => {
    /*
      App.tsx's comments discuss dead addresses in prose — "/casting/foundation
      is gone", "/admin typed into the bar was a 404". A scan that counted those
      would demand table rows for pages that do not exist.
    */
    const routes = readRouterRoutes();
    expect(routes.some((r) => r.path === "/casting/foundation")).toBe(false);
  });

  it("reads a <Route> whose path attribute WRAPPED onto the next line", () => {
    /*
      Reviewer finding on PR #522, and its blind spot failed silently in the one
      direction that matters: a line-based scan read a wrapped tag as the
      PATHLESS catch-all, so a NEW page never entered the declared set, the
      coverage arm never demanded a table row, and it escaped the drive
      entirely — the exact failure this module exists to refuse.
    */
    const file = path.join(os.tmpdir(), `designlaw-wrapped-${process.pid}.tsx`);
    fs.writeFileSync(
      file,
      `<Switch>\n  <Route\n    path="/app/newthing"\n    component={New}\n  />\n  <Route component={NotFound} />\n</Switch>\n`,
      "utf8",
    );
    try {
      const routes = readRouterRoutes(file);
      expect(routes.map((r) => r.path)).toEqual(["/app/newthing", null]);
    } finally {
      fs.unlinkSync(file);
    }
  });

  it("REFUSES a <Route> it cannot parse rather than calling it the catch-all", () => {
    const file = path.join(os.tmpdir(), `designlaw-unparseable-${process.pid}.tsx`);
    fs.writeFileSync(file, `<Route somethingElse={x} />\n<Route component={NotFound} />\n`, "utf8");
    try {
      expect(() => readRouterRoutes(file)).toThrow(/neither a path= nor a component=/);
    } finally {
      fs.unlinkSync(file);
    }
  });

  it("REFUSES a second pathless <Route> — one catch-all, or a path went unread", () => {
    const file = path.join(os.tmpdir(), `designlaw-two-catchalls-${process.pid}.tsx`);
    fs.writeFileSync(file, `<Route component={A} />\n<Route component={NotFound} />\n`, "utf8");
    try {
      expect(() => readRouterRoutes(file)).toThrow(/2 pathless/);
    } finally {
      fs.unlinkSync(file);
    }
  });

  it("POSITIVE CONTROL: one catch-all beside real routes is accepted", () => {
    const file = path.join(os.tmpdir(), `designlaw-ok-${process.pid}.tsx`);
    fs.writeFileSync(file, `<Route path="/a" component={A} />\n<Route component={NotFound} />\n`, "utf8");
    try {
      expect(readRouterRoutes(file).map((r) => r.path)).toEqual(["/a", null]);
    } finally {
      fs.unlinkSync(file);
    }
  });

  it("THE COVERAGE ARM — every declared address is driven or declared undriveable", () => {
    /* This is the whole point. It throws with the offending path when a page is
       added to the router and not to the drive. */
    expect(() => planSurfaces("http://localhost:3000")).not.toThrow();
  });

  it("the staff pages and the lobby are actually in the plan", () => {
    const plan = planSurfaces("http://localhost:3000");
    const driven = plan.visit.map((v) => v.plan.path);
    for (const path of ["/app", "/app/boards", "/admin/users", "/admin/overview", "/moderator"]) {
      expect(driven, path).toContain(path);
    }
    /* And they are marked as needing an admin session, or the drive measures a
       login page and reports it as the admin page. */
    for (const v of plan.visit.filter((s) => s.plan.path.startsWith("/admin") || s.plan.path === "/moderator")) {
      expect(v.plan.staff, v.plan.path).toBe(true);
    }
  });

  it("an undriveable surface carries a written reason, never a bare skip", () => {
    const plan = planSurfaces("http://localhost:3000");
    expect(plan.declared.length).toBeGreaterThan(0);
    for (const d of plan.declared) {
      expect(d.reason.length, d.path).toBeGreaterThan(40);
    }
  });

  it("a surface held back for a fixture NAMES the fixture", () => {
    const plan = planSurfaces("http://localhost:3000");
    expect(plan.awaitingFixture.map((a) => a.path)).toContain("/casting/s/:sessionId");
    for (const a of plan.awaitingFixture) {
      expect(a.fixture, a.path).not.toBe("(unnamed)");
    }
  });

  it("given its fixtures, every parameterised surface becomes visitable", () => {
    const plan = planSurfaces("http://localhost:3000", { session: "s1", cast: "c1", board: "b1" });
    expect(plan.awaitingFixture).toEqual([]);
    expect(plan.visit.some((v) => v.url.endsWith("/casting/s/s1"))).toBe(true);
  });

  it("the sheet claims the brief echo, and NOTHING claims retention copy", () => {
    /*
      Reviewer finding on PR #522: two existential subjects shipped with no
      surface declaring them. The echo was an oversight and is declared now —
      `CastingSheet.tsx:2536` renders `<BriefEcho>` once the roll has loaded and
      `BriefEcho.tsx:158` is the only `.dpc-echo` in the product.

      `retentionCopy` is deliberately claimed by nobody, and this arm pins that
      so a later shift does not "fix" it: the unsigned-sheets section is
      conditional on DATA (`CastingV2.tsx:945`, `openSessions.data.length > 0`),
      so no address holds it unconditionally and any account with no open
      sessions — the drive's own bot, every run — would fail forever.
    */
    const claims = (subject: string) =>
      SURFACES.filter((s) => s.kind === "drive" && s.requires?.includes(subject as never)).map((s) => s.path);
    expect(claims("briefEcho")).toEqual(["/casting/s/:sessionId"]);
    expect(claims("retentionCopy")).toEqual([]);
  });

  it("only the sheet and the specimen gallery claim to hold a dock", () => {
    /*
      Read at the code, not assumed: `<Dock>` is rendered in CastingSheet.tsx
      and AdminFoundation.tsx and nowhere else. The first version of this table
      claimed the casting TAB held one, which made the drive report a violation
      against a page that has never had a dock — a required subject a page never
      had would fail forever and teach a reader to ignore the run.
    */
    const claiming = SURFACES.filter(
      (s) => s.kind === "drive" && s.requires?.includes("dock"),
    ).map((s) => s.path);
    expect(claiming.sort()).toEqual(["/admin/foundation", "/casting/s/:sessionId"]);
  });
});
