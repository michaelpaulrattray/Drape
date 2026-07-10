/**
 * LobbyRail — quiet table-of-contents navigation for the /app lobby.
 *
 * Three groups separated by hairline dividers: workspace (Home, Boards),
 * Library (Models, Garments, Looks), account, with the user row (avatar,
 * name, credit balance) pinned at the very bottom. The user row opens
 * the same account card as the studio sidebar: Settings, Billing, Share
 * Drape, Log out. Text-forward, no filled highlights — the active item
 * simply reads darker.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { UserCard } from '@/components/UserCard';

interface LobbyRailProps {
  user: { id: number; name: string | null; avatarUrl?: string | null; role?: string } | null;
  profileImage?: string | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenBilling: () => void;
  onOpenReferral: () => void;
}

interface RailItemProps {
  label: string;
  active?: boolean;
  onClick: () => void;
}

function RailItem({ label, active, onClick }: RailItemProps) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left py-1.5 transition-colors duration-200"
      style={{
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        color: active ? '#1a1a1a' : '#71716A',
        background: 'transparent',
        letterSpacing: '-0.005em',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = '#1a1a1a';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = '#71716A';
      }}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-4" style={{ height: 1, background: 'rgba(0,0,0,0.08)' }} />;
}

export function LobbyRail({
  user,
  profileImage,
  onLogout,
  onOpenSettings,
  onOpenBilling,
  onOpenReferral,
}: LobbyRailProps) {
  const [location, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: credits } = trpc.credits.getBalance.useQuery(undefined, {
    staleTime: 30_000,
  });

  const avatarUrl = profileImage ?? user?.avatarUrl ?? null;

  return (
    <aside
      className="hidden md:flex flex-col flex-shrink-0 px-6 py-6"
      style={{ width: 216, borderRight: '1px solid rgba(0,0,0,0.08)' }}
    >
      {/* Logo */}
      <button onClick={() => navigate('/app')} className="block text-left mb-8">
        <img src="/drape-logo.svg" alt="drape" style={{ height: 20 }} />
      </button>

      {/* Workspace */}
      <nav className="flex flex-col">
        <RailItem label="Home" active={location === '/app'} onClick={() => navigate('/app')} />
        <RailItem
          label="Canvas"
          active={location === '/app/boards'}
          onClick={() => navigate('/app/boards')}
        />
      </nav>

      <Divider />

      {/* Library */}
      <span
        className="mb-1.5"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#B0AFA8',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Library
      </span>
      <nav className="flex flex-col">
        <RailItem
          label="Models"
          active={location === '/app/models'}
          onClick={() => navigate('/app/models')}
        />
        <RailItem
          label="Garments"
          active={location === '/app/garments'}
          onClick={() => navigate('/app/garments')}
        />
        <RailItem
          label="Looks"
          active={location === '/app/looks'}
          onClick={() => navigate('/app/looks')}
        />
      </nav>

      {/* Account — pinned to the bottom */}
      {user && (
        <div className="mt-auto">
          <Divider />
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2.5 w-full py-1.5 text-left"
              aria-label="Account menu"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.name ?? 'User'}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  style={{ border: '1px solid rgba(0,0,0,0.06)' }}
                />
              ) : (
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#1a1a1a', color: '#fff', fontSize: 11, fontWeight: 600 }}
                >
                  {(user.name ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span
                  className="block truncate"
                  style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}
                >
                  {user.name ?? 'Account'}
                </span>
                <span
                  className="block truncate"
                  style={{ fontSize: 11, color: '#999', fontVariantNumeric: 'tabular-nums' }}
                >
                  {credits ? `${credits.balance.toLocaleString()} credits` : ' '}
                </span>
              </span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute left-0 bottom-full mb-2 z-50 p-1.5 rounded-xl"
                  style={{
                    background: '#fff',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                    border: '1px solid rgba(0,0,0,0.06)',
                    width: 200,
                  }}
                >
                  <UserCard
                    userInitial={(user.name ?? '?').charAt(0).toUpperCase()}
                    userName={user.name ?? 'Account'}
                    profileImage={avatarUrl}
                    creditsBalance={credits?.balance ?? 0}
                    role={user.role}
                    onOpenSettings={() => {
                      setMenuOpen(false);
                      onOpenSettings();
                    }}
                    onOpenBilling={() => {
                      setMenuOpen(false);
                      onOpenBilling();
                    }}
                    onOpenReferral={() => {
                      setMenuOpen(false);
                      onOpenReferral();
                    }}
                    onLogout={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
