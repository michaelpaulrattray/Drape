# DNA Helix Progress Component

A React/TypeScript SVG component that displays an animated DNA double helix with progress tracking, network particles, and celebration effects.

## Usage

```tsx
import { DNAHelix } from './components/DNAHelix';

// In your component:
<DNAHelix progress={42} className="my-4" />
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `progress` | `number` | Progress value from 0-100 |
| `className` | `string` | Optional CSS classes |

## Full Component Code

```tsx
import { useMemo, useEffect, useState } from 'react';

interface DNAHelixProps {
  progress: number; // 0-100
  className?: string;
}

// Section labels for tooltips
const SECTION_LABELS = [
  { name: 'Casting Basics', shortName: 'Basics' },
  { name: 'Casting Basics', shortName: 'Basics' },
  { name: 'Identity', shortName: 'Identity' },
  { name: 'Identity', shortName: 'Identity' },
  { name: 'Physique', shortName: 'Physique' },
  { name: 'Physique', shortName: 'Physique' },
  { name: 'Skin', shortName: 'Skin' },
  { name: 'Skin', shortName: 'Skin' },
  { name: 'Eyes', shortName: 'Eyes' },
  { name: 'Eyes', shortName: 'Eyes' },
  { name: 'Hair', shortName: 'Hair' },
  { name: 'Hair', shortName: 'Hair' },
];

// Progress thresholds for each section (6 sections, 2 rungs each = 12 rungs total)
const SECTION_THRESHOLDS = [
  { name: 'basics', threshold: 16.67 },
  { name: 'identity', threshold: 33.33 },
  { name: 'physique', threshold: 50 },
  { name: 'skin', threshold: 66.67 },
  { name: 'eyes', threshold: 83.33 },
  { name: 'hair', threshold: 100 },
];

export function DNAHelix({ progress, className = '' }: DNAHelixProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevProgress, setPrevProgress] = useState(progress);
  const [hoveredRung, setHoveredRung] = useState<number | null>(null);

  useEffect(() => {
    if (progress >= 100 && prevProgress < 100) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevProgress(progress);
  }, [progress, prevProgress]);

  const litRungs = useMemo(() => {
    const rungs: boolean[] = [];
    for (let i = 0; i < 12; i++) {
      const sectionIndex = Math.floor(i / 2);
      const threshold = SECTION_THRESHOLDS[sectionIndex].threshold;
      rungs.push(progress >= threshold * ((i % 2 === 0) ? 0.5 : 1));
    }
    return rungs;
  }, [progress]);

  const activeRungIndex = useMemo(() => {
    for (let i = 0; i < 12; i++) {
      if (!litRungs[i]) return i;
    }
    return -1;
  }, [litRungs]);

  const isComplete = progress >= 100;
  const isDormant = progress === 0;

  // Generate MORE particles with better distribution
  const particles = useMemo(() => {
    const p = [];
    // Main floating particles - increased from 20 to 60
    for (let i = 0; i < 60; i++) {
      p.push({
        cx: 20 + Math.random() * 760,
        cy: 10 + Math.random() * 180,
        r: 1 + Math.random() * 4,
        delay: Math.random() * 4,
        duration: 2 + Math.random() * 3,
        type: 'float' as const,
      });
    }
    return p;
  }, []);

  // Generate network connection nodes around the helix
  const networkNodes = useMemo(() => {
    const nodes: { cx: number; cy: number; r: number; connections: number[] }[] = [];
    // Left side network
    for (let i = 0; i < 12; i++) {
      nodes.push({
        cx: 20 + Math.random() * 60,
        cy: 20 + (i / 11) * 160,
        r: 2 + Math.random() * 4,
        connections: [],
      });
    }
    // Right side network
    for (let i = 0; i < 12; i++) {
      nodes.push({
        cx: 720 + Math.random() * 60,
        cy: 20 + (i / 11) * 160,
        r: 2 + Math.random() * 4,
        connections: [],
      });
    }
    // Top scattered
    for (let i = 0; i < 8; i++) {
      nodes.push({
        cx: 100 + Math.random() * 600,
        cy: 5 + Math.random() * 30,
        r: 1.5 + Math.random() * 3,
        connections: [],
      });
    }
    // Bottom scattered
    for (let i = 0; i < 8; i++) {
      nodes.push({
        cx: 100 + Math.random() * 600,
        cy: 165 + Math.random() * 30,
        r: 1.5 + Math.random() * 3,
        connections: [],
      });
    }
    return nodes;
  }, []);

  // Generate connection lines between network nodes
  const networkLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    networkNodes.forEach((node, i) => {
      // Connect to 1-3 nearby nodes
      const numConnections = 1 + Math.floor(Math.random() * 3);
      for (let j = 0; j < numConnections; j++) {
        const targetIndex = Math.floor(Math.random() * networkNodes.length);
        if (targetIndex !== i) {
          const target = networkNodes[targetIndex];
          const dist = Math.sqrt(Math.pow(node.cx - target.cx, 2) + Math.pow(node.cy - target.cy, 2));
          if (dist < 200) { // Only connect nearby nodes
            lines.push({
              x1: node.cx,
              y1: node.cy,
              x2: target.cx,
              y2: target.cy,
            });
          }
        }
      }
    });
    return lines;
  }, [networkNodes]);

  // Decorative circles (molecular rings)
  const decorativeCircles = useMemo(() => {
    const circles = [];
    // Left side
    for (let i = 0; i < 6; i++) {
      circles.push({
        cx: 30 + Math.random() * 50,
        cy: 20 + Math.random() * 160,
        r: 10 + Math.random() * 25,
      });
    }
    // Right side
    for (let i = 0; i < 6; i++) {
      circles.push({
        cx: 720 + Math.random() * 50,
        cy: 20 + Math.random() * 160,
        r: 10 + Math.random() * 25,
      });
    }
    return circles;
  }, []);

  const celebrationParticles = useMemo(() => {
    const p = [];
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      p.push({
        angle,
        delay: Math.random() * 0.4,
        speed: 60 + Math.random() * 80,
      });
    }
    return p;
  }, []);

  // Calculate helix points with more density
  const helixPoints = useMemo(() => {
    const points: { x: number; y: number; phase: number }[] = [];
    const numPoints = 24; // Increased for smoother curve
    const width = 560;
    const startX = 120;
    
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const x = startX + t * width;
      const phase = t * Math.PI * 4; // 2 full rotations
      points.push({ x, y: 100, phase });
    }
    return points;
  }, []);

  // Main rung points (12 for progress tracking)
  const mainRungPoints = useMemo(() => {
    const points: { x: number; y: number; phase: number; index: number }[] = [];
    const numPoints = 12;
    const width = 560;
    const startX = 120;
    
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const x = startX + t * width;
      const phase = t * Math.PI * 4;
      points.push({ x, y: 100, phase, index: i });
    }
    return points;
  }, []);

  return (
    <div className={`relative w-full ${className}`}>
      <style>{`
        @keyframes activePulse {
          0%, 100% { 
            transform: scale(1);
            filter: drop-shadow(0 0 0px rgba(59, 130, 246, 0));
          }
          50% { 
            transform: scale(1.4);
            filter: drop-shadow(0 0 12px rgba(59, 130, 246, 0.8));
          }
        }
        @keyframes floatParticle {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 0.7; transform: translateY(-8px); }
        }
        @keyframes celebrationBurst {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        @keyframes celebrationGlow {
          0% { filter: drop-shadow(0 0 0px rgba(34, 197, 94, 0)); }
          50% { filter: drop-shadow(0 0 25px rgba(34, 197, 94, 0.9)); }
          100% { filter: drop-shadow(0 0 0px rgba(34, 197, 94, 0)); }
        }
        @keyframes networkPulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.35; }
        }
        .active-rung {
          animation: activePulse 1.2s ease-in-out infinite;
          transform-origin: center;
        }
        .celebration-glow {
          animation: celebrationGlow 1.2s ease-out;
        }
        .network-line {
          animation: networkPulse 3s ease-in-out infinite;
        }
        .dna-tooltip {
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
      `}</style>

      <svg
        viewBox="0 0 800 200"
        className="w-full h-auto"
        style={{ maxHeight: '300px' }}
      >
        <defs>
          <linearGradient id="litGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="50%" stopColor="#1f2937" />
            <stop offset="100%" stopColor="#374151" />
          </linearGradient>
          
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          <filter id="activeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Network connection lines - molecular network effect */}
        <g className={`transition-opacity duration-700 ${isDormant ? 'opacity-5' : 'opacity-100'}`}>
          {networkLines.map((line, i) => {
            const progressFactor = Math.min(1, progress / 50);
            return (
              <line
                key={`net-line-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={isComplete ? "#86efac" : "#d1d5db"}
                strokeWidth="0.5"
                opacity={0.1 + progressFactor * 0.2}
                className="network-line"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            );
          })}
        </g>

        {/* Decorative molecular circles */}
        <g className={`transition-opacity duration-500 ${isDormant ? 'opacity-5' : 'opacity-30'}`}>
          {decorativeCircles.map((circle, i) => (
            <circle
              key={`deco-${i}`}
              cx={circle.cx}
              cy={circle.cy}
              r={circle.r}
              fill="none"
              stroke={isComplete ? "#86efac" : "#d1d5db"}
              strokeWidth="0.5"
              opacity={0.3 + (progress / 100) * 0.4}
            />
          ))}
        </g>

        {/* Network nodes */}
        <g className={`transition-opacity duration-500 ${isDormant ? 'opacity-10' : 'opacity-100'}`}>
          {networkNodes.map((node, i) => {
            const shouldShow = progress > (i / networkNodes.length) * 80;
            return (
              <g key={`node-${i}`}>
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.r}
                  fill={isComplete ? "#22c55e" : "#6b7280"}
                  opacity={shouldShow ? 0.6 : 0.15}
                  className="transition-all duration-500"
                />
                {/* Outer ring for some nodes */}
                {node.r > 3 && (
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.r + 4}
                    fill="none"
                    stroke={isComplete ? "#86efac" : "#9ca3af"}
                    strokeWidth="0.5"
                    opacity={shouldShow ? 0.4 : 0.1}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Floating particles - MORE visible */}
        <g className={`${isDormant ? 'opacity-10' : 'opacity-100'} transition-opacity duration-500`}>
          {particles.map((particle, i) => {
            const shouldShow = progress > (i / particles.length) * 100;
            return (
              <circle
                key={`particle-${i}`}
                cx={particle.cx}
                cy={particle.cy}
                r={particle.r}
                fill={isComplete ? "#22c55e" : "#4b5563"}
                opacity={shouldShow ? 0.5 : 0.15}
                className="transition-all duration-500"
              >
                <animate
                  attributeName="cy"
                  values={`${particle.cy};${particle.cy - 12};${particle.cy}`}
                  dur={`${particle.duration}s`}
                  begin={`${particle.delay}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values={shouldShow ? "0.4;0.7;0.4" : "0.1;0.2;0.1"}
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
          {/* Back strand - smooth curve */}
          <path
            d={`M ${helixPoints.map((p, i) => {
              const y = 100 + Math.sin(p.phase) * 40;
              return `${i === 0 ? 'M' : 'L'} ${p.x} ${y}`;
            }).join(' ')}`}
            fill="none"
            stroke={isDormant ? "#d1d5db" : (isComplete ? "#22c55e" : "#6b7280")}
            strokeWidth="2.5"
            strokeLinecap="round"
            className="transition-all duration-500"
            opacity={isDormant ? 0.2 : 0.5}
          />

          {/* Front strand - smooth curve */}
          <path
            d={`M ${helixPoints.map((p, i) => {
              const y = 100 - Math.sin(p.phase) * 40;
              return `${i === 0 ? 'M' : 'L'} ${p.x} ${y}`;
            }).join(' ')}`}
            fill="none"
            stroke={isDormant ? "#d1d5db" : (isComplete ? "#16a34a" : "#374151")}
            strokeWidth="3"
            strokeLinecap="round"
            className="transition-all duration-500"
            opacity={isDormant ? 0.2 : 0.7}
          />

          {/* All rungs (vertical lines connecting strands) */}
          {helixPoints.map((point, i) => {
            const y1 = 100 + Math.sin(point.phase) * 40;
            const y2 = 100 - Math.sin(point.phase) * 40;
            const progressIndex = Math.floor((i / helixPoints.length) * 12);
            const isLit = litRungs[Math.min(progressIndex, 11)];
            
            return (
              <line
                key={`rung-${i}`}
                x1={point.x}
                y1={y1}
                x2={point.x}
                y2={y2}
                stroke={isLit ? (isComplete ? "#86efac" : "#9ca3af") : "#e5e7eb"}
                strokeWidth={isLit ? "1.5" : "1"}
                opacity={isDormant ? 0.15 : (isLit ? 0.6 : 0.3)}
                className="transition-all duration-300"
              />
            );
          })}

          {/* Main base pair spheres (12 for progress tracking) */}
          {mainRungPoints.map((point, i) => {
            const y1 = 100 + Math.sin(point.phase) * 40;
            const y2 = 100 - Math.sin(point.phase) * 40;
            const isLit = litRungs[i];
            const isActive = i === activeRungIndex && !isComplete;
            const frontIsTop = Math.cos(point.phase) > 0;
            
            const litColor = isComplete ? "#16a34a" : "#1f2937";
            const litColorSecondary = isComplete ? "#22c55e" : "#4b5563";
            const activeColor = "#3b82f6";
            
            const sectionLabel = SECTION_LABELS[i];
            const status = isLit ? 'Complete' : (isActive ? 'In Progress' : 'Pending');
            
            return (
              <g 
                key={`main-${i}`}
                onMouseEnter={() => setHoveredRung(i)}
                onMouseLeave={() => setHoveredRung(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Connecting line for main rungs - thicker */}
                <line
                  x1={point.x}
                  y1={y1}
                  x2={point.x}
                  y2={y2}
                  stroke={isActive ? activeColor : (isLit ? (isComplete ? "#86efac" : "#6b7280") : "#d1d5db")}
                  strokeWidth={isActive ? "2.5" : (isLit ? "2" : "1.5")}
                  opacity={isDormant ? 0.2 : (isActive ? 0.9 : (isLit ? 0.8 : 0.4))}
                  className="transition-all duration-300"
                />
                
                {/* Active glow effect */}
                {isActive && (
                  <g filter="url(#activeGlow)">
                    <line
                      x1={point.x}
                      y1={y1}
                      x2={point.x}
                      y2={y2}
                      stroke={activeColor}
                      strokeWidth="4"
                      opacity="0.4"
                    />
                  </g>
                )}
                
                {/* Base pair spheres */}
                {frontIsTop ? (
                  <>
                    <circle
                      cx={point.x}
                      cy={y1}
                      r={isActive ? 10 : (isLit ? 8 : 6)}
                      fill={isActive ? activeColor : (isLit ? litColorSecondary : "#d1d5db")}
                      opacity={isDormant ? 0.2 : (isActive ? 1 : (isLit ? 0.9 : 0.4))}
                      className={`transition-all duration-300 ${isActive ? 'active-rung' : ''}`}
                      style={{ transformOrigin: `${point.x}px ${y1}px` }}
                    />
                    <circle
                      cx={point.x}
                      cy={y2}
                      r={isActive ? 11 : (isLit ? 9 : 7)}
                      fill={isActive ? activeColor : (isLit ? litColor : "#9ca3af")}
                      opacity={isDormant ? 0.2 : (isActive ? 1 : (isLit ? 1 : 0.5))}
                      className={`transition-all duration-300 ${isActive ? 'active-rung' : ''}`}
                      style={{ transformOrigin: `${point.x}px ${y2}px` }}
                    />
                    {(isLit || isActive) && !isDormant && (
                      <circle
                        cx={point.x - 2}
                        cy={y2 - 2}
                        r={isActive ? 3.5 : 2.5}
                        fill="white"
                        opacity={isActive ? 0.7 : 0.5}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <circle
                      cx={point.x}
                      cy={y2}
                      r={isActive ? 10 : (isLit ? 8 : 6)}
                      fill={isActive ? activeColor : (isLit ? litColorSecondary : "#d1d5db")}
                      opacity={isDormant ? 0.2 : (isActive ? 1 : (isLit ? 0.9 : 0.4))}
                      className={`transition-all duration-300 ${isActive ? 'active-rung' : ''}`}
                      style={{ transformOrigin: `${point.x}px ${y2}px` }}
                    />
                    <circle
                      cx={point.x}
                      cy={y1}
                      r={isActive ? 11 : (isLit ? 9 : 7)}
                      fill={isActive ? activeColor : (isLit ? litColor : "#9ca3af")}
                      opacity={isDormant ? 0.2 : (isActive ? 1 : (isLit ? 1 : 0.5))}
                      className={`transition-all duration-300 ${isActive ? 'active-rung' : ''}`}
                      style={{ transformOrigin: `${point.x}px ${y1}px` }}
                    />
                    {(isLit || isActive) && !isDormant && (
                      <circle
                        cx={point.x - 2}
                        cy={y1 - 2}
                        r={isActive ? 3.5 : 2.5}
                        fill="white"
                        opacity={isActive ? 0.7 : 0.5}
                      />
                    )}
                  </>
                )}

                {/* Tooltip */}
                {hoveredRung === i && (
                  <g className="dna-tooltip">
                    <rect
                      x={point.x - 50}
                      y={y2 < y1 ? y2 - 35 : y1 - 35}
                      width="100"
                      height="28"
                      rx="4"
                      fill="#1f2937"
                      opacity="0.95"
                    />
                    <text
                      x={point.x}
                      y={y2 < y1 ? y2 - 17 : y1 - 17}
                      textAnchor="middle"
                      fill="white"
                      fontSize="10"
                      fontWeight="500"
                    >
                      {sectionLabel.name} - {status}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Celebration burst particles */}
        {showCelebration && (
          <g>
            {celebrationParticles.map((particle, i) => {
              const tx = Math.cos(particle.angle) * particle.speed;
              const ty = Math.sin(particle.angle) * particle.speed;
              return (
                <circle
                  key={`celeb-${i}`}
                  cx="400"
                  cy="100"
                  r={3 + Math.random() * 4}
                  fill="#22c55e"
                  style={{
                    '--tx': `${tx}px`,
                    '--ty': `${ty}px`,
                    animation: `celebrationBurst 1.2s ease-out ${particle.delay}s forwards`,
                  } as React.CSSProperties}
                />
              );
            })}
          </g>
        )}

        {/* Completion ripple effect */}
        {isComplete && (
          <g>
            <circle cx="400" cy="100" r="150" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0.5">
              <animate attributeName="r" values="60;200;60" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="400" cy="100" r="120" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.4">
              <animate attributeName="r" values="40;170;40" dur="3s" begin="0.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" begin="0.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="400" cy="100" r="90" fill="none" stroke="#86efac" strokeWidth="0.5" opacity="0.3">
              <animate attributeName="r" values="30;140;30" dur="3s" begin="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" begin="1s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </svg>

      {/* Progress indicator text */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <span className={`text-xs font-mono tracking-wider transition-all duration-300 ${
          isComplete ? 'text-green-600 font-semibold' : 'text-gray-400'
        } ${showCelebration ? 'scale-110' : ''}`}>
          {isComplete ? '✓ SEQUENCE COMPLETE' : `SEQUENCING... ${Math.round(progress)}%`}
        </span>
      </div>
    </div>
  );
}

export default DNAHelix;
```

## Features

1. **Progress Tracking**: 12 main rungs mapped to 6 form sections (2 rungs each)
2. **Network Particles**: 60 floating particles + 40 network nodes with connecting lines
3. **Decorative Elements**: Molecular circles on both sides
4. **Active Rung Pulse**: Blue pulsing animation on the current section
5. **Hover Tooltips**: Shows section name and status (Complete/In Progress/Pending)
6. **Celebration Effect**: Green glow, particle burst, and ripple animation at 100%
7. **Smooth Transitions**: All state changes animate smoothly
