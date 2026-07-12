/**
 * StudioSidePanel — Shared shell for left/right side panels across all tools.
 *
 * Provides consistent styling: 18px rounded corners, soft shadow, warm
 * background. Each tool renders its own content inside this shell.
 *
 * Usage:
 *   <StudioSidePanel side="left" width={320}>
 *     <ControlPanel />
 *   </StudioSidePanel>
 */
import type { ReactNode, CSSProperties } from 'react';

interface StudioSidePanelProps {
  /** Which edge this panel sits on */
  side: 'left' | 'right';
  /** Panel width in pixels */
  width: number;
  /** Panel content */
  children: ReactNode;
  /** Additional className for the wrapper */
  className?: string;
  /** Override background color (default: #F5F3F0) */
  background?: string;
}


export function StudioSidePanel({
  side,
  width,
  children,
  className = '',
  background,
}: StudioSidePanelProps) {
  const isLeft = side === 'left';
  const bg = background ?? 'var(--color-canvas-surface)';

  // Canvas language (R6): flat surface, hairline seam toward the work area,
  // no shadow, no rounded lobe — the panel is a docked surface, not a card.
  const style: CSSProperties = {
    width,
    background: bg,
    ...(isLeft
      ? { borderRight: '0.5px solid var(--color-canvas-border)' }
      : { borderLeft: '0.5px solid var(--color-canvas-border)' }),
  };

  return (
    <aside
      className={`h-full flex flex-col overflow-hidden flex-shrink-0 ${isLeft ? 'z-30' : 'z-20'} ${className}`}
      style={style}
    >
      {children}
    </aside>
  );
}
