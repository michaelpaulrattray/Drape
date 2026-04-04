/**
 * CanvasChatToggle — Floating chat button pinned bottom-right of canvas.
 *
 * Placeholder for future AI assistant integration.
 * Opens a chat panel where users can ask the AI to perform canvas actions.
 */
import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

export function CanvasChatToggle() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-4 right-4" style={{ zIndex: 10 }}>
      {/* Chat panel (placeholder) */}
      {isOpen && (
        <div
          className="absolute bottom-14 right-0 flex flex-col"
          style={{
            width: 320,
            height: 400,
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 14,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
            animation: 'canvasChatIn 0.2s ease-out',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 flex-shrink-0"
            style={{
              height: 48,
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: 'rgba(0, 0, 0, 0.04)',
                }}
              >
                <MessageSquare size={13} strokeWidth={1.5} style={{ color: '#52524B' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                Canvas AI
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: '#a1a19a',
                  background: 'rgba(0, 0, 0, 0.04)',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                Soon
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                border: 'none',
                background: 'transparent',
                color: '#71716A',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Body — placeholder */}
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div
              className="flex items-center justify-center mb-3"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <MessageSquare size={20} strokeWidth={1.5} style={{ color: '#a1a19a' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
              AI Canvas Assistant
            </p>
            <p
              className="text-center"
              style={{ fontSize: 12, color: '#a1a19a', lineHeight: 1.5, maxWidth: 220 }}
            >
              Ask the AI to cast models, style outfits, arrange your board, or answer creative questions.
            </p>
          </div>

          {/* Input — placeholder */}
          <div
            className="flex items-center gap-2 px-3 flex-shrink-0"
            style={{
              height: 52,
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            <input
              type="text"
              placeholder="Ask anything..."
              disabled
              className="flex-1"
              style={{
                height: 34,
                borderRadius: 8,
                border: '1px solid rgba(0, 0, 0, 0.08)',
                background: 'rgba(0, 0, 0, 0.02)',
                padding: '0 10px',
                fontSize: 13,
                color: '#a1a19a',
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center gap-1.5"
        style={{
          height: 36,
          padding: '0 12px',
          background: isOpen ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 10,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 1px 6px rgba(0, 0, 0, 0.06)',
          color: isOpen ? '#1a1a1a' : '#52524B',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          fontSize: 12,
          fontWeight: 500,
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.88)';
        }}
        title="Canvas AI Assistant"
      >
        <MessageSquare size={14} strokeWidth={1.5} />
        <span>AI</span>
      </button>

      <style>{`
        @keyframes canvasChatIn {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
