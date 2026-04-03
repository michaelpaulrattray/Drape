/**
 * CastModelModal — Gate modal shown when user tries to enter Wardrobe
 * with an unsaved (draft) model. Asks for a name, optionally generates
 * the side view, then mints the identity before transitioning.
 */
import { useState, useCallback } from 'react';
import { Camera, ChevronRight, Loader2, Check } from 'lucide-react';

export interface CastModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with (characterName, generateSideView) when user confirms */
  onConfirm: (characterName: string, generateSideView: boolean) => void;
  /** Whether the side view still needs to be generated */
  needsSideView: boolean;
  /** Whether the casting process is in progress */
  isCasting: boolean;
  /** Progress message during casting */
  castingMessage?: string;
  /** Preview image URL (headshot) */
  previewImage?: string;
}

export function CastModelModal({
  isOpen,
  onClose,
  onConfirm,
  needsSideView,
  isCasting,
  castingMessage,
  previewImage,
}: CastModelModalProps) {
  const [name, setName] = useState('');
  const [generateSide, setGenerateSide] = useState(true);

  const handleConfirm = useCallback(() => {
    if (!name.trim() || isCasting) return;
    onConfirm(name.trim(), needsSideView && generateSide);
  }, [name, isCasting, onConfirm, needsSideView, generateSide]);

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
        {/* Preview thumbnail */}
        {previewImage && (
          <div className="relative" style={{ height: 140 }}>
            <img
              src={previewImage}
              alt="Model preview"
              className="w-full h-full object-cover"
              style={{ objectPosition: 'center 20%' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, #fff 0%, transparent 60%)',
              }}
            />
          </div>
        )}

        <div style={{ padding: '16px 24px 20px' }}>
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-4 h-4" style={{ color: '#52525B' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#52525B', letterSpacing: '0.06em' }}>
              CAST THIS MODEL
            </span>
          </div>

          <p style={{ fontSize: 14, color: '#52525B', lineHeight: 1.5, marginBottom: 16 }}>
            Save this model as a character in your gallery before dressing them.
            This only takes a moment.
          </p>

          {/* Name input */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#71717A',
                letterSpacing: '0.06em',
                display: 'block',
                marginBottom: 6,
              }}
            >
              MODEL NAME
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
              placeholder="Enter name..."
              disabled={isCasting}
              className="w-full outline-none"
              style={{
                border: 'none',
                borderBottom: '1.5px solid rgba(0,0,0,0.08)',
                padding: '8px 0',
                fontSize: 16,
                fontWeight: 500,
                color: '#1a1a1a',
                background: 'transparent',
                opacity: isCasting ? 0.5 : 1,
              }}
            />
          </div>

          {/* Optional side view toggle */}
          {needsSideView && (
            <button
              type="button"
              onClick={() => !isCasting && setGenerateSide(!generateSide)}
              disabled={isCasting}
              className="flex items-center gap-2.5 w-full mb-4 transition-all"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: generateSide ? '#F4F4F5' : '#fafafa',
                border: generateSide ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(0,0,0,0.04)',
                cursor: isCasting ? 'not-allowed' : 'pointer',
                opacity: isCasting ? 0.5 : 1,
              }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0 rounded transition-all"
                style={{
                  width: 18,
                  height: 18,
                  background: generateSide ? '#1a1a1a' : 'transparent',
                  border: generateSide ? 'none' : '1.5px solid #ccc',
                }}
              >
                {generateSide && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="text-left">
                <span style={{ fontSize: 13, fontWeight: 500, color: '#52525B' }}>
                  Generate side view
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: '#71717A',
                    marginLeft: 6,
                  }}
                >
                  recommended
                </span>
              </div>
            </button>
          )}

          {/* Casting progress */}
          {isCasting && castingMessage && (
            <div
              className="flex items-center gap-2 mb-4"
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: '#F4F4F5',
                fontSize: 13,
                color: '#52525B',
              }}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{castingMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isCasting}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#52525B',
                opacity: isCasting ? 0.4 : 1,
              }}
            >
              Keep Editing
            </button>
            <button
              onClick={handleConfirm}
              disabled={!name.trim() || isCasting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl transition-all"
              style={{
                background: name.trim() && !isCasting ? '#1a1a1a' : '#e0e0e0',
                color: name.trim() && !isCasting ? '#fff' : '#999',
                fontSize: 13,
                fontWeight: 600,
                cursor: name.trim() && !isCasting ? 'pointer' : 'not-allowed',
              }}
            >
              {isCasting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Casting...
                </>
              ) : (
                <>
                  Cast & Continue
                  <ChevronRight className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
