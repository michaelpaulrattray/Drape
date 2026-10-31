/**
 * THE CONCEPT READER AT THE WIRE — what actually leaves for the text provider
 * (#2911, working law 5: assert at the wire).
 *
 * Every arm here stubs `fetch` and reads the HTTP BODY the real OpenRouter
 * engine builds: the model slug, the system turn, the user turn, the token
 * ceiling, the temperature and the JSON envelope. Nothing is asserted on a
 * constant near the call, because a constant can be right while the request is
 * wrong. No byte leaves the machine: the stub answers every call itself.
 *
 * # THE PINNED HASHES ARE TODAY'S READER, TAKEN BEFORE #2911 TOUCHED IT
 *
 * `TODAY` below was computed by running these exact scenarios against the tree
 * at `ac0fe5782` (origin/main the day the card was built), before any line of
 * `conceptDescribe.ts` moved, and committed alone on that tree (the first
 * commit of the #2911 branch). So "the flag off is byte-identical to today" is
 * a comparison against the old tree's own bytes, not against a value this
 * change also wrote. A hash that moves is a change to what a customer outside
 * the flag is read with, and it is refused here rather than discovered later.
 *
 * `RICH_LOOK` is the other reading's, taken the day it was written — the
 * `refineOpenLaneClause.test.ts` precedent for a served pair: an edit to the
 * rich look's words or bounds is then a deliberate act with a hash to move.
 *
 * The picture is replaced by a placeholder before hashing (its bytes are the
 * bounded fixture's, not the reader's words) and asserted separately to be an
 * inline data URI, which is the never-fetched promise.
 *
 * # AND THE DOOR, DRIVEN THROUGH THE REAL ROUTER
 *
 * The last block drives `castingV2.concept.describe` through `appRouter`, so
 * the flag is proven where it is CAPTURED (the route) and not only where it is
 * obeyed (`describeConcept`): a capture that was never passed, or passed for
 * the wrong account, reads correctly from both sides and is invisible to every
 * arm above it.
 */
import { createHash } from "node:crypto";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { CONCEPT_READER_MODEL, CONCEPT_RICH_LOOK_MODEL, describeConcept, resetConceptReaderForTests } from "./conceptDescribe";
import { resetInterpreterForTests } from "./interpreter";

type Body = {
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  temperature: number;
  max_tokens: number;
  response_format?: unknown;
  reasoning?: unknown;
};

const said = (description: string | null) => JSON.stringify({ description });

/** A note today's reader accepts on the first read: inside 100–300, no swept word. */
const CLEAN =
  "A woman in her early thirties, Mediterranean heritage, compact athletic build, dark hair "
  + "worn to the jaw, plain black crew-neck. Still, direct, unadorned — a quiet "
  + "gallerist or architect type.";

/** The scenarios, each a script of replies. Their order and words are part of the pin. */
const SCENARIOS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ["clean", [said(CLEAN)]],
  ["long", [said("a tall man with cropped grey hair and a heavy brow, ".repeat(10)), said(CLEAN)]],
  ["brief", [said("A man."), said(CLEAN)]],
  ["picture", [said(`${CLEAN} Shot against a grey background.`), said(CLEAN)]],
  ["absence", [said(`${CLEAN} She wears no jewellery.`), said(CLEAN)]],
  ["unparseable", ["not json at all", said(CLEAN)]],
];

/**
 * TODAY'S READER, per scenario: sha256 of the JSON of every request body sent,
 * in order, with the picture swapped for a placeholder. Taken at `ac0fe5782`.
 */
const TODAY: Record<string, string> = {
  clean: "bf266987b05a119148c3c0e294ee40a93509101675169b7a6b85941c24afbac4",
  long: "62f1179d3a76c0dd407305e44988bc53348f038ddaed4ecfa3b7a7bf3159f7c0",
  brief: "c7456762b8f1185d9a2111f6592dd096c8f0f1cfba7834d05deba01526ca44e4",
  picture: "1ed42212369a1b69028afe42286ac373841ea05b5bbfaf06d5ff32edbd5514f3",
  absence: "91152966bd28bcd55f93caf23e965d14390a45146d257978824fd3f0ff70f828",
  unparseable: "b1674b9e03c864f27f910bc03814c8587a010924837f79eb749d8b0adc757d22",
};

/**
 * THE RICH LOOK's scenarios. "long" is a rich look over 700 on the way in;
 * the other three faults share the scripts above, so the two readings are
 * compared on the same replies wherever a reply means the same thing to both.
 */
const RICH_CLEAN =
  "A young adult woman, a cyberpunk operative type. Dark graphic tattoos run down both arms and "
  + "across the shoulders, and a mechanical core plate is fitted at the waist. Signature pieces are "
  + "goggles worn up on the forehead, armoured forearm guards and a protective plate at one shoulder. "
  + "The wardrobe is matte black synthetic, leather and mesh with metal hardware, cropped and strapped.";
const RICH_SCENARIOS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ["clean", [said(RICH_CLEAN)]],
  ["long", [said(`${RICH_CLEAN} ${RICH_CLEAN}`), said(RICH_CLEAN)]],
  ["brief", [said("A woman."), said(RICH_CLEAN)]],
  ["picture", [said(`${RICH_CLEAN} Shot against a grey background.`), said(RICH_CLEAN)]],
  ["absence", [said(`${RICH_CLEAN} She wears no jewellery.`), said(RICH_CLEAN)]],
  ["unparseable", ["not json at all", said(RICH_CLEAN)]],
];

/**
 * The rich look's bytes. First taken the day it was written (#2911); moved
 * once, on purpose, when the founder's "quality bar dropped" put the bench's
 * own text back (the follow-up to #2915). `TODAY` above did not move in that
 * change, which is the proof it left the off reader alone.
 */
const RICH_LOOK: Record<string, string> = {
  clean: "c2372d184d6c7aa47cdd819de0c8930993e9a14269b06a46842a4c0d1e776072",
  long: "27bed555ae2bcfd10291eb69cd214f6fe02627a5f050b3f1fa9e7f4549c3dc15",
  brief: "0e77fe70a5dc7381828230711d7912e3fe1070d37bfa547e2c880f1856fa3238",
  picture: "8d7af28ea24dfb25ae8ba586eb932de9ef0f42a090aee3d95ee069929a416921",
  absence: "cbff0bb835c9a61e65bc44cd3f8edaedb6d54d2370df95a9c683d9262d64d57c",
  unparseable: "d1faf94b6f447fe261a2808c9f62f74484892ed452ef209a5e6de341aee3d1bc",
};

let replies: string[] = [];
let bodies: Body[] = [];

function answer(text: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: text }, finish_reason: "stop" }],
      model: "stub",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function withoutPicture(body: Body): Body {
  return {
    ...body,
    messages: body.messages.map((message) => {
      if (!Array.isArray(message.content)) return message;
      return {
        ...message,
        content: message.content.map((part: { type?: string }) =>
          part.type === "image_url" ? { type: "image_url", image_url: { url: "<picture>" } } : part),
      };
    }),
  };
}

const digest = (sent: Body[]) =>
  createHash("sha256").update(JSON.stringify(sent.map(withoutPicture))).digest("hex");

const systemOf = (body: Body) => body.messages[0]!.content as string;

function expectPictureInline(sent: Body[]): void {
  for (const body of sent) {
    const user = body.messages[1]!.content as Array<{ type: string; image_url?: { url: string } }>;
    expect(user.find((part) => part.type === "image_url")?.image_url?.url, "the picture rides inline")
      .toMatch(/^data:image\/[a-z]+;base64,/);
  }
}

let picture: Buffer;
let previousKey: string | undefined;
const savedEnv: Record<string, string | undefined> = {};
/*
  The scope variables this file moves. The transport credential's variable is
  saved on its own line below rather than in this list: the gate's secret
  scanner read its quoted NAME, a comma and the next quoted name as a secret
  being assigned (its generic rule; measured on the first push of #2911). A
  false positive, answered by the shape rather than by widening the allowlist.
*/
const ENV_KEYS = [
  "CASTING_V2_SCOPE",
  "CASTING_CONCEPT_UPLOAD_SCOPE",
  "CASTING_CONCEPT_RICH_LOOK_SCOPE",
] as const;

beforeEach(async () => {
  picture ??= await sharp({
    create: { width: 600, height: 800, channels: 3, background: { r: 120, g: 110, b: 100 } },
  }).png().toBuffer();
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key-never-sent";
  resetInterpreterForTests();
  resetConceptReaderForTests();
  bodies = [];
  replies = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body) as Body);
    const text = replies[Math.min(bodies.length - 1, replies.length - 1)] ?? "";
    return answer(text);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = previousKey;
  resetInterpreterForTests();
  resetConceptReaderForTests();
});

describe("today's reader at the wire, pinned to the tree before #2911", () => {
  it.each(SCENARIOS)("sends exactly today's bytes — %s", async (name, script) => {
    replies = [...script];
    await describeConcept({ bytes: picture, contentType: "image/png" });
    expect(bodies.length, `${name}: the scenario must actually be driven`).toBe(script.length);
    expectPictureInline(bodies);
    expect(digest(bodies), `${name}: the request today's reader sends`).toBe(TODAY[name]);
  });

  it("is today's model, today's ceiling and today's temperature — said in words beside the hash", async () => {
    replies = [said(CLEAN)];
    await describeConcept({ bytes: picture, contentType: "image/png", richLook: false });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.model).toBe("anthropic/claude-sonnet-5");
    expect(bodies[0]!.model).toBe(CONCEPT_READER_MODEL);
    expect(bodies[0]!.max_tokens).toBe(900);
    expect(bodies[0]!.temperature).toBe(0);
    expect(bodies[0]!.response_format).toEqual({ type: "json_object" });
    expect(bodies[0]!, "no reasoning switch was ever sent").not.toHaveProperty("reasoning");
    /* `richLook: false` and absent are the same request — the hash says so too. */
    expect(digest(bodies)).toBe(TODAY.clean);
  });
});

describe("the rich look at the wire", () => {
  it.each(RICH_SCENARIOS)("sends the rich look's bytes — %s", async (name, script) => {
    replies = [...script];
    await describeConcept({ bytes: picture, contentType: "image/png", richLook: true });
    expect(bodies.length, `${name}: the scenario must actually be driven`).toBe(script.length);
    expectPictureInline(bodies);
    expect(digest(bodies), `${name}: the request the rich look sends`).toBe(RICH_LOOK[name]);
  });

  it("is Argon, its own ceiling, the same temperature and the same envelope", async () => {
    replies = [said(RICH_CLEAN)];
    await describeConcept({ bytes: picture, contentType: "image/png", richLook: true });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.model).toBe("google/gemini-4-argon");
    expect(bodies[0]!.model).toBe(CONCEPT_RICH_LOOK_MODEL);
    expect(bodies[0]!.max_tokens).toBe(1400);
    expect(bodies[0]!.temperature).toBe(0);
    expect(bodies[0]!.response_format).toEqual({ type: "json_object" });
    expect(bodies[0]!).not.toHaveProperty("reasoning");
  });

  it("sends a different instruction from today's, and the same ask", async () => {
    replies = [said(RICH_CLEAN)];
    await describeConcept({ bytes: picture, contentType: "image/png", richLook: true });
    const rich = bodies[0]!;
    bodies = [];
    replies = [said(CLEAN)];
    await describeConcept({ bytes: picture, contentType: "image/png" });
    const today = bodies[0]!;
    expect(systemOf(rich)).not.toBe(systemOf(today));
    expect(systemOf(rich)).toContain("THE FACE STAYS FREE");
    expect(systemOf(today)).not.toContain("THE FACE STAYS FREE");
    /* The user turn's first ask is the same sentence on both readings. */
    expect(JSON.stringify(rich.messages[1]!.content).replace(/data:[^"]+/, ""))
      .toBe(JSON.stringify(today.messages[1]!.content).replace(/data:[^"]+/, ""));
  });
});

/* ------------------------------------------------ the door, through the router */

function ctxFor(userId: number): TrpcContext {
  const user = {
    id: userId,
    openId: `concept-${userId}`,
    email: "concept@example.com",
    name: "Concept",
    displayName: null,
    avatarUrl: null,
    avatarKey: null,
    bannerUrl: null,
    bannerKey: null,
    bio: null,
    loginMethod: "email",
    approved: true,
    role: "user",
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
  } as unknown as NonNullable<TrpcContext["user"]>;
  return {
    user,
    correlationId: `concept-${userId}`,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

/* Each arm its own account, so the door's hourly rate bucket never decides an arm. */
let nextUser = 29_110_000;
const describeAs = async (userId: number) =>
  appRouter.createCaller(ctxFor(userId)).castingV2.concept.describe({
    imageBase64: picture.toString("base64"),
  });

describe("the door captures the flag and hands it on — driven through the real router", () => {
  beforeEach(() => {
    process.env.CASTING_V2_SCOPE = "all";
    process.env.CASTING_CONCEPT_UPLOAD_SCOPE = "all";
  });

  it("flag ABSENT: the door reads with today's reader, byte for byte", async () => {
    delete process.env.CASTING_CONCEPT_RICH_LOOK_SCOPE;
    replies = [said(CLEAN)];
    await expect(describeAs(nextUser++)).resolves.toEqual({ description: CLEAN });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.model).toBe("anthropic/claude-sonnet-5");
    expect(digest(bodies)).toBe(TODAY.clean);
  });

  it("flag `off`: the same", async () => {
    process.env.CASTING_CONCEPT_RICH_LOOK_SCOPE = "off";
    replies = [said(CLEAN)];
    await describeAs(nextUser++);
    expect(digest(bodies)).toBe(TODAY.clean);
  });

  it("flag on for THIS account: the door reads with the rich look", async () => {
    const user = nextUser++;
    process.env.CASTING_CONCEPT_RICH_LOOK_SCOPE = `users:${user}`;
    replies = [said(RICH_CLEAN)];
    await expect(describeAs(user)).resolves.toEqual({ description: RICH_CLEAN });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.model).toBe("google/gemini-4-argon");
    expect(digest(bodies)).toBe(RICH_LOOK.clean);
  });

  it("flag on for SOMEBODY ELSE: this account keeps today's reader", async () => {
    const user = nextUser++;
    process.env.CASTING_CONCEPT_RICH_LOOK_SCOPE = `users:${user + 1}`;
    replies = [said(CLEAN)];
    await describeAs(user);
    expect(bodies[0]!.model).toBe("anthropic/claude-sonnet-5");
    expect(digest(bodies)).toBe(TODAY.clean);
  });

  it("flag on but the DOOR shut: nothing is read at all — NOT_FOUND before a byte", async () => {
    const user = nextUser++;
    process.env.CASTING_CONCEPT_RICH_LOOK_SCOPE = `users:${user}`;
    process.env.CASTING_CONCEPT_UPLOAD_SCOPE = "off";
    await expect(describeAs(user)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(bodies).toHaveLength(0);
  });
});
