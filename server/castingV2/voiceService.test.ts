/**
 * THE VOICE ROAD'S REFUSALS, DRIVEN DIRECTLY — N4b-1 (#2469).
 *
 * The card's own done-when asks for three of these *"driven directly, not
 * through a model"*: a Keep with the key absent, with the quota read failing,
 * and with the live slot limit reached. They are here with the rest of the
 * closed set, because a refusal nobody drove is a refusal nobody has.
 *
 * The engine is INJECTED (`VoiceServiceDeps`), so nothing leaves this machine
 * and no money moves; `designCastVoices` and `keepCastVoice` are the real
 * functions. What the arms are really asserting:
 *
 *   · **the quota is read BEFORE anything is spent, and a FAILED read refuses**
 *     (invariant 7). This is the arm most worth having: a Keep that cannot read
 *     the allowance has no idea whether its save is the one that exceeds the
 *     account's month, and in slice 2 that press carries a price. The arm
 *     proves the save was never ATTEMPTED, not merely that an answer was
 *     `false` — an order claim is only provable on the calls actually made.
 *   · **the slot ceiling is the LIVE one.** The positive control is a 30-slot
 *     account with 3 voices used, which must NOT refuse: that is this card's
 *     own paid-for defect, where a hard-coded 3 would have refused a Keep with
 *     27 slots free.
 *   · **Keep's three provider steps happen in the design's order**, and a Keep
 *     that loses its write releases the slot and deletes the clip rather than
 *     leaving bytes nothing will collect and a slot out of the plan.
 *
 * ⚠ **The scope is set per test rather than assumed.** `captureCastingVoiceEnabled`
 * reads `process.env` at the point of use, so a suite that forgot it would
 * refuse everything with `voice_off` and every other arm below would pass for
 * the wrong reason — which is the shape of a guard that survives sabotage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CASTING_V2_SCOPE_ENV, CASTING_VOICE_SCOPE_ENV } from "./castingV2Scope";
import { ProviderError } from "../providers/types";
import type { VoiceAllowance, VoiceEngine } from "../providers/voiceTypes";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const USER_ID = 1;
const MODEL_ID = 904;
const SENTENCE = "Low, dry, unhurried — it does not ask, it decides.";
const CLIP = Buffer.from("ID3 ninety seconds of a voice", "utf8");

/** His live account, read first-hand 2026-10-13 — the positive control's shape. */
const LIVE: VoiceAllowance = {
  slotsTotal: 30,
  slotsUsed: 3,
  operationsTotal: 95,
  operationsUsed: 4,
  instantCloning: true,
  tier: "creator",
};

let cast: { modelId: number; name: string | null; voice: string | null } | null = null;
let keptAlready: unknown = null;
let inserted = true;
const storagePuts: string[] = [];
const storageDeletes: string[] = [];

vi.mock("../db/castVoices", () => ({
  readCastVoiceLine: async () => cast,
  readCastVoice: async () => keptAlready,
  insertCastVoice: async () => {
    if (insertThrows) throw insertThrows;
    return { inserted };
  },
}));

/**
 * THE CLIP'S WRITE-AHEAD HOLD, recorded — #2470's finding, item 2.
 *
 * The REAL `holdClipForWrite` runs against these: a stub injected through the
 * deps would have proven only that the service called something, where this
 * proves the manifest's own two decisions (born held, and the kind) and its
 * ORDER against the `storagePut`.
 */
const clipHolds: Array<{
  id: string;
  userId: number;
  kind: string;
  heldUntil: Date | null | undefined;
  storageItems: ReadonlyArray<{ storageKey: string; storageBackend: string }>;
}> = [];
let holdThrows = false;
/** A row write that THROWS rather than reporting zero rows — the orphan case. */
let insertThrows: Error | null = null;

vi.mock("../db/connection", () => ({
  withTransaction: async (run: (tx: unknown) => unknown) => run({}),
}));

vi.mock("../db/storageCleanup", () => ({
  storageCleanupManifestHeldUntil: () => new Date(Date.now() + 5 * 60 * 1000),
  createStorageCleanupManifestIn: async (_tx: unknown, input: unknown) => {
    if (holdThrows) throw new Error("manifest refused");
    clipHolds.push(input as (typeof clipHolds)[number]);
    return input;
  },
}));

vi.mock("../storage", () => ({
  storagePut: async (key: string) => {
    storagePuts.push(key);
  },
  storageDelete: async (key: string) => {
    storageDeletes.push(key);
  },
}));

const { designCastVoices, keepCastVoice } = await import("./voiceService");

/** What the engine was asked to do, in order — the only honest order claim. */
type Call = "allowance" | "design" | "save" | "speak" | "delete";

function stubEngine(
  overrides: Partial<VoiceEngine> & { allowance?: VoiceAllowance } = {},
): { engine: VoiceEngine; calls: Call[] } {
  const calls: Call[] = [];
  const engine: VoiceEngine = {
    id: "stub",
    async readAllowance() {
      calls.push("allowance");
      return overrides.allowance ?? LIVE;
    },
    async designVoices() {
      calls.push("design");
      return {
        previews: [
          { previewId: "p1", bytes: CLIP, contentType: "audio/mpeg", durationSeconds: 15 },
          { previewId: "p2", bytes: CLIP, contentType: "audio/mpeg" },
          { previewId: "p3", bytes: CLIP, contentType: "audio/mpeg" },
        ],
        latencyMs: 7_100,
      };
    },
    async saveVoice() {
      calls.push("save");
      return { voiceId: "saved-7", latencyMs: 1_650 };
    },
    async speak() {
      calls.push("speak");
      return { bytes: CLIP, contentType: "audio/mpeg", latencyMs: 4_200 };
    },
    async deleteVoice() {
      calls.push("delete");
    },
    ...overrides,
  };
  return { engine, calls };
}

const KEEP = { userId: USER_ID, modelId: MODEL_ID, previewId: "p2", designSentence: SENTENCE };

beforeEach(() => {
  process.env[CASTING_VOICE_SCOPE_ENV] = "users:1";
  process.env[CASTING_V2_SCOPE_ENV] = "all";
  cast = { modelId: MODEL_ID, name: "Reva", voice: SENTENCE };
  keptAlready = null;
  inserted = true;
  storagePuts.length = 0;
  storageDeletes.length = 0;
  clipHolds.length = 0;
  holdThrows = false;
  insertThrows = null;
});

afterEach(() => {
  delete process.env[CASTING_VOICE_SCOPE_ENV];
  delete process.env[CASTING_V2_SCOPE_ENV];
});

describe("the flag is the outermost door", () => {
  it("⚠ off, and NOT ONE provider call is made — on either entrance", async () => {
    delete process.env[CASTING_VOICE_SCOPE_ENV];
    const { engine, calls } = stubEngine();

    expect(await designCastVoices({ userId: USER_ID, modelId: MODEL_ID }, { engine })).toEqual({
      ok: false,
      refusal: "voice_off",
    });
    expect(await keepCastVoice(KEEP, { engine })).toEqual({ ok: false, refusal: "voice_off" });

    expect(calls).toEqual([]);
    expect(storagePuts).toEqual([]);
  });
});

describe("a design", () => {
  it("CONTROL — the cast's own words become three voices, and spend no operation", async () => {
    const { engine, calls } = stubEngine();
    const result = await designCastVoices({ userId: USER_ID, modelId: MODEL_ID }, { engine });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previews).toHaveLength(3);
    expect(result.designSentence).toBe(SENTENCE);
    /* A design never reads the allowance, because it never spends one. */
    expect(calls).toEqual(["design"]);
  });

  it("refuses a cast that is not this owner's live signed cast, and asks nothing", async () => {
    cast = null;
    const { engine, calls } = stubEngine();
    expect(await designCastVoices({ userId: USER_ID, modelId: MODEL_ID }, { engine })).toEqual({
      ok: false,
      refusal: "cast_not_available",
    });
    expect(calls).toEqual([]);
  });

  it("refuses when there is no voice line to make a voice FROM", async () => {
    for (const voice of [null, "", "   "]) {
      cast = { modelId: MODEL_ID, name: "Reva", voice };
      const { engine, calls } = stubEngine();
      expect(await designCastVoices({ userId: USER_ID, modelId: MODEL_ID }, { engine })).toEqual({
        ok: false,
        refusal: "no_voice_line",
      });
      expect(calls).toEqual([]);
    }
  });

  it("⚠ tells a line TOO SHORT apart from an outage — a different thing to say", async () => {
    const { engine } = stubEngine({
      async designVoices() {
        throw new ProviderError("capability", "A voice needs at least 20 characters to design from");
      },
    });
    expect(await designCastVoices({ userId: USER_ID, modelId: MODEL_ID }, { engine })).toEqual({
      ok: false,
      refusal: "voice_line_too_short",
    });
  });

  it("reports a provider failure as itself, carrying the class for the house", async () => {
    const { engine } = stubEngine({
      async designVoices() {
        throw new ProviderError("rate_limit", "The voice call was refused");
      },
    });
    expect(await designCastVoices({ userId: USER_ID, modelId: MODEL_ID }, { engine })).toEqual({
      ok: false,
      refusal: "provider_failed",
      failureClass: "rate_limit",
    });
  });
});

describe("a Keep reads the allowance BEFORE it spends", () => {
  it("⚠ A FAILED READ REFUSES, AND NOTHING IS SAVED (invariant 7)", async () => {
    const { engine, calls } = stubEngine({
      async readAllowance() {
        throw new ProviderError("transport", "The voice transport is unreachable");
      },
    });
    const result = await keepCastVoice(KEEP, { engine });

    expect(result).toEqual({
      ok: false,
      refusal: "allowance_unreadable",
      failureClass: "transport",
    });
    /* The claim is that nothing was ATTEMPTED, not that a boolean was false. */
    expect(calls).toEqual([]);
    expect(storagePuts).toEqual([]);
  });

  it("⚠ THE KEY BEING ABSENT REFUSES AT THE READ, before any spend", async () => {
    /*
      The transport throws `provider_account` for a missing key (its own
      `requireKey`), and the FIRST thing a Keep does is read the allowance — so
      an unconfigured account cannot reach the save at all. Driven as the card
      asks rather than reasoned from the boot fence, which is a different
      control on a different road.
    */
    const { engine, calls } = stubEngine({
      async readAllowance() {
        throw new ProviderError(
          "provider_account",
          "The voice transport is not configured (ELEVENLABS_API_KEY)",
        );
      },
    });
    const result = await keepCastVoice(KEEP, { engine });

    expect(result).toEqual({
      ok: false,
      refusal: "allowance_unreadable",
      failureClass: "provider_account",
    });
    expect(calls).toEqual([]);
  });

  it("refuses when the month's voice operations are spent", async () => {
    const { engine, calls } = stubEngine({
      allowance: { ...LIVE, operationsUsed: 95, operationsTotal: 95 },
    });
    expect(await keepCastVoice(KEEP, { engine })).toEqual({
      ok: false,
      refusal: "no_operations_left",
    });
    expect(calls).toEqual(["allowance"]);
  });

  it("refuses when every slot the plan allows is occupied", async () => {
    const { engine, calls } = stubEngine({ allowance: { ...LIVE, slotsUsed: 30 } });
    expect(await keepCastVoice(KEEP, { engine })).toEqual({ ok: false, refusal: "no_slots_left" });
    expect(calls).toEqual(["allowance"]);
  });

  it("⚠ POSITIVE CONTROL — 3 used on a 30-slot plan KEEPS, which a hard-coded 3 would have refused", async () => {
    /*
      This card's own correction, as an arm. It was filed against a 3-slot
      account and told a builder to refuse *"when three slots are full"*; his
      plan was upgraded the same day to 30. A refusal keyed on the number 3
      passes every arm above this one and fails only here.
    */
    const { engine } = stubEngine({ allowance: { ...LIVE, slotsUsed: 3, slotsTotal: 30 } });
    const result = await keepCastVoice(KEEP, { engine });
    expect(result.ok, "a Keep with 27 slots free must not refuse").toBe(true);
  });
});

describe("a Keep, once it is allowed to spend", () => {
  it("CONTROL — saves, records and stores, in the design's order", async () => {
    const { engine, calls } = stubEngine();
    const result = await keepCastVoice(KEEP, { engine });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /*
      §4's order, and the allowance first. A `speak` before a `save` is the call
      the spike measured as a 404, so the order is the feature.
    */
    expect(calls).toEqual(["allowance", "save", "speak"]);
    expect(storagePuts).toEqual([result.clipStorageKey]);
    expect(storageDeletes).toEqual([]);
    /* The clip is recorded by its own bytes, not by what was asked for. */
    expect(result.clipBytes).toBe(CLIP.byteLength);
    expect(result.clipSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.allowanceBefore).toEqual(LIVE);
  });

  it("⚠ the clip's key is UNGUESSABLE and scoped to the owner and the cast", async () => {
    const { engine } = stubEngine();
    const first = await keepCastVoice(KEEP, { engine });
    const second = await keepCastVoice(KEEP, { engine });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.clipStorageKey).not.toBe(second.clipStorageKey);
    expect(first.clipStorageKey).toContain(`casting/voices/${USER_ID}/${MODEL_ID}/`);
    expect(first.clipStorageKey.endsWith(".mp3")).toBe(true);
  });

  it("⚠ an audition that fails RELEASES the slot rather than stranding it", async () => {
    const { engine, calls } = stubEngine({
      async speak() {
        throw new ProviderError("timeout", "The voice call exceeded its deadline");
      },
    });
    expect(await keepCastVoice(KEEP, { engine })).toEqual({
      ok: false,
      refusal: "provider_failed",
      failureClass: "timeout",
    });
    expect(calls).toEqual(["allowance", "save", "delete"]);
    expect(storagePuts).toEqual([]);
  });

  it("⚠ A LOST WRITE RELEASES THE SLOT AND DELETES THE CLIP", async () => {
    /*
      The cast can be deleted inside the three provider steps, which take tens
      of seconds — so the insert proves the owned live cast in its own
      statement, and when it writes nothing this Keep owns nothing. Both the
      slot and the bytes have to go, or the account carries a slot out of its
      plan and the bucket carries an object no row will ever name.
    */
    inserted = false;
    const { engine, calls } = stubEngine();
    expect(await keepCastVoice(KEEP, { engine })).toEqual({
      ok: false,
      refusal: "cast_not_available",
    });

    expect(calls).toEqual(["allowance", "save", "speak", "delete"]);
    expect(storageDeletes).toHaveLength(1);
    expect(storagePuts).toEqual(storageDeletes);
  });

  /*
    THE CLIP IS HELD BEFORE IT IS STORED — #2470's finding, item 2.

    A process death between the `storagePut` and the row write leaves ninety
    seconds of a voice in the PUBLIC bucket under a key no row names, and both
    deletion roads find clips THROUGH the rows — so no try/catch can reach it
    and only a write-ahead manifest can. These arms are about the ORDER and
    about the manifest's two decisions.
  */
  it("⚠ HOLDS THE CLIP'S KEY BEFORE THE BYTES ARE STORED, born held and on the right key", async () => {
    const { engine } = stubEngine();
    expect(await keepCastVoice(KEEP, { engine })).toMatchObject({ ok: true });

    expect(clipHolds).toHaveLength(1);
    const [hold] = clipHolds;
    /* THE ORDER IS THE CLAIM: the key is held, and only then written. */
    expect(hold?.storageItems.map((one) => one.storageKey)).toEqual(storagePuts);
    expect(hold?.storageItems[0]?.storageBackend).toBe("public_r2");
    /*
      BORN HELD. Without a hold the manifest is claimable the instant it is
      written — the worker's in-flight fence tests the batch against a live
      operation row, and this batch's operation id is synthetic, so the fence
      passes trivially and the worker would delete the clip mid-upload.
    */
    expect(hold?.heldUntil).toBeInstanceOf(Date);
    expect((hold?.heldUntil as Date).getTime()).toBeGreaterThan(Date.now());
    expect(hold?.kind).toBe("casting_candidate_cleanup");
    expect(hold?.userId).toBe(USER_ID);
  });

  it("⚠ STORES NOTHING when the hold cannot be written, and releases the slot", async () => {
    /*
      The hold is the thing that makes the bytes recoverable, so storing them
      without it is the one order this road must never take. Nothing is in the
      bucket yet, so there is nothing to delete — only the slot the save spent.
    */
    holdThrows = true;
    const { engine, calls } = stubEngine();

    expect(await keepCastVoice(KEEP, { engine })).toEqual({
      ok: false,
      refusal: "provider_failed",
      failureClass: "transport",
    });
    expect(storagePuts).toEqual([]);
    expect(storageDeletes).toEqual([]);
    expect(calls).toEqual(["allowance", "save", "speak", "delete"]);
  });

  it("⚠ A THROWN ROW WRITE RELEASES THE SLOT, DELETES THE CLIP, AND RETHROWS", async () => {
    /*
      The finding's own case, and it is NOT the lost-write arm above: a dropped
      connection or a timeout at the INSERT throws rather than reporting zero
      rows, and before this repair it propagated with the slot still held and
      the clip still stored. It rethrows rather than becoming a refusal, because
      a Keep that failed for an unknown reason is not the same fact as one the
      provider refused.
    */
    insertThrows = new Error("ETIMEDOUT");
    const { engine, calls } = stubEngine();

    await expect(keepCastVoice(KEEP, { engine })).rejects.toThrow(/ETIMEDOUT/);
    expect(calls).toEqual(["allowance", "save", "speak", "delete"]);
    expect(storageDeletes).toHaveLength(1);
    expect(storagePuts).toEqual(storageDeletes);
  });

  it("refuses a second Keep on a cast that already has one, before any spend", async () => {
    keptAlready = { id: 1, modelId: MODEL_ID };
    const { engine, calls } = stubEngine();
    expect(await keepCastVoice(KEEP, { engine })).toEqual({ ok: false, refusal: "already_kept" });
    expect(calls).toEqual([]);
  });

  it("refuses a cast that went away before the first provider call", async () => {
    cast = null;
    const { engine, calls } = stubEngine();
    expect(await keepCastVoice(KEEP, { engine })).toEqual({
      ok: false,
      refusal: "cast_not_available",
    });
    expect(calls).toEqual([]);
  });
});
