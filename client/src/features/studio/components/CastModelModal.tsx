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

/** §14 (R8, Batch C): the server's per-tier mint-integrity prediction — the
 *  dialog surfaces each failing check's OWN copy and holds the mint door
 *  shut, so a refusal is never a surprise after money was about to move. */
export interface MintIntegrityPrediction {
  anchor: { ok: boolean; message?: string };
  displayHeadshot: { ok: boolean; message?: string };
  tierViews: Array<{ angle: string; label: string; present: boolean; ok: boolean; message?: string }>;
  ok: boolean;
}
export type TierIntegrity = Record<MintTier, MintIntegrityPrediction>;

const TIER_COPY: Record<MintTier, { name: string; purpose: string }> = {
  // D-55 (VC-R6 final): minting is what NAMES and locks identity — the old
  // "Name them and keep exploring" copy claimed exploration while minting
  draft: { name: 'Just the headshot', purpose: 'Mint now, add views anytime at the same price.' },
  core: { name: 'Core identity', purpose: 'Face angles and full body — ready for styling.' },
  // D-51 vocabulary: the composite is the COMP CARD everywhere users read it
  production: { name: 'Full comp card', purpose: 'The full six-view card, for scenes and video.' },
};

const TIER_ORDER: MintTier[] = ['draft', 'core', 'production'];

/** The arguments each door sends — pure, exported for tests. Honesty rule:
 *  the stays-draft door carries the typed name ONLY on the placed-draft
 *  path (addFirst), whose copy explains it as an optional draft label. A
 *  fresh cast's field is labeled "this mints her identity" (founder-ruled
 *  wording), so its stays-draft door must never silently harvest that
 *  value as a nickname. Mint always names; the guard is the caller's. */
export function confirmArgsForDoor(
  door: 'mint' | 'addViews',
  opts: { addFirst: boolean; name: string; tier: MintTier },
): { characterName: string; tier: MintTier; stayDraft: boolean } {
  const trimmed = opts.name.trim();
  return door === 'mint'
    ? { characterName: trimmed, tier: opts.tier, stayDraft: false }
    : { characterName: opts.addFirst ? trimmed : '', tier: opts.tier, stayDraft: true };
}

export interface CastModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with (characterName, tier, stayDraft) — stayDraft = trap ruling
   *  (a): generate the tier's views, the model STAYS a draft (no name). */
  onConfirm: (characterName: string, tier: MintTier, stayDraft?: boolean) => void;
  /** Plan-derived tier costs; undefined while the plan loads */
  tiers?: TierPlan;
  /** Per-tier §14 mint-integrity prediction (server truth); undefined while
   *  the plan loads. Only gates the MINT door — adding views stays open. */
  integrity?: TierIntegrity;
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
  /** VC-R6 final r2 / defect 4: this subject is an EXISTING placed draft
   *  (re-editing to add views), not a fresh first cast. The dialog then
   *  reads as ADDING VIEWS ("Add N views — she stays a draft"), the primary
   *  is "Add views", and mint (name + mint) is a distinct labeled door.
   *  Every door says where it leads. */
  existingDraft?: boolean;
}

export function CastModelModal({
  isOpen,
  onClose,
  onConfirm,
  tiers,
  integrity,
  isCasting,
  castingMessage,
  previewImage,
  mode = 'mint',
  fixedName,
  existingDraft = false,
}: CastModelModalProps) {
  const [name, setName] = useState('');
  const [tier, setTier] = useState<MintTier>('core');
  const upgrade = mode === 'upgrade';
  // Defect 4: an existing draft's dialog leads with ADDING VIEWS; mint is the
  // distinct deliberate step. A fresh cast leads with mint (name commits).
  const addFirst = existingDraft && !upgrade;
  const selectedGenerates = (tiers?.[tier]?.cost ?? 0) > 0;

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

  // §14 (R8): the selected tier's failing integrity checks, each with its
  // own copy — the mint door holds shut until they resolve. Adding views
  // stays open (it isn't the mint transition).
  const tierIntegrity = integrity?.[tier];
  const integrityMessages = tierIntegrity && !tierIntegrity.ok
    ? [
        ...(!tierIntegrity.anchor.ok && tierIntegrity.anchor.message ? [tierIntegrity.anchor.message] : []),
        ...(!tierIntegrity.displayHeadshot.ok && tierIntegrity.displayHeadshot.message ? [tierIntegrity.displayHeadshot.message] : []),
        ...tierIntegrity.tierViews.filter((v) => !v.ok && v.message).map((v) => v.message!),
      ]
    : [];
  const integrityOk = tierIntegrity ? tierIntegrity.ok : true;

  // Defect 4 — two clearly-labeled doors (mint mode). "Add views" stays a
  // draft (photographs, no commitment); "Name & mint" commits identity
  // (D-43) and requires a name. Which is primary depends on where you stand.
  const canMint = !!name.trim() && !isCasting && integrityOk;
  const canAddViews = selectedGenerates && !isCasting;
  const doMint = useCallback(() => {
    const args = confirmArgsForDoor('mint', { addFirst, name, tier });
    if (args.characterName) onConfirm(args.characterName, args.tier, args.stayDraft);
  }, [addFirst, name, onConfirm, tier]);
  const doAddViews = useCallback(() => {
    if (!selectedGenerates) return;
    const args = confirmArgsForDoor('addViews', { addFirst, name, tier });
    onConfirm(args.characterName, args.tier, args.stayDraft);
  }, [addFirst, name, onConfirm, tier, selectedGenerates]);

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
          {/* Header — the door names where it leads */}
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-4 h-4 text-canvas-ink-soft" />
            <span className="text-canvas-lg font-medium text-canvas-ink">
              {upgrade ? 'Complete the card' : addFirst ? 'Add views' : 'Cast this model'}
            </span>
          </div>

          {upgrade ? (
            <p className="text-canvas-md text-canvas-ink-soft leading-normal mb-3.5">
              {fixedName ? `Add the views ${fixedName} is missing.` : 'Add the missing views.'} Upgrading
              later always costs the same — you only pay for what's new.
            </p>
          ) : (
            /* The name field renders on BOTH non-upgrade paths — audit V9:
               the addFirst branch once had no input at all, so a placed
               draft's "Name & mint" door was permanently disabled with a
               tooltip pointing at a field that didn't exist. */
            <div className="mb-3.5">
              {addFirst && (
                /* Existing draft: views are photographs, not a commitment
                   (D-55). Honest doors: "Add views" keeps her a draft — a
                   typed name then rides along as an OPTIONAL draft label
                   (mintPackage stays-draft nickname); only "Name & mint"
                   locks identity. */
                <p className="text-canvas-md text-canvas-ink-soft leading-normal mb-2.5">
                  Add reference views — she stays a draft, freely editable.
                  Name &amp; mint locks her identity; until then, a typed
                  name is just her draft label.
                </p>
              )}
              <label className="block text-canvas-xs font-medium text-canvas-ink-soft mb-1.5">
                {addFirst
                  ? 'Name — optional draft label until you mint'
                  : 'Name — this mints her identity'}
              </label>
              <input
                autoFocus={!addFirst}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  // Enter in the name field is the mint intent on both paths
                  if (e.key === 'Enter') (addFirst ? doMint : handleConfirm)();
                }}
                placeholder={
                  addFirst
                    ? 'Name her — locked in only when you mint'
                    : 'Enter name to mint, or add views below as a draft'
                }
                disabled={isCasting}
                className="w-full outline-none bg-transparent border-0 border-b border-canvas-border focus:border-canvas-ink text-canvas-ink placeholder:text-canvas-ink-faint disabled:opacity-50"
                style={{ padding: '8px 0', fontSize: 15, fontWeight: 500, borderBottomWidth: '1px', borderBottomStyle: 'solid' }}
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
                      {addFirst && plan && plan.missing.length > 0
                        ? `Adds ${plan.missing.length} view${plan.missing.length === 1 ? '' : 's'} — she stays a draft`
                        : TIER_COPY[t].purpose}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* §14 mint-integrity prediction — each failing check speaks its
              own copy; the mint door below is held shut until resolved */}
          {!upgrade && integrityMessages.length > 0 && (
            <div className="mb-3.5 px-3 py-2 rounded-canvas-md bg-canvas-surface-inset">
              {integrityMessages.map((m, i) => (
                <div key={i} className="text-canvas-md text-canvas-ink-soft" style={{ lineHeight: 1.45 }}>
                  {m}
                </div>
              ))}
            </div>
          )}

          {/* Casting progress */}
          {isCasting && castingMessage && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-canvas-md bg-canvas-surface-inset text-canvas-lg text-canvas-ink-soft">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{castingMessage}</span>
            </div>
          )}

          {/* Actions — every door says where it leads (defect 4) */}
          {upgrade ? (
            <div className="flex justify-end gap-3">
              <button onClick={onClose} disabled={isCasting} className="text-canvas-lg font-medium text-canvas-ink-soft hover:text-canvas-ink transition-colors disabled:opacity-40">
                Keep editing
              </button>
              <button
                onClick={handleConfirm}
                disabled={!confirmable}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-canvas-md transition-colors text-canvas-lg font-medium ${confirmable ? 'bg-canvas-ink text-canvas-surface cursor-pointer' : 'bg-canvas-border text-canvas-ink-faint cursor-not-allowed'}`}
              >
                {isCasting ? <><Loader2 className="w-3 h-3 animate-spin" />Adding...</> : <>Add views<ChevronRight className="w-3 h-3" /></>}
              </button>
            </div>
          ) : (() => {
            // Two doors: "Add views" (stays a draft) and "Name & mint"
            // (commits identity). The primary (dark) depends on where you
            // stand — adding to an existing draft leads with views; a fresh
            // cast leads with mint.
            const addViewsBtn = (primary: boolean) => (
              <button
                key="add"
                type="button"
                onClick={doAddViews}
                disabled={!canAddViews}
                title={!selectedGenerates ? 'This tier adds no new views' : undefined}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-canvas-md transition-colors text-canvas-lg font-medium disabled:opacity-40 ${
                  primary
                    ? (canAddViews ? 'bg-canvas-ink text-canvas-surface cursor-pointer' : 'bg-canvas-border text-canvas-ink-faint cursor-not-allowed')
                    : 'text-canvas-ink-soft border-hairline border-canvas-border-strong hover:text-canvas-ink hover:border-canvas-ink'
                }`}
              >
                {isCasting && primary ? <><Loader2 className="w-3 h-3 animate-spin" />Adding…</> : 'Add views'}
              </button>
            );
            const mintBtn = (primary: boolean) => (
              <button
                key="mint"
                type="button"
                onClick={doMint}
                disabled={!canMint}
                title={
                  !integrityOk
                    ? integrityMessages[0] ?? 'Resolve the flagged views before minting'
                    : !name.trim()
                      ? 'Enter a name to mint her identity'
                      : undefined
                }
                className={`flex items-center gap-1.5 px-4 py-2 rounded-canvas-md transition-colors text-canvas-lg font-medium disabled:opacity-40 ${
                  primary
                    ? (canMint ? 'bg-canvas-ink text-canvas-surface cursor-pointer' : 'bg-canvas-border text-canvas-ink-faint cursor-not-allowed')
                    : 'text-canvas-ink-soft border-hairline border-canvas-border-strong hover:text-canvas-ink hover:border-canvas-ink'
                }`}
              >
                {isCasting && primary ? <><Loader2 className="w-3 h-3 animate-spin" />Minting…</> : <>Name &amp; mint{primary && <ChevronRight className="w-3 h-3" />}</>}
              </button>
            );
            return (
              <div className="flex justify-end items-center gap-2.5">
                <button onClick={onClose} disabled={isCasting} className="text-canvas-lg font-medium text-canvas-ink-soft hover:text-canvas-ink transition-colors disabled:opacity-40 mr-1">
                  Keep editing
                </button>
                {addFirst
                  ? [mintBtn(false), addViewsBtn(true)]
                  : [addViewsBtn(false), mintBtn(true)]}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
