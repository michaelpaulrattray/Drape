/**
 * A TATTOO STEP NEVER CLAIMS WHAT IT COULD NOT READ — #2048.
 *
 * `useInkAddWorkflow`'s six `.catch` blocks (plan, generate — the paid
 * preview — projection, accept, retry, cancel) shared one reader that showed
 * any `error.message` raw and otherwise said *"Tattoo previews are temporarily
 * unavailable. Nothing was charged."* The surface is unreachable while
 * `R7_EVIDENCE_COMPOSER_SCOPE` is off, and this fixes only its copy.
 *
 * Driven at the wire, the same way as the fork dialog's suite: a real tRPC
 * server from the product's own `router`, a real plain-text 502 gateway, a
 * real closed port, read by the hook's own `inkStepFailureSentence`.
 */
import express from "express";
import type { Server } from "node:http";
import { TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { baseUrlOf, listenOnFetchablePort } from "../../../../../server/testing/fetchablePort";

const { router, publicProcedure } = await import("../../../../../server/_core/trpc");
const { inkStepFailureSentence, INK_STEP_UNCONFIRMED_SENTENCE, ReferenceReadError } =
  await import("./useInkAddWorkflow");

/* `requireInkCapability`'s refusal in server/routes/evidence.ts, verbatim. */
const NOT_AVAILABLE = "Tattoo previews are not available for this account.";

const probeRouter = router({
  gated: publicProcedure.mutation(() => {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: NOT_AVAILABLE });
  }),
  crash: publicProcedure.mutation(() => {
    throw new Error("Cannot read properties of undefined (reading 'intentId')");
  }),
});
type ProbeRouter = typeof probeRouter;

let server: Server;

beforeAll(async () => {
  const app = express();
  app.use("/gateway/api/trpc", (_req, res) => {
    res.status(502).type("text/plain").send("upstream error");
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: probeRouter,
      createContext: ({ req, res }) => ({ req, res, user: null }),
    }),
  );
  server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

function clientAt(url: string) {
  return createTRPCClient<ProbeRouter>({
    links: [httpBatchLink({ url, transformer: superjson })],
  });
}

async function caught(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to fail");
}

const MONEY = /credit|refund|returned|charged|nothing was/i;

describe("a tattoo step's failure line (#2048)", () => {
  it("the fallback itself asserts nothing about money (negative control on the copy)", () => {
    expect(INK_STEP_UNCONFIRMED_SENTENCE).not.toMatch(MONEY);
    expect("Tattoo previews are temporarily unavailable. Nothing was charged.").toMatch(MONEY);
  });

  it("a gateway's plain-text 502 never reaches the screen", async () => {
    const error = await caught(() => clientAt(`${baseUrlOf(server)}/gateway/api/trpc`).crash.mutate());
    expect((error as Error).message).not.toBe("");
    expect(inkStepFailureSentence(error)).toBe(INK_STEP_UNCONFIRMED_SENTENCE);
  });

  it("a dropped connection and an unhandled crash fall to the neutral line", async () => {
    const dead = express();
    const closed = await listenOnFetchablePort((port) => dead.listen(port, "127.0.0.1"));
    const url = `${baseUrlOf(closed)}/api/trpc`;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    expect(inkStepFailureSentence(await caught(() => clientAt(url).crash.mutate()))).toBe(
      INK_STEP_UNCONFIRMED_SENTENCE,
    );
    const crash = await caught(() => clientAt(`${baseUrlOf(server)}/api/trpc`).crash.mutate());
    expect(inkStepFailureSentence(crash)).toBe(INK_STEP_UNCONFIRMED_SENTENCE);
  });

  it("the server's own refusal reaches her verbatim (positive control)", async () => {
    const error = await caught(() => clientAt(`${baseUrlOf(server)}/api/trpc`).gated.mutate());
    expect(inkStepFailureSentence(error)).toBe(NOT_AVAILABLE);
  });

  it("the hook's own sentence — a picture the browser could not read — still shows", () => {
    expect(inkStepFailureSentence(new ReferenceReadError())).toBe(
      "The reference image could not be read.",
    );
    // …and a plain Error carrying the same words is NOT trusted by spelling.
    expect(inkStepFailureSentence(new Error("The reference image could not be read."))).toBe(
      INK_STEP_UNCONFIRMED_SENTENCE,
    );
  });
});
