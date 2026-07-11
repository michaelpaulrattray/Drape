/**
 * castingParse — the "from prompt" entry in the create path (R2 / D-33).
 * A sentence goes in, merged CastAttributes come out; the client prefills
 * the environment's controls (prefill, not bypass — the user reviews and
 * generates from the form). Free (text-tier call), but rate-limited.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../../_core/trpc";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../../security/rateLimit";
import { parseCastingPrompt, mergeParsedPreferences } from "../../casting/promptParser";
import { createModuleLogger } from "../../logging/logger";

const log = createModuleLogger("routes/castingParse");

export const castingParseRouter = router({
  parsePrompt: protectedProcedure
    .input(
      z.object({
        prompt: z.string().trim().min(1).max(2000),
        /** Values already set in the form — they win over parser output. */
        locked: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rate = checkRateLimit(`user:${ctx.user.id}:parse`, RATE_LIMITS.generation);
      if (!rate.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rate.resetIn) });
      }

      const parsed = await parseCastingPrompt(input.prompt);
      const merged = mergeParsedPreferences(parsed, input.locked ?? {}, input.prompt);
      log.info(
        { userId: ctx.user.id, intent: parsed.intent, fieldCount: Object.keys(parsed.fields).length },
        "Prompt parsed for form prefill",
      );
      return {
        intent: parsed.intent,
        randomizeFields: parsed.randomizeFields,
        /** Merged, ready to apply to the form — parser + randomization + locked. */
        preferences: merged as Record<string, unknown>,
        /** Only the fields the parser explicitly extracted (for "N fields set" copy). */
        parsedFieldCount: Object.keys(parsed.fields).filter((k) => k !== "ethnicityBlend" && k !== "castingVibe").length,
      };
    }),
});
