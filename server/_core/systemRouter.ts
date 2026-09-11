import { z } from "zod";
import { publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    // .strict() — invariant 4 on a public surface (ruled fable-1435 §2). Safe at
    // the wire, checked rather than assumed: this endpoint has no client caller
    // at all, so no shipped bundle can be sending a field it does not declare.
    // The Express `/api/health` the rite reads is a DIFFERENT surface and is
    // untouched by this.
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      }).strict()
    )
    .query(() => ({
      ok: true,
    })),

  // `notifyOwner` lived here until #800: it forwarded to the Slack webhooks
  // and returned `false` forever in production (no webhook was ever
  // configured). No client called it. Owner-facing notification is the admin
  // panel: audit rows and the overview alerts feed.
});
