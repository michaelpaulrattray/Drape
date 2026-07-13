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
  // D-55 (VC-R6 final): minting is what NAMES and locks identity — the old
  // "Name them and keep exploring" copy claimed exploration while minting
  draft: { name: 'Just the headshot', purpose: 'Mint now, add views anytime at the same price.' },
  core: { name: 'Core identity', purpose: 'Face angles and full body — ready for styling.' },
  // D-51 vocabulary: the composite is the COMP CARD everywhere users read it
  production: { name: 'Full comp card', purpose: 'The full six-view card, for scenes and video.' },
};

const TIER_ORDER: MintTier[] = ['draft', 'core', 'production'];

export interface CastModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with (characterName, tier, stayDraft) — stayDraft = trap ruling
   *  (a): generate the tier's views, the model STAYS a draft (no name). */
  onConfirm: (characterName: string, tier: MintTier, stayDraft?: boolean) => void;
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
      <div className="w-full overflow-hidden rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border-strong" style={{ maxWidth: 380 }}>
        {/* Preview thumbnail */}
        {previewImage && (
          <div className="relative border-b-hairline border-canvas-border" style={{ height: 140 }}>
            <img
              src={previewImage}
              alt="Model preview"
              className="w-full h-full object-cover"
              style={{ objectPosition: 'center 20%' }}
            />
          </div>
        )}

        <div style={{ padding: '16px 24px 20px' }}>
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-4 h-4 text-canvas-ink-soft" />
            <span className="text-canvas-lg font-medium text-canvas-ink">
              {upgrade ? 'Complete the card' : 'Cast this model'}
            </span>
          </div>

          {upgrade ? (
            <p className="text-canvas-md text-canvas-ink-soft leading-normal mb-3.5">
              {fixedName ? `Add the views ${fixedName} is missing.` : 'Add the missing views.'} Upgrading
              later always costs the same — you only pay for what's new.
            </p>
          ) : (
            /* Name input */
            <div className="mb-3.5">
              <label className="block text-canvas-xs font-medium text-canvas-ink-soft mb-1.5">
                Model name
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
                className="w-full outline-none bg-transparent border-0 border-b border-canvas-border focus:border-canvas-ink text-canvas-ink placeholder:text-canvas-ink-faint disabled:opacity-50"
                style={{ padding: '8px 0', fontSize: 16, fontWeight: 500, borderBottomWidth: '1px', borderBottomStyle: 'solid' }}
              />
            </div>
          )}

          {/* Tier picker (D-39) */}
          <div className="mb-3.5">
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
                  className={`flex items-start gap-2.5 w-full text-left transition-colors rounded-canvas-md mb-1.5 px-3 py-2.5 ${
                    selected
                      ? 'bg-canvas-surface-inset border border-canvas-ink'
                      : 'bg-canvas-surface border-hairline border-canvas-border hover:border-canvas-border-strong'
                  } ${isCasting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <div
                    className="flex-shrink-0 rounded-full transition-all bg-canvas-surface"
                    style={{
                      width: 14,
                      height: 14,
                      marginTop: 2,
                      border: selected
                        ? '4.5px solid var(--color-canvas-ink)'
                        : '1.5px solid var(--color-canvas-border-strong)',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-canvas-lg font-medium text-canvas-ink">
                        {TIER_COPY[t].name}
                      </span>
                      <span className="text-canvas-md text-canvas-ink-soft whitespace-nowrap">
                        {plan === undefined
                          ? '…'
                          : complete
                            ? 'Complete'
                            : plan.cost === 0
                              ? 'Free'
                              : `${plan.cost.toLocaleString()} credits`}
                      </span>
                    </div>
                    <span className="block text-canvas-md text-canvas-ink-soft" style={{ lineHeight: 1.4 }}>
                      {TIER_COPY[t].purpose}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Trap ruling (a), sharpened at VC-R6 final: views without
              minting on EVERY tier — the stays-draft path never demands a
              name (a typed name rides as an optional nickname); naming
              stays fused to the mint. Mint mode only (an upgrade is
              already minted). */}
          {!upgrade && (
            <button
              type="button"
              disabled={isCasting}
              onClick={() => onConfirm(name.trim(), tier, true)}
              className="w-full text-left mb-3.5 -mt-1 text-canvas-sm text-canvas-ink-faint hover:text-canvas-ink-soft transition-colors disabled:opacity-40"
            >
              {(tiers?.[tier]?.cost ?? 0) > 0
                ? 'Or add these views and keep exploring — stays a draft, same price'
                : 'Or keep exploring — stays a draft, mint when ready'}
            </button>
          )}

          {/* Casting progress */}
          {isCasting && castingMessage && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-canvas-md bg-canvas-surface-inset text-canvas-lg text-canvas-ink-soft">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{castingMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isCasting}
              className="text-canvas-lg font-medium text-canvas-ink-soft hover:text-canvas-ink transition-colors disabled:opacity-40"
            >
              Keep editing
            </button>
            <button
              onClick={handleConfirm}
              disabled={!confirmable}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-canvas-md transition-colors text-canvas-lg font-medium ${
                confirmable
                  ? 'bg-canvas-ink text-canvas-surface cursor-pointer'
                  : 'bg-canvas-border text-canvas-ink-faint cursor-not-allowed'
              }`}
            >
              {isCasting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {upgrade ? 'Adding...' : 'Casting...'}
                </>
              ) : (
                <>
                  {upgrade ? 'Add views' : 'Cast & continue'}
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
