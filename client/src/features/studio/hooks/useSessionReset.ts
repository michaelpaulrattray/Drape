/**
 * useSessionReset — Centralized session cleanup across all studio stores.
 *
 * Every model-change or navigation action that should "start fresh"
 * goes through this hook so wardrobe, casting, and studio state
 * are always cleaned up together. No store is left with stale data.
 *
 * Scenarios handled:
 *  - "Switch & Reset" confirmation (uploaded/gallery model → casting)
 *  - Home button (any active session → lobby)
 *  - Loading a new model from upload (clears old wardrobe session)
 *  - Loading a new model from gallery (clears old wardrobe session)
 */
import { useCallback } from 'react';
import { useStudioStore } from '../stores/useStudioStore';
import { useWardrobeStore } from '@/features/wardrobe/stores/useWardrobeStore';
import { persistSession } from './useSessionPersistence';
import type { StudioTool } from '../types';

export function useSessionReset() {
  const resetStudio = useStudioStore((s) => s.resetStudio);
  const clearUploadedModel = useStudioStore((s) => s.clearUploadedModel);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const loadModelFromUpload = useStudioStore((s) => s.loadModelFromUpload);
  const loadModelFromCast = useStudioStore((s) => s.loadModelFromCast);
  const resetWardrobe = useWardrobeStore((s) => s.resetWardrobe);

  /**
   * Full reset — clears everything and returns to lobby.
   * Used by: Home button, "Start Over" actions.
   */
  const resetToLobby = useCallback(() => {
    resetWardrobe();
    resetStudio();
  }, [resetWardrobe, resetStudio]);

  /**
   * Switch tool with reset — clears model + wardrobe, then navigates
   * directly to the target tool (no lobby flash).
   * Used by: "Switch & Reset" confirmation dialog.
   */
  const resetAndSwitchTo = useCallback((tool: StudioTool) => {
    resetWardrobe();
    clearUploadedModel(); // resets canvas to defaults
    // Override the lobby redirect — go directly to the target tool.
    // setTimeout ensures the state update from clearUploadedModel settles first.
    setTimeout(() => setActiveTool(tool), 0);
  }, [resetWardrobe, clearUploadedModel, setActiveTool]);

  /**
   * Load a new uploaded model — clears old wardrobe session first.
   * Used by: StudioLobby upload flow.
   */
  const loadUploadedModel = useCallback((imageUrl: string) => {
    resetWardrobe();
    loadModelFromUpload(imageUrl);
  }, [resetWardrobe, loadModelFromUpload]);

  /**
   * Load a gallery cast model — clears old wardrobe session first.
   * Used by: StudioLobby "My Models" gallery.
   */
  const loadGalleryModel = useCallback((
    modelId: number,
    fullBodyUrl: string,
    masterPrompt: string,
  ) => {
    resetWardrobe();
    loadModelFromCast(modelId, fullBodyUrl, masterPrompt);
  }, [resetWardrobe, loadModelFromCast]);

  /**
   * Resume a wardrobe session from the DB — restores canvas, wardrobe
   * VTO history, garment selection, and session ID.
   * Used by: ContinueSessionCard in the lobby.
   */
  const resumeWardrobeSession = useCallback((session: {
    sessionId: number;
    modelId: number | null;
    modelName: string | null;
    masterPrompt: string | null;
    modelImageUrl: string;
    history: string[];
    historyIndex: number;
    activeGarmentIds: number[];
    tattooMapData?: unknown;
    styleNotes?: Record<string, string> | null;
  }) => {
    // Clear any stale state first
    resetWardrobe();

    // Set canvas state based on whether this is a cast or uploaded model.
    // Use modelId alone — masterPrompt may be null for older models.
    if (session.modelId) {
      loadModelFromCast(
        session.modelId,
        session.modelImageUrl,
        session.masterPrompt || '',
      );
    } else {
      loadModelFromUpload(session.modelImageUrl);
    }

    // Hydrate wardrobe store with DB session data
    const wardrobeStore = useWardrobeStore.getState();
    wardrobeStore.setActiveSessionId(session.sessionId);
    wardrobeStore.setSelection(session.activeGarmentIds);

    // Restore VTO history
    for (const url of session.history) {
      wardrobeStore.pushVTOResult(url);
    }

    // Restore tattoo map from DB (avoids redundant re-analysis)
    if (session.tattooMapData) {
      wardrobeStore.setTattooMap(
        session.tattooMapData as { hasTattoos: boolean; tattooAreas: string[]; cleanAreas: string[]; promptFragment: string },
      );
    }

    // Restore style notes (e.g. "roll up sleeves", "tuck in")
    if (session.styleNotes) {
      for (const [garmentId, note] of Object.entries(session.styleNotes)) {
        if (note) wardrobeStore.setStyleNote(Number(garmentId), note);
      }
    }

    // Persist to localStorage so refresh works immediately
    if (session.modelId) {
      persistSession(session.modelId, 'wardrobe', true);
    }
  }, [resetWardrobe, loadModelFromCast, loadModelFromUpload]);

  return {
    resetToLobby,
    resetAndSwitchTo,
    loadUploadedModel,
    loadGalleryModel,
    resumeWardrobeSession,
  };
}
