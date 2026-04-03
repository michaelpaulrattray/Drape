import { Menu, X, Sparkles } from 'lucide-react';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { BugReportTrigger } from '@/components/BugReportButton';
import { useStudioStore } from '../stores/useStudioStore';

/** Tool label mapping for breadcrumb */
const TOOL_BREADCRUMBS: Record<string, string> = {
  casting: 'Casting Studio',
  wardrobe: 'Wardrobe',
  export: 'Export',
};

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

      {/* Right: Bug Report + Mobile Toggle */}
      <div className="flex items-center gap-3">
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
