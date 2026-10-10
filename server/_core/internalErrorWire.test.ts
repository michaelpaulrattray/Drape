/**
 * A FAILED QUERY NEVER REACHES THE BROWSER AS SQL (#2222).
 *
 * Driven at the wire: the router is built from the REAL `router` and
 * `publicProcedure` exported by `./trpc`, so the REAL `errorFormatter` shapes
 * every response, and each call goes over the REAL express adapter on a
 * loopback port. The failure is a REAL `DrizzleQueryError` from a real drizzle
 * UPDATE (`../testing/failedWrite`), carrying a sentinel that stands in for the
 * customer's sentence.
 *
 * The negative control comes first: the same throw through a bare tRPC
 * instance (no formatter) puts the SQL and the sentinel in the response body —
 * so a green arm below cannot be a fixture that never carried them. The
 * positive controls are the other half: an authored sentence, marked or not,
 * must survive untouched, or the fix would have silenced money language.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import superjson from "superjson";
import { describe, expect, it } from "vitest";

import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";
import { failedWrite, SENTINEL } from "../testing/failedWrite";
import { spokenError } from "./spokenError";
import { INTERNAL_FAILURE_SENTENCE, publicProcedure, router } from "./trpc";

const AUTHORED_UNMARKED = "Couldn't start the edit — you weren't charged. Try again.";
const AUTHORED_SPOKEN = "That one didn't run. Nothing was charged.";

const throwRaw = async () => {
  throw await failedWrite();
};

const probeRouter = router({
  /* An unknown throw: tRPC wraps it as INTERNAL with the cause's message. */
  rawWrite: publicProcedure.query(throwRaw),
  /* A plain crash that is not a query at all — machinery all the same. */
  crash: publicProcedure.query(() => {
    throw new TypeError("Cannot read properties of undefined (reading 'persona')");
  }),
  /* A route that copied a helper's `result.error` into its own throw. */
  copiedInternal: publicProcedure.query(async () => {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (await failedWrite()).message });
  }),
  copiedBadRequest: publicProcedure.query(async () => {
    throw new TRPCError({ code: "BAD_REQUEST", message: (await failedWrite()).message });
  }),
  /* POSITIVE CONTROLS: authored sentences, with a failed write as their cause. */
  authoredUnmarked: publicProcedure.query(async () => {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: AUTHORED_UNMARKED, cause: await failedWrite() });
  }),
  authoredSpoken: publicProcedure.query(async () => {
    throw spokenError({ code: "INTERNAL_SERVER_ERROR", message: AUTHORED_SPOKEN, cause: await failedWrite() });
  }),
  /* A spoken sentence whose cause carries the same words — the shape of a
     wrap, so only the marker tells them apart. */
  spokenEcho: publicProcedure.query(() => {
    throw spokenError({ code: "INTERNAL_SERVER_ERROR", message: AUTHORED_SPOKEN, cause: new Error(AUTHORED_SPOKEN) });
  }),
});

const bare = initTRPC.create({ transformer: superjson });
const bareRouter = bare.router({ rawWrite: bare.procedure.query(throwRaw) });

type Wire = { body: string; message?: string; data?: Record<string, unknown> };

async function callOverTheWire(target: typeof probeRouter | typeof bareRouter, path: string): Promise<Wire> {
  const app = express();
  app.use("/api/trpc", createExpressMiddleware({ router: target, createContext: () => ({}) as never }));
  const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
  try {
    const response = await fetch(`${baseUrlOf(server)}/api/trpc/${path}`);
    const body = await response.text();
    const parsed = JSON.parse(body) as { error?: { json?: { message?: string; data?: Record<string, unknown> } } };
    if (!parsed.error?.json) throw new Error(`expected an error payload, got: ${body}`);
    return { body, ...parsed.error.json };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function expectNoQuery(wire: Wire) {
  expect(wire.body, "the customer's words").not.toContain(SENTINEL);
  expect(wire.body, "the SQL").not.toContain("Failed query");
  expect(wire.body, "a table name").not.toContain("casts");
  expect(wire.body, "a column name").not.toContain("persona");
}

describe("a failed query at the wire", () => {
  it("NEGATIVE CONTROL: without the formatter, the response carries the SQL and the customer's words", async () => {
    const wire = await callOverTheWire(bareRouter, "rawWrite");
    expect(wire.data?.code).toBe("INTERNAL_SERVER_ERROR");
    expect(wire.body).toContain("Failed query: update `casts` set `persona`");
    expect(wire.body).toContain(SENTINEL);
  });

  it("an unknown throw of a failed write reaches the browser as one plain sentence", async () => {
    const wire = await callOverTheWire(probeRouter, "rawWrite");
    expect(wire.message).toBe(INTERNAL_FAILURE_SENTENCE);
    expect(wire.data?.code).toBe("INTERNAL_SERVER_ERROR");
    expect(wire.data?.spoken).toBeUndefined();
    expect(wire.data?.stack).toBeUndefined();
    expectNoQuery(wire);
  });

  it("a plain crash is a sentence too, not the engine's text", async () => {
    const wire = await callOverTheWire(probeRouter, "crash");
    expect(wire.message).toBe(INTERNAL_FAILURE_SENTENCE);
    expect(wire.body).not.toContain("Cannot read properties");
  });

  it("a route that copied a failed query's message into its own throw is caught by the text, whatever the code", async () => {
    for (const path of ["copiedInternal", "copiedBadRequest"]) {
      const wire = await callOverTheWire(probeRouter, path);
      expect(wire.message, path).toBe(INTERNAL_FAILURE_SENTENCE);
      expectNoQuery(wire);
    }
  });

  it("POSITIVE CONTROL: an authored INTERNAL sentence without the marker is kept word for word", async () => {
    const wire = await callOverTheWire(probeRouter, "authoredUnmarked");
    expect(wire.message).toBe(AUTHORED_UNMARKED);
    expectNoQuery(wire);
  });

  it("POSITIVE CONTROL: a spoken sentence is kept, and keeps its marker", async () => {
    const wire = await callOverTheWire(probeRouter, "authoredSpoken");
    expect(wire.message).toBe(AUTHORED_SPOKEN);
    expect(wire.data?.spoken).toBe(true);
    expectNoQuery(wire);
  });

  it("POSITIVE CONTROL: the marker wins even where the message echoes its cause, as a wrap's does", async () => {
    const wire = await callOverTheWire(probeRouter, "spokenEcho");
    expect(wire.message).toBe(AUTHORED_SPOKEN);
    expect(wire.data?.spoken).toBe(true);
  });
});
