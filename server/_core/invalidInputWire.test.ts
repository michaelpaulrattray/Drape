/**
 * A REJECTED INPUT NEVER PUTS MACHINE TEXT ON A CUSTOMER'S SCREEN.
 *
 * Driven at the wire, not beside the constant: the input schemas are pulled off
 * the REAL procedures (`_def.inputs[0]`, so a schema edit is felt here), the
 * router is built from the REAL `publicProcedure`, which carries the real
 * `errorFormatter`, and the request goes over the REAL express adapter on a
 * loopback port. The assertions are then made on what the REAL client
 * classifiers render, because "the payload is clean" is not the claim — "the
 * customer reads a sentence" is.
 *
 * What this replaces, read at the wire on 2026-08-16 before the fix: a
 * 2,001-character brief was refused correctly and the sheet showed the
 * customer zod's serialized issue array, under the action "Edit the brief".
 * The sessionId arm showed them the session-id validation regex.
 *
 * The negative controls are the half that makes the rest mean anything — a
 * formatter that rewrote every message would pass every assertion above and
 * silence five authored refusals on the way.
 */
import express from "express";
import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

import { castingV2Router } from "../routes/castingV2";
import { modelCreateInputSchema } from "../routes/modelCreateInput";
import { waitlistRouter } from "../routes/waitlist";
import { router, publicProcedure } from "./trpc";
import { spokenError } from "./spokenError";
import { INVALID_INPUT_FALLBACK, invalidInputMessage } from "./invalidInputMessage";
import { APP_UPDATE_REQUIRED_MESSAGE } from "@shared/clientRequestId";
import { classifyDispatchFailure } from "../../client/src/features/castingV2/dispatchFailure";
import { readableFailure } from "../../client/src/features/castingV2/failureCopy";

/** The production schema itself, off the production procedure. */
function realInputSchema(procedureName: string) {
  const procedures = (castingV2Router as unknown as {
    _def: { procedures: Record<string, { _def: { inputs: unknown[] } }> };
  })._def.procedures;
  const procedure = procedures[procedureName];
  if (!procedure) throw new Error(`no procedure "${procedureName}" on castingV2Router`);
  const inputs = procedure._def.inputs;
  if (inputs.length !== 1) throw new Error(`expected one input schema, got ${inputs.length}`);
  return inputs[0] as never;
}

/** `waitlist.join`'s email field carries a sentence its author wrote. */
function realWaitlistSchema() {
  const procedures = (waitlistRouter as unknown as {
    _def: { procedures: Record<string, { _def: { inputs: unknown[] } }> };
  })._def.procedures;
  return procedures.join._def.inputs[0] as never;
}

const AUTHORED_REFUSAL =
  "I can't find any glasses on this face — there's nothing to take off. Nothing was charged.";

const probeRouter = router({
  createRoll: publicProcedure.input(realInputSchema("createRoll")).mutation(() => ({ ok: true })),
  waitlistJoin: publicProcedure.input(realWaitlistSchema()).mutation(() => ({ ok: true })),
  modelCreate: publicProcedure.input(modelCreateInputSchema).mutation(() => ({ ok: true })),
  authored: publicProcedure.input(z.object({}).strict()).mutation(() => {
    throw spokenError({ code: "BAD_REQUEST", message: AUTHORED_REFUSAL });
  }),
  crashed: publicProcedure.input(z.object({}).strict()).mutation(() => {
    throw new Error("read ECONNRESET");
  }),
});

/** What the tRPC client ends up holding: `message` and `data` off the shape. */
type ClientError = { message?: string; data?: Record<string, unknown> };

async function callOverTheWire(path: string, input: unknown): Promise<ClientError> {
  const app = express();
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: probeRouter, createContext: () => ({}) as never }),
  );
  const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
  try {
    const response = await fetch(`${baseUrlOf(server)}/api/trpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // superjson transformer: the input rides under `json`
      body: JSON.stringify({ json: input }),
    });
    const body = (await response.text());
    const parsed = JSON.parse(body) as { error?: { json?: ClientError } };
    if (!parsed.error?.json) throw new Error(`expected an error payload, got: ${body}`);
    return parsed.error.json;
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

/**
 * The shapes that betray a message written for an engineer.
 *
 * Asserted token by token rather than as one regex: a single alternation that
 * matched would not say WHICH leak, and these have different causes — the
 * bracket is the serialized array, `"path"` is the issue's field pointer,
 * `expected` is zod's own prose, and the character class is a validation
 * pattern printed at a person.
 */
function expectNoMachineText(sentence: string) {
  expect(sentence, "the serialized issue array").not.toContain("[\n");
  expect(sentence, "the issue's field pointer").not.toContain('"path"');
  expect(sentence, "zod's own prose").not.toContain("expected string");
  expect(sentence, "a validation regex, printed at a person").not.toContain("[0-9a-fA-F]");
  expect(sentence, "an internal field name").not.toContain("briefText");
}

const VALID_SESSION_ID = "22222222-2222-4222-8222-222222222222";
const VALID_REQUEST_ID = "11111111-1111-4111-8111-111111111111";

describe("a rejected input speaks to a person", () => {
  it("names the limit when the brief is too long, and leaks nothing", async () => {
    const error = await callOverTheWire("createRoll", {
      clientRequestId: VALID_REQUEST_ID,
      sessionId: VALID_SESSION_ID,
      /*
        The ENTRANCE admits 4,000 since #131 slice D (an authored prompt may
        come back as the next brief); the 2,000 bound for a house-composed
        roll is the SERVICE's and is driven in `rollService.test.ts`.
      */
      briefText: "a".repeat(4001),
    });

    expect(error.data?.code).toBe("BAD_REQUEST");
    expect(error.message).toBe(
      "That's longer than we can take — please keep it to 4,000 characters or fewer.",
    );
    expectNoMachineText(error.message ?? "");

    // What the two surfaces actually render.
    const dispatch = classifyDispatchFailure(error);
    expect(dispatch.kind, "still a refusal, so the action stays 'Edit the brief'").toBe("refused");
    expectNoMachineText(dispatch.message);
    expectNoMachineText(readableFailure(error, "unused fallback"));
  });

  it("never prints the session-id regex", async () => {
    const error = await callOverTheWire("createRoll", {
      clientRequestId: VALID_REQUEST_ID,
      sessionId: "not-a-session-id",
      briefText: "a fitness creator in their 30s",
    });

    expect(error.message).toBe(INVALID_INPUT_FALLBACK);
    expectNoMachineText(error.message ?? "");
    expectNoMachineText(classifyDispatchFailure(error).message);
  });

  it("says so plainly when the brief is empty", async () => {
    const error = await callOverTheWire("createRoll", {
      clientRequestId: VALID_REQUEST_ID,
      sessionId: VALID_SESSION_ID,
      briefText: "",
    });

    expect(error.message).toBe("That came through empty — please write something first.");
    expectNoMachineText(error.message ?? "");
  });

  it("does not leak the rejected key name when a schema is .strict()", async () => {
    const error = await callOverTheWire("createRoll", {
      clientRequestId: VALID_REQUEST_ID,
      sessionId: VALID_SESSION_ID,
      briefText: "a fitness creator in their 30s",
      smuggledField: "anything",
    });

    expect(error.message).toBe(INVALID_INPUT_FALLBACK);
    expect(error.message).not.toContain("smuggledField");
  });
});

describe("negative controls — the rewrite is narrow", () => {
  it("leaves an authored refusal untouched, and it still arrives spoken", async () => {
    const error = await callOverTheWire("authored", {});

    expect(error.message, "our own sentence, word for word").toBe(AUTHORED_REFUSAL);
    expect(error.data?.spoken, "the marker survives the rewrite branch").toBe(true);
    expect(readableFailure(error, "fallback")).toBe(AUTHORED_REFUSAL);
  });

  it("keeps a sentence the schema's author wrote, and lifts it out of the array", async () => {
    /*
      A production regression this file caught: the first cut replaced EVERY
      zod message, so `waitlist.join`'s own "Please enter a valid email
      address" came back off the live wire as the generic fallback.
    */
    const error = await callOverTheWire("waitlistJoin", { email: "not-an-email" });

    expect(error.message).toBe("Please enter a valid email address");
    expect(error.message, "ours must not speak over the author's").not.toBe(INVALID_INPUT_FALLBACK);
    // Still lifted out of the serialized array — that was always the leak.
    expectNoMachineText(error.message ?? "");
  });

  it("still lets the app-update sentinel win over the generic sentence", async () => {
    // The real models.create schema, with clientRequestId omitted — the exact
    // shape a stale tab sends after a deploy.
    const error = await callOverTheWire("modelCreate", { preferences: {} });

    expect(error.message).toBe(APP_UPDATE_REQUIRED_MESSAGE);
    expect(error.message, "the generic must not speak over it").not.toBe(INVALID_INPUT_FALLBACK);
  });

  it("does not rewrite a message that is not an input failure", async () => {
    const error = await callOverTheWire("crashed", {});

    // Untouched — the client is what replaces a crash's text with our own, and
    // it can only do that if the formatter has not disguised it as a refusal.
    expect(error.message).toBe("read ECONNRESET");
    expect(error.data?.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.data?.spoken).toBeUndefined();
  });
});

describe("invalidInputMessage discriminates", () => {
  it("returns null for anything that is not a zod failure", () => {
    // Without this the formatter would rewrite every error in the product.
    expect(invalidInputMessage(new Error("read ECONNRESET"))).toBeNull();
    expect(invalidInputMessage(undefined)).toBeNull();
    expect(invalidInputMessage({ issues: [{ code: "too_big" }] })).toBeNull();
  });

  it("falls back rather than inventing a sentence for an issue it cannot speak", () => {
    const failure = z.object({ n: z.number() }).safeParse({ n: "seven" });
    expect(failure.success).toBe(false);
    expect(invalidInputMessage(failure.error)).toBe(INVALID_INPUT_FALLBACK);
  });

  /**
   * The author-detection is a comparison against what zod would have said, and
   * these are the kinds it has to get right. Driven directly, because the wire
   * tests above only exercise the three that reach a customer today — a new
   * schema using an enum or a refinement gets the same treatment tomorrow.
   */
  it("keeps every authored message and replaces every default one", () => {
    const authored = [
      z.string().refine(() => false, "That name is already taken").safeParse("x"),
      z.object({ e: z.email("Please enter a valid email address") }).safeParse({ e: "x" }),
    ];
    for (const failure of authored) {
      expect(failure.success).toBe(false);
      if (failure.success) continue;
      expect(invalidInputMessage(failure.error)).toBe(failure.error.issues[0]?.message);
    }

    const zodsOwn = [
      z.object({ s: z.enum(["a", "b"]) }).safeParse({ s: "c" }),
      z.object({ s: z.literal("a") }).safeParse({ s: "b" }),
      z.object({ s: z.union([z.number(), z.boolean()]) }).safeParse({ s: "x" }),
      z.string().refine(() => false).safeParse("x"),
      // The regex leak in its other form: zod's default prints the pattern.
      z.object({ s: z.string().regex(/^a+$/) }).safeParse({ s: "b" }),
      // A bare type mismatch: uncomparable, so it must fall back, not pass through.
      z.object({ n: z.number() }).safeParse({ n: "seven" }),
    ];
    for (const failure of zodsOwn) {
      expect(failure.success).toBe(false);
      if (failure.success) continue;
      const spoken = invalidInputMessage(failure.error);
      expect(spoken).toBe(INVALID_INPUT_FALLBACK);
      expect(spoken).not.toContain("/^a+$/");
    }
  });
});
