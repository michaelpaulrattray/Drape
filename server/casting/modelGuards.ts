/**
 * Model status guards — Batch 0 of the R6 execution plan (FR-4).
 *
 * `archived` is DELETED everywhere: reads return 404, generation/edit
 * operations refuse. Existing board placements keep their stored imageUrl
 * and degrade to the D-12 "Source unavailable" behavior on the read paths
 * that now 404. One guard, called by every model-operating entry point, so
 * the partition can never drift per-route again (the V10 class).
 */
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("casting/modelGuards");

export function assertNotArchived(model: { id?: number; status: string } | null | undefined): void {
  if (model && model.status === "archived") {
    log.warn({ modelId: model.id }, "[modelGuards] refused — model is archived");
    throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  }
}
