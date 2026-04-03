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

const SHADOW_LEFT = '2px 0 8px rgba(0,0,0,0.08), 8px 0 40px rgba(0,0,0,0.10)';
const SHADOW_RIGHT = '-2px 0 8px rgba(0,0,0,0.08), -8px 0 40px rgba(0,0,0,0.10)';

export function StudioSidePanel({
  side,
  width,
  children,
  className = '',
  background,
}: StudioSidePanelProps) {
  const isLeft = side === 'left';
  const bg = background ?? '#F5F3F0';

  const style: CSSProperties = {
    width,
    background: bg,
    borderRadius: isLeft ? '0 18px 18px 0' : '18px 0 0 18px',
    boxShadow: isLeft ? SHADOW_LEFT : SHADOW_RIGHT,
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
