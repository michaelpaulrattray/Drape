/**
 * ToolsIndex — the three tool entries on /app, as an editorial index.
 *
 * Numbered full-width rows with hairline dividers, not tiles. Each entry
 * is a plain navigation (or one mutation for New Canvas) — when Wardrobe
 * becomes its own tool, only its href changes here.
 */
import { useLocation } from 'wouter';
import { ArrowRight, Loader2 } from 'lucide-react';

interface ToolsIndexProps {
  onNewCanvas: () => void;
  isCreatingCanvas: boolean;
  /** True when the user has no work yet — the index reads as a guided path. */
  firstRun?: boolean;
}

interface ToolRowProps {
  number: string;
  title: string;
  description: string;
  onClick: () => void;
  pending?: boolean;
  cue?: string;
}

function ToolRow({ number, title, description, onClick, pending, cue }: ToolRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="group/tool w-full flex items-center gap-5 sm:gap-8 py-6 text-left"
      style={{
        borderTop: '1px solid rgba(0,0,0,0.08)',
        cursor: pending ? 'wait' : 'pointer',
        background: 'transparent',
      }}
    >
      <span
        className="flex-shrink-0"
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: '#B0AFA8',
          letterSpacing: '0.06em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {number}
      </span>
      <span
        className="flex-shrink-0"
        style={{
          fontSize: 'clamp(19px, 2.5vw, 24px)',
          fontWeight: 600,
          color: '#1a1a1a',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </span>
      {cue && (
        <span
          className="flex-shrink-0 hidden sm:block"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#B0AFA8',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {cue}
        </span>
      )}
      <span
        className="hidden sm:block ml-auto text-right"
        style={{ fontSize: 14, color: '#71716A' }}
      >
        {description}
      </span>
      <span className="flex-shrink-0 sm:ml-0 ml-auto">
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#71716A' }} />
        ) : (
          <ArrowRight
            className="w-4 h-4 transition-transform duration-300 group-hover/tool:translate-x-1"
            style={{ color: '#71716A' }}
            strokeWidth={1.5}
          />
        )}
      </span>
    </button>
  );
}

export function ToolsIndex({ onNewCanvas, isCreatingCanvas, firstRun }: ToolsIndexProps) {
  const [, navigate] = useLocation();

  return (
    <section>
      <h2
        className="mb-2"
        style={{ fontSize: 13, fontWeight: 600, color: '#71716A', letterSpacing: '0.06em', textTransform: 'uppercase' }}
      >
        Tools
      </h2>
      <div style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <ToolRow
          number="01"
          title="Casting Studio"
          description="Cast and refine AI models from a brief"
          onClick={() => navigate('/studio?tool=casting&new=1')}
          cue={firstRun ? 'Start here' : undefined}
        />
        <ToolRow
          number="02"
          title="Wardrobe"
          description="Digitize garments and dress your models"
          onClick={() => navigate('/studio?tool=wardrobe')}
        />
        <ToolRow
          number="03"
          title="New Canvas"
          description="An open board to compose everything"
          onClick={onNewCanvas}
          pending={isCreatingCanvas}
        />
      </div>
    </section>
  );
}
