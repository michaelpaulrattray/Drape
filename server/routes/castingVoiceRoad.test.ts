/**
 * THE VOICE CARD'S TWO MUTATIONS, AT THE ROAD — the repair of #2470's finding,
 * items 3, 4 and 5.
 *
 * Both defects the first two arms are about were invisible to every suite that
 * existed: one is a RACE between two presses, which a sequential arm cannot
 * see, and the other is a LIMITER shared between a press and a page opening,
 * which only shows once something counts the two separately.
 *
 * ⚠ **THE RATE LIMITER AND THE DESIGN STORE ARE THE REAL ONES.** Only the
 * scope, the cast read and the provider service are stubbed. A mocked limiter
 * would have let these arms pass with the two buckets still being one — the
 * limiter's own keying IS the claim in item 4 — and a mocked store would have
 * done the same for the claim in item 3. Each arm takes its OWN user id,
 * because the real limiter is in-memory, keyed `user:<id>`, and has no reset
 * hook, so a shared id would leak one arm's presses into the next.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const MODEL_ID = 512;
const SENTENCE = "Low, unhurried, a north Atlantic rasp.";

let voiceOn = true;
let keepResult: unknown = { ok: true, clipBytes: 1_234 };
let keepability = { canKeep: true };
let keptRow: unknown = null;
const saves: string[] = [];

vi.mock("../castingV2/castingV2Scope", () => ({
  captureCastingV2Enabled: () => true,
  captureCastingVoiceEnabled: () => voiceOn,
}));

vi.mock("../db/castingV2Sign", () => ({
  getOwnedCastByPublicId: async () => ({ id: MODEL_ID, voice: SENTENCE, name: "Hallvard" }),
}));

vi.mock("../db/castVoices", () => ({
  readCastVoice: async () => keptRow,
}));

vi.mock("../castingV2/voiceService", () => ({
  designCastVoices: async () => ({
    ok: true,
    designSentence: SENTENCE,
    previews: [
      { previewId: "gen-a", bytes: Buffer.from("a"), contentType: "audio/mpeg", durationSeconds: 19 },
      { previewId: "gen-b", bytes: Buffer.from("b"), contentType: "audio/mpeg", durationSeconds: 21 },
      { previewId: "gen-c", bytes: Buffer.from("c"), contentType: "audio/mpeg", durationSeconds: 20 },
    ],
    latencyMs: 7_000,
  }),
  /*
    ⚠ **THE SAVE IS RECORDED, AND IT IS SLOW ON PURPOSE.** One monthly voice
    operation is what a save spends, so the COUNT of these calls is the money
    assertion in item 3 — and the await is what lets two presses overlap the way
    they do in a browser.
  */
  keepCastVoice: async () => {
    saves.push("save");
    await new Promise((resolve) => setTimeout(resolve, 20));
    return keepResult;
  },
  readVoiceKeepability: async () => keepability,
}));

const { designVoicesForCard, keepVoiceForCard, readVoiceCardStatus } =
  await import("./castingVoice");
const { resetVoiceDesignStore, voiceDesignStoreSize } =
  await import("../castingV2/voiceDesignStore");

beforeEach(() => {
  voiceOn = true;
  keepResult = { ok: true, clipBytes: 1_234 };
  keepability = { canKeep: true };
  keptRow = null;
  saves.length = 0;
  resetVoiceDesignStore();
});

/** A fresh account per arm, so the real limiter's buckets never overlap. */
let nextUser = 9_000;
function freshUser(): number {
  nextUser += 1;
  return nextUser;
}

describe("two presses of Keep on one handle", () => {
  it("⚠ MAKE EXACTLY ONE PROVIDER SAVE — the double-press, driven at the road", async () => {
    /*
      THE CLAIM OF THIS SUITE. Before the repair both presses resolved the same
      handle and both called the provider: the loser released its slot, but its
      operation was spent out of the month's 95 and no delete refunds it.
    */
    const userId = freshUser();
    const design = await designVoicesForCard({ userId, castId: "KI-A" });
    expect(design.ok).toBe(true);
    if (!design.ok) throw new Error("unreachable");

    const press = {
      userId,
      castId: "KI-A",
      designId: design.designId,
      handle: design.voices[0].handle,
    };
    const [first, second] = await Promise.all([
      keepVoiceForCard(press),
      keepVoiceForCard(press),
    ]);

    expect(saves).toHaveLength(1);
    /* One press kept the voice; the other was told to make them again, which is
       the same answer a replayed handle has always had. */
    expect([first.ok, second.ok].sort()).toEqual([false, true]);
  });

  it("gives the design back when a Keep is REFUSED, so three voices are not lost", async () => {
    const userId = freshUser();
    const design = await designVoicesForCard({ userId, castId: "KI-A" });
    if (!design.ok) throw new Error("unreachable");
    keepResult = { ok: false, refusal: "no_operations_left" };

    const refused = await keepVoiceForCard({
      userId,
      castId: "KI-A",
      designId: design.designId,
      handle: design.voices[1].handle,
    });

    expect(refused).toEqual({ ok: false, refusal: "no_operations_left" });
    /* Restored: a spent month must not also cost the customer the three voices
       they could keep a minute later. */
    expect(voiceDesignStoreSize()).toBe(1);
    keepResult = { ok: true, clipBytes: 99 };
    expect(await keepVoiceForCard({
      userId,
      castId: "KI-A",
      designId: design.designId,
      handle: design.voices[1].handle,
    })).toMatchObject({ ok: true });
  });

  it("⚠ does NOT give it back when the cast itself is gone", async () => {
    /* Nothing can ever be kept against a deleted cast, so a restorable handle
       there is a name with no referent. */
    const userId = freshUser();
    const design = await designVoicesForCard({ userId, castId: "KI-A" });
    if (!design.ok) throw new Error("unreachable");
    keepResult = { ok: false, refusal: "cast_not_available" };

    await keepVoiceForCard({
      userId,
      castId: "KI-A",
      designId: design.designId,
      handle: design.voices[0].handle,
    });

    expect(voiceDesignStoreSize()).toBe(0);
  });
});

describe("the first three, made when a card opens", () => {
  it("⚠ BROWSING CANNOT SPEND A PRESS — the automatic road has its own bucket", async () => {
    /*
      #2470's finding, item 4. The card designs three voices on open, and the
      automatic call was enforced against the PRESS limit of twelve an hour — so
      opening a thirteenth signed cast threw `TOO_MANY_REQUESTS`, which the card
      turned into *"try again"* on a road where trying again failed identically.

      Thirty automatic opens is the auto bucket's whole hour. The press that
      follows them is the arm: before the repair it was refused.
    */
    const userId = freshUser();
    for (let index = 0; index < 30; index += 1) {
      expect((await designVoicesForCard({ userId, castId: "KI-A", automatic: true })).ok).toBe(true);
    }
    await expect(designVoicesForCard({ userId, castId: "KI-A", automatic: true }))
      .rejects.toThrow(/too many/i);

    /* THE CLAIM: the customer's own presses are untouched by all that browsing. */
    expect((await designVoicesForCard({ userId, castId: "KI-A" })).ok).toBe(true);
  });

  it("a PRESS is still bounded at twelve an hour, and the automatic road survives it", async () => {
    const userId = freshUser();
    for (let index = 0; index < 12; index += 1) {
      expect((await designVoicesForCard({ userId, castId: "KI-A" })).ok).toBe(true);
    }
    await expect(designVoicesForCard({ userId, castId: "KI-A" }))
      .rejects.toThrow(/too many/i);

    /* The other direction of the same separation. */
    expect((await designVoicesForCard({ userId, castId: "KI-A", automatic: true })).ok).toBe(true);
  });

  it("⚠ a caller that does not say gets the PRESS bucket, never the larger one", async () => {
    /*
      `automatic` is optional so a bundle loaded before this shipped still works
      (`.strict()` rejects an unknown key, not a missing optional one). The
      default has to be the STRICTER of the two, or omitting it would be a way
      to buy thirty designs an hour.
    */
    const userId = freshUser();
    for (let index = 0; index < 12; index += 1) {
      await designVoicesForCard({ userId, castId: "KI-A" });
    }
    await expect(designVoicesForCard({ userId, castId: "KI-A", automatic: undefined }))
      .rejects.toThrow(/too many/i);
  });
});

describe("what the card is told before it designs anything", () => {
  it("⚠ SAYS WHEN NOTHING CAN BE KEPT, so three voices are not made on house money", async () => {
    /* #2470's finding, item 5. The card skips its automatic design on this. */
    keepability = { canKeep: false };

    const status = await readVoiceCardStatus({ userId: freshUser(), castId: "KI-A" });

    expect(status).toMatchObject({ available: true, hasLine: true, canKeep: false });
  });

  it("does not ask the provider at all for a cast that already has a voice", async () => {
    /*
      The hint costs a provider round trip on a cache miss, and a cast that
      already has a voice has nothing to design — so it is not asked. `canKeep`
      is `true` there because nothing is being withheld, not because an
      allowance was read.
    */
    keptRow = { clipBytes: 2_100_000, keptAt: new Date() };
    keepability = { canKeep: false };

    const status = await readVoiceCardStatus({ userId: freshUser(), castId: "KI-A" });

    expect(status.canKeep).toBe(true);
    expect(status.kept).not.toBeNull();
  });

  it("answers `available: false` with the road dark, and never reads an allowance", async () => {
    voiceOn = false;
    keepability = { canKeep: false };

    expect(await readVoiceCardStatus({ userId: freshUser(), castId: "KI-A" })).toEqual({
      available: false,
      hasLine: false,
      canKeep: false,
      kept: null,
    });
  });
});
