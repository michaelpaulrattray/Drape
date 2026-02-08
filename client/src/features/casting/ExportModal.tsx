import React, { useState } from "react";
import { X } from "lucide-react";
import { ImageResolution } from "@/features/casting/constants";

export const ExportModal = ({
  isOpen,
  onClose,
  onExport,
  previewImage,
}: {
  isOpen: boolean;
  onClose: () => void;
  onExport: (name: string, resolution: ImageResolution) => void;
  previewImage?: string;
}) => {
  const [characterName, setCharacterName] = useState("");
  const [exportRes, setExportRes] = useState<ImageResolution>(ImageResolution.HIGH);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-white/95 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="max-w-2xl w-full bg-white border border-[#0A0A0A]/10 rounded-2xl flex flex-col md:flex-row shadow-2xl relative overflow-hidden">
        <div className="w-full md:w-1/2 aspect-[3/4] relative border-b md:border-b-0 md:border-r border-[#0A0A0A]/10 bg-[#EBEBEB]">
          {previewImage && (
            <img src={previewImage} className="w-full h-full object-cover opacity-80" alt="Identity Ref" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent"></div>
          <div className="absolute top-4 left-4 p-2 border border-[#0A0A0A]/10 rounded-xl bg-white/70 backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[#0A0A0A]/50"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-8 flex flex-col justify-center space-y-8 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-[#757575] hover:text-[#0A0A0A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#0A0A0A] tracking-tight">Identity Card</h2>
            <p className="text-sm text-[#757575] leading-relaxed">
              Assign a unique identity to finalize this casting session and export your character pack.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2 group">
              <label className="text-xs font-medium text-[#757575] group-focus-within:text-[#0A0A0A] transition-colors">Model Name</label>
              <input 
                autoFocus
                type="text" 
                value={characterName}
                onChange={e => setCharacterName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && characterName) onExport(characterName, exportRes); }}
                placeholder="ENTER NAME"
                className="w-full bg-transparent border-b border-[#0A0A0A]/15 text-xl font-medium text-[#0A0A0A] py-2 focus:outline-none focus:border-[#0A0A0A] placeholder:text-[#757575] transition-colors"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#757575]">Output Quality</label>
              <div className="grid grid-cols-2 gap-2">
                {[ImageResolution.STD, ImageResolution.HIGH, ImageResolution.ULTRA].map(res => (
                  <button
                    key={res}
                    onClick={() => setExportRes(res)}
                    className={`py-2.5 text-xs font-medium border rounded-full transition-all ${
                      exportRes === res 
                        ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white font-bold'
                        : 'border-[#0A0A0A]/10 text-[#757575] hover:border-[#0A0A0A]/30'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => onExport(characterName || 'Unknown Model', exportRes)}
            className="w-full py-3 bg-[#0A0A0A] text-white text-sm font-medium rounded-full hover:bg-[#0A0A0A]/90 transition-colors"
          >
            Export Character Pack
          </button>
        </div>
      </div>
    </div>
  );
};
