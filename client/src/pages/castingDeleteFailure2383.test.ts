/**
 * DELETING A CHARACTER OR NAMING A CAMPAIGN NEVER SHOWS TRANSPORT TEXT — #2383.
 *
 * Seven failure lines on the casting pages read
 * `error instanceof Error ? error.message : <our sentence>`. A tRPC client
 * error is always an `Error`, so the sentence after the colon could never be
 * shown: a gateway 502 or a dropped connection put the transport's own words
 * on screen (the run-9 class `@/lib/failureSentence` exists to stop).
 *
 * Driven at the wire for the character's page: a real tRPC server built from
 * the product's own `router`/`publicProcedure`, a real `httpBatchLink`, a real
 * gateway-shaped 502 and a real closed port, read by the page's own
 * `roomDeleteFailureSentence`. The other six sites call the same
 * `readableFailure`; the class arm below holds both pages to that.
 *
 * And the second half of the card: the room's delete tells the library first,
 * so a library visited earlier does not draw the deleted character from cache.
 */
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { baseUrlOf, listenOnFetchablePort } from "../../../server/testing/fetchablePort";

const { router, publicProcedure } = await import("../../../server/_core/trpc");
const { roomDeleteFailureSentence, refreshLibraryAfterDelete } = await import("./CastingRoom");

const REFUSED = "That character was deleted in another tab.";

const probeRouter = router({
  refused: publicProcedure.mutation(() => {
    throw new TRPCError({ code: "NOT_FOUND", message: REFUSED });
  }),
  crash: publicProcedure.mutation(() => {
    throw new Error("Cannot read properties of undefined (reading 'modelId')");
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
  /* A gateway that lost the upstream: plain text, nothing tRPC can read. */
  const edge = express();
  edge.use((_req, res) => {
    res.status(502).type("text/plain").send("upstream error");
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

const clientAt = (url: string) =>
  createTRPCClient<ProbeRouter>({ links: [httpBatchLink({ url, transformer: superjson })] });

async function caught(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to fail");
}

const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("the character's page delete failure (#2383)", () => {
  it("a gateway 502 gets our sentence with the character's name, never the transport's", async () => {
    const spy = quiet();
    const error = await caught(() => clientAt(`${baseUrlOf(gateway)}/api/trpc`).refused.mutate());
    // The instrument sees what the old line showed: transport text on an Error.
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toBe("");
    expect(roomDeleteFailureSentence(error, "Nine")).toBe("Nine could not be deleted.");
    expect(roomDeleteFailureSentence(error, null)).toBe("That character could not be deleted.");
    spy.mockRestore();
  });

  it("a dropped connection and an unhandled crash get our sentence too", async () => {
    const spy = quiet();
    const dead = express();
    const closed = await listenOnFetchablePort((port) => dead.listen(port, "127.0.0.1"));
    const url = `${baseUrlOf(closed)}/api/trpc`;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    const dropped = await caught(() => clientAt(url).refused.mutate());
    expect(roomDeleteFailureSentence(dropped, "Nine")).toBe("Nine could not be deleted.");
    const crash = await caught(() => clientAt(`${baseUrlOf(server)}/api/trpc`).crash.mutate());
    expect(roomDeleteFailureSentence(crash, "Nine")).toBe("Nine could not be deleted.");
    spy.mockRestore();
  });

  it("the server's own refusal still reaches the customer word for word (positive control)", async () => {
    const spy = quiet();
    const refused = await caught(() => clientAt(`${baseUrlOf(server)}/api/trpc`).refused.mutate());
    expect(roomDeleteFailureSentence(refused, "Nine")).toBe(REFUSED);
    spy.mockRestore();
  });
});

describe("the room's delete tells the library first (#2383)", () => {
  function recordingUtils() {
    const told: string[] = [];
    const cache = (name: string) => ({ invalidate: async () => { told.push(name); } });
    return {
      told,
      utils: {
        castingV2: {
          roster: cache("roster"),
          rosterCounts: cache("rosterCounts"),
          listCampaigns: cache("listCampaigns"),
          openSessions: cache("openSessions"),
        },
      },
    };
  }

  it("refreshes the grid, its counts, the campaign counts and the open castings", async () => {
    const { told, utils } = recordingUtils();
    await refreshLibraryAfterDelete(utils);
    expect([...told].sort()).toEqual(["listCampaigns", "openSessions", "roster", "rosterCounts"]);
  });

  it("the delete confirms through it before leaving the page, and fails through our sentence", () => {
    const room = readFileSync(new URL("./CastingRoom.tsx", import.meta.url), "utf8");
    const start = room.indexOf("await deleteCast.mutateAsync({");
    expect(start, "the room's delete call").toBeGreaterThan(-1);
    expect(room.indexOf("await deleteCast.mutateAsync({", start + 1), "anchor is unique").toBe(-1);
    const end = room.indexOf("{leaveAsk ? (", start);
    expect(end).toBeGreaterThan(start);
    const onConfirm = room.slice(start, end);
    const refresh = onConfirm.indexOf("await refreshLibraryAfterDelete(utils)");
    const leave = onConfirm.indexOf('navigate("/app/casting")');
    expect(refresh, "the library is refreshed").toBeGreaterThan(-1);
    expect(leave).toBeGreaterThan(refresh);
    expect(onConfirm).toContain("toast.error(roomDeleteFailureSentence(error, data.name ?? null))");
  });
});

/**
 * THE CLASS, on both casting pages: no failure line shows `error.message` on
 * the strength of `instanceof Error`.
 */
const RAW_MESSAGE = /instanceof\s+Error\s*\?\s*\w+\.message/;

describe("the casting pages never show an error's own message (#2383)", () => {
  it("the instrument catches the shape this card removed (negative control)", () => {
    expect('toast(error instanceof Error ? error.message : "That name could not be saved.");').toMatch(RAW_MESSAGE);
    expect("toast(error instanceof Error\n  ? error.message\n  : `${name} could not be deleted.`);").toMatch(RAW_MESSAGE);
    expect('toast.error(readableFailure(error, "That name could not be saved."));').not.toMatch(RAW_MESSAGE);
  });

  for (const page of ["./CastingRoom.tsx", "./CastingV2.tsx"]) {
    it(`${page} routes every failure through readableFailure`, () => {
      const source = readFileSync(new URL(page, import.meta.url), "utf8");
      expect(source).toContain('from "@/lib/failureSentence"');
      expect(source).not.toMatch(RAW_MESSAGE);
    });
  }
});
