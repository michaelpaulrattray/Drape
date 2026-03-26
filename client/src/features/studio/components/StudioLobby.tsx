/**
 * StudioLobby — Landing state shown when no tool is selected.
 *
 * Three paths:
 *   1. "My Models" gallery — load a previously exported/minted model into wardrobe
 *   2. "Upload Your Own" — upload a full-body photo → wardrobe
 *   3. "Cast a Model" — open casting tool to generate a new model
 *
 * Queries are lifted here so we can coordinate loading: the entrance
 * animation only fires after both the session and gallery queries settle,
 * preventing janky pop-in where elements appear one by one.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, ImagePlus, Loader2, X, Sparkles, Upload, Check } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useSessionReset } from '../hooks/useSessionReset';
import { ModelGallery, type MintedModel } from './ModelGallery';
import { ContinueSessionCard, type SessionData } from './ContinueSessionCard';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type UploadPhase = 'reading' | 'uploading' | 'preloading' | 'ready';

const PHASE_LABELS: Record<UploadPhase, string> = {
  reading: 'Reading file...',
  uploading: 'Uploading to cloud...',
  preloading: 'Preparing canvas...',
  ready: 'Ready!',
};

interface StudioLobbyProps {
  onSelectCasting: () => void;
}

export function StudioLobby({ onSelectCasting }: StudioLobbyProps) {
  const { loadUploadedModel, loadGalleryModel, resumeWardrobeSession } = useSessionReset();
  const uploadMutation = trpc.wardrobe.model.upload.useMutation();

  // ── Lift queries here for coordinated loading ──────────────
  const {
    data: models,
    isLoading: modelsLoading,
  } = trpc.wardrobe.model.listMinted.useQuery();

  const {
    data: latestSession,
    isLoading: sessionLoading,
  } = trpc.wardrobe.sessions.getLatest.useQuery(undefined, { staleTime: 30_000 });

  const dataReady = !modelsLoading && !sessionLoading;

  // Entrance animation — only fires once both queries settle
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!dataReady) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [dataReady]);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploadPhase !== null;

  // Loading state for gallery model selection
  const [loadingModelId, setLoadingModelId] = useState<number | null>(null);

  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to preload image'));
      img.src = url;
    });
  }, []);

  /** Handle selecting a minted model from the gallery */
  const handleSelectModel = useCallback(async (model: MintedModel) => {
    if (isUploading || loadingModelId) return;

    try {
      setLoadingModelId(model.id);
      // Preload the thumbnail into browser cache
      await preloadImage(model.thumbnailUrl);
      // Load into wardrobe with identity data
      loadGalleryModel(model.id, model.thumbnailUrl, model.masterPrompt);
      toast.success(`${model.name || 'Model'} loaded — Wardrobe ready`);
    } catch {
      toast.error('Failed to load model');
    } finally {
      setLoadingModelId(null);
    }
  }, [isUploading, loadingModelId, preloadImage, loadGalleryModel]);

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WebP image');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image must be under 10 MB');
      return;
    }

    try {
      setUploadPhase('reading');
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPreview(base64);

      setUploadPhase('uploading');
      const result = await uploadMutation.mutateAsync({
        imageBase64: base64,
        fileName: file.name,
      });

      setUploadPhase('preloading');
      await preloadImage(result.url);

      setUploadPhase('ready');
      await new Promise((r) => setTimeout(r, 300));

      loadUploadedModel(result.url);
      toast.success('Model loaded — Wardrobe ready');
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
      setPreview(null);
    } finally {
      setUploadPhase(null);
    }
  }, [uploadMutation, loadUploadedModel, preloadImage]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processFile]);

  const progressWidth = uploadPhase === 'reading' ? '15%'
    : uploadPhase === 'uploading' ? '55%'
    : uploadPhase === 'preloading' ? '85%'
    : uploadPhase === 'ready' ? '100%'
    : '0%';

  const isBusy = isUploading || !!loadingModelId;

  // ── Loading skeleton ───────────────────────────────────────
  if (!dataReady) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full" style={{ maxWidth: 680 }}>
          {/* Title skeleton */}
          <div className="flex flex-col items-center gap-3 mb-10">
            <div
              className="rounded-lg animate-pulse"
              style={{ width: 260, height: 28, background: 'rgba(0,0,0,0.05)' }}
            />
            <div
              className="rounded-lg animate-pulse"
              style={{ width: 340, height: 14, background: 'rgba(0,0,0,0.03)' }}
            />
          </div>

          {/* Session card skeleton */}
          <div
            className="rounded-2xl animate-pulse mb-6"
            style={{ height: 96, background: 'rgba(0,0,0,0.03)' }}
          />

          {/* Gallery skeleton */}
          <div className="flex gap-3 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 rounded-xl animate-pulse"
                style={{ width: 120, height: 160, background: 'rgba(0,0,0,0.04)' }}
              />
            ))}
          </div>

          {/* CTA cards skeleton */}
          <div className="flex gap-5">
            <div
              className="flex-1 rounded-2xl animate-pulse"
              style={{ height: 240, background: 'rgba(0,0,0,0.03)' }}
            />
            <div
              className="flex-1 rounded-2xl animate-pulse"
              style={{ height: 240, background: 'rgba(0,0,0,0.06)' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 overflow-y-auto"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Global drag overlay */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(26,26,26,0.06)', backdropFilter: 'blur(2px)' }}
        >
          <div
            className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 8px 40px rgba(0,0,0,0.1)' }}
          >
            <Upload className="w-8 h-8" style={{ color: '#1a1a1a' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Drop your model photo</span>
          </div>
        </div>
      )}

      {/* Title */}
      <div
        className="text-center mb-8 sm:mb-10"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(22px, 4vw, 32px)',
            fontWeight: 700,
            color: '#1a1a1a',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          How would you like to start?
        </h1>
        <p
          style={{
            fontSize: 13,
            color: '#999',
            marginTop: 8,
            maxWidth: 400,
            lineHeight: 1.5,
          }}
        >
          Pick a saved model, upload your own photo, or generate one from scratch.
        </p>
      </div>

      {/* Continue Session — only renders if user has an active wardrobe session */}
      <div
        className="w-full mb-6"
        style={{
          maxWidth: 680,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.03s',
        }}
      >
        <ContinueSessionCard
          session={(latestSession as SessionData) ?? null}
          onContinue={(session) => {
            if (session.tool === 'wardrobe') {
              resumeWardrobeSession(session);
              toast.success(`Resumed session — ${session.modelName || 'Uploaded Model'}`);
            }
          }}
        />
      </div>

      {/* My Models Gallery — only renders if user has minted models */}
      <div
        className="w-full mb-8"
        style={{
          maxWidth: 680,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.05s',
        }}
      >
        <ModelGallery
          models={(models as MintedModel[]) ?? []}
          onSelectModel={handleSelectModel}
        />
      </div>

      {/* Two CTA cards */}
      <div
        className="flex flex-col sm:flex-row items-stretch gap-5 sm:gap-6 w-full"
        style={{ maxWidth: 680 }}
      >
        {/* Card 1: Upload Your Own */}
        <div
          className="group relative flex-1 flex flex-col items-center justify-center rounded-2xl overflow-hidden cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isBusy) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          style={{
            minHeight: 240,
            background: isDragging ? 'rgba(26,26,26,0.04)' : '#fff',
            border: `2px ${isUploading ? 'solid' : 'dashed'} ${isDragging ? '#1a1a1a' : isUploading ? '#1a1a1a' : 'rgba(0,0,0,0.1)'}`,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
          }}
        >
          {/* Preview overlay */}
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-cover rounded-xl"
              style={{
                opacity: isUploading ? 0.3 : 0.9,
                transition: 'opacity 0.3s ease',
              }}
            />
          )}

          {/* Upload progress */}
          {isUploading ? (
            <div className="relative z-10 flex flex-col items-center gap-4 px-6">
              {uploadPhase === 'ready' ? (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: '#1a1a1a',
                    animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <Check className="w-5 h-5" style={{ color: '#fff' }} />
                </div>
              ) : (
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1a1a1a' }} />
              )}
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>
                {PHASE_LABELS[uploadPhase!]}
              </span>
              <div className="w-40 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: progressWidth,
                    background: uploadPhase === 'ready' ? '#22c55e' : '#1a1a1a',
                    transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease',
                  }}
                />
              </div>
            </div>
          ) : !preview ? (
            <div className="relative z-10 flex flex-col items-center px-6 py-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ background: '#f5f3ef' }}
              >
                <ImagePlus className="w-6 h-6" style={{ color: '#999' }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>
                Upload Your Own
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: '#999',
                  marginTop: 5,
                  textAlign: 'center',
                  lineHeight: 1.5,
                  maxWidth: 200,
                }}
              >
                Drag & drop or click to upload a full-body photo
              </span>
              <span style={{ fontSize: 10, color: '#ccc', marginTop: 8, letterSpacing: '0.02em' }}>
                JPEG, PNG, WebP · Max 10 MB
              </span>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreview(null);
                setUploadPhase(null);
              }}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              <X className="w-3.5 h-3.5" style={{ color: '#fff' }} />
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Card 2: Cast a Model */}
        <button
          onClick={onSelectCasting}
          disabled={isBusy}
          className="group relative flex-1 flex flex-col items-center justify-center rounded-2xl overflow-hidden"
          style={{
            minHeight: 240,
            background: '#1a1a1a',
            opacity: mounted ? (isBusy ? 0.4 : 1) : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.25s',
            cursor: isBusy ? 'not-allowed' : 'pointer',
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.08) 0%, transparent 70%)',
            }}
          />
          <div className="relative z-10 flex flex-col items-center px-6 py-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <Camera className="w-6 h-6" style={{ color: '#fff' }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
              Cast a Model
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.45)',
                marginTop: 5,
                textAlign: 'center',
                lineHeight: 1.5,
                maxWidth: 200,
              }}
            >
              AI-generate a model from your casting brief
            </span>
            <div
              className="flex items-center gap-1.5 mt-5 px-3 py-1.5 rounded-full transition-all duration-300 group-hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <Sparkles className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.5)' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                AI-Powered
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Bottom hint */}
      <p
        className="mt-8 sm:mt-10 text-center"
        style={{
          fontSize: 11,
          color: '#bbb',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
          maxWidth: 360,
          lineHeight: 1.6,
        }}
      >
        Your session saves automatically. Starting a new model will replace your current session.
      </p>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
