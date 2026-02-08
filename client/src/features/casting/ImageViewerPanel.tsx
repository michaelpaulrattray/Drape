import React, { useRef } from "react";
import { toast } from "sonner";
import { DNAHelix } from "@/components/DNAHelix";
import { ViewTabs, RefinePanel, ToolsBar } from "./components/ImageViewer";
import { DirectorsNote } from "./components/DirectorsNote";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";
import { useCastingGenerationStore } from "@/features/casting/stores/useCastingGenerationStore";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";
import { ImageResolution, type GenerationState, type GeneratedAsset, type EditTool } from "@/features/casting/constants";
import { ConnectorLine } from "./castingHelpers";
import { ReferenceNode } from "./ReferenceNode";
import { ElapsedTimeDisplay } from "./ElapsedTimeDisplay";

interface ImageViewerPanelProps {
  currentImageUrl: string | undefined;
  currentAssets: GeneratedAsset[];
  genState: GenerationState;
  isViewLocked: boolean;
  hasDownstreamDependencies: boolean;
  isIterationAllowed: boolean;
  isMasking: boolean;
  maskPathsCount: number;
  formProgress: number;
  nextStage: {
    label: string;
    action: () => void;
    step: number;
    total: number;
    isAutoGen?: boolean;
    isProgress?: boolean;
  } | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  handlePointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleRetry: () => void;
  handleGenerate: () => void;
  handleEnhance: () => void;
  handleRefineSubmit: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export function ImageViewerPanel({
  currentImageUrl,
  currentAssets,
  genState,
  isViewLocked,
  hasDownstreamDependencies,
  isIterationAllowed,
  isMasking,
  maskPathsCount,
  formProgress,
  nextStage,
  canvasRef,
  imageRef,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleUndo,
  handleRedo,
  handleRetry,
  handleGenerate,
  handleEnhance,
  handleRefineSubmit,
  canUndo,
  canRedo,
}: ImageViewerPanelProps) {
  const { prefs, updatePref } = useCastingFormStore();
  const { setGenState } = useCastingGenerationStore();
  const {
    activeView,
    activeTool,
    resolution,
    setResolution,
    isAutoGenerating,
    setAutoGenCancelled,
  } = useCastingUIStore();

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <main className="flex-1 flex flex-col h-[calc(100vh-64px)] lg:h-screen overflow-hidden relative bg-[#EBEBEB]">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-[#0A0A0A]/3 rounded-full blur-[90px]"></div>
        <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-[#D4D4D4] via-[#EBEBEB] to-transparent opacity-60"></div>
      </div>

      {/* ConnectorLine */}
      <ConnectorLine isActive={!!currentAssets.length && !!prefs.referenceImage} />

      {/* Top Controls */}
      <div className="absolute top-4 left-4 z-40 flex items-center space-x-2">
        <button 
          onClick={handleUndo} 
          disabled={!canUndo() || genState.isGenerating} 
          className="p-2.5 bg-white/80 hover:bg-[#0A0A0A] hover:text-white disabled:opacity-30 disabled:hover:bg-white/80 text-[#0A0A0A] rounded-full border border-[#0A0A0A]/10 backdrop-blur-sm transition-all"
          title="Undo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </button>
        <button 
          onClick={handleRedo} 
          disabled={!canRedo() || genState.isGenerating} 
          className="p-2.5 bg-white/80 hover:bg-[#0A0A0A] hover:text-white disabled:opacity-30 disabled:hover:bg-white/80 text-[#0A0A0A] rounded-full border border-[#0A0A0A]/10 backdrop-blur-sm transition-all"
          title="Redo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
        </button>
      </div>

      {/* Resolution Selector */}
      <div className="absolute top-4 right-4 z-40 flex bg-white/80 border border-[#0A0A0A]/10 rounded-full p-1 backdrop-blur-sm">
        {[ImageResolution.STD, ImageResolution.HIGH, ImageResolution.ULTRA].map(res => (
          <button
            key={res}
            onClick={() => setResolution(res)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${resolution === res ? 'bg-[#0A0A0A] text-white shadow-sm' : 'text-[#757575] hover:text-[#0A0A0A] hover:bg-[#EBEBEB]'}`}
          >
            {res}
          </button>
        ))}
      </div>

      {/* Reference Node */}
      {currentAssets.length > 0 && (
        <div className="absolute top-20 right-8 z-40 hidden lg:block">
          <ReferenceNode
            image={prefs.referenceImage}
            onSet={(img) => updatePref('referenceImage', img)}
            disabled={genState.isGenerating}
          />
        </div>
      )}

      {/* Error Display with Retry */}
      {genState.error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-white/90 backdrop-blur-sm">
          <div className="max-w-md w-full border border-red-200 bg-white rounded-xl p-8 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <h3 className="text-red-700 font-semibold text-lg mb-2">Generation Failed</h3>
              <p className="text-red-600/80 text-sm leading-relaxed mb-2">{genState.error}</p>
              <p className="text-gray-500 text-xs">This might be due to high demand or a temporary issue. Please try again.</p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button 
                onClick={handleRetry}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-full transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                Retry Generation
              </button>
              <button 
                onClick={() => setGenState(prev => ({ ...prev, error: null }))}
                className="px-6 py-2.5 bg-[#EBEBEB] hover:bg-[#D4D4D4] text-[#0A0A0A] text-sm font-medium rounded-full transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Vertical Thumbnails Strip */}
      <ViewTabs nextStage={nextStage} />

      {/* Main Content */}
      {currentAssets.length > 0 ? (
        <div className="w-full h-full flex flex-col relative z-10">
          {/* Loading Overlay */}
          {genState.isGenerating && (
            <div className="absolute inset-0 z-40 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-200">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgb(38,38,38)" strokeWidth="2" />
                  <circle 
                    cx="50" cy="50" r="45" fill="none" 
                    stroke="white" strokeWidth="2" 
                    strokeLinecap="round"
                    strokeDasharray={`${(genState.progress || 0) * 2.83} 283`}
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-4 border-t-2 border-white/30 rounded-full animate-spin" style={{animationDuration: '1.5s'}}></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-semibold text-[#0A0A0A]">
                    {genState.progress ? `${Math.round(genState.progress)}%` : ''}
                  </span>
                </div>
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-sm font-medium text-[#0A0A0A]">{genState.currentStep || 'Processing...'}</h3>
                {genState.startTime && (
                  <ElapsedTimeDisplay startTime={genState.startTime} estimatedDuration={genState.estimatedDuration} />
                )}
                <div className="flex justify-center space-x-1">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '0ms'}}></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '150ms'}}></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '300ms'}}></div>
                </div>
              </div>
            </div>
          )}

          {/* Image Display Area */}
          <div className="flex-1 relative min-h-0 flex items-center justify-center p-2 lg:p-4 group">
            {/* Next Stage Button */}
            {nextStage && !genState.isGenerating && (
              <div className="absolute top-1/2 right-8 -translate-y-1/2 z-40 flex flex-col items-end space-y-4 animate-in fade-in slide-in-from-right-8 duration-700">
                <div className="text-right space-y-1 drop-shadow-md">
                    <div className="flex items-center justify-end space-x-2 text-[#757575]">
                    <div className="flex space-x-1">
                      {[...Array(nextStage.total)].map((_, i) => (
                        <div key={i} className={`h-1 w-3 rounded-full ${i + 1 < nextStage.step ? 'bg-[#0A0A0A]' : i + 1 === nextStage.step ? 'bg-[#0A0A0A] animate-pulse' : 'bg-[#0A0A0A]/20'}`}></div>
                      ))}
                    </div>
                    <h4 className="text-xs font-medium">
                      {nextStage.step > nextStage.total ? 'Workflow Complete' : isAutoGenerating ? 'Auto-Generating' : 'Next Stage'}
                    </h4>
                  </div>
                  <p className="text-sm font-semibold text-[#0A0A0A]">{nextStage.label}</p>
                </div>
                {!isAutoGenerating ? (
                  <button
                    onClick={nextStage.action}
                    className="group relative w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                  >
                    <div className="absolute inset-0 rounded-full border border-white opacity-50 group-hover:animate-ping"></div>
                    <svg className="w-6 h-6 text-black relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                ) : (
                  <button
                    onClick={() => setAutoGenCancelled(true)}
                    className="group relative px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center justify-center hover:bg-red-500/30 transition-all duration-300"
                  >
                    <span className="text-xs font-medium text-red-400">Cancel</span>
                  </button>
                )}
              </div>
            )}

            {/* Main Image */}
            <div className="relative h-full max-w-full flex items-center justify-center select-none pb-16">
              {currentImageUrl && (
                <>
                  <img 
                    ref={imageRef}
                    src={currentImageUrl} 
                    alt="Active View" 
                    className="max-h-[calc(100vh-200px)] lg:max-h-[calc(100vh-180px)] max-w-full object-contain shadow-2xl border border-gray-200/50 bg-gray-100 blur-loading" 
                    style={{marginTop: '70px'}}
                    onLoad={(e) => e.currentTarget.classList.add('loaded')}
                  />
                  
                  {/* Masking Canvas */}
                  <canvas 
                    ref={canvasRef}
                    className={`absolute top-0 left-0 touch-none ${isMasking ? 'pointer-events-auto z-20' : 'pointer-events-none z-10'} ${activeTool === 'eraser' ? 'cursor-eraser' : activeTool === 'surgical' ? 'cursor-brush' : 'cursor-crosshair'}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                </>
              )}

              {/* Tools Bar and Tool Mode Badge */}
              <ToolsBar
                isIterationAllowed={isIterationAllowed}
                isViewLocked={isViewLocked}
                hasDownstreamDependencies={hasDownstreamDependencies}
                isMasking={isMasking}
              />

              {/* Locked Source Badge */}
              {isViewLocked && !isMasking && (
                <div className="absolute top-4 left-4 z-20 animate-in fade-in duration-300">
                    <div className="bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-[#0A0A0A]/10 flex items-center space-x-2 shadow-lg">
                    <svg className="w-3 h-3 text-[#0A0A0A]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <span className="text-xs font-medium text-[#0A0A0A]">
                      {activeView === 'backFull' ? "Consistency Lock" : "Locked Source"}
                    </span>
                  </div>
                </div>
              )}

              {/* Download Button */}
              <button
                onClick={async () => {
                  if (!currentImageUrl) return;
                  try {
                    const response = await fetch(currentImageUrl);
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `FORMASTUDIO_${activeView}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(blobUrl);
                    toast.success('Image downloaded!');
                  } catch (error) {
                    console.error('Download failed:', error);
                    toast.error('Download failed');
                  }
                }}
                className="absolute bottom-2 right-2 z-30 p-1.5 bg-white/80 backdrop-blur-md border border-[#0A0A0A]/10 rounded-full text-[#757575] hover:text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-all"
                title="Download Image" style={{marginBottom: '10px'}}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>

              {/* View Label */}
              <div className="absolute bottom-2 left-2 z-30 px-3 py-1 bg-white/80 backdrop-blur-md border border-[#0A0A0A]/10 rounded-full" style={{marginBottom: '10px'}}>
                <span className="text-xs font-medium text-[#0A0A0A]">
                  {activeView === 'frontClose' ? 'FRONT CLOSE' : 
                   activeView === 'frontFull' ? 'FRONT FULL' :
                   activeView === 'sideClose' ? 'SIDE CLOSE' :
                   activeView === 'sideFull' ? 'SIDE FULL' :
                   activeView === 'backFull' ? 'BACK FULL' : activeView.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Overlaying Chat Input */}
            <RefinePanel
              maskPathsCount={maskPathsCount}
              isMasking={isMasking}
              isViewLocked={isViewLocked}
              isIterationAllowed={isIterationAllowed}
              textAreaRef={textAreaRef}
              handleGenerate={handleGenerate}
              handleEnhance={handleEnhance}
              handleRefineSubmit={handleRefineSubmit}
            />
          </div>

          {/* Bottom Panel - Director's Note */}
          <DirectorsNote />
        </div>
      ) : genState.isGenerating ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-200">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgb(38,38,38)" strokeWidth="2" />
              <circle 
                cx="50" cy="50" r="45" fill="none" 
                stroke="white" strokeWidth="2" 
                strokeLinecap="round"
                strokeDasharray={`${(genState.progress || 0) * 2.83} 283`}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-4 border-t-2 border-white/30 rounded-full animate-spin" style={{animationDuration: '1.5s'}}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-semibold text-[#0A0A0A]">
                {genState.progress ? `${Math.round(genState.progress)}%` : ''}
              </span>
            </div>
          </div>
          <div className="text-center space-y-3">
            <h3 className="text-sm font-medium text-obsidian">{genState.currentStep || 'Processing...'}</h3>
            {genState.startTime && (
              <ElapsedTimeDisplay startTime={genState.startTime} estimatedDuration={genState.estimatedDuration} />
            )}
            <div className="flex justify-center space-x-1">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '0ms'}}></div>
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '150ms'}}></div>
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '300ms'}}></div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State - DNA Helix Progress Visualization */
        <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden bg-white">
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#EBEBEB]/50 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#EBEBEB]/30 rounded-full blur-3xl" />
          </div>
          
          <div className="relative z-10 w-full max-w-4xl p-8 flex flex-col items-center justify-center min-h-[500px]">
            <div className="w-full">
              <DNAHelix 
                progress={formProgress} 
                className="mx-auto" 
                onSectionClick={(sectionIndex) => {
                  const sectionIds = [
                    'section-casting-basics',
                    'section-casting-basics',
                    'section-physique',
                    'section-skin',
                    'section-eyes',
                    'section-hair'
                  ];
                  const targetId = sectionIds[sectionIndex];
                  const element = document.getElementById(targetId);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
