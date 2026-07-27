const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function inkCandidatePublicStorageKey(input: {
  userId: number;
  modelId: number;
  candidateId: string;
  operationId: string;
}): string {
  if (
    !Number.isSafeInteger(input.userId)
    || input.userId <= 0
    || !Number.isSafeInteger(input.modelId)
    || input.modelId <= 0
    || !UUID_PATTERN.test(input.candidateId)
    || !UUID_PATTERN.test(input.operationId)
  ) {
    throw new TypeError("Ink candidate public-storage identity is invalid");
  }
  return `users/${input.userId}/models/${input.modelId}/generated/ink/${input.candidateId}/${input.operationId}.webp`;
}

export function parseInkCandidatePublicStorageKey(
  key: string,
): {
  userId: number;
  modelId: number;
  candidateId: string;
  operationId: string;
} {
  const match = /^users\/([1-9][0-9]*)\/models\/([1-9][0-9]*)\/generated\/ink\/([^/]+)\/([^/]+)\.webp$/
    .exec(key);
  const userId = Number(match?.[1]);
  const modelId = Number(match?.[2]);
  const candidateId = match?.[3] ?? "";
  const operationId = match?.[4] ?? "";
  if (
    !Number.isSafeInteger(userId)
    || !Number.isSafeInteger(modelId)
    || !UUID_PATTERN.test(candidateId)
    || !UUID_PATTERN.test(operationId)
  ) {
    throw new Error("Ink candidate public-storage key is invalid");
  }
  return { userId, modelId, candidateId, operationId };
}
