/**
 * Tests for server resilience logic:
 * - alertCriticalError helper
 * - tRPC onError severity classification
 * - Graceful shutdown sequencing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// ALERT CRITICAL ERROR — the REAL payload builder, imported
// ============================================================================
/*
 * ⚠ THIS SECTION USED TO RE-TYPE `alertCriticalError` FROM
 * `server/_core/index.ts`, and it said so in its own heading. The copy had
 * DRIFTED, and its arms asserted the drift: it took the dispatch function as
 * an argument and RETURNED A BOOLEAN, so six arms read `expect(sent).toBe(…)`
 * about a helper that has never returned anything — the real one is
 * `Promise<void>` and imports `dispatch` itself.
 *
 * Two of those arms — "should return false if dispatch itself throws" and
 * "should return false if dispatch returns sent: false" — described a
 * contract the product does not have and could never have failed. They are
 * gone. What they were reaching for (a crash handler must not throw while
 * reporting a crash) is real, and it lives in the `catch` at the call site,
 * which is not reachable from here without booting the server.
 *
 * `buildCriticalErrorAlert` is now a named export of `_core/criticalAlert.ts`
 * with `_core/index.ts` as its first reader, and every arm below drives it.
 * Filed under 3g's A. Working law 4: derive, never mirror.
 */
import { buildCriticalErrorAlert } from "./_core/criticalAlert";

describe("buildCriticalErrorAlert", () => {
  it("builds a critical alert for Error objects", () => {
    const call = buildCriticalErrorAlert("Uncaught Exception", new Error("Something broke"));
    expect(call.type).toBe("critical_security_server_crash");
    expect(call.severity).toBe("critical");
    expect(call.title).toBe("Server Uncaught Exception");
    expect(call.description).toContain("Something broke");
    expect(call.description).toContain("```");
  });

  it("builds a critical alert for string errors", () => {
    expect(buildCriticalErrorAlert("Unhandled Rejection", "string error").description)
      .toBe("string error");
  });

  it("builds one for non-Error objects", () => {
    expect(buildCriticalErrorAlert("Unhandled Rejection", { code: 42 }).description)
      .toBe("[object Object]");
  });

  it("builds one for null/undefined errors", () => {
    expect(buildCriticalErrorAlert("Uncaught Exception", null).description).toBe("null");
  });

  it("truncates long stack traces to 500 chars", () => {
    const longStackError = new Error("fail");
    longStackError.stack = "Error: fail\n" + "a".repeat(1000);
    const call = buildCriticalErrorAlert("Uncaught Exception", longStackError);
    const stackMatch = call.description.match(/```(.*)```/s);
    expect(stackMatch).toBeTruthy();
    expect(stackMatch![1].length).toBeLessThanOrEqual(500);
  });
});

// ============================================================================
// TRPC onError SEVERITY CLASSIFICATION
// ============================================================================

type TRPCErrorCode =
  | "INTERNAL_SERVER_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "TIMEOUT"
  | "TOO_MANY_REQUESTS";

function classifyTrpcError(code: TRPCErrorCode): "ERROR" | "WARN" {
  return code === "INTERNAL_SERVER_ERROR" ? "ERROR" : "WARN";
}

function formatTrpcErrorLog(
  severity: "ERROR" | "WARN",
  type: string,
  path: string | undefined,
  message: string
): string {
  return `[tRPC ${severity}] ${type} ${path ?? "unknown"}: ${message}`;
}

describe("tRPC onError severity classification", () => {
  it("should classify INTERNAL_SERVER_ERROR as ERROR", () => {
    expect(classifyTrpcError("INTERNAL_SERVER_ERROR")).toBe("ERROR");
  });

  it("should classify UNAUTHORIZED as WARN", () => {
    expect(classifyTrpcError("UNAUTHORIZED")).toBe("WARN");
  });

  it("should classify FORBIDDEN as WARN", () => {
    expect(classifyTrpcError("FORBIDDEN")).toBe("WARN");
  });

  it("should classify NOT_FOUND as WARN", () => {
    expect(classifyTrpcError("NOT_FOUND")).toBe("WARN");
  });

  it("should classify BAD_REQUEST as WARN", () => {
    expect(classifyTrpcError("BAD_REQUEST")).toBe("WARN");
  });

  it("should classify TOO_MANY_REQUESTS as WARN", () => {
    expect(classifyTrpcError("TOO_MANY_REQUESTS")).toBe("WARN");
  });

  it("should classify TIMEOUT as WARN", () => {
    expect(classifyTrpcError("TIMEOUT")).toBe("WARN");
  });
});

describe("tRPC error log formatting", () => {
  it("should format with path", () => {
    const log = formatTrpcErrorLog("ERROR", "mutation", "admin.deleteUser", "User not found");
    expect(log).toBe("[tRPC ERROR] mutation admin.deleteUser: User not found");
  });

  it("should format with unknown path", () => {
    const log = formatTrpcErrorLog("WARN", "query", undefined, "Auth failed");
    expect(log).toBe("[tRPC WARN] query unknown: Auth failed");
  });

  it("should include severity level", () => {
    const errorLog = formatTrpcErrorLog("ERROR", "mutation", "test", "msg");
    const warnLog = formatTrpcErrorLog("WARN", "query", "test", "msg");
    expect(errorLog).toContain("ERROR");
    expect(warnLog).toContain("WARN");
  });
});

// ============================================================================
// GRACEFUL SHUTDOWN SEQUENCING
// ============================================================================

interface ShutdownStep {
  name: string;
  executed: boolean;
  order: number;
}

async function simulateShutdown(
  steps: ShutdownStep[],
  closeServer: () => Promise<void>,
  closeDb: () => Promise<void>
): Promise<ShutdownStep[]> {
  let order = 0;

  // Step 1: Stop accepting new connections
  const serverStep = steps.find(s => s.name === "close_server")!;
  await closeServer();
  serverStep.executed = true;
  serverStep.order = ++order;

  // Step 2: Close DB pool
  const dbStep = steps.find(s => s.name === "close_db")!;
  try {
    await closeDb();
    dbStep.executed = true;
  } catch {
    dbStep.executed = false;
  }
  dbStep.order = ++order;

  return steps;
}

describe("Graceful shutdown sequencing", () => {
  it("should close server before DB", async () => {
    const steps: ShutdownStep[] = [
      { name: "close_server", executed: false, order: 0 },
      { name: "close_db", executed: false, order: 0 },
    ];

    const result = await simulateShutdown(
      steps,
      async () => {},
      async () => {}
    );

    const serverStep = result.find(s => s.name === "close_server")!;
    const dbStep = result.find(s => s.name === "close_db")!;

    expect(serverStep.executed).toBe(true);
    expect(dbStep.executed).toBe(true);
    expect(serverStep.order).toBeLessThan(dbStep.order);
  });

  it("should handle DB close failure gracefully", async () => {
    const steps: ShutdownStep[] = [
      { name: "close_server", executed: false, order: 0 },
      { name: "close_db", executed: false, order: 0 },
    ];

    const result = await simulateShutdown(
      steps,
      async () => {},
      async () => { throw new Error("DB pool already closed"); }
    );

    const serverStep = result.find(s => s.name === "close_server")!;
    const dbStep = result.find(s => s.name === "close_db")!;

    expect(serverStep.executed).toBe(true);
    expect(dbStep.executed).toBe(false); // Failed but didn't crash
  });

  it("should not block if server close is slow", async () => {
    const steps: ShutdownStep[] = [
      { name: "close_server", executed: false, order: 0 },
      { name: "close_db", executed: false, order: 0 },
    ];

    const start = Date.now();
    await simulateShutdown(
      steps,
      async () => { await new Promise(r => setTimeout(r, 50)); },
      async () => {}
    );
    const elapsed = Date.now() - start;

    // Should complete (not hang indefinitely)
    expect(elapsed).toBeLessThan(5000);
    expect(steps.every(s => s.order > 0)).toBe(true);
  });
});

// ============================================================================
// IDEMPOTENT SHUTDOWN (prevent double-shutdown)
// ============================================================================

/*
 * ⚠ THIS ONE IS A SIMULATION AND STAYS ONE — 3g's B, said out loud rather
 * than left to be discovered.
 *
 * The real guard is three lines (`if (shuttingDown) return; shuttingDown =
 * true;`) inside a closure inside `registerShutdownHandlers` in
 * `server/_core/index.ts`, which also closes the HTTP server, arms a
 * `process.exit` timer and ends the database pool. Reaching it from a test
 * means either booting the server or restructuring a production shutdown
 * path for a test's convenience, and the second is a worse trade than the
 * mirror it would remove.
 *
 * So this arm asserts a PROPERTY (a re-entrant call is a no-op) against a
 * model of the guard, and it does not claim to be testing
 * `registerShutdownHandlers`. What would make it real: `shutdown` taking its
 * cleanup steps as arguments, which is a shape change to the boot path and
 * wants its own decision, not a test's.
 */
describe("Idempotent shutdown guard (MODEL, not the product — see the note above)", () => {
  it("a re-entrant shutdown is a no-op — asserted on a model, not on registerShutdownHandlers", async () => {
    let shutdownCount = 0;
    let isShuttingDown = false;

    const shutdown = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      shutdownCount++;
    };

    // Simulate receiving SIGTERM twice rapidly
    await Promise.all([shutdown(), shutdown(), shutdown()]);

    expect(shutdownCount).toBe(1);
  });
});
