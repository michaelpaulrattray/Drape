export const StageLockModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
          maxWidth: 320,
          width: '100%',
          padding: 24,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: '#52525B', lineHeight: 1.5, marginBottom: 20 }}>
          {message}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} style={{ fontSize: 13, fontWeight: 500, color: '#52525B' }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl"
            style={{ background: '#1a1a1a', color: '#fff', fontSize: 13, fontWeight: 600 }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
