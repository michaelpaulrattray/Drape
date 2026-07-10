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

export function useResumeDraft() {
  const utils = trpc.useUtils();
  const setCanvas = useStudioStore((s) => s.setCanvas);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);

  const resumeDraftById = useCallback(async (modelId: number) => {
    const model = await utils.models.get.fetch({ modelId });

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
    const { history, historyIndex, currentAssets: rebuilt } = buildHistoryFromAssets(assets);
    if (rebuilt.length > 0) {
      genStore.setCurrentAssets(rebuilt);
      genStore.setHistory(history);
      genStore.setHistoryIndex(historyIndex);
      useCastingGenerationStore.setState({ historyAmendments: history.map(() => []) });
    }

    const headshot = assets.find((a) => a.viewType === 'frontClose');
    const fullBody = assets.find((a) => a.viewType === 'frontFull');
    const sideView = assets.find((a) => a.viewType === 'sideClose');
    const isMinted = model.status === 'active';

    setCanvas({
      castModelId: model.id,
      castFullBodyUrl: fullBody?.storageUrl || null,
      castMasterPrompt: model.masterPrompt || null,
      hasModel: !!headshot,
      hasFullBody: !!fullBody,
      hasAllViews: !!(fullBody && sideView),
      modelSource: 'cast',
      uploadedModelUrl: null,
      isMinted,
    });

    setActiveTool('casting');
    return model;
  }, [utils, setCanvas, setActiveTool]);

  return { resumeDraftById };
}
