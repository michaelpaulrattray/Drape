import { and, inArray, isNull } from "drizzle-orm";
import { models } from "../../drizzle/schema";

/**
 * The only ordinary runtime availability predicate for Cast rows.
 *
 * This is intentionally positive. New lifecycle states such as
 * `provisioning` stay invisible and non-authoritative until they are
 * deliberately added here and reviewed across every consumer.
 */
export const AVAILABLE_MODEL_STATUSES = [
  "draft",
  "active",
  "locked",
] as const;

export function availableModelWhere() {
  return and(
    inArray(models.status, [...AVAILABLE_MODEL_STATUSES]),
    isNull(models.deletedAt),
  )!;
}
