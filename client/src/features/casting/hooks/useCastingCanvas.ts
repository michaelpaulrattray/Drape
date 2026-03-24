import { useState, useEffect, useRef, useCallback } from "react";
import type { EditTool } from "@/features/casting/constants";

export function useCastingCanvas(
  activeTool: EditTool,
  activeView: string,
  currentAssets: any[]
) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [maskPaths, setMaskPaths] = useState<Array<Array<{x: number, y: number}>>>([]);
  const [currentPath, setCurrentPath] = useState<Array<{x: number, y: number}>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const isMasking = activeTool !== 'none';

  // Reset tool state when view changes
  useEffect(() => {
    setMaskPaths([]);
    setCurrentPath([]);
  }, [activeView, currentAssets]);

  // Clear mask when tool changes
  useEffect(() => {
    setMaskPaths([]);
    setCurrentPath([]);
  }, [activeTool]);

  // Sync canvas with image
  useEffect(() => {
    const syncCanvas = () => {
      if (imageRef.current && canvasRef.current) {
        const { width, height } = imageRef.current.getBoundingClientRect();
        
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        
        const ctx = canvasRef.current.getContext('2d');
        if (ctx && isMasking) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 20; 
          ctx.strokeStyle = activeTool === 'eraser' 
            ? 'rgba(216, 180, 254, 0.8)'
            : 'rgba(255, 100, 100, 0.8)';
          
          if (maskPaths.length > 0) {
            maskPaths.forEach(path => {
              if (path.length < 1) return;
              ctx.beginPath();
              ctx.moveTo(path[0].x * width, path[0].y * height);
              path.forEach(p => ctx.lineTo(p.x * width, p.y * height));
              ctx.stroke();
            });
          }
        }
      }
    };

    syncCanvas();

    if (isMasking) {
      window.addEventListener('resize', syncCanvas);
      setTimeout(syncCanvas, 50);
    }
    
    return () => window.removeEventListener('resize', syncCanvas);
  }, [isMasking, maskPaths, activeTool]);

  // Canvas drawing handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMasking) return;
    setIsDrawing(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentPath([{ x, y }]);
  }, [isMasking]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMasking || !isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const newPoint = { x, y };
    setCurrentPath(prev => [...prev, newPoint]);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 20;
      ctx.strokeStyle = activeTool === 'eraser' 
        ? 'rgba(216, 180, 254, 0.8)'
        : 'rgba(255, 100, 100, 0.8)';
      
      const w = rect.width;
      const h = rect.height;
      
      ctx.beginPath();
      const prev = currentPath[currentPath.length - 1] || newPoint;
      ctx.moveTo(prev.x * w, prev.y * h);
      ctx.lineTo(x * w, y * h);
      ctx.stroke();
    }
  }, [isMasking, isDrawing, activeTool, currentPath]);

  const handlePointerUp = useCallback(() => {
    if (!isMasking || !isDrawing) return;
    setIsDrawing(false);
    setMaskPaths(prev => [...prev, currentPath]);
    setCurrentPath([]);
  }, [isMasking, isDrawing, currentPath]);

  // Generate mask-only overlay image for surgical edit/eraser
  const getGuideOverlayDataUrl = useCallback(async (): Promise<string | undefined> => {
    if (maskPaths.length === 0 || !imageRef.current) return undefined;
    
    const origImg = imageRef.current;
    
    try {
      // Load a fresh copy with crossOrigin to avoid tainted canvas from S3 images
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const freshImg = new Image();
        freshImg.crossOrigin = 'anonymous';
        freshImg.onload = () => resolve(freshImg);
        freshImg.onerror = reject;
        // Append cache-buster to force CORS preflight on the fresh request
        const src = origImg.src;
        freshImg.src = src + (src.includes('?') ? '&' : '?') + '_cors=1';
      });

      const cvs = document.createElement('canvas');
      cvs.width = img.naturalWidth;
      cvs.height = img.naturalHeight;

      const ctx = cvs.getContext('2d');
      if (!ctx) return undefined;

      // Draw base image first, then overlay mask strokes (matches SOT)
      ctx.drawImage(img, 0, 0);

      const brushSize = Math.max(10, img.naturalWidth * 0.04);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.lineWidth = brushSize;
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.45)';

      const drawPaths = () => {
        maskPaths.forEach(path => {
          if (path.length < 1) return;
          ctx.beginPath();
          ctx.moveTo(path[0].x * cvs.width, path[0].y * cvs.height);
          path.forEach(p => ctx.lineTo(p.x * cvs.width, p.y * cvs.height));
          ctx.stroke();
        });
      };
      
      drawPaths();

      ctx.lineWidth = brushSize * 0.8;
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.1)'; 
      drawPaths();

      return cvs.toDataURL('image/png');
    } catch (error) {
      console.error('Failed to generate mask overlay:', error);
      return undefined;
    }
  }, [maskPaths]);

  const clearMask = useCallback(() => {
    setMaskPaths([]);
    setCurrentPath([]);
  }, []);

  return {
    canvasRef,
    imageRef,
    maskPaths,
    isMasking,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getGuideOverlayDataUrl,
    clearMask,
  };
}
