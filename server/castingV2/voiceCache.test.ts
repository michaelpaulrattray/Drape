/**
 * THE VOICE CACHE, DRIVEN DIRECTLY — N4b-4 (#2472): eviction and re-mint.
 *
 * His ear passed the re-mint court on 2026-10-13, verbatim: *"remint actually
 * sounds better in some cases both 90s clips were great though."* So a provider
 * slot is a cache over the stored ~90 s audition clip, and the card's done-when
 * is what these arms drive: **a Keep on a full plan evicts, a later use
 * re-mints, and the voice operations move by exactly what was spent.**
 *
 * The engine is INJECTED and records every call in order, so the operation
 * count is read off the calls actually made — a save and a clone are the only
 * two calls that spend one (measured: a design and a delete spend none). The
 * statements are recorded in `timeline` so an ORDER claim (the row stops naming
 * a slot before the slot is deleted; a clip is proved before anything is
 * evicted for it) is asserted on what happened rather than on intent.
 *
 * What no arm here can prove, and the PR says so: that the provider's real
 * `POST /v1/voices/add` clones the clip the way the court measured. That is
 * the court's own receipt and his ear; the wire shape is pinned in
 * `elevenlabsVoiceWire.test.ts`.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CASTING_V2_SCOPE_ENV, CASTING_VOICE_SCOPE_ENV } from "./castingV2Scope";
import { ProviderError } from "../providers/types";
import type { VoiceAllowance, VoiceEngine } from "../providers/voiceTypes";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const USER_ID = 1;
const MODEL_ID = 904;
const OWN_ROW = 77;
const SENTENCE = "Low, dry, unhurried — it does not ask, it decides.";
const CLIP = Buffer.from("ID3 ninety seconds of a voice", "utf8");
const CLIP_SHA = createHash("sha256").update(CLIP).digest("hex");

/** A three-slot account, every slot taken — the card's own done-when shape. */
const FULL: VoiceAllowance = {
  slotsTotal: 3,
  slotsUsed: 3,
  operationsTotal: 95,
  operationsUsed: 9,
  instantCloning: true,
  tier: "creator",
};

type OwnVoice = {
  id: number;
  voiceId: string | null;
  clipStorageKey: string;
  clipSha256: string;
  clipContentType: string;
};

let cast: { modelId: number; name: string | null; voice: string | null } | null = null;
let ownVoice: OwnVoice | null = null;
/** What the LRU read hands back, oldest first. */
let candidates: Array<{ id: number; userId: number; modelId: number; voiceId: string }> = [];
const candidateReads: Array<{ limit: number; excludeId?: number }> = [];
/** Rows whose eviction compare-and-set LOSES (another road moved them). */
let evictionLoses = new Set<number>();
let remintRecorded = true;
/** When a re-mint loses its write, what the re-read finds. */
let ownVoiceAfterLostRemint: OwnVoice | null = null;
let replacedVoice: { voiceId: string | null } | null = null;
let storedClip: Buffer = CLIP;
let clipReadThrows = false;
const remintWrites: Array<{ id: number; userId: number; modelId: number; clipSha256: string; voiceId: string }> = [];
const touches: Array<{ userId: number; modelId: number }> = [];
const timeline: string[] = [];

vi.mock("../db/castVoices", () => ({
  readCastVoiceLine: async () => cast,
  readCastVoiceForUse: async () => ownVoice,
  readEvictionCandidates: async (input: { limit: number; excludeId?: number }) => {
    candidateReads.push(input);
    return candidates.filter((one) => one.id !== input.excludeId).slice(0, input.limit);
  },
  evictCastVoiceSlot: async (input: { id: number; voiceId: string }) => {
    if (evictionLoses.has(input.id)) return false;
    timeline.push(`evict-row:${input.id}`);
    return true;
  },
  restoreCastVoiceSlot: async (input: { id: number; voiceId: string }) => {
    timeline.push(`restore-row:${input.id}:${input.voiceId}`);
    return true;
  },
  recordRemintedCastVoice: async (input: (typeof remintWrites)[number]) => {
    timeline.push("remint-row");
    remintWrites.push(input);
    if (!remintRecorded) {
      ownVoice = ownVoiceAfterLostRemint;
      return false;
    }
    return true;
  },
  touchCastVoiceUsed: async (input: { userId: number; modelId: number }) => {
    touches.push(input);
  },
  insertCastVoice: async () => {
    timeline.push("row-write");
    return { inserted: true, replaced: replacedVoice };
  },
  removeCastVoice: async () => null,
}));

vi.mock("../db/castVoiceCards", () => ({
  readCastVoiceCardSources: async () => null,
  readCastVoiceCard: async () => null,
  saveCastVoiceCard: async () => ({ written: true }),
}));
vi.mock("../db/castingV2Sign", () => ({ readCastOriginalAnchorKey: async () => null }));
vi.mock("../db/connection", () => ({
  withTransaction: async (run: (tx: unknown) => unknown) => run({}),
}));
vi.mock("../db/storageCleanup", () => ({
  storageCleanupManifestHeldUntil: () => new Date(Date.now() + 5 * 60 * 1000),
  createStorageCleanupManifestIn: async (_tx: unknown, input: unknown) => input,
}));
vi.mock("../storage", () => ({
  storagePut: async () => undefined,
  storageDelete: async () => undefined,
  storageReadBytes: async () => ({ bytes: Buffer.alloc(0), contentType: "image/png" }),
  storageReadAudioBytes: async (key: string) => {
    timeline.push(`clip-read:${key === ownVoice?.clipStorageKey ? "own" : key}`);
    if (clipReadThrows) throw new Error("NoSuchKey");
    return { bytes: storedClip, contentType: "audio/mpeg" };
  },
}));

const { ensureCastVoiceResident, keepCastVoice } = await import("./voiceService");

type Call = "allowance" | "save" | "speak" | "delete" | "clone";

/** The two calls that spend a voice operation (measured, #2469). */
function operationsSpent(calls: Call[]): number {
  return calls.filter((call) => call === "save" || call === "clone").length;
}

function stubEngine(
  overrides: Partial<VoiceEngine> & { allowance?: VoiceAllowance } = {},
): { engine: VoiceEngine; calls: Call[]; cloned: Array<{ name: string; bytes: Buffer; contentType: string }> } {
  const calls: Call[] = [];
  const cloned: Array<{ name: string; bytes: Buffer; contentType: string }> = [];
  const engine: VoiceEngine = {
    id: "stub",
    async readAllowance() {
      calls.push("allowance");
      return overrides.allowance ?? FULL;
    },
    async designVoices() {
      throw new Error("no design on this road");
    },
    async saveVoice() {
      calls.push("save");
      timeline.push("save");
      return { voiceId: "saved-new", latencyMs: 1_650 };
    },
    async speak() {
      calls.push("speak");
      return { bytes: CLIP, contentType: "audio/mpeg", latencyMs: 4_200 };
    },
    async deleteVoice(input) {
      calls.push("delete");
      timeline.push(`release:${input.voiceId}`);
    },
    async cloneVoice(input) {
      calls.push("clone");
      timeline.push("clone");
      cloned.push({ name: input.name, bytes: input.bytes, contentType: input.contentType });
      return { voiceId: "reminted-1", latencyMs: 3_200 };
    },
    ...overrides,
  };
  return { engine, calls, cloned };
}

const KEEP = { userId: USER_ID, modelId: MODEL_ID, previewId: "p2", designSentence: SENTENCE };
const USE = { userId: USER_ID, modelId: MODEL_ID };

beforeEach(() => {
  process.env[CASTING_VOICE_SCOPE_ENV] = "users:1";
  process.env[CASTING_V2_SCOPE_ENV] = "all";
  cast = { modelId: MODEL_ID, name: "Reva", voice: SENTENCE };
  ownVoice = null;
  candidates = [
    { id: 11, userId: 5, modelId: 501, voiceId: "coldest" },
    { id: 12, userId: 6, modelId: 602, voiceId: "colder" },
    { id: 13, userId: 1, modelId: 905, voiceId: "warm" },
  ];
  candidateReads.length = 0;
  evictionLoses = new Set();
  remintRecorded = true;
  ownVoiceAfterLostRemint = null;
  replacedVoice = null;
  storedClip = CLIP;
  clipReadThrows = false;
  remintWrites.length = 0;
  touches.length = 0;
  timeline.length = 0;
});

afterEach(() => {
  delete process.env[CASTING_VOICE_SCOPE_ENV];
  delete process.env[CASTING_V2_SCOPE_ENV];
});

describe("a Keep on a full plan evicts the least-recently-used voice", () => {
  it("⚠ THE CARD'S DONE-WHEN — a fourth Keep on a three-slot account evicts, then keeps, spending ONE operation", async () => {
    const { engine, calls } = stubEngine();

    const result = await keepCastVoice(KEEP, { engine });

    expect(result).toMatchObject({ ok: true, evicted: 1 });
    expect(calls).toEqual(["allowance", "delete", "save", "speak"]);
    /* The coldest voice, and only it: the row stops naming the slot BEFORE
       the slot is deleted, and both happen before the new save. */
    expect(timeline).toEqual(["evict-row:11", "release:coldest", "save", "row-write"]);
    expect(operationsSpent(calls)).toBe(1);
  });

  it("NEGATIVE CONTROL — a plan with room evicts nothing and does not even rank", async () => {
    const { engine, calls } = stubEngine({ allowance: { ...FULL, slotsUsed: 2 } });

    expect(await keepCastVoice(KEEP, { engine })).toMatchObject({ ok: true, evicted: 0 });
    expect(calls).toEqual(["allowance", "save", "speak"]);
    expect(candidateReads).toEqual([]);
    expect(timeline).not.toContain("evict-row:11");
  });

  it("⚠ A PLAN THAT CANNOT CLONE EVICTS NOTHING — an evicted voice there could never come back", async () => {
    const { engine, calls } = stubEngine({ allowance: { ...FULL, instantCloning: false } });

    expect(await keepCastVoice(KEEP, { engine })).toEqual({ ok: false, refusal: "no_slots_left" });
    expect(calls).toEqual(["allowance"]);
    expect(candidateReads).toEqual([]);
    expect(timeline).toEqual([]);
  });

  it("refuses before any spend when there is no resident voice of ours to give up", async () => {
    candidates = [];
    const { engine, calls } = stubEngine();

    expect(await keepCastVoice(KEEP, { engine })).toEqual({ ok: false, refusal: "no_slots_left" });
    expect(calls).toEqual(["allowance"]);
    expect(operationsSpent(calls)).toBe(0);
  });

  it("⚠ A SLOT THAT WILL NOT RELEASE PUTS THE ROW BACK, and nothing is saved", async () => {
    const { engine, calls } = stubEngine({
      async deleteVoice(input) {
        calls.push("delete");
        timeline.push(`release-failed:${input.voiceId}`);
        throw new ProviderError("transport", "vendor down", { status: 503 });
      },
    });

    expect(await keepCastVoice(KEEP, { engine })).toEqual({ ok: false, refusal: "no_slots_left" });
    expect(timeline).toEqual(["evict-row:11", "release-failed:coldest", "restore-row:11:coldest"]);
    /* One failed delete stops the eviction — it does not walk the whole pool. */
    expect(calls).toEqual(["allowance", "delete"]);
    expect(operationsSpent(calls)).toBe(0);
  });

  it("a slot already gone at the provider (404) leaves its row empty and tries the next voice", async () => {
    let first = true;
    const { engine, calls } = stubEngine({
      async deleteVoice(input) {
        calls.push("delete");
        timeline.push(`release:${input.voiceId}`);
        if (first) {
          first = false;
          throw new ProviderError("capability", "gone", { status: 404 });
        }
      },
    });

    expect(await keepCastVoice(KEEP, { engine })).toMatchObject({ ok: true, evicted: 1 });
    expect(timeline.slice(0, 4)).toEqual(["evict-row:11", "release:coldest", "evict-row:12", "release:colder"]);
    expect(timeline).not.toContain("restore-row:11:coldest");
  });

  it("⚠ a voice another road moved first is SKIPPED — its slot is not this Keep's to release", async () => {
    evictionLoses = new Set([11]);
    const { engine } = stubEngine();

    expect(await keepCastVoice(KEEP, { engine })).toMatchObject({ ok: true, evicted: 1 });
    expect(timeline).not.toContain("release:coldest");
    expect(timeline.slice(0, 2)).toEqual(["evict-row:12", "release:colder"]);
  });

  it("⚠ A REPLACE GIVES UP ITS OWN SLOT FIRST, not another customer's", async () => {
    ownVoice = { id: OWN_ROW, voiceId: "own-old", clipStorageKey: "k", clipSha256: CLIP_SHA, clipContentType: "audio/mpeg" };
    /* Evicted first, so by the row write the old row names no slot. */
    replacedVoice = { voiceId: null };
    const { engine, calls } = stubEngine();

    expect(await keepCastVoice(KEEP, { engine })).toMatchObject({
      ok: true,
      evicted: 1,
      replaced: { slotReleased: true },
    });
    expect(timeline).toEqual([`evict-row:${OWN_ROW}`, "release:own-old", "save", "row-write"]);
    /* No second release: the slot was already given back. */
    expect(calls.filter((call) => call === "delete")).toHaveLength(1);
    expect(operationsSpent(calls)).toBe(1);
  });

  it("frees MORE than one slot when the plan was cut below what it holds", async () => {
    const { engine } = stubEngine({ allowance: { ...FULL, slotsUsed: 4 } });

    expect(await keepCastVoice(KEEP, { engine })).toMatchObject({ ok: true, evicted: 2 });
    expect(timeline.slice(0, 4)).toEqual(["evict-row:11", "release:coldest", "evict-row:12", "release:colder"]);
  });

  it("refuses rather than clearing the pool when the plan is far over its limit", async () => {
    const { engine, calls } = stubEngine({ allowance: { ...FULL, slotsUsed: 10 } });

    expect(await keepCastVoice(KEEP, { engine })).toEqual({ ok: false, refusal: "no_slots_left" });
    expect(calls).toEqual(["allowance"]);
    expect(timeline).toEqual([]);
  });
});

describe("a later use re-mints an evicted voice from its clip", () => {
  const EVICTED: OwnVoice = {
    id: OWN_ROW,
    voiceId: null,
    clipStorageKey: "casting/voices/1/904/abc.mp3",
    clipSha256: CLIP_SHA,
    clipContentType: "audio/mpeg",
  };

  it("CONTROL — a resident voice is answered at once, marked used, and spends NOTHING", async () => {
    ownVoice = { ...EVICTED, voiceId: "resident-7" };
    const { engine, calls } = stubEngine();

    expect(await ensureCastVoiceResident(USE, { engine })).toEqual({
      ok: true,
      voiceId: "resident-7",
      reminted: false,
      evicted: 0,
    });
    expect(calls).toEqual([]);
    expect(touches).toEqual([USE]);
  });

  it("⚠ THE CARD'S DONE-WHEN — an evicted voice is cloned back from ITS OWN clip, spending ONE operation", async () => {
    ownVoice = { ...EVICTED };
    const { engine, calls, cloned } = stubEngine({ allowance: { ...FULL, slotsUsed: 2 } });

    expect(await ensureCastVoiceResident(USE, { engine })).toEqual({
      ok: true,
      voiceId: "reminted-1",
      reminted: true,
      evicted: 0,
    });
    expect(calls).toEqual(["allowance", "clone"]);
    expect(operationsSpent(calls)).toBe(1);
    /* The bytes sent are the stored clip's, exactly, and the name is ours. */
    expect(cloned).toHaveLength(1);
    expect(cloned[0]?.bytes.equals(CLIP)).toBe(true);
    expect(cloned[0]?.name).toBe(`klieg-${USER_ID}-${MODEL_ID}`);
    expect(cloned[0]?.name).not.toContain("Reva");
    /* Recorded against the clip it was cloned from. */
    expect(remintWrites).toEqual([
      { id: OWN_ROW, userId: USER_ID, modelId: MODEL_ID, clipSha256: CLIP_SHA, voiceId: "reminted-1" },
    ]);
  });

  it("⚠ on a full plan it evicts SOMEONE ELSE, never itself, before the clone — still one operation", async () => {
    ownVoice = { ...EVICTED };
    const { engine, calls } = stubEngine();

    expect(await ensureCastVoiceResident(USE, { engine })).toMatchObject({ ok: true, reminted: true, evicted: 1 });
    expect(candidateReads[0]?.excludeId).toBe(OWN_ROW);
    expect(timeline).toEqual(["clip-read:own", "evict-row:11", "release:coldest", "clone", "remint-row"]);
    expect(operationsSpent(calls)).toBe(1);
  });

  it("⚠ A PLAN THAT CANNOT CLONE refuses, and the kept voice is left exactly as it was", async () => {
    ownVoice = { ...EVICTED };
    const { engine, calls } = stubEngine({ allowance: { ...FULL, slotsUsed: 0, instantCloning: false } });

    expect(await ensureCastVoiceResident(USE, { engine })).toEqual({ ok: false, refusal: "remint_unavailable" });
    expect(calls).toEqual(["allowance"]);
    expect(remintWrites).toEqual([]);
  });

  it("refuses when the month's voice operations are spent", async () => {
    ownVoice = { ...EVICTED };
    const { engine, calls } = stubEngine({ allowance: { ...FULL, operationsUsed: 95 } });

    expect(await ensureCastVoiceResident(USE, { engine })).toEqual({ ok: false, refusal: "no_operations_left" });
    expect(calls).toEqual(["allowance"]);
    expect(timeline).toEqual([]);
  });

  it("⚠ AN UNREADABLE ALLOWANCE REFUSES the re-mint (invariant 7)", async () => {
    ownVoice = { ...EVICTED };
    const { engine, calls } = stubEngine({
      async readAllowance() {
        calls.push("allowance");
        throw new ProviderError("transport", "down");
      },
    });

    expect(await ensureCastVoiceResident(USE, { engine })).toMatchObject({ ok: false, refusal: "allowance_unreadable" });
    expect(calls).toEqual(["allowance"]);
  });

  it("⚠ A CLIP WHOSE BYTES DISAGREE WITH ITS SHA256 IS NEVER CLONED — and evicts nobody for it", async () => {
    ownVoice = { ...EVICTED };
    storedClip = Buffer.from("some other ninety seconds", "utf8");
    const { engine, calls } = stubEngine();

    expect(await ensureCastVoiceResident(USE, { engine })).toEqual({ ok: false, refusal: "clip_unreadable" });
    expect(calls).toEqual(["allowance"]);
    expect(timeline).toEqual(["clip-read:own"]);
  });

  it("a clip that cannot be read refuses the same way", async () => {
    ownVoice = { ...EVICTED };
    clipReadThrows = true;
    const { engine, calls } = stubEngine();

    expect(await ensureCastVoiceResident(USE, { engine })).toEqual({ ok: false, refusal: "clip_unreadable" });
    expect(calls).toEqual(["allowance"]);
  });

  it("a clone the provider refuses writes nothing — the kept voice is unchanged", async () => {
    ownVoice = { ...EVICTED };
    const { engine } = stubEngine({
      allowance: { ...FULL, slotsUsed: 0 },
      async cloneVoice() {
        throw new ProviderError("rate_limit", "busy", { status: 429 });
      },
    });

    expect(await ensureCastVoiceResident(USE, { engine })).toMatchObject({ ok: false, refusal: "provider_failed" });
    expect(remintWrites).toEqual([]);
  });

  it("⚠ A RE-MINT THAT LOSES ITS WRITE RELEASES ITS CLONE, and speaks with the voice that won", async () => {
    ownVoice = { ...EVICTED };
    remintRecorded = false;
    ownVoiceAfterLostRemint = { ...EVICTED, voiceId: "won-elsewhere" };
    const { engine } = stubEngine({ allowance: { ...FULL, slotsUsed: 0 } });

    expect(await ensureCastVoiceResident(USE, { engine })).toEqual({
      ok: true,
      voiceId: "won-elsewhere",
      reminted: false,
      evicted: 0,
    });
    expect(timeline).toEqual(["clip-read:own", "clone", "remint-row", "release:reminted-1"]);
  });

  it("⚠ TWO USES AT ONCE CLONE ONCE — one operation, not two", async () => {
    ownVoice = { ...EVICTED };
    const { engine, calls } = stubEngine({ allowance: { ...FULL, slotsUsed: 0 } });

    const [one, two] = await Promise.all([
      ensureCastVoiceResident(USE, { engine }),
      ensureCastVoiceResident(USE, { engine }),
    ]);

    expect(one).toEqual(two);
    expect(operationsSpent(calls)).toBe(1);
  });

  it("answers `no_kept_voice` for a cast that has none, and asks the provider nothing", async () => {
    const { engine, calls } = stubEngine();

    expect(await ensureCastVoiceResident(USE, { engine })).toEqual({ ok: false, refusal: "no_kept_voice" });
    expect(calls).toEqual([]);
  });

  it("refuses a cast that is not this owner's live signed cast", async () => {
    cast = null;
    ownVoice = { ...EVICTED };
    const { engine, calls } = stubEngine();

    expect(await ensureCastVoiceResident(USE, { engine })).toEqual({ ok: false, refusal: "cast_not_available" });
    expect(calls).toEqual([]);
  });

  it("⚠ is behind the voice scope, and off asks nothing", async () => {
    delete process.env[CASTING_VOICE_SCOPE_ENV];
    ownVoice = { ...EVICTED };
    const { engine, calls } = stubEngine();

    expect(await ensureCastVoiceResident(USE, { engine })).toEqual({ ok: false, refusal: "voice_off" });
    expect(calls).toEqual([]);
    expect(timeline).toEqual([]);
  });
});
