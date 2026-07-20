/**
 * StudioSlimHeader — the one environment chrome (R6 shell unification,
 * ruling R-4a: one environment, one look, two doors).
 *
 * Replaces the legacy AppSidebar + StudioHeader pair — the last chrome of
 * the retired linear pipeline (tool rail, stage navigation). What was
 * load-bearing in the sidebar relocates here: back-to-lobby, the balance
 * figure (D-45 pattern), and a profile popover carrying settings / billing /
 * referral / log out. Tool switching does not relocate — navigation between
 * environments happens via the lobby and the library chooser (the
 * decomposition law: the USER composes the sequence).
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, PanelLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';

export interface StudioSlimHeaderProps {
  title: string;
  user: { name?: string | null; email?: string | null } | null;
  profileImage: string | null;
  creditsBalance: number;
  onOpenTopup: () => void;
  onOpenSettings: () => void;
  onOpenBilling: () => void;
  onOpenReferral: () => void;
  onLogout: () => void;
  primaryAction?: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
  };
}

export function StudioSlimHeader({
  title,
  user,
  profileImage,
  creditsBalance,
  onOpenTopup,
  onOpenSettings,
  onOpenBilling,
  onOpenReferral,
  onLogout,
  primaryAction,
}: StudioSlimHeaderProps) {
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { showMobilePanel, setShowMobilePanel } = useCastingUIStore();

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  const menuItem =
    'w-full text-left px-3 py-2 text-canvas-md text-canvas-ink-soft hover:bg-canvas-surface-inset hover:text-canvas-ink transition-colors';

  return (
    <div className="flex items-center justify-between px-4 flex-shrink-0 bg-canvas-surface border-b-hairline border-canvas-border" style={{ height: 52 }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => navigate('/app')}
          aria-label="Back to lobby"
          className="w-7 h-7 rounded-canvas-sm flex items-center justify-center transition-colors text-canvas-ink-soft hover:bg-canvas-surface-inset"
        >
          <ArrowLeft size={15} strokeWidth={1.8} />
        </button>
        <span className="truncate text-canvas-lg font-medium text-canvas-ink">{title}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Mobile: control-panel toggle (relocated from the legacy header) */}
        <button
          type="button"
          onClick={() => setShowMobilePanel(!showMobilePanel)}
          aria-label="Toggle controls"
          className="lg:hidden w-7 h-7 rounded-canvas-sm flex items-center justify-center transition-colors text-canvas-ink-soft hover:bg-canvas-surface-inset"
        >
          <PanelLeft size={15} strokeWidth={1.8} />
        </button>

        {/* D-45: balance where credits are spent — quiet tabular figure */}
        <button
          type="button"
          onClick={onOpenTopup}
          title="Credit balance — top up"
          className="px-2 py-1 rounded-canvas-sm transition-colors text-canvas-md text-canvas-ink-soft hover:bg-canvas-surface-inset"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {creditsBalance.toLocaleString()} credits
        </button>
        <span aria-hidden className="w-px h-4 bg-canvas-border" />

        {primaryAction && (
          <>
            <button
              type="button"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
              className="px-4 py-1.5 rounded-canvas-pill transition-opacity duration-200 disabled:opacity-40 text-canvas-md font-medium bg-canvas-ink hover:opacity-90"
              style={{ color: 'var(--color-canvas-surface)' }}
            >
              {primaryAction.label}
            </button>
            <span aria-hidden className="w-px h-4 bg-canvas-border" />
          </>
        )}

        {/* Profile popover — the sidebar UserCard's relocated actions */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Profile"
            className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center bg-canvas-surface-inset border-hairline border-canvas-border text-canvas-xs font-medium text-canvas-ink-soft hover:border-canvas-border-strong transition-colors"
          >
            {profileImage ? (
              <img src={profileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-50 w-52 py-1.5 rounded-canvas-md bg-canvas-surface border-hairline border-canvas-border-strong">
              <div className="px-3 pt-1.5 pb-2 border-b-hairline border-canvas-border">
                <div className="text-canvas-md font-medium text-canvas-ink truncate">
                  {user?.name || 'Account'}
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-canvas-sm text-canvas-ink-soft" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {creditsBalance.toLocaleString()} credits
                  </span>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onOpenTopup(); }}
                    className="text-canvas-sm font-medium text-canvas-ink hover:underline"
                  >
                    Top up
                  </button>
                </div>
              </div>
              <div className="pt-1">
                <button type="button" className={menuItem} onClick={() => { setMenuOpen(false); onOpenSettings(); }}>Settings</button>
                <button type="button" className={menuItem} onClick={() => { setMenuOpen(false); onOpenBilling(); }}>Billing</button>
                <button type="button" className={menuItem} onClick={() => { setMenuOpen(false); onOpenReferral(); }}>Referral</button>
                <div className="my-1 border-t-hairline border-canvas-border" />
                <button type="button" className={menuItem} onClick={() => { setMenuOpen(false); onLogout(); }}>Log out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
