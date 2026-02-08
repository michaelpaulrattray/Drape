import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { CreditTopupModal } from "@/features/billing/CreditTopupModal";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";
import { useCastingGenerationStore } from "@/features/casting/stores/useCastingGenerationStore";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";
import { ControlPanel } from "@/features/casting/ControlPanel";
import { ImageViewerPanel } from "@/features/casting/ImageViewerPanel";
import { StageLockModal } from "@/features/casting/StageLockModal";
import { ExportModal } from "@/features/casting/ExportModal";
import { useCastingCanvas } from "@/features/casting/hooks/useCastingCanvas";
import { useCastingGeneration } from "@/features/casting/hooks/useCastingGeneration";
import { useCastingExport } from "@/features/casting/hooks/useCastingExport";
import { useCastingViewGeneration } from "@/features/casting/hooks/useCastingViewGeneration";
import { generateRandomPreferences } from "@/features/casting/castingHelpers";
import { StudioHeader } from "@/features/casting/StudioHeader";

export default function CastingStudio() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // Zustand stores
  const { prefs, setPrefs } = useCastingFormStore();
  const {
    genState,
    setGenState,
    currentModelId,
    currentAssets,
  } = useCastingGenerationStore();
  const {
    activeView,
    activeTool,
    showExportModal,
    setShowExportModal,
    lockModal,
    closeLockModal,
    isTopupOpen,
    setIsTopupOpen,
    refineInput,
  } = useCastingUIStore();

  // Canvas drawing hook
  const {
    canvasRef,
    imageRef,
    maskPaths,
    isMasking,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getGuideOverlayDataUrl,
    clearMask,
  } = useCastingCanvas(activeTool, activeView, currentAssets);

  // Generation hook (initial generation + iteration)
  const {
    creditsData,
    refetchCreditsWithWarning,
    isFormValid,
    currentImageUrl,
    isViewLocked,
    hasDownstreamDependencies,
    isIterationAllowed,
    handleGenerate,
    handleRefineSubmit,
    handleEnhance,
    handleRetry,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = useCastingGeneration({
    isAuthenticated,
    activeTool,
    isMasking,
    getGuideOverlayDataUrl,
    clearMask,
  });

  // View generation hook (full body, multi-view, nextStage)
  const { nextStage } = useCastingViewGeneration({
    isAuthenticated,
    creditsData,
    refetchCreditsWithWarning,
  });

  // Export hook
  const { handleExport } = useCastingExport({
    currentModelId,
    currentAssets,
    genState,
    setGenState,
    setShowExportModal,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Pre-launch gate: redirect unapproved users to waitlist (admins bypass)
  useEffect(() => {
    if (!authLoading && isAuthenticated && user && !user.approved && user.role !== "admin") {
      navigate("/waitlist-pending");
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Auto-resize textarea (used by RefinePanel via textAreaRef)
  const textAreaRef = useCastingUIStore((s) => s.refineInput);
  useEffect(() => {
    // RefinePanel handles its own textarea — this is a no-op placeholder
    // kept for backward compatibility with the textarea auto-resize pattern
  }, [textAreaRef]);

  // Keyboard shortcuts for debug utility (admin only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const randomPrefs = generateRandomPreferences();
        setPrefs({ ...prefs, ...randomPrefs });
        toast.success('Debug: Form populated with random preferences');
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        const randomPrefs = generateRandomPreferences();
        setPrefs({ ...prefs, ...randomPrefs });
        toast.success('Debug: Auto-generating model...');
        setTimeout(() => {
          const generateBtn = document.querySelector('[data-debug-generate]') as HTMLButtonElement;
          if (generateBtn && !generateBtn.disabled) {
            generateBtn.click();
          }
        }, 200);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prefs, setPrefs]);

  // Calculate form completion progress for DNA helix animation
  const formProgress = useMemo(() => {
    let completed = 0;
    const totalFields = 12;
    if (prefs.castingBrand) completed += 1;
    if (prefs.castingVibe && (prefs.castingVibe.editorial > 0 || prefs.castingVibe.commercial > 0 || prefs.castingVibe.runway > 0)) completed += 1;
    if (prefs.gender) completed += 1;
    if (prefs.age && prefs.ethnicity) completed += 1;
    if (prefs.bodyType) completed += 1;
    if (prefs.faceShape) completed += 1;
    if (prefs.skinTone) completed += 1;
    if (prefs.skinTexture || prefs.skinFinish) completed += 1;
    if (prefs.eyeColor) completed += 2;
    if (prefs.hairColor) completed += 1;
    if (prefs.hairStyle) completed += 1;
    return Math.round((completed / totalFields) * 100);
  }, [prefs]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#0A0A0A]" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Studio Header */}
      <StudioHeader
        creditsBalance={creditsData?.balance || 0}
        planTier={creditsData?.planTier || "free"}
      />

      {/* Stage Lock Modal */}
      <StageLockModal
        isOpen={lockModal.isOpen}
        title={lockModal.title}
        message={lockModal.message}
        onConfirm={lockModal.onConfirm}
        onCancel={closeLockModal}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        previewImage={currentAssets.find(a => a.viewType === 'frontClose')?.storageUrl ?? undefined}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      {/* Left Panel */}
      <ControlPanel
        user={user}
        isFormValid={isFormValid}
        genState={genState}
        currentAssets={currentAssets}
        handleGenerate={handleGenerate}
      />

      {/* Right Panel */}
      <ImageViewerPanel
        currentImageUrl={currentImageUrl ?? undefined}
        currentAssets={currentAssets}
        genState={genState}
        isViewLocked={isViewLocked}
        hasDownstreamDependencies={hasDownstreamDependencies}
        isIterationAllowed={isIterationAllowed}
        isMasking={isMasking}
        maskPathsCount={maskPaths.length}
        formProgress={formProgress}
        nextStage={nextStage}
        canvasRef={canvasRef}
        imageRef={imageRef}
        handlePointerDown={handlePointerDown}
        handlePointerMove={handlePointerMove}
        handlePointerUp={handlePointerUp}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        handleRetry={handleRetry}
        handleGenerate={handleGenerate}
        handleEnhance={handleEnhance}
        handleRefineSubmit={handleRefineSubmit}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      </div>

      {/* Credit Top-up Modal */}
      <CreditTopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        currentBalance={creditsData?.balance || 0}
      />
    </div>
  );
}
