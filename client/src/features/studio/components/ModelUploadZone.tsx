/**
 * ModelUploadZone — Drag-and-drop / click-to-upload zone for model photos.
 *
 * Shown on the empty canvas state as an alternative to casting.
 * Uploads the image to S3 via tRPC, then calls loadModelFromUpload.
 */
import { useCallback, useRef, useState } from 'react';
import { Upload, ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useStudioStore } from '../stores/useStudioStore';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ModelUploadZone() {
  const loadModelFromUpload = useStudioStore((s) => s.loadModelFromUpload);
  const uploadMutation = trpc.wardrobe.model.upload.useMutation();

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WebP image');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image must be under 10 MB');
      return;
    }

    setIsUploading(true);

    try {
      // Read as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPreview(base64);

      // Upload to S3 via tRPC
      const result = await uploadMutation.mutateAsync({
        imageBase64: base64,
        fileName: file.name,
      });

      loadModelFromUpload(result.url);
      toast.success('Model photo uploaded — switching to Wardrobe');
    } catch (err: any) {
      const msg = err?.message || 'Upload failed';
      toast.error(msg);
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  }, [uploadMutation, loadModelFromUpload]);

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
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processFile]);

  const cancelPreview = useCallback(() => {
    setPreview(null);
    setIsUploading(false);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
      {/* Upload zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isUploading) fileInputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer group"
        style={{
          background: isDragging ? 'rgba(26,26,26,0.06)' : '#fff',
          border: `2px dashed ${isDragging ? '#1a1a1a' : 'rgba(0,0,0,0.12)'}`,
        }}
      >
        {/* Preview image */}
        {preview && (
          <img
            src={preview}
            alt="Preview"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: isUploading ? 0.5 : 1 }}
          />
        )}

        {/* Upload overlay */}
        {isUploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2
              className="w-8 h-8 animate-spin"
              style={{ color: '#1a1a1a' }}
            />
            <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>
              Uploading...
            </span>
          </div>
        ) : !preview ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 transition-opacity group-hover:opacity-80">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: '#f5f3ef' }}
            >
              <ImagePlus className="w-6 h-6" style={{ color: '#999' }} />
            </div>
            <div className="text-center">
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>
                Upload Your Model
              </p>
              <p style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                Drag & drop or click to browse
              </p>
              <p style={{ fontSize: 10, color: '#bbb', marginTop: 6 }}>
                Full-body photo recommended · JPEG, PNG, WebP · Max 10 MB
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              cancelPreview();
            }}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <X className="w-3.5 h-3.5" style={{ color: '#fff' }} />
          </button>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
        <span style={{ fontSize: 10, color: '#bbb', fontWeight: 500, letterSpacing: '0.05em' }}>
          OR
        </span>
        <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
      </div>
    </div>
  );
}
