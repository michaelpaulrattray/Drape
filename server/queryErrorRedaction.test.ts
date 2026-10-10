/**
 * A FAILED WRITE'S VALUES REACH NEITHER THE LOGS NOR SENTRY (#2218).
 *
 * Every arm starts from a REAL `DrizzleQueryError`: drizzle's own mysql2 driver
 * runs a real `UPDATE … SET persona = <sentinel>` against a client whose query
 * rejects with an error shaped the way mysql2 shapes one — `sql` formatted by
 * mysql2's own `format` (values inlined, as `connection.query` does), and a
 * `Duplicate entry '<sentinel>'` message as the MySQL server writes it. Drizzle
 * then wraps it exactly as it does in production (`mysql-core/session.js`,
 * `queryWithCache`). The sentinel is the customer's sentence.
 *
 * Each sink has a NEGATIVE control first — the same error through the same
 * sink with the reduction absent carries the sentinel — so a green arm cannot
 * be a fixture that never carried it.
 *
 * What is driven: the logger's real serializers and message hook (and that the
 * module loggers actually carry them), the tRPC report over a real HTTP request
 * through `createExpressMiddleware`, the real Sentry `NodeClient` building a
 * real event with its linked-errors integration and handing it to the tracker's
 * own `beforeSend`, and `captureServerError` handing the SDK its error.
 */
import type { Server } from "node:http";
import { inspect } from "node:util";

import { initTRPC } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { DrizzleQueryError } from "drizzle-orm/errors";
import express from "express";
import pino from "pino";
import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* Only the three calls the tracker makes on the module are replaced, so the
   arm can read what `captureServerError` hands the SDK; `NodeClient` and the
   rest stay real. No `init` runs, so nothing is patched process-wide. */
const sdkCalls = vi.hoisted(() => ({ captured: [] as unknown[], initOptions: [] as unknown[] }));
vi.mock("@sentry/node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sentry/node")>();
  return {
    ...actual,
    init: (options: unknown) => {
      sdkCalls.initOptions.push(options);
      return undefined;
    },
    withScope: (callback: (scope: { setUser: () => void; setTag: () => void }) => void) =>
      callback({ setUser: () => undefined, setTag: () => undefined }),
    captureException: (error: unknown) => {
      sdkCalls.captured.push(error);
      return "event-id";
    },
  };
});

import * as Sentry from "@sentry/node";

import { createModuleLogger, loggerHooks, loggerSerializers } from "./logging/logger";
import {
  buildTrackerOptions,
  captureServerError,
  initErrorTracker,
  resetErrorTrackerForTests,
} from "./monitoring/errorTracker";
import { buildCriticalErrorAlert } from "./_core/criticalAlert";
import {
  redactQueryValuesInText,
  UNREDUCIBLE_ERROR_MESSAGE,
  withoutQueryValues,
} from "./monitoring/queryErrorRedaction";
import { createTrpcErrorReporter } from "./monitoring/trpcErrorReport";
import { baseUrlOf, listenOnFetchablePort } from "./testing/fetchablePort";
import { failedWrite, SENTINEL } from "./testing/failedWrite";

/** Everything an error could show a reader, at any depth. */
function everything(value: unknown): string {
  const stack = value instanceof Error ? String(value.stack) : "";
  const causeStack = value instanceof Error && value.cause instanceof Error ? String(value.cause.stack) : "";
  return `${inspect(value, { depth: 12, showHidden: true })}\n${stack}\n${causeStack}`;
}

function captureLogger(options: pino.LoggerOptions) {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  return { logger: pino(options, stream).child({ module: "server" }), text: () => lines.join("") };
}

describe("the fixture is a real failed write that carries the customer's words", () => {
  it("is drizzle's own DrizzleQueryError, with the sentinel in the message, the params and the driver's sql", async () => {
    const error = await failedWrite();
    expect(error).toBeInstanceOf(DrizzleQueryError);
    expect(error.message).toContain(`params: ${SENTINEL}`);
    expect(error.params).toContain(SENTINEL);
    const cause = error.cause as unknown as Record<string, unknown>;
    expect(String(cause.sql)).toContain(SENTINEL);
    expect(String(cause.message)).toContain(SENTINEL);
  });
});

describe("the reduction itself", () => {
  it("withholds every value and keeps the diagnosis — the SQL shape and the driver's codes", async () => {
    const safe = withoutQueryValues(await failedWrite()) as Error & Record<string, unknown>;
    expect(everything(safe)).not.toContain(SENTINEL);
    expect(safe.message).toMatch(/^Failed query: update `casts` set `persona` = \? where `casts`.`id` = \?/);
    expect(safe.name).toBe("DrizzleQueryError");
    expect(safe.stack).toMatch(/\n\s+at /);
    const cause = safe.cause as Record<string, unknown>;
    expect(cause.code).toBe("ER_DUP_ENTRY");
    expect(cause.errno).toBe(1062);
    expect(cause.sqlState).toBe("23000");
    expect(cause.sql).toBeUndefined();
    expect(String(cause.message)).toBe("Duplicate entry '[withheld]' for key 'casts.persona'");
  });

  it("reduces mysql2's own error on its own — its `sql` has the values formatted in, whatever its message says", async () => {
    const driver = (await failedWrite("Lock wait timeout exceeded; try restarting transaction")).cause as unknown as Record<
      string,
      unknown
    >;
    expect(String(driver.sql)).toContain(SENTINEL);
    const safe = withoutQueryValues(driver) as Record<string, unknown>;
    expect(safe).not.toBe(driver);
    expect(everything(safe)).not.toContain(SENTINEL);
    expect(safe.code).toBe("ER_DUP_ENTRY");
  });

  it("returns an ordinary error as the very same object", () => {
    const ordinary = new TypeError("cannot read properties of undefined");
    expect(withoutQueryValues(ordinary)).toBe(ordinary);
    expect(withoutQueryValues("a string")).toBe("a string");
    expect(withoutQueryValues(undefined)).toBe(undefined);
  });

  it("reaches a failed write wrapped inside another error", async () => {
    const wrapped = new Error("could not save the persona", { cause: await failedWrite() });
    const safe = withoutQueryValues(wrapped);
    expect(safe).not.toBe(wrapped);
    expect(everything(safe)).not.toContain(SENTINEL);
  });

  it("never throws — a null-prototype object is reduced, an unreadable one becomes a placeholder, never the raw value", () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare.params = [SENTINEL];
    let reduced: unknown;
    expect(() => {
      reduced = withoutQueryValues(bare);
    }).not.toThrow();
    expect(reduced).toBeInstanceOf(Error);
    /* Reduced, not rescued by the catch: the placeholder would also pass the line above. */
    expect((reduced as Error).message).not.toBe(UNREDUCIBLE_ERROR_MESSAGE);
    expect(everything(reduced)).not.toContain(SENTINEL);

    const hostile = new Error(`params-free message ${SENTINEL}`);
    Object.defineProperty(hostile, "cause", {
      get() {
        throw new Error("the getter refuses");
      },
    });
    let answered: unknown;
    expect(() => {
      answered = withoutQueryValues(hostile);
    }).not.toThrow();
    expect(answered === hostile).toBe(false);
    expect((answered as Error).message).toBe(UNREDUCIBLE_ERROR_MESSAGE);
  });

  it("withholds the values in a string — a rejection reason that is not an Error", () => {
    expect(withoutQueryValues(`Failed query: update x set y = ?\nparams: ${SENTINEL}`)).toBe(
      "Failed query: update x set y = ?\nparams: [withheld]",
    );
  });

  it("the critical audit row withholds them from a string reason and from an Error", async () => {
    const fromString = buildCriticalErrorAlert("Unhandled Rejection", (await failedWrite()).message);
    expect(fromString.description).toContain("Failed query: update `casts`");
    expect(fromString.description).not.toContain(SENTINEL);
    const fromError = buildCriticalErrorAlert("Uncaught Exception", await failedWrite());
    expect(fromError.description).toContain("Failed query: update `casts`");
    expect(fromError.description).not.toContain(SENTINEL);
  });

  it("rewrites the three MySQL phrasings that quote a value back, and leaves other prose alone", () => {
    expect(redactQueryValuesInText(`Incorrect integer value: '${SENTINEL}' for column 'id' at row 1`)).not.toContain(SENTINEL);
    expect(redactQueryValuesInText(`You have an error in your SQL syntax; check the manual near '${SENTINEL}' at line 1`)).not.toContain(SENTINEL);
    expect(redactQueryValuesInText("Data too long for column 'persona' at row 1")).toBe("Data too long for column 'persona' at row 1");
  });
});

describe("the logger never writes the values", () => {
  it("NEGATIVE CONTROL: a plain pino logger writes the sentinel — the sink can carry it", async () => {
    const { logger, text } = captureLogger({});
    logger.error({ err: await failedWrite() }, "raw");
    expect(text()).toContain(SENTINEL);
  });

  it("under `err`, `error` and `cause`, and in the message string", async () => {
    const { logger, text } = captureLogger({ serializers: loggerSerializers, hooks: loggerHooks });
    const error = await failedWrite();
    logger.error({ err: error }, "under err");
    logger.error({ error }, "under error");
    logger.error({ cause: error }, "under cause");
    logger.error({ error: error.message }, "a message under error");
    logger.warn(`interpolated: ${error.message}`);
    const out = text();
    expect(out).toContain("Failed query: update `casts`");
    expect(out).toContain("Duplicate entry '[withheld]' for key 'casts.persona'");
    expect(out).not.toContain(SENTINEL);
  });

  it("an ordinary error under `err` logs exactly as pino would log it unaided", () => {
    const plain = captureLogger({});
    const ours = captureLogger({ serializers: loggerSerializers, hooks: loggerHooks });
    const ordinary = new Error("ordinary");
    plain.logger.error({ err: ordinary }, "same");
    ours.logger.error({ err: ordinary }, "same");
    const strip = (s: string) => s.replace(/"time":\d+,/, "");
    expect(strip(ours.text())).toBe(strip(plain.text()));
  });

  /* CHANGED ARM (relay finding 3 on PR #2223): this used to assert that an
     ordinary error under `error` logged byte-identically to unaided pino —
     which was `{}`, because pino has no serializer there and JSON drops an
     Error's message and stack. Under `error` and `cause` it now keeps them. */
  it("an ordinary error under `error` or `cause` keeps its message and stack, which unaided pino dropped", () => {
    const plain = captureLogger({});
    const ours = captureLogger({ serializers: loggerSerializers, hooks: loggerHooks });
    const ordinary = new TypeError("cannot read properties of undefined");
    plain.logger.error({ cause: ordinary }, "plain");
    ours.logger.error({ cause: ordinary, error: ordinary }, "ours");
    expect(JSON.parse(plain.text()).cause).toEqual({});
    const line = JSON.parse(ours.text());
    for (const key of ["cause", "error"]) {
      expect(line[key].type).toBe("TypeError");
      expect(line[key].message).toBe("cannot read properties of undefined");
      expect(line[key].stack).toMatch(/\n\s+at /);
    }
  });

  it("NEGATIVE CONTROL: with the serializers but no hook, `log.error(err)` and `log.error({ err })` put the sentinel in msg", async () => {
    const { logger, text } = captureLogger({ serializers: loggerSerializers });
    logger.error(await failedWrite());
    logger.error({ err: await failedWrite() });
    const lines = text().trim().split("\n").map((line) => JSON.parse(line));
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line.msg).toContain(SENTINEL);
  });

  it("`log.error(err)` and `log.error({ err })` with no message keep the sentinel out of msg", async () => {
    const { logger, text } = captureLogger({ serializers: loggerSerializers, hooks: loggerHooks });
    logger.error(await failedWrite());
    logger.error({ err: await failedWrite() });
    const out = text();
    expect(out).not.toContain(SENTINEL);
    const lines = out.trim().split("\n").map((line) => JSON.parse(line));
    for (const line of lines) expect(line.msg).toMatch(/^Failed query: update `casts`.*params: \[withheld\]/s);
  });

  it("NEGATIVE CONTROL then the fix: a failed write inside an AggregateError", async () => {
    const aggregate = new AggregateError([new Error("fine"), await failedWrite()], "two writes failed");
    const plain = captureLogger({});
    plain.logger.error({ err: aggregate }, "aggregate");
    expect(plain.text()).toContain(SENTINEL);
    const ours = captureLogger({ serializers: loggerSerializers, hooks: loggerHooks });
    ours.logger.error({ err: aggregate }, "aggregate");
    expect(ours.text()).not.toContain(SENTINEL);
    const line = JSON.parse(ours.text());
    expect(line.err.aggregateErrors).toHaveLength(2);
    expect(line.err.aggregateErrors[1].message).toContain("Failed query: update `casts`");
  });

  it("is what the server's own module loggers carry", () => {
    const real = createModuleLogger("server") as unknown as Record<symbol, Record<string, unknown>>;
    const serializers = real[pino.symbols.serializersSym];
    expect(serializers.err).toBe(loggerSerializers.err);
    expect(serializers.error).toBe(loggerSerializers.error);
    expect(serializers.cause).toBe(loggerSerializers.cause);
    expect(real[pino.symbols.hooksSym].logMethod).toBe(loggerHooks.logMethod);
  });
});

describe("the tRPC report, over a real request", () => {
  let server: Server;
  let url = "";
  let logText: () => string = () => "";
  const captured: unknown[] = [];

  beforeEach(async () => {
    captured.length = 0;
    const t = initTRPC.create();
    const router = t.router({
      savePersona: t.procedure.mutation(async () => {
        await failedWrite().then((error) => {
          throw error;
        });
      }),
    });
    const sink = captureLogger({});
    logText = sink.text;
    const app = express();
    app.use(
      "/api/trpc",
      createExpressMiddleware({
        router,
        /* A plain pino logger on purpose: the report must withhold the values
           itself, not lean on the server logger's serializers. */
        onError: createTrpcErrorReporter({
          log: sink.logger,
          capture: (error) => {
            captured.push(error);
          },
        }),
      }),
    );
    server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
    url = `${baseUrlOf(server)}/api/trpc/savePersona`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("logs and captures the failed write without the customer's words", async () => {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(response.status).toBe(500);
    const out = logText();
    expect(out).toContain("tRPC ERROR: Failed query: update `casts`");
    expect(out).not.toContain(SENTINEL);
    expect(captured).toHaveLength(1);
    expect(everything(captured[0])).toContain("Failed query: update `casts`");
    expect(everything(captured[0])).not.toContain(SENTINEL);
  });
});

describe("Sentry never receives the values", () => {
  const ENV = ["SENTRY_DSN", "R2_PUBLIC_URL"] as const;
  let saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved = {};
    for (const key of ENV) saved[key] = process.env[key];
    for (const key of ENV) delete process.env[key];
    sdkCalls.captured.length = 0;
    sdkCalls.initOptions.length = 0;
    resetErrorTrackerForTests();
  });

  afterEach(() => {
    for (const key of ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetErrorTrackerForTests();
  });

  /** A real NodeClient — real event building, real linked errors — whose
      transport keeps the envelope bytes instead of sending them. */
  async function sendThroughRealClient(
    error: unknown,
    beforeSend: (event: Sentry.ErrorEvent) => Sentry.ErrorEvent | null,
  ): Promise<string> {
    const envelopes: string[] = [];
    const client = new Sentry.NodeClient({
      dsn: "https://public@o0.ingest.sentry.io/0",
      integrations: [Sentry.linkedErrorsIntegration()],
      stackParser: Sentry.defaultStackParser,
      transport: (options) =>
        Sentry.createTransport(options, async (request) => {
          envelopes.push(typeof request.body === "string" ? request.body : Buffer.from(request.body).toString("utf8"));
          return { statusCode: 200 };
        }),
      beforeSend,
      sendClientReports: false,
    });
    client.init();
    const scope = new Sentry.Scope();
    scope.setClient(client);
    scope.captureException(error);
    await client.flush(2000);
    await client.close(2000);
    return envelopes.join("\n");
  }

  it("NEGATIVE CONTROL: the real SDK, with no gate, sends the sentinel — from the message and from the linked cause", async () => {
    const sent = await sendThroughRealClient(await failedWrite(), (event) => event);
    expect(sent).toContain(`params: ${SENTINEL}`);
    expect(sent).toContain(`Duplicate entry '${SENTINEL}'`);
  });

  it("the tracker's own beforeSend withholds them from a RAW error the SDK captured itself", async () => {
    process.env.SENTRY_DSN = "https://public@o0.ingest.sentry.io/0";
    const { beforeSend } = buildTrackerOptions();
    const sent = await sendThroughRealClient(
      await failedWrite(),
      (event) => beforeSend(event as never) as unknown as Sentry.ErrorEvent | null,
    );
    expect(sent).toContain("Failed query: update `casts`");
    expect(sent).toContain("Duplicate entry '[withheld]'");
    expect(sent).not.toContain(SENTINEL);
  });

  it("captureServerError hands the SDK an error that no longer carries them", async () => {
    process.env.SENTRY_DSN = "https://public@o0.ingest.sentry.io/0";
    await initErrorTracker();
    expect(sdkCalls.initOptions).toHaveLength(1);
    const raw = await failedWrite();
    await captureServerError(raw, { kind: "trpc", route: "castingV2.editPersona" });
    expect(sdkCalls.captured).toHaveLength(1);
    expect(everything(sdkCalls.captured[0])).toContain("Failed query: update `casts`");
    expect(everything(sdkCalls.captured[0])).not.toContain(SENTINEL);
  });
});
