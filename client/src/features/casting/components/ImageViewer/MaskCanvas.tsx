import { RefObject } from 'react';
import { type EditTool } from '@/features/casting/constants';

interface MaskCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isMasking: boolean;
  activeTool: EditTool;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: () => void;
}

export function MaskCanvas({
  canvasRef,
  isMasking,
  activeTool,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: MaskCanvasProps) {
  const cursorClass =
    activeTool === 'eraser'
      ? 'cursor-eraser'
      : activeTool === 'surgical'
        ? 'cursor-brush'
        : 'cursor-crosshair';

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 touch-none ${
        isMasking ? 'pointer-events-auto z-20' : 'pointer-events-none z-10'
      } ${cursorClass}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

export default MaskCanvas;
