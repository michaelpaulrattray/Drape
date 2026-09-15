import { describe, expect, it } from "vitest";

import { ACTION_CATEGORIES } from "./auditLog";
import { AUDIT_ACTIONS } from "../drizzle/schema";
import { getActionCategory as sharedChip } from "../shared/auditActionCategories";
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
 *
 * ⚠ THE LIST IS EMPTY NOW (#940), AND THAT CHANGES WHAT THIS FILE CAN PROVE —
 * SAID HERE RATHER THAN LEFT TO BE NOTICED.
 *
 * The chip is no longer a second list. Both panels re-export the ONE derivation
 * in `shared/auditActionCategories.ts`, which reads the same `ACTION_CATEGORIES`
 * the filter reads, so the two agreement arms below CANNOT fail while that
 * holds: they compare a value against itself. A green arm that cannot go red is
 * the thing this repository keeps being bitten by, so it is not left standing on
 * its own reputation — two arms were added that CAN fail and are what actually
 * hold the repair:
 *
 *   - "both panels export the ONE derivation" — identity, not behaviour. A
 *     panel that goes back to declaring its own rule fails here even if the new
 *     rule happens to agree today.
 *   - "neither console re-implements the chip" — a source read for
 *     `startsWith(`, which catches the same regression one file earlier.
 *
 * And the disagreement reader itself has a positive control ("the disagreement
 * reader can actually fail"), because with an empty exception list the
 * "keeps no exception" arm iterates nothing and would pass over a broken reader.
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
    ⚠ EMPTY, AND IT EMPTIED ITSELF — #940 IS CLOSED.

    It held #771's two money anomalies plus the late-invoice row: findable under
    Billing, and labelled with nothing, because the client's prefix rule had no
    `billing.` branch. The repair was not to add the branch — that would have
    widened the copy that caused both defects — but to DERIVE the chip from
    `ACTION_CATEGORIES`, which is what filters. The three rows now draw a Billing
    chip because they are in the Billing bucket, which is the same sentence.

    The lines were deleted rather than left passing: the "keeps no exception"
    arm below asserts every remaining allowance still DISAGREES, so it went red
    the moment the fix landed and stayed red until they went. That is the half
    that makes this list shrink instead of accumulate, and it has now done its
    job twice (#938's moderator three, then these).

    Nothing is added here without a card that owns it.
  */
};

/**
 * The actions where the chip and the bucket disagree, ignoring the allowances.
 *
 * EXTRACTED so it can be driven with a deliberately wrong pair below. With
 * `ALLOWED` empty the arms that use it are comparing the derivation against
 * itself, so nothing else in this file would notice if this reader stopped
 * reading.
 */
function disagreements(
  chip: (action: string) => string | null,
  bucket: (action: string) => string | null,
  population: string[] = DECLARED,
): string[] {
  return population
    .filter((action) => chip(action) !== bucket(action) && !(action in ALLOWED))
    .map((action) => `${action}: chip ${chip(action)} vs bucket ${bucket(action)}`);
}

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
    expect(disagreements(adminChip, serverBucket)).toEqual([]);
  });

  it("agrees on every declared action, on the MODERATOR console", () => {
    expect(disagreements(moderatorChip, serverBucket)).toEqual([]);
  });

  it("the disagreement reader can actually fail", () => {
    /*
      THE POSITIVE CONTROL FOR THE TWO ARMS ABOVE, and since #940 it is the only
      thing that makes them mean anything: both panels now read the same derived
      list the server filters on, so they compare a value against itself and are
      green by construction.

      Driven against the real population with a chip rule that is wrong the way
      the old prefix rule was wrong — it sends `billing.*` nowhere — so this arm
      reproduces the defect #940 fixed and asserts the reader sees it.
    */
    const prefixRuleAsItWas = (action: string): string | null => {
      if (action.startsWith("subscription.") || action.startsWith("credits.")) return "billing";
      if (action.startsWith("model.")) return "model";
      if (action.startsWith("auth.") || action.startsWith("security.")) return "security";
      if (action.startsWith("moderator.")) return "moderator";
      if (action.startsWith("abuse.")) return "abuse";
      return null;
    };

    const found = disagreements(prefixRuleAsItWas, serverBucket);

    expect(found).toContain("billing.stripe_refund_issued: chip null vs bucket billing");
    expect(found).toContain("billing.stripe_refund_failed: chip null vs bucket billing");
    expect(found).toContain("billing.invoice_paid_after_plan_ended: chip null vs bucket billing");
  });

  it("both panels export the ONE derivation — #940", () => {
    /*
      IDENTITY, NOT BEHAVIOUR, and that is the point. The agreement arms are
      satisfied by any rule that happens to give the same answers today; this
      one fails the moment a console goes back to declaring a rule of its own,
      which is how both #939 and #940 happened.
    */
    expect(adminChip).toBe(sharedChip);
    expect(moderatorChip).toBe(sharedChip);
  });

  it("neither console re-implements the chip in its own source", async () => {
    /*
      The same regression caught one file earlier, and by a different reader —
      the identity arm above resolves through the module graph, this one reads
      the bytes. A prefix rule added BESIDE the re-export (rather than replacing
      it) would keep the identity arm green while a caller importing the local
      name got the copy.

      No regex for the shape itself: `startsWith(` is its whole signature, and
      this repository has been bitten by regexes assembled around interpolated
      values.

      ⚠ COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT TIDINESS — this arm failed
      on its first run against a correct tree, because the docblock explaining
      the repair QUOTES the rule it removed. A reader that cannot tell a mention
      from a declaration makes the file undocumentable, which is the same lesson
      the shift runner's quiet-entry detector arrived at (#360): quoting is never
      declaring.
    */
    const withoutComments = (source: string): string =>
      source
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"))
        .join("\n")
        .split("/*")
        .map((chunk, index) => (index === 0 ? chunk : chunk.slice(chunk.indexOf("*/") + 2)))
        .join("");
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const CONSOLES = [
      "../client/src/features/admin/adminConstants.ts",
      "../client/src/features/moderator/moderatorConstants.ts",
    ];

    for (const relative of CONSOLES) {
      const source = readFileSync(path.resolve(__dirname, relative), "utf8");

      /* Positive control: a path that stopped resolving would read as "" and
         contain no forbidden string, passing by having read nothing. */
      expect(source.length, `${relative} read as empty`).toBeGreaterThan(200);
      expect(source, `${relative} no longer imports the derivation`).toContain(
        'from "@shared/auditActionCategories"',
      );

      const code = withoutComments(source);
      /*
        The stripper's own positive control: it must not have eaten the file. If
        it returned "" the assertion below would pass having read nothing, which
        is the exact failure this suite exists to prevent one level down.
      */
      expect(code, `${relative} stripped to nothing`).toContain("CATEGORY_COLORS");
      expect(code, `${relative} re-implements the category chip`).not.toContain("startsWith(");
    }
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

  it("keeps the money THREE chipped and filterable, by name — #940", () => {
    /*
      The same rule as the thirteen and the moderator three above, and it is not
      a formality: the agreement arms are satisfied by both lists losing an
      action, so deleting these from the billing bucket would restore perfect
      agreement and put the rows back exactly where #940 found them — findable
      by nothing, labelled with nothing.

      These are the rows #771 added because they are the ONLY surface production
      has for money that did not do what the record says: a refund that failed,
      a refund that was issued, an invoice paid after its plan ended.
    */
    const MONEY: string[] = [
      "billing.stripe_refund_issued",
      "billing.stripe_refund_failed",
      "billing.invoice_paid_after_plan_ended",
    ];
    expect(MONEY).toHaveLength(3);

    for (const action of MONEY) {
      expect(DECLARED, `${action} is no longer declared`).toContain(action);
      expect(serverBucket(action), `${action} has fallen out of the billing bucket`).toBe("billing");
      expect(adminChip(action), `${action} draws no chip on the ADMIN console`).toBe("billing");
      expect(moderatorChip(action), `${action} draws no chip on the MODERATOR console`).toBe(
        "billing",
      );
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
