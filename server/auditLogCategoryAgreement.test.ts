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
 * ⚠ `MODERATOR_ONLY_ALLOWED` LIVED HERE AND IS GONE — #938 IS CLOSED, on his
 * own word (Crew reply #187, verbatim and entire: *"Give moderator actions
 * their own category"*).
 *
 * It held three actions the moderator console chipped `abuse` while the server
 * had them in no bucket at all, so every category choice — Abuse included —
 * dropped them on both panels. They have their own `moderator` bucket now, both
 * chip rules send them there, and the three route enums offer it.
 *
 * The lines are DELETED rather than left as a passing allowance: this file's
 * "keeps no exception that has stopped being one" arm asserts that every
 * remaining allowance still DISAGREES, so an exception whose defect was fixed
 * reddens the suite until somebody removes it. That is the half that makes this
 * list shrink instead of accumulate, and it did its job here.
 */

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
      "moderator",
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
      (action) => moderatorChip(action) !== serverBucket(action) && !(action in ALLOWED),
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

  it("keeps the moderator THREE in their own bucket, by name — his ruling (#938)", () => {
    /*
      The same rule as the thirteen above, for the same reason: both agreement
      arms are satisfied by both lists losing an action, so deleting the
      `moderator.` branch from the two chip rules AND the bucket from the server
      would restore perfect agreement and put these rows back where they were —
      chipped nothing, filterable by nothing.

      His ruling is what this arm holds, so it names the three rather than
      counting them: *"Give moderator actions their own category"* (Crew reply
      #187, 2026-09-14).

      ⚠ AND IT ASSERTS BOTH PANELS, because the two copies disagreed about this
      exact family before the ruling — the moderator console said `abuse`, the
      admin console said nothing. An arm reading one of them would pass over
      half a fix.
    */
    const MODERATOR: string[] = [
      "moderator.escalation",
      "moderator.change_request_created",
      "moderator.change_request_cancelled",
    ];
    expect(MODERATOR).toHaveLength(3);

    for (const action of MODERATOR) {
      expect(DECLARED, `${action} is no longer declared`).toContain(action);
      expect(serverBucket(action), `${action} has fallen out of the moderator bucket`).toBe(
        "moderator",
      );
      expect(adminChip(action), `${action}'s ADMIN chip has changed`).toBe("moderator");
      expect(moderatorChip(action), `${action}'s MODERATOR chip has changed`).toBe("moderator");
    }

    /*
      The negative half, and it is the one his ruling actually turned on: these
      rows must no longer read as abuse on either panel. A change request is not
      abuse, which is why the other repair — deleting the branch — was declined.
    */
    for (const action of MODERATOR) {
      expect(moderatorChip(action), `${action} is still labelled abuse`).not.toBe("abuse");
      expect(serverBucket(action), `${action} is still filed under abuse`).not.toBe("abuse");
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

  it("offers every bucket as a choice a STAFF MEMBER can actually pick", async () => {
    /*
      ⚠ THE LAST HOP, AND IT WAS UNGUARDED UNTIL #938. The arm above proves the
      server would ACCEPT a category; it says nothing about whether anyone can
      choose it. The two panels spell their Category options out by hand, so a
      bucket can exist, be filterable, be offered by every route enum, and still
      be unreachable because no dropdown lists it — which is invariant 7 wearing
      a different hat: a control nothing can invoke does not exist.

      Read at the panels' own source, and derived from ACTION_CATEGORIES so a
      sixth bucket is covered without an edit here.

      `client/src/pages/AdminFoundation.tsx` carries a THIRD list and is
      deliberately not in this population: it is the design-system specimen
      page, its options are illustrative (it offers a "Refunds" category the
      product does not have), and holding a specimen to the product's buckets
      would make it a second source of truth for them.
    */
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const PANELS = [
      "../client/src/features/admin/AuditLogsFilters.tsx",
      "../client/src/features/moderator/AuditLogsTab.tsx",
    ];

    for (const relative of PANELS) {
      const source = readFileSync(path.resolve(__dirname, relative), "utf8");
      const start = source.indexOf('{ value: "all", label: "All categories" }');
      expect(start, `${relative} has no Category options list`).toBeGreaterThan(-1);
      const block = source.slice(start, source.indexOf("]", start));
      const offered = [...block.matchAll(/value:\s*"([^"]+)"/g)].map((m) => m[1]);

      /* The positive control: a block that stopped being found would read as an
         empty list and pass nothing. */
      expect(offered.length, `${relative} offers no categories at all`).toBeGreaterThan(1);

      for (const bucket of Object.keys(ACTION_CATEGORIES)) {
        expect(offered, `${relative} gives staff no way to choose "${bucket}"`).toContain(bucket);
      }
      expect(offered, `${relative} lost the "all" option`).toContain("all");
    }
  });
});
