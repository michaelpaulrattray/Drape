/**
 * Same-tab owner for casting work that can outlive the Casting surface.
 *
 * Durable truth (assets, charges, refunds and model rows) stays on the
 * server. This registry owns only the presentation handoff: originating
 * node progress, per-angle busy state, exactly-once settlement and the one
 * background-new-cast notice introduced in W5-F.
 */
import type { CanonicalViewAngle } from '@shared/boardTypes';
import { useCastingRefreshStore } from './stores/useCastingRefreshStore';

export type CastingOperationKind = 'newCast' | 'iterate' | 'addViews';

export interface CastingOperationOrigin {
  boardId: number;
  itemId: number;
}

export interface CastingOperationAsset {
  angle: CanonicalViewAngle;
  assetId: number;
  url: string;
}

export interface CastingOperation {
  id: number;
  kind: CastingOperationKind;
  modelId: number | null;
  origin: CastingOperationOrigin | null;
  angles: CanonicalViewAngle[];
  startedAt: number;
}

export type CastingOperationOutcome =
  | {
      status: 'success';
      modelId: number;
      assets: CastingOperationAsset[];
      name: string | null;
      /** True only when the originating Casting session had already closed. */
      background: boolean;
      openDraft?: (landed: boolean) => void;
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
  openDraft?: (modelId: number, landed: boolean) => void;
  refreshStarted: boolean;
}

export interface CastingOperationHandle {
  id: number;
  setModelId: (modelId: number) => void;
  succeed: (input: {
    modelId: number;
    assets?: CastingOperationAsset[];
    name?: string | null;
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
  };
}

function publish(event: CastingOperationEvent): void {
  listeners.forEach((listener) => listener(event));
}

function beginRefresh(entry: CastingOperationEntry): void {
  const { modelId, angles } = entry.operation;
  if (entry.refreshStarted || modelId === null || angles.length === 0) return;
  useCastingRefreshStore.getState().begin(modelId, angles);
  entry.refreshStarted = true;
}

function endRefresh(entry: CastingOperationEntry): void {
  const { modelId, angles } = entry.operation;
  if (!entry.refreshStarted || modelId === null || angles.length === 0) return;
  useCastingRefreshStore.getState().end(modelId, angles);
  entry.refreshStarted = false;
}

function take(id: number): CastingOperationEntry | null {
  const entry = active.get(id);
  if (!entry) return null;
  active.delete(id);
  endRefresh(entry);
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
  origin?: CastingOperationOrigin | null;
  openDraft?: (modelId: number, landed: boolean) => void;
}): CastingOperationHandle {
  const id = nextId++;
  const entry: CastingOperationEntry = {
    operation: {
      id,
      kind: input.kind,
      modelId: input.modelId ?? null,
      origin: input.origin === undefined ? originProvider?.() ?? null : input.origin,
      angles: [...input.angles],
      startedAt: Date.now(),
    },
    openDraft: input.openDraft,
    refreshStarted: false,
  };
  active.set(id, entry);
  beginRefresh(entry);
  publish({ phase: 'begin', operation: snapshot(entry.operation) });

  const settle = (outcome: CastingOperationOutcome) => {
    const settled = take(id);
    if (!settled) return;
    publish({ phase: 'settle', operation: snapshot(settled.operation), outcome });
  };

  return {
    id,
    setModelId: (modelId) => {
      const current = active.get(id);
      if (!current || current.operation.modelId === modelId) return;
      current.operation.modelId = modelId;
      beginRefresh(current);
      publish({ phase: 'update', operation: snapshot(current.operation) });
    },
    succeed: ({ modelId, assets = [], name = null, background }) => {
      const current = active.get(id);
      if (!current) return;
      current.operation.modelId = modelId;
      settle({
        status: 'success',
        modelId,
        assets,
        name,
        background,
        openDraft: current.openDraft
          ? (landed) => current.openDraft?.(modelId, landed)
          : undefined,
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
  for (const entry of Array.from(active.values())) endRefresh(entry);
  active.clear();
  listeners.clear();
  originProvider = null;
  nextId = 1;
}
