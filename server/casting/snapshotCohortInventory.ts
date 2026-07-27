import { sql } from "drizzle-orm";
import { models } from "../../drizzle/schema";
import { withTransaction } from "../db/connection";
import { availableModelWhere } from "./modelAvailability";

export interface SnapshotCohortInventoryArgs {
  databaseUrl: string;
  appId: string;
  maxUsers: number;
  allowProductionReadOnly: boolean;
}

export interface SnapshotCohortInventoryUser {
  userId: number;
  liveModels: number;
  mintedModels: number;
  modelsWithSnapshotHead: number;
  modelsWithoutSnapshotHead: number;
}

export type SnapshotCohortInventoryResult =
  | {
      capped: true;
      totalUsers: number;
    }
  | {
      capped: false;
      totalUsers: number;
      users: SnapshotCohortInventoryUser[];
    };

interface SnapshotCohortInventoryRow {
  userId: unknown;
  liveModels: unknown;
  mintedModels: unknown;
  modelsWithSnapshotHead: unknown;
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (
    (typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && !/^[1-9]\d*$/.test(value))
  ) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return parsed;
}

function nonNegativeSafeInteger(value: unknown, label: string): number {
  if (
    (typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && !/^(?:0|[1-9]\d*)$/.test(value))
  ) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return parsed;
}

function parsePositiveInteger(value: string, label: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${label} must be a positive integer`);
  }
  return positiveSafeInteger(value, label);
}

export function parseSnapshotCohortInventoryArgs(
  argv: string[],
): SnapshotCohortInventoryArgs {
  let databaseUrl = "";
  let appId = "";
  let maxUsers: number | undefined;
  let allowProductionReadOnly = false;
  const seen = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (seen.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
    seen.add(flag);
    if (flag === "--allow-production-read-only") {
      allowProductionReadOnly = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    if (flag === "--database-url") databaseUrl = value;
    else if (flag === "--app-id") appId = value;
    else if (flag === "--max-users") {
      maxUsers = parsePositiveInteger(value, "--max-users");
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
    index += 1;
  }

  if (!databaseUrl) throw new Error("--database-url is required");
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error("--database-url must be a valid URL");
  }
  if (target.protocol !== "mysql:") throw new Error("--database-url must use mysql:");
  if (!target.pathname.replace(/^\//, "")) {
    throw new Error("--database-url must name a database");
  }
  if (!appId.trim()) throw new Error("--app-id is required");
  if (maxUsers === undefined) throw new Error("--max-users is required");
  if (
    appId.toLowerCase().includes("production")
    && !allowProductionReadOnly
  ) {
    throw new Error(
      "Production cohort inventory requires --allow-production-read-only",
    );
  }

  return {
    databaseUrl,
    appId,
    maxUsers,
    allowProductionReadOnly,
  };
}

export function buildSnapshotCohortInventory(
  totalUsersValue: unknown,
  rows: SnapshotCohortInventoryRow[],
  maxUsers: number,
): SnapshotCohortInventoryResult {
  const totalUsers = nonNegativeSafeInteger(
    totalUsersValue,
    "Snapshot cohort user count",
  );
  positiveSafeInteger(maxUsers, "Snapshot cohort maximum users");
  if (totalUsers > maxUsers) return { capped: true, totalUsers };
  if (rows.length !== totalUsers) {
    throw new Error("Snapshot cohort grouped-user count changed");
  }

  const seenUserIds = new Set<number>();
  const users = rows.map((row): SnapshotCohortInventoryUser => {
    const userId = positiveSafeInteger(row.userId, "Snapshot cohort user id");
    if (seenUserIds.has(userId)) {
      throw new Error("Snapshot cohort contains a duplicate user");
    }
    seenUserIds.add(userId);
    const liveModels = positiveSafeInteger(
      row.liveModels,
      "Snapshot cohort live-model count",
    );
    const mintedModels = nonNegativeSafeInteger(
      row.mintedModels,
      "Snapshot cohort minted-model count",
    );
    const modelsWithSnapshotHead = nonNegativeSafeInteger(
      row.modelsWithSnapshotHead,
      "Snapshot cohort headed-model count",
    );
    if (mintedModels > liveModels || modelsWithSnapshotHead > liveModels) {
      throw new Error("Snapshot cohort aggregate counts are inconsistent");
    }
    return {
      userId,
      liveModels,
      mintedModels,
      modelsWithSnapshotHead,
      modelsWithoutSnapshotHead: liveModels - modelsWithSnapshotHead,
    };
  }).sort((left, right) => left.userId - right.userId);

  return { capped: false, totalUsers, users };
}

export function publicSnapshotCohortInventory(
  result: SnapshotCohortInventoryResult,
): { totalUsers: number; users?: SnapshotCohortInventoryUser[] } {
  return result.capped
    ? { totalUsers: result.totalUsers }
    : { totalUsers: result.totalUsers, users: result.users };
}

export async function inventorySnapshotCohorts(input: {
  maxUsers: number;
}): Promise<SnapshotCohortInventoryResult> {
  positiveSafeInteger(input.maxUsers, "Snapshot cohort maximum users");
  const liveModelWhere = availableModelWhere();

  return withTransaction(async (tx) => {
    const [totalRow] = await tx
      .select({
        totalUsers: sql<number>`COUNT(DISTINCT ${models.userId})`,
      })
      .from(models)
      .where(liveModelWhere);
    const totalUsers = nonNegativeSafeInteger(
      totalRow?.totalUsers ?? 0,
      "Snapshot cohort user count",
    );
    if (totalUsers > input.maxUsers) return { capped: true, totalUsers };

    const rows = await tx
      .select({
        userId: models.userId,
        liveModels: sql<number>`COUNT(*)`,
        mintedModels: sql<number>`
          SUM(CASE WHEN ${models.status} IN ('active', 'locked') THEN 1 ELSE 0 END)
        `,
        modelsWithSnapshotHead: sql<number>`
          SUM(CASE WHEN ${models.currentPackageSnapshotId} IS NOT NULL THEN 1 ELSE 0 END)
        `,
      })
      .from(models)
      .where(liveModelWhere)
      .groupBy(models.userId)
      .orderBy(models.userId)
      .limit(input.maxUsers);

    return buildSnapshotCohortInventory(totalUsers, rows, input.maxUsers);
  });
}
