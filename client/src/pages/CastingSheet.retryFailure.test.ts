/**
 * A FAILED "TRY AGAIN" NEVER CLAIMS A REFUND THE CLIENT DID NOT HEAR — #2033.
 *
 * The Retry button's `.catch` fell back to *"That tile didn't arrive again.
 * Your credits were returned."* for every error the server did not speak. That
 * covered a refusal before any charge (nothing to return), a dropped connection
 * (a refund nobody confirmed), and the retry's two settlement throws, which
 * ride `INTERNAL_SERVER_ERROR` unmarked.
 *
 * Driven at the wire: a real tRPC server built from the product's own
 * `router`/`publicProcedure` (so the real error formatter and its `spoken`
 * marker are on the response), a real `httpBatchLink` with the app's
 * transformer, and the page's own `retryFailureSentence` reading what arrives.
 * The errors thrown are the retry service's own sentences where they are
 * exported, and its own shapes where they are not.
 */
import express from "express";
import type { Server } from "node:http";
import { TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { creditsReturnedText } from "@shared/refundCopy";
import { baseUrlOf, listenOnFetchablePort } from "../../../server/testing/fetchablePort";

const { router, publicProcedure } = await import("../../../server/_core/trpc");
const { spokenError } = await import("../../../server/_core/spokenError");
const { RETRY_NOT_AVAILABLE_MESSAGE } = await import("../../../server/castingV2/retryService");
const { retryFailureSentence, RETRY_UNCONFIRMED_SENTENCE } = await import("./CastingSheet");

const SECOND_FAILURE = `That tile didn't arrive again. ${creditsReturnedText(200)}`;
const STILL_SETTLING = "That retry is still being settled. Operation op_2033.";

const probeRouter = router({
  /* retryService's flag door: NOT_FOUND, thrown before anything is claimed. */
  gated: publicProcedure.mutation(() => {
    throw new TRPCError({ code: "NOT_FOUND", message: RETRY_NOT_AVAILABLE_MESSAGE });
  }),
  /* The one road a refund really happened on: the tile failed a second time. */
  secondFailure: publicProcedure.mutation(() => {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: SECOND_FAILURE });
  }),
  /* The settlement throw: authored, but on INTERNAL_SERVER_ERROR and unmarked. */
  settling: publicProcedure.mutation(() => {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: STILL_SETTLING });
  }),
  /* The same sentence marked spoken — the server's repair path, if it lands. */
  settlingSpoken: publicProcedure.mutation(() => {
    throw spokenError({ code: "INTERNAL_SERVER_ERROR", message: STILL_SETTLING });
  }),
  /* An unhandled crash: the bucket the client must never read aloud. */
  crash: publicProcedure.mutation(() => {
    throw new Error("Cannot read properties of undefined (reading 'publicId')");
  }),
});
type ProbeRouter = typeof probeRouter;

let server: Server;

beforeAll(async () => {
  const app = express();
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: probeRouter,
      // A signed-out context: these probes need no account, and without a
      // context the product's own middleware throws first and EVERY arm reads
      // as an unhandled crash — the positive controls below are what caught it.
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

/** Money words the fallback must never carry — it does not know the money. */
const MONEY = /credit|refund|returned|charged|back on their own/i;

describe("the Retry button's failure toast (#2033)", () => {
  it("the fallback itself asserts nothing about money (negative control on the copy)", () => {
    expect(RETRY_UNCONFIRMED_SENTENCE).not.toMatch(MONEY);
    // The instrument can fail: the sentence this card removed trips it.
    expect("That tile didn't arrive again. Your credits were returned.").toMatch(MONEY);
  });

  it("a flag-first refusal, made before any charge, does not claim a refund", async () => {
    const error = await caught(() => clientAt(`${baseUrlOf(server)}/api/trpc`).gated.mutate());
    // The refusal arrived as the server's own NOT_FOUND, not as a crash.
    expect((error as { data?: { code?: string } }).data?.code).toBe("NOT_FOUND");
    const sentence = retryFailureSentence(error);
    expect(sentence).toBe(RETRY_UNCONFIRMED_SENTENCE);
    expect(sentence).not.toMatch(MONEY);
  });

  it("a dropped connection — the outcome never arrived — does not claim a refund", async () => {
    // Nothing listens on a closed server's port: a real transport failure.
    const dead = express();
    const closed = await listenOnFetchablePort((port) => dead.listen(port, "127.0.0.1"));
    const url = `${baseUrlOf(closed)}/api/trpc`;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    const error = await caught(() => clientAt(url).gated.mutate());
    expect(retryFailureSentence(error)).toBe(RETRY_UNCONFIRMED_SENTENCE);
  });

  it("an unmarked settlement throw and an unhandled crash fall to the neutral line", async () => {
    const client = clientAt(`${baseUrlOf(server)}/api/trpc`);
    expect(retryFailureSentence(await caught(() => client.settling.mutate()))).toBe(RETRY_UNCONFIRMED_SENTENCE);
    expect(retryFailureSentence(await caught(() => client.crash.mutate()))).toBe(RETRY_UNCONFIRMED_SENTENCE);
  });

  it("the server's own second-failure sentence, with its real refund, reaches her verbatim (positive control)", async () => {
    const error = await caught(() => clientAt(`${baseUrlOf(server)}/api/trpc`).secondFailure.mutate());
    expect(retryFailureSentence(error)).toBe(SECOND_FAILURE);
    expect(SECOND_FAILURE).toMatch(MONEY);
  });

  it("a settlement sentence the server marks spoken passes through too", async () => {
    const error = await caught(() => clientAt(`${baseUrlOf(server)}/api/trpc`).settlingSpoken.mutate());
    expect(retryFailureSentence(error)).toBe(STILL_SETTLING);
  });
});
