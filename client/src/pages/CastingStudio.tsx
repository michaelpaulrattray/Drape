import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Zap, X, Menu } from "lucide-react";
import TriBlendSelector from "@/components/TriBlendSelector";
import HairColorWheel from "@/components/HairColorWheel";
import Tooltip from "@/components/Tooltip";

// ============ Types ============

interface CastingVibe {
  editorial: number;
  commercial: number;
  runway: number;
}

interface ModelPreferences {
  castingBrand: string;
  castingVibe: CastingVibe;
  gender: string;
  age: string;
  ethnicity: string;
  bodyType: string;
  faceShape: string;
  skinTone: string;
  skinTexture: string;
  skinFinish: string;
  eyeColor: string;
  hairColor: string;
  hairStyle: string;
  hairLength: string;
  hairTexture: string;
  hairFringe: string;
  hairParting: string;
  hairVolume: string;
  hairFlyaways: string;
  hairHairline: string;
  hairTuck: string;
  hairFade: string;
  facialHair: string;
  jawline: string;
  cheekbones: string;
  cheeks: string;
  eyeShape: string;
  noseShape: string;
  lipShape: string;
  eyebrowStyle: string;
  features: string;
  referenceImage?: string;
  userPrompt: string;
}

interface GeneratedAsset {
  id: number;
  viewType: string;
  storageUrl: string;
}

interface GenerationState {
  isGenerating: boolean;
  currentStep: string;
  error: string | null;
}

type EditTool = 'none' | 'surgical' | 'eraser';

enum ImageResolution {
  STD = '1K',
  HIGH = '2K',
  ULTRA = '4K',
}

// ============ Constants ============

const BRAND_OPTIONS = [
  { value: "Gucci", desc: "Eclectic / Quirky" },
  { value: "Prada", desc: "Intellectual / Severe" },
  { value: "Saint Laurent", desc: "Heroin Chic / Edgy" },
  { value: "Balenciaga", desc: "Brutalist / Street" },
  { value: "Miu Miu", desc: "Subversive / Youthful" },
  { value: "Versace", desc: "Glamour / Bombshell" },
  { value: "Zara", desc: "Trendy / Polished" },
  { value: "Social Media", desc: "Creator / Authentic" },
];

const ETHNICITIES = [
  "Slavic", "Nordic", "East Asian", "South Asian",
  "Afro-Caribbean", "West African", "Latino",
  "Middle Eastern", "Mixed", "Polynesian"
];

const SKIN_TONES = [
  { label: "Porcelain", value: "Porcelain / Pale", base: "#ffe0d6", shadow: "#eac0b0" },
  { label: "Fair", value: "Fair / Light", base: "#f5cbb6", shadow: "#dcb098" },
  { label: "Medium", value: "Medium / Olive", base: "#d9ae88", shadow: "#bf926b" },
  { label: "Tan", value: "Tan / Bronze", base: "#c08a65", shadow: "#a06d48" },
  { label: "Deep", value: "Deep / Brown", base: "#8d5e42", shadow: "#6b422a" },
  { label: "Ebony", value: "Ebony / Dark", base: "#593b2b", shadow: "#3d2316" },
];

const SKIN_TEXTURES = ["Raw / Standard", "Glass / Perfect", "Freckled", "Textured / Acneic", "Mature"];
const SKIN_FINISHES = ["Natural", "Matte / Powdered", "Dewy / Sweat", "Oily"];

const EYE_PRESETS = [
  { label: "Ice", hex: "#c4d6e0", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/vqqDiUXdPHouiNIf.png" },
  { label: "Sky", hex: "#8fb6cd", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/ugREJGTmZHvGohva.png" },
  { label: "Azure", hex: "#4e7bb5", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/SrbVePLOZFZeFwZS.png" },
  { label: "Navy", hex: "#283655", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/IlubwHpACNZdKPpY.png" },
  { label: "Grey", hex: "#9baec2", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/BXLKpjMgtBPPpNsl.png" },
  { label: "Steel", hex: "#687684", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/gEYsnjXMHagLDaRN.png" },
  { label: "Mint", hex: "#8caea0", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/JEqWKitxQAJvcOIv.png" },
  { label: "Green", hex: "#4f6f46", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/xEpghHNbKukwluSa.png" },
  { label: "Olive", hex: "#6e7039", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/wUXmPVotKyBuOZvm.png" },
  { label: "Hazel", hex: "#947846", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/wPHJlTLLFHOIlKCl.png" },
  { label: "Amber", hex: "#c49647", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/kJEPKFDnnbdYyFno.png" },
  { label: "Honey", hex: "#b89650", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/ELDsMLehQBRKSxFm.png" },
  { label: "Brown", hex: "#634e34", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/lakRCWMCLaAKsoRC.png" },
  { label: "Dark", hex: "#3b2b22", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/MiiYEWWDcEbbMeBP.png" },
  { label: "Black", hex: "#1c1c1c", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/yfPffJwzBtjyLMnc.png" },
];

const CHAR_OPTIONS = {
  jawline: ["Sharp / Chiseled", "Soft / Rounded", "Strong / Pronounced", "Receding / Weak", "Snatched"],
  cheekbones: ["High", "Defined", "Soft"],
  cheeks: ["Slightly Hollow", "Full", "Balanced"],
  eyeShape: ["Thin Almond", "Monolids", "Wide-Set", "Round", "Hooded"],
  noseShape: ["Thin", "Straight Bridge", "Rounded", "Prominent", "Button"],
  lipShape: ["Full", "Subtle", "Lip Lift", "Wide", "Cupid's Bow"],
  eyebrows: ["Brushed Up", "Straight", "Arched", "Bold", "Bleached", "Random"],
  facialHair: ["Clean Shaven", "Stubble", "Short Beard", "Full Beard"],
};

const HAIR_FAMILIES_FEMALE = [
  "Buzz / Shaved", "Pixie", "Cropped Bob", "Bob", "Lob (Long Bob)",
  "Medium Layers", "Long Layers", "Shag / Wolf", "Blunt Cut",
  "Updo", "Pulled Back", "Braids"
];

const HAIR_FAMILIES_MALE = [
  "Buzz / Shaved", "Crew / Ivy League", "French Crop", "Caesar",
  "Short Textured", "Fade", "Undercut", "Slick Back",
  "Side Part", "Quiff", "Medium Layers", "Long Layers",
  "Curly Top", "Man Bun", "Braids / Locs"
];

const HAIR_LENGTHS = ["Very Short", "Short", "Medium", "Long", "Very Long"];
const HAIR_TEXTURES = ["Straight", "Slight Wave", "Wavy", "Curly", "Coily / Afro"];
const HAIR_FRINGES = ["None", "Curtain Bangs", "Wispy Bangs", "Blunt Bangs", "Side-Swept", "Micro Fringe"];
const HAIR_PARTINGS = ["Center", "Slight Off-Center", "Side", "Deep Side", "No Part / Slicked"];
const HAIR_VOLUMES = ["Flat / Sleek", "Natural", "Voluminous", "Lifted Crown", "Face-Framing"];
const HAIR_TUCKS = ["None", "One Side", "Both Sides"];
const HAIR_FADES = ["None", "Low Taper", "Mid Fade", "High Fade", "Skin Fade"];

const BODY_TYPES = [
  { label: "Ultra Thin", value: "Ultra Thin" },
  { label: "Slim", value: "Slim" },
  { label: "Athletic", value: "Athletic" },
  { label: "Muscular", value: "Muscular" },
  { label: "Curvy", value: "Curvy" },
  { label: "Petite", value: "Petite" },
];

const FACE_SHAPES = ["Oval", "Round", "Square", "Heart", "Diamond", "Random"];

const POINT_COSTS = {
  masterPrompt: 2,
  castingImage: 10,
  fullBody: 8,
  multiView: 15,
  iteration: 5,
};

// ============ SVG Icons ============

const BODY_ICONS: Record<string, React.ReactNode> = {
  "Ultra Thin": <path d="M12 2C10 2 9 4 9 5C9 7 8 10 9 13C10 16 9 19 9 22H15C15 19 14 16 15 13C16 10 15 7 15 5C15 4 14 2 12 2Z" />,
  "Athletic": <path d="M12 2C9 2 7 4 7 6C7 8 8 11 10 13C11 14 11 16 11 22H13C13 16 13 14 14 13C16 11 17 8 17 6C17 4 15 2 12 2Z" />,
  "Slim": <path d="M12 2C10.5 2 9 4 9 5.5C9 7.5 9.5 10 10 12.5C10.5 15 10.5 18 10.5 22H13.5C13.5 18 13.5 15 14 12.5C14.5 10 15 7.5 15 5.5C15 4 13.5 2 12 2Z" />,
  "Curvy": <path d="M12 2C9 2 8 4 8 6C8 9 7 12 8 15C9 18 8 20 8 22H16C16 20 15 18 16 15C17 12 16 9 16 6C16 4 15 2 12 2Z" />,
  "Muscular": <path d="M12 2C8 2 6 4 6 6C6 8 8 9 9 11C10 13 10 16 10 22H14C14 16 14 13 15 11C16 9 18 8 18 6C18 4 16 2 12 2Z" />,
  "Petite": <path d="M12 3C10.5 3 9.5 4.5 9.5 6C9.5 7.5 10 9.5 10.5 11.5C11 13.5 11 16 11 22H13C13 16 13 13.5 13.5 11.5C14 9.5 14.5 7.5 14.5 6C14.5 4.5 13.5 3 12 3Z" />,
};

const FACE_ICONS: Record<string, React.ReactNode> = {
  "Oval": <path d="M12 2C7 2 5 6 5 11C5 16 8 22 12 22C16 22 19 16 19 11C19 6 17 2 12 2Z" />,
  "Round": <circle cx="12" cy="12" r="10" />,
  "Square": <rect x="4" y="4" width="16" height="16" rx="2" />,
  "Heart": <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" transform="scale(0.8) translate(3, 2)" />,
  "Diamond": <polygon points="12 2 4 10 12 22 20 10" />,
  "Random": <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l-5 5M4 4l5 5" />,
};

// ============ ConnectorLine Component ============

const ConnectorLine = ({ isActive }: { isActive: boolean }) => (
  <div 
    className={`absolute top-[18rem] right-[21.5rem] w-[35vw] h-[35vh] z-0 pointer-events-none transition-all duration-1000 ease-out origin-top-right ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-90 blur-sm'}`}
  >
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id="connector-grad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <filter id="glow-line">
          <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path 
        d="M 100 0 C 50 0, 50 100, 0 100" 
        vectorEffect="non-scaling-stroke"
        stroke="url(#connector-grad)" 
        strokeWidth="1.5" 
        fill="none"
        strokeDasharray="4 4"
        filter="url(#glow-line)"
        className="opacity-80"
      />
      <circle cx="100" cy="0" r="2" fill="white" filter="url(#glow-line)" vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
);

// ============ StageLockModal Component ============

const StageLockModal = ({ 
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
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border border-studio-700 p-6 max-w-sm w-full shadow-2xl space-y-4">
        <h3 className="text-sm font-mono uppercase text-white font-bold tracking-widest">{title}</h3>
        <p className="text-xs font-mono text-studio-400 leading-relaxed">{message}</p>
        <div className="flex space-x-2 pt-2">
          <button onClick={onCancel} className="flex-1 py-2 border border-studio-800 text-studio-400 hover:text-white hover:border-studio-500 text-[10px] uppercase font-mono tracking-widest transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 bg-white text-black hover:bg-studio-200 text-[10px] uppercase font-mono tracking-widest transition-colors font-bold">Confirm</button>
        </div>
      </div>
    </div>
  );
};

// ============ ToolButton Component ============

const ToolButton = ({ 
  isActive, 
  onClick, 
  icon, 
  label,
  color = "red" 
}: { 
  isActive: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  color?: "red" | "purple";
}) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`relative group w-10 h-10 flex items-center justify-center rounded-lg border transition-all duration-200 shadow-lg backdrop-blur-sm
      ${isActive 
        ? color === 'red' ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-purple-500/10 border-purple-500 text-purple-400'
        : 'bg-black/60 border-studio-700 text-studio-400 hover:text-white hover:border-studio-500'
      }
    `}
    title={label}
  >
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
      {icon}
    </div>
    
    {isActive && (
      <span className={`absolute top-0 right-0 -mt-1 -mr-1 flex h-2.5 w-2.5`}>
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color === 'red' ? 'bg-red-500' : 'bg-purple-500'}`}></span>
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color === 'red' ? 'bg-red-500' : 'bg-purple-500'}`}></span>
      </span>
    )}
  </button>
);

// ============ Export Modal Component ============

const ExportModal = ({
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
    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="max-w-2xl w-full bg-[#0a0a0a] border border-studio-800 flex flex-col md:flex-row shadow-2xl relative overflow-hidden">
        <div className="w-full md:w-1/2 aspect-[3/4] relative border-b md:border-b-0 md:border-r border-studio-800 bg-black">
          {previewImage && (
            <img src={previewImage} className="w-full h-full object-cover opacity-80" alt="Identity Ref" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          <div className="absolute top-4 left-4 p-2 border border-white/20 bg-black/50 backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white/50"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-8 flex flex-col justify-center space-y-8 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-studio-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-mono text-white uppercase tracking-tighter">Identity Card</h2>
            <p className="text-xs font-mono text-studio-500 leading-relaxed">
              Assign a unique identity to finalize this casting session and export your character pack.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2 group">
              <label className="text-[9px] font-mono text-studio-500 uppercase tracking-widest group-focus-within:text-white transition-colors">Model Name</label>
              <input 
                autoFocus
                type="text" 
                value={characterName}
                onChange={e => setCharacterName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && characterName) onExport(characterName, exportRes); }}
                placeholder="ENTER NAME"
                className="w-full bg-transparent border-b border-studio-700 text-xl font-mono text-white py-2 focus:outline-none focus:border-white placeholder:text-studio-800 uppercase tracking-wider transition-colors"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[9px] font-mono text-studio-500 uppercase tracking-widest">Output Quality</label>
              <div className="grid grid-cols-2 gap-2">
                {[ImageResolution.STD, ImageResolution.HIGH, ImageResolution.ULTRA].map(res => (
                  <button
                    key={res}
                    onClick={() => setExportRes(res)}
                    className={`py-2 text-[10px] font-mono uppercase tracking-widest border transition-all ${
                      exportRes === res 
                        ? 'border-white bg-white text-black font-bold'
                        : 'border-studio-800 text-studio-500 hover:border-studio-500'
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
            className="w-full py-3 bg-white text-black font-mono text-xs uppercase tracking-widest hover:bg-studio-200 transition-colors font-bold"
          >
            Export Character Pack
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Helper Components ============

function CollapsibleSection({
  title,
  required = false,
  children,
  defaultOpen = true,
}: {
  title: string;
  required?: boolean;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-studio-800/50 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 group focus:outline-none select-none"
      >
        <div className="flex items-center space-x-3">
          <h3 className={`text-[10px] uppercase font-bold tracking-widest transition-colors duration-300 ${isOpen ? 'text-white' : 'text-studio-500 group-hover:text-studio-400'}`}>
            {title}
          </h3>
          {required && <span className="text-studio-700 text-[10px] group-hover:text-studio-500 transition-colors">*</span>}
        </div>
        <div className={`transform transition-transform duration-300 text-studio-700 group-hover:text-studio-500 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[3000px] opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange,
  tooltip,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  tooltip?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center">
        <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider">{label}</label>
        {tooltip && <Tooltip content={tooltip} />}
      </div>
      <div className="relative group">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-studio-900 border border-studio-800 text-studio-300 text-[10px] font-mono py-2 pl-2 pr-6 rounded-sm focus:border-white focus:outline-none appearance-none cursor-pointer hover:border-studio-600 transition-colors"
        >
          <option value="" className="bg-studio-900 text-studio-500">Auto / Random</option>
          {options.map(opt => (
            <option key={opt} value={opt} className="bg-studio-900 text-studio-300">{opt}</option>
          ))}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-studio-500 group-hover:text-studio-300 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
    </div>
  );
}

function VisualOptionGrid({
  options,
  selected,
  onSelect,
  icons,
}: {
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  icons?: Record<string, React.ReactNode>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(opt => {
        const isSelected = selected === opt;
        return (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`
              flex flex-col items-center justify-center h-16 rounded border transition-all duration-200 group
              ${isSelected
                ? 'bg-studio-800 border-white text-white'
                : 'bg-transparent border-studio-800 text-studio-500 hover:border-studio-600 hover:bg-studio-900 hover:text-studio-300'
              }
            `}
          >
            <div className={`mb-1.5 transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-90 group-hover:scale-100'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isSelected ? "0" : "1.5"}>
                {icons?.[opt] || <circle cx="12" cy="12" r="8" />}
              </svg>
            </div>
            <span className="text-[8px] font-mono uppercase tracking-wide leading-none text-center">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function VisualEyeGrid({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; hex: string; image?: string }[];
  selected: string;
  onSelect: (val: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {options.map(opt => {
        const isSelected = selected === opt.label;
        return (
          <button
            key={opt.label}
            onClick={() => onSelect(opt.label)}
            className={`
              relative w-full aspect-square rounded-full border transition-all duration-200 group overflow-hidden
              ${isSelected
                ? 'border-white ring-1 ring-white scale-110 z-10'
                : 'border-studio-800 hover:border-studio-500 hover:scale-105 opacity-80 hover:opacity-100'
              }
            `}
            title={opt.label}
          >
            {opt.image ? (
              <img
                src={opt.image}
                alt={opt.label}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <>
                <div
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(circle at 35% 35%, ${opt.hex} 0%, #151515 80%)` }}
                />
                <div className="absolute top-[25%] left-[25%] w-[15%] h-[15%] bg-white rounded-full blur-[1px] opacity-50" />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============ Reference Node Component ============

function ReferenceNode({
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
            ? 'border-studio-800 bg-studio-900/30 cursor-not-allowed'
            : image
              ? 'border-white shadow-2xl'
              : isDragging
                ? 'border-white bg-studio-800 scale-105 shadow-xl'
                : 'border-studio-800 border-dashed bg-black/40 hover:border-studio-600 hover:bg-black/60'
          }
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {disabled ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-studio-700 gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span className="text-[10px] font-mono uppercase tracking-widest">Locked</span>
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
              <span className="text-[10px] font-mono font-bold uppercase text-white tracking-widest drop-shadow-md">Remove</span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => !disabled && inputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center text-studio-600 hover:text-studio-300 transition-colors gap-4"
            disabled={disabled}
          >
            <div className={`p-5 rounded-full border border-studio-700 bg-studio-900/50 transition-transform duration-300 ${isDragging ? 'scale-110 border-white text-white' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            </div>
            <div className="text-center">
              <span className="block text-xs font-mono uppercase font-bold tracking-widest mb-1">
                {isDragging ? 'Drop Here' : 'Add Ref'}
              </span>
              <span className="block text-[9px] font-mono text-studio-700">
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

// ============ Main Component ============

export default function CastingStudio() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // Model preferences state
  const [prefs, setPrefs] = useState<ModelPreferences>({
    castingBrand: 'Gucci',
    castingVibe: { editorial: 0.33, commercial: 0.33, runway: 0.34 },
    gender: '',
    age: '23',
    ethnicity: '',
    bodyType: 'Slim',
    faceShape: 'Oval',
    skinTone: '',
    skinTexture: 'Raw / Standard',
    skinFinish: 'Natural',
    eyeColor: '',
    hairColor: '',
    hairStyle: '',
    hairLength: 'Medium',
    hairTexture: 'Straight',
    hairFringe: 'None',
    hairParting: 'Center',
    hairVolume: 'Natural',
    hairFlyaways: '',
    hairHairline: '',
    hairTuck: '',
    hairFade: '',
    facialHair: '',
    jawline: '',
    cheekbones: '',
    cheeks: '',
    eyeShape: '',
    noseShape: '',
    lipShape: '',
    eyebrowStyle: 'Random',
    features: '',
    userPrompt: '',
  });

  // Generation state
  const [genState, setGenState] = useState<GenerationState>({
    isGenerating: false,
    currentStep: "",
    error: null,
  });

  // Current model state
  const [currentModelId, setCurrentModelId] = useState<number | null>(null);
  const [currentAssets, setCurrentAssets] = useState<GeneratedAsset[]>([]);
  const [activeView, setActiveView] = useState<string>("frontClose");
  const [modelName, setModelName] = useState("");

  // History for undo/redo
  const [history, setHistory] = useState<GeneratedAsset[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // UI state
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [showAdvancedFace, setShowAdvancedFace] = useState(false);
  const [showAdvancedHair, setShowAdvancedHair] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [unlockMode, setUnlockMode] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Resolution state
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.STD);

  // Tools state
  const [activeTool, setActiveTool] = useState<EditTool>('none');
  const [isDrawing, setIsDrawing] = useState(false);
  const [maskPaths, setMaskPaths] = useState<Array<Array<{x: number, y: number}>>>([]);
  const [currentPath, setCurrentPath] = useState<Array<{x: number, y: number}>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [lockModal, setLockModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Points data
  const { data: pointsData, refetch: refetchPoints } = trpc.points.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Mutations
  const createModelMutation = trpc.models.create.useMutation();
  const generateCastingMutation = trpc.generation.castingImage.useMutation();
  const generateFullBodyMutation = trpc.generation.fullBody.useMutation();
  const generateMultiViewMutation = trpc.generation.multiView.useMutation();
  const iterateMutation = trpc.generation.iterate.useMutation();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Auto-resize textarea
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      const scrollHeight = textAreaRef.current.scrollHeight;
      textAreaRef.current.style.height = Math.min(scrollHeight, 200) + 'px';
    }
  }, [refineInput]);

  // Reset tool state when view changes
  useEffect(() => {
    setUnlockMode(false);
    setActiveTool('none');
    setMaskPaths([]);
    setCurrentPath([]);
  }, [activeView, currentAssets]);

  // Clear mask when tool changes
  useEffect(() => {
    setMaskPaths([]);
    setCurrentPath([]);
  }, [activeTool]);

  // Sync canvas with image
  const isMasking = activeTool !== 'none';

  useEffect(() => {
    const syncCanvas = () => {
      if (imageRef.current && canvasRef.current) {
        const { width, height } = imageRef.current.getBoundingClientRect();
        
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        
        const ctx = canvasRef.current.getContext('2d');
        if (ctx && isMasking) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 20; 
          ctx.strokeStyle = activeTool === 'eraser' 
            ? 'rgba(216, 180, 254, 0.8)'
            : 'rgba(255, 100, 100, 0.8)';
          
          if (maskPaths.length > 0) {
            maskPaths.forEach(path => {
              if (path.length < 1) return;
              ctx.beginPath();
              ctx.moveTo(path[0].x * width, path[0].y * height);
              path.forEach(p => ctx.lineTo(p.x * width, p.y * height));
              ctx.stroke();
            });
          }
        }
      }
    };

    syncCanvas();

    if (isMasking) {
      window.addEventListener('resize', syncCanvas);
      setTimeout(syncCanvas, 50);
    }
    
    return () => window.removeEventListener('resize', syncCanvas);
  }, [isMasking, maskPaths, activeTool]);

  // Canvas drawing handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMasking) return;
    setIsDrawing(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentPath([{ x, y }]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMasking || !isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const newPoint = { x, y };
    setCurrentPath(prev => [...prev, newPoint]);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 20;
      ctx.strokeStyle = activeTool === 'eraser' 
        ? 'rgba(216, 180, 254, 0.8)'
        : 'rgba(255, 100, 100, 0.8)';
      
      const w = rect.width;
      const h = rect.height;
      
      ctx.beginPath();
      const prev = currentPath[currentPath.length - 1] || newPoint;
      ctx.moveTo(prev.x * w, prev.y * h);
      ctx.lineTo(x * w, y * h);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!isMasking || !isDrawing) return;
    setIsDrawing(false);
    setMaskPaths(prev => [...prev, currentPath]);
    setCurrentPath([]);
  };

  // Get hair styles based on gender
  const currentHairFamilies = useMemo(() => {
    const g = (prefs.gender || "Female").toLowerCase();
    return g === 'male' ? HAIR_FAMILIES_MALE : HAIR_FAMILIES_FEMALE;
  }, [prefs.gender]);

  // Form validation
  const isFormValid = useMemo(() => {
    return (
      !!prefs.gender &&
      !!prefs.age &&
      !!prefs.ethnicity &&
      !!prefs.skinTone &&
      !!prefs.eyeColor &&
      !!prefs.hairColor &&
      !!prefs.hairStyle
    );
  }, [prefs]);

  // Update preference helper
  const updatePref = <K extends keyof ModelPreferences>(key: K, value: ModelPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  // Ethnicity handler (max 2 or Mixed)
  const handleEthnicityClick = (eth: string) => {
    const currentStr = prefs.ethnicity || "";
    let current = currentStr.split(", ").filter(e => e && e.trim() !== "");

    if (eth === "Mixed") {
      if (current.length === 1 && current[0] === "Mixed") updatePref("ethnicity", "");
      else updatePref("ethnicity", "Mixed");
      return;
    }

    if (current.length === 1 && current[0] === "Mixed") current = [];
    current = current.filter(e => e !== "Mixed");

    if (current.includes(eth)) current = current.filter(e => e !== eth);
    else {
      if (current.length >= 2) current.shift();
      current.push(eth);
    }
    updatePref("ethnicity", current.join(", "));
  };

  const isEthSelected = (eth: string) => {
    const currentStr = prefs.ethnicity || "";
    const current = currentStr.split(", ").filter(e => e && e.trim() !== "");
    if (eth === "Mixed") return (current.length === 1 && current[0] === "Mixed") || current.length > 1;
    return current.includes(eth);
  };

  // Get current image URL
  const currentImageUrl = useMemo(() => {
    const asset = currentAssets.find((a) => a.viewType === activeView);
    return asset?.storageUrl || null;
  }, [currentAssets, activeView]);

  // Check if can generate specific views
  const canGenerateFullBody = currentAssets.some((a) => a.viewType === "frontClose");
  const canGenerateMultiView = currentAssets.some((a) => a.viewType === "frontFull" || a.viewType === "frontClose");

  // View locking logic
  const isViewLocked = useMemo(() => {
    if (currentAssets.length === 0) return false;
    if (activeView === 'frontClose' && currentAssets.some(a => a.viewType === 'frontFull')) return true;
    if (activeView === 'frontFull' && currentAssets.some(a => a.viewType === 'sideClose')) return true;
    if (activeView === 'backFull') return true;
    return false;
  }, [activeView, currentAssets]);

  const hasDownstreamDependencies = useMemo(() => {
    if (currentAssets.length === 0) return false;
    if (activeView === 'frontClose' && currentAssets.some(a => a.viewType === 'frontFull')) return true;
    if (activeView === 'frontFull' && currentAssets.some(a => a.viewType === 'sideClose')) return true;
    return false;
  }, [activeView, currentAssets]);

  const isIterationAllowed = useMemo(() => {
    return ['frontClose', 'frontFull', 'backFull'].includes(activeView);
  }, [activeView]);

  // Handle generate
  const handleGenerate = async () => {
    if (!isFormValid) {
      toast.error("Please fill in all required fields");
      return;
    }

    const totalCost = POINT_COSTS.masterPrompt + POINT_COSTS.castingImage;
    if (!pointsData || pointsData.balance < totalCost) {
      toast.error(`Insufficient points. Need ${totalCost} points.`);
      return;
    }

    setGenState({ isGenerating: true, currentStep: "Writing Casting Spec...", error: null });

    try {
      const backendPrefs = {
        gender: prefs.gender.toLowerCase() as "male" | "female" | "non-binary",
        ageRange: getAgeRange(prefs.age),
        ethnicity: prefs.ethnicity,
        bodyType: prefs.bodyType.toLowerCase().replace(/ /g, '-') as any,
        height: "average" as const,
        hairColor: prefs.hairColor,
        hairLength: prefs.hairLength?.toLowerCase().replace(/ /g, '-') as any || "medium",
        hairStyle: prefs.hairStyle,
        skinTone: prefs.skinTone,
        eyeColor: prefs.eyeColor,
        facialFeatures: prefs.features,
        brandTone: getBrandTone(prefs.castingBrand),
        mood: getMood(prefs.castingVibe),
        referenceDescription: prefs.userPrompt,
      };

      setGenState((prev) => ({ ...prev, currentStep: "Generating casting specification..." }));
      const modelResult = await createModelMutation.mutateAsync({
        preferences: backendPrefs,
        name: modelName || undefined,
      });

      setCurrentModelId(modelResult.modelId ?? null);

      setGenState((prev) => ({ ...prev, currentStep: "Casting Headshot..." }));
      const imageResult = await generateCastingMutation.mutateAsync({
        modelId: modelResult.modelId!,
      });

      if (imageResult.success && imageResult.imageUrl) {
        const newAsset: GeneratedAsset = {
          id: Date.now(),
          viewType: "frontClose",
          storageUrl: imageResult.imageUrl,
        };
        setCurrentAssets([newAsset]);
        setHistory([[newAsset]]);
        setHistoryIndex(0);
        setActiveView("frontClose");
        toast.success("Model generated successfully!");
        refetchPoints();
      }

      setGenState({ isGenerating: false, currentStep: "", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      setGenState({ isGenerating: false, currentStep: "", error: message });
      toast.error(message);
    }
  };

  // Helper functions for backend conversion
  const getAgeRange = (age: string): "18-25" | "25-35" | "35-45" | "45-55" | "55+" => {
    const ageNum = parseInt(age);
    if (ageNum < 25) return "18-25";
    if (ageNum < 35) return "25-35";
    if (ageNum < 45) return "35-45";
    if (ageNum < 55) return "45-55";
    return "55+";
  };

  const getBrandTone = (brand: string): "luxury" | "streetwear" | "minimalist" | "editorial" | "commercial" | "avant-garde" => {
    const mapping: Record<string, any> = {
      "Gucci": "luxury",
      "Prada": "minimalist",
      "Saint Laurent": "editorial",
      "Balenciaga": "streetwear",
      "Miu Miu": "avant-garde",
      "Versace": "luxury",
      "Zara": "commercial",
      "Social Media": "commercial",
    };
    return mapping[brand] || "editorial";
  };

  const getMood = (vibe: CastingVibe): "confident" | "serene" | "edgy" | "playful" | "mysterious" | "natural" => {
    if (vibe.editorial > 0.5) return "edgy";
    if (vibe.commercial > 0.5) return "natural";
    if (vibe.runway > 0.5) return "mysterious";
    return "confident";
  };

  // Handle generate full body with stage lock
  const handleGenerateFullBody = async () => {
    if (!currentModelId) return;

    setLockModal({
      isOpen: true,
      title: 'Lock Headshot & Generate Body?',
      message: "Are you sure you want to proceed to full-body generation? You won't be able to return and edit the head without resetting the body generation.",
      onConfirm: async () => {
        setLockModal(prev => ({ ...prev, isOpen: false }));
        
        if (!pointsData || pointsData.balance < POINT_COSTS.fullBody) {
          toast.error(`Insufficient points. Need ${POINT_COSTS.fullBody} points.`);
          return;
        }

        setGenState({ isGenerating: true, currentStep: "Generating Full Body View...", error: null });

        try {
          const result = await generateFullBodyMutation.mutateAsync({ modelId: currentModelId });

          if (result.success && result.imageUrl) {
            const newAsset: GeneratedAsset = {
              id: Date.now(),
              viewType: "frontFull",
              storageUrl: result.imageUrl,
            };
            const newAssets = [...currentAssets.filter((a) => a.viewType !== "frontFull"), newAsset];
            setCurrentAssets(newAssets);
            setHistory((prev) => [...prev.slice(0, historyIndex + 1), newAssets]);
            setHistoryIndex((prev) => prev + 1);
            setActiveView("frontFull");
            toast.success("Full body generated!");
            refetchPoints();
          }

          setGenState({ isGenerating: false, currentStep: "", error: null });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Generation failed";
          setGenState({ isGenerating: false, currentStep: "", error: message });
          toast.error(message);
        }
      }
    });
  };

  // Handle generate multi-view with stage lock
  const handleGenerateMultiView = async (viewType: "side" | "back") => {
    if (!currentModelId) return;

    setLockModal({
      isOpen: true,
      title: 'Lock Body & Generate Views?',
      message: "Are you sure you want to proceed to casting sheet generation? You won't be able to edit the body pose without resetting the entire sheet.",
      onConfirm: async () => {
        setLockModal(prev => ({ ...prev, isOpen: false }));

        if (!pointsData || pointsData.balance < POINT_COSTS.multiView) {
          toast.error(`Insufficient points. Need ${POINT_COSTS.multiView} points.`);
          return;
        }

        setGenState({ isGenerating: true, currentStep: `Generating ${viewType} view...`, error: null });

        try {
          const result = await generateMultiViewMutation.mutateAsync({
            modelId: currentModelId,
            viewType,
          });

          if (result.success && result.imageUrl) {
            const viewKey = viewType === "side" ? "sideClose" : "backFull";
            const newAsset: GeneratedAsset = {
              id: Date.now(),
              viewType: viewKey,
              storageUrl: result.imageUrl,
            };
            const newAssets = [...currentAssets.filter((a) => a.viewType !== viewKey), newAsset];
            setCurrentAssets(newAssets);
            setHistory((prev) => [...prev.slice(0, historyIndex + 1), newAssets]);
            setHistoryIndex((prev) => prev + 1);
            setActiveView(viewKey);
            toast.success(`${viewType} view generated!`);
            refetchPoints();
          }

          setGenState({ isGenerating: false, currentStep: "", error: null });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Generation failed";
          setGenState({ isGenerating: false, currentStep: "", error: message });
          toast.error(message);
        }
      }
    });
  };

  // Handle iteration/refinement
  const handleRefineSubmit = async () => {
    if (!currentModelId || !currentImageUrl) return;

    // For eraser tool, use automatic prompt
    if (activeTool === 'eraser') {
      if (maskPaths.length === 0) return;
      const prompt = "FIX ARTIFACT: Remove the content in the masked area. Inpaint with surrounding skin texture, lighting, and noise. Restore the background if needed. Do not add new objects.";
      await performIteration(prompt);
      setActiveTool('none');
      setMaskPaths([]);
      return;
    }

    // For text input
    if (refineInput.trim()) {
      await performIteration(refineInput);
      setRefineInput("");
      setActiveTool('none');
      setMaskPaths([]);
    }
  };

  const performIteration = async (prompt: string) => {
    if (!currentModelId) return;

    if (!pointsData || pointsData.balance < POINT_COSTS.iteration) {
      toast.error(`Insufficient points. Need ${POINT_COSTS.iteration} points.`);
      return;
    }

    setGenState({ isGenerating: true, currentStep: "Iterating...", error: null });

    try {
      // Find the asset ID for the current view
      const currentAsset = currentAssets.find(a => a.viewType === activeView);
      if (!currentAsset) {
        throw new Error('No asset found for current view');
      }
      
      const result = await iterateMutation.mutateAsync({
        modelId: currentModelId,
        feedback: prompt,
        assetId: currentAsset.id,
      });

      if (result.success && result.imageUrl) {
        const newAsset: GeneratedAsset = {
          id: Date.now(),
          viewType: activeView,
          storageUrl: result.imageUrl,
        };
        
        // Clear downstream views if editing upstream
        let newAssets = [...currentAssets];
        if (activeView === 'frontClose') {
          newAssets = newAssets.filter(a => a.viewType === 'frontClose');
        } else if (activeView === 'frontFull') {
          newAssets = newAssets.filter(a => ['frontClose', 'frontFull'].includes(a.viewType));
        }
        
        newAssets = [...newAssets.filter((a) => a.viewType !== activeView), newAsset];
        setCurrentAssets(newAssets);
        setHistory((prev) => [...prev.slice(0, historyIndex + 1), newAssets]);
        setHistoryIndex((prev) => prev + 1);
        toast.success("Iteration complete!");
        refetchPoints();
      }

      setGenState({ isGenerating: false, currentStep: "", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Iteration failed";
      setGenState({ isGenerating: false, currentStep: "", error: message });
      toast.error(message);
    }
  };

  // AI prompt enhancement
  const handleEnhance = async () => {
    if (!refineInput.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      // Simple enhancement - in production this would call an AI service
      const enhanced = `[ENHANCED] ${refineInput.trim()}. Maintain character consistency and lighting.`;
      setRefineInput(enhanced);
      toast.success("Prompt enhanced!");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Export handler
  const handleExport = (name: string, res: ImageResolution) => {
    toast.success(`Exporting ${name} at ${res} resolution...`);
    setShowExportModal(false);
    // In production, this would trigger actual export
  };

  // Retry handler
  const handleRetry = () => {
    setGenState({ isGenerating: false, currentStep: "", error: null });
    handleGenerate();
  };

  // Undo/Redo
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = () => {
    if (canUndo) {
      setHistoryIndex((prev) => prev - 1);
      setCurrentAssets(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      setHistoryIndex((prev) => prev + 1);
      setCurrentAssets(history[historyIndex + 1]);
    }
  };

  // Next stage calculation
  const nextStage = useMemo(() => {
    if (currentAssets.length === 0 || genState.isGenerating) return null;
    
    if (!currentAssets.some(a => a.viewType === 'frontFull')) {
      return { 
        label: 'Generate Full Body', 
        action: handleGenerateFullBody,
        step: 2,
        total: 3,
      };
    }
    
    if (!currentAssets.some(a => a.viewType === 'sideClose')) {
      return { 
        label: 'Generate Angles', 
        action: () => handleGenerateMultiView('side'),
        step: 3,
        total: 3,
      };
    }

    return {
      label: 'Export Character Pack',
      action: () => setShowExportModal(true),
      step: 4, 
      total: 3,
    };
  }, [currentAssets, genState.isGenerating]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col lg:flex-row">
      {/* Stage Lock Modal */}
      <StageLockModal
        isOpen={lockModal.isOpen}
        title={lockModal.title}
        message={lockModal.message}
        onConfirm={lockModal.onConfirm}
        onCancel={() => setLockModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        previewImage={currentAssets.find(a => a.viewType === 'frontClose')?.storageUrl}
      />

      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-studio-800 bg-[#080808]">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-studio-500 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs font-mono uppercase">Back</span>
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-white" />
            <span className="text-sm font-mono text-white">{pointsData?.balance || 0}</span>
          </div>
          <button
            onClick={() => setShowMobilePanel(!showMobilePanel)}
            className="p-2 rounded-lg bg-studio-800 text-white"
          >
            {showMobilePanel ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Left Panel - Control Panel */}
      <aside className={`
        ${showMobilePanel ? 'fixed inset-0 z-50 pt-16 flex flex-col' : 'hidden'}
        lg:relative lg:flex lg:flex-col lg:w-[400px] lg:pt-0
        bg-[#080808] border-r border-studio-800 h-screen flex-shrink-0
      `}>
        {/* Header */}
        <div className="hidden lg:flex p-4 border-b border-studio-800 items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-studio-500 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs font-mono uppercase">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-white" />
            <span className="text-sm font-mono text-white">{pointsData?.balance || 0}</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-2 custom-scrollbar">
          {/* 1. CASTING BASICS */}
          <CollapsibleSection title="Casting Basics" required>
            <div className="space-y-4 pt-1">
              {/* Brand Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center">
                  <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider">Casting For</label>
                  <Tooltip content="Sets the brand archetype. Affects face structure, attitude, and styling." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BRAND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updatePref('castingBrand', opt.value)}
                      className={`
                        flex flex-col items-start p-2 rounded-sm border transition-all text-left
                        ${prefs.castingBrand === opt.value
                          ? 'bg-studio-800 border-white text-white'
                          : 'bg-studio-900 border-studio-800 text-studio-500 hover:border-studio-600 hover:text-studio-300'
                        }
                      `}
                    >
                      <span className="text-[10px] font-mono uppercase font-bold tracking-wide">{opt.value}</span>
                      <span className="text-[8px] font-mono text-studio-500 tracking-tight leading-none mt-1 opacity-80">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* TriBlend Selector */}
              <div className="pt-2">
                <TriBlendSelector
                  value={prefs.castingVibe}
                  onChange={(val) => updatePref('castingVibe', val)}
                />
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider">Gender</label>
                <div className="flex bg-studio-900 p-0.5 rounded border border-studio-800">
                  {[
                    { label: 'Female', value: 'Female', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M12 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" /><path d="M12 14v7" /><path d="M9 18h6" /></svg> },
                    { label: 'Male', value: 'Male', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="10" cy="14" r="6" /><path d="M20 4v6" /><path d="M20 4h-6" /><path d="m20 4-6 6" /></svg> },
                    { label: 'NB', value: 'Non-Binary', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="6" /><path d="M12 6V2" /><path d="M10 2l4 4" /><path d="M14 2l-4 4" /></svg> },
                  ].map((opt) => {
                    const isActive = prefs.gender === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updatePref('gender', opt.value)}
                        className={`
                          flex-1 py-2 text-[9px] font-mono uppercase tracking-wide rounded-sm transition-all flex items-center justify-center gap-2
                          ${isActive
                            ? 'bg-studio-700 text-white shadow-sm'
                            : 'text-studio-500 hover:text-studio-300 hover:bg-studio-800'
                          }
                        `}
                      >
                        {opt.icon}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Age Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider">Age</label>
                  <span className="text-[10px] font-mono text-white font-bold">{prefs.age || 23} Years</span>
                </div>
                <input
                  type="range"
                  min="18"
                  max="85"
                  step="1"
                  value={prefs.age || "23"}
                  onChange={(e) => updatePref('age', e.target.value)}
                  className="w-full h-1 bg-studio-800 rounded-full appearance-none cursor-pointer accent-white hover:accent-studio-300 focus:outline-none"
                />
              </div>

              {/* Ethnicity Grid */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-end">
                  <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider">Ethnicity</label>
                  <span className="text-[9px] font-mono text-studio-600 tracking-tight">
                    {prefs.ethnicity ? (prefs.ethnicity === 'Mixed' ? 'Mixed' : 'Max 2') : 'Auto'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ETHNICITIES.map(eth => {
                    const isSelected = isEthSelected(eth);
                    return (
                      <button
                        key={eth}
                        onClick={() => handleEthnicityClick(eth)}
                        className={`
                          relative flex items-center justify-between px-3 py-3 rounded-sm border transition-all duration-200 group
                          ${isSelected
                            ? 'bg-studio-800 border-white text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]'
                            : 'bg-studio-900 border-studio-800 text-studio-500 hover:border-studio-600 hover:text-studio-300'
                          }
                        `}
                      >
                        <span className="text-[9px] font-mono uppercase tracking-widest leading-none">{eth}</span>
                        <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isSelected ? 'bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)] scale-100' : 'bg-studio-800 scale-0'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* 2. PHYSIQUE */}
          <CollapsibleSection title="Physique">
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-3 gap-2">
                {BODY_TYPES.map((opt) => {
                  const isSelected = prefs.bodyType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => updatePref('bodyType', opt.value)}
                      className={`
                        relative flex flex-col items-center justify-center aspect-[4/3] rounded-lg border transition-all duration-300 group
                        ${isSelected
                          ? 'border-white bg-studio-800 shadow-[0_0_15px_rgba(255,255,255,0.1)] z-10'
                          : 'border-studio-800 bg-studio-900/40 text-studio-600 hover:bg-studio-800 hover:text-studio-300 hover:border-studio-600'
                        }
                      `}
                    >
                      <div className={`mb-2 transition-transform duration-300 ${isSelected ? 'text-white scale-110' : 'text-current group-hover:scale-105'}`}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill={isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isSelected ? "0" : "1.5"}>
                          {BODY_ICONS[opt.value]}
                        </svg>
                      </div>
                      <span className={`text-[8px] font-mono uppercase tracking-widest ${isSelected ? 'text-white font-bold' : 'text-current'}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CollapsibleSection>

          {/* 3. FACE STRUCTURE */}
          <CollapsibleSection title="Face Structure">
            <div className="space-y-5 pt-1">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider block">Face Shape</label>
                <VisualOptionGrid
                  options={FACE_SHAPES}
                  selected={prefs.faceShape || "Oval"}
                  onSelect={(val) => updatePref('faceShape', val)}
                  icons={FACE_ICONS}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider block">Eyebrow Style</label>
                <VisualOptionGrid
                  options={CHAR_OPTIONS.eyebrows}
                  selected={prefs.eyebrowStyle || ""}
                  onSelect={(val) => updatePref('eyebrowStyle', val)}
                />
              </div>

              {/* Advanced Face Toggle */}
              <button
                onClick={() => setShowAdvancedFace(!showAdvancedFace)}
                className="w-full flex items-center justify-between py-2 text-[9px] font-mono text-studio-500 hover:text-white uppercase tracking-wider border-t border-studio-800"
              >
                <span>Advanced Features</span>
                <span className="text-lg leading-none">{showAdvancedFace ? '−' : '+'}</span>
              </button>

              {showAdvancedFace && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200 pb-2">
                  <SelectControl label="Jawline" options={CHAR_OPTIONS.jawline} value={prefs.jawline || ""} onChange={v => updatePref('jawline', v)} />
                  <SelectControl label="Cheekbones" options={CHAR_OPTIONS.cheekbones} value={prefs.cheekbones || ""} onChange={v => updatePref('cheekbones', v)} />
                  <SelectControl label="Cheeks" options={CHAR_OPTIONS.cheeks} value={prefs.cheeks || ""} onChange={v => updatePref('cheeks', v)} />
                  <SelectControl label="Eye Shape" options={CHAR_OPTIONS.eyeShape} value={prefs.eyeShape || ""} onChange={v => updatePref('eyeShape', v)} />
                  <SelectControl label="Nose" options={CHAR_OPTIONS.noseShape} value={prefs.noseShape || ""} onChange={v => updatePref('noseShape', v)} />
                  <SelectControl label="Lips" options={CHAR_OPTIONS.lipShape} value={prefs.lipShape || ""} onChange={v => updatePref('lipShape', v)} />
                  {prefs.gender === 'Male' && (
                    <SelectControl label="Facial Hair" options={CHAR_OPTIONS.facialHair} value={prefs.facialHair || ""} onChange={v => updatePref('facialHair', v)} />
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* 4. SKIN & COMPLEXION */}
          <CollapsibleSection title="Skin & Complexion" required>
            <div className="space-y-5 pt-1">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider block">Skin Tone</label>
                <div className="flex gap-2">
                  {SKIN_TONES.map(tone => {
                    const isSelected = prefs.skinTone === tone.value;
                    return (
                      <button
                        key={tone.label}
                        onClick={() => updatePref('skinTone', tone.value)}
                        className={`
                          relative flex-1 aspect-square rounded-lg border-2 transition-all duration-300 group overflow-hidden
                          ${isSelected
                            ? 'border-white ring-1 ring-white scale-105 z-10'
                            : 'border-transparent hover:border-studio-600 hover:scale-105'
                          }
                        `}
                        title={tone.label}
                      >
                        <div
                          className="absolute inset-0"
                          style={{ background: `linear-gradient(145deg, ${tone.base} 0%, ${tone.shadow} 100%)` }}
                        />
                        <div className="absolute top-1 left-1 w-2 h-2 bg-white/30 rounded-full blur-[2px]" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SelectControl label="Texture" options={SKIN_TEXTURES} value={prefs.skinTexture || ""} onChange={v => updatePref('skinTexture', v)} tooltip="Skin surface quality" />
                <SelectControl label="Finish" options={SKIN_FINISHES} value={prefs.skinFinish || ""} onChange={v => updatePref('skinFinish', v)} tooltip="Skin shine level" />
              </div>
            </div>
          </CollapsibleSection>

          {/* 5. EYES */}
          <CollapsibleSection title="Eyes" required>
            <div className="space-y-2 pt-1">
              <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider block">Eye Color</label>
              <VisualEyeGrid
                options={EYE_PRESETS}
                selected={prefs.eyeColor || ""}
                onSelect={(val) => updatePref('eyeColor', val)}
              />
            </div>
          </CollapsibleSection>

          {/* 6. HAIR */}
          <CollapsibleSection title="Hair" required>
            <div className="space-y-5 pt-1">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider block">Hair Color</label>
                <HairColorWheel
                  currentColor={prefs.hairColor || ""}
                  onColorSelect={(val: string) => updatePref('hairColor', val)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider block">Style Family</label>
                <div className="grid grid-cols-3 gap-2">
                  {currentHairFamilies.map(style => {
                    const isSelected = prefs.hairStyle === style;
                    return (
                      <button
                        key={style}
                        onClick={() => updatePref('hairStyle', style)}
                        className={`
                          px-2 py-2 rounded-sm border text-[8px] font-mono uppercase tracking-wide transition-all
                          ${isSelected
                            ? 'bg-studio-800 border-white text-white'
                            : 'bg-studio-900 border-studio-800 text-studio-500 hover:border-studio-600 hover:text-studio-300'
                          }
                        `}
                      >
                        {style}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SelectControl label="Length" options={HAIR_LENGTHS} value={prefs.hairLength || ""} onChange={v => updatePref('hairLength', v)} />
                <SelectControl label="Texture" options={HAIR_TEXTURES} value={prefs.hairTexture || ""} onChange={v => updatePref('hairTexture', v)} />
                <SelectControl label="Fringe" options={HAIR_FRINGES} value={prefs.hairFringe || ""} onChange={v => updatePref('hairFringe', v)} />
                <SelectControl label="Parting" options={HAIR_PARTINGS} value={prefs.hairParting || ""} onChange={v => updatePref('hairParting', v)} />
              </div>
              
              {/* Volume & Facial Hair (Male Only) */}
              <div className={prefs.gender === 'Male' ? "grid grid-cols-2 gap-4" : ""}>
                <SelectControl label="Volume & Shape" options={HAIR_VOLUMES} value={prefs.hairVolume || ""} onChange={v => updatePref('hairVolume', v)} />
                {prefs.gender === 'Male' && (
                  <SelectControl label="Facial Hair" options={CHAR_OPTIONS.facialHair} value={prefs.facialHair || ""} onChange={v => updatePref('facialHair', v)} />
                )}
              </div>

              {/* Advanced Hair Toggle */}
              <button
                onClick={() => setShowAdvancedHair(!showAdvancedHair)}
                className="w-full flex items-center justify-between py-2 text-[9px] font-mono text-studio-500 hover:text-white uppercase tracking-wider border-t border-studio-800"
              >
                <span>Advanced Styling</span>
                <span className="text-lg leading-none">{showAdvancedHair ? '−' : '+'}</span>
              </button>

              {showAdvancedHair && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200 pb-2">
                  <SelectControl label="Flyaways" options={["None", "Natural", "Intentional"]} value={prefs.hairFlyaways || ""} onChange={v => updatePref('hairFlyaways', v)} />
                  <SelectControl label="Hairline" options={["Natural", "Clean"]} value={prefs.hairHairline || ""} onChange={v => updatePref('hairHairline', v)} />
                  <SelectControl label="Tuck" options={HAIR_TUCKS} value={prefs.hairTuck || ""} onChange={v => updatePref('hairTuck', v)} />
                  {(prefs.gender === 'Male' || prefs.hairStyle?.includes('Fade') || prefs.hairStyle?.includes('Buzz')) && (
                    <SelectControl label="Fade / Taper" options={HAIR_FADES} value={prefs.hairFade || ""} onChange={v => updatePref('hairFade', v)} />
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>
        </div>

        {/* Generate Button */}
        <div className="p-5 border-t border-studio-800 bg-[#080808] mt-auto">
          <button
            onClick={handleGenerate}
            disabled={!isFormValid || genState.isGenerating}
            className="w-full py-4 bg-white hover:bg-studio-200 disabled:opacity-50 disabled:cursor-not-allowed text-black font-mono text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)]"
          >
            {genState.isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{genState.currentStep}</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                <span>{currentAssets.length > 0 ? 'Recast Model' : 'Cast Model'}</span>
              </>
            )}
          </button>
          {!isFormValid && (
            <p className="text-[9px] text-studio-600 text-center mt-2 font-mono uppercase tracking-wider">
              Complete required fields to enable casting
            </p>
          )}
        </div>
      </aside>

      {/* Right Panel - Image Viewer */}
      <main className="flex-1 flex flex-col h-[calc(100vh-64px)] lg:h-screen overflow-hidden relative bg-[#050505]">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-studio-600/10 rounded-full blur-[90px] mix-blend-screen opacity-30"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-black via-[#050505] to-transparent opacity-90"></div>
        </div>

        {/* ConnectorLine */}
        <ConnectorLine isActive={!!currentAssets.length && !!prefs.referenceImage} />

        {/* Top Controls */}
        <div className="absolute top-4 left-4 z-40 flex items-center space-x-2">
          <button 
            onClick={handleUndo} 
            disabled={!canUndo || genState.isGenerating} 
            className="p-2.5 bg-black/50 hover:bg-studio-800 disabled:opacity-30 disabled:hover:bg-black/50 text-white rounded-full border border-white/10 backdrop-blur-sm transition-all"
            title="Undo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </button>
          <button 
            onClick={handleRedo} 
            disabled={!canRedo || genState.isGenerating} 
            className="p-2.5 bg-black/50 hover:bg-studio-800 disabled:opacity-30 disabled:hover:bg-black/50 text-white rounded-full border border-white/10 backdrop-blur-sm transition-all"
            title="Redo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
          </button>
        </div>

        {/* Resolution Selector */}
        <div className="absolute top-4 right-4 z-40 flex bg-black/50 border border-white/10 rounded-full p-1 backdrop-blur-sm">
          {[ImageResolution.STD, ImageResolution.HIGH, ImageResolution.ULTRA].map(res => (
            <button
              key={res}
              onClick={() => setResolution(res)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-mono font-bold transition-all ${resolution === res ? 'bg-white text-black' : 'text-studio-400 hover:text-white'}`}
            >
              {res}
            </button>
          ))}
        </div>

        {/* Reference Node */}
        {currentAssets.length > 0 && (
          <div className="absolute top-24 right-12 z-40 hidden xl:block">
            <ReferenceNode
              image={prefs.referenceImage}
              onSet={(img) => updatePref('referenceImage', img)}
              disabled={genState.isGenerating}
            />
          </div>
        )}

        {/* Error Display */}
        {genState.error && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm">
            <div className="max-w-md w-full border border-red-900/50 bg-red-950/20 p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto border border-red-900 rounded-full flex items-center justify-center text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div>
                <h3 className="text-red-500 font-mono uppercase tracking-widest text-sm mb-2">System Malfunction</h3>
                <p className="text-red-400/70 font-mono text-xs leading-relaxed">
                  {genState.error}
                </p>
                <button 
                  onClick={handleRetry}
                  className="mt-6 px-6 py-2 bg-red-900/50 hover:bg-red-800 text-red-100 font-mono text-xs uppercase tracking-widest border border-red-800 transition-colors"
                >
                  Retry Casting
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {currentAssets.length > 0 ? (
          <div className="w-full h-full flex flex-col relative z-10">
            {/* Loading Overlay */}
            {genState.isGenerating && (
              <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-6">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border border-studio-800 rounded-full"></div>
                  <div className="absolute inset-0 border-t border-white rounded-full animate-spin"></div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-sm font-mono text-white uppercase tracking-[0.2em] animate-pulse">Processing</h3>
                  <p className="text-[10px] font-mono text-studio-500 uppercase tracking-widest">
                    {genState.currentStep || 'Initializing...'}
                  </p>
                </div>
              </div>
            )}

            {/* Image Display Area */}
            <div className="flex-1 relative min-h-0 flex items-center justify-center p-4">
              {/* Next Stage Button */}
              {nextStage && !genState.isGenerating && (
                <div className="absolute top-1/2 right-8 -translate-y-1/2 z-40 flex flex-col items-end space-y-4 animate-in fade-in slide-in-from-right-8 duration-700">
                  <div className="text-right space-y-1 drop-shadow-md">
                    <div className="flex items-center justify-end space-x-2 text-studio-400">
                      <div className="flex space-x-1">
                        {[...Array(nextStage.total)].map((_, i) => (
                          <div key={i} className={`h-1 w-3 rounded-full ${i + 1 < nextStage.step ? 'bg-white' : i + 1 === nextStage.step ? 'bg-white animate-pulse' : 'bg-studio-700'}`}></div>
                        ))}
                      </div>
                      <h4 className="text-[9px] font-mono uppercase tracking-widest">
                        {nextStage.step > nextStage.total ? 'Workflow Complete' : 'Next Stage'}
                      </h4>
                    </div>
                    <p className="text-xs font-mono font-bold text-white uppercase tracking-wider">{nextStage.label}</p>
                  </div>
                  <button
                    onClick={nextStage.action}
                    className="group relative w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                  >
                    <div className="absolute inset-0 rounded-full border border-white opacity-50 group-hover:animate-ping"></div>
                    <svg className="w-6 h-6 text-black relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                </div>
              )}

              {/* Main Image */}
              <div className="relative h-full max-w-full flex items-center justify-center select-none">
                {currentImageUrl && (
                  <>
                    <img 
                      ref={imageRef}
                      src={currentImageUrl} 
                      alt="Active View" 
                      className="max-h-full max-w-full object-contain shadow-2xl border border-studio-800/50 bg-black"
                    />
                    
                    {/* Masking Canvas */}
                    <canvas 
                      ref={canvasRef}
                      className={`absolute top-0 left-0 cursor-crosshair touch-none ${isMasking ? 'pointer-events-auto z-20' : 'pointer-events-none z-10'}`}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    />
                  </>
                )}

                {/* Tools Bar */}
                {!genState.isGenerating && currentAssets.length > 0 && (
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-3 z-30 animate-in fade-in slide-in-from-right-4 duration-500">
                    {/* Surgical Edit */}
                    {(isIterationAllowed && (!isViewLocked || unlockMode)) && (
                      <ToolButton 
                        isActive={activeTool === 'surgical'} 
                        onClick={() => setActiveTool(activeTool === 'surgical' ? 'none' : 'surgical')}
                        icon={
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 19l7-7 3 3-7 7-3-3z" />
                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                            <path d="M2 2l7.586 7.586" />
                            <circle cx="11" cy="11" r="2" />
                          </svg>
                        }
                        label="Surgical Edit"
                        color="red"
                      />
                    )}
                    
                    {/* Magic Eraser */}
                    {(!hasDownstreamDependencies || unlockMode) && (
                      <ToolButton 
                        isActive={activeTool === 'eraser'} 
                        onClick={() => setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')}
                        icon={
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                            <path d="M22 21H7" />
                            <path d="m5 11 9 9" />
                          </svg>
                        }
                        label="Magic Eraser"
                        color="purple"
                      />
                    )}
                  </div>
                )}

                {/* Masking Instructions */}
                {isMasking && (
                  <div className="absolute top-4 right-4 z-50 pointer-events-none select-none animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className={`px-3 py-2 rounded-lg backdrop-blur-md border ${activeTool === 'eraser' ? 'bg-purple-500/20 border-purple-500/50 text-purple-200' : 'bg-red-500/20 border-red-500/50 text-red-200'}`}>
                      <p className="text-[10px] font-mono uppercase tracking-wider">
                        {activeTool === 'eraser' ? 'Paint area to erase' : 'Paint area to edit'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Panel - Refinement Input */}
            <div className="w-full bg-studio-950 border-t border-studio-800 flex-shrink-0 z-20">
              <div className="w-full max-w-[1400px] mx-auto p-5">
                {/* View Tabs */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {[
                    { key: "frontClose", label: "Headshot" },
                    { key: "frontFull", label: "Full Body" },
                    { key: "sideClose", label: "Side" },
                    { key: "backFull", label: "Back" },
                  ].map((view) => {
                    const hasAsset = currentAssets.some((a) => a.viewType === view.key);
                    const isLocked = (view.key === 'frontClose' && currentAssets.some(a => a.viewType === 'frontFull')) ||
                                    (view.key === 'frontFull' && currentAssets.some(a => a.viewType === 'sideClose'));
                    return (
                      <button
                        key={view.key}
                        onClick={() => hasAsset && setActiveView(view.key)}
                        disabled={!hasAsset}
                        className={`px-4 py-2 rounded-sm text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeView === view.key
                          ? "bg-white text-black"
                          : hasAsset
                            ? "bg-studio-900 border border-studio-800 text-white hover:bg-studio-800"
                            : "bg-studio-900/50 border border-studio-800/50 text-studio-700 cursor-not-allowed"
                          }`}
                      >
                        {isLocked && hasAsset && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        )}
                        {view.label}
                      </button>
                    );
                  })}
                </div>

                {/* Refinement Input */}
                <div className="flex items-end gap-2 bg-studio-900/50 border border-studio-800 rounded-lg p-2">
                  {isViewLocked && !unlockMode ? (
                    <div className="flex-1 flex items-center justify-between px-4 py-2">
                      <div className="flex items-center space-x-2 text-amber-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <span className="text-xs font-mono uppercase tracking-widest">View Locked</span>
                      </div>
                      <button 
                        onClick={() => setUnlockMode(true)}
                        className="text-[9px] font-mono uppercase tracking-widest text-studio-500 hover:text-white transition-colors border-b border-dashed border-studio-700 hover:border-white pb-0.5"
                      >
                        Unlock to Edit
                      </button>
                    </div>
                  ) : !isIterationAllowed ? (
                    <div className="flex-1 px-4 py-2 flex items-center space-x-2 text-studio-600 select-none">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                      <span className="text-xs font-mono uppercase tracking-widest">Locked Angle</span>
                      <Tooltip content="To maintain consistency, only the Headshot, Front Full Body, and Back View can be iterated with text. Use Magic Eraser for corrections." />
                    </div>
                  ) : (
                    <textarea 
                      ref={textAreaRef}
                      value={refineInput}
                      onChange={(e) => setRefineInput(e.target.value)}
                      disabled={isEnhancing} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !isEnhancing) {
                          e.preventDefault();
                          handleRefineSubmit();
                        }
                      }}
                      placeholder={
                        isEnhancing ? "Optimizing instruction with AI..." :
                        activeTool === 'surgical' 
                          ? `Describe change for masked area (e.g. 'Add scar')...` 
                          : `Iterate on ${activeView.replace(/([A-Z])/g, ' $1').toLowerCase()}...`
                      }
                      rows={1}
                      className={`flex-1 bg-transparent border-none text-xs placeholder:text-studio-500 focus:outline-none focus:ring-0 px-3 py-2.5 font-mono resize-none custom-scrollbar min-h-[36px] max-h-[300px] ${isEnhancing ? 'text-studio-500 animate-pulse' : 'text-white'}`}
                    />
                  )}
                  
                  {/* Enhance button */}
                  {((!isViewLocked || unlockMode) && isIterationAllowed && activeTool !== 'eraser') && (
                    <button
                      onClick={handleEnhance}
                      disabled={!refineInput.trim() || isEnhancing}
                      className="flex-shrink-0 p-2 mb-1 text-studio-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors mr-1"
                      title="Enhance Prompt (AI)"
                    >
                      {isEnhancing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>
                      )}
                    </button>
                  )}

                  {/* Submit button */}
                  {activeTool === 'eraser' ? (
                    <button 
                      onClick={handleRefineSubmit}
                      disabled={maskPaths.length === 0}
                      className={`flex-shrink-0 px-4 py-2 mb-1 mr-1 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${maskPaths.length > 0 ? 'bg-purple-500 text-white hover:bg-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-studio-800 text-studio-600 cursor-not-allowed'}`}
                    >
                      Erase
                    </button>
                  ) : (
                    <button 
                      onClick={handleRefineSubmit}
                      disabled={!refineInput.trim() || (isViewLocked && !unlockMode) || !isIterationAllowed}
                      className={`flex-shrink-0 p-2 mb-1 rounded-full transition-colors ${(isViewLocked && !unlockMode) || !isIterationAllowed ? 'bg-studio-800 text-studio-600 cursor-not-allowed' : 'bg-white text-black hover:bg-studio-200 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : genState.isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border border-studio-800 rounded-full"></div>
              <div className="absolute inset-0 border-t border-white rounded-full animate-spin"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-sm font-mono text-white uppercase tracking-[0.2em] animate-pulse">Processing</h3>
              <p className="text-[10px] font-mono text-studio-500 uppercase tracking-widest">
                {genState.currentStep || 'Initializing...'}
              </p>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="relative z-10 w-full max-w-3xl p-8 flex flex-col items-center justify-center min-h-[500px]">
              <div className="mb-12 text-center space-y-6">
                <div className="relative inline-block">
                  <h1 className="text-6xl md:text-8xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-studio-800 tracking-tighter select-none opacity-90">
                    CASTING<br />STUDIO
                  </h1>
                  <div className="absolute -top-4 -left-4 w-4 h-4 border-t border-l border-studio-700" />
                  <div className="absolute -top-4 -right-4 w-4 h-4 border-t border-r border-studio-700" />
                  <div className="absolute -bottom-4 -left-4 w-4 h-4 border-b border-l border-studio-700" />
                  <div className="absolute -bottom-4 -right-4 w-4 h-4 border-b border-r border-studio-700" />
                </div>

                <div className="flex items-center justify-center space-x-4">
                  <div className="h-px w-8 bg-studio-800" />
                  <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-studio-500">
                    AI Model Generation Engine
                  </p>
                  <div className="h-px w-8 bg-studio-800" />
                </div>
              </div>

              <div className="w-full bg-black/40 backdrop-blur-md border border-studio-800/60 p-1 shadow-2xl">
                <div className="bg-[#080808] p-8 space-y-6">
                  <div className="flex justify-between items-end border-b border-studio-800/50 pb-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isFormValid ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse' : 'bg-amber-600'}`} />
                        <p className="text-[9px] font-mono text-studio-500 uppercase tracking-widest">System Status</p>
                      </div>
                      <p className={`text-sm font-mono uppercase tracking-[0.15em] ${isFormValid ? 'text-white' : 'text-studio-400'}`}>
                        {isFormValid ? 'Ready for Generation' : 'Awaiting Parameters'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-mono text-studio-500 uppercase tracking-widest mb-1">Points Balance</p>
                      <div className="flex items-end justify-end space-x-1">
                        <span className="text-2xl font-mono text-white leading-none tracking-tighter">{pointsData?.balance || 0}</span>
                        <span className="text-xs font-mono text-studio-600 mb-0.5">pts</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="space-y-1">
                      <p className="text-[9px] font-mono text-studio-500 uppercase tracking-widest">Headshot</p>
                      <p className="text-sm font-mono text-white">{POINT_COSTS.masterPrompt + POINT_COSTS.castingImage} pts</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-mono text-studio-500 uppercase tracking-widest">Full Body</p>
                      <p className="text-sm font-mono text-white">{POINT_COSTS.fullBody} pts</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-mono text-studio-500 uppercase tracking-widest">Multi-View</p>
                      <p className="text-sm font-mono text-white">{POINT_COSTS.multiView} pts</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
