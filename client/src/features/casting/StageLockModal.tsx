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
      <div className="bg-white border border-gray-300 p-6 max-w-sm w-full shadow-2xl space-y-4">
        <h3 className="text-base font-semibold text-obsidian tracking-tight">{title}</h3>
        <p className="text-sm text-charcoal leading-relaxed">{message}</p>
        <div className="flex space-x-2 pt-2">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 text-charcoal hover:text-obsidian hover:border-slate-accent text-sm font-medium rounded-lg transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-slate-accent text-white hover:bg-[#5D6E7C] text-sm font-medium rounded-lg transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
};
