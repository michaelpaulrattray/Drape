import { useMemo, useEffect, useState } from 'react';

interface DNAHelixProps {
  progress: number; // 0-100
  className?: string;
}

// Progress thresholds for each section (6 sections, 2 rungs each = 12 rungs total)
const SECTION_THRESHOLDS = [
  { name: 'basics', threshold: 16.67 },      // Rungs 1-2: Casting basics
  { name: 'identity', threshold: 33.33 },    // Rungs 3-4: Gender, age, ethnicity
  { name: 'physique', threshold: 50 },       // Rungs 5-6: Body type, face shape
  { name: 'skin', threshold: 66.67 },        // Rungs 7-8: Skin tone, texture
  { name: 'eyes', threshold: 83.33 },        // Rungs 9-10: Eye color
  { name: 'hair', threshold: 100 },          // Rungs 11-12: Hair
];

export function DNAHelix({ progress, className = '' }: DNAHelixProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevProgress, setPrevProgress] = useState(progress);

  // Trigger celebration when progress reaches 100
  useEffect(() => {
    if (progress >= 100 && prevProgress < 100) {
      setShowCelebration(true);
      // Reset celebration after animation completes
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevProgress(progress);
  }, [progress, prevProgress]);

  // Calculate which rungs should be lit based on progress
  const litRungs = useMemo(() => {
    const rungs: boolean[] = [];
    for (let i = 0; i < 12; i++) {
      const sectionIndex = Math.floor(i / 2);
      const threshold = SECTION_THRESHOLDS[sectionIndex].threshold;
      rungs.push(progress >= threshold * ((i % 2 === 0) ? 0.5 : 1));
    }
    return rungs;
  }, [progress]);

  // Find the active rung (the next one to be filled)
  const activeRungIndex = useMemo(() => {
    for (let i = 0; i < 12; i++) {
      if (!litRungs[i]) return i;
    }
    return -1; // All complete
  }, [litRungs]);

  const isComplete = progress >= 100;
  const isDormant = progress === 0;

  // Generate particle positions
  const particles = useMemo(() => {
    const p = [];
    for (let i = 0; i < 20; i++) {
      p.push({
        cx: 50 + Math.random() * 700,
        cy: 30 + Math.random() * 140,
        r: 1 + Math.random() * 3,
        delay: Math.random() * 3,
        duration: 2 + Math.random() * 2,
      });
    }
    return p;
  }, []);

  // Generate celebration burst particles
  const celebrationParticles = useMemo(() => {
    const p = [];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      p.push({
        angle,
        delay: Math.random() * 0.3,
        speed: 80 + Math.random() * 60,
      });
    }
    return p;
  }, []);

  // Calculate helix points for smooth sine wave
  const helixPoints = useMemo(() => {
    const points: { x: number; y: number; phase: number }[] = [];
    const numPoints = 12;
    const width = 600;
    const startX = 100;
    
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const x = startX + t * width;
      const phase = t * Math.PI * 3; // 1.5 full rotations
      points.push({ x, y: 100, phase });
    }
    return points;
  }, []);

  return (
    <div className={`relative w-full ${className}`}>
      {/* CSS for custom animations */}
      <style>{`
        @keyframes activePulse {
          0%, 100% { 
            transform: scale(1);
            filter: drop-shadow(0 0 0px rgba(59, 130, 246, 0));
          }
          50% { 
            transform: scale(1.3);
            filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6));
          }
        }
        @keyframes celebrationBurst {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0);
            opacity: 0;
          }
        }
        @keyframes celebrationGlow {
          0% { filter: drop-shadow(0 0 0px rgba(34, 197, 94, 0)); }
          50% { filter: drop-shadow(0 0 20px rgba(34, 197, 94, 0.8)); }
          100% { filter: drop-shadow(0 0 0px rgba(34, 197, 94, 0)); }
        }
        @keyframes celebrationText {
          0% { transform: translateX(-50%) scale(0.8); opacity: 0; }
          20% { transform: translateX(-50%) scale(1.1); opacity: 1; }
          40% { transform: translateX(-50%) scale(1); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        .active-rung {
          animation: activePulse 1.5s ease-in-out infinite;
          transform-origin: center;
        }
        .celebration-glow {
          animation: celebrationGlow 1s ease-out;
        }
        .celebration-text {
          animation: celebrationText 0.6s ease-out forwards;
        }
      `}</style>

      <svg
        viewBox="0 0 800 200"
        className="w-full h-auto"
        style={{ maxHeight: '280px' }}
      >
        <defs>
          {/* Gradient for lit base pairs */}
          <linearGradient id="litGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="50%" stopColor="#1f2937" />
            <stop offset="100%" stopColor="#374151" />
          </linearGradient>
          
          {/* Glow filter for complete state */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Active pulse glow filter */}
          <filter id="activeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Subtle shadow */}
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15" />
          </filter>

          {/* Hexagon pattern for background */}
          <pattern id="hexPattern" width="30" height="26" patternUnits="userSpaceOnUse">
            <path
              d="M15 0 L30 7.5 L30 22.5 L15 30 L0 22.5 L0 7.5 Z"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="0.5"
              opacity="0.3"
            />
          </pattern>
        </defs>

        {/* Background hexagonal pattern - fades based on progress */}
        <rect
          x="0"
          y="0"
          width="800"
          height="200"
          fill="url(#hexPattern)"
          opacity={0.1 + (progress / 100) * 0.2}
          className="transition-opacity duration-1000"
        />

        {/* Floating particles */}
        <g className={`${isDormant ? 'opacity-20' : 'opacity-100'} transition-opacity duration-500`}>
          {particles.map((particle, i) => {
            const shouldShow = progress > (i / particles.length) * 100;
            return (
              <circle
                key={i}
                cx={particle.cx}
                cy={particle.cy}
                r={particle.r}
                fill={isComplete ? "#22c55e" : "#9ca3af"}
                opacity={shouldShow ? 0.4 : 0.1}
                className="transition-all duration-500"
              >
                <animate
                  attributeName="cy"
                  values={`${particle.cy};${particle.cy - 10};${particle.cy}`}
                  dur={`${particle.duration}s`}
                  begin={`${particle.delay}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values={shouldShow ? "0.4;0.6;0.4" : "0.1;0.15;0.1"}
                  dur={`${particle.duration}s`}
                  begin={`${particle.delay}s`}
                  repeatCount="indefinite"
                />
              </circle>
            );
          })}
        </g>

        {/* DNA Double Helix Structure */}
        <g 
          filter={isComplete ? "url(#glow)" : "url(#shadow)"}
          className={showCelebration ? 'celebration-glow' : ''}
        >
          {/* Back strand (sine wave going down) */}
          <path
            d={`M ${helixPoints.map((p, i) => {
              const y = 100 + Math.sin(p.phase) * 35;
              return `${i === 0 ? 'M' : 'L'} ${p.x} ${y}`;
            }).join(' ')}`}
            fill="none"
            stroke={isDormant ? "#d1d5db" : (isComplete ? "#22c55e" : "#6b7280")}
            strokeWidth="2"
            strokeLinecap="round"
            className="transition-all duration-500"
            opacity={isDormant ? 0.3 : 0.6}
          />

          {/* Front strand (sine wave going up) */}
          <path
            d={`M ${helixPoints.map((p, i) => {
              const y = 100 - Math.sin(p.phase) * 35;
              return `${i === 0 ? 'M' : 'L'} ${p.x} ${y}`;
            }).join(' ')}`}
            fill="none"
            stroke={isDormant ? "#d1d5db" : (isComplete ? "#16a34a" : "#374151")}
            strokeWidth="2.5"
            strokeLinecap="round"
            className="transition-all duration-500"
            opacity={isDormant ? 0.3 : 0.8}
          />

          {/* Base pairs (rungs) with connecting lines */}
          {helixPoints.map((point, i) => {
            const y1 = 100 + Math.sin(point.phase) * 35;
            const y2 = 100 - Math.sin(point.phase) * 35;
            const isLit = litRungs[i];
            const isActive = i === activeRungIndex && !isComplete;
            
            // Determine which sphere is in front based on phase
            const frontIsTop = Math.cos(point.phase) > 0;
            
            // Colors based on state
            const litColor = isComplete ? "#16a34a" : "#1f2937";
            const litColorSecondary = isComplete ? "#22c55e" : "#4b5563";
            const activeColor = "#3b82f6"; // Blue for active
            
            return (
              <g key={i}>
                {/* Connecting line (rung) */}
                <line
                  x1={point.x}
                  y1={y1}
                  x2={point.x}
                  y2={y2}
                  stroke={isActive ? activeColor : (isLit ? (isComplete ? "#86efac" : "#9ca3af") : "#e5e7eb")}
                  strokeWidth={isActive ? "2" : (isLit ? "1.5" : "1")}
                  opacity={isDormant ? 0.2 : (isActive ? 0.9 : (isLit ? 0.7 : 0.4))}
                  className="transition-all duration-300"
                />
                
                {/* Active rung glow effect */}
                {isActive && (
                  <g filter="url(#activeGlow)">
                    <line
                      x1={point.x}
                      y1={y1}
                      x2={point.x}
                      y2={y2}
                      stroke={activeColor}
                      strokeWidth="3"
                      opacity="0.3"
                    />
                  </g>
                )}
                
                {/* Base pair spheres - render order based on 3D position */}
                {frontIsTop ? (
                  <>
                    {/* Back sphere (bottom) */}
                    <circle
                      cx={point.x}
                      cy={y1}
                      r={isActive ? 9 : (isLit ? 7 : 5)}
                      fill={isActive ? activeColor : (isLit ? litColorSecondary : "#d1d5db")}
                      opacity={isDormant ? 0.3 : (isActive ? 1 : (isLit ? 0.9 : 0.5))}
                      className={`transition-all duration-300 ${isActive ? 'active-rung' : ''}`}
                      style={{ transformOrigin: `${point.x}px ${y1}px` }}
                    />
                    {/* Front sphere (top) */}
                    <circle
                      cx={point.x}
                      cy={y2}
                      r={isActive ? 10 : (isLit ? 8 : 6)}
                      fill={isActive ? activeColor : (isLit ? litColor : "#9ca3af")}
                      opacity={isDormant ? 0.3 : (isActive ? 1 : (isLit ? 1 : 0.6))}
                      className={`transition-all duration-300 ${isActive ? 'active-rung' : ''}`}
                      style={{ transformOrigin: `${point.x}px ${y2}px` }}
                    />
                    {/* Highlight on front sphere */}
                    {(isLit || isActive) && !isDormant && (
                      <circle
                        cx={point.x - 2}
                        cy={y2 - 2}
                        r={isActive ? 3 : 2}
                        fill="white"
                        opacity={isActive ? 0.6 : 0.4}
                        className={isActive ? 'active-rung' : ''}
                        style={{ transformOrigin: `${point.x - 2}px ${y2 - 2}px` }}
                      />
                    )}
                  </>
                ) : (
                  <>
                    {/* Back sphere (top) */}
                    <circle
                      cx={point.x}
                      cy={y2}
                      r={isActive ? 9 : (isLit ? 7 : 5)}
                      fill={isActive ? activeColor : (isLit ? litColorSecondary : "#d1d5db")}
                      opacity={isDormant ? 0.3 : (isActive ? 1 : (isLit ? 0.9 : 0.5))}
                      className={`transition-all duration-300 ${isActive ? 'active-rung' : ''}`}
                      style={{ transformOrigin: `${point.x}px ${y2}px` }}
                    />
                    {/* Front sphere (bottom) */}
                    <circle
                      cx={point.x}
                      cy={y1}
                      r={isActive ? 10 : (isLit ? 8 : 6)}
                      fill={isActive ? activeColor : (isLit ? litColor : "#9ca3af")}
                      opacity={isDormant ? 0.3 : (isActive ? 1 : (isLit ? 1 : 0.6))}
                      className={`transition-all duration-300 ${isActive ? 'active-rung' : ''}`}
                      style={{ transformOrigin: `${point.x}px ${y1}px` }}
                    />
                    {/* Highlight on front sphere */}
                    {(isLit || isActive) && !isDormant && (
                      <circle
                        cx={point.x - 2}
                        cy={y1 - 2}
                        r={isActive ? 3 : 2}
                        fill="white"
                        opacity={isActive ? 0.6 : 0.4}
                        className={isActive ? 'active-rung' : ''}
                        style={{ transformOrigin: `${point.x - 2}px ${y1 - 2}px` }}
                      />
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* Outer decorative circles (molecular nodes) */}
        <g opacity={isDormant ? 0.1 : 0.3} className="transition-opacity duration-500">
          {/* Left side nodes */}
          <circle cx="60" cy="60" r="15" fill="none" stroke={isComplete ? "#86efac" : "#d1d5db"} strokeWidth="0.5" />
          <circle cx="40" cy="100" r="20" fill="none" stroke={isComplete ? "#86efac" : "#d1d5db"} strokeWidth="0.5" />
          <circle cx="70" cy="150" r="12" fill="none" stroke={isComplete ? "#86efac" : "#d1d5db"} strokeWidth="0.5" />
          
          {/* Right side nodes */}
          <circle cx="740" cy="50" r="18" fill="none" stroke={isComplete ? "#86efac" : "#d1d5db"} strokeWidth="0.5" />
          <circle cx="760" cy="110" r="14" fill="none" stroke={isComplete ? "#86efac" : "#d1d5db"} strokeWidth="0.5" />
          <circle cx="730" cy="160" r="22" fill="none" stroke={isComplete ? "#86efac" : "#d1d5db"} strokeWidth="0.5" />
          
          {/* Small dots */}
          <circle cx="55" cy="45" r="2" fill={isComplete ? "#22c55e" : "#9ca3af"} opacity={progress > 20 ? 0.6 : 0.2} />
          <circle cx="30" cy="85" r="1.5" fill={isComplete ? "#22c55e" : "#9ca3af"} opacity={progress > 40 ? 0.6 : 0.2} />
          <circle cx="80" cy="130" r="2.5" fill={isComplete ? "#22c55e" : "#9ca3af"} opacity={progress > 60 ? 0.6 : 0.2} />
          <circle cx="750" cy="70" r="2" fill={isComplete ? "#22c55e" : "#9ca3af"} opacity={progress > 30 ? 0.6 : 0.2} />
          <circle cx="770" cy="130" r="1.5" fill={isComplete ? "#22c55e" : "#9ca3af"} opacity={progress > 50 ? 0.6 : 0.2} />
          <circle cx="720" cy="145" r="3" fill={isComplete ? "#22c55e" : "#9ca3af"} opacity={progress > 80 ? 0.6 : 0.2} />
        </g>

        {/* Celebration burst particles */}
        {showCelebration && (
          <g>
            {celebrationParticles.map((particle, i) => {
              const tx = Math.cos(particle.angle) * particle.speed;
              const ty = Math.sin(particle.angle) * particle.speed;
              return (
                <circle
                  key={i}
                  cx="400"
                  cy="100"
                  r={3 + Math.random() * 3}
                  fill="#22c55e"
                  style={{
                    '--tx': `${tx}px`,
                    '--ty': `${ty}px`,
                    animation: `celebrationBurst 1s ease-out ${particle.delay}s forwards`,
                  } as React.CSSProperties}
                />
              );
            })}
          </g>
        )}

        {/* Completion ripple effect */}
        {isComplete && (
          <g>
            <circle cx="400" cy="100" r="150" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.4">
              <animate
                attributeName="r"
                values="80;180;80"
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.4;0;0.4"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="400" cy="100" r="120" fill="none" stroke="#22c55e" strokeWidth="0.5" opacity="0.3">
              <animate
                attributeName="r"
                values="60;150;60"
                dur="3s"
                begin="0.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.3;0;0.3"
                dur="3s"
                begin="0.5s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        )}
      </svg>

      {/* Progress indicator text */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
        <span className={`text-xs font-mono tracking-wider transition-all duration-300 ${
          isComplete ? 'text-green-600 font-semibold' : 'text-gray-400'
        } ${showCelebration ? 'celebration-text' : ''}`}>
          {isComplete ? '✓ SEQUENCE COMPLETE' : `SEQUENCING... ${Math.round(progress)}%`}
        </span>
      </div>
    </div>
  );
}

export default DNAHelix;
