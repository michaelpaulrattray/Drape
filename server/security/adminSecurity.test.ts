/**
 * ADMIN SECURITY — driven, not recited (#697, the law-7 class of #681).
 *
 * # What this file used to be, MEASURED rather than described
 *
 * Eight arms, all green, and a sabotage driver
 * (`scripts/_697-adminsecurity-sabotage-disposable.mts --before`) put numbers
 * on what they held: **the admin allowlist could be deleted, inverted, or made
 * to admit everybody and not one arm went red.** Four separate allowlist
 * sabotages reddened NOTHING, while the two arms whose own titles said
 * *allowlist* asserted `typeof result.allowed === "boolean"` and
 * `toHaveProperty("allowed")` — statements every possible return value
 * satisfies. `changePlan` could leave the sensitive-action list with nothing
 * red, and the unauthorized-access alert could stop naming who attempted it.
 *
 * ⚠ **AND THE REASON THOSE TWO ARMS WERE WRITTEN THAT WAY IS THE FINDING, not
 * carelessness.** `ADMIN_ALLOWLIST` is built ONCE, at module load, out of
 * `OWNER_OPEN_ID` and `OWNER_NAME`. Neither is set in this repository's `.env`,
 * `vitest.setup.ts` does not supply them, so under the unit suite the list is
 * EMPTY — and an empty list returns `true` for everyone. The allowlist branch
 * was therefore **unreachable in the only world the suite ever ran in**, and the
 * assertions had been softened until they matched a function that could only
 * ever say yes. That is invariant 7's shape wearing a green tick: not a weak
 * test of a live control, but a control the test could not reach.
 *
 * So the regime is ARMED here rather than inherited. `loadModule` stubs the two
 * variables and re-imports through `vi.resetModules()`, because a module-load
 * capture cannot be re-read any other way, and both regimes get their own arms.
 *
 * # The bar this file is held to
 *
 * #697's, verbatim: *"whatever is rewritten is proven by a SABOTAGE OF THE
 * PRODUCT, not by reading."* Every arm below is named in
 * `scripts/_697-adminsecurity-sabotage-disposable.mts`, which asserts the
 * reddened set EXACTLY and carries a no-op control.
 *
 * # ⚠ WHAT THIS FILE STILL DOES NOT DRIVE, said rather than implied
 *
 * `writeImmutableLog` has **no arm here, and had none before** — the old file
 * imported it and never called it, and this one does not import it. So nothing
 * was lost, but "this module is driven now" would be too big a sentence: one
 * export of it is not. It is deliberate rather than overlooked. That control is
 * already on `CLAUDE.md`'s *"Currently not enforced — do not rely on these"*
 * list (the hash chain is in-memory, resets every deploy, and its Slack backup
 * no-ops when Slack is unconfigured, which production is), so an arm proving it
 * behaves would be proving the behaviour of a control the product does not
 * currently get anything from. Driving it is worth doing WITH that repair, not
 * before it, and it is recorded on the follow-up card rather than left for
 * someone to discover from the import list.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Slack is a COLLABORATOR here, never the subject. The subject is always a real
 * exported function of `adminSecurity.ts`, called for its own behaviour; the
 * mock exists so that behaviour has somewhere observable to land. That is the
 * distinction #697 is about — an arm that calls the mock itself and then
 * asserts the mock is the shape being removed, and there is none below.
 */
vi.mock("../slack/slackNotification", () => ({
  SlackAlerts: {
    adminAction: vi.fn().mockResolvedValue(undefined),
    sensitiveAdminAction: vi.fn().mockResolvedValue(undefined),
    unauthorizedAdminAccess: vi.fn().mockResolvedValue(undefined),
  },
  sendSlackAlert: vi.fn().mockResolvedValue(true),
  sendAuditLogEntry: vi.fn().mockResolvedValue(true),
}));

/**
 * The audit write is mocked for the same reason and read for the same kind of
 * fact: `logAdminAction` chooses the row's SEVERITY from the action, and
 * nothing anywhere drove that choice before this file did.
 */
vi.mock("../auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

/**
 * THE ALLOWLIST IS CAPTURED AT MODULE LOAD, so the regime is chosen by
 * re-importing rather than by setting a variable a running module has already
 * read.
 *
 * ⚠ **`vi.resetModules()` DOES NOT GIVE FRESH SPIES, AND THE FIRST DRAFT OF
 * THIS COMMENT SAID IT DID.** The mock registry outlives a module reset: the
 * same `vi.fn()` objects are handed to every re-import, so calls ACCUMULATE
 * across arms. Written the wrong way round, run, and corrected at the failure
 * — the `not.toHaveBeenCalled()` arm below went red on a call the previous
 * test had made. It is recorded rather than quietly edited because an arm
 * asserting a spy was *not* called is worthless if a sibling can have called
 * it, and that is exactly the silent-pass this card exists to remove.
 *
 * `vi.clearAllMocks()` is therefore part of loading, not decoration.
 *
 * `""` rather than `undefined` for the empty regime on purpose — `ADMIN_ALLOWLIST`
 * filters falsy entries, and a blank Railway variable arrives as exactly that.
 */
async function loadModule(env: { ownerOpenId: string; ownerName: string }) {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("OWNER_OPEN_ID", env.ownerOpenId);
  vi.stubEnv("OWNER_NAME", env.ownerName);
  const security = await import("./adminSecurity");
  const { SlackAlerts } = await import("../slack/slackNotification");
  const { logAuditEvent } = await import("../auditLog");
  return { security, SlackAlerts, logAuditEvent };
}

/** The suite's own world, matching the deployed one: no owner variables set. */
const EMPTY_ALLOWLIST = { ownerOpenId: "", ownerName: "" };
/** A populated list, in the only shape the environment can produce: strings. */
const POPULATED_ALLOWLIST = { ownerOpenId: "owner-open-id", ownerName: "owner@klieglabs.com" };
/**
 * A list whose entry LOOKS like a user id — the configuration someone reaches
 * for when they want to allowlist admin 42, and the one #727 is about.
 */
const ID_SHAPED_ALLOWLIST = { ownerOpenId: "42", ownerName: "" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the admin allowlist — which regime the product is actually in", () => {
  /**
   * ⚠ THIS IS THE PRODUCTION STATE AND IT IS WRITTEN DOWN AS ONE. `CLAUDE.md`'s
   * *"Currently not enforced — do not rely on these"* list opens with this
   * control: *"admits everyone when empty, and it is empty in production. Admin
   * access is role-only."* The arm exists so that sentence stops being a claim
   * in a document and becomes a driven fact — and so that anyone who later
   * populates the list finds out here that they have changed who can reach the
   * admin surface.
   */
  it("an EMPTY allowlist admits every database admin — the documented production state, driven", async () => {
    const { security } = await loadModule(EMPTY_ALLOWLIST);

    expect(security.isOnAdminAllowlist("a-stranger@example.com", "no-such-open-id")).toBe(true);
    expect(security.validateAdminAccess({
      id: 999_999,
      role: "admin",
      email: "a-stranger@example.com",
    }).allowed).toBe(true);
  });

  it("an admin allowed by an empty allowlist carries no reason at all", async () => {
    const { security } = await loadModule(EMPTY_ALLOWLIST);

    /* The whole return value, not a field of it — invariant 8's habit. A
       `reason` riding an allowed result is how a denial message ends up on a
       screen that granted access. */
    expect(security.validateAdminAccess({ id: 1, role: "admin", email: "owner@example.com" }))
      .toEqual({ allowed: true });
  });

  it("a POPULATED allowlist admits the admin whose openId is on it", async () => {
    const { security } = await loadModule(POPULATED_ALLOWLIST);

    expect(security.isOnAdminAllowlist(undefined, "owner-open-id")).toBe(true);
    expect(security.validateAdminAccess({
      id: 999,
      role: "admin",
      email: "unrelated@example.com",
      openId: "owner-open-id",
    })).toEqual({ allowed: true });
  });

  it("a POPULATED allowlist admits the admin whose email is on it", async () => {
    const { security } = await loadModule(POPULATED_ALLOWLIST);

    expect(security.isOnAdminAllowlist("owner@klieglabs.com")).toBe(true);
  });

  /**
   * The arm the old file's second test was NAMED for and never made. It needs
   * the populated regime to exist at all, which is why it could not be written
   * against a module whose list was empty in every run.
   */
  it("a POPULATED allowlist REFUSES an admin who is not on it — the branch an empty list makes unreachable", async () => {
    const { security } = await loadModule(POPULATED_ALLOWLIST);

    expect(security.isOnAdminAllowlist("attacker@example.com", "not-the-owner")).toBe(false);
    expect(security.validateAdminAccess({
      id: 999,
      role: "admin",
      email: "attacker@example.com",
      openId: "not-the-owner",
    })).toEqual({
      allowed: false,
      reason: "User is not on admin allowlist despite having admin role",
    });
  });

  /**
   * ⚠ THE DEAD BRANCH IS GONE, AND THIS ARM REPLACED THE ONE THAT PINNED IT
   * (#727, 2026-09-09). `isOnAdminAllowlist` used to take `userId: number` and
   * compare it against the list with `ADMIN_ALLOWLIST.includes(userId)`. The
   * list can only be populated from `process.env`, whose values are strings, so
   * `["42"].includes(42)` was `false` and that branch could not fire in any
   * deployed configuration — proven by a sabotage that deleted it outright and
   * reddened nothing. The branch, the `userId` parameter and the
   * `(number | string)[]` type went together. **Nothing about who is admitted
   * changed**, which is why this is not a behaviour change on the admin surface.
   *
   * What replaces it guards the other direction, which is the one that now
   * matters. Making a numeric id admit is a WIDENING of who reaches the admin
   * surface and is the founder's call, not a shift's; this arm is what goes red
   * if an id road is ever added quietly. It drives `validateAdminAccess`,
   * because after the repair that is the only caller still holding a user id.
   */
  it("an id that matches the allowlist entry does not admit — the list holds strings, and there is no id road", async () => {
    const { security } = await loadModule(ID_SHAPED_ALLOWLIST);

    /* The openId road works in this regime, so the refusal below is about the
       ID and not about the fixture being broken. */
    expect(security.validateAdminAccess({ id: 42, role: "admin", openId: "42" }))
      .toEqual({ allowed: true });

    /* The same admin, the same id, and the list literally contains "42" —
       refused, because an id is not a thing this list can match. */
    expect(security.validateAdminAccess({ id: 42, role: "admin", openId: "not-the-owner" })).toEqual({
      allowed: false,
      reason: "User is not on admin allowlist despite having admin role",
    });
  });
});

describe("validateAdminAccess — the role gate in front of the allowlist", () => {
  it("a non-admin role is refused, and the reason names the role as the thing that refused it", async () => {
    const { security } = await loadModule(EMPTY_ALLOWLIST);

    expect(security.validateAdminAccess({ id: 1, role: "user", email: "user@example.com" })).toEqual({
      allowed: false,
      reason: "User does not have admin role",
    });
  });

  /**
   * The ORDER of the two checks, which is a fact about the reason a refused
   * person is given. A moderator who happens to be the owner is refused for the
   * ROLE, not told they are missing from a list they are on.
   */
  it("the role is checked BEFORE the allowlist — a listed non-admin is still refused, for the role", async () => {
    const { security } = await loadModule(POPULATED_ALLOWLIST);

    expect(security.validateAdminAccess({
      id: 1,
      role: "moderator",
      email: "owner@klieglabs.com",
      openId: "owner-open-id",
    })).toEqual({ allowed: false, reason: "User does not have admin role" });
  });
});

describe("isSensitiveAction — the list that decides which alert an action gets", () => {
  /**
   * The six are STATED here rather than read out of the module, because
   * `SENSITIVE_ACTIONS` is not exported and a test that imported the very list
   * it is checking would assert nothing (that is this card's whole subject).
   * The independent statement is the point: a name silently leaving the
   * product's list reddens this arm, which is what the `changePlan` sabotage
   * drives.
   */
  it("every action the product declares sensitive is answered sensitive", async () => {
    const { security } = await loadModule(EMPTY_ALLOWLIST);

    for (const action of [
      "suspendUser",
      "adjustCredits",
      "blockIP",
      "deleteModel",
      "changePlan",
      "cancelSubscription",
    ]) {
      expect(security.isSensitiveAction(action), `${action} must be sensitive`).toBe(true);
    }
  });

  it("an ordinary action is not sensitive — the control that makes the arm above mean something", async () => {
    const { security } = await loadModule(EMPTY_ALLOWLIST);

    for (const action of ["listUsers", "getAuditLogs", "viewDashboard", ""]) {
      expect(security.isSensitiveAction(action), `${action} must not be sensitive`).toBe(false);
    }
  });
});

describe("logAdminAction — where an admin action actually lands", () => {
  it("a sensitive action reaches the SENSITIVE Slack alert, carrying the details it was given", async () => {
    const { security, SlackAlerts } = await loadModule(EMPTY_ALLOWLIST);

    await security.logAdminAction({
      adminId: 1,
      adminName: "Test Admin",
      action: "suspendUser",
      targetType: "user",
      targetId: "123",
      details: "Suspended user for abuse",
    });

    /* The ARGUMENTS, not merely the fact of a call. `toHaveBeenCalled()` alone
       cannot tell a correct alert from one that names the wrong person. */
    expect(SlackAlerts.sensitiveAdminAction).toHaveBeenCalledWith(
      "Test Admin", 1, "suspendUser", "user", "123", "Suspended user for abuse",
    );
    expect(SlackAlerts.adminAction).not.toHaveBeenCalled();
  });

  it("an ordinary action reaches the ORDINARY Slack alert and never the sensitive one", async () => {
    const { security, SlackAlerts } = await loadModule(EMPTY_ALLOWLIST);

    await security.logAdminAction({
      adminId: 1,
      adminName: "Test Admin",
      action: "listUsers",
      targetType: "system",
      targetId: "all",
      details: "Listed all users",
    });

    expect(SlackAlerts.adminAction).toHaveBeenCalledWith(
      "Test Admin", 1, "listUsers", "system", "all", "Listed all users",
    );
    expect(SlackAlerts.sensitiveAdminAction).not.toHaveBeenCalled();
  });

  /**
   * The audit row's SEVERITY, which nothing drove before this file. It is the
   * half of the sensitive/ordinary split that survives Slack being
   * unconfigured — and Slack IS unconfigured in production, so on the deployed
   * system this row is the only thing that records the distinction at all.
   */
  it("a sensitive action is recorded at WARNING severity and an ordinary one at INFO", async () => {
    const { security, logAuditEvent } = await loadModule(EMPTY_ALLOWLIST);

    await security.logAdminAction({
      adminId: 1, adminName: "A", action: "adjustCredits", targetType: "user", targetId: "7",
    });
    expect(logAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ severity: "warning", resourceType: "user", resourceId: "7" }),
    );

    await security.logAdminAction({
      adminId: 1, adminName: "A", action: "listUsers", targetType: "system", targetId: "all",
    });
    expect(logAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ severity: "info" }),
    );
  });
});

describe("logUnauthorizedAdminAccess — the refusal that must not be silent", () => {
  it("an unauthorized attempt alerts with the user, the attempt and the IP that made it", async () => {
    const { security, SlackAlerts } = await loadModule(EMPTY_ALLOWLIST);

    await security.logUnauthorizedAdminAccess({
      userId: 99999,
      userName: "attacker@example.com",
      attemptedAction: "admin_access",
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0",
    });

    expect(SlackAlerts.unauthorizedAdminAccess).toHaveBeenCalledWith(
      99999, "attacker@example.com", "admin_access", "192.168.1.100",
    );
  });

  it("the attempt is recorded at CRITICAL severity, blocked, against the admin surface", async () => {
    const { security, logAuditEvent } = await loadModule(EMPTY_ALLOWLIST);

    await security.logUnauthorizedAdminAccess({
      userId: 99999,
      userName: "attacker@example.com",
      attemptedAction: "admin_access",
    });

    expect(logAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: 99999,
        severity: "critical",
        resourceType: "admin",
        resourceId: "admin_access",
        metadata: expect.objectContaining({ blocked: true }),
      }),
    );
  });
});
