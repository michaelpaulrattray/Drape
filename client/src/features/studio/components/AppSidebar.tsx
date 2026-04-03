/**
 * AppSidebar — ElevenLabs-style collapsible sidebar navigation.
 *
 * Two states:
 *   - Collapsed (~56px): icons only, tooltips on hover
 *   - Expanded (~240px): icons + labels + sections + user card
 *
 * Extends full viewport height (logo inside sidebar, no header above).
 * Pushes content — not an overlay.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import {
  Camera,
  Shirt,
  Download,
  Home,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
  CreditCard,
  Gift,
  Shield,
  Eye,
  LayoutDashboard,
} from 'lucide-react';
import { useStudioStore } from '../stores/useStudioStore';
import { useSessionReset } from '../hooks/useSessionReset';
import {
  type StudioTool,
  STUDIO_TOOLS,
  getToolAvailability,
} from '../types';
import type { CanvasState } from '../types';
import { ToolSwitchConfirmDialog } from './ToolSwitchConfirmDialog';

const SIDEBAR_STORAGE_KEY = 'drape_sidebar_expanded';
const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 240;

/** Icon mapping for each tool */
const TOOL_ICONS: Record<
  StudioTool,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  casting: Camera,
  wardrobe: Shirt,
  export: Download,
};

/** Labels for tools + home */
const TOOL_LABELS: Record<string, string> = {
  casting: 'Cast',
  wardrobe: 'Style',
  export: 'Export',
  home: 'Home',
};

/** Track which tools were previously enabled to detect unlock transitions */
type ToolEnabledMap = Record<StudioTool, boolean>;

interface AppSidebarProps {
  canvas: CanvasState;
  onWardrobeGate?: () => void;
  user: {
    name?: string | null;
    role?: string;
  } | null;
  profileImage?: string | null;
  creditsBalance: number;
  planTier: string;
  onOpenSettings: () => void;
  onOpenBilling: () => void;
  onOpenReferral: () => void;
  onLogout: () => void;
}

export function AppSidebar({
  canvas,
  onWardrobeGate,
  user,
  profileImage,
  creditsBalance,
  planTier,
  onOpenSettings,
  onOpenBilling,
  onOpenReferral,
  onLogout,
}: AppSidebarProps) {
  const activeTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const { resetToLobby, resetAndSwitchTo } = useSessionReset();

  // Expand/collapse state — persisted in localStorage
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  // Confirmation dialog state
  const [pendingAction, setPendingAction] = useState<
    StudioTool | 'home' | null
  >(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  // Glow animation state
  const [glowingTools, setGlowingTools] = useState<Set<StudioTool>>(new Set());
  const prevEnabledRef = useRef<ToolEnabledMap | null>(null);

  // Detect tool unlock transitions
  useEffect(() => {
    const currentEnabled: ToolEnabledMap = {} as ToolEnabledMap;
    for (const tool of STUDIO_TOOLS) {
      currentEnabled[tool.id] = getToolAvailability(tool.id, canvas).enabled;
    }
    const prev = prevEnabledRef.current;
    if (prev) {
      const newlyUnlocked: StudioTool[] = [];
      for (const tool of STUDIO_TOOLS) {
        if (!prev[tool.id] && currentEnabled[tool.id] && activeTool !== tool.id) {
          newlyUnlocked.push(tool.id);
        }
      }
      if (newlyUnlocked.length > 0) {
        setGlowingTools((s) => {
          const next = new Set(s);
          newlyUnlocked.forEach((id) => next.add(id));
          return next;
        });
        const timer = setTimeout(() => {
          setGlowingTools((s) => {
            const next = new Set(s);
            newlyUnlocked.forEach((id) => next.delete(id));
            return next;
          });
        }, 4500);
        return () => clearTimeout(timer);
      }
    }
    prevEnabledRef.current = currentEnabled;
  }, [canvas, activeTool]);

  const clearGlow = useCallback(
    (toolId: StudioTool) => {
      if (glowingTools.has(toolId)) {
        setGlowingTools((s) => {
          const next = new Set(s);
          next.delete(toolId);
          return next;
        });
      }
    },
    [glowingTools],
  );

  const handleToolClick = useCallback(
    (toolId: StudioTool) => {
      const availability = getToolAvailability(toolId, canvas);
      if (!availability.enabled) return;
      clearGlow(toolId);
      if (
        toolId === 'wardrobe' &&
        onWardrobeGate &&
        !canvas.isMinted &&
        canvas.modelSource === 'cast'
      ) {
        onWardrobeGate();
        return;
      }
      if (availability.needsConfirm) {
        setPendingAction(toolId);
        setConfirmMessage(
          availability.confirmMessage ||
            'This action will reset your current progress.',
        );
      } else {
        setActiveTool(toolId);
      }
    },
    [canvas, setActiveTool, clearGlow, onWardrobeGate],
  );

  const handleHomeClick = useCallback(() => {
    setActiveTool(null);
  }, [setActiveTool]);

  const handleConfirm = useCallback(() => {
    if (!pendingAction) return;
    if (pendingAction === 'home') {
      resetToLobby();
    } else {
      resetAndSwitchTo(pendingAction);
    }
    setPendingAction(null);
    setConfirmMessage('');
  }, [pendingAction, resetToLobby, resetAndSwitchTo]);

  const handleCancel = useCallback(() => {
    setPendingAction(null);
    setConfirmMessage('');
  }, []);

  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() || '?';

  const sidebarWidth = expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <>
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 select-none"
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          height: '100vh',
          background: '#fff',
          borderRight: '1px solid rgba(0,0,0,0.06)',
          transition: 'width 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Logo + Toggle area */}
        <div
          className="flex items-center flex-shrink-0"
          style={{
            height: 52,
            padding: expanded ? '0 12px' : '0',
            justifyContent: expanded ? 'space-between' : 'center',
          }}
        >
          {expanded ? (
            <>
              <div className="flex items-center gap-2">
                <img
                  src="/drape-logo.svg"
                  alt="Drape"
                  style={{ height: 18, flexShrink: 0 }}
                />
                <span
                  className="px-1.5 py-0.5 rounded-full uppercase flex-shrink-0"
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: '#8B7355',
                    background: 'rgba(139,115,85,0.08)',
                    border: '1px solid rgba(139,115,85,0.15)',
                  }}
                >
                  Beta
                </span>
              </div>
              <button
                onClick={toggleExpanded}
                className="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
                style={{ color: '#bbb' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
                  e.currentTarget.style.color = '#666';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#bbb';
                }}
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
            </>
          ) : (
            <button
              onClick={toggleExpanded}
              className="w-10 h-10 flex items-center justify-center rounded-md transition-colors"
              style={{ color: '#bbb' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
                e.currentTarget.style.color = '#666';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#bbb';
              }}
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav className="flex-1 flex flex-col gap-0.5 py-1 overflow-y-auto overflow-x-hidden"
          style={{ padding: expanded ? '4px 8px' : '4px 8px' }}
        >
          {/* Home button */}
          <SidebarItem
            icon={Home}
            label="Home"
            active={activeTool === null}
            expanded={expanded}
            onClick={handleHomeClick}
          />

          {/* Section divider + label */}
          <SectionDivider expanded={expanded} label="Tools" />

          {/* Tool buttons */}
          {STUDIO_TOOLS.map((tool) => {
            const Icon = TOOL_ICONS[tool.id];
            const availability = getToolAvailability(tool.id, canvas);
            const isActive = activeTool === tool.id;
            const isGlowing = glowingTools.has(tool.id);

            return (
              <SidebarItem
                key={tool.id}
                icon={Icon}
                label={TOOL_LABELS[tool.id]}
                active={isActive}
                expanded={expanded}
                disabled={!availability.enabled}
                glowing={isGlowing}
                tooltip={availability.tooltip}
                onClick={() => handleToolClick(tool.id)}
              />
            );
          })}

          {/* Admin / Moderator links */}
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <>
              <SectionDivider expanded={expanded} label="Admin" />
              {user?.role === 'admin' && (
                <SidebarLinkItem
                  icon={LayoutDashboard}
                  label="Overview"
                  href="/admin/overview"
                  expanded={expanded}
                />
              )}
              <SidebarLinkItem
                icon={Eye}
                label="Moderator"
                href="/moderator"
                expanded={expanded}
              />
            </>
          )}
        </nav>

        {/* Bottom section — user card */}
        <div
          className="flex-shrink-0 px-2 py-2"
          style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
        >
          {expanded ? (
            <ExpandedUserCard
              userInitial={userInitial}
              userName={user?.name || 'User'}
              profileImage={profileImage}
              creditsBalance={creditsBalance}
              planTier={planTier}
              onOpenSettings={onOpenSettings}
              onOpenBilling={onOpenBilling}
              onOpenReferral={onOpenReferral}
              onLogout={onLogout}
            />
          ) : (
            <CollapsedUserButton
              userInitial={userInitial}
              profileImage={profileImage}
              onOpenSettings={onOpenSettings}
            />
          )}
        </div>
      </aside>

      {/* Glow keyframes */}
      <style>{`
        @keyframes toolGlow {
          0% { box-shadow: 0 0 0 0 rgba(26, 26, 26, 0); }
          50% { box-shadow: 0 0 10px 2px rgba(26, 26, 26, 0.15); }
          100% { box-shadow: 0 0 0 0 rgba(26, 26, 26, 0); }
        }
      `}</style>

      {/* Confirmation dialog */}
      <ToolSwitchConfirmDialog
        isOpen={pendingAction !== null}
        message={confirmMessage}
        targetToolLabel={pendingAction ? TOOL_LABELS[pendingAction] : ''}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

/** Section divider with optional label */
function SectionDivider({ expanded, label }: { expanded: boolean; label: string }) {
  return (
    <div className="pt-3 pb-1">
      {expanded ? (
        <div
          className="px-3 overflow-hidden whitespace-nowrap"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: '#aaa',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
      ) : (
        <div
          className="mx-3 h-px"
          style={{ background: 'rgba(0,0,0,0.06)' }}
        />
      )}
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  active: boolean;
  expanded: boolean;
  disabled?: boolean;
  glowing?: boolean;
  tooltip?: string;
  onClick: () => void;
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  expanded,
  disabled,
  glowing,
  tooltip,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={!expanded ? (tooltip || label) : undefined}
      className="relative flex items-center rounded-lg transition-all duration-150 group"
      style={{
        height: 40,
        gap: expanded ? 12 : 0,
        padding: expanded ? '0 12px' : '0',
        justifyContent: expanded ? 'flex-start' : 'center',
        background: active
          ? '#1a1a1a'
          : glowing
            ? 'rgba(0,0,0,0.04)'
            : 'transparent',
        color: active
          ? '#fff'
          : glowing
            ? '#1a1a1a'
            : disabled
              ? '#d4d4d4'
              : '#666',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        animation: glowing ? 'toolGlow 1.5s ease-in-out 3' : 'none',
        width: expanded ? '100%' : 40,
        margin: expanded ? 0 : '0 auto',
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
          e.currentTarget.style.color = '#1a1a1a';
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled && !glowing) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = disabled ? '#d4d4d4' : '#666';
        }
      }}
    >
      <Icon
        className="w-5 h-5 flex-shrink-0"
        strokeWidth={active ? 2.5 : 2}
      />
      {expanded && (
        <span
          className="truncate"
          style={{
            fontSize: 14,
            fontWeight: active ? 600 : 500,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}

      {/* Active indicator bar (collapsed only) */}
      {active && !expanded && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
          style={{ width: 3, height: 16, background: '#1a1a1a' }}
        />
      )}

      {/* Tooltip (collapsed only) */}
      {!expanded && (
        <div
          className="absolute left-full ml-3 px-2.5 py-1 rounded-md whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{
            background: '#1a1a1a',
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {tooltip || label}
        </div>
      )}
    </button>
  );
}

interface SidebarLinkItemProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  href: string;
  expanded: boolean;
}

function SidebarLinkItem({
  icon: Icon,
  label,
  href,
  expanded,
}: SidebarLinkItemProps) {
  return (
    <Link href={href}>
      <div
        className="relative flex items-center rounded-lg transition-all duration-150 group cursor-pointer"
        style={{
          height: 40,
          gap: expanded ? 12 : 0,
          padding: expanded ? '0 12px' : '0',
          justifyContent: expanded ? 'flex-start' : 'center',
          color: '#666',
          width: expanded ? '100%' : 40,
          margin: expanded ? 0 : '0 auto',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
          e.currentTarget.style.color = '#1a1a1a';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#666';
        }}
      >
        <Icon
          className="w-5 h-5 flex-shrink-0"
          strokeWidth={2}
        />
        {expanded && (
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}
          >
            {label}
          </span>
        )}
        {!expanded && (
          <div
            className="absolute left-full ml-3 px-2.5 py-1 rounded-md whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
            style={{
              background: '#1a1a1a',
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            {label}
          </div>
        )}
      </div>
    </Link>
  );
}

interface ExpandedUserCardProps {
  userInitial: string;
  userName: string;
  profileImage?: string | null;
  creditsBalance: number;
  planTier: string;
  onOpenSettings: () => void;
  onOpenBilling: () => void;
  onOpenReferral: () => void;
  onLogout: () => void;
}

function ExpandedUserCard({
  userInitial,
  userName,
  profileImage,
  creditsBalance,
  planTier,
  onOpenSettings,
  onOpenBilling,
  onOpenReferral,
  onLogout,
}: ExpandedUserCardProps) {
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
        <UserMenuItem
          icon={LogOut}
          label="Log out"
          onClick={onLogout}
          danger
        />
      </div>
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
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg w-full transition-colors"
      style={{ color: '#888' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
        e.currentTarget.style.color = danger ? '#dc2626' : '#1a1a1a';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = '#888';
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

interface CollapsedUserButtonProps {
  userInitial: string;
  profileImage?: string | null;
  onOpenSettings: () => void;
}

function CollapsedUserButton({
  userInitial,
  profileImage,
  onOpenSettings,
}: CollapsedUserButtonProps) {
  return (
    <button
      onClick={onOpenSettings}
      className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 transition-all mx-auto block group relative"
      style={{ border: '1.5px solid rgba(0,0,0,0.08)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
      }}
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
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
            {userInitial}
          </span>
        </div>
      )}
      {/* Tooltip */}
      <div
        className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
        style={{
          background: '#1a1a1a',
          color: '#fff',
          fontSize: 12,
          fontWeight: 500,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        Settings
      </div>
    </button>
  );
}
