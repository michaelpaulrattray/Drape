/**
 * CastModelModal — Gate modal shown when user tries to enter Wardrobe
 * with an unsaved (draft) model. Asks for a name, shows credit cost
 * for any missing views, then mints the identity before transitioning.
 */
import { useState, useCallback } from 'react';
import { Camera, ChevronRight, Loader2 } from 'lucide-react';
import { CREDIT_COSTS } from '@/features/casting/constants';

export interface CastModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the character name when user confirms casting */
  onConfirm: (characterName: string) => void;
  /** Whether the side view still needs to be generated */
  needsSideView: boolean;
  /** Current credit balance */
  creditBalance: number;
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
  creditBalance,
  isCasting,
  castingMessage,
  previewImage,
}: CastModelModalProps) {
  const [name, setName] = useState('');

  const creditCost = needsSideView ? CREDIT_COSTS.multiView : 0;
  const hasEnoughCredits = creditBalance >= creditCost;

  const handleConfirm = useCallback(() => {
    if (!name.trim() || !hasEnoughCredits || isCasting) return;
    onConfirm(name.trim());
  }, [name, hasEnoughCredits, isCasting, onConfirm]);

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
            <Camera className="w-4 h-4" style={{ color: '#999' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: '0.06em' }}>
              CAST THIS MODEL
            </span>
          </div>

          <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5, marginBottom: 16 }}>
            Save this model as a character in your gallery before dressing them.
            {needsSideView
              ? ' We\'ll generate the side view to complete their identity.'
              : ' All views are ready.'}
          </p>

          {/* Name input */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: '#bbb',
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
                fontSize: 14,
                fontWeight: 500,
                color: '#1a1a1a',
                background: 'transparent',
                opacity: isCasting ? 0.5 : 1,
              }}
            />
          </div>

          {/* Credit cost note */}
          {needsSideView && (
            <div
              className="flex items-center justify-between mb-4"
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: '#f9f8f5',
                fontSize: 11,
              }}
            >
              <span style={{ color: '#888' }}>
                Side view generation
              </span>
              <span style={{ fontWeight: 600, color: hasEnoughCredits ? '#1a1a1a' : '#e53935' }}>
                {creditCost.toLocaleString()} credits
              </span>
            </div>
          )}

          {!hasEnoughCredits && (
            <p style={{ fontSize: 10, color: '#e53935', marginBottom: 12 }}>
              Insufficient credits. You need {creditCost.toLocaleString()} credits but have {creditBalance.toLocaleString()}.
            </p>
          )}

          {/* Casting progress */}
          {isCasting && castingMessage && (
            <div
              className="flex items-center gap-2 mb-4"
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: '#f5f3ef',
                fontSize: 11,
                color: '#888',
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
                fontSize: 11,
                fontWeight: 500,
                color: '#999',
                opacity: isCasting ? 0.4 : 1,
              }}
            >
              Keep Editing
            </button>
            <button
              onClick={handleConfirm}
              disabled={!name.trim() || !hasEnoughCredits || isCasting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl transition-all"
              style={{
                background: name.trim() && hasEnoughCredits && !isCasting ? '#1a1a1a' : '#e0e0e0',
                color: name.trim() && hasEnoughCredits && !isCasting ? '#fff' : '#999',
                fontSize: 11,
                fontWeight: 600,
                cursor: name.trim() && hasEnoughCredits && !isCasting ? 'pointer' : 'not-allowed',
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
