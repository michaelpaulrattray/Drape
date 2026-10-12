/**
 * THE REBUILD DOOR, DRIVEN — #2315 step 1, his word 2026-10-12: *"id retire the
 * paths and remove the key"*, and **"yes"** to switching off the wardrobe and
 * editing a cast on the canvas now, *"so no pictures go to Google"*.
 *
 * # What this proves, arm by arm
 *
 * 1. **Every listed procedure refuses, through the real routers, before anything
 *    is spent.** `appRouter.createCaller` — the real input schemas and handlers —
 *    with the money, the rate limiter, the daily quota, the operation row and the
 *    scratch upload all spied, and each must be reached ZERO times. A door that
 *    refused after a hold would pass an arm that only read the thrown code.
 * 2. **Nothing is ever constructed.** `@google/genai`'s `GoogleGenAI` is replaced
 *    by a class that counts and throws, so "nothing was sent" is a reading at the
 *    wire (working law 5), not an inference from where the refusal sits.
 * 3. **The backstop holds for a road nobody listed.** The pipeline functions are
 *    called DIRECTLY, bypassing every mouth — the only test the mouth gate cannot
 *    rescue (working law 3). Each must leave the constructor at zero.
 * 4. **The one place a client can be built is the one place that is gated.** A
 *    reader over every production source under `server/` and `shared/` finds
 *    `new GoogleGenAI(` and the key read in exactly one file, behind the door. A
 *    second construction site added tomorrow reddens here. The reader has its own
 *    positive control on a synthetic ungated source.
 * 5. **Controls.** Open wardrobe/model reads must NOT meet the door (a blanket
 *    refusal would pass every arm above), and with the door flipped OPEN the same
 *    procedures and the same direct calls must get past it — the constructor
 *    count moving off zero is what proves the counter can see a construction.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  REBUILD_DOOR_CLOSED,
  REBUILD_DOOR_CLOSED_CODE,
  REBUILD_DOOR_CLOSED_PROCEDURES,
  REBUILD_DOOR_OPEN,
} from "@shared/rebuildDoor";
import type { TrpcContext } from "./_core/context";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/* ⚠ A KEY IS PRESENT, ON PURPOSE. Without one `getAiClient` throws "not
   configured" BEFORE it constructs anything, so every "constructed nothing" arm
   below would pass with the door deleted — measured: the first run of this file
   had no key and its open-door control is what caught it. A fake value makes the
   door the only thing between a caller and the constructor. Set in `vi.hoisted`
   so it lands before `server/_core/env.ts` is first loaded. */
vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "rebuild-door-test-not-a-real-key";
});

const spy = vi.hoisted(() => ({
  constructed: vi.fn(),
  money: vi.fn(),
  rateLimit: vi.fn(),
  dailyQuota: vi.fn(),
  operationRow: vi.fn(),
  scratchUpload: vi.fn(),
  storage: vi.fn(),
}));

/* ⚠ THE WIRE. Every road to the provider ends in `new GoogleGenAI(...)`; this
   class counts each construction and refuses to become a client, so nothing in
   this file can ever reach the network even with the door open. The enums the
   pipeline modules import at load time are kept real. */
vi.mock("@google/genai", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  GoogleGenAI: class {
    constructor() {
      spy.constructed();
      throw new Error("PAST_THE_DOOR: a Gemini client was constructed");
    }
  },
}));

const pastTheDoor = (name: string, record: () => void) => (..._args: unknown[]) => {
  record();
  throw new Error(`PAST_THE_DOOR: ${name}`);
};

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deductCredits: pastTheDoor("deductCredits", spy.money),
  getModelById: vi.fn().mockResolvedValue(undefined),
  getGenerationOperationKindByRequest: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./casting/atomicCredits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  withAtomicCredits: pastTheDoor("withAtomicCredits", spy.money),
}));
vi.mock("./db/creditsAtomic", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  withAtomicCredits: pastTheDoor("withAtomicCredits(db)", spy.money),
}));
/* Mocked at `checkRateLimit`, the shared function — the wardrobe's
   `throwIfRateLimited` is a local wrapper with no module of its own (the try-on
   door's suite records what a spy on it cost once). */
vi.mock("./security/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkRateLimit: (...args: unknown[]) => {
    spy.rateLimit(...args);
    return { allowed: true, resetIn: 0, remaining: 1 };
  },
}));
vi.mock("./db/dailyQuota", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  enforceDailyQuota: pastTheDoor("enforceDailyQuota", spy.dailyQuota),
}));
vi.mock("./casting/directOperation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  beginDirectOperation: pastTheDoor("beginDirectOperation", spy.operationRow),
}));
vi.mock("./wardrobe/scratchUpload", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  putWardrobeScratchUpload: pastTheDoor("putWardrobeScratchUpload", spy.scratchUpload),
}));
vi.mock("./storage", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  storagePut: pastTheDoor("storagePut", spy.storage),
}));

/* No arm may reach the network for an image either. */
vi.stubGlobal("fetch", async () => {
  throw new Error("PAST_THE_DOOR: fetch");
});

function context(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: 99,
      openId: `rebuild-door-${role}`,
      email: `${role}@example.com`,
      name: "Rebuild Door",
      displayName: null,
      avatarUrl: null,
      avatarKey: null,
      bannerUrl: null,
      bannerKey: null,
      bio: null,
      loginMethod: "email",
      role,
      approved: true,
      storageUsed: 0,
      storageLimit: 104857600,
      suspendedAt: null,
      suspendedReason: null,
      suspendedBy: null,
      frozenAt: null,
      frozenReason: null,
      frozenBy: null,
      referralCode: null,
      referredByUserId: null,
      accessCode: null,
      approvedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    correlationId: "rebuild-door-test",
  };
}

type AppRouter = (typeof import("./routers"))["appRouter"];

const REQUEST = "c0ffee00-dead-4bee-8cab-000000002315";
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const URL_A = "https://example.test/a.png";
const URL_B = "https://example.test/b.png";

/**
 * One VALID input per closed procedure — zod parses before the handler, so a
 * malformed input would answer BAD_REQUEST and pass for the wrong reason. The
 * admin-only legacy roads are driven AS AN ADMIN: the admin middleware refuses
 * anyone else first, and a staff account's pictures are pictures too.
 */
function asks(router: AppRouter): Record<string, () => Promise<unknown>> {
  const user = () => router.createCaller(context("user"));
  const admin = () => router.createCaller(context("admin"));
  return {
    "generation.parsePrompt": () => user().generation.parsePrompt({ prompt: "a tall dancer with a buzz cut" }),
    "generation.enhance": () => user().generation.enhance({ prompt: "a dancer" }),
    "generation.suggestions": () => user().generation.suggestions({ masterPrompt: "a dancer" }),
    "generation.analyzeReference": () =>
      user().generation.analyzeReference({ referenceImageBase64: PNG }),
    "generation.compactPrompt": () =>
      user().generation.compactPrompt({ clientRequestId: REQUEST, modelId: 1 }),
    "generation.iterate": () =>
      admin().generation.iterate({
        clientRequestId: REQUEST,
        modelId: 1,
        feedback: "make the hair shorter",
        assetId: 1,
      } as never),
    "generation.castingImage": () =>
      admin().generation.castingImage({ clientRequestId: REQUEST, modelId: 1 } as never),
    "generation.mintPackage": () =>
      admin().generation.mintPackage({ clientRequestId: REQUEST, modelId: 1, tier: "draft" } as never),
    "generation.refreshSlots": () =>
      user().generation.refreshSlots({ clientRequestId: REQUEST, modelId: 1, angles: ["frontFull"] }),
    "models.create": () => user().models.create({ clientRequestId: REQUEST, preferences: {} }),
    "wardrobe.garments.quickDetect": () =>
      user().wardrobe.garments.quickDetect({ imageBase64: PNG, targetSlot: "tops" }),
    "wardrobe.vto.detectResultGarments": () =>
      user().wardrobe.vto.detectResultGarments({ resultUrl: URL_A }),
    "wardrobe.vto.classifyEdit": () => user().wardrobe.vto.classifyEdit({ instruction: "shorter sleeves" }),
    "wardrobe.vto.checkIdentity": () =>
      user().wardrobe.vto.checkIdentity({ modelImageUrl: URL_A, resultImageUrl: URL_B }),
    "wardrobe.decompose.analyze": () => user().wardrobe.decompose.analyze({ imageBase64: PNG }),
    "wardrobe.model.analyzeTattoos": () => user().wardrobe.model.analyzeTattoos({ imageUrl: URL_A }),
    "wardrobe.model.checkQuality": () => user().wardrobe.model.checkQuality({ imageUrl: URL_A }),
  };
}

/** null when the failure is THE DOOR's (by its code); otherwise what it was. */
async function outcomeOf(call: () => Promise<unknown>): Promise<string | null> {
  try {
    await call();
    return "RESOLVED";
  } catch (error) {
    const e = error as { code?: string; message?: string; cause?: { message?: string } };
    if (e?.cause?.message === REBUILD_DOOR_CLOSED_CODE) return null;
    return `${e?.code ?? "no code"}: ${e?.message ?? String(error)}`;
  }
}

function clearSpies() {
  for (const fn of Object.values(spy)) fn.mockClear();
}

function expectNothingSpent() {
  expect(spy.constructed, "a Gemini client was constructed").not.toHaveBeenCalled();
  expect(spy.money, "credits were touched").not.toHaveBeenCalled();
  expect(spy.rateLimit, "a rate-limit slot was spent").not.toHaveBeenCalled();
  expect(spy.dailyQuota, "the daily quota was consumed").not.toHaveBeenCalled();
  expect(spy.operationRow, "an operation row was opened").not.toHaveBeenCalled();
  expect(spy.scratchUpload, "a picture was uploaded").not.toHaveBeenCalled();
  expect(spy.storage, "storage was written").not.toHaveBeenCalled();
}

const { appRouter } = await import("./routers");
const ASKS = asks(appRouter);

beforeEach(clearSpies);

describe("the rebuild door is shut (#2315 step 1)", () => {
  it("the door is shut — the premise every arm below rests on", () => {
    expect(REBUILD_DOOR_OPEN).toBe(false);
  });

  it("every listed procedure has a driver here, and no driver outlives its procedure", () => {
    expect(Object.keys(ASKS).sort()).toEqual([...REBUILD_DOOR_CLOSED_PROCEDURES].sort());
  });

  for (const procedure of REBUILD_DOOR_CLOSED_PROCEDURES) {
    it(`⚠ ${procedure} refuses with the door's sentence and code, and nothing is spent or sent`, async () => {
      await expect(ASKS[procedure]!()).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: REBUILD_DOOR_CLOSED,
        cause: { message: REBUILD_DOOR_CLOSED_CODE },
      });
      expectNothingSpent();
    });
  }

  it("names no vendor, model, engine or key — the disappearing-technology law", () => {
    const words = REBUILD_DOOR_CLOSED.toLowerCase();
    for (const forbidden of ["gemini", "google", "model", "engine", "api", "key", "provider", "deprecat"]) {
      expect(words).not.toContain(forbidden);
    }
    expect(REBUILD_DOOR_CLOSED).toMatch(/unavailable/i);
    expect(REBUILD_DOOR_CLOSED).not.toMatch(/fail|error|wrong|sorry/i);
  });
});

describe("⚠ THE BACKSTOP, DRIVEN DIRECTLY — no mouth gate can rescue these", () => {
  /*
    Each of these is a pipeline function a FUTURE caller could reach without
    passing through any listed procedure. They are called with ordinary
    arguments and their own error handling is left alone — several of them fail
    OPEN or fall back to canned text — so the assertion is not about what they
    return but about the wire: the constructor stays at zero.
  */
  const direct: Array<readonly [string, () => Promise<unknown>]> = [
    ["getAiClient", async () => (await import("./casting/geminiClient")).getAiClient()],
    ["parseCastingPrompt", async () => (await import("./casting/promptParser")).parseCastingPrompt("a dancer")],
    ["generateMasterPrompt", async () =>
      (await import("./casting/geminiGeneration")).generateMasterPrompt({ gender: "any" } as never)],
    ["classifyEditSize", async () => (await import("./wardrobe/editClassifier")).classifyEditSize("shorter")],
    ["detectGarmentsInImage", async () =>
      (await import("./wardrobe/garmentDetection")).detectGarmentsInImage(PNG)],
  ];

  it("getAiClient refuses with the door itself", async () => {
    const { getAiClient } = await import("./casting/geminiClient");
    expect(() => getAiClient()).toThrow(REBUILD_DOOR_CLOSED);
    expect(spy.constructed).not.toHaveBeenCalled();
  });

  for (const [name, call] of direct) {
    it(`${name}, called with no procedure in front of it, constructs nothing`, async () => {
      await call().catch(() => undefined);
      expect(spy.constructed).not.toHaveBeenCalled();
    });
  }
});

/**
 * THE CONSTRUCTION-SITE READER. Walks every production `.ts` under `server/`
 * and `shared/` (tests excluded) for the two things that can put a request on
 * the wire: building the client, and reading the key.
 */
const ROOT = resolve(__dirname, "..");

function productionSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...productionSources(full));
    else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const relative = (full: string) => full.slice(ROOT.length + 1).split("\\").join("/");

function constructionSites(sources: Record<string, string>): string[] {
  return Object.entries(sources)
    .filter(([, code]) => /new\s+GoogleGenAI\s*\(/.test(code))
    .map(([file]) => file)
    .sort();
}

function keyReaders(sources: Record<string, string>): string[] {
  return Object.entries(sources)
    .filter(([, code]) => /\bgeminiApiKey\b|GEMINI_API_KEY/.test(code))
    .map(([file]) => file)
    .sort();
}

/** The body of `getAiClient`, and whether the door stands before the construction. */
function factoryIsGated(code: string): boolean {
  const start = code.indexOf("export const getAiClient = () => {");
  if (start < 0) return false;
  const body = code.slice(start, code.indexOf("\n};", start));
  const gate = body.indexOf("assertRebuildDoorOpen();");
  const build = body.search(/new\s+GoogleGenAI\s*\(/);
  const key = body.indexOf("geminiApiKey");
  return gate >= 0 && build > gate && key > gate;
}

describe("⚠ THE ONE PLACE A CLIENT CAN BE BUILT IS THE ONE PLACE THAT IS GATED", () => {
  const sources: Record<string, string> = {};
  for (const dir of ["server", "shared"]) {
    for (const full of productionSources(join(ROOT, dir))) sources[relative(full)] = readFileSync(full, "utf8");
  }

  it("the walk read the tree (a floor, so an empty walk cannot pass)", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(500);
  });

  it("`new GoogleGenAI(` appears in exactly one production file", () => {
    expect(constructionSites(sources)).toEqual(["server/casting/geminiClient.ts"]);
  });

  it("the key is read only where it is declared and where the client is built", () => {
    expect(keyReaders(sources)).toEqual(["server/_core/env.ts", "server/casting/geminiClient.ts"]);
  });

  it("…and inside that file the door stands before the key and the construction", () => {
    expect(factoryIsGated(sources["server/casting/geminiClient.ts"]!)).toBe(true);
  });

  it("POSITIVE CONTROL — the readers find a second site and an ungated factory when they are there", () => {
    const planted = {
      ...sources,
      "server/sneaky.ts": 'const ai = new GoogleGenAI({ apiKey: ENV.geminiApiKey });',
    };
    expect(constructionSites(planted)).toContain("server/sneaky.ts");
    expect(keyReaders(planted)).toContain("server/sneaky.ts");
    const ungated = sources["server/casting/geminiClient.ts"]!.replace("  assertRebuildDoorOpen();\n", "");
    expect(factoryIsGated(ungated)).toBe(false);
  });
});

describe("⚠ CONTROLS — the door is not a blanket, and it can let through", () => {
  it("NEGATIVE CONTROL — a customer's own work stays readable", async () => {
    const user = appRouter.createCaller(context("user"));
    for (const call of [
      () => user.wardrobe.garments.list(),
      () => user.models.list(),
      () => user.generation.clearSession(),
    ]) {
      expect(await outcomeOf(call as () => Promise<unknown>)).not.toBeNull();
    }
  });

  it("⚠ WITH THE DOOR OPEN every listed procedure gets past it, and the backstop lets a client be built", async () => {
    /*
      THE control for a compiled constant: without it this suite would pass
      unchanged if every procedure were broken for everybody. Past the door each
      fails DOWNSTREAM (a missing row, a spy's own PAST_THE_DOOR, the fake
      client) — anything but the door's code. And `getAiClient` must now reach
      the constructor: that is what proves `spy.constructed` can see one.
    */
    vi.resetModules();
    vi.doMock("@shared/rebuildDoor", async (importOriginal) => ({
      ...(await importOriginal<object>()),
      REBUILD_DOOR_OPEN: true,
    }));
    try {
      const { appRouter: openRouter } = await import("./routers");
      const openAsks = asks(openRouter);
      for (const procedure of REBUILD_DOOR_CLOSED_PROCEDURES) {
        expect(await outcomeOf(openAsks[procedure]!), `${procedure} should be past the door`).not.toBeNull();
      }
      clearSpies();
      const { getAiClient } = await import("./casting/geminiClient");
      expect(() => getAiClient()).toThrow("PAST_THE_DOOR");
      expect(spy.constructed).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock("@shared/rebuildDoor");
      vi.resetModules();
    }
  });
});
