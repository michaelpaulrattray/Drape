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
 * `conceptDescribe.ts` moved. So "the flag off is byte-identical to today" is a
 * comparison against the old tree's own bytes, not against a value this change
 * also wrote. A hash that moves is a change to what a customer outside the flag
 * is read with, and it is refused here rather than discovered on a bill.
 *
 * The picture is replaced by a placeholder before hashing (its bytes are the
 * bounded fixture's, not the reader's words) and asserted separately to be an
 * inline data URI, which is the never-fetched promise.
 */
import { createHash } from "node:crypto";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeConcept, resetConceptReaderForTests } from "./conceptDescribe";
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

let picture: Buffer;
let previousKey: string | undefined;

beforeEach(async () => {
  picture ??= await sharp({
    create: { width: 600, height: 800, channels: 3, background: { r: 120, g: 110, b: 100 } },
  }).png().toBuffer();
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
    for (const body of bodies) {
      const user = body.messages[1]!.content as Array<{ type: string; image_url?: { url: string } }>;
      expect(user.find((part) => part.type === "image_url")?.image_url?.url, "the picture rides inline")
        .toMatch(/^data:image\/[a-z]+;base64,/);
    }
    expect(digest(bodies), `${name}: the request today's reader sends`).toBe(TODAY[name]);
  });
});
