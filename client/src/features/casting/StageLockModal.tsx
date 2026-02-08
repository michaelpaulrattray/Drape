import React from "react";

export const StageLockModal = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-[#0A0A0A]/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
        <h3 className="text-base font-semibold text-[#0A0A0A] tracking-tight">{title}</h3>
        <p className="text-sm text-[#757575] leading-relaxed">{message}</p>
        <div className="flex space-x-2 pt-2">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-[#0A0A0A]/10 text-[#757575] hover:text-[#0A0A0A] hover:border-[#0A0A0A]/30 text-sm font-medium rounded-full transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-[#0A0A0A] text-white hover:bg-[#0A0A0A]/90 text-sm font-medium rounded-full transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
};
