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
      <div className="w-full overflow-hidden rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border-strong" style={{ maxWidth: 380 }}>
        {/* Preview */}
        {previewImage && (
          <div className="relative border-b-hairline border-canvas-border" style={{ height: 160 }}>
            <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
            {assetId && (
              <div className="absolute bottom-3 left-4 px-2 py-0.5 rounded-canvas-sm bg-canvas-surface/90 text-canvas-lg font-medium text-canvas-ink">
                {assetId}
              </div>
            )}
            {viewCount !== undefined && (
              <div className="absolute bottom-3 right-4 flex items-center gap-1 px-2 py-0.5 rounded-canvas-sm bg-canvas-surface/90 text-canvas-sm text-canvas-ink-soft">
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
          <div className="text-canvas-ink font-medium mb-1" style={{ fontSize: 16 }}>
            Export identity pack
          </div>
          <div className="text-canvas-ink-soft mb-4" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Assign a name to finalize this casting session.
          </div>

          {/* Name input */}
          <div className="mb-4">
            <label className="block text-canvas-xs font-medium text-canvas-ink-soft mb-1.5">
              Model name
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
              className="w-full outline-none bg-transparent border-0 border-b border-canvas-border focus:border-canvas-ink text-canvas-ink placeholder:text-canvas-ink-faint"
              style={{ padding: '8px 0', fontSize: 16, fontWeight: 500, borderBottomWidth: '1px', borderBottomStyle: 'solid' }}
            />
          </div>

          {/* Resolution footnote */}
          <div className="text-canvas-sm text-canvas-ink-faint mb-4">
            All exports are rendered at 2K resolution.
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="text-canvas-lg font-medium text-canvas-ink-soft hover:text-canvas-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onExport(characterName || 'Unknown Model', ImageResolution.HIGH)}
              className="px-5 py-2 rounded-canvas-md bg-canvas-ink text-canvas-surface text-canvas-lg font-medium transition-colors"
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
