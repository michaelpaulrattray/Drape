import { useEffect, useRef, useState, useCallback } from 'react';

interface DNAHelixProps {
  progress: number; // 0-100
  className?: string;
}

interface BackgroundDot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  size: number;
  opacity: number;
  speed: number;
}

interface DecorativeCircle {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

interface ConnectionLine {
  from: number;
  to: number;
}

// Section labels for progress display
const SECTION_LABELS = [
  'Casting Basics',
  'Identity',
  'Physique',
  'Skin',
  'Eyes',
  'Hair',
];

export function DNAHelix({ progress, className = '' }: DNAHelixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number | null; y: number | null; radius: number }>({ x: null, y: null, radius: 120 });
  const backgroundDotsRef = useRef<BackgroundDot[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevProgress, setPrevProgress] = useState(progress);

  // Decorative circles (like in reference image)
  const decorativeCircles: DecorativeCircle[] = [
    { x: 0.08, y: 0.25, radius: 60, opacity: 0.12 },
    { x: 0.15, y: 0.35, radius: 40, opacity: 0.08 },
    { x: 0.12, y: 0.70, radius: 50, opacity: 0.10 },
    { x: 0.88, y: 0.30, radius: 55, opacity: 0.10 },
    { x: 0.92, y: 0.45, radius: 35, opacity: 0.07 },
    { x: 0.85, y: 0.68, radius: 45, opacity: 0.09 },
    { x: 0.78, y: 0.22, radius: 30, opacity: 0.06 },
    { x: 0.22, y: 0.78, radius: 38, opacity: 0.08 },
  ];

  // Molecular connection lines between some circles
  const connectionLines: ConnectionLine[] = [
    { from: 0, to: 1 },
    { from: 1, to: 2 },
    { from: 3, to: 4 },
    { from: 4, to: 5 },
  ];

  // Generate background dots
  const generateBackgroundDots = useCallback((count: number): BackgroundDot[] => {
    const dots: BackgroundDot[] = [];
    for (let i = 0; i < count; i++) {
      dots.push({
        x: Math.random(),
        y: Math.random(),
        vx: 0,
        vy: 0,
        baseX: Math.random(),
        baseY: Math.random(),
        size: 1 + Math.random() * 3,
        opacity: 0.1 + Math.random() * 0.25,
        speed: 0.0002 + Math.random() * 0.0005
      });
    }
    return dots;
  }, []);

  // Trigger celebration when progress reaches 100
  useEffect(() => {
    if (progress >= 100 && prevProgress < 100) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevProgress(progress);
  }, [progress, prevProgress]);

  const isComplete = progress >= 100;

  // Draw background elements
  const drawBackgroundElements = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ) => {
    const centerY = height / 2;
    const progressColor = '255, 255, 255'; // White glow throughout

    // Draw decorative circles
    decorativeCircles.forEach((circle, i) => {
      const x = circle.x * width;
      const y = circle.y * height;
      const pulseOffset = Math.sin(time * 0.5 + i) * 3;

      ctx.beginPath();
      ctx.arc(x, y, circle.radius + pulseOffset, 0, Math.PI * 2);
      ctx.strokeStyle = isComplete 
        ? `rgba(40, 40, 40, ${circle.opacity * 2})` 
        : `rgba(180, 180, 180, ${circle.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw connection lines between circles
    connectionLines.forEach(line => {
      const from = decorativeCircles[line.from];
      const to = decorativeCircles[line.to];

      ctx.beginPath();
      ctx.moveTo(from.x * width, from.y * height);
      ctx.lineTo(to.x * width, to.y * height);
      ctx.strokeStyle = isComplete 
        ? 'rgba(40, 40, 40, 0.15)' 
        : 'rgba(180, 180, 180, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Store particle positions for grab lines
    const particlePositions: { x: number; y: number; size: number; opacity: number }[] = [];
    const mouse = mouseRef.current;

    // Draw and update scattered dots with physics
    backgroundDotsRef.current.forEach((dot, i) => {
      let px = dot.x * width;
      let py = dot.y * height;

      // Gravitational pull toward the helix center
      const helixCenterX = width / 2;
      const dxHelix = helixCenterX - px;
      const dyHelix = centerY - py;
      const distToHelix = Math.sqrt(dxHelix * dxHelix + dyHelix * dyHelix);

      // Only apply gravity if particle is not too close to helix
      if (distToHelix > 80) {
        const gravityStrength = 0.00003;
        dot.vx += (dxHelix / distToHelix) * gravityStrength * distToHelix;
        dot.vy += (dyHelix / distToHelix) * gravityStrength * distToHelix * 0.5;
      } else {
        // Gentle orbit around helix when close
        const orbitSpeed = 0.0008;
        dot.vx += dyHelix * orbitSpeed;
        dot.vy -= dxHelix * orbitSpeed * 0.3;
      }

      // Mouse grab/attract effect
      if (mouse.x !== null && mouse.y !== null) {
        const dxMouse = mouse.x - px;
        const dyMouse = mouse.y - py;
        const distToMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

        if (distToMouse < mouse.radius) {
          const force = (mouse.radius - distToMouse) / mouse.radius;
          const attractStrength = 0.02;
          dot.vx += (dxMouse / distToMouse) * force * attractStrength;
          dot.vy += (dyMouse / distToMouse) * force * attractStrength;
        }
      }

      // Gentle return to base position (very subtle)
      const baseX = dot.baseX * width;
      const baseY = dot.baseY * height;
      dot.vx += (baseX - px) * 0.0001;
      dot.vy += (baseY - py) * 0.0001;

      // Apply velocity with damping
      dot.vx *= 0.98;
      dot.vy *= 0.98;

      dot.x += dot.vx / width;
      dot.y += dot.vy / height;

      // Keep particles in bounds
      if (dot.x < 0) { dot.x = 0; dot.vx *= -0.5; }
      if (dot.x > 1) { dot.x = 1; dot.vx *= -0.5; }
      if (dot.y < 0) { dot.y = 0; dot.vy *= -0.5; }
      if (dot.y > 1) { dot.y = 1; dot.vy *= -0.5; }

      // Update positions
      px = dot.x * width;
      py = dot.y * height;

      // Subtle floating movement on top of physics
      const offsetX = Math.sin(time * dot.speed * 1000 + i) * 2;
      const offsetY = Math.cos(time * dot.speed * 800 + i * 0.5) * 2;

      const finalX = px + offsetX;
      const finalY = py + offsetY;

      particlePositions.push({ x: finalX, y: finalY, size: dot.size, opacity: dot.opacity });

      // Draw the dot
      ctx.beginPath();
      ctx.arc(finalX, finalY, dot.size, 0, Math.PI * 2);
      ctx.fillStyle = isComplete 
        ? `rgba(30, 30, 30, ${dot.opacity * 1.5})` 
        : `rgba(120, 120, 120, ${dot.opacity})`;
      ctx.fill();
    });

    // Draw grab effect lines from mouse to nearby particles
    if (mouse.x !== null && mouse.y !== null) {
      particlePositions.forEach(particle => {
        const dx = mouse.x! - particle.x;
        const dy = mouse.y! - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius) {
          const opacity = (1 - dist / mouse.radius) * 0.4;

          ctx.beginPath();
          ctx.moveTo(mouse.x!, mouse.y!);
          ctx.lineTo(particle.x, particle.y);
          ctx.strokeStyle = isComplete 
            ? `rgba(30, 30, 30, ${opacity * 1.5})` 
            : `rgba(80, 80, 80, ${opacity})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // Draw lines between particles that are near the mouse
      const nearbyParticles = particlePositions.filter(p => {
        const dx = mouse.x! - p.x;
        const dy = mouse.y! - p.y;
        return Math.sqrt(dx * dx + dy * dy) < mouse.radius;
      });

      for (let i = 0; i < nearbyParticles.length; i++) {
        for (let j = i + 1; j < nearbyParticles.length; j++) {
          const p1 = nearbyParticles[i];
          const p2 = nearbyParticles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 100) {
            const opacity = (1 - dist / 100) * 0.3;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isComplete 
              ? `rgba(30, 30, 30, ${opacity * 1.5})` 
              : `rgba(80, 80, 80, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }
  }, [isComplete, decorativeCircles, connectionLines]);

  // Draw a single rung
  const drawRung = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y1: number,
    y2: number,
    z: number,
    isLit: boolean
  ) => {
    const depthFactor = 0.3 + (z + 1) * 0.35; // 0.3 to 1.0

    // Save context state for glow effect
    ctx.save();

    // Main rung line
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    
    if (isLit) {
      // Black glow effect using shadowBlur for high contrast
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 8 + depthFactor * 6;
      ctx.strokeStyle = `rgba(30, 30, 30, ${depthFactor * 0.95})`;
      ctx.lineWidth = 2.5 + depthFactor * 1.5;
    } else {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(150, 150, 150, ${depthFactor * 0.5})`;
      ctx.lineWidth = 1.5 + depthFactor;
    }
    ctx.stroke();

    // Draw endpoint spheres for lit rungs
    if (isLit) {
      const sphereSize = 3.5 + depthFactor * 2.5;

      // Black glow spheres
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 10 + depthFactor * 8;

      ctx.beginPath();
      ctx.arc(x, y1, sphereSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(20, 20, 20, ${depthFactor * 0.95})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y2, sphereSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(20, 20, 20, ${depthFactor * 0.95})`;
      ctx.fill();
    }

    // Restore context state
    ctx.restore();
  }, []);

  // Draw the DNA helix
  const drawDNAHelix = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ) => {
    const centerY = height / 2;

    // DNA parameters
    const helixLength = width * 0.7;
    const startX = (width - helixLength) / 2;
    const amplitude = 50; // Vertical wave amplitude
    const frequency = 2.5; // Number of complete rotations
    const numPoints = 100;
    const numRungs = 25;

    // Calculate progress-based lit rungs
    const litRungs = Math.floor((progress / 100) * numRungs);

    // Calculate points for both strands
    const strand1Points: { x: number; y: number; z: number; angle: number }[] = [];
    const strand2Points: { x: number; y: number; z: number; angle: number }[] = [];

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = startX + t * helixLength;
      const angle = t * frequency * Math.PI * 2 + time;

      // Strand 1 (front/back alternating)
      const y1 = centerY + Math.sin(angle) * amplitude;
      const z1 = Math.cos(angle); // depth (-1 to 1)

      // Strand 2 (opposite phase)
      const y2 = centerY + Math.sin(angle + Math.PI) * amplitude;
      const z2 = Math.cos(angle + Math.PI);

      strand1Points.push({ x, y: y1, z: z1, angle });
      strand2Points.push({ x, y: y2, z: z2, angle: angle + Math.PI });
    }

    // Draw rungs (base pairs) - need to draw back ones first
    const rungData: { x: number; y1: number; y2: number; z: number; index: number }[] = [];
    for (let i = 0; i < numRungs; i++) {
      const t = (i + 0.5) / numRungs;
      const x = startX + t * helixLength;
      const angle = t * frequency * Math.PI * 2 + time;

      const y1 = centerY + Math.sin(angle) * amplitude;
      const y2 = centerY + Math.sin(angle + Math.PI) * amplitude;
      const z = Math.cos(angle);

      rungData.push({ x, y1, y2, z, index: i });
    }

    // Sort rungs by depth (draw back to front)
    rungData.sort((a, b) => a.z - b.z);

    // Draw back rungs first
    rungData.forEach(rung => {
      if (rung.z < 0) {
        drawRung(ctx, rung.x, rung.y1, rung.y2, rung.z, rung.index < litRungs);
      }
    });

    // Draw strands (back parts first)
    const drawStrandParts = (points: typeof strand1Points, isBack: boolean) => {
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const shouldDraw = isBack ? (p1.z < 0 && p2.z < 0) : (p1.z >= 0 || p2.z >= 0);
        
        if (shouldDraw) {
          const avgZ = (p1.z + p2.z) / 2;
          const depthFactor = 0.25 + (avgZ + 1) * 0.375;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          // Keep strands gray - only rungs glow white
          ctx.strokeStyle = `rgba(60, 60, 60, ${depthFactor})`;
          ctx.lineWidth = 1.5 + depthFactor * 1.5;
          ctx.stroke();
        }
      }
    };

    // Draw back parts of both strands
    drawStrandParts(strand1Points, true);
    drawStrandParts(strand2Points, true);

    // Draw front parts of both strands
    drawStrandParts(strand1Points, false);
    drawStrandParts(strand2Points, false);

    // Draw front rungs
    rungData.forEach(rung => {
      if (rung.z >= 0) {
        drawRung(ctx, rung.x, rung.y1, rung.y2, rung.z, rung.index < litRungs);
      }
    });

    // Draw nodes on strands
    const allNodes: { x: number; y: number; z: number }[] = [];
    const nodeInterval = 4;
    for (let i = 0; i < strand1Points.length; i += nodeInterval) {
      allNodes.push(strand1Points[i]);
      allNodes.push(strand2Points[i]);
    }

    // Sort by depth (draw back to front)
    allNodes.sort((a, b) => a.z - b.z);

    allNodes.forEach(node => {
      const depthFactor = 0.3 + (node.z + 1) * 0.35;
      const size = 2.5 + depthFactor * 3;

      // Shadow for depth
      ctx.beginPath();
      ctx.arc(node.x + 1, node.y + 1, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${depthFactor * 0.15})`;
      ctx.fill();

      // Main node - keep gray (strands don't glow)
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(50, 50, 50, ${depthFactor * 0.9})`;
      ctx.fill();

      // Highlight for front nodes
      if (node.z > 0.3) {
        ctx.beginPath();
        ctx.arc(node.x - size * 0.3, node.y - size * 0.3, size * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${depthFactor * 0.3})`;
        ctx.fill();
      }
    });

    // Celebration effect - burst particles
    if (showCelebration) {
      const celebrationTime = (Date.now() % 3000) / 3000;
      const numBurstParticles = 36;

      for (let i = 0; i < numBurstParticles; i++) {
        const angle = (i / numBurstParticles) * Math.PI * 2;
        const distance = celebrationTime * 150;
        const x = width / 2 + Math.cos(angle) * distance;
        const y = height / 2 + Math.sin(angle) * distance;
        const size = (1 - celebrationTime) * 6;
        const opacity = (1 - celebrationTime) * 0.8;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.fillStyle = `rgba(20, 20, 20, ${opacity})`;
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Completion ripple effect
    if (isComplete) {
      const rippleTime = (Date.now() % 3000) / 3000;

      for (let r = 0; r < 3; r++) {
        const ripplePhase = (rippleTime + r * 0.33) % 1;
        const radius = 50 + ripplePhase * 120;
        const opacity = (1 - ripplePhase) * 0.3;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(30, 30, 30, ${opacity})`;
        ctx.lineWidth = 1.5 - ripplePhase;
        ctx.stroke();
        ctx.restore();
      }
    }
  }, [progress, isComplete, showCelebration, drawRung]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize background dots
    if (backgroundDotsRef.current.length === 0) {
      backgroundDotsRef.current = generateBackgroundDots(80);
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const animate = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Reset transform and clear
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply DPR scaling
      ctx.scale(dpr, dpr);

      drawBackgroundElements(ctx, rect.width, rect.height, timeRef.current);
      drawDNAHelix(ctx, rect.width, rect.height, timeRef.current);

      timeRef.current += 0.008; // Slow rotation
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationRef.current);
    };
  }, [generateBackgroundDots, drawBackgroundElements, drawDNAHelix]);

  // Calculate which section is active
  const activeSection = Math.min(Math.floor((progress / 100) * 6), 5);
  const sectionProgress = progress > 0 ? SECTION_LABELS[activeSection] : 'Not Started';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} style={{ minHeight: '280px' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{ minHeight: '280px' }}
      />

      {/* Progress indicator text */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
        <span className={`text-xs font-mono tracking-wider transition-all duration-300 ${
          isComplete ? 'text-green-600 font-semibold' : 'text-gray-400'
        } ${showCelebration ? 'scale-110' : ''}`}>
          {isComplete ? '✓ SEQUENCE COMPLETE' : `SEQUENCING... ${Math.round(progress)}%`}
        </span>
        {!isComplete && progress > 0 && (
          <div className="text-[10px] text-gray-500 mt-0.5">
            {sectionProgress}
          </div>
        )}
      </div>
    </div>
  );
}

export default DNAHelix;
