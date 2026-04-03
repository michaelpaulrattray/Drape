/**
 * useSessionPersistence — Saves and restores the active casting/wardrobe
 * session to localStorage so users can resume after refresh or crash.
 *
 * Stores: modelId, activeTool, isMinted.
 * On load: fetches model + assets from DB and restores canvas + generation state.
 */
import { useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useStudioStore } from '../stores/useStudioStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import type { ActiveTool } from '../types';
import type { GeneratedAsset } from '@/features/casting/constants';
import { buildHistoryFromAssets } from '@/features/casting/utils/buildHistoryFromAssets';

const STORAGE_KEY = 'drape_active_session';

interface PersistedSession {
  modelId: number;
  activeTool: ActiveTool;
  isMinted: boolean;
  timestamp: number;
}

/** Save the current session to localStorage */
export function persistSession(modelId: number, activeTool: ActiveTool, isMinted: boolean) {
  try {
    const session: PersistedSession = { modelId, activeTool, isMinted, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage may be full or unavailable — silently ignore
  }
}

/** Clear the persisted session */
export function clearPersistedSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}

/** Read the persisted session without side effects */
function readPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as PersistedSession;
    // Expire sessions older than 24 hours
    if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Hook that restores a persisted session on mount.
 * Must be called inside DrapeStudio after auth is confirmed.
 */
export function useSessionRestore(isAuthenticated: boolean) {
  const setCanvas = useStudioStore((s) => s.setCanvas);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const canvas = useStudioStore((s) => s.canvas);
  const hasRestored = useRef(false);

  const modelQuery = trpc.models.get.useQuery(
    { modelId: readPersistedSession()?.modelId ?? 0 },
    {
      enabled: isAuthenticated && !hasRestored.current && readPersistedSession() !== null,
      retry: false,
    }
  );

  useEffect(() => {
    if (hasRestored.current) return;
    if (!isAuthenticated) return;
    if (!modelQuery.data) return;

    const session = readPersistedSession();
    if (!session) return;

    hasRestored.current = true;

    const model = modelQuery.data;
    const isMinted = model.status === 'active';

    // Restore canvas state
    const headshot = model.assets?.find((a: { viewType: string }) => a.viewType === 'frontClose');
    const fullBody = model.assets?.find((a: { viewType: string }) => a.viewType === 'frontFull');
    const sideView = model.assets?.find((a: { viewType: string }) => a.viewType === 'sideClose');

    setCanvas({
      hasModel: !!headshot,
      hasFullBody: !!fullBody,
      hasAllViews: !!(headshot && fullBody && sideView),
      modelSource: 'cast',
      uploadedModelUrl: null,
      castModelId: isMinted ? model.id : null,
      castMasterPrompt: model.masterPrompt || null,
      castFullBodyUrl: fullBody?.storageUrl || null,
      isMinted,
    });

    // Restore generation store assets with full history reconstruction
    const allAssets = (model.assets || []) as Array<{ id: number; viewType: string; storageUrl: string }>;
    const { history, historyIndex, currentAssets: rebuilt } = buildHistoryFromAssets(allAssets);

    if (rebuilt.length > 0) {
      const genStore = useCastingGenerationStore.getState();
      genStore.setCurrentModelId(model.id);
      genStore.setCurrentAssets(rebuilt);
      genStore.setHistory(history);
      genStore.setHistoryIndex(historyIndex);
      useCastingGenerationStore.setState({ historyAmendments: history.map(() => []) });
      // Fix #2: hydrate masterPrompt so MasterPromptPanel shows data after restore
      if (model.masterPrompt) {
        genStore.setCurrentMasterPrompt(model.masterPrompt);
      }
      // Restore technicalSchema so Spec tab is populated after refresh
      if (model.technicalSchema) {
        genStore.setCurrentTechnicalSchema(model.technicalSchema as Record<string, unknown>);
      }
      // Restore form preferences so ControlPanel shows actual model settings
      if (model.preferences) {
        const formStore = useCastingFormStore.getState();
        formStore.setPrefs(model.preferences as any);
        formStore.setModelName(model.name || '');
      }
    }

    // Do NOT restore activeTool — user should always land in lobby
    // and choose to resume from the Recent Sessions list.
  }, [isAuthenticated, modelQuery.data, setCanvas, setActiveTool]);

  return { isRestoring: modelQuery.isLoading && readPersistedSession() !== null };
}

/**
 * Hook that auto-persists session changes to localStorage.
 * Call in DrapeStudio — it watches modelId, activeTool, and isMinted.
 */
export function useSessionAutoSave() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const canvas = useStudioStore((s) => s.canvas);
  const currentModelId = useCastingGenerationStore((s) => s.currentModelId);

  useEffect(() => {
    if (currentModelId && activeTool) {
      persistSession(currentModelId, activeTool, canvas.isMinted);
    }
  }, [currentModelId, activeTool, canvas.isMinted]);
}
