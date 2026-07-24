/**
 * useLoadWardrobeModel — load a minted model into the Wardrobe.
 *
 * Wraps the gallery-selection flow that used to live in StudioLobby's
 * handleSelectModel: preload the image, enter wardrobe via
 * loadGalleryModel, then hydrate the casting stores in the background so
 * the Spec tab works if the user later switches to Casting.
 *
 * Two entry points:
 *  - loadMintedModel(model)  — from a gallery card (thumbnail known)
 *  - loadMintedModelById(id) — from a deep link (fetches the model first)
 */
import { useCallback } from 'react';
import { toast } from 'sonner';
import { isModelAvailableStatus, isModelMintedStatus } from '@shared/modelLifecycle';
import { trpc } from '@/lib/trpc';
import { useSessionReset } from './useSessionReset';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { buildHistoryFromAssets } from '@/features/casting/utils/buildHistoryFromAssets';
import type { MintedModel } from '../components/ModelGallery';

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to preload image'));
    img.src = url;
  });
}

type FullModel = {
  id: number;
  name: string | null;
  status?: string;
  masterPrompt: string | null;
  technicalSchema?: unknown;
  preferences?: unknown;
  assets?: Array<{ id: number; viewType: string; storageUrl: string }>;
  selectedAssets?: Array<{ id: number; viewType: string; storageUrl: string }>;
};

/** Hydrate casting generation + form stores from a fully fetched model */
function hydrateCastingStores(fullModel: FullModel) {
  const genStore = useCastingGenerationStore.getState();
  genStore.setCurrentModelId(fullModel.id);
  if (fullModel.masterPrompt) {
    genStore.setCurrentMasterPrompt(fullModel.masterPrompt);
  }
  if (fullModel.technicalSchema) {
    genStore.setCurrentTechnicalSchema(fullModel.technicalSchema as Record<string, unknown>);
  }
  const allAssets = (fullModel.assets || []) as Array<{ id: number; viewType: string; storageUrl: string }>;
  const { history, historyIndex, currentAssets: rebuilt } = buildHistoryFromAssets(
    allAssets,
    fullModel.selectedAssets,
  );
  if (rebuilt.length > 0) {
    genStore.setCurrentAssets(rebuilt);
    genStore.setHistory(history);
    genStore.setHistoryIndex(historyIndex);
    useCastingGenerationStore.setState({ historyAmendments: history.map(() => []) });
  }
  if (fullModel.preferences) {
    const formStore = useCastingFormStore.getState();
    formStore.setPrefs(fullModel.preferences as any);
    formStore.setModelName(fullModel.name || '');
  }
}

export function useLoadWardrobeModel() {
  const utils = trpc.useUtils();
  const { loadGalleryModel } = useSessionReset();

  /** Gallery card path — instant entry, background casting hydration.
   *  Minted state is the row's STATUS truth (Batch B) — the gallery being
   *  a minted surface is a query filter, not the read model. Review
   *  correction 5: availability is REQUIRED before loading — an unknown
   *  status must refuse, not fall through as an "unminted" editable load. */
  const loadMintedModel = useCallback(async (model: MintedModel) => {
    if (!isModelAvailableStatus(model.status)) {
      toast.error('This model is unavailable.');
      return;
    }
    await preloadImage(model.thumbnailUrl);
    loadGalleryModel(model.id, model.thumbnailUrl, model.masterPrompt, isModelMintedStatus(model.status));

    utils.models.get.fetch({ modelId: model.id }).then((fullModel) => {
      hydrateCastingStores(fullModel as FullModel);
    }).catch(() => {
      // Non-critical — casting store hydration is best-effort
    });
  }, [loadGalleryModel, utils]);

  /**
   * Deep-link path — fetch first, then enter wardrobe with the best
   * available full-body image. Returns false when the model has no
   * usable asset (caller falls back to the wardrobe-start screen).
   */
  const loadMintedModelById = useCallback(async (modelId: number): Promise<boolean> => {
    const model = (await utils.models.get.fetch({ modelId })) as FullModel;
    // Review correction 5: unknown/unrecognized status is unavailable —
    // return false so the caller falls back to the start screen instead of
    // loading the row as an editable not-minted model.
    if (!isModelAvailableStatus(model.status)) return false;
    const assets = model.selectedAssets ?? model.assets ?? [];
    const image =
      assets.find((a) => a.viewType === 'frontFull') ??
      assets.find((a) => a.viewType === 'frontClose') ??
      assets[0];
    if (!image) return false;

    await preloadImage(image.storageUrl).catch(() => {});
    loadGalleryModel(model.id, image.storageUrl, model.masterPrompt || '', isModelMintedStatus(model.status));
    hydrateCastingStores(model);
    return true;
  }, [loadGalleryModel, utils]);

  return { loadMintedModel, loadMintedModelById };
}
