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
    'Matte skin absorbs light — dewy skin reflects it. Choose intentionally',
    'Unusual color combos read as natural — amber eyes on dark skin just works',
    'Push the editorial slider for unconventional, cerebral feature choices',
    'Face shape and jawline are independent — a round face can have a sharp jaw',
    'Freckled skin texture adds organic randomness the AI renders well',
  ],
  iterate: [
    'Be specific — "stronger jawline" works better than "more defined"',
    'Upload a reference and name exactly what to take — like the hairstyle',
    'Identity edits on the headshot flag the other views for a refresh',
    'The enhance button rewrites your instruction for better results',
    'Describe what you want, not what you don\'t — "fuller lips" beats "less thin"',
    'Reference transfers copy shape, not color — eye shape won\'t change iris color',
    'Small changes compound — iterate in steps rather than one big ask',
    'Lighting, background, and pose tweaks change this photo only',
  ],
  body: [
    'Body type is applied at generation time — choose it before casting',
    'The full body view inherits skin, hair, and expression from your headshot',
    'Body generation uses your headshot as the identity anchor',
    'Try iterating the body view independently once it appears',
    'Slim and Athletic body types produce different shoulder-to-waist ratios',
    'Muscular builds add visible definition to arms, shoulders, and neck',
    'The body inherits your skin finish — matte stays matte, dewy stays dewy',
    'Petite adjusts proportions and implied height, not just scale',
  ],
  sheet: [
    'The side profile reveals jawline depth, nose projection, and ear position',
    'Sheet generation preserves identity from your front views',
    'All three views export together as a casting pack',
    'Side views are generated from the same identity prompt as the headshot',
    'The back view shows hair volume, neckline, and shoulder structure',
    'Views regenerate from the current headshot — refresh keeps them in sync',
    'Sheet views help casting directors evaluate bone structure in 3D',
    'Each view can be iterated independently after generation',
  ],
  wardrobe: [
    'Fabric textures are matched to the garment type — knit, silk, denim',
    'Layering order matters — the AI renders garments front to back',
    'Style notes let you adjust fit, color, and drape per garment',
    'The model\'s pose and body shape influence how fabric falls',
    'Each VTO result is saved — undo to compare different outfit combinations',
    'Garment selection order affects layering — jackets go over shirts',
    'Skin tone and lighting are matched to keep the look photorealistic',
    'Try different style notes on the same outfit for subtle variations',
    'The identity prompt carries over from Casting to keep consistency',
  ],
};

const FALLBACK_TIPS = [
  'Export packs include a full identity document',
  'Each view keeps its earlier versions under Details',
  'Hold compare to see the previous version side by side',
  'Your model\'s identity prompt is portable across studios',
  'The spec panel shows exactly what the AI was told to generate',
  'Refresh out-of-sync views when you are ready to update the whole card',
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
    if (/drap|wardrobe|vto|try.?on|outfit|garment/i.test(msg)) return CONTEXTUAL_TIPS.wardrobe;
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
  const lineTrack = isFirstGeneration ? 'rgba(138,128,120,0.25)' : 'rgba(80,70,60,0.25)';
  const lineGlow = isFirstGeneration
    ? 'linear-gradient(90deg, transparent, rgba(138,128,120,0.8), transparent)'
    : 'linear-gradient(90deg, transparent, rgba(80,70,60,0.85), transparent)';
  const tipColor = isFirstGeneration ? 'rgba(100,90,80,0.65)' : 'rgba(60,50,40,0.7)';

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center">
      {/* Backdrop — transparent for first gen, light frosted for iterations */}
      {!isFirstGeneration && (
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(18, 16, 14, 0.25)',
            backdropFilter: 'blur(6px) saturate(0.9)',
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
            fontSize: 12,
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
