/**
 * UserCard — avatar/name/credits header plus the account actions:
 * Settings, Billing, Share Drape, and (for privileged roles) the Admin
 * and Moderator tools, then Log out.
 *
 * Shared by the studio sidebar (rendered inline when expanded) and the
 * lobby rail (rendered inside the profile popover), so account actions
 * look and behave the same everywhere. Role gating mirrors the server:
 * Admin needs role === 'admin' (adminProcedure), Moderator shows for
 * admins and moderators (moderatorProcedure).
 */
import { useLocation } from 'wouter';
import { Settings, CreditCard, Gift, LogOut, LayoutDashboard, Eye } from 'lucide-react';

interface UserCardProps {
  userInitial: string;
  userName: string;
  profileImage?: string | null;
  creditsBalance: number;
  role?: string | null;
  onOpenSettings: () => void;
  onOpenBilling: () => void;
  onOpenReferral: () => void;
  onLogout: () => void;
}

export function UserCard({
  userInitial,
  userName,
  profileImage,
  creditsBalance,
  role,
  onOpenSettings,
  onOpenBilling,
  onOpenReferral,
  onLogout,
}: UserCardProps) {
  const [, navigate] = useLocation();
  const isAdmin = role === 'admin';
  const isModerator = isAdmin || role === 'moderator';
  return (
    <div className="space-y-1">
      {/* User info row */}
      <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
        <div
          className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
          style={{ border: '1.5px solid rgba(0,0,0,0.08)' }}
        >
          {profileImage ? (
            <img
              src={profileImage}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: '#1a1a1a' }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>
                {userInitial}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="truncate"
            style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}
          >
            {userName}
          </p>
          <p
            className="truncate"
            style={{ fontSize: 11, color: '#999' }}
          >
            {creditsBalance.toLocaleString()} credits
          </p>
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="flex flex-col">
        <UserMenuItem
          icon={Settings}
          label="Settings"
          onClick={onOpenSettings}
        />
        <UserMenuItem
          icon={CreditCard}
          label="Billing"
          onClick={onOpenBilling}
        />
        <UserMenuItem
          icon={Gift}
          label="Share Drape"
          onClick={onOpenReferral}
        />
        {isModerator && (
          <>
            <div className="my-1" style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />
            {isAdmin && (
              <UserMenuItem
                icon={LayoutDashboard}
                label="Admin"
                onClick={() => navigate('/admin/overview')}
              />
            )}
            <UserMenuItem
              icon={Eye}
              label="Moderator"
              onClick={() => navigate('/moderator')}
            />
            <div className="my-1" style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />
          </>
        )}
        <UserMenuItem
          icon={LogOut}
          label="Log out"
          onClick={onLogout}
          danger
        />
      </div>

      <style>{`
        .user-card-menu-item {
          color: #888;
        }
        .user-card-menu-item:hover {
          background: rgba(0,0,0,0.04);
          color: #1a1a1a;
        }
        .user-card-menu-item-danger:hover {
          color: #dc2626;
        }
      `}</style>
    </div>
  );
}

interface UserMenuItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function UserMenuItem({ icon: Icon, label, onClick, danger }: UserMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg w-full transition-colors user-card-menu-item ${danger ? 'user-card-menu-item-danger' : ''}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
    </button>
  );
}
