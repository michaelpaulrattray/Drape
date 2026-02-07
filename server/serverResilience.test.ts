/**
 * Tests for server resilience logic:
 * - alertCriticalError helper
 * - tRPC onError severity classification
 * - Graceful shutdown sequencing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// ALERT CRITICAL ERROR — mirrors the helper in server/_core/index.ts
// ============================================================================

type SlackDispatchFn = (event: {
  type: string;
  severity: string;
  title: string;
  description: string;
}) => Promise<{ sent: boolean; channels: string[] }>;

async function alertCriticalError(
  label: string,
  error: unknown,
  dispatchFn: SlackDispatchFn
): Promise<boolean> {
  try {
    const result = await dispatchFn({
      type: "critical_security_server_crash",
      severity: "critical",
      title: `Server ${label}`,
      description:
        error instanceof Error
          ? `${error.message}\n\`\`\`${error.stack?.slice(0, 500)}\`\`\``
          : String(error),
    });
    return result.sent;
  } catch {
    return false;
  }
}

describe("alertCriticalError", () => {
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDispatch = vi.fn().mockResolvedValue({ sent: true, channels: ["admin-actions"] });
  });

  it("should dispatch a critical alert for Error objects", async () => {
    const error = new Error("Something broke");
    const sent = await alertCriticalError("Uncaught Exception", error, mockDispatch);

    expect(sent).toBe(true);
    expect(mockDispatch).toHaveBeenCalledOnce();
    const call = mockDispatch.mock.calls[0][0];
    expect(call.type).toBe("critical_security_server_crash");
    expect(call.severity).toBe("critical");
    expect(call.title).toBe("Server Uncaught Exception");
    expect(call.description).toContain("Something broke");
    expect(call.description).toContain("```");
  });

  it("should dispatch a critical alert for string errors", async () => {
    const sent = await alertCriticalError("Unhandled Rejection", "string error", mockDispatch);

    expect(sent).toBe(true);
    const call = mockDispatch.mock.calls[0][0];
    expect(call.description).toBe("string error");
  });

  it("should dispatch for non-Error objects", async () => {
    const sent = await alertCriticalError("Unhandled Rejection", { code: 42 }, mockDispatch);

    expect(sent).toBe(true);
    const call = mockDispatch.mock.calls[0][0];
    expect(call.description).toBe("[object Object]");
  });

  it("should dispatch for null/undefined errors", async () => {
    const sent = await alertCriticalError("Uncaught Exception", null, mockDispatch);

    expect(sent).toBe(true);
    const call = mockDispatch.mock.calls[0][0];
    expect(call.description).toBe("null");
  });

  it("should return false if dispatch itself throws", async () => {
    mockDispatch.mockRejectedValue(new Error("Slack is down"));
    const sent = await alertCriticalError("Uncaught Exception", new Error("test"), mockDispatch);

    expect(sent).toBe(false);
  });

  it("should return false if dispatch returns sent: false", async () => {
    mockDispatch.mockResolvedValue({ sent: false, channels: [] });
    const sent = await alertCriticalError("Uncaught Exception", new Error("test"), mockDispatch);

    expect(sent).toBe(false);
  });

  it("should truncate long stack traces to 500 chars", async () => {
    const longStackError = new Error("fail");
    longStackError.stack = "Error: fail\n" + "a".repeat(1000);
    await alertCriticalError("Uncaught Exception", longStackError, mockDispatch);

    const call = mockDispatch.mock.calls[0][0];
    // The stack portion inside backticks should be at most 500 chars
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

describe("Idempotent shutdown guard", () => {
  it("should only execute shutdown once even if called multiple times", async () => {
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
