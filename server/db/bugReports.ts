/**
 * Bug Reports — DB helpers for user-submitted bug reports.
 */

import { getDb } from "./connection";
import { bugReports, type InsertBugReport } from "../../drizzle/schema";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("db/bugReports");

export async function createBugReport(data: InsertBugReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(bugReports).values(data).$returningId();
  log.info({ bugReportId: result.id, userId: data.userId }, "Bug report created");
  return result.id;
}
