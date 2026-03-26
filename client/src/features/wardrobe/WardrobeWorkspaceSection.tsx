/**
 * WardrobeWorkspaceSection — The wardrobe tool workspace layout.
 *
 * Extracted from DrapeStudio to keep the page file under the line limit.
 * Renders the rack panel, canvas with overlays, layers panel, and
 * decomposition drawer.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { AnimatedPanel } from '@/features/studio/components/AnimatedPanel';
import { StudioSidePanel } from '@/features/studio/components/StudioSidePanel';
import { StudioCanvas } from '@/features/studio/components/StudioCanvas';
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
        // Accumulate the style note for fallback garment
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

      // Accumulate the style note (semicolon-separated, matching SOT pattern)
      const currentNote = useWardrobeStore.getState().styleNotes[String(bestMatch.id)] || '';
      const updatedNote = currentNote ? `${currentNote}; ${note.instruction}` : note.instruction;
      useWardrobeStore.getState().setStyleNote(bestMatch.id, updatedNote);

      // Then trigger refinement
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
    // Prevent double-saving the same result
    if (lastSavedUrlRef.current === imageUrl) {
      toast.info('This look is already saved');
      return;
    }
    try {
      const garmentIds = Array.from(selectedGarmentIds);
      const sessionId = useWardrobeStore.getState().activeSessionId;
      await saveLookMutation.mutateAsync({
        modelId,
        imageUrl,
        garmentIds,
        ...(sessionId ? { sessionId } : {}),
      });
      lastSavedUrlRef.current = imageUrl;
      utils.wardrobe.looks.list.invalidate({ modelId });
      toast.success('Look saved to gallery');
    } catch {
      toast.error('Failed to save look');
    }
  }, [gen.currentResult, modelId, selectedGarmentIds, saveLookMutation, utils]);

  // Download current VTO result image
  const handleDownloadResult = useCallback(async () => {
    const imageUrl = gen.currentResult;
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wardrobe-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(imageUrl, '_blank');
    }
  }, [gen.currentResult]);

  // Reset Look — clears VTO state, reverts canvas to original model
  const resetToOriginal = useWardrobeStore((s) => s.resetToOriginal);
  const handleResetLook = useCallback(() => {
    if (gen.isGenerating) return;
    resetToOriginal();
    toast.success('Reset to original model');
  }, [gen.isGenerating, resetToOriginal]);

  // Wardrobe-specific keyboard handler (Space to generate, R to reset look)
  const wardrobeKeyHandler = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        if (canGenerate) gen.generate();
        return true;
      }
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (hasResult) {
          e.preventDefault();
          handleResetLook();
          return true;
        }
      }
      return false;
    },
    [canGenerate, gen, hasResult, handleResetLook]
  );

  // Derive contextual toolbar status from selected garments
  const garmentSummary = useMemo(() => {
    const slotLabels: Record<string, string> = {
      full_look: 'Full Look', tops: 'Top', bottoms: 'Bottoms',
      shoes: 'Shoes', accessories: 'Acc',
    };
    const selected = garments.filter((g) => selectedGarmentIds.has(g.id));
    if (selected.length === 0) return '';
    // 1-2 garments: use short names for specificity
    if (selected.length <= 2) {
      return selected
        .map((g) => g.shortName || slotLabels[g.slotType as string] || g.slotType)
        .join(' + ');
    }
    // 3+: use slot type labels to keep it compact
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
          bottomOverlay={
            <WardrobeShortcutsBar
              hasResult={hasResult}
              isGenerating={gen.isGenerating}
              controlsVisible={imageAreaHovered}
              onDownload={handleDownloadResult}
              onSaveLook={modelId ? handleSaveLook : undefined}
              isSavingLook={isSavingLook}
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
