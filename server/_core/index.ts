import "dotenv/config";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "../stripe/webhooks";
import { securityHeaders } from "../security/securityHeaders";
import { correlationIdMiddleware } from "../security/correlationId";
import heroProxyRouter from "../heroProxy";
import { healthHandler } from "../health";

// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================

/**
 * Attempt to send a critical Slack alert for unhandled errors.
 * Best-effort — if Slack itself fails, we just log to stderr.
 */
async function alertCriticalError(label: string, error: unknown): Promise<void> {
  try {
    const { dispatch } = await import("../slack/slackCore");
    await dispatch({
      type: "critical_security_server_crash",
      severity: "critical",
      title: `Server ${label}`,
      description: error instanceof Error
        ? `${error.message}\n\`\`\`${error.stack?.slice(0, 500)}\`\`\``
        : String(error),
    });
  } catch {
    // Slack dispatch itself failed — nothing more we can do
  }
}

process.on("uncaughtException", async (error: Error) => {
  console.error("[FATAL] Uncaught exception:", error);
  await alertCriticalError("Uncaught Exception", error);
  // Give Slack alert a moment to send, then exit
  setTimeout(() => process.exit(1), 2000);
});

process.on("unhandledRejection", async (reason: unknown) => {
  console.error("[FATAL] Unhandled promise rejection:", reason);
  await alertCriticalError("Unhandled Rejection", reason);
  // Don't exit for rejections — log and continue
});

// ============================================================================
// PORT DISCOVERY
// ============================================================================

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

let httpServer: HttpServer | null = null;

function registerShutdownHandlers(): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Shutdown] Received ${signal}, draining connections...`);

    // Stop health monitor
    try {
      const { stopHealthMonitor } = await import("../monitoring/healthMonitor");
      stopHealthMonitor();
    } catch {
      // Health monitor cleanup is best-effort
    }

    // Stop accepting new connections
    if (httpServer) {
      httpServer.close(() => {
        console.log("[Shutdown] HTTP server closed");
      });
    }

    // Allow in-flight requests up to 10 seconds to finish
    const forceExitTimer = setTimeout(() => {
      console.warn("[Shutdown] Force exit after timeout");
      process.exit(0);
    }, 10_000);
    forceExitTimer.unref(); // Don't keep the process alive just for this timer

    // Close DB pool if available
    try {
      const { getDb } = await import("../db/connection");
      const db = await getDb();
      if (db && typeof (db as any).$client?.end === "function") {
        await (db as any).$client.end();
        console.log("[Shutdown] Database connection closed");
      }
    } catch {
      // DB cleanup is best-effort
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// ============================================================================
// SERVER BOOTSTRAP
// ============================================================================

async function startServer() {
  const app = express();
  const server = createServer(app);
  httpServer = server;

  // Security headers on all responses
  app.use(securityHeaders);

  // Correlation ID: assign/propagate a unique request ID for tracing
  app.use(correlationIdMiddleware);

  // Configure body parser with size limit for file uploads (15MB covers base64 images + JSON metadata)
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Stripe webhook endpoint (must use raw body)
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"] as string;
      
      if (!signature) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }

      const result = await handleStripeWebhook(req.body, signature);
      
      if (result.success) {
        res.status(200).json({ received: true, message: result.message });
      } else {
        res.status(400).json({ error: result.message });
      }
    }
  );

  // Slack interactions endpoint (for button callbacks)
  app.post(
    "/api/slack/interactions",
    express.urlencoded({ extended: true }),
    async (req, res) => {
      const { handleSlackInteraction } = await import("../slack/slackInteractions");
      await handleSlackInteraction(req, res);
    }
  );
  
  // Deep-check health endpoint (DB ping + latency)
  app.get("/api/health", healthHandler);

  // Hero texture proxy (serves S3 images with CORS headers)
  app.use(heroProxyRouter);

  // tRPC API with centralized error logging
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path, type, ctx }) {
        // Log all server-side tRPC errors with correlation ID for traceability
        const severity = error.code === "INTERNAL_SERVER_ERROR" ? "ERROR" : "WARN";
        const cid = (ctx as any)?.correlationId ?? "unknown";
        console.error(
          `[tRPC ${severity}] [${cid}] ${type} ${path ?? "unknown"}: ${error.message}`,
          error.code === "INTERNAL_SERVER_ERROR" ? error.cause ?? "" : ""
        );
      },
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Daily job: expire stale pending referrals (>30 days old)
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const runReferralExpiration = async () => {
      try {
        const { expireStalePendingReferrals } = await import("../db");
        const count = await expireStalePendingReferrals();
        if (count > 0) {
          console.log(`[Scheduler] Expired ${count} stale pending referrals`);
        }
      } catch (err) {
        console.error("[Scheduler] Referral expiration job failed:", err);
      }
    };
    // Run once on startup (after 30s delay to let DB connect), then daily
    setTimeout(runReferralExpiration, 30_000);
    setInterval(runReferralExpiration, TWENTY_FOUR_HOURS);

    // Start health monitor (checks every 5 min, first run after 60s)
    import("../monitoring/healthMonitor").then(({ startHealthMonitor }) => {
      startHealthMonitor();
    }).catch(err => {
      console.error("[Scheduler] Failed to start health monitor:", err);
    });
  });

  // Register shutdown handlers after server is listening
  registerShutdownHandlers();
}

startServer().catch(console.error);
