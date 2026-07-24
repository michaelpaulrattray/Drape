import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  publishCastProjectionChanged,
  subscribeCastProjectionChanged,
  type CastProjectionChangedEvent,
} from '../client/src/features/operations/castProjectionSync';

type MessageListener = (event: { data: unknown }) => void;
type StorageListener = (event: { key: string | null; newValue: string | null }) => void;

class FakeBroadcastChannel {
  static members = new Map<string, Set<FakeBroadcastChannel>>();
  onmessage: MessageListener | null = null;

  constructor(private readonly name: string) {
    const members = FakeBroadcastChannel.members.get(name) ?? new Set();
    members.add(this);
    FakeBroadcastChannel.members.set(name, members);
  }

  postMessage(data: unknown) {
    for (const member of FakeBroadcastChannel.members.get(this.name) ?? []) {
      if (member !== this) member.onmessage?.({ data });
    }
  }

  close() {
    FakeBroadcastChannel.members.get(this.name)?.delete(this);
  }
}

afterEach(() => {
  FakeBroadcastChannel.members.clear();
  vi.unstubAllGlobals();
});

describe('R7-7B4 cross-tab Cast projection signal', () => {
  it('delivers one model-id-only event across both transports and dedupes the nonce', () => {
    const storageListeners = new Set<StorageListener>();
    const stored = new Map<string, string>();
    const fakeWindow = {
      BroadcastChannel: FakeBroadcastChannel,
      localStorage: {
        setItem(key: string, value: string) {
          stored.set(key, value);
        },
      },
      addEventListener(type: string, listener: StorageListener) {
        if (type === 'storage') storageListeners.add(listener);
      },
      removeEventListener(type: string, listener: StorageListener) {
        if (type === 'storage') storageListeners.delete(listener);
      },
    };
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);

    const received: CastProjectionChangedEvent[] = [];
    const unsubscribe = subscribeCastProjectionChanged((event) => received.push(event));
    publishCastProjectionChanged(42);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: 'cast-projection-changed', modelId: 42 });
    expect(Object.keys(received[0]).sort()).toEqual(['modelId', 'nonce', 'type']);

    const payload = stored.get('drape:cast-projection-changed');
    expect(payload).toBeTruthy();
    for (const listener of storageListeners) {
      listener({ key: 'drape:cast-projection-changed', newValue: payload! });
    }
    expect(received).toHaveLength(1);

    for (const listener of storageListeners) {
      listener({ key: 'drape:cast-projection-changed', newValue: '{"type":"wrong"}' });
    }
    expect(received).toHaveLength(1);

    unsubscribe();
    publishCastProjectionChanged(43);
    expect(received).toHaveLength(1);
  });

  it('does nothing during server rendering or for an invalid subject id', () => {
    expect(() => publishCastProjectionChanged(0)).not.toThrow();
    expect(subscribeCastProjectionChanged(() => undefined)).toBeTypeOf('function');
  });
});
