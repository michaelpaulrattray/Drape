/**
 * ToolSwitchConfirmDialog — Shown when switching tools would reset progress.
 *
 * Uses React Portal to render at document.body, ensuring the overlay
 * covers the full viewport even when ancestors have CSS transforms.
 */
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ToolSwitchConfirmDialogProps {
  isOpen: boolean;
  message: string;
  targetToolLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ToolSwitchConfirmDialog({
  isOpen,
  message,
  targetToolLabel,
  onConfirm,
  onCancel,
}: ToolSwitchConfirmDialogProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="relative w-full mx-4 rounded-2xl overflow-hidden"
        style={{
          maxWidth: 380,
          background: '#fff',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          animation: 'dialogIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#fef3c7' }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: '#d97706' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
              Switch to {targetToolLabel}?
            </h3>
          </div>
        </div>

        {/* Message */}
        <div className="px-5 pb-4">
          <p style={{ fontSize: 12, color: '#52525B', lineHeight: 1.6 }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
        >
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg font-medium transition-all hover:bg-gray-50"
            style={{ fontSize: 12, color: '#52525B', background: 'transparent' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg font-medium transition-all hover:opacity-90"
            style={{ fontSize: 12, color: '#fff', background: '#1a1a1a' }}
          >
            Switch & Reset
          </button>
        </div>
      </div>

      <style>{`
        @keyframes dialogIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
