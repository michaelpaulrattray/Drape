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

// ============ Component ============

interface LoadingOverlayProps {
  statusMessage: string;
  /** Whether this is the first generation (no image behind the overlay) */
  isFirstGeneration?: boolean;
}

export function LoadingOverlay({ statusMessage, isFirstGeneration = false }: LoadingOverlayProps) {
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

  // Palette — warm tones for first gen, light for iterations (dark backdrop)
  const lineTrack = isFirstGeneration ? 'rgba(138,128,120,0.12)' : 'rgba(255,255,255,0.08)';
  const lineGlow = isFirstGeneration
    ? 'linear-gradient(90deg, transparent, rgba(138,128,120,0.5), transparent)'
    : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)';
  const tipColor = isFirstGeneration ? 'rgba(138,128,120,0.45)' : 'rgba(255,255,255,0.3)';

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center">
      {/* Backdrop — transparent for first gen, dark blur for iterations */}
      {!isFirstGeneration && (
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(18, 16, 14, 0.85)',
            backdropFilter: 'blur(12px) saturate(0.8)',
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center">
        {/* Animated scan line */}
        <div
          style={{
            width: 140,
            height: 1,
            background: lineTrack,
            borderRadius: 1,
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: '40%',
              height: '100%',
              background: lineGlow,
              animation: 'loadScan 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* Cycling contextual tip */}
        <p
          style={{
            fontSize: 10,
            color: tipColor,
            lineHeight: 1.5,
            fontStyle: 'italic',
            textAlign: 'center',
            maxWidth: 260,
            minHeight: 28,
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
      `}</style>
    </div>
  );
}

export default LoadingOverlay;
