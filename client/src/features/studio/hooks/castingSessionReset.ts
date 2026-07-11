/**
 * The fresh-casting-session reset — extracted from useStudioEntry's
 * `?tool=casting&new=1` branch so /studio entry and the board's
 * CastingTakeover (D-35) share one reset contract.
 */
import { useStudioStore } from '../stores/useStudioStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useWardrobeStore } from '@/features/wardrobe/stores/useWardrobeStore';

export function resetCastingSession() {
  useCastingGenerationStore.getState().resetGeneration();
  useCastingFormStore.getState().resetForm();
  useWardrobeStore.getState().resetWardrobe();
  useStudioStore.getState().setCanvas({
    castModelId: null,
    castFullBodyUrl: null,
    castMasterPrompt: null,
    hasModel: false,
    hasFullBody: false,
    hasAllViews: false,
    modelSource: null,
    uploadedModelUrl: null,
    isMinted: false,
  });
}
