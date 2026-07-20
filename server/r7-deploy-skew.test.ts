import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  appUpdateRequiredMessage,
} from "./_core/trpc";
import { APP_UPDATE_REQUIRED_MESSAGE } from "../shared/clientRequestId";
import { modelCreateInputSchema } from "./routes/modelCreateInput";

describe("R7 deploy-skew copy", () => {
  it("turns a stale client's missing request id into one plain reload instruction", () => {
    const parsed = modelCreateInputSchema.safeParse({ preferences: {} });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(appUpdateRequiredMessage(parsed.error)).toBe(APP_UPDATE_REQUIRED_MESSAGE);
  });

  it("does not mislabel ordinary validation errors as an app update", () => {
    const error = z.object({ name: z.string().min(2) }).safeParse({ name: "" });
    expect(error.success).toBe(false);
    if (error.success) return;
    expect(appUpdateRequiredMessage(error.error)).toBeNull();
  });
});
