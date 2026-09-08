/**
 * #699 — THE MODERATOR PANEL'S CLIENT-SIDE GATE, DRIVEN.
 *
 * It was one inline expression in `ModeratorDashboard.tsx` with nothing
 * anywhere testing it. What LOOKED like its coverage was six arms in a SERVER
 * suite reciting the expression back at itself —
 *
 *     const user = { role: "user" };
 *     expect(user.role === "moderator" || user.role === "admin").toBe(false);
 *
 * — which is `"user" === "moderator"`, in a file that cannot render a React
 * component. They were deleted by #697/PR #698. This is what replaces them.
 *
 * ⚠ WHY A PREDICATE RATHER THAN A RENDER. The card offered both roads. There
 * is no DOM environment in this repository — `vitest.config.ts` is
 * `environment: "node"`, its client include ends in `.test.ts` and NOT
 * `.test.tsx`, there are ZERO `.test.tsx` files, no jsdom and no
 * @testing-library, and the config's own comment says component rendering
 * stays out of `pnpm test` deliberately. Adding that is a repository-wide
 * decision, not this card's. So the rule was extracted to where it can be
 * driven, and the arms below cover BOTH halves of what that leaves open:
 * the logic (driven), and whether the component still uses it (guarded at
 * source, with a positive control — the house idiom from
 * `section05-guard.test.ts`).
 *
 * ⚠ THE CARD NUMBER IS IN COMMENTS, NEVER IN A `describe` STRING. `#699` is a
 * valid three-digit hex literal, so inside a string the token guard
 * (`client/src/foundation/token-guard.test.ts`) cannot tell it from a colour —
 * it reddened the gate on this file's first push and said exactly that. The
 * guard strips comments, which is where a card reference belongs.
 *
 * THE TRAP THE CARD NAMED, and it has its own arm: the gate is deliberately
 * false while the session is loading. A test that skipped that term would
 * read "authorised" for the wrong reason.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { isStaffRole, isModeratorPanelUnauthorized, STAFF_ROLES } from "./staffRole";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const raw = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

/*
 * Strip comments, so a docblock explaining a rule cannot trip the rule -
 * the house idiom, taken from `counts416-guard.test.ts`. PR #702 review,
 * finding 2: the wiring arms below read RAW source at first, so a future
 * comment quoting the pre-#699 line - exactly the kind of comment this
 * repository writes, and `UserCard.tsx` now carries one a word away from it -
 * would have falsely reddened them. It failed toward noise rather than
 * silence, which is the right direction and still worth closing.
 */
const read = (rel: string) =>
  raw(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DASHBOARD = "client/src/pages/ModeratorDashboard.tsx";
const FLAG_COUNTS = "client/src/features/staff/useModeratorFlagCounts.ts";
const USER_CARD = "client/src/components/UserCard.tsx";

/* A settled, signed-in session — the state every role arm below varies. */
const settled = (role: string | null | undefined) => ({
  loading: false,
  isAuthenticated: true,
  role,
});

/* card #699 */
describe("the moderator panel gate — who it admits", () => {
  it("a MODERATOR is admitted", () => {
    expect(isModeratorPanelUnauthorized(settled("moderator"))).toBe(false);
  });

  it("an ADMIN is admitted — the client must not be narrower than the server", () => {
    /* The capability grid's footnote 1: admins pass `moderatorProcedure` and
       inherit the entire moderator surface. A client gate that refused them
       would lock an admin out of a panel the server serves them. */
    expect(isModeratorPanelUnauthorized(settled("admin"))).toBe(false);
  });

  it("a PLAIN USER is refused", () => {
    expect(isModeratorPanelUnauthorized(settled("user"))).toBe(true);
  });

  it("a role the product does not have is refused — the list is an allowlist, not a denylist", () => {
    /* `role` arrives from a query, so an unrecognised value must fail CLOSED.
       A gate written as `role !== "user"` would admit every one of these. */
    for (const role of ["superuser", "Moderator", "ADMIN", "", "staff", "owner"]) {
      expect(isModeratorPanelUnauthorized(settled(role)), `role: ${role}`).toBe(true);
    }
    expect(isModeratorPanelUnauthorized(settled(null))).toBe(true);
    expect(isModeratorPanelUnauthorized(settled(undefined))).toBe(true);
  });
});

/* card #699 */
describe("the moderator panel gate — the two terms that are not about the role", () => {
  it("a session still LOADING is not refused — the card's own named trap", () => {
    /*
      The panel's guard ladder is loading -> unauthenticated -> unauthorised,
      and `<StaffLoading />` owns the first rung. If this answered true, a
      moderator would be bounced to /app during their own page load, because
      the role has not arrived yet.
    */
    expect(isModeratorPanelUnauthorized({ loading: true, isAuthenticated: true, role: undefined })).toBe(false);
    expect(isModeratorPanelUnauthorized({ loading: true, isAuthenticated: true, role: "user" })).toBe(false);
    expect(isModeratorPanelUnauthorized({ loading: true, isAuthenticated: false, role: null })).toBe(false);
  });

  it("a SIGNED-OUT visitor is not refused HERE — they belong at /login, not /app", () => {
    /*
      `!isAuthenticated` is handled by the rung above this one, which redirects
      to /login. Answering true here would send a signed-out person to /app and
      an "Access denied" toast, when what they need is the sign-in page.
    */
    expect(isModeratorPanelUnauthorized({ loading: false, isAuthenticated: false, role: null })).toBe(false);
    expect(isModeratorPanelUnauthorized({ loading: false, isAuthenticated: false, role: "user" })).toBe(false);
  });
});

/* card #699 */
describe("isStaffRole — the rule the two call sites now share", () => {
  it("admits exactly the two staff roles and nothing else", () => {
    expect(isStaffRole("moderator")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    for (const role of ["user", "", "Admin", "moderators", null, undefined]) {
      expect(isStaffRole(role as string | null | undefined), `role: ${role}`).toBe(false);
    }
  });

  it("STAFF_ROLES is the whole population, so the list and the predicate cannot drift", () => {
    /* Derived, not transcribed: every member must be admitted, and the
       predicate must admit nothing outside it. */
    expect([...STAFF_ROLES].sort()).toEqual(["admin", "moderator"]);
    for (const role of STAFF_ROLES) expect(isStaffRole(role)).toBe(true);
  });
});

/* card #699 */
describe("the component still USES the rule rather than re-deriving it", () => {
  /*
    The arms above prove the LOGIC. These prove the WIRING — that a future
    edit does not quietly put an inline comparison back, which is exactly the
    state this card was filed about. A predicate nobody calls is invariant 7.
  */
  const INLINE_ROLE_GATE = /role\s*!==\s*["']moderator["']|role\s*===\s*["']moderator["']/;

  it("ModeratorDashboard calls the predicate", () => {
    expect(read(DASHBOARD)).toMatch(/isModeratorPanelUnauthorized\(\s*\{/);
  });

  it("ModeratorDashboard states no role comparison of its own", () => {
    expect(read(DASHBOARD)).not.toMatch(INLINE_ROLE_GATE);
  });

  it("useModeratorFlagCounts calls the predicate and states no comparison of its own", () => {
    const text = read(FLAG_COUNTS);
    expect(text).toMatch(/isStaffRole\(/);
    expect(text).not.toMatch(INLINE_ROLE_GATE);
  });

  it("UserCard's Moderation row asks the same rule — the third call site", () => {
    /*
      Found by the PR #702 review's law-7 sweep, after mine stopped at two.
      This one gates the account menu's Moderation row, which LINKS to the
      panel the predicate guards — so a drift between them is visible to a
      person: shown the row, bounced by the panel behind it.
    */
    const text = read(USER_CARD);
    expect(text).toMatch(/isStaffRole\(role\)/);
    expect(text).not.toMatch(INLINE_ROLE_GATE);
  });

  it("POSITIVE CONTROL — the inline matcher catches the shape it hunts", () => {
    /*
      Without this, the two `not.toMatch` arms above would pass over a matcher
      that matches nothing at all — an absence assertion is green on anything
      (`absence-only-expect-passes-on-nothing`). This is the exact line that
      was in `ModeratorDashboard.tsx` before this change.
    */
    const before = `const isUnauthorized = !loading && isAuthenticated && user?.role !== "moderator" && user?.role !== "admin";`;
    expect(before).toMatch(INLINE_ROLE_GATE);
    const flagCountsBefore = `const isStaff = user?.role === "moderator" || user?.role === "admin";`;
    expect(flagCountsBefore).toMatch(INLINE_ROLE_GATE);
  });

  it("the gate still drives BOTH the redirect and the toast", () => {
    /* The rule is used twice on that page and losing either is a real
       regression: the redirect is the guard, the toast is why it happened. */
    const text = read(DASHBOARD);
    expect(text).toMatch(/if\s*\(isUnauthorized\)\s*return\s*<Redirect to="\/app"\s*\/>/);
    expect(text).toMatch(/if\s*\(isUnauthorized\)\s*toast\.error\(/);
  });
});
