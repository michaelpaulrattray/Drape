const CHANNEL_NAME = 'drape-cast-lifecycle';
const STORAGE_KEY = 'drape:cast-deleted';

export interface CastDeletedEvent {
  type: 'cast-deleted';
  modelId: number;
  nonce: string;
}

function isCastDeletedEvent(value: unknown): value is CastDeletedEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CastDeletedEvent>;
  return candidate.type === 'cast-deleted'
    && Number.isSafeInteger(candidate.modelId)
    && Number(candidate.modelId) > 0
    && typeof candidate.nonce === 'string';
}

export function publishCastDeleted(modelId: number): void {
  if (typeof window === 'undefined') return;
  const event: CastDeletedEvent = {
    type: 'cast-deleted',
    modelId,
    nonce: `${Date.now()}:${crypto.randomUUID()}`,
  };
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
    channel.close();
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
  } catch {
    // BroadcastChannel remains the primary path; privacy modes may deny
    // localStorage without weakening the initiating tab's own invalidation.
  }
}

export function subscribeCastDeleted(listener: (event: CastDeletedEvent) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const seen = new Set<string>();
  const deliver = (value: unknown) => {
    if (!isCastDeletedEvent(value) || seen.has(value.nonce)) return;
    seen.add(value.nonce);
    listener(value);
  };
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  if (channel) channel.onmessage = (event) => deliver(event.data);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      deliver(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed local browser state.
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    channel?.close();
    window.removeEventListener('storage', onStorage);
  };
}
