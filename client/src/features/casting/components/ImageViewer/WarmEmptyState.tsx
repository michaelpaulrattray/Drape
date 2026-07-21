interface WarmEmptyStateProps {
  canGenerate: boolean;
}

/**
 * Empty casting work area — a quiet ghost card in the canvas language
 * (DS §11 posture: dashed hairline, inset surface, no gradients/shadows).
 * The old Identity·Views·Export footer strip narrated the retired linear
 * pipeline and was removed as belt-plumbing (Group 6i framing note).
 */
export function WarmEmptyState({ canGenerate }: WarmEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div
        className="flex flex-col items-center justify-center"
        style={{ width: 340, maxWidth: '100%' }}
      >
        <div
          className="w-full flex flex-col items-center justify-center bg-canvas-surface/50 rounded-canvas-lg relative overflow-hidden"
          style={{
            aspectRatio: '3 / 4',
            border: '1px dashed var(--color-canvas-border-strong)',
          }}
        >
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke={canGenerate ? 'var(--color-canvas-ink)' : 'var(--color-canvas-ink-faint)'}
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                {canGenerate ? (
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                ) : (
                  <path d="M12 5v14M5 12h14" />
                )}
              </svg>
            </div>
            <div className="mt-4 font-medium text-canvas-ink-soft" style={{ fontSize: 16 }}>
              {canGenerate ? 'Ready for your headshot' : 'Your headshot appears here'}
            </div>
            <div
              className="mt-1 text-center text-canvas-ink-faint"
              style={{ fontSize: 13, maxWidth: 200, lineHeight: 1.4 }}
            >
              {canGenerate
                ? 'Use Cast model when the details look right.'
                : 'Describe your model or set the details.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WarmEmptyState;
