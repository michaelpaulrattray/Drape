import { Menu, X } from 'lucide-react';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { BugReportTrigger } from '@/components/BugReportButton';
import { useStudioStore } from '../stores/useStudioStore';

/** Tool label mapping for breadcrumb */
const TOOL_BREADCRUMBS: Record<string, string> = {
  casting: 'Casting Studio',
  wardrobe: 'Wardrobe',
  export: 'Export',
};

interface StudioHeaderProps {
  creditsBalance: number;
  planTier: string;
}

export function StudioHeader({ creditsBalance }: StudioHeaderProps) {
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
      {/* Left: Breadcrumb */}
      <div className="flex items-center">
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

      {/* Right: Credits + Bug Report + Mobile Toggle */}
      <div className="flex items-center gap-3">
        {/* Credits Pill */}
        <button
          onClick={() => useCastingUIStore.getState().setIsTopupOpen(true)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors"
          style={{ background: '#F5F3F0' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#EBE7E2';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#F5F3F0';
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#1a1a1a' }}
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
            {creditsBalance}
          </span>
        </button>

        {/* Bug Report */}
        <BugReportTrigger />

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
