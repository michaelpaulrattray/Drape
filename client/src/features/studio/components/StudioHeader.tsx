import { useState, useRef, useEffect } from 'react';
import { Menu, X, Sparkles, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { BugReportTrigger } from '@/components/BugReportButton';
import { FeedbackPopout } from './FeedbackPopout';
import { useStudioStore } from '../stores/useStudioStore';

/** Tool label mapping for breadcrumb */
const TOOL_BREADCRUMBS: Record<string, string> = {
  casting: 'Casting Studio',
  wardrobe: 'Wardrobe',
  export: 'Export',
};

/** Hardcoded news items — replace with API later */
const NEWS_ITEMS = [
  {
    id: '1',
    title: 'Introducing Wardrobe',
    description:
      'Dress your AI models with any garment. Upload a photo and see it styled instantly.',
    date: 'Mar 2026',
    isNew: true,
  },
  {
    id: '2',
    title: 'Casting Studio v2',
    description:
      'Faster generation, better quality, and new iteration tools for refining your models.',
    date: 'Feb 2026',
    isNew: false,
  },
  {
    id: '3',
    title: 'Export & Download',
    description:
      'Export your models in high resolution. Batch download all views in one click.',
    date: 'Jan 2026',
    isNew: false,
  },
];

/** Styled text link for the header bar */
function HeaderLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="hidden sm:block transition-colors"
      style={{
        fontSize: 13,
        fontWeight: 500,
        color: '#888',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 0',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = '#1a1a1a';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = '#888';
      }}
    >
      {label}
    </button>
  );
}

/** Bell icon with news dropdown */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('drape_read_news');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const unreadCount = NEWS_ITEMS.filter((n) => !readIds.has(n.id)).length;

  // Mark all as read when opening
  useEffect(() => {
    if (open && unreadCount > 0) {
      const allIds = new Set(NEWS_ITEMS.map((n) => n.id));
      setReadIds(allIds);
      localStorage.setItem(
        'drape_read_news',
        JSON.stringify(Array.from(allIds))
      );
    }
  }, [open, unreadCount]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative hidden sm:block">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="relative flex h-7 w-7 items-center justify-center rounded-full transition-all"
        style={{
          background: open ? 'rgba(0,0,0,0.06)' : 'transparent',
          color: open ? '#1a1a1a' : '#888',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
          e.currentTarget.style.color = '#1a1a1a';
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#888';
          }
        }}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center rounded-full"
            style={{
              top: 2,
              right: 2,
              width: 8,
              height: 8,
              background: '#e85d4a',
            }}
          />
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute top-full right-0 mt-2 rounded-xl shadow-lg z-[9999] overflow-hidden"
          style={{
            width: 360,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
              What's New
            </span>
          </div>

          {/* News list */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {NEWS_ITEMS.map((item, i) => (
              <div
                key={item.id}
                className="px-4 py-3.5 transition-colors"
                style={{
                  borderBottom:
                    i < NEWS_ITEMS.length - 1
                      ? '1px solid rgba(0,0,0,0.04)'
                      : 'none',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#1a1a1a',
                        }}
                      >
                        {item.title}
                      </span>
                      {item.isNew && (
                        <span
                          className="rounded-full px-1.5 py-0.5"
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            background: '#f0ebe3',
                            color: '#8B7355',
                          }}
                        >
                          NEW
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: '#666',
                        lineHeight: 1.5,
                        marginTop: 4,
                      }}
                    >
                      {item.description}
                    </p>
                    <span
                      style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}
                      className="block"
                    >
                      {item.date}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StudioHeader() {
  const { showMobilePanel, setShowMobilePanel } = useCastingUIStore();
  const activeTool = useStudioStore((s) => s.activeTool);

  const breadcrumb = activeTool
    ? TOOL_BREADCRUMBS[activeTool] || 'Studio'
    : 'Studio';

  return (
    <header
      className="h-12 flex-shrink-0 flex items-center justify-between px-5 z-30"
      style={{
        background: '#fff',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {/* Left: Icon + Breadcrumb */}
      <div className="flex items-center gap-2">
        <Sparkles
          className="flex-shrink-0"
          style={{ width: 15, height: 15, color: '#8B7355', opacity: 0.7 }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#1a1a1a',
            letterSpacing: '-0.01em',
          }}
        >
          {breadcrumb}
        </span>
      </div>

      {/* Right: Feedback · Docs · Bug · Bell · Mobile Toggle */}
      <div className="flex items-center gap-4">
        <FeedbackPopout />
        <HeaderLink
          label="Docs"
          onClick={() => {
            toast('Documentation coming soon', {
              description: 'Guides for each tool are being written.',
            });
          }}
        />

        {/* Bug Report Icon */}
        <BugReportTrigger />

        {/* Notifications Bell */}
        <NotificationBell />

        {/* Mobile Panel Toggle */}
        <button
          onClick={() => setShowMobilePanel(!showMobilePanel)}
          className="lg:hidden p-1.5 rounded-full"
          style={{ background: '#1a1a1a', color: '#fff' }}
        >
          {showMobilePanel ? (
            <X className="w-3.5 h-3.5" />
          ) : (
            <Menu className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </header>
  );
}
