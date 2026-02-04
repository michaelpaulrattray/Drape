import { useEffect, useRef, useState, useCallback } from 'react';

interface DNAHelixProps {
  progress: number; // 0-100
  className?: string;
}

// Section labels for tooltips
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
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevProgress, setPrevProgress] = useState(progress);

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

  // Draw the DNA helix
  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerY = height / 2;
    const numPoints = 90;
    const amplitude = height * 0.18;
    const wavelength = width * 0.7;
    const startX = width * 0.15;
    const time = timeRef.current;

    ctx.clearRect(0, 0, width, height);

    // Calculate progress-based colors
    const progressFactor = progress / 100;
    const baseColor = isComplete ? '34, 197, 94' : '0, 0, 0'; // Green when complete, black otherwise
    const accentColor = isComplete ? '134, 239, 172' : '107, 114, 128'; // Light green or gray

    // Draw particle storm with interconnected network
    const numStormParticles = 120;
    const stormCenterX = width * 0.5;
    const stormCenterY = height * 0.5;
    const stormParticles: { x: number; y: number; size: number; opacity: number }[] = [];

    for (let i = 0; i < numStormParticles; i++) {
      const angle = (time * 0.2 + i * 0.1) % (Math.PI * 2);
      const distance = 40 + (i % 50) * 6;
      const wave = Math.sin(time + i * 0.2) * 25;
      
      const x = stormCenterX + Math.cos(angle) * distance + wave;
      const y = stormCenterY + Math.sin(angle) * (distance * 0.5) + Math.sin(time * 2 + i) * 12;
      
      const size = 1 + Math.random() * 2;
      const baseOpacity = 0.15 + Math.abs(Math.sin(time + i)) * 0.25;
      const opacity = baseOpacity * (0.3 + progressFactor * 0.7);
      
      stormParticles.push({ x, y, size, opacity });
    }

    // Draw connector lines between nearby storm particles
    for (let i = 0; i < stormParticles.length; i++) {
      const p1 = stormParticles[i];
      for (let j = i + 1; j < stormParticles.length; j++) {
        const p2 = stormParticles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 80) {
          const lineOpacity = (1 - distance / 80) * 0.1 * (0.3 + progressFactor * 0.7);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = isComplete 
            ? `rgba(134, 239, 172, ${lineOpacity})` 
            : `rgba(156, 163, 175, ${lineOpacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Draw storm particles
    stormParticles.forEach((particle, i) => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = isComplete 
        ? `rgba(34, 197, 94, ${particle.opacity})` 
        : `rgba(107, 114, 128, ${particle.opacity})`;
      ctx.fill();
      
      if (i % 10 === 0) {
        ctx.shadowBlur = 4;
        ctx.shadowColor = isComplete 
          ? `rgba(34, 197, 94, ${particle.opacity * 0.5})` 
          : `rgba(156, 163, 175, ${particle.opacity * 0.5})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Background scattered particles
    const numBgParticles = 60;
    const bgParticles: { x: number; y: number; size: number; opacity: number }[] = [];
    
    for (let i = 0; i < numBgParticles; i++) {
      const x = (width * 0.08) + (i / numBgParticles) * width * 0.84;
      const y = height * 0.15 + Math.sin(time + i * 0.5) * height * 0.7;
      const size = 1 + Math.random() * 1.5;
      const opacity = (0.1 + Math.abs(Math.sin(time * 0.5 + i)) * 0.2) * (0.3 + progressFactor * 0.7);
      
      bgParticles.push({ x, y, size, opacity });
    }

    // Draw connector lines for background particles
    for (let i = 0; i < bgParticles.length; i++) {
      const p1 = bgParticles[i];
      for (let j = i + 1; j < Math.min(i + 5, bgParticles.length); j++) {
        const p2 = bgParticles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 120) {
          const lineOpacity = (1 - distance / 120) * 0.06 * (0.3 + progressFactor * 0.7);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = isComplete 
            ? `rgba(134, 239, 172, ${lineOpacity})` 
            : `rgba(203, 213, 224, ${lineOpacity})`;
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }
      }
    }

    // Draw background particles
    bgParticles.forEach(particle => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = isComplete 
        ? `rgba(134, 239, 172, ${particle.opacity})` 
        : `rgba(156, 163, 175, ${particle.opacity})`;
      ctx.fill();
    });

    // Molecular circles
    const circles = [
      { x: width * 0.12, y: height * 0.25 },
      { x: width * 0.22, y: height * 0.72 },
      { x: width * 0.78, y: height * 0.28 },
      { x: width * 0.88, y: height * 0.68 }
    ];

    circles.forEach((circle, i) => {
      const radius = 15 + Math.sin(time + i * 0.5) * 4;
      const circleOpacity = 0.1 + progressFactor * 0.1;
      
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isComplete 
        ? `rgba(134, 239, 172, ${circleOpacity})` 
        : `rgba(203, 213, 224, ${circleOpacity})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, radius * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = isComplete 
        ? `rgba(34, 197, 94, ${circleOpacity * 0.7})` 
        : `rgba(226, 232, 240, ${circleOpacity * 0.7})`;
      ctx.lineWidth = 0.4;
      ctx.stroke();
    });

    // Draw DNA helix strands
    for (let strand = 0; strand < 2; strand++) {
      const phaseOffset = strand * Math.PI + time;
      const points: { x: number; y: number; z: number }[] = [];

      // Generate points for this strand
      for (let i = 0; i < numPoints; i++) {
        const t = (i / numPoints) * 3 * Math.PI * 2;
        const x = startX + (i / numPoints) * wavelength;
        const y = centerY + Math.sin(t + phaseOffset) * amplitude;
        const z = Math.cos(t + phaseOffset);
        points.push({ x, y, z });
      }

      // Draw connecting lines between points (strand curve)
      ctx.beginPath();
      ctx.strokeStyle = isComplete 
        ? `rgba(34, 197, 94, 0.6)` 
        : `rgba(${baseColor}, 0.5)`;
      ctx.lineWidth = 2.5;
      
      points.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();

      // Draw particles at each point on the strand
      points.forEach((point) => {
        const size = 2 + Math.abs(point.z) * 2;
        const opacity = 0.4 + Math.abs(point.z) * 0.4;

        ctx.beginPath();
        ctx.fillStyle = isComplete 
          ? `rgba(34, 197, 94, ${opacity})` 
          : `rgba(${baseColor}, ${opacity})`;
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect for front particles
        if (point.z > 0.3) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = isComplete 
            ? `rgba(34, 197, 94, ${opacity * 0.6})` 
            : `rgba(${baseColor}, ${opacity * 0.4})`;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
    }

    // Draw base pair connections (rungs)
    const numBasePairs = 30;
    const litRungs = Math.floor((progress / 100) * numBasePairs);
    
    for (let i = 0; i < numBasePairs; i++) {
      const t = (i / numBasePairs) * 3 * Math.PI * 2 + time;
      const x = startX + (i / numBasePairs) * wavelength;
      const y1 = centerY + Math.sin(t) * amplitude;
      const y2 = centerY + Math.sin(t + Math.PI) * amplitude;
      const z = Math.cos(t);

      const isLit = i < litRungs;
      const baseOpacity = 0.4 + Math.abs(z) * 0.4;
      const opacity = isLit ? baseOpacity : baseOpacity * 0.3;
      
      // Draw the rung line
      ctx.beginPath();
      ctx.strokeStyle = isLit 
        ? (isComplete ? `rgba(34, 197, 94, ${opacity})` : `rgba(59, 130, 246, ${opacity})`)
        : `rgba(${baseColor}, ${opacity * 0.5})`;
      ctx.lineWidth = isLit ? 2.5 : 1.5;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();

      // Draw larger spheres at rung endpoints for lit rungs
      if (isLit) {
        const sphereSize = 4 + Math.abs(z) * 2;
        const sphereColor = isComplete ? '34, 197, 94' : '59, 130, 246';
        
        ctx.beginPath();
        ctx.fillStyle = `rgba(${sphereColor}, ${opacity})`;
        ctx.arc(x, y1, sphereSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.fillStyle = `rgba(${sphereColor}, ${opacity})`;
        ctx.arc(x, y2, sphereSize, 0, Math.PI * 2);
        ctx.fill();

        // Highlight effect
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
        ctx.arc(x - 1, y1 - 1, sphereSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
        ctx.arc(x - 1, y2 - 1, sphereSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

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
        
        ctx.beginPath();
        ctx.fillStyle = `rgba(34, 197, 94, ${opacity})`;
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Completion ripple effect
    if (isComplete) {
      const rippleTime = (Date.now() % 3000) / 3000;
      
      for (let r = 0; r < 3; r++) {
        const ripplePhase = (rippleTime + r * 0.33) % 1;
        const radius = 50 + ripplePhase * 120;
        const opacity = (1 - ripplePhase) * 0.3;
        
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 197, 94, ${opacity})`;
        ctx.lineWidth = 1.5 - ripplePhase;
        ctx.stroke();
      }
    }
  }, [progress, isComplete, showCelebration]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      timeRef.current += 0.008;
      const rect = container.getBoundingClientRect();
      draw(ctx, rect.width, rect.height);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [draw]);

  // Calculate which section is active
  const activeSection = Math.min(Math.floor((progress / 100) * 6), 5);
  const sectionProgress = progress > 0 ? SECTION_LABELS[activeSection] : 'Not Started';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} style={{ minHeight: '280px' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
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
