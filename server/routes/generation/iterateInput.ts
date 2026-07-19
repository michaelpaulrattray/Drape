/**
 * iterateInput — the generation.iterate wire schema, in a dependency-light
 * module so the client/server contract tests can import it without the
 * router's DB and Gemini imports. This IS the production schema
 * (castingRefinement.ts uses it directly), not a copy.
 *
 * `referenceImage` is legitimately accepted HERE — the guarded post-headshot
 * iteration path (§10.3) — and only here; models.create schema-rejects it.
 */
import { z } from "zod";

export const iterateInputSchema = z.object({
  clientRequestId: z.string().uuid(),
  modelId: z.number(),
  feedback: z.string().min(1),
  assetId: z.number(),
  maskBase64: z.string().max(10_000_000).optional(),
  referenceImage: z.string().max(10_000_000).optional(),
}).strict();
