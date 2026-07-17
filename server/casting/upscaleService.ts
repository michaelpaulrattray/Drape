import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { CREDIT_COSTS, ImageResolution, upscaleImage } from "./aiService";
import { withAtomicCredits } from "./atomicCredits";

type UpscaleResult = Awaited<ReturnType<typeof upscaleImage>>;
type CreditOptions = {
  userId: number;
  amount: number;
  description: string;
  referenceId: string;
};

export interface UpscaleDependencies {
  withCredits: (options: CreditOptions, operation: () => Promise<UpscaleResult>) => Promise<UpscaleResult>;
  upscale: typeof upscaleImage;
  randomId: () => string;
}

const DEFAULT_DEPENDENCIES: UpscaleDependencies = {
  withCredits: withAtomicCredits,
  upscale: upscaleImage,
  randomId: randomUUID,
};

export async function executePaidUpscale(
  input: { userId: number; imageUrl: string; resolution: "2K" | "4K" },
  dependencies: UpscaleDependencies = DEFAULT_DEPENDENCIES,
): Promise<UpscaleResult> {
  const resolutionMap = {
    "2K": ImageResolution.HIGH,
    "4K": ImageResolution.ULTRA,
  } as const;
  return dependencies.withCredits(
    {
      userId: input.userId,
      amount: CREDIT_COSTS.upscale,
      description: `Upscale to ${input.resolution}`,
      referenceId: `upscale-${dependencies.randomId()}`,
    },
    () => dependencies.upscale(input.imageUrl, resolutionMap[input.resolution]),
  );
}

/** Preserve withAtomicCredits' sanitized refund truth verbatim. */
export function normalizeUpscaleError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to upscale image" });
}
