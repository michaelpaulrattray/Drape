/**
 * Same-tab adapter for casting work that can outlive the Casting surface.
 *
 * Durable operations own progress, settlement, landing, charges and refunds.
 * This optional adapter exists only for immediate same-tab feedback and to
 * correlate a local request with the durable receipt that supersedes it.
 */
import type { CanonicalViewAngle } from '@shared/boardTypes';

export type CastingOperationKind = 'newCast' | 'iterate' | 'addViews' | 'mint' | 'refresh';

export interface CastingOperationOrigin {
  boardId: number;
  itemId: number;
}

export interface CastingOperation {
  id: number;
  kind: CastingOperationKind;
  modelId: number | null;
  origin: CastingOperationOrigin | null;
  angles: CanonicalViewAngle[];
  clientRequestIds: string[];
  startedAt: number;
}

export type CastingOperationOutcome =
  | {
      status: 'success';
      modelId: number;
      /** True only when the originating Casting session had already closed. */
      background: boolean;
    }
  | {
      status: 'failure';
      message: string;
      background: boolean;
      /** Add Views already owns its refund-honest failure notices. */
      notifyFailure: boolean;
    };

export type CastingOperationEvent =
  | { phase: 'begin' | 'update'; operation: CastingOperation }
  | { phase: 'settle'; operation: CastingOperation; outcome: CastingOperationOutcome };

interface CastingOperationEntry {
  operation: CastingOperation;
}

export interface CastingOperationHandle {
  id: number;
  origin: CastingOperationOrigin | null;
  setModelId: (modelId: number) => void;
  succeed: (input: {
    modelId: number;
    background: boolean;
  }) => void;
  fail: (input: {
    message: string;
    background: boolean;
    notifyFailure?: boolean;
  }) => void;
}

type CastingOperationListener = (event: CastingOperationEvent) => void;
type OriginProvider = () => CastingOperationOrigin | null;

const active = new Map<number, CastingOperationEntry>();
const listeners = new Set<CastingOperationListener>();
let originProvider: OriginProvider | null = null;
let nextId = 1;

function snapshot(operation: CastingOperation): CastingOperation {
  return {
    ...operation,
    origin: operation.origin ? { ...operation.origin } : null,
    angles: [...operation.angles],
    clientRequestIds: [...operation.clientRequestIds],
  };
}

function publish(event: CastingOperationEvent): void {
  listeners.forEach((listener) => listener(event));
}

function take(id: number): CastingOperationEntry | null {
  const entry = active.get(id);
  if (!entry) return null;
  active.delete(id);
  return entry;
}

export function registerCastingOperationOriginProvider(provider: OriginProvider): () => void {
  originProvider = provider;
  return () => {
    if (originProvider === provider) originProvider = null;
  };
}

export function beginCastingOperation(input: {
  kind: CastingOperationKind;
  modelId?: number | null;
  angles: CanonicalViewAngle[];
  clientRequestIds: string[];
  origin?: CastingOperationOrigin | null;
}): CastingOperationHandle {
  const id = nextId++;
  const entry: CastingOperationEntry = {
    operation: {
      id,
      kind: input.kind,
      modelId: input.modelId ?? null,
      origin: input.origin === undefined ? originProvider?.() ?? null : input.origin,
      angles: [...input.angles],
      clientRequestIds: [...input.clientRequestIds],
      startedAt: Date.now(),
    },
  };
  active.set(id, entry);
  publish({ phase: 'begin', operation: snapshot(entry.operation) });

  const settle = (outcome: CastingOperationOutcome) => {
    const settled = take(id);
    if (!settled) return;
    publish({ phase: 'settle', operation: snapshot(settled.operation), outcome });
  };

  return {
    id,
    origin: entry.operation.origin ? { ...entry.operation.origin } : null,
    setModelId: (modelId) => {
      const current = active.get(id);
      if (!current || current.operation.modelId === modelId) return;
      current.operation.modelId = modelId;
      publish({ phase: 'update', operation: snapshot(current.operation) });
    },
    succeed: ({ modelId, background }) => {
      const current = active.get(id);
      if (!current) return;
      current.operation.modelId = modelId;
      settle({
        status: 'success',
        modelId,
        background,
      });
    },
    fail: ({ message, background, notifyFailure = true }) => {
      settle({ status: 'failure', message, background, notifyFailure });
    },
  };
}

export function subscribeCastingOperations(listener: CastingOperationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveCastingOperations(modelId?: number | null): CastingOperation[] {
  return Array.from(active.values())
    .map((entry) => snapshot(entry.operation))
    .filter((operation) => modelId === undefined || operation.modelId === modelId);
}

export function remapCastingOperationOriginItem(fromItemId: number, toItemId: number): void {
  for (const entry of Array.from(active.values())) {
    if (entry.operation.origin?.itemId !== fromItemId) continue;
    entry.operation.origin = { ...entry.operation.origin, itemId: toItemId };
    publish({ phase: 'update', operation: snapshot(entry.operation) });
  }
}

/** Test isolation. The W5 name stays as a compatibility seam for existing tests. */
export function resetPendingCastRegistryForTests(): void {
  active.clear();
  listeners.clear();
  originProvider = null;
  nextId = 1;
}
