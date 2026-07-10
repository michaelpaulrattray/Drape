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
  masterPrompt: string | null;
  technicalSchema?: unknown;
  preferences?: unknown;
  assets?: Array<{ id: number; viewType: string; storageUrl: string }>;
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
  const { history, historyIndex, currentAssets: rebuilt } = buildHistoryFromAssets(allAssets);
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

  /** Gallery card path — instant entry, background casting hydration */
  const loadMintedModel = useCallback(async (model: MintedModel) => {
    await preloadImage(model.thumbnailUrl);
    loadGalleryModel(model.id, model.thumbnailUrl, model.masterPrompt);

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
    const assets = model.assets || [];
    const image =
      assets.find((a) => a.viewType === 'frontFull') ??
      assets.find((a) => a.viewType === 'frontClose') ??
      assets[0];
    if (!image) return false;

    await preloadImage(image.storageUrl).catch(() => {});
    loadGalleryModel(model.id, image.storageUrl, model.masterPrompt || '');
    hydrateCastingStores(model);
    return true;
  }, [loadGalleryModel, utils]);

  return { loadMintedModel, loadMintedModelById };
}
