import { describe, expect, it } from "vitest";

import { ACTION_CATEGORIES } from "./auditLog";
import { AUDIT_ACTIONS } from "../drizzle/schema";
import { getActionCategory as adminChip } from "@/features/admin/adminConstants";
import { getActionCategory as moderatorChip } from "@/features/moderator/moderatorConstants";

/**
 * THE PANEL'S LABEL AND THE SERVER'S FILTER MUST AGREE — #939.
 *
 * An audit row carries a coloured category chip drawn by the client's
 * `getActionCategory`, and the Category dropdown above it filters through the
 * server's `ACTION_CATEGORIES`. They are two lists describing one thing, which
 * is working law 4, and they had drifted: **13 of 77 declared actions showed a
 * chip whose own filter dropped the row** — including
 * `security.unauthorized_admin_access`, `security.immutable_log` and every
 * blocked-login row. The same filter feeds the CSV export
 * (`routes/moderatorExports.ts`), so a "Security" export was missing them too.
 *
 * `server/auditLog.ts` already carried a founder ruling about this exact shape,
 * on one action:
 *
 *   "Without this line the panel's own abuse filter would drop every row the
 *    alarm writes — the wire would exist, the row would exist, and staff would
 *    never see it."
 *
 * It was true of that action and of twelve others nobody had counted.
 *
 * WHY THIS FILE READS BY IMPORT AND NOT BY REGEX. The one guard that existed
 * before it (`security/loginAttackAlert.test.ts:195`) proves ONE action by
 * searching `auditLog.ts` for one string. That is fine for one line and cannot
 * be a population: a substring reader cannot tell you what is MISSING from a
 * list, only that something is present. Every list here is imported, so the
 * population is the product's own and cannot silently go short — the failure
 * mode CLAUDE.md names as a collector reading at a shape where a declaration
 * exists.
 *
 * THE EXCEPTIONS BELOW ARE ENUMERATED AND EXACT. A disagreement not on the
 * list fails; an entry on the list that has stopped disagreeing ALSO fails, so
 * the list can only shrink and a fixed exception cannot linger as documentation
 * of a defect that is gone.
 */

/** Every action string the product declares. Derived, never transcribed. */
const DECLARED = Object.values(AUDIT_ACTIONS) as string[];

/** The bucket the server would filter this action into, or null for none. */
function serverBucket(action: string): string | null {
  for (const [bucket, actions] of Object.entries(ACTION_CATEGORIES)) {
    if ((actions as string[]).includes(action)) return bucket;
  }
  return null;
}

/**
 * The disagreements that are allowed to stand today, each with the card that
 * owns it. Nothing may be added here without one.
 */
const ALLOWED: Record<string, { chip: string | null; bucket: string | null; card: string }> = {
  /*
    #771's two money anomalies plus the late-invoice row. They ARE filterable
    under Billing — the client's prefix rule simply has no `billing.` branch, so
    the row shows no chip at all. That is the mirror image of #939's defect and
    the smaller half of it: findable, unlabelled. Filed separately because the
    repair is to derive the chip from this list rather than add a fourth prefix
    to a pair of copies that #932 wants merged and #938 wants ruled on.
  */
  "billing.stripe_refund_issued": { chip: null, bucket: "billing", card: "#940" },
  "billing.stripe_refund_failed": { chip: null, bucket: "billing", card: "#940" },
  "billing.invoice_paid_after_plan_ended": { chip: null, bucket: "billing", card: "#940" },
};

/**
 * The moderator console's copy of `getActionCategory` carries one extra branch
 * the admin console's does not: it sends `moderator.*` to the abuse chip. That
 * family is in no bucket, so those rows disagree on THAT PANEL ONLY.
 *
 * It is not fixed here on purpose. Every action in #939 went into a bucket its
 * own siblings already occupied — no new category, no decision. `moderator.*`
 * has no sibling anywhere, so the answer is a NEW category, which is a
 * staff-visible control and therefore the founder's: #938.
 */
const MODERATOR_ONLY_ALLOWED: Record<string, { chip: string | null; card: string }> = {
  "moderator.escalation": { chip: "abuse", card: "#938" },
  "moderator.change_request_created": { chip: "abuse", card: "#938" },
  "moderator.change_request_cancelled": { chip: "abuse", card: "#938" },
};

describe("the audit panel's chip and the server's category filter", () => {
  it("reads a real population from both sources", () => {
    /*
      The positive control for every arm below. An import that resolved to an
      empty object would make each of them pass by having nothing to check —
      which is the failure this suite exists to prevent one level down.
    */
    expect(DECLARED.length).toBeGreaterThan(70);
    expect(new Set(DECLARED).size).toBe(DECLARED.length);
    expect(Object.keys(ACTION_CATEGORIES).sort()).toEqual([
      "abuse",
      "billing",
      "model",
      "security",
    ]);
    for (const [bucket, actions] of Object.entries(ACTION_CATEGORIES)) {
      expect(actions.length).toBeGreaterThan(0);
      /*
        A bucket entry naming a constant that does not exist is `undefined` at
        runtime and matches no row — the list looks longer than it filters. It
        is a typecheck error, but this file must not depend on someone having
        run one: it caught exactly this while being written (`CREDITS_ADMIN_ADDED`
        for `CREDITS_ADDED`), and only through the by-name arm at the bottom.
      */
      for (const action of actions) {
        expect(typeof action, `${bucket} holds a member that is not a string`).toBe("string");
        expect(DECLARED, `${bucket} holds "${action}", which is not declared`).toContain(action);
      }
    }
    // and the readers actually read: two answers known before this file existed
    expect(adminChip("auth.login")).toBe("security");
    expect(serverBucket("auth.login")).toBe("security");
    expect(adminChip("nonsense.not_an_action")).toBeNull();
    expect(serverBucket("nonsense.not_an_action")).toBeNull();
  });

  it("agrees on every declared action, on the ADMIN console", () => {
    const disagreements = DECLARED.filter(
      (action) => adminChip(action) !== serverBucket(action) && !(action in ALLOWED),
    ).map((action) => `${action}: chip ${adminChip(action)} vs bucket ${serverBucket(action)}`);

    expect(disagreements).toEqual([]);
  });

  it("agrees on every declared action, on the MODERATOR console", () => {
    const disagreements = DECLARED.filter(
      (action) =>
        moderatorChip(action) !== serverBucket(action) &&
        !(action in ALLOWED) &&
        !(action in MODERATOR_ONLY_ALLOWED),
    ).map((action) => `${action}: chip ${moderatorChip(action)} vs bucket ${serverBucket(action)}`);

    expect(disagreements).toEqual([]);
  });

  it("keeps no exception that has stopped being one", () => {
    /*
      The half that makes the two arms above shrink rather than accumulate. An
      allowance whose defect has been fixed is a lie about the product, and it
      is the shape that let a deleted control keep a live reputation (the
      velocity-cap suite, CLAUDE.md).
    */
    for (const [action, expected] of Object.entries(ALLOWED)) {
      expect(DECLARED, `${action} (${expected.card}) is no longer declared`).toContain(action);
      expect(adminChip(action), `${action} (${expected.card})`).toBe(expected.chip);
      expect(serverBucket(action), `${action} (${expected.card})`).toBe(expected.bucket);
      expect(expected.chip, `${action} (${expected.card}) no longer disagrees`).not.toBe(
        expected.bucket,
      );
    }
    for (const [action, expected] of Object.entries(MODERATOR_ONLY_ALLOWED)) {
      expect(DECLARED, `${action} (${expected.card}) is no longer declared`).toContain(action);
      expect(moderatorChip(action), `${action} (${expected.card})`).toBe(expected.chip);
      expect(serverBucket(action), `${action} (${expected.card}) now has a bucket`).toBeNull();
      // the admin console must NOT have grown the moderator branch behind our back
      expect(adminChip(action), `${action}: the admin copy has drifted`).toBeNull();
    }
  });

  it("keeps the thirteen of #939 in a bucket, by name", () => {
    /*
      The agreement arms above are satisfied by BOTH lists losing an action —
      delete the `auth.*` branch from the client rule and these eleven from the
      bucket and the panels agree perfectly while staff lose the chip and the
      filter together. So the thirteen are named, which is the "every survivor
      named" rule this repository arrived at the hard way (#898, #933).
    */
    const RESTORED: Record<string, string> = {
      "auth.login_blocked_suspended": "security",
      "auth.login_blocked_locked": "security",
      "auth.account_lockout": "security",
      "auth.email_verification_sent": "security",
      "auth.email_verification_resent": "security",
      "auth.email_verified": "security",
      "auth.email_verification_failed": "security",
      "security.ip_blocked_request": "security",
      "security.emergency_action": "security",
      "security.unauthorized_admin_access": "security",
      "security.immutable_log": "security",
      "abuse.credential_stuffing": "abuse",
      "credits.admin_added": "billing",
    };
    expect(Object.keys(RESTORED)).toHaveLength(13);

    for (const [action, bucket] of Object.entries(RESTORED)) {
      expect(DECLARED, `${action} is no longer declared`).toContain(action);
      expect(serverBucket(action), `${action} has fallen out of its bucket`).toBe(bucket);
      expect(adminChip(action), `${action}'s chip has changed`).toBe(bucket);
    }
  });

  it("offers every bucket as a choice on the routes that filter", async () => {
    /*
      The landmine #938 walks onto. A new bucket in ACTION_CATEGORIES is
      unreachable until the route's own `actionCategory` enum offers it, and the
      enum is spelled out in four separate route files — so the natural way to
      add a category is to add it in one place and have it work nowhere.
    */
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const ROUTES = [
      "routes/admin/auditLogs.ts",
      "routes/moderator.ts",
      "routes/moderatorExports.ts",
    ];
    const buckets = Object.keys(ACTION_CATEGORIES);

    for (const relative of ROUTES) {
      const source = readFileSync(path.resolve(__dirname, relative), "utf8");
      const enums = [...source.matchAll(/actionCategory:\s*z\.enum\(\[([^\]]+)\]\)/g)];
      expect(enums.length, `${relative} declares no actionCategory enum`).toBeGreaterThan(0);
      for (const declared of enums) {
        const offered = [...declared[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
        for (const bucket of buckets) {
          expect(offered, `${relative} does not offer the "${bucket}" category`).toContain(bucket);
        }
        expect(offered, `${relative} lost the "all" option`).toContain("all");
      }
    }
  });
});
