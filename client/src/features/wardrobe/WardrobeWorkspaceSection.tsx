/**
 * WardrobeWorkspaceSection — The wardrobe tool workspace layout.
 *
 * Extracted from DrapeStudio to keep the page file under the line limit.
 * Renders the rack panel, canvas with overlays, layers panel, and
 * decomposition drawer.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { triggerDownload } from '@/lib/triggerDownload';
import { toast } from 'sonner';
import { AnimatedPanel } from '@/features/studio/components/AnimatedPanel';
import { StudioSidePanel } from '@/features/studio/components/StudioSidePanel';
import { StudioCanvas } from '@/features/studio/components/StudioCanvas';
import { ToolButton } from '@/features/casting/components/ImageViewer';
import {
  RackPanel,
  LayersPanel,
  DecompositionDrawer,
  useWardrobeGeneration,
  useModelSetup,
  useWardrobeStore,
  WardrobeEmptyState,
  WardrobeImageOverlay,
  WardrobeShortcutsBar,
} from '@/features/wardrobe';

interface WardrobeWorkspaceSectionProps {
  modelImageUrl: string | null;
  modelId: number | null;
  leftReady: boolean;
  centerReady: boolean;
  rightReady: boolean;
}

export function WardrobeWorkspaceSection({
  modelImageUrl,
  modelId,
  leftReady,
  centerReady,
  rightReady,
}: WardrobeWorkspaceSectionProps) {
  const gen = useWardrobeGeneration({ modelImageUrl, modelId });
  useModelSetup(modelImageUrl);

  // Track hover state from StudioCanvas for auto-hiding overlays
  const [imageAreaHovered, setImageAreaHovered] = useState(false);

  // Flash effect state for "Shoot Look"
  const [showFlash, setShowFlash] = useState(false);

  // Brief checkmark animation state (shows for 1.5s after save, then reverts to camera)
  const [showCheckmark, setShowCheckmark] = useState(false);

  // Track saved URLs server-side to prevent duplicates across session resume
  const savedUrlsRef = useRef<Set<string>>(new Set());

  // Pre-populate saved URLs from existing looks on mount
  const { data: existingLooks } = trpc.wardrobe.looks.list.useQuery(
    { modelId: modelId! },
    { enabled: !!modelId }
  );

  useEffect(() => {
    if (existingLooks && existingLooks.length > 0) {
      const urls = new Set(existingLooks.map((l: { imageUrl: string }) => l.imageUrl));
      savedUrlsRef.current = urls;
    }
  }, [existingLooks]);

  const isAlreadySaved = gen.currentResult !== null && savedUrlsRef.current.has(gen.currentResult);

  const resultOverlayItems = useWardrobeStore((s) => s.resultOverlayItems);
  const selectedGarmentIds = useWardrobeStore((s) => s.selectedGarmentIds);
  const selectedCount = useWardrobeStore((s) => s.selectedGarmentIds.size);
  const isDecomposeOpen = useWardrobeStore((s) => s.isDecomposeOpen);
  const setDecomposeOpen = useWardrobeStore((s) => s.setDecomposeOpen);
  const { data: garments = [] } = trpc.wardrobe.garments.list.useQuery();

  const hasResult = gen.currentResult !== null;
  const canGenerate =
    selectedCount > 0 && !!modelImageUrl && !gen.isGenerating && gen.cooldownSeconds <= 0 && !gen.hasProcessingSelected;

  const handleStyleNote = useCallback(
    (note: { garmentLabel: string; category: string; instruction: string }) => {
      const selectedArr = Array.from(selectedGarmentIds);
      const categoryGarments = garments.filter(
        (g) => selectedArr.includes(g.id) && g.slotType === note.category
      );

      if (categoryGarments.length === 0) {
        const fallbackId = selectedArr[0];
        if (!fallbackId) return;
        const fallbackNote = useWardrobeStore.getState().styleNotes[String(fallbackId)] || '';
        const updatedFallback = fallbackNote ? `${fallbackNote}; ${note.instruction}` : note.instruction;
        useWardrobeStore.getState().setStyleNote(fallbackId, updatedFallback);
        gen.refineResult(fallbackId, note.instruction);
        return;
      }

      let bestMatch = categoryGarments[0];
      if (categoryGarments.length > 1) {
        const overlayWords = note.garmentLabel
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2);
        let bestScore = -1;
        for (const g of categoryGarments) {
          const haystack = `${g.shortName || ''} ${g.description || ''}`.toLowerCase();
          const score = overlayWords.filter((w) => haystack.includes(w)).length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = g;
          }
        }
      }

      const currentNote = useWardrobeStore.getState().styleNotes[String(bestMatch.id)] || '';
      const updatedNote = currentNote ? `${currentNote}; ${note.instruction}` : note.instruction;
      useWardrobeStore.getState().setStyleNote(bestMatch.id, updatedNote);
      gen.refineResult(bestMatch.id, note.instruction);
    },
    [gen, garments, selectedGarmentIds]
  );

  // Save current VTO result as a curated look
  const saveLookMutation = trpc.wardrobe.looks.save.useMutation();
  const utils = trpc.useUtils();
  const isSavingLook = saveLookMutation.isPending;
  const lastSavedUrlRef = useRef<string | null>(null);

  const handleSaveLook = useCallback(async () => {
    const imageUrl = gen.currentResult;
    if (!imageUrl || !modelId) return;
    if (savedUrlsRef.current.has(imageUrl) || lastSavedUrlRef.current === imageUrl) {
      toast.info('This look is already saved');
      return;
    }
    try {
      // Trigger flash effect
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 300);

      // Show brief checkmark then revert to camera
      setShowCheckmark(true);
      setTimeout(() => setShowCheckmark(false), 1500);

      const garmentIds = Array.from(selectedGarmentIds);
      const sessionId = useWardrobeStore.getState().activeSessionId;
      await saveLookMutation.mutateAsync({
        modelId,
        imageUrl,
        garmentIds,
        ...(sessionId ? { sessionId } : {}),
      });
      lastSavedUrlRef.current = imageUrl;
      savedUrlsRef.current.add(imageUrl);
      utils.wardrobe.looks.list.invalidate({ modelId });
      toast.success('Look saved to gallery');
    } catch {
      setShowCheckmark(false);
      toast.error('Failed to save look');
    }
  }, [gen.currentResult, modelId, selectedGarmentIds, saveLookMutation, utils]);

  // Download current VTO result image
  const proxyImageMutation = trpc.generation.proxyImage.useMutation();
  const handleDownloadResult = useCallback(async () => {
    const imageUrl = gen.currentResult;
    if (!imageUrl) return;
    try {
      const proxy = await proxyImageMutation.mutateAsync({ imageUrl });
      if (!proxy.success || !proxy.base64) throw new Error('Proxy failed');
      triggerDownload(proxy.base64, `wardrobe-${Date.now()}.png`);
    } catch {
      toast.error('Failed to download image');
    }
  }, [gen.currentResult, proxyImageMutation]);

  // Reset Look — clears VTO state, reverts canvas to original model
  const resetToOriginal = useWardrobeStore((s) => s.resetToOriginal);
  const handleResetLook = useCallback(() => {
    if (gen.isGenerating) return;
    resetToOriginal();
    setShowCheckmark(false);
    toast.success('Reset to original model');
  }, [gen.isGenerating, resetToOriginal]);

  // Wardrobe-specific keyboard handler (Space to generate)
  const wardrobeKeyHandler = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        if (canGenerate) gen.generate();
        return true;
      }
      return false;
    },
    [canGenerate, gen]
  );

  // Derive contextual toolbar status from selected garments
  const garmentSummary = useMemo(() => {
    const slotLabels: Record<string, string> = {
      full_look: 'Full Look', tops: 'Top', bottoms: 'Bottoms',
      shoes: 'Shoes', accessories: 'Acc',
    };
    const selected = garments.filter((g) => selectedGarmentIds.has(g.id));
    if (selected.length === 0) return '';
    if (selected.length <= 2) {
      return selected
        .map((g) => g.shortName || slotLabels[g.slotType as string] || g.slotType)
        .join(' + ');
    }
    const types = new Set(selected.map((g) => g.slotType as string));
    const ordered: string[] = [];
    for (const slot of ['full_look', 'tops', 'bottoms', 'shoes', 'accessories']) {
      if (types.has(slot)) ordered.push(slotLabels[slot] || slot);
    }
    return ordered.join(' + ');
  }, [garments, selectedGarmentIds]);

  const statusLabel = gen.isGenerating
    ? (gen.generatingMessage || 'Dressing your model...')
    : hasResult && garmentSummary
      ? `${garmentSummary} \u00b7 v${gen.historyIndex + 1}`
      : garmentSummary
        ? garmentSummary
        : 'Select garments to begin';

  // Compare URL: show previous VTO result (or original model if on first VTO)
  const compareUrl = (() => {
    if (!hasResult) return null;
    if (gen.historyIndex > 0) {
      const prevUrl = useWardrobeStore.getState().vtoHistory[gen.historyIndex - 1];
      return prevUrl ?? modelImageUrl;
    }
    return modelImageUrl;
  })();
  const compareLabel = gen.historyIndex <= 0 ? 'Original' : 'Previous';

  // Camera icon — brief checkmark after save, otherwise always camera
  const cameraButtonDisabled = isAlreadySaved || isSavingLook || showCheckmark;

  return (
    <>
      {/* Left Panel — Rack */}
      <AnimatedPanel
        ready={leftReady}
        from="left"
        offset={60}
        duration={500}
        className="hidden lg:block flex-shrink-0"
      >
        <StudioSidePanel side="left" width={280}>
          <div className="h-full overflow-y-auto">
            <RackPanel />
          </div>
        </StudioSidePanel>
      </AnimatedPanel>

      {/* Center — Canvas */}
      <div className="flex-1 min-w-0 relative">
        {/* Camera shutter flash overlay */}
        {showFlash && (
          <div
            className="absolute inset-0 z-50 pointer-events-none"
            style={{
              background: 'rgba(255,255,255,0.85)',
              animation: 'shutterFlash 300ms ease-out forwards',
            }}
          />
        )}
        <style>{`
          @keyframes shutterFlash {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes checkFadeIn {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>

        <StudioCanvas
          displayUrl={gen.currentResult || modelImageUrl}
          statusLabel={statusLabel}
          isGenerating={gen.isGenerating}
          hasResult={hasResult}
          emptyState={<WardrobeEmptyState />}
          canUndo={gen.canUndo}
          canRedo={gen.canRedo}
          onUndo={gen.undo}
          onRedo={gen.redo}
          onRetry={gen.handleRetry}
          compareUrl={compareUrl}
          compareLabel={compareLabel}
          extraKeyHandler={wardrobeKeyHandler}
          imageOverlay={
            <WardrobeImageOverlay
              resultOverlayItems={resultOverlayItems}
              isGenerating={gen.isGenerating}
              isComparing={false}
              onStyleNote={handleStyleNote}
            />
          }
          onHoverChange={setImageAreaHovered}
          sideOverlay={
            hasResult && !gen.isGenerating ? (
              <div
                className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-2 z-30 transition-opacity duration-200"
                style={{ opacity: imageAreaHovered ? 1 : 0, pointerEvents: imageAreaHovered ? 'auto' : 'none' }}
              >
                <ToolButton
                  active={false}
                  onClick={cameraButtonDisabled ? () => {} : handleSaveLook}
                  icon={
                    showCheckmark ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ animation: 'checkFadeIn 300ms ease-out forwards' }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <Camera
                        size={18}
                        style={{
                          opacity: cameraButtonDisabled ? 0.4 : 1,
                          transition: 'opacity 200ms ease',
                        }}
                      />
                    )
                  }
                />
              </div>
            ) : undefined
          }
          bottomOverlay={
            <WardrobeShortcutsBar
              hasResult={hasResult}
              isGenerating={gen.isGenerating}
              controlsVisible={imageAreaHovered}
              onDownload={handleDownloadResult}
            />
          }
        />
      </div>

      {/* Right Panel — Layers */}
      <AnimatedPanel
        ready={rightReady}
        from="right"
        offset={60}
        duration={500}
        className="hidden lg:block flex-shrink-0"
      >
        <StudioSidePanel side="right" width={260}>
          <LayersPanel
            isGenerating={gen.isGenerating}
            hasResult={hasResult}
            onGenerate={gen.generate}
            currentResultUrl={gen.currentResult}
            onRefine={gen.refineResult}
            isRefining={gen.isGenerating}
            hasDirtyStyles={gen.hasDirtyStyles}
            onApplyStyleChanges={gen.handleApplyStyleChanges}
            hasProcessingSelected={gen.hasProcessingSelected}
            onResetLook={handleResetLook}
          />
        </StudioSidePanel>
      </AnimatedPanel>

      {/* Decomposition Drawer */}
      <DecompositionDrawer open={isDecomposeOpen} onClose={() => setDecomposeOpen(false)} />
    </>
  );
}
