import { useState } from "react";
import { ImageResolution } from "@/features/casting/constants";

export const ExportModal = ({
  isOpen,
  onClose,
  onExport,
  previewImage,
  viewCount,
  assetId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onExport: (name: string, resolution: ImageResolution) => void;
  previewImage?: string;
  viewCount?: number;
  assetId?: string;
}) => {
  const [characterName, setCharacterName] = useState("");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
          maxWidth: 380,
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Preview */}
        {previewImage && (
          <div className="relative" style={{ height: 160 }}>
            <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, #fff, transparent 60%)' }}
            />
            {assetId && (
              <div
                className="absolute bottom-3 left-4"
                style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}
              >
                {assetId}
              </div>
            )}
            {viewCount !== undefined && (
              <div
                className="absolute bottom-3 right-4 flex items-center gap-1"
                style={{ fontSize: 11, color: '#52525B' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M3 9h18" />
                </svg>
                {viewCount} views
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-5">
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
            Export Casting Pack
          </div>
          <div style={{ fontSize: 13, color: '#52525B', lineHeight: 1.5, marginBottom: 16 }}>
            Assign a name to finalize this casting session.
          </div>

          {/* Name input */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717A', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              MODEL NAME
            </label>
            <input
              autoFocus
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && characterName) onExport(characterName, ImageResolution.HIGH);
              }}
              placeholder="Enter name..."
              className="w-full outline-none"
              style={{
                border: 'none',
                borderBottom: '1.5px solid rgba(0,0,0,0.08)',
                padding: '8px 0',
                fontSize: 16,
                fontWeight: 500,
                color: '#1a1a1a',
                background: 'transparent',
              }}
            />
          </div>

          {/* Resolution footnote */}
          <div style={{ fontSize: 11, color: '#71717A', marginBottom: 16 }}>
            All exports are rendered at 2K resolution.
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              style={{ fontSize: 13, fontWeight: 500, color: '#52525B' }}
            >
              Cancel
            </button>
            <button
              onClick={() => onExport(characterName || 'Unknown Model', ImageResolution.HIGH)}
              className="px-5 py-2 rounded-xl transition-all"
              style={{ background: '#1a1a1a', color: '#fff', fontSize: 13, fontWeight: 600 }}
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
