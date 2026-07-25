import { randomBytes } from "node:crypto";

const CAST_PUBLIC_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CAST_PUBLIC_ID_SEGMENT_LENGTH = 4;
const CAST_PUBLIC_ID_SEGMENT_COUNT = 4;
const CAST_PUBLIC_ID_ALLOCATION_ATTEMPTS = 5;

export const CAST_PUBLIC_ID_PATTERN =
  /^KI-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}(?:-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}){3}$/;

export class CastPublicIdAllocationError extends Error {
  constructor() {
    super("A unique Cast ID could not be allocated");
    this.name = "CastPublicIdAllocationError";
  }
}

/**
 * Generate an 80-bit, human-readable Klieg Identity.
 *
 * Existing MOD-* identifiers remain valid forever. This format is only for
 * newly minted Casts, and its random payload deliberately omits 0/1/I/O to
 * reduce transcription mistakes in support conversations and exports.
 */
export function generateCastPublicId(): string {
  const bytes = randomBytes(
    CAST_PUBLIC_ID_SEGMENT_LENGTH * CAST_PUBLIC_ID_SEGMENT_COUNT,
  );
  const characters = Array.from(
    bytes,
    (byte) => CAST_PUBLIC_ID_ALPHABET[byte & 31],
  );
  const segments = Array.from(
    { length: CAST_PUBLIC_ID_SEGMENT_COUNT },
    (_, index) => characters
      .slice(
        index * CAST_PUBLIC_ID_SEGMENT_LENGTH,
        (index + 1) * CAST_PUBLIC_ID_SEGMENT_LENGTH,
      )
      .join(""),
  );
  return `KI-${segments.join("-")}`;
}

function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    chain.push(current);
    if (typeof current !== "object" || !("cause" in current)) break;
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

/** Retry only the models.agencyId uniqueness boundary, never arbitrary writes. */
export function isCastPublicIdCollision(error: unknown): boolean {
  return errorChain(error).some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const mysql = entry as {
      code?: unknown;
      errno?: unknown;
      message?: unknown;
      sqlMessage?: unknown;
    };
    const duplicateEntry =
      mysql.code === "ER_DUP_ENTRY"
      || mysql.errno === 1062;
    if (!duplicateEntry) return false;
    const detail = `${String(mysql.message ?? "")} ${String(mysql.sqlMessage ?? "")}`;
    return /models_agencyId_unique|agencyId/i.test(detail);
  });
}

/**
 * Commit work with a newly allocated ID. The callback is expected to put the
 * ID into a database statement protected by models.agencyId's unique index.
 */
export async function withUniqueCastPublicId<T>(
  commit: (agencyId: string) => Promise<T>,
  options: {
    generate?: () => string;
    maxAttempts?: number;
  } = {},
): Promise<T> {
  const generate = options.generate ?? generateCastPublicId;
  const maxAttempts = options.maxAttempts ?? CAST_PUBLIC_ID_ALLOCATION_ATTEMPTS;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Cast ID allocation attempts must be a positive safe integer");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await commit(generate());
    } catch (error) {
      if (!isCastPublicIdCollision(error)) throw error;
      if (attempt === maxAttempts) throw new CastPublicIdAllocationError();
    }
  }

  throw new CastPublicIdAllocationError();
}
