interface WarmEmptyStateProps {
  canGenerate: boolean;
  onGenerate: () => void;
}

export function WarmEmptyState({ canGenerate, onGenerate }: WarmEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div
        onClick={() => canGenerate && onGenerate()}
        className={`flex flex-col items-center justify-center ${canGenerate ? 'cursor-pointer group' : ''}`}
        style={{ width: 340, maxWidth: '100%' }}
      >
        <div
          className="w-full flex flex-col items-center justify-center transition-all duration-500 group-hover:shadow-xl group-hover:scale-[1.02]"
          style={{
            aspectRatio: '3 / 4',
            borderRadius: 24,
            background: 'linear-gradient(145deg, rgba(255,255,255,0.6), rgba(255,255,255,0.3))',
            border: '1.5px dashed rgba(0,0,0,0.08)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          }}
        >
          {/* Subtle dot grid */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.4,
              backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10 flex flex-col items-center">
            <div
              className="flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.85)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke={canGenerate ? '#1a1a1a' : '#aaa'}
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
            <div style={{ fontSize: 14, fontWeight: 600, color: '#555', marginTop: 16 }}>
              {canGenerate ? 'Ready to Cast' : 'New Model'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#b8b3a8',
                marginTop: 4,
                textAlign: 'center',
                maxWidth: 200,
                lineHeight: 1.4,
              }}
            >
              {canGenerate
                ? 'Tap to generate your first casting'
                : 'Configure parameters in the sidebar to begin'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-6" style={{ color: '#ccc', fontSize: 10, fontWeight: 500, opacity: 0.5, pointerEvents: 'none', userSelect: 'none' }}>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Identity
          </span>
          <span style={{ width: 1, height: 10, background: 'rgba(0,0,0,0.06)' }} />
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18M3 9h18" />
            </svg>
            Views
          </span>
          <span style={{ width: 1, height: 10, background: 'rgba(0,0,0,0.06)' }} />
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export
          </span>
        </div>
      </div>
    </div>
  );
}

export default WarmEmptyState;
