/** One client-generated UUID identifies one deliberate user intent. */
export const APP_UPDATE_REQUIRED_MESSAGE =
  "Drape was updated while this page was open. Reload to continue — nothing was charged.";

const CLIENT_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isClientRequestId(value: unknown): value is string {
  return typeof value === "string" && CLIENT_REQUEST_ID_PATTERN.test(value);
}

export function assertClientRequestId(value: unknown): asserts value is string {
  if (!isClientRequestId(value)) {
    throw new TypeError("clientRequestId must be a UUID");
  }
}

export function createClientRequestId(): string {
  return globalThis.crypto.randomUUID();
}
