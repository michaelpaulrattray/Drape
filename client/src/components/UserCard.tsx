/**
 * UserCard — avatar/name/credits header plus the account actions:
 * Settings, Billing, Share Drape, and (for privileged roles) the Admin
 * and Moderation tools, then Sign out.
 *
 * Rendered inside the lobby rail's profile popover (its only live consumer —
 * the studio slim header grew its own inline menu). Colors are tokens, never
 * hardcoded light values: the popover sits on var(--surface), which is dark
 * in the default theme. Role gating mirrors the server:
 * Admin needs role === 'admin' (adminProcedure), Moderation shows for
 * admins and moderators (moderatorProcedure).
 *
 * ---------------------------------------------------------------------------
 * Section 00b (`docs/specs/Casting-ui-ux-design/drape-redesign/00b-chrome-and-menus.md`)
 * brought this onto the foundation grammar. **What it does is unchanged** —
 * same items, same handlers, same role gating, same modals. What changed is
 * how it is set:
 *
 *  - `fontWeight: 600` in three places is gone. The foundation says of itself
 *    that 600 "is never used" (`foundation/index.ts`), and this file was the
 *    largest single source of the violation.
 *  - The credit balance is mono. It is a measured number, and measured numbers
 *    are mono everywhere else in the product.
 *  - The `<style>` block is gone. It shipped the same hover that
 *    `LobbyUtilityMenu` shipped separately, which is how the two drifted; it
 *    lives in `foundation.css` as `.dp-menuitem`, once.
 *  - Tailwind spacing and `rounded-lg` gave way to the `--s-*` and `--r-*`
 *    scales.
 *  - The staff group has a `STAFF` heading. It was two bare dividers with no
 *    label, which reads as an accident rather than a section.
 *  - `Moderator` reads `Moderation`, so both labels name a place.
 *
 * ⚠ **THE COUNT PILLS ARE PROP-DRIVEN AND NOTHING PASSES THEM YET.** The look
 * is here and proven (`section00b-guard.test.ts`), and it omits at zero rather
 * than rendering `(0)`. The NUMBERS are section 01's — `START-HERE.md` assigns
 * them there in as many words ("Staff count badges … covered in brief 01 §3"),
 * they need a server reader that does not exist (pending change requests +
 * unanswered Crew cards; audit rows above `info` in 24h), and 00b's own scope
 * clause excludes "any change to what the menus do". Wiring a new query into
 * the lobby's account menu is exactly that change. So 01 passes the numbers and
 * this file does not grow a query.
 */
import { useLocation } from 'wouter';
import { Settings, CreditCard, Gift, LogOut, LayoutDashboard, Eye } from 'lucide-react';
import { showsMenuCount } from '@/foundation/menuCount';
import { ProfileAvatar } from '@/features/profile/ProfileVisual';

interface UserCardProps {
  userInitial: string;
  userName: string;
  profileImage?: string | null;
  profileIdentity?: { name?: string | null; email?: string | null } | string;
  creditsBalance: number;
  role?: string | null;
  /** Pending change requests + unanswered Crew cards. Omitted at zero. See §01. */
  adminCount?: number;
  /** Audit entries above `info` in the last 24h. Omitted at zero. See §01. */
  moderationCount?: number;
  onOpenSettings: () => void;
  onOpenBilling: () => void;
  onOpenReferral: () => void;
  onLogout: () => void;
}

export function UserCard({
  userInitial,
  userName,
  profileImage,
  profileIdentity,
  creditsBalance,
  role,
  adminCount,
  moderationCount,
  onOpenSettings,
  onOpenBilling,
  onOpenReferral,
  onLogout,
}: UserCardProps) {
  const [, navigate] = useLocation();
  const isAdmin = role === 'admin';
  const isModerator = isAdmin || role === 'moderator';

  return (
    <div className="dp-menu">
      <div className="dp-menu__identity">
        <span className="dp-menu__avatar">
          <ProfileAvatar
            src={profileImage}
            identity={profileIdentity ?? userName ?? userInitial}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </span>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="dp-menu__name truncate">{userName}</span>
          <span className="dp-menu__meta truncate">
            {creditsBalance.toLocaleString()} credits
          </span>
        </span>
      </div>

      <UserMenuItem icon={Settings} label="Settings" onClick={onOpenSettings} />
      <UserMenuItem icon={CreditCard} label="Billing" onClick={onOpenBilling} />
      <UserMenuItem icon={Gift} label="Share Drape" onClick={onOpenReferral} />

      {isModerator && (
        <>
          <div className="dp-menugroup">
            <span className="dp-menugroup__label">STAFF</span>
            <span className="dp-menugroup__rule" aria-hidden="true" />
          </div>
          {isAdmin && (
            <UserMenuItem
              icon={LayoutDashboard}
              label="Admin"
              count={adminCount}
              onClick={() => navigate('/admin/overview')}
            />
          )}
          <UserMenuItem
            icon={Eye}
            label="Moderation"
            count={moderationCount}
            onClick={() => navigate('/moderator')}
          />
        </>
      )}

      <div className="dp-menu__rule" />
      <UserMenuItem icon={LogOut} label="Sign out" onClick={onLogout} accent />
    </div>
  );
}

interface UserMenuItemProps {
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  label: string;
  onClick: () => void;
  /** Rendered as a pill on the right. Omitted at zero — never `(0)`. */
  count?: number;
  accent?: boolean;
}

function UserMenuItem({ icon: Icon, label, onClick, count, accent }: UserMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dp-menuitem${accent ? ' dp-menuitem--accent' : ''}`}
    >
      <Icon size={13} strokeWidth={1.8} />
      <span className="dp-menuitem__label">{label}</span>
      {showsMenuCount(count) ? <span className="dp-menucount">{count}</span> : null}
    </button>
  );
}
