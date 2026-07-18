/**
 * Same-tab handoff for a fresh cast that finishes after its Casting surface
 * closes. The board stays mounted while the takeover does not, so completion
 * notices belong here rather than to the unmounting generation hook.
 */

export type PendingCastOutcome =
  | {
      kind: 'success';
      modelId: number;
      openDraft?: () => void;
    }
  | {
      kind: 'failure';
      message: string;
    };

type PendingCastListener = (outcome: PendingCastOutcome) => void;

interface PendingCastEntry {
  openDraft?: (modelId: number) => void;
}

export interface PendingCastHandle {
  /** The result was already reported inside the still-open Casting surface. */
  finishInForeground: () => void;
  succeedInBackground: (modelId: number) => void;
  failInBackground: (message: string) => void;
}

const pending = new Map<number, PendingCastEntry>();
const listeners = new Set<PendingCastListener>();
let nextId = 1;

function take(id: number): PendingCastEntry | null {
  const entry = pending.get(id);
  if (!entry) return null;
  pending.delete(id);
  return entry;
}

function publish(outcome: PendingCastOutcome): void {
  listeners.forEach((listener) => listener(outcome));
}

export function beginPendingCast(openDraft?: (modelId: number) => void): PendingCastHandle {
  const id = nextId++;
  pending.set(id, { openDraft });

  return {
    finishInForeground: () => {
      take(id);
    },
    succeedInBackground: (modelId) => {
      const entry = take(id);
      if (!entry) return;
      publish({
        kind: 'success',
        modelId,
        openDraft: entry.openDraft ? () => entry.openDraft?.(modelId) : undefined,
      });
    },
    failInBackground: (message) => {
      if (!take(id)) return;
      publish({ kind: 'failure', message });
    },
  };
}

export function subscribePendingCastOutcomes(listener: PendingCastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test isolation for the module-level same-tab registry. */
export function resetPendingCastRegistryForTests(): void {
  pending.clear();
  listeners.clear();
  nextId = 1;
}
