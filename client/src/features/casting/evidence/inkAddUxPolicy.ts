export const INK_REFERENCE_MAX_BYTES = 10 * 1024 * 1024;
export const INK_DESCRIPTION_MIN_LENGTH = 3;
export const INK_DESCRIPTION_MAX_LENGTH = 500;

const ACCEPTED_REFERENCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function inkReferenceFileError(
  file: Pick<File, "size" | "type">,
): string | null {
  if (!ACCEPTED_REFERENCE_TYPES.has(file.type)) {
    return "Use one still JPEG, PNG, or WebP image.";
  }
  if (
    !Number.isSafeInteger(file.size)
    || file.size <= 0
    || file.size > INK_REFERENCE_MAX_BYTES
  ) {
    return "Reference images must be 10 MB or smaller.";
  }
  return null;
}

export function inkDescriptionReady(description: string): boolean {
  const length = description.trim().length;
  return length >= INK_DESCRIPTION_MIN_LENGTH
    && length <= INK_DESCRIPTION_MAX_LENGTH;
}

export function inkCandidateIsExpired(
  expiresAt: string | null,
  now = Date.now(),
): boolean {
  return Boolean(expiresAt && Date.parse(expiresAt) <= now);
}
