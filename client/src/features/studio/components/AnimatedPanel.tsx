/**
 * AnimatedPanel — Wrapper that slides a panel in from a given direction.
 *
 * Used by DrapeStudio to orchestrate the "studio assembles around content"
 * animation. Each panel gets a `ready` flag from useStudioTransition and
 * slides in from its edge when ready becomes true.
 */
import type { ReactNode, CSSProperties } from 'react';

type SlideFrom = 'left' | 'right' | 'bottom' | 'top';

interface AnimatedPanelProps {
  /** Whether this panel should be visible / slid in */
  ready: boolean;
  /** Direction the panel slides in from */
  from: SlideFrom;
  /** How far off-screen the panel starts (px) */
  offset?: number;
  /** Transition duration in ms */
  duration?: number;
  /** Extra CSS classes on the wrapper */
  className?: string;
  /** Extra inline styles */
  style?: CSSProperties;
  children: ReactNode;
}

const TRANSFORM_MAP: Record<SlideFrom, (offset: number) => string> = {
  left: (o) => `translateX(-${o}px)`,
  right: (o) => `translateX(${o}px)`,
  top: (o) => `translateY(-${o}px)`,
  bottom: (o) => `translateY(${o}px)`,
};

export function AnimatedPanel({
  ready,
  from,
  offset = 40,
  duration = 450,
  className = '',
  style = {},
  children,
}: AnimatedPanelProps) {
  return (
    <div
      className={className}
      style={{
        ...style,
        opacity: ready ? 1 : 0,
        transform: ready ? 'translate(0, 0)' : TRANSFORM_MAP[from](offset),
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        willChange: ready ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}
