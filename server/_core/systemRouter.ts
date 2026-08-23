import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

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

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
