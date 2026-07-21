/**
 * Bug Reports — DB helpers for user-submitted bug reports.
 */

import { withTransaction } from "./connection";
import { bugReports, type InsertBugReport } from "../../drizzle/schema";
import { createModuleLogger } from "../logging/logger";
import { assertOwnedAvailableModelIn } from "./modelReferenceFence";

const log = createModuleLogger("db/bugReports");

export async function createBugReport(data: InsertBugReport) {
  const result = await withTransaction(async (tx) => {
    if (data.modelId != null) {
      await assertOwnedAvailableModelIn(tx, { modelId: data.modelId, userId: data.userId });
    }
    const [inserted] = await tx.insert(bugReports).values(data).$returningId();
    return inserted;
  });
  log.info({ bugReportId: result.id, userId: data.userId }, "Bug report created");
  return result.id;
}
