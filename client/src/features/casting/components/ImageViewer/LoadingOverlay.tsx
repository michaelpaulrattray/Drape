import { useState, useEffect } from 'react';
import { QueueStatusBar } from '../QueueStatusBar';

// ============ Contextual Tips ============

const CONTEXTUAL_TIPS: Record<string, string[]> = {
  newCast: [
    'Brand direction shapes bone structure, not just expression',
    'Ethnicity blend lets you dial between two heritages',
    'The vibe triangle controls how extreme the features get',
    'Each cast is unique — Recast generates a completely different face',
    'Skin texture and finish are treated as photographic properties',
  ],
  iterate: [
    'Be specific — "stronger jawline" works better than "more defined"',
    'Paint a mask first to confine changes to an exact area',
    'Upload a reference image to transfer a hairstyle or tattoo',
    'Upstream edits invalidate side views automatically',
    'The enhance button rewrites your instruction for better results',
  ],
  body: [
    'Body type is applied at generation time — choose it before casting',
    'The full body view inherits the exact skin, hair, and expression from your headshot',
    'Body generation uses your headshot as the identity anchor',
    'Try iterating the body view independently once it appears',
  ],
  sheet: [
    'The side profile shows jawline, nose shape, and ear position',
    'Sheet generation preserves the identity from your front views',
    'All three views export together as a casting pack',
  ],
};

const FALLBACK_TIPS = [
  'Undo and redo preserve your full history',
  'Export packs include a full identity document',
  'The eraser tool can remove artifacts from skin',
];

const STEP_MAP: Record<string, number> = {
  'Analyzing Request...': 1,
  'Writing Casting Spec...': 2,
  'Compacting spec...': 2,
  'Updating spec...': 2,
};

// ============ Component ============

interface LoadingOverlayProps {
  statusMessage: string;
  /** Whether this is the first generation (no image behind the overlay) */
  isFirstGeneration?: boolean;
}

export function LoadingOverlay({ statusMessage, isFirstGeneration = false }: LoadingOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);

  const getTips = (msg: string): string[] => {
    if (/generating full body/i.test(msg)) return CONTEXTUAL_TIPS.body;
    if (/side.*back|sheet/i.test(msg)) return CONTEXTUAL_TIPS.sheet;
    if (/refin|updating spec|compacting|analyzing/i.test(msg)) return CONTEXTUAL_TIPS.iterate;
    if (/writing casting|casting headshot/i.test(msg)) return CONTEXTUAL_TIPS.newCast;
    return FALLBACK_TIPS;
  };

  useEffect(() => {
    setElapsed(0);
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [statusMessage]);

  useEffect(() => {
    setTipIndex(0);
    setTipVisible(true);
  }, [statusMessage]);

  useEffect(() => {
    const tips = getTips(statusMessage);
    if (tips.length <= 1) return;
    const interval = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIndex((i) => (i + 1) % tips.length);
        setTipVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, [statusMessage]);

  const msg = statusMessage || 'Initializing...';
  const step = STEP_MAP[msg] || (msg.match(/casting|refin|generat|enhanc|process|compil|compress/i) ? 3 : 1);
  const totalSteps = 3;

  // Warm palette for first generation, dark overlay when image is behind
  const textColor = isFirstGeneration ? '#8a8078' : '#fff';
  const textColorMuted = isFirstGeneration ? 'rgba(138,128,120,0.5)' : 'rgba(255,255,255,0.25)';
  const textColorSubtle = isFirstGeneration ? 'rgba(138,128,120,0.4)' : 'rgba(255,255,255,0.3)';
  const dotActive = isFirstGeneration ? '#a09080' : '#fff';
  const dotInactive = isFirstGeneration ? 'rgba(138,128,120,0.2)' : 'rgba(255,255,255,0.15)';
  const lineActive = isFirstGeneration ? 'rgba(138,128,120,0.4)' : 'rgba(255,255,255,0.4)';
  const lineInactive = isFirstGeneration ? 'rgba(138,128,120,0.1)' : 'rgba(255,255,255,0.08)';
  const scanBg = isFirstGeneration ? 'rgba(138,128,120,0.12)' : 'rgba(255,255,255,0.08)';
  const scanGlow = isFirstGeneration
    ? 'linear-gradient(90deg, transparent, rgba(138,128,120,0.5), transparent)'
    : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)';

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center">
      {/* Backdrop — warm transparent for first gen, dark blur for iterations */}
      {!isFirstGeneration && (
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(18, 16, 14, 0.85)',
            backdropFilter: 'blur(12px) saturate(0.8)',
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center" style={{ maxWidth: 280 }}>
        {/* Animated scan line */}
        <div
          style={{
            width: 120,
            height: 1,
            background: scanBg,
            borderRadius: 1,
            overflow: 'hidden',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: '40%',
              height: '100%',
              background: scanGlow,
              animation: 'loadScan 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2" style={{ marginBottom: 20 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: i + 1 <= step ? dotActive : dotInactive,
                  boxShadow: i + 1 === step
                    ? `0 0 8px ${isFirstGeneration ? 'rgba(138,128,120,0.3)' : 'rgba(255,255,255,0.4)'}`
                    : 'none',
                  transition: 'all 0.5s ease',
                  animation: i + 1 === step ? 'loadDotPulse 1.5s ease-in-out infinite' : 'none',
                }}
              />
              {i < totalSteps - 1 && (
                <div
                  style={{
                    width: 24,
                    height: 1,
                    background: i + 1 < step ? lineActive : lineInactive,
                    transition: 'background 0.5s ease',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Status message */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: textColor,
            letterSpacing: '0.12em',
            fontFamily: 'ui-monospace, monospace',
            textTransform: 'uppercase',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          {msg}
        </p>

        {/* Elapsed time */}
        <p
          style={{
            fontSize: 9,
            color: textColorMuted,
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: '0.08em',
            marginBottom: 28,
          }}
        >
          {elapsed}s
        </p>

        {/* Contextual tips */}
        <p
          style={{
            fontSize: 9.5,
            color: textColorSubtle,
            lineHeight: 1.5,
            fontStyle: 'italic',
            textAlign: 'center',
            minHeight: 32,
            transition: 'opacity 0.3s ease',
            opacity: tipVisible ? 1 : 0,
          }}
        >
          {getTips(statusMessage)[tipIndex]}
        </p>

        {/* Queue position (only shows when there's a queue) */}
        <QueueStatusBar isGenerating={true} />
      </div>

      <style>{`
        @keyframes loadScan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes loadDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

export default LoadingOverlay;
