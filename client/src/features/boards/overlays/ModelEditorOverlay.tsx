/**
 * ModelEditorOverlay — Full iteration workspace for refining a model from the board canvas.
 *
 * Opened by double-clicking a model node or "Modify / Iterate" in context menu.
 * Floats as a centered dialog (~92% viewport) with a frosted backdrop.
 *
 * Features:
 * - Image viewer with zoom/pan
 * - Chat refine bar at bottom for text-based iteration
 * - Surgical tool (mask + describe)
 * - Eraser tool (mask + auto-remove)
 * - Loading overlay during generation
 * - Keyboard shortcuts (Esc to close)
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  X,
  Maximize2,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Send,
  Loader2,
  Scissors,
  Eraser,
  Sparkles,
  Paperclip,
  ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBoardIteration } from '../hooks/useBoardIteration';
import { trpc } from '@/lib/trpc';

/* ── Types ────────────────────────────────────────────────── */

interface ModelEditorOverlayProps {
  itemId: number;
  boardId: number;
  imageUrl: string | null;
  label?: string | null;
  sourceModelId?: number | null;
  onClose: () => void;
}

type ActiveTool = 'none' | 'surgical' | 'eraser';

/* ── Mask Canvas (inline — lightweight SVG path drawing) ── */

function MaskCanvasLayer({
  width,
  height,
  tool,
  onMaskReady,
}: {
  width: number;
  height: number;
  tool: ActiveTool;
  onMaskReady: (getDataUrl: () => string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    // Provide the getter to parent
    onMaskReady(() => {
      if (!canvas) return null;
      // Check if anything was drawn
      const ctx2 = canvas.getContext('2d');
      if (!ctx2) return null;
      const imageData = ctx2.getImageData(0, 0, width, height);
      const hasContent = imageData.data.some((v, i) => i % 4 === 3 && v > 0);
      if (!hasContent) return null;
      return canvas.toDataURL('image/png');
    });
  }, [width, height, tool, onMaskReady]);

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'none') return;
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current || tool === 'none') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.strokeStyle = tool === 'surgical' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  if (tool === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0"
      style={{
        cursor: 'crosshair',
        zIndex: 2,
        pointerEvents: 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}

/* ── Component ────────────────────────────────────────────── */

export function ModelEditorOverlay({
  itemId,
  boardId,
  imageUrl: initialImageUrl,
  label,
  sourceModelId,
  onClose,
}: ModelEditorOverlayProps) {
  // Image state — tracks the current image (updates after iteration)
  const [currentImageUrl, setCurrentImageUrl] = useState(initialImageUrl);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  // Refine state
  const [refineInput, setRefineInput] = useState('');
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const getMaskDataUrl = useRef<(() => string | null) | null>(null);

  // Reference image state
  const [referenceImage, setReferenceImage] = useState<{ url: string; preview: string } | null>(null);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  // Iteration hook
  const { isGenerating, currentStep, iterate } = useBoardIteration({ boardId });

  // Fetch model info to get the current assetId
  const { data: modelInfo } = trpc.boards.getItemModelInfo.useQuery(
    { itemId },
    { enabled: !!sourceModelId },
  );

  // Get the latest asset ID for the model (frontClose headshot)
  const currentAssetId = modelInfo?.latestAssetId ?? null;


  // Save initial version on first open
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current && currentImageUrl) {
      hasInitialized.current = true;
      // We don't need to save initial version here — it's saved when the item is first created
    }
  }, [currentImageUrl]);

  // Update current image when initial changes (e.g., after iteration from context menu)
  useEffect(() => {
    if (initialImageUrl) setCurrentImageUrl(initialImageUrl);
  }, [initialImageUrl]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 4)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.25)), []);
  const handleResetView = useCallback(() => { setZoom(1); setPosition({ x: 0, y: 0 }); }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.25, Math.min(4, z + delta)));
  }, []);

  // Pan drag (only when no tool active)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || activeTool !== 'none') return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [position, activeTool]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // Download
  const handleDownload = useCallback(async () => {
    if (!currentImageUrl) return;
    try {
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(currentImageUrl)}&download=true`;
      const a = document.createElement('a');
      a.href = proxyUrl;
      a.download = `${label || 'model'}-${itemId}.png`;
      a.click();
      toast.success('Image downloaded');
    } catch {
      toast.error('Failed to download image');
    }
  }, [currentImageUrl, label, itemId]);

  // Reference image upload
  const handleRefImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    setIsUploadingRef(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const preview = URL.createObjectURL(file);
      const base64Data = base64.split(',')[1];
      setReferenceImage({ url: base64Data, preview });
      toast.success('Reference image attached');
    } catch {
      toast.error('Failed to load reference image');
    } finally {
      setIsUploadingRef(false);
      if (refFileInputRef.current) refFileInputRef.current.value = '';
    }
  }, []);

  const removeReferenceImage = useCallback(() => {
    if (referenceImage?.preview) URL.revokeObjectURL(referenceImage.preview);
    setReferenceImage(null);
  }, [referenceImage]);

  // Submit refinement
  const handleRefineSubmit = useCallback(async () => {
    if (!sourceModelId || !currentImageUrl) {
      toast.error('No model linked to this item');
      return;
    }

    // For eraser, we need a mask but no text
    if (activeTool === 'eraser') {
      const maskData = getMaskDataUrl.current?.();
      if (!maskData) {
        toast.error('Please paint the area to erase');
        return;
      }
      // We need the asset ID — try to find it from the model info
      // For now, use a placeholder approach: find the latest asset
      const result = await iterate({
        itemId,
        sourceModelId,
        currentAssetId: currentAssetId || 0,
        prompt: 'FIX ARTIFACT: Remove the content in the masked area. Inpaint with surrounding skin texture, lighting, and noise. Restore the background if needed. Do not add new objects.',
        maskBase64: maskData,
        referenceImage: referenceImage?.url,
        tool: 'eraser',
      });
      if (result.success && result.imageUrl) {
        setCurrentImageUrl(result.imageUrl);
        toast.success('Eraser applied!');
      }
      setActiveTool('none');
      return;
    }

    // For surgical, we need both mask and text
    if (activeTool === 'surgical') {
      if (!refineInput.trim()) {
        toast.error('Please describe the change');
        return;
      }
      const maskData = getMaskDataUrl.current?.();
      if (!maskData) {
        toast.error('Please paint the area to modify');
        return;
      }
      const result = await iterate({
        itemId,
        sourceModelId,
        currentAssetId: currentAssetId || 0,
        prompt: refineInput,
        maskBase64: maskData,
        referenceImage: referenceImage?.url,
        tool: 'surgical',
      });
      if (result.success && result.imageUrl) {
        setCurrentImageUrl(result.imageUrl);
        toast.success('Surgical edit applied!');
      }
      setRefineInput('');
      setActiveTool('none');
      return;
    }

    // Regular text iteration
    if (!refineInput.trim()) return;
    const result = await iterate({
      itemId,
      sourceModelId,
      currentAssetId: currentAssetId || 0,
      prompt: refineInput,
      referenceImage: referenceImage?.url,
      tool: 'chat',
    });
    if (result.success && result.imageUrl) {
      setCurrentImageUrl(result.imageUrl);
      toast.success('Iteration complete!');
    }
    setRefineInput('');
    removeReferenceImage();
  }, [sourceModelId, currentImageUrl, activeTool, refineInput, itemId, currentAssetId, iterate, referenceImage, removeReferenceImage]);

  // Handle Enter key in refine input
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRefineSubmit();
    }
  }, [handleRefineSubmit]);

  // Toggle tools
  const toggleSurgical = useCallback(() => {
    setActiveTool((t) => t === 'surgical' ? 'none' : 'surgical');
  }, []);

  const toggleEraser = useCallback(() => {
    setActiveTool((t) => t === 'eraser' ? 'none' : 'eraser');
  }, []);

  const canIterate = !!sourceModelId;

  return (
    <>
      {/* Frosted backdrop */}
      <div
        className="fixed inset-0 z-[85]"
        style={{
          background: 'rgba(250, 250, 248, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      />

      {/* Popout dialog */}
      <div
        className="fixed z-[90] flex flex-col"
        style={{
          top: '4%',
          left: '4%',
          width: '92%',
          height: '92%',
          background: '#FAFAF8',
          backgroundImage: 'radial-gradient(circle, #d4d0cb 0.8px, transparent 0.8px)',
          backgroundSize: '20px 20px',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          animation: 'popout-enter 0.2s ease-out',
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-5 flex-shrink-0"
          style={{
            height: 48,
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-3">
            <Maximize2 size={14} style={{ color: '#71716A' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
              {label || 'Model'}
            </span>
            {activeTool !== 'none' && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: activeTool === 'surgical' ? '#3b82f6' : '#ef4444',
                  background: activeTool === 'surgical' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {activeTool === 'surgical' ? 'Surgical Mode' : 'Eraser Mode'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Surgical tool */}
            {canIterate && (
              <HeaderButton
                icon={<Scissors size={14} strokeWidth={1.5} />}
                title="Surgical edit — paint area + describe change"
                active={activeTool === 'surgical'}
                activeColor="#3b82f6"
                onClick={toggleSurgical}
              />
            )}

            {/* Eraser tool */}
            {canIterate && (
              <HeaderButton
                icon={<Eraser size={14} strokeWidth={1.5} />}
                title="Eraser — paint area to remove"
                active={activeTool === 'eraser'}
                activeColor="#ef4444"
                onClick={toggleEraser}
              />
            )}

            {canIterate && (
              <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.08)', margin: '0 4px' }} />
            )}

            {/* Zoom controls */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
            >
              <HeaderButton icon={<ZoomOut size={14} strokeWidth={1.5} />} title="Zoom out" onClick={handleZoomOut} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#71716A', minWidth: 36, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <HeaderButton icon={<ZoomIn size={14} strokeWidth={1.5} />} title="Zoom in" onClick={handleZoomIn} />
              <HeaderButton icon={<RotateCcw size={13} strokeWidth={1.5} />} title="Reset view" onClick={handleResetView} />
            </div>

            <HeaderButton icon={<Download size={15} strokeWidth={1.5} />} title="Download" onClick={handleDownload} />

            <HeaderButton icon={<X size={16} strokeWidth={1.5} />} title="Close (Esc)" onClick={onClose} />
          </div>
        </div>

        {/* Image viewer area */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden relative"
          style={{ cursor: activeTool !== 'none' ? 'crosshair' : isDragging ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {currentImageUrl ? (
            <div className="relative" style={{ maxWidth: '80%', maxHeight: '85%' }}>
              <img
                src={currentImageUrl}
                alt={label || 'Model'}
                draggable={false}
                className="select-none"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 12,
                  boxShadow: '0 8px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                  pointerEvents: 'none',
                }}
              />
              {/* Mask overlay for surgical/eraser tools */}
              {activeTool !== 'none' && (
                <MaskCanvasLayer
                  width={1024}
                  height={1024}
                  tool={activeTool}
                  onMaskReady={(getter) => { getMaskDataUrl.current = getter; }}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3" style={{ color: '#a1a19a' }}>
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <Maximize2 size={28} strokeWidth={1} style={{ color: '#ccc' }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 500 }}>No image available</p>
            </div>
          )}

          {/* Loading overlay */}
          {isGenerating && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-10"
              style={{
                background: 'rgba(250, 250, 248, 0.85)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: '#71716A' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{currentStep || 'Generating...'}</p>
              <p style={{ fontSize: 12, color: '#a1a19a', marginTop: 4 }}>This may take a few seconds</p>
            </div>
          )}
        </div>

        {/* Hidden file input for reference images */}
        <input
          ref={refFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleRefImageSelect}
          className="hidden"
        />

        {/* Bottom refine bar */}
        {canIterate ? (
          <div
            className="flex flex-col flex-shrink-0"
            style={{
              borderTop: '1px solid rgba(0,0,0,0.06)',
              background: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Reference image preview */}
            {referenceImage && (
              <div className="flex items-center gap-2 px-5 pt-2">
                <div className="relative group">
                  <img
                    src={referenceImage.preview}
                    alt="Reference"
                    className="rounded-lg object-cover"
                    style={{ width: 40, height: 40, border: '1px solid rgba(0,0,0,0.08)' }}
                  />
                  <button
                    onClick={removeReferenceImage}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: '#1a1a1a', color: '#fff', fontSize: 10 }}
                  >
                    <X size={10} />
                  </button>
                </div>
                <span style={{ fontSize: 11, color: '#71716A', fontWeight: 500 }}>Reference attached</span>
              </div>
            )}

            <div className="flex items-center gap-3 px-5" style={{ height: 60 }}>
            {/* Tool indicator */}
            {activeTool !== 'none' && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg flex-shrink-0"
                style={{
                  background: activeTool === 'surgical' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${activeTool === 'surgical' ? 'rgba(59,130,246,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}
              >
                {activeTool === 'surgical' ? (
                  <Scissors size={13} style={{ color: '#3b82f6' }} />
                ) : (
                  <Eraser size={13} style={{ color: '#ef4444' }} />
                )}
                <span style={{ fontSize: 11, fontWeight: 600, color: activeTool === 'surgical' ? '#3b82f6' : '#ef4444' }}>
                  {activeTool === 'surgical' ? 'Paint area, then describe' : 'Paint area to erase'}
                </span>
              </div>
            )}

            {/* Reference image button */}
            <button
              onClick={() => refFileInputRef.current?.click()}
              disabled={isGenerating || isUploadingRef}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: referenceImage ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.03)',
                color: referenceImage ? '#3b82f6' : '#71716A',
                border: `1px solid ${referenceImage ? 'rgba(59,130,246,0.2)' : 'rgba(0,0,0,0.06)'}`,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
              }}
              title="Attach reference image"
            >
              {isUploadingRef ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ImageIcon size={15} strokeWidth={1.5} />
              )}
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={refineInput}
                onChange={(e) => setRefineInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeTool === 'surgical'
                    ? 'Describe what to change in the painted area...'
                    : activeTool === 'eraser'
                    ? 'Press send to erase the painted area'
                    : 'Describe changes — e.g. "make hair darker" or "add freckles"...'
                }
                disabled={isGenerating}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{
                  background: 'rgba(0,0,0,0.03)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: '#1a1a1a',
                  fontSize: 13,
                }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={handleRefineSubmit}
              disabled={isGenerating || (!refineInput.trim() && activeTool === 'none')}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: isGenerating || (!refineInput.trim() && activeTool === 'none')
                  ? 'rgba(0,0,0,0.04)'
                  : '#1a1a1a',
                color: isGenerating || (!refineInput.trim() && activeTool === 'none')
                  ? '#a1a19a'
                  : '#fff',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
              }}
            >
              {isGenerating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} strokeWidth={1.5} />
              )}
            </button>
            </div>
          </div>
        ) : (
          /* Non-model items — keyboard hints */
          <div
            className="flex items-center justify-center gap-4 flex-shrink-0"
            style={{
              height: 36,
              borderTop: '1px solid rgba(0,0,0,0.04)',
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {[
              { key: 'Scroll', label: 'Zoom' },
              { key: 'Drag', label: 'Pan' },
              { key: 'Esc', label: 'Close' },
            ].map(({ key, label: l }) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#a1a19a',
                    background: 'rgba(0,0,0,0.04)',
                    padding: '1px 5px',
                    borderRadius: 4,
                    letterSpacing: '0.03em',
                  }}
                >
                  {key}
                </span>
                <span style={{ fontSize: 11, color: '#a1a19a' }}>{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Popout animation keyframes */}
      <style>{`
        @keyframes popout-enter {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  );
}

/* ── Header Button (reusable) ──────────────────────────────── */

function HeaderButton({
  icon,
  title,
  onClick,
  active,
  activeColor,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
      style={{
        color: active ? activeColor || '#1a1a1a' : '#71716A',
        background: active ? `${activeColor || '#1a1a1a'}15` : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
          e.currentTarget.style.color = '#1a1a1a';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#71716A';
        }
      }}
      title={title}
    >
      {icon}
    </button>
  );
}
