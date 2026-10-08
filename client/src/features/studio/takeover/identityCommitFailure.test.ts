/**
 * THE FORK DIALOG NEVER CLAIMS WHAT IT COULD NOT READ — #2048.
 *
 * The identity dialog's `.catch` (CastingTakeover, reached from the canvas's
 * cast node: Edit, then Save changes on a minted Cast) used to put any
 * `err.message` on screen and, when there was none, say *"The fork was refused
 * — nothing was charged."* Both halves claimed more than the client knew.
 *
 * Driven at the wire: a real tRPC server built from the product's own
 * `router`/`publicProcedure` (real error formatter, real `spoken` marker), a
 * real `httpBatchLink` with the app's transformer, a real gateway answering a
 * plain-text 502, and a real closed port — read by the dialog's own
 * `identityCommitFailureSentence`. The refusals thrown are the server's own
 * (`canvasCastClosed()`, the fork's headshot refusal) wherever they are
 * reachable from here.
 */
import express from "express";
import type { Server } from "node:http";
import { TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CANVAS_CAST_CLOSED } from "@shared/canvasCastDoor";
import { baseUrlOf, listenOnFetchablePort } from "../../../../../server/testing/fetchablePort";

const { router, publicProcedure } = await import("../../../../../server/_core/trpc");
const { canvasCastClosed } = await import("../../../../../server/lib/canvasCastDoor");
const { identityCommitFailureSentence, IDENTITY_COMMIT_UNCONFIRMED_SENTENCE } =
  await import("./CastingTakeover");

const HEADSHOT_REFUSAL = "Generate a headshot before forking this Cast.";
const PARSER_LEAK = "Cannot read properties of undefined (reading 'publicId')";

const probeRouter = router({
  /* The canvas casting door: the server's own sentence, before any hold. */
  doorClosed: publicProcedure.mutation(() => {
    throw canvasCastClosed();
  }),
  /* applyModelEdit.execute's fork refusal, verbatim. */
  headless: publicProcedure.mutation(() => {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: HEADSHOT_REFUSAL });
  }),
  /* An unhandled crash: engineer's text the customer must never read. */
  crash: publicProcedure.mutation(() => {
    throw new Error(PARSER_LEAK);
  }),
});
type ProbeRouter = typeof probeRouter;

let server: Server;

beforeAll(async () => {
  const app = express();
  /* A gateway in front of the app that answers in plain text — the run-9 shape. */
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

/** Money words the fallback must never carry — it does not know the money. */
const MONEY = /credit|refund|returned|charged|nothing was/i;

describe("the fork dialog's failure line (#2048)", () => {
  it("the fallback itself asserts nothing about money (negative control on the copy)", () => {
    expect(IDENTITY_COMMIT_UNCONFIRMED_SENTENCE).not.toMatch(MONEY);
    // The instrument can fail: the sentence this card removed trips it.
    expect("The fork was refused — nothing was charged.").toMatch(MONEY);
  });

  it("a gateway's plain-text 502 never reaches the screen, and claims no money", async () => {
    const error = await caught(() => clientAt(`${baseUrlOf(server)}/gateway/api/trpc`).crash.mutate());
    // The raw message really is engineer's text — the arm can see the leak.
    expect((error as Error).message).not.toBe("");
    expect((error as Error).message).not.toBe(IDENTITY_COMMIT_UNCONFIRMED_SENTENCE);
    expect(identityCommitFailureSentence(error)).toBe(IDENTITY_COMMIT_UNCONFIRMED_SENTENCE);
  });

  it("a dropped connection — the outcome never arrived — falls to the neutral line", async () => {
    const dead = express();
    const closed = await listenOnFetchablePort((port) => dead.listen(port, "127.0.0.1"));
    const url = `${baseUrlOf(closed)}/api/trpc`;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    const error = await caught(() => clientAt(url).crash.mutate());
    expect(identityCommitFailureSentence(error)).toBe(IDENTITY_COMMIT_UNCONFIRMED_SENTENCE);
  });

  it("an unhandled server crash does not put its text on screen", async () => {
    const error = await caught(() => clientAt(`${baseUrlOf(server)}/api/trpc`).crash.mutate());
    const sentence = identityCommitFailureSentence(error);
    expect(sentence).toBe(IDENTITY_COMMIT_UNCONFIRMED_SENTENCE);
    expect(sentence).not.toContain("publicId");
  });

  it("the server's own refusals reach her verbatim (positive controls)", async () => {
    const client = clientAt(`${baseUrlOf(server)}/api/trpc`);
    expect(identityCommitFailureSentence(await caught(() => client.doorClosed.mutate()))).toBe(
      CANVAS_CAST_CLOSED,
    );
    expect(identityCommitFailureSentence(await caught(() => client.headless.mutate()))).toBe(
      HEADSHOT_REFUSAL,
    );
  });
});
