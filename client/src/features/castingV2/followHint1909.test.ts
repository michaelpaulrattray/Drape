/**
 * #1909 — TEACHING FOLLOW WITH ONE LINE, ONCE PER ACCOUNT.
 *
 * His word, 2026-10-07 (terminal), verbatim: *"1,2,3 seeing as these are small
 * make cards for these"*, on Yuna's Founder Desk item *"Teach Follow with one
 * dismissible line on the first Keep"* (her option B).
 *
 * # What a customer hits without it
 *
 * On the sheet, **Follow** is an immediate paid roll of eight in that face's
 * family — `follow` in `server/routes/castingV2.ts` is *"a fresh eight
 * conditioned on the parent"*, read at the code on the day this was built, as
 * the card asks. It sits beside Keep and says nothing about itself, so most
 * customers Keep and never learn the control exists.
 *
 * # ⚠ WHAT THIS SUITE CAN AND CANNOT SEE, SAID FIRST
 *
 * `pnpm test` runs in a node environment with **no DOM**, so this is a
 * source-read guard like `castVocabulary.test.ts` and `lobbyStub.test.ts`
 * beside it. It holds the WIRING — the condition, the three dismissals, the
 * copy, the look — and it cannot press a button.
 *
 * **The behaviour the card's done-when asks for is DRIVEN in the running app
 * and recorded on the PR**: a fresh account's first Keep shows the line, a
 * second Keep does not, and each of the three dismissals removes it. A guard
 * that claimed to prove that from source would be claiming the thing working
 * law 1 forbids.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SHEET = "client/src/pages/CastingSheet.tsx";
const TILE = "client/src/features/castingV2/components/CandidateTile.tsx";
const CSS = "client/src/features/castingV2/castingV2.css";
const AUTH = "server/routes/auth.ts";
const PROFILE = "server/routes/profile.ts";
const SCHEMA = "drizzle/schema.ts";
const MIGRATION = "drizzle/0072_follow_hint_seen.sql";

const source = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

describe("the flag is the SERVER's, so the line cannot come back on a second device", () => {
  it("is a one-way column on users, declared and migrated together", () => {
    expect(source(SCHEMA)).toContain(
      'followHintSeen: boolean("followHintSeen").default(false).notNull()',
    );
    /*
      ⚠ The DDL is read out of the migration rather than restated here: a guard
      that retypes a statement is a second copy of the schema and drifts from
      the one every test ran against (`ceremony-crew-card-intents.mts`'s own
      rule). ADDITIVE, which is what lets the deploy rite apply it unattended —
      `ceremonyAutoApply` recognises exactly `CREATE TABLE`, `ADD COLUMN` and
      `ADD INDEX`, and refuses everything else.
    */
    const ddl = source(MIGRATION);
    expect(ddl).toContain("ALTER TABLE `users` ADD COLUMN `followHintSeen`");
    expect(ddl).toMatch(/NOT NULL DEFAULT false/);
    expect(ddl).not.toMatch(/\b(DROP|RENAME|MODIFY)\b/);
  });

  it("⚠ reaches the client through auth.me's POSITIVE projection, which is invariant 8", () => {
    /*
      A field only gets to a client by being written into that projection on
      purpose. `server/auth.me.test.ts` pins the whole key list, so this cannot
      arrive by accident and nothing else arrives with it.
    */
    expect(source(AUTH)).toContain("followHintSeen: ctx.user.followHintSeen");
  });

  it("is written by one protected mutation that takes no input — invariant 3", () => {
    const profile = source(PROFILE);
    expect(profile).toContain("markFollowHintSeen: protectedProcedure.mutation");
    expect(profile).toContain("await markFollowHintSeen(ctx.user.id)");
    /* No `.input(` on this procedure: the user comes from the context and the
       flag only ever goes one way, so there is nothing to send. */
    const procedure = profile.slice(profile.indexOf("markFollowHintSeen: protectedProcedure"));
    expect(procedure.slice(0, 200)).not.toContain(".input(");
  });
});

describe("when the line appears, and when it must not", () => {
  it("only on a KEEP, never on an un-keep", () => {
    /*
      Un-keeping is a Keep button press too. Teaching Follow on the click that
      REMOVES a ring is the hint arriving at the one moment it means nothing.
    */
    expect(source(SHEET)).toContain("if (kept && followHintAllowed && !followHintShown)");
  });

  it("⚠ and NOT while `auth.me` is still in flight — the arm that is easy to lose", () => {
    /*
      `user` is `null` until the query lands, so reading the flag straight off
      it makes `followHintSeen` read false for that window and a customer who
      dismissed the hint long ago meets it again if she clicks Keep quickly.
      The flag is trusted only once there is a user to have read it from.
    */
    const sheet = source(SHEET);
    expect(sheet).toContain("signedInUser !== null");
    expect(sheet).toContain('(signedInUser as { followHintSeen?: boolean }).followHintSeen !== true');
  });

  it("marks it seen on the KEEP, not on the dismissal", () => {
    /*
      A customer who scrolls past the line without pressing Got it has still
      been shown it. Writing on dismissal would put it back in front of her on
      every other device, which is the failure the server flag exists to
      prevent.
    */
    const sheet = source(SHEET);
    const onKeep = sheet.slice(sheet.indexOf("const onKeep = ("), sheet.indexOf("const discardMutation"));
    expect(onKeep).toContain("markFollowHintSeen.mutate()");
    expect(onKeep).toContain("setFollowHintFor(candidateId)");
  });
});

describe("the three dismissals the card asks for", () => {
  it("Got it is the tile's own", () => {
    expect(source(TILE)).toContain("onClick={onDismissFollowHint}");
    expect(source(SHEET)).toContain("onDismissFollowHint={() => setFollowHintFor(null)}");
  });

  it("⚠ pressing Follow and the next roll are ONE site, because both are rolls", () => {
    /*
      A Follow IS a roll and "Roll again" is the other, so both arrive at
      `dispatchRoll`. It is cleared AFTER the single-flight latch, deliberately:
      a click the latch refuses bought nothing, and should not also take away
      the sentence explaining the click.
    */
    const sheet = source(SHEET);
    const dispatch = sheet.slice(sheet.indexOf("const dispatchRoll = ("));
    const latchAt = dispatch.indexOf("if (!latch.tryAcquire(activeRollId)) return;");
    const clearAt = dispatch.indexOf("setFollowHintFor(null);");
    expect(latchAt).toBeGreaterThan(-1);
    expect(clearAt).toBeGreaterThan(latchAt);
  });

  it("the hint is drawn on ONE tile — the one she just kept", () => {
    expect(source(SHEET)).toContain("followHint={followHintFor === candidate.candidateId}");
  });
});

describe("what it says and how it looks", () => {
  it("says what Follow does, in her words", () => {
    expect(source(TILE)).toContain(
      "Kept. To see more like them, press Follow — it rolls eight in their family.",
    );
    /* One acknowledgement and one only — not "Dismiss", not "Close", not two. */
    const tile = source(TILE);
    const hint = tile.slice(tile.indexOf('className="dpc-card__hint"'));
    const block = hint.slice(0, hint.indexOf("</div>"));
    expect(block).toMatch(/>\s*Got it\s*</);
    expect(block.match(/<Button/g) ?? []).toHaveLength(1);
  });

  it("⚠ carries NO price — his 2026-08-03 ruling on immediate-fire actions", () => {
    const tile = source(TILE);
    const hint = tile.slice(tile.indexOf('className="dpc-card__hint"'));
    const block = hint.slice(0, hint.indexOf("</div>"));
    expect(block).not.toMatch(/\d/);
    expect(block).not.toMatch(/credit|CR\b/i);
  });

  it("⚠ is a raised surface with NO accent, so it never competes with the Kept ring", () => {
    const css = source(CSS);
    const rule = css.slice(css.indexOf(".dpc-card__hint {"), css.indexOf(".dpc-card__hinttext"));
    expect(rule).toContain("background: var(--raised)");
    expect(rule).toContain("border: 1px solid var(--borderSoft)");
    /* Tokens only — no hardcoded colour anywhere in either rule, which is the
       design-system rule this file sits under. */
    const both = css.slice(css.indexOf(".dpc-card__hint {"), css.indexOf(".dpc-card__hinttext") + 400);
    expect(both).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(both).not.toMatch(/rgba?\(/);
  });

  it("is announced to a screen reader, and as a status rather than an alert", () => {
    /* It appears without being asked for, so it is announced; it arrives
       because she did something good, so it does not interrupt. */
    const tile = source(TILE);
    const hint = tile.slice(tile.indexOf('className="dpc-card__hint"'));
    expect(hint.slice(0, 120)).toContain('role="status"');
    expect(hint.slice(0, 120)).not.toContain('role="alert"');
  });
});
