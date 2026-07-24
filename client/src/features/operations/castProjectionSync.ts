const CHANNEL_NAME = 'drape-cast-projection';
const STORAGE_KEY = 'drape:cast-projection-changed';

export interface CastProjectionChangedEvent {
  type: 'cast-projection-changed';
  modelId: number;
  nonce: string;
}

function isCastProjectionChangedEvent(value: unknown): value is CastProjectionChangedEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CastProjectionChangedEvent>;
  return candidate.type === 'cast-projection-changed'
    && Number.isSafeInteger(candidate.modelId)
    && Number(candidate.modelId) > 0
    && typeof candidate.nonce === 'string'
    && candidate.nonce.length > 0
    && candidate.nonce.length <= 128;
}

/**
 * Announces that server-owned Cast projection truth changed in this tab.
 * Payloads contain only the subject id and a dedupe nonce; receivers merely
 * invalidate caches and must still re-read authority from the server.
 */
export function publishCastProjectionChanged(modelId: number): void {
  if (typeof window === 'undefined' || !Number.isSafeInteger(modelId) || modelId <= 0) return;
  const event: CastProjectionChangedEvent = {
    type: 'cast-projection-changed',
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
    // BroadcastChannel remains primary; privacy modes may deny localStorage.
  }
}

export function subscribeCastProjectionChanged(
  listener: (event: CastProjectionChangedEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const seen = new Set<string>();
  const deliver = (value: unknown) => {
    if (!isCastProjectionChangedEvent(value) || seen.has(value.nonce)) return;
    seen.add(value.nonce);
    if (seen.size > 256) seen.delete(seen.values().next().value!);
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
