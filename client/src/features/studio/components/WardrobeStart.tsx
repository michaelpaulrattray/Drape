/**
 * WardrobeStart — shown when Wardrobe is entered with nothing to resume.
 *
 * Pick a minted model or upload a full-body photo; either path enters
 * the wardrobe workspace via the existing store loaders. Rendered by
 * DrapeStudio when activeTool is null and wardrobeStart is set.
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { ModelGallery, type MintedModel } from './ModelGallery';
import { ModelUploadZone } from './ModelUploadZone';
import { useLoadWardrobeModel } from '../hooks/useLoadWardrobeModel';

export function WardrobeStart() {
  const utils = trpc.useUtils();
  const { loadMintedModel } = useLoadWardrobeModel();

  const { data: models, isLoading } = trpc.wardrobe.model.listMinted.useQuery(
    undefined,
    { staleTime: 30_000 },
  );

  const [loadingModelId, setLoadingModelId] = useState<number | null>(null);
  const [deletingModelId, setDeletingModelId] = useState<number | null>(null);

  const deleteModelMutation = trpc.models.delete.useMutation({
    onError: (err) => {
      toast.error(err.message || 'Failed to delete model');
      setDeletingModelId(null);
    },
    onSuccess: () => {
      toast.success('Model deleted');
      setDeletingModelId(null);
    },
    onSettled: () => {
      utils.wardrobe.model.listMinted.invalidate();
      utils.lobby.recentWork.invalidate();
    },
  });

  const handleSelectModel = useCallback(async (model: MintedModel) => {
    if (loadingModelId) return;
    try {
      setLoadingModelId(model.id);
      await loadMintedModel(model);
      toast.success(`${model.name || 'Model'} loaded — Wardrobe ready`);
    } catch {
      toast.error('Failed to load model');
    } finally {
      setLoadingModelId(null);
    }
  }, [loadingModelId, loadMintedModel]);

  const handleDeleteModel = useCallback((modelId: number) => {
    setDeletingModelId(modelId);
    deleteModelMutation.mutate({ modelId });
  }, [deleteModelMutation]);

  // Entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (isLoading) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full px-6" style={{ maxWidth: 960 }}>
          <div className="flex flex-col items-center gap-3 mb-10">
            <div className="rounded-lg animate-pulse" style={{ width: 260, height: 28, background: 'rgba(0,0,0,0.05)' }} />
            <div className="rounded-lg animate-pulse" style={{ width: 340, height: 14, background: 'rgba(0,0,0,0.03)' }} />
          </div>
          <div className="rounded-2xl animate-pulse" style={{ height: 240, background: 'rgba(0,0,0,0.03)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 overflow-y-auto">
      <div
        className="w-full flex flex-col items-center"
        style={{
          maxWidth: 960,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Title */}
        <div className="text-center mb-8 sm:mb-10">
          <h1
            style={{
              fontSize: 'clamp(22px, 4vw, 32px)',
              fontWeight: 700,
              color: '#1a1a1a',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Pick a model to{' '}
            <span className="font-heading italic" style={{ fontWeight: 400 }}>dress</span>
          </h1>
          <p style={{ fontSize: 15, color: '#52524B', marginTop: 8, maxWidth: 400, lineHeight: 1.5 }}>
            Choose one of your models or upload a full-body photo to start styling.
          </p>
        </div>

        {/* My Models gallery — hidden when the user has none */}
        <div className="w-full mb-8">
          <ModelGallery
            models={(models as MintedModel[]) ?? []}
            onSelectModel={handleSelectModel}
            onDeleteModel={handleDeleteModel}
            deletingModelId={deletingModelId}
          />
        </div>

        {/* Upload */}
        <div className="w-full" style={{ maxWidth: 560 }}>
          <ModelUploadZone />
        </div>
      </div>
    </div>
  );
}
