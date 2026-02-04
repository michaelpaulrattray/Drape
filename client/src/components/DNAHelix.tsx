import { useMemo } from 'react';

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

  // Calculate helix points for smooth sine wave
  const helixPoints = useMemo(() => {
    const points: { x: number; y: number; phase: number }[] = [];
    const numPoints = 12;
    const width = 600;
    const height = 80;
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
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
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
                fill="#9ca3af"
                opacity={shouldShow ? 0.4 : 0.1}
                className="transition-opacity duration-500"
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
        <g filter={isComplete ? "url(#glow)" : "url(#shadow)"}>
          {/* Back strand (sine wave going down) */}
          <path
            d={`M ${helixPoints.map((p, i) => {
              const y = 100 + Math.sin(p.phase) * 35;
              return `${i === 0 ? 'M' : 'L'} ${p.x} ${y}`;
            }).join(' ')}`}
            fill="none"
            stroke={isDormant ? "#d1d5db" : "#6b7280"}
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
            stroke={isDormant ? "#d1d5db" : "#374151"}
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
            const isActive = i === Math.floor((progress / 100) * 12);
            
            // Determine which sphere is in front based on phase
            const frontIsTop = Math.cos(point.phase) > 0;
            
            return (
              <g key={i}>
                {/* Connecting line (rung) */}
                <line
                  x1={point.x}
                  y1={y1}
                  x2={point.x}
                  y2={y2}
                  stroke={isLit ? "#9ca3af" : "#e5e7eb"}
                  strokeWidth={isLit ? "1.5" : "1"}
                  opacity={isDormant ? 0.2 : (isLit ? 0.7 : 0.4)}
                  className="transition-all duration-300"
                />
                
                {/* Base pair spheres - render order based on 3D position */}
                {frontIsTop ? (
                  <>
                    {/* Back sphere (bottom) */}
                    <circle
                      cx={point.x}
                      cy={y1}
                      r={isLit ? 7 : 5}
                      fill={isLit ? "#4b5563" : "#d1d5db"}
                      opacity={isDormant ? 0.3 : (isLit ? 0.9 : 0.5)}
                      className={`transition-all duration-300 ${isActive ? 'animate-pulse' : ''}`}
                    />
                    {/* Front sphere (top) */}
                    <circle
                      cx={point.x}
                      cy={y2}
                      r={isLit ? 8 : 6}
                      fill={isLit ? "#1f2937" : "#9ca3af"}
                      opacity={isDormant ? 0.3 : (isLit ? 1 : 0.6)}
                      className={`transition-all duration-300 ${isActive ? 'animate-pulse' : ''}`}
                    />
                    {/* Highlight on front sphere */}
                    {isLit && !isDormant && (
                      <circle
                        cx={point.x - 2}
                        cy={y2 - 2}
                        r={2}
                        fill="white"
                        opacity={0.4}
                      />
                    )}
                  </>
                ) : (
                  <>
                    {/* Back sphere (top) */}
                    <circle
                      cx={point.x}
                      cy={y2}
                      r={isLit ? 7 : 5}
                      fill={isLit ? "#4b5563" : "#d1d5db"}
                      opacity={isDormant ? 0.3 : (isLit ? 0.9 : 0.5)}
                      className={`transition-all duration-300 ${isActive ? 'animate-pulse' : ''}`}
                    />
                    {/* Front sphere (bottom) */}
                    <circle
                      cx={point.x}
                      cy={y1}
                      r={isLit ? 8 : 6}
                      fill={isLit ? "#1f2937" : "#9ca3af"}
                      opacity={isDormant ? 0.3 : (isLit ? 1 : 0.6)}
                      className={`transition-all duration-300 ${isActive ? 'animate-pulse' : ''}`}
                    />
                    {/* Highlight on front sphere */}
                    {isLit && !isDormant && (
                      <circle
                        cx={point.x - 2}
                        cy={y1 - 2}
                        r={2}
                        fill="white"
                        opacity={0.4}
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
          <circle cx="60" cy="60" r="15" fill="none" stroke="#d1d5db" strokeWidth="0.5" />
          <circle cx="40" cy="100" r="20" fill="none" stroke="#d1d5db" strokeWidth="0.5" />
          <circle cx="70" cy="150" r="12" fill="none" stroke="#d1d5db" strokeWidth="0.5" />
          
          {/* Right side nodes */}
          <circle cx="740" cy="50" r="18" fill="none" stroke="#d1d5db" strokeWidth="0.5" />
          <circle cx="760" cy="110" r="14" fill="none" stroke="#d1d5db" strokeWidth="0.5" />
          <circle cx="730" cy="160" r="22" fill="none" stroke="#d1d5db" strokeWidth="0.5" />
          
          {/* Small dots */}
          <circle cx="55" cy="45" r="2" fill="#9ca3af" opacity={progress > 20 ? 0.6 : 0.2} />
          <circle cx="30" cy="85" r="1.5" fill="#9ca3af" opacity={progress > 40 ? 0.6 : 0.2} />
          <circle cx="80" cy="130" r="2.5" fill="#9ca3af" opacity={progress > 60 ? 0.6 : 0.2} />
          <circle cx="750" cy="70" r="2" fill="#9ca3af" opacity={progress > 30 ? 0.6 : 0.2} />
          <circle cx="770" cy="130" r="1.5" fill="#9ca3af" opacity={progress > 50 ? 0.6 : 0.2} />
          <circle cx="720" cy="145" r="3" fill="#9ca3af" opacity={progress > 80 ? 0.6 : 0.2} />
        </g>

        {/* Completion celebration effect */}
        {isComplete && (
          <g>
            <circle cx="400" cy="100" r="150" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3">
              <animate
                attributeName="r"
                values="100;200;100"
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.3;0;0.3"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        )}
      </svg>

      {/* Progress indicator text */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
        <span className={`text-xs font-mono tracking-wider transition-all duration-300 ${
          isComplete ? 'text-gray-700' : 'text-gray-400'
        }`}>
          {isComplete ? 'SEQUENCE COMPLETE' : `SEQUENCING... ${Math.round(progress)}%`}
        </span>
      </div>
    </div>
  );
}

export default DNAHelix;
