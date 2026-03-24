/**
 * StudioLobby — Landing state shown when no tool is selected.
 *
 * Two clear paths: "Cast a Model" (opens casting tool) or
 * "Upload Your Own" (uploads photo → preloads S3 image → opens wardrobe tool).
 *
 * The key UX detail: after S3 upload completes we preload the returned URL
 * into an Image() object. Only once the browser has the pixels cached do we
 * trigger loadModelFromUpload → workspace transition. This prevents the
 * panels from assembling around an empty canvas.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, ImagePlus, Loader2, X, Sparkles, Upload, Check } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useStudioStore } from '../stores/useStudioStore';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Upload progress phases for the UI */
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
  const loadModelFromUpload = useStudioStore((s) => s.loadModelFromUpload);
  const uploadMutation = trpc.wardrobe.model.upload.useMutation();

  // Entrance animation state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadPhase !== null;

  /** Preload an image URL into the browser cache */
  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to preload image'));
      img.src = url;
    });
  }, []);

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
      // Phase 1: Read file
      setUploadPhase('reading');
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPreview(base64);

      // Phase 2: Upload to S3
      setUploadPhase('uploading');
      const result = await uploadMutation.mutateAsync({
        imageBase64: base64,
        fileName: file.name,
      });

      // Phase 3: Preload the S3 URL into browser cache
      setUploadPhase('preloading');
      await preloadImage(result.url);

      // Phase 4: Brief "ready" flash, then transition
      setUploadPhase('ready');
      await new Promise((r) => setTimeout(r, 300));

      // Now the image is cached — transition will be instant
      loadModelFromUpload(result.url);
      toast.success('Model loaded — Wardrobe ready');
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
      setPreview(null);
    } finally {
      setUploadPhase(null);
    }
  }, [uploadMutation, loadModelFromUpload, preloadImage]);

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

  /** Progress bar width based on phase */
  const progressWidth = uploadPhase === 'reading' ? '15%'
    : uploadPhase === 'uploading' ? '55%'
    : uploadPhase === 'preloading' ? '85%'
    : uploadPhase === 'ready' ? '100%'
    : '0%';

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
        className="text-center mb-10 sm:mb-14"
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
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          Generate an AI model from scratch, or upload your own photo to dress.
        </p>
      </div>

      {/* Two CTA cards */}
      <div
        className="flex flex-col sm:flex-row items-stretch gap-5 sm:gap-6 w-full"
        style={{ maxWidth: 680 }}
      >
        {/* Card 1: Cast a Model */}
        <button
          onClick={onSelectCasting}
          disabled={isUploading}
          className="group relative flex-1 flex flex-col items-center justify-center rounded-2xl overflow-hidden"
          style={{
            minHeight: 280,
            background: '#1a1a1a',
            opacity: mounted ? (isUploading ? 0.4 : 1) : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
            cursor: isUploading ? 'not-allowed' : 'pointer',
          }}
        >
          {/* Subtle gradient overlay */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.08) 0%, transparent 70%)',
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center px-6 py-10">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <Camera className="w-7 h-7" style={{ color: '#fff' }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
              Cast a Model
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.45)',
                marginTop: 6,
                textAlign: 'center',
                lineHeight: 1.5,
                maxWidth: 200,
              }}
            >
              AI-generate a model from your casting brief
            </span>

            {/* Sparkle badge */}
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

        {/* Card 2: Upload Your Own */}
        <div
          className="group relative flex-1 flex flex-col items-center justify-center rounded-2xl overflow-hidden cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          style={{
            minHeight: 280,
            background: isDragging ? 'rgba(26,26,26,0.04)' : '#fff',
            border: `2px ${isUploading ? 'solid' : 'dashed'} ${isDragging ? '#1a1a1a' : isUploading ? '#1a1a1a' : 'rgba(0,0,0,0.1)'}`,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
          }}
        >
          {/* Preview overlay — shows local base64 immediately */}
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

          {/* Upload progress state */}
          {isUploading ? (
            <div className="relative z-10 flex flex-col items-center gap-4 px-6">
              {/* Phase icon */}
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
                <Loader2
                  className="w-8 h-8 animate-spin"
                  style={{ color: '#1a1a1a' }}
                />
              )}

              {/* Phase label */}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#1a1a1a',
                  transition: 'all 0.2s ease',
                }}
              >
                {uploadPhase ? PHASE_LABELS[uploadPhase] : ''}
              </span>

              {/* Progress bar */}
              <div
                className="w-40 h-1 rounded-full overflow-hidden"
                style={{ background: 'rgba(0,0,0,0.08)' }}
              >
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
            <div className="relative z-10 flex flex-col items-center px-6 py-10">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{ background: '#f5f3ef' }}
              >
                <ImagePlus className="w-7 h-7" style={{ color: '#999' }} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>
                Upload Your Own
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: '#999',
                  marginTop: 6,
                  textAlign: 'center',
                  lineHeight: 1.5,
                  maxWidth: 220,
                }}
              >
                Drag & drop or click to upload a full-body photo
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: '#ccc',
                  marginTop: 10,
                  letterSpacing: '0.02em',
                }}
              >
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
        }}
      >
        You can switch between tools anytime from the sidebar
      </p>

      {/* Keyframe for check icon */}
      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
