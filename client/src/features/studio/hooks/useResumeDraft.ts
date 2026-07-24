/**
 * useResumeDraft — resume a draft casting model from a deep link.
 *
 * Extracted from DrapeStudio's onResumeDraft handler; unlike the old
 * lobby path (which had the draft row in hand and switched instantly),
 * the deep-link path fetches the full model first, so the canvas and
 * generation history are hydrated in one pass with real asset data.
 */
import { useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useStudioStore } from '../stores/useStudioStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { useWardrobeStore } from '@/features/wardrobe/stores/useWardrobeStore';
import { buildHistoryFromAssets } from '@/features/casting/utils/buildHistoryFromAssets';
import { CANONICAL_VIEW_ANGLES } from '@shared/boardTypes';
import { isModelAvailableStatus, isModelMintedStatus } from '@shared/modelLifecycle';

export function useResumeDraft() {
  const utils = trpc.useUtils();
  const setCanvas = useStudioStore((s) => s.setCanvas);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);

  const resumeDraftById = useCallback(async (modelId: number) => {
    const model = await utils.models.get.fetch({ modelId });

    // Review correction 5: availability is REQUIRED before restoring — an
    // unknown/unrecognized status must refuse (the caller's catch shows
    // "Could not load that model"), never restore as an editable draft.
    // (Archived already 404s in models.get, FR-4.)
    if (!isModelAvailableStatus(model.status)) {
      throw new Error('Model unavailable');
    }

    // Reset stores first
    useCastingGenerationStore.getState().resetGeneration();
    useCastingUIStore.getState().resetUI();
    useWardrobeStore.getState().resetWardrobe();

    // Restore casting generation state from the model
    const genStore = useCastingGenerationStore.getState();
    genStore.setCurrentModelId(model.id);
    genStore.setCurrentMasterPrompt(model.masterPrompt || '');
    if (model.technicalSchema) {
      genStore.setCurrentTechnicalSchema(model.technicalSchema as Record<string, unknown>);
    }

    // Restore form preferences if available
    if (model.preferences) {
      const formStore = useCastingFormStore.getState();
      formStore.setPrefs(model.preferences as any);
      formStore.setModelName(model.name || '');
    }

    // Rebuild generation history from the model's assets
    const assets = (model.assets || []) as Array<{ id: number; viewType: string; storageUrl: string }>;
    const selectedAssets = (
      'selectedAssets' in model && Array.isArray(model.selectedAssets)
        ? model.selectedAssets
        : undefined
    ) as Array<{ id: number; viewType: string; storageUrl: string }> | undefined;
    const { history, historyIndex, currentAssets: rebuilt } = buildHistoryFromAssets(
      assets,
      selectedAssets,
    );
    if (rebuilt.length > 0) {
      genStore.setCurrentAssets(rebuilt);
      genStore.setHistory(history);
      genStore.setHistoryIndex(historyIndex);
      useCastingGenerationStore.setState({ historyAmendments: history.map(() => []) });
    }

    const current = selectedAssets ?? assets;
    const headshot = current.find((a) => a.viewType === 'frontClose');
    const fullBody = current.find((a) => a.viewType === 'frontFull');
    // Batch B: minted is the shared status read model — legacy 'locked'
    // restores as minted, never as an editable draft. (Archived can't reach
    // here: models.get reads it as deleted, FR-4.)
    const isMinted = isModelMintedStatus(model.status);

    setCanvas({
      castModelId: model.id,
      castFullBodyUrl: fullBody?.storageUrl || null,
      castMasterPrompt: model.masterPrompt || null,
      hasModel: !!headshot,
      hasFullBody: !!fullBody,
      // Audit V4: "all views" is the D-39 canonical six, not the era-0 trio
      hasAllViews: CANONICAL_VIEW_ANGLES.every((vt) =>
        current.some((a) => a.viewType === vt && a.storageUrl),
      ),
      modelSource: 'cast',
      uploadedModelUrl: null,
      isMinted,
    });

    setActiveTool('casting');
    return model;
  }, [utils, setCanvas, setActiveTool]);

  return { resumeDraftById };
}
