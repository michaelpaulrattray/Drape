/**
 * A SIGN WHOSE REPLY WAS LOST NEVER SAYS "NOTHING HAS CHANGED" — #2381.
 *
 * The Sign dialog's `onError` fell back to *"Signing didn't go through.
 * Nothing has changed — try again."* for every error the server did not speak.
 * A gateway 502 or a dropped connection can arrive AFTER the server charged the
 * Sign and made the cast, so the client never knew "nothing has changed".
 *
 * Driven at the wire, the way #2033's suite is: a real tRPC server built from
 * the product's own `router`/`publicProcedure` (the real error formatter and
 * its `spoken` marker), a real `httpBatchLink` with the app's transformer, a
 * real gateway-shaped 502 and a real closed port — and the page's own
 * `signFailureOutcome` reading what arrives. The re-read goes over the same
 * wire, through a probe `getRoll` that answers with the projection's fields.
 */
import express from "express";
import type { Server } from "node:http";
import { TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { baseUrlOf, listenOnFetchablePort } from "../../../server/testing/fetchablePort";

const { router, publicProcedure } = await import("../../../server/_core/trpc");
const { spokenError } = await import("../../../server/_core/spokenError");
const {
  signFailureOutcome,
  SIGN_UNCONFIRMED_SENTENCE,
  SIGN_RECHECK_ATTEMPTS,
} = await import("./CastingSheet");

/* signService.ts's own free refusal, word for word. */
const NOT_SIGNABLE =
  "That candidate can't be signed — it may have been discarded, expired, or already signed.";
const NOT_ENOUGH = "Not enough credits. Signing a Cast costs 450 credits.";

/** What the probe roll answers, per read — set by each arm. */
let rollReads: Array<"signed" | "ready" | "throw"> = [];
let rollReadCount = 0;

const probeRouter = router({
  refused: publicProcedure.mutation(() => {
    throw new TRPCError({ code: "NOT_FOUND", message: NOT_SIGNABLE });
  }),
  poor: publicProcedure.mutation(() => {
    throw spokenError({ code: "BAD_REQUEST", message: NOT_ENOUGH });
  }),
  crash: publicProcedure.mutation(() => {
    throw new Error("Cannot read properties of undefined (reading 'agencyId')");
  }),
  getRoll: publicProcedure.input(z.object({ rollId: z.string() }).strict()).query(() => {
    const shape = rollReads[Math.min(rollReadCount, rollReads.length - 1)] ?? "ready";
    rollReadCount += 1;
    if (shape === "throw") throw new Error("read failed");
    return {
      candidates: [
        { candidateId: "cand_other", status: "signed", castId: "cast_not_this_one" },
        {
          candidateId: "cand_2381",
          status: shape,
          castId: shape === "signed" ? "cast_2381" : null,
        },
      ],
    };
  }),
});
type ProbeRouter = typeof probeRouter;

let server: Server;
let gateway: Server;

beforeAll(async () => {
  const app = express();
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: probeRouter,
      createContext: ({ req, res }) => ({ req, res, user: null }),
    }),
  );
  server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
  /* A gateway that lost the upstream: an HTML 502, nothing tRPC can read. */
  const edge = express();
  edge.use((_req, res) => {
    res.status(502).type("html").send("<html><body>502 Bad Gateway</body></html>");
  });
  gateway = await listenOnFetchablePort((port) => edge.listen(port, "127.0.0.1"));
});

afterAll(async () => {
  for (const each of [server, gateway]) {
    await new Promise<void>((resolve, reject) =>
      each.close((error) => (error ? reject(error) : resolve())),
    );
  }
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

const live = () => clientAt(`${baseUrlOf(server)}/api/trpc`);
const reread = async () => (await live().getRoll.query({ rollId: "roll_2381" })).candidates;
const noWait = { waitMs: 0, sleep: async () => {} };

async function lostReply(): Promise<unknown> {
  return caught(() => clientAt(`${baseUrlOf(gateway)}/api/trpc`).refused.mutate());
}

/** What the old fallback claimed, and money words it must not claim either. */
const UNKNOWN_CLAIM = /nothing has changed|credit|refund|returned|charged/i;

describe("a failed Sign (#2381)", () => {
  it("the unconfirmed sentence claims no outcome (negative control on the copy)", () => {
    expect(SIGN_UNCONFIRMED_SENTENCE).not.toMatch(UNKNOWN_CLAIM);
    // The instrument can fail: the sentence this card removed trips it.
    expect("Signing didn't go through. Nothing has changed — try again.").toMatch(UNKNOWN_CLAIM);
  });

  it("a gateway 502 on a Sign that DID land takes the customer to the cast", async () => {
    const error = await lostReply();
    // The transport shape: no tRPC code reached the client.
    expect((error as { data?: { code?: string } }).data?.code).toBeUndefined();
    rollReads = ["signed"];
    rollReadCount = 0;
    const outcome = await signFailureOutcome(error, { candidateId: "cand_2381", readCandidates: reread, ...noWait });
    expect(outcome).toEqual({ kind: "landed", castPublicId: "cast_2381" });
    expect(rollReadCount).toBe(1);
  });

  it("a dropped connection on a Sign the server never shows says only that it couldn't confirm", async () => {
    const dead = express();
    const closed = await listenOnFetchablePort((port) => dead.listen(port, "127.0.0.1"));
    const url = `${baseUrlOf(closed)}/api/trpc`;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    const error = await caught(() => clientAt(url).refused.mutate());
    rollReads = ["ready"];
    rollReadCount = 0;
    const outcome = await signFailureOutcome(error, { candidateId: "cand_2381", readCandidates: reread, ...noWait });
    expect(outcome).toEqual({ kind: "unconfirmed", sentence: SIGN_UNCONFIRMED_SENTENCE });
    // Asked the server every time before giving the honest no.
    expect(rollReadCount).toBe(SIGN_RECHECK_ATTEMPTS);
  });

  it("a Sign that lands while the page is still asking is found on a later read", async () => {
    const error = await lostReply();
    rollReads = ["throw", "ready", "signed"];
    rollReadCount = 0;
    const waits: number[] = [];
    const outcome = await signFailureOutcome(error, {
      candidateId: "cand_2381",
      readCandidates: reread,
      waitMs: 1234,
      sleep: async (ms) => { waits.push(ms); },
    });
    expect(outcome).toEqual({ kind: "landed", castPublicId: "cast_2381" });
    expect(waits).toEqual([1234, 1234]);
  });

  it("another signed candidate on the roll is not mistaken for this one", async () => {
    const error = await lostReply();
    rollReads = ["ready"];
    rollReadCount = 0;
    const outcome = await signFailureOutcome(error, { candidateId: "cand_2381", readCandidates: reread, ...noWait });
    expect(outcome.kind).toBe("unconfirmed");
  });

  it("with no roll to re-read, and on an unhandled crash, it still claims nothing", async () => {
    expect(
      await signFailureOutcome(await lostReply(), { candidateId: "cand_2381", readCandidates: null, ...noWait }),
    ).toEqual({ kind: "unconfirmed", sentence: SIGN_UNCONFIRMED_SENTENCE });
    rollReads = ["ready"];
    rollReadCount = 0;
    const crash = await caught(() => live().crash.mutate());
    const outcome = await signFailureOutcome(crash, { candidateId: "cand_2381", readCandidates: reread, ...noWait });
    expect(outcome).toEqual({ kind: "unconfirmed", sentence: SIGN_UNCONFIRMED_SENTENCE });
  });

  it("the server's own refusals pass through verbatim and are never re-read (positive control)", async () => {
    rollReads = ["signed"];
    rollReadCount = 0;
    const refused = await caught(() => live().refused.mutate());
    expect(await signFailureOutcome(refused, { candidateId: "cand_2381", readCandidates: reread, ...noWait }))
      .toEqual({ kind: "spoken", sentence: NOT_SIGNABLE });
    const poor = await caught(() => live().poor.mutate());
    expect(await signFailureOutcome(poor, { candidateId: "cand_2381", readCandidates: reread, ...noWait }))
      .toEqual({ kind: "spoken", sentence: NOT_ENOUGH });
    expect(rollReadCount).toBe(0);
  });
});
