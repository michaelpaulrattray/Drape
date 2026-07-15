/**
 * useSessionReset — Centralized session cleanup across all studio stores.
 *
 * Every model-change or navigation action that should "start fresh"
 * goes through this hook so wardrobe, casting, and studio state
 * are always cleaned up together. No store is left with stale data.
 *
 * Scenarios handled:
 *  - Home button (any active session → lobby)
 *  - Loading a new model from upload (clears old wardrobe session)
 *  - Loading a new model from gallery (clears old wardrobe session)
 *  - Resuming a saved wardrobe session from the DB
 */
import { useCallback } from 'react';
import { isModelAvailableStatus, isModelMintedStatus } from '@shared/modelLifecycle';
import { useStudioStore } from '../stores/useStudioStore';
import { useWardrobeStore } from '@/features/wardrobe/stores/useWardrobeStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { persistSession, clearPersistedSession } from './useSessionPersistence';
import type { StudioTool } from '../types';

export function useSessionReset() {
  const resetStudio = useStudioStore((s) => s.resetStudio);
  const clearUploadedModel = useStudioStore((s) => s.clearUploadedModel);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const loadModelFromUpload = useStudioStore((s) => s.loadModelFromUpload);
  const loadModelFromCast = useStudioStore((s) => s.loadModelFromCast);
  const resetWardrobe = useWardrobeStore((s) => s.resetWardrobe);
  const resetCasting = useCastingGenerationStore((s) => s.resetGeneration);
  const resetCastingForm = useCastingFormStore((s) => s.resetForm);

  /**
   * Full reset — clears everything and returns to lobby.
   * Used by: Home button, "Start Over" actions.
   */
  const resetToLobby = useCallback(() => {
    resetWardrobe();
    resetCasting();
    resetCastingForm();
    resetStudio();
  }, [resetWardrobe, resetCasting, resetCastingForm, resetStudio]);

  /**
   * Switch tool with reset — clears model + wardrobe, then navigates
   * directly to the target tool (no lobby flash).
   * Used by: "Switch & Reset" confirmation dialog.
   */
  const resetAndSwitchTo = useCallback((tool: StudioTool) => {
    resetWardrobe();
    clearUploadedModel(); // resets canvas to defaults
    // Zustand sets are synchronous and React batches the re-render, so the
    // intermediate activeTool=null state never paints (and never trips the
    // null-tool redirect back to /app).
    setActiveTool(tool);
  }, [resetWardrobe, clearUploadedModel, setActiveTool]);

  /**
   * Load a new uploaded model — clears old wardrobe + casting state first.
   * Used by: WardrobeStart upload flow.
   */
  const loadUploadedModel = useCallback((imageUrl: string) => {
    resetWardrobe();
    resetCasting();
    resetCastingForm();
    loadModelFromUpload(imageUrl);
  }, [resetWardrobe, resetCasting, resetCastingForm, loadModelFromUpload]);

  /**
   * Load a gallery cast model — clears old wardrobe + casting state first.
   * Used by: WardrobeStart "My Models" gallery (via useLoadWardrobeModel).
   * `minted` comes from the model's server status via the shared read model
   * (Batch B) — the gallery being a "minted" surface proves nothing.
   */
  const loadGalleryModel = useCallback((
    modelId: number,
    fullBodyUrl: string,
    masterPrompt: string,
    minted: boolean,
  ) => {
    resetWardrobe();
    resetCasting();
    resetCastingForm();
    loadModelFromCast(modelId, fullBodyUrl, masterPrompt, minted);
  }, [resetWardrobe, resetCasting, resetCastingForm, loadModelFromCast]);

  /**
   * Resume a wardrobe session from the DB — restores canvas, wardrobe
   * VTO history, garment selection, and session ID.
   * Used by: useStudioEntry (wardrobe deep links from the /app lobby).
   */
  const resumeWardrobeSession = useCallback((session: {
    sessionId: number;
    modelId: number | null;
    modelName: string | null;
    /** Server status truth for the linked model; null when the model row is
     *  gone (hard-deleted draft) or the session has no cast link. */
    modelStatus?: string | null;
    masterPrompt: string | null;
    modelImageUrl: string;
    history: string[];
    historyIndex: number;
    activeGarmentIds: number[];
    tattooMapData?: unknown;
    styleNotes?: Record<string, string> | null;
  }) => {
    // Clear ALL stale state — wardrobe + casting + form
    resetWardrobe();
    resetCasting();
    resetCastingForm();

    // Set canvas state from STATUS truth (Batch B): a draft resumes as a
    // draft, legacy 'locked' resumes as minted, and an archived or missing
    // source model resumes as session imagery only (the model link is
    // unavailable — never an editable-draft or minted fallback).
    const sourceAvailable =
      session.modelId != null && isModelAvailableStatus(session.modelStatus);
    if (session.modelId && sourceAvailable) {
      loadModelFromCast(
        session.modelId,
        session.modelImageUrl,
        session.masterPrompt || '',
        isModelMintedStatus(session.modelStatus),
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

    // Persist to localStorage so refresh works immediately — status truth,
    // and only when the cast link actually resumed. When the link DEGRADED
    // (archived/deleted/unavailable source), actively CLEAR the persisted
    // entry (review correction 3): a stale drape_active_session from an
    // earlier run would otherwise keep pointing at the dead model on every
    // future mount.
    if (session.modelId && sourceAvailable) {
      persistSession(session.modelId, 'wardrobe', isModelMintedStatus(session.modelStatus));
    } else if (session.modelId) {
      clearPersistedSession();
    }
  }, [resetWardrobe, resetCasting, loadModelFromCast, loadModelFromUpload]);

  return {
    resetToLobby,
    resetAndSwitchTo,
    loadUploadedModel,
    loadGalleryModel,
    resumeWardrobeSession,
  };
}
