/**
 * CastModelModal — the mint gate. Asks for a name and a package tier
 * (D-39, tier copy per D-51: Draft / Core identity / Full comp card),
 * then mints the identity via a single mintPackage call. Tier costs are
 * plan-derived (server truth, D-15) — never client literals. Upgrading
 * later costs the same: pricing counts only missing slots.
 */
import { useState, useCallback, useEffect } from 'react';
import { Camera, ChevronRight, Loader2 } from 'lucide-react';
import type { MintTier } from '@shared/boardTypes';

export type TierPlan = Record<MintTier, { missing: string[]; cost: number }>;

const TIER_COPY: Record<MintTier, { name: string; purpose: string }> = {
  draft: { name: 'Draft', purpose: 'Name them and keep exploring. Views come later.' },
  core: { name: 'Core identity', purpose: 'Face angles and full body — ready for styling.' },
  // D-51 vocabulary: the composite is the COMP CARD everywhere users read it
  production: { name: 'Full comp card', purpose: 'The full six-view card, for scenes and video.' },
};

const TIER_ORDER: MintTier[] = ['draft', 'core', 'production'];

export interface CastModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with (characterName, tier) when user confirms */
  onConfirm: (characterName: string, tier: MintTier) => void;
  /** Plan-derived tier costs; undefined while the plan loads */
  tiers?: TierPlan;
  /** Whether the casting process is in progress */
  isCasting: boolean;
  /** Progress message during casting */
  castingMessage?: string;
  /** Preview image URL (headshot) */
  previewImage?: string;
  /** Upgrade mode (D-39c): the model is already minted and named — no name
   *  input, no Draft row, tier costs cover only the missing slots. */
  mode?: 'mint' | 'upgrade';
  /** The minted model's name, passed through onConfirm in upgrade mode */
  fixedName?: string;
}

export function CastModelModal({
  isOpen,
  onClose,
  onConfirm,
  tiers,
  isCasting,
  castingMessage,
  previewImage,
  mode = 'mint',
  fixedName,
}: CastModelModalProps) {
  const [name, setName] = useState('');
  const [tier, setTier] = useState<MintTier>('core');
  const upgrade = mode === 'upgrade';

  // Upgrade: land on the first tier that still has something to add
  useEffect(() => {
    if (upgrade && tiers && tiers[tier].cost === 0 && tiers.production.cost > 0) {
      setTier('production');
    }
  }, [upgrade, tiers, tier]);

  const effectiveName = upgrade ? (fixedName ?? '').trim() : name.trim();
  const selectedCost = tiers?.[tier]?.cost;
  const confirmable =
    !!effectiveName && !isCasting && !(upgrade && selectedCost === 0);

  const handleConfirm = useCallback(() => {
    if (!confirmable) return;
    onConfirm(effectiveName, tier);
  }, [confirmable, effectiveName, onConfirm, tier]);

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
            <Camera className="w-4 h-4" style={{ color: '#52524B' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#52524B', letterSpacing: '0.06em' }}>
              {upgrade ? 'COMPLETE THE PACKAGE' : 'CAST THIS MODEL'}
            </span>
          </div>

          {upgrade ? (
            <p style={{ fontSize: 12.5, color: '#71716A', lineHeight: 1.5, marginBottom: 14 }}>
              {fixedName ? `Add the views ${fixedName} is missing.` : 'Add the missing views.'} Upgrading
              later always costs the same — you only pay for what's new.
            </p>
          ) : (
            /* Name input */
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#71716A',
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
          )}

          {/* Tier picker (D-39) */}
          <div style={{ marginBottom: 14 }}>
            {(upgrade ? TIER_ORDER.filter((t) => t !== 'draft') : TIER_ORDER).map((t) => {
              const selected = tier === t;
              const plan = tiers?.[t];
              const complete = t !== 'draft' && plan !== undefined && plan.cost === 0;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => !isCasting && setTier(t)}
                  disabled={isCasting}
                  className="flex items-start gap-2.5 w-full text-left transition-all"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    marginBottom: 6,
                    background: selected ? '#F5F3F0' : '#fafafa',
                    border: selected ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(0,0,0,0.04)',
                    cursor: isCasting ? 'not-allowed' : 'pointer',
                    opacity: isCasting ? 0.5 : 1,
                  }}
                >
                  <div
                    className="flex-shrink-0 rounded-full transition-all"
                    style={{
                      width: 14,
                      height: 14,
                      marginTop: 2,
                      border: selected ? '4.5px solid #1a1a1a' : '1.5px solid #ccc',
                      background: '#fff',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                        {TIER_COPY[t].name}
                      </span>
                      <span style={{ fontSize: 12, color: '#71716A', whiteSpace: 'nowrap' }}>
                        {plan === undefined
                          ? '…'
                          : complete
                            ? 'Complete'
                            : plan.cost === 0
                              ? 'Free'
                              : `${plan.cost.toLocaleString()} credits`}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: '#71716A', lineHeight: 1.4, display: 'block' }}>
                      {TIER_COPY[t].purpose}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Casting progress */}
          {isCasting && castingMessage && (
            <div
              className="flex items-center gap-2 mb-4"
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: '#F5F3F0',
                fontSize: 13,
                color: '#52524B',
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
                color: '#52524B',
                opacity: isCasting ? 0.4 : 1,
              }}
            >
              Keep Editing
            </button>
            <button
              onClick={handleConfirm}
              disabled={!confirmable}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl transition-all"
              style={{
                background: confirmable ? '#1a1a1a' : '#e0e0e0',
                color: confirmable ? '#fff' : '#999',
                fontSize: 13,
                fontWeight: 600,
                cursor: confirmable ? 'pointer' : 'not-allowed',
              }}
            >
              {isCasting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {upgrade ? 'Adding...' : 'Casting...'}
                </>
              ) : (
                <>
                  {upgrade ? 'Add views' : 'Cast & Continue'}
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
