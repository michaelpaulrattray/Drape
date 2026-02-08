import React, { useRef, useState } from "react";
import { X } from "lucide-react";

export function ReferenceNode({
  image,
  onSet,
  disabled,
}: {
  image?: string;
  onSet: (img?: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => onSet(ev.target?.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => onSet(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`transition-opacity duration-300 ${disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      <div
        className={`
          relative w-48 h-64 rounded-xl border-2 transition-all duration-300 group overflow-hidden
          ${disabled
            ? 'border-[#0A0A0A]/10 bg-[#F5F5F5]/30 cursor-not-allowed'
            : image
              ? 'border-white shadow-2xl'
              : isDragging
                ? 'border-[#0A0A0A] bg-[#0A0A0A]/10 scale-105 shadow-xl'
                : 'border-[#0A0A0A]/15 border-dashed bg-[#F5F5F5]/80 hover:border-[#0A0A0A]/40 hover:bg-white/80'
          }
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {disabled ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span className="text-xs font-medium text-[#757575]">Locked</span>
          </div>
        ) : image ? (
          <div className="relative w-full h-full group/image">
            <img src={image} className="w-full h-full object-cover opacity-80 group-hover/image:opacity-40 transition-opacity duration-300" alt="Ref" />
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity duration-200 gap-4">
              <button
                onClick={() => onSet(undefined)}
                className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                title="Remove Reference"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-xs font-medium text-[#0A0A0A] drop-shadow-md">Remove</span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => !disabled && inputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center text-[#757575] hover:text-[#0A0A0A] transition-colors gap-4"
            disabled={disabled}
          >
            <div className={`p-5 rounded-full border border-[#0A0A0A]/15 bg-[#F5F5F5]/50 transition-transform duration-300 ${isDragging ? 'scale-110 border-[#0A0A0A] text-[#0A0A0A]' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            </div>
            <div className="text-center">
              <span className="block text-sm font-medium mb-1">
                {isDragging ? 'Drop Here' : 'Add Ref'}
              </span>
              <span className="block text-xs text-gray-400">
                {isDragging ? 'Release to Set' : 'Drag & Drop / Click'}
              </span>
            </div>
          </button>
        )}

        <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={handleFileChange} disabled={disabled} />
      </div>

      {image && !disabled && (
        <div className="absolute top-1/2 right-full mr-3 w-10 h-px bg-gradient-to-l from-white/50 to-transparent"></div>
      )}
    </div>
  );
}
