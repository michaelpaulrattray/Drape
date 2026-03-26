/**
 * WardrobeWorkspaceSection — The wardrobe tool workspace layout.
 *
 * Extracted from DrapeStudio to keep the page file under the line limit.
 * Renders the rack panel, canvas with overlays, layers panel, and
 * decomposition drawer.
 */
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
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
    selectedCount > 0 && !!modelImageUrl && !gen.isGenerating && gen.cooldownSeconds <= 0;

  const handleStyleNote = useCallback(
    (note: { garmentLabel: string; category: string; instruction: string }) => {
      const selectedArr = Array.from(selectedGarmentIds);
      const categoryGarments = garments.filter(
        (g) => selectedArr.includes(g.id) && g.slotType === note.category
      );

      if (categoryGarments.length === 0) {
        const fallbackId = selectedArr[0];
        if (!fallbackId) return;
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

      gen.refineResult(bestMatch.id, note.instruction);
    },
    [gen, garments, selectedGarmentIds]
  );

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

  // Derive toolbar status
  const statusLabel = 'Wardrobe';
  const statusColor = '#ccc';
  const statusGlow = undefined;

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
          statusColor={statusColor}
          statusGlow={statusGlow}
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
          />
        </StudioSidePanel>
      </AnimatedPanel>

      {/* Decomposition Drawer */}
      <DecompositionDrawer open={isDecomposeOpen} onClose={() => setDecomposeOpen(false)} />
    </>
  );
}
