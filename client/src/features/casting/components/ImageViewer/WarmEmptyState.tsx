import { ModelUploadZone } from '@/features/studio/components/ModelUploadZone';

interface WarmEmptyStateProps {
  canGenerate: boolean;
  onGenerate: () => void;
}

export function WarmEmptyState({ canGenerate, onGenerate }: WarmEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
      {/* Upload Your Own Model */}
      <ModelUploadZone />

      {/* Cast a Model — below the OR divider rendered by ModelUploadZone */}
      <div
        onClick={() => canGenerate && onGenerate()}
        className={`flex flex-col items-center justify-center mt-4 ${canGenerate ? 'cursor-pointer group' : ''}`}
        style={{ width: 340, maxWidth: '100%' }}
      >
        <div
          className="w-full flex flex-col items-center justify-center py-6 transition-all duration-300 group-hover:shadow-lg group-hover:scale-[1.01]"
          style={{
            borderRadius: 16,
            background: canGenerate
              ? 'linear-gradient(145deg, #1a1a1a, #2a2a2a)'
              : 'linear-gradient(145deg, rgba(255,255,255,0.6), rgba(255,255,255,0.3))',
            border: canGenerate ? 'none' : '1.5px dashed rgba(0,0,0,0.08)',
            boxShadow: canGenerate
              ? '0 4px 20px rgba(0,0,0,0.15)'
              : '0 4px 20px rgba(0,0,0,0.03)',
          }}
        >
          <div className="flex flex-col items-center">
            <div
              className="flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: canGenerate
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(255,255,255,0.85)',
                boxShadow: canGenerate ? 'none' : '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke={canGenerate ? '#fff' : '#aaa'}
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
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: canGenerate ? '#fff' : '#555',
                marginTop: 12,
              }}
            >
              {canGenerate ? 'Cast a New Model' : 'Configure to Cast'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: canGenerate ? 'rgba(255,255,255,0.5)' : '#b8b3a8',
                marginTop: 3,
                textAlign: 'center',
                maxWidth: 200,
                lineHeight: 1.4,
              }}
            >
              {canGenerate
                ? 'AI-generate a model from your casting brief'
                : 'Fill in the sidebar to begin casting'}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline indicators */}
      <div
        className="flex items-center gap-4 mt-6"
        style={{
          color: '#ccc',
          fontSize: 10,
          fontWeight: 500,
          opacity: 0.5,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
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
  );
}

export default WarmEmptyState;
