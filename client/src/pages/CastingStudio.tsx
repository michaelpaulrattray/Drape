import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Zap, X, Menu } from "lucide-react";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
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
  progress?: number; // 0-100 percentage
  startTime?: number; // timestamp when generation started
  estimatedDuration?: number; // estimated duration in ms
}

type EditTool = 'none' | 'surgical' | 'eraser';

enum ImageResolution {
  STD = '1K',
  HIGH = '2K',
  ULTRA = '4K',
}

// Helper for generating unique export IDs (MOD-YY-XXXXXX format)
const generateExportId = () => {
  const chars = '0123456789ABCDEF';
  let hash = '';
  for (let i = 0; i < 6; i++) {
    hash += chars[Math.floor(Math.random() * 16)];
  }
  return `MOD-${new Date().getFullYear().toString().slice(-2)}-${hash}`;
};

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

// ============ Debug Utility ============

/**
 * Generate randomized model preferences for testing/debugging
 * This utility helps quickly populate the form with valid random values
 */
const generateRandomPreferences = (): Partial<ModelPreferences> => {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const pickValue = (arr: { value: string }[]): string => pick(arr).value;
  const pickLabel = (arr: { label: string; value: string }[]): string => pick(arr).value;
  
  // Random gender first as it affects hair options
  const gender = pick(['Male', 'Female']);
  const hairFamilies = gender === 'Male' ? HAIR_FAMILIES_MALE : HAIR_FAMILIES_FEMALE;
  
  // Generate random vibe that sums to 1
  const editorial = Math.random();
  const commercial = Math.random() * (1 - editorial);
  const runway = 1 - editorial - commercial;
  
  return {
    castingBrand: pickValue(BRAND_OPTIONS),
    castingVibe: { editorial, commercial, runway },
    gender,
    age: String(Math.floor(Math.random() * 20) + 18), // 18-37
    ethnicity: pick(ETHNICITIES),
    bodyType: pickLabel(BODY_TYPES),
    faceShape: pick(FACE_SHAPES.filter(f => f !== 'Random')),
    skinTone: pickLabel(SKIN_TONES),
    skinTexture: pick(SKIN_TEXTURES),
    skinFinish: pick(SKIN_FINISHES),
    eyeColor: pick(EYE_PRESETS).label,
    hairColor: pick(['Jet Black', 'Dark Brown', 'Chestnut', 'Auburn', 'Blonde', 'Platinum', 'Copper', 'Silver']),
    hairStyle: pick(hairFamilies),
    hairLength: pick(HAIR_LENGTHS),
    hairTexture: pick(HAIR_TEXTURES),
    hairFringe: pick(HAIR_FRINGES),
    hairParting: pick(HAIR_PARTINGS),
    hairVolume: pick(HAIR_VOLUMES),
    hairTuck: pick(HAIR_TUCKS),
    hairFade: gender === 'Male' ? pick(HAIR_FADES) : 'None',
    facialHair: gender === 'Male' ? pick(CHAR_OPTIONS.facialHair) : '',
    jawline: pick(CHAR_OPTIONS.jawline),
    cheekbones: pick(CHAR_OPTIONS.cheekbones),
    cheeks: pick(CHAR_OPTIONS.cheeks),
    eyeShape: pick(CHAR_OPTIONS.eyeShape),
    noseShape: pick(CHAR_OPTIONS.noseShape),
    lipShape: pick(CHAR_OPTIONS.lipShape),
    eyebrowStyle: pick(CHAR_OPTIONS.eyebrows),
    features: '',
    userPrompt: '',
  };
};

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

const ConnectorLine = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;
  
  // Reference node is at: top-20 (80px) right-8 (32px), size: w-48 (192px) h-64 (256px)
  // So reference node center-left edge is at: top ~208px (80 + 256/2), right 224px (32 + 192)
  // Main image container starts around the center of the workspace
  
  return (
    <div className="absolute top-0 right-0 w-full h-full z-5 pointer-events-none overflow-visible">
      {/* Elegant minimal connector - curves from reference node to main image */}
      <svg 
        className="absolute overflow-visible"
        style={{
          top: '180px',      // Align with middle of reference node
          right: '224px',    // Start from left edge of reference node (32px + 192px width)
          width: '120px',    // Shorter, tighter connection
          height: '80px'
        }}
        viewBox="0 0 120 80"
        fill="none"
      >
        <defs>
          {/* Animated gradient for the line */}
          <linearGradient id="connector-gradient" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
          {/* Subtle glow effect */}
          <filter id="connector-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Main connection path - smooth bezier from reference to image */}
        <path 
          d="M 120 40 C 80 40, 40 40, 0 40"
          stroke="url(#connector-gradient)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          filter="url(#connector-glow)"
          strokeDasharray="4 6"
        />
        
        {/* Start dot - at reference image edge */}
        <circle 
          cx="120" 
          cy="40" 
          r="5" 
          fill="rgba(255,255,255,0.9)"
          filter="url(#connector-glow)"
        />
        <circle 
          cx="120" 
          cy="40" 
          r="2.5" 
          fill="white"
        />
        
        {/* End dot - pointing toward main image */}
        <circle 
          cx="0" 
          cy="40" 
          r="4" 
          fill="rgba(255,255,255,0.6)"
          filter="url(#connector-glow)"
        />
        <circle 
          cx="0" 
          cy="40" 
          r="2" 
          fill="white"
        />
        
        {/* Animated traveling dot - flows from reference to main */}
        <circle r="2" fill="white" filter="url(#connector-glow)">
          <animateMotion 
            dur="2.5s" 
            repeatCount="indefinite"
            path="M 120 40 C 80 40, 40 40, 0 40"
          />
        </circle>
      </svg>
    </div>
  );
};

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
        : 'bg-black/60 border-studio-600 text-studio-300 hover:text-white hover:border-studio-400'
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

// ============ Elapsed Time Display Component ============

function ElapsedTimeDisplay({ startTime, estimatedDuration }: { startTime: number; estimatedDuration?: number }) {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };
  
  return (
    <div className="text-[10px] font-mono text-studio-400 uppercase tracking-widest">
      <span>{formatTime(elapsed)}</span>
      {estimatedDuration && elapsed < estimatedDuration && (
        <span className="text-studio-600"> / ~{formatTime(estimatedDuration)}</span>
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
  const [currentMasterPrompt, setCurrentMasterPrompt] = useState<string>("");
  const [currentTechnicalSchema, setCurrentTechnicalSchema] = useState<Record<string, any> | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

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

  // Auto-generation state
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoGenCancelled, setAutoGenCancelled] = useState(false);

  // Points data
  const { data: pointsData, refetch: refetchPoints } = trpc.points.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Mutations
  const createModelMutation = trpc.models.create.useMutation();
  const generateCastingMutation = trpc.generation.castingImage.useMutation();
  const generateFullBodyMutation = trpc.generation.fullBody.useMutation();
  const generateMultiViewMutation = trpc.generation.multiView.useMutation();
  const generateAllViewsMutation = trpc.generation.generateAllViews.useMutation();
  const iterateMutation = trpc.generation.iterate.useMutation();
  const upscaleMutation = trpc.generation.upscale.useMutation();

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

  // Debug utility: Auto-fill form with random preferences and optionally trigger generation
  const handleDebugFill = (autoGenerate: boolean = false) => {
    const randomPrefs = generateRandomPreferences();
    setPrefs(prev => ({ ...prev, ...randomPrefs }));
    toast.success('Debug: Form populated with random preferences');
    
    if (autoGenerate) {
      // Small delay to allow state to update before triggering generation
      setTimeout(() => {
        // The generation will be triggered by the user or the keyboard shortcut
        toast.info('Debug: Ready to generate - press Generate button or use Ctrl+Shift+G');
      }, 100);
    }
  };

  // Keyboard shortcuts for debug utility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+D: Fill form with random preferences
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        handleDebugFill(false);
      }
      // Ctrl+Shift+G: Fill form AND trigger generation
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        const randomPrefs = generateRandomPreferences();
        setPrefs(prev => ({ ...prev, ...randomPrefs }));
        toast.success('Debug: Auto-generating model...');
        // Trigger generation after state update
        setTimeout(() => {
          const generateBtn = document.querySelector('[data-debug-generate]') as HTMLButtonElement;
          if (generateBtn && !generateBtn.disabled) {
            generateBtn.click();
          }
        }, 200);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Generate mask-only overlay image for surgical edit/eraser
  // Creates a transparent PNG with just the red mask strokes
  // The server will composite this with the original image
  const getGuideOverlayDataUrl = async (): Promise<string | undefined> => {
    if (maskPaths.length === 0 || !imageRef.current) return undefined;
    
    const img = imageRef.current;
    
    try {
      // Create a canvas matching the original image dimensions
      const cvs = document.createElement('canvas');
      cvs.width = img.naturalWidth;
      cvs.height = img.naturalHeight;

      const ctx = cvs.getContext('2d');
      if (!ctx) return undefined;

      // Start with transparent background (no base image needed)
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      // Calculate brush size relative to image size
      const brushSize = Math.max(10, img.naturalWidth * 0.04);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw mask paths with semi-transparent red overlay
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.45)';

      const drawPaths = () => {
        maskPaths.forEach(path => {
          if (path.length < 1) return;
          ctx.beginPath();
          ctx.moveTo(path[0].x * cvs.width, path[0].y * cvs.height);
          path.forEach(p => ctx.lineTo(p.x * cvs.width, p.y * cvs.height));
          ctx.stroke();
        });
      };
      
      drawPaths();

      // Add a softer inner layer for better visibility
      ctx.lineWidth = brushSize * 0.8;
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.1)'; 
      drawPaths();

      return cvs.toDataURL('image/png');
    } catch (error) {
      console.error('Failed to generate mask overlay:', error);
      return undefined;
    }
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

    setGenState({ isGenerating: true, currentStep: "Writing Casting Spec...", error: null, progress: 0, startTime: Date.now(), estimatedDuration: 15000 });

    try {
      // Pass ALL preferences directly to backend - no conversion/stripping
      // The backend geminiService.ts handles all the prompt generation logic
      const backendPrefs = {
        // Demographics
        gender: prefs.gender,
        age: prefs.age,
        ethnicity: prefs.ethnicity,
        bodyType: prefs.bodyType,
        
        // Face structure
        faceShape: prefs.faceShape,
        jawline: prefs.jawline,
        cheekbones: prefs.cheekbones,
        cheeks: prefs.cheeks,
        eyeShape: prefs.eyeShape,
        noseShape: prefs.noseShape,
        lipShape: prefs.lipShape,
        eyebrowStyle: prefs.eyebrowStyle,
        
        // Skin
        skinTone: prefs.skinTone,
        skinTexture: prefs.skinTexture,
        skinFinish: prefs.skinFinish,
        
        // Eyes
        eyeColor: prefs.eyeColor,
        
        // Hair - complete builder
        hairStyle: prefs.hairStyle,
        hairColor: prefs.hairColor,
        hairLength: prefs.hairLength,
        hairTexture: prefs.hairTexture,
        hairFringe: prefs.hairFringe,
        hairParting: prefs.hairParting,
        hairVolume: prefs.hairVolume,
        hairFlyaways: prefs.hairFlyaways,
        hairHairline: prefs.hairHairline,
        hairTuck: prefs.hairTuck,
        hairFade: prefs.hairFade,
        facialHair: prefs.facialHair,
        
        // Brand & Vibe - pass directly, NOT converted
        castingBrand: prefs.castingBrand,
        castingVibe: prefs.castingVibe,
        
        // Additional
        features: prefs.features,
        referenceImage: prefs.referenceImage,
        userPrompt: prefs.userPrompt,
      };
      
      // Debug: Log preferences being sent
      console.log('[CastingStudio] Sending preferences to backend:', JSON.stringify(backendPrefs, null, 2));

      setGenState((prev) => ({ ...prev, currentStep: "Generating casting specification...", progress: 20 }));
      const modelResult = await createModelMutation.mutateAsync({
        preferences: backendPrefs,
        name: modelName || undefined,
      });

      setCurrentModelId(modelResult.modelId ?? null);
      setCurrentMasterPrompt(modelResult.masterPrompt || "");
      setCurrentTechnicalSchema(modelResult.technicalSchema || null);

      setGenState((prev) => ({ ...prev, currentStep: "Casting Headshot...", progress: 50 }));
      const imageResult = await generateCastingMutation.mutateAsync({
        modelId: modelResult.modelId!,
        referenceImage: prefs.referenceImage,
      });

      if (imageResult.success && imageResult.imageUrl) {
        const newAsset: GeneratedAsset = {
          id: imageResult.assetId || Date.now(),
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

        setGenState({ isGenerating: true, currentStep: "Generating Full Body View...", error: null, progress: 0, startTime: Date.now(), estimatedDuration: 12000 });

        try {
          const result = await generateFullBodyMutation.mutateAsync({ modelId: currentModelId });

          if (result.success && result.imageUrl) {
            const newAsset: GeneratedAsset = {
              id: result.assetId || Date.now(),
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
  const handleGenerateMultiView = async (viewType: "side" | "back" | "walk", isAutoGen: boolean = false): Promise<boolean> => {
    if (!currentModelId) return false;

    // For walk view, skip the lock modal since body is already locked
    const skipLockModal = viewType === 'walk' || viewType === 'back' || isAutoGen;
    
    const doGenerate = async (): Promise<boolean> => {
      if (!pointsData || pointsData.balance < POINT_COSTS.multiView) {
        toast.error(`Insufficient points. Need ${POINT_COSTS.multiView} points.`);
        setIsAutoGenerating(false);
        return false;
      }

      const viewLabel = viewType === 'walk' ? 'walking' : viewType;
      setGenState({ isGenerating: true, currentStep: `Generating ${viewLabel} view...`, error: null, progress: 0, startTime: Date.now(), estimatedDuration: 10000 });

      try {
        // Map viewType to backend expected value
        const backendViewType = viewType === 'walk' ? 'walk' : viewType;
        const result = await generateMultiViewMutation.mutateAsync({
          modelId: currentModelId,
          viewType: backendViewType as "side" | "back",
        });

        if (result.success && result.imageUrl) {
          const viewKey = viewType === "side" ? "sideClose" : viewType === "walk" ? "sideFull" : "backFull";
          const newAsset: GeneratedAsset = {
            id: result.assetId || Date.now(),
            viewType: viewKey,
            storageUrl: result.imageUrl,
          };
          const newAssets = [...currentAssets.filter((a) => a.viewType !== viewKey), newAsset];
          setCurrentAssets(newAssets);
          setHistory((prev) => [...prev.slice(0, historyIndex + 1), newAssets]);
          setHistoryIndex((prev) => prev + 1);
          setActiveView(viewKey);
          toast.success(`${viewLabel} view generated!`);
          refetchPoints();
        }

        setGenState({ isGenerating: false, currentStep: "", error: null });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generation failed";
        setGenState({ isGenerating: false, currentStep: "", error: message });
        toast.error(message);
        setIsAutoGenerating(false);
        return false;
      }
    };

    if (skipLockModal) {
      return await doGenerate();
    } else {
      return new Promise((resolve) => {
        setLockModal({
          isOpen: true,
          title: 'Lock Body & Generate All Views?',
          message: "This will generate all remaining views (side, walking, back) automatically. You won't be able to edit the body pose without resetting the entire sheet.",
          onConfirm: async () => {
            setLockModal(prev => ({ ...prev, isOpen: false }));
            const success = await doGenerate();
            resolve(success);
          }
        });
      });
    }
  };

  // Auto-generate all remaining views after full body - uses batch endpoint like original app
  const handleAutoGenerateAllViews = async () => {
    if (!currentModelId || isAutoGenerating) return;
    
    // Show lock modal first
    return new Promise<void>((resolve) => {
      setLockModal({
        isOpen: true,
        title: 'Lock Body & Generate All Views?',
        message: "This will generate all remaining views (side, walking, back) in parallel. You won't be able to edit the body pose without resetting the entire sheet.",
        onConfirm: async () => {
          setLockModal(prev => ({ ...prev, isOpen: false }));
          
          setIsAutoGenerating(true);
          setAutoGenCancelled(false);
          
          const totalCost = POINT_COSTS.multiView * 3;
          if (!pointsData || pointsData.balance < totalCost) {
            toast.error(`Insufficient points. Need ${totalCost} points for all views.`);
            setIsAutoGenerating(false);
            resolve();
            return;
          }
          
          setGenState({ 
            isGenerating: true, 
            currentStep: 'Generating all views (side, walk, back)...', 
            error: null, 
            progress: 0, 
            startTime: Date.now(), 
            estimatedDuration: 30000 // ~30 seconds for all 3 views in parallel
          });
          
          try {
            const result = await generateAllViewsMutation.mutateAsync({
              modelId: currentModelId,
            });
            
            if (result.success && result.views) {
              // Create all 3 assets at once
              const newAssets: GeneratedAsset[] = [
                ...currentAssets.filter(a => !['sideClose', 'sideFull', 'backFull'].includes(a.viewType)),
                { id: result.views.sideClose.assetId ?? Date.now(), viewType: 'sideClose' as const, storageUrl: result.views.sideClose.imageUrl },
                { id: result.views.sideFull.assetId ?? Date.now() + 1, viewType: 'sideFull' as const, storageUrl: result.views.sideFull.imageUrl },
                { id: result.views.backFull.assetId ?? Date.now() + 2, viewType: 'backFull' as const, storageUrl: result.views.backFull.imageUrl },
              ];
              
              setCurrentAssets(newAssets);
              setHistory((prev) => [...prev.slice(0, historyIndex + 1), newAssets]);
              setHistoryIndex((prev) => prev + 1);
              setActiveView('sideClose'); // Show first new view
              toast.success('All views generated! Ready to export.');
              refetchPoints();
            }
            
            setGenState({ isGenerating: false, currentStep: '', error: null });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Generation failed';
            setGenState({ isGenerating: false, currentStep: '', error: message });
            toast.error(message);
          }
          
          setIsAutoGenerating(false);
          resolve();
        }
      });
    });
  };

  // Handle iteration/refinement
  const handleRefineSubmit = async () => {
    if (!currentModelId || !currentImageUrl) return;

    // Get mask if we're in masking mode (now async to handle CORS)
    const maskBase64 = isMasking ? await getGuideOverlayDataUrl() : undefined;

    // For eraser tool, use automatic prompt (no text needed)
    if (activeTool === 'eraser') {
      if (maskPaths.length === 0) return;
      if (!maskBase64) {
        toast.error('Failed to generate mask overlay. Please try again.');
        return;
      }
      const prompt = "FIX ARTIFACT: Remove the content in the masked area. Inpaint with surrounding skin texture, lighting, and noise. Restore the background if needed. Do not add new objects.";
      await performIteration(prompt, maskBase64);
      setActiveTool('none');
      setMaskPaths([]);
      return;
    }

    // For surgical tool with mask - require both mask and text
    if (activeTool === 'surgical') {
      if (maskPaths.length === 0) {
        toast.error('Please paint the area you want to edit first');
        return;
      }
      if (!refineInput.trim()) {
        toast.error('Please describe the change you want to make');
        return;
      }
      if (!maskBase64) {
        toast.error('Failed to generate mask overlay. Please try again.');
        return;
      }
      await performIteration(refineInput, maskBase64);
      setRefineInput("");
      setActiveTool('none');
      setMaskPaths([]);
      return;
    }

    // For regular text iteration (no tool selected)
    if (refineInput.trim()) {
      await performIteration(refineInput, maskBase64);
      setRefineInput("");
      setActiveTool('none');
      setMaskPaths([]);
    }
  };

  const performIteration = async (prompt: string, maskBase64?: string) => {
    if (!currentModelId) return;

    if (!pointsData || pointsData.balance < POINT_COSTS.iteration) {
      toast.error(`Insufficient points. Need ${POINT_COSTS.iteration} points.`);
      return;
    }

    setGenState({ isGenerating: true, currentStep: maskBase64 ? "Applying surgical edit..." : "Iterating...", error: null, progress: 0, startTime: Date.now(), estimatedDuration: 8000 });

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
        maskBase64, // Pass the mask for surgical edit/eraser
      });

      if (result.success && result.imageUrl) {
        const newAsset: GeneratedAsset = {
          id: result.assetId || Date.now(),
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
        
        // Update master prompt if returned from iteration
        if (result.masterPrompt) {
          setCurrentMasterPrompt(result.masterPrompt);
        }
        
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
  const enhanceMutation = trpc.generation.enhance.useMutation();
  
  const handleEnhance = async () => {
    if (!refineInput.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const result = await enhanceMutation.mutateAsync({ prompt: refineInput.trim() });
      if (result.success && result.enhancedPrompt) {
        setRefineInput(result.enhancedPrompt);
        toast.success("Prompt enhanced!");
      }
    } catch (error) {
      console.error("Enhance error:", error);
      toast.error("Failed to enhance prompt");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Export handler with unique ID, PDF generation, and ZIP creation
  // Mint mutation for minting model on export
  const mintMutation = trpc.generation.mint.useMutation();

  const handleExport = async (characterName: string, exportRes: ImageResolution) => {
    if (currentAssets.length === 0) {
      toast.error('No assets to export');
      return;
    }

    if (!currentModelId) {
      toast.error('No model to export');
      return;
    }

    setShowExportModal(false);
    setGenState({ isGenerating: true, currentStep: `Minting Model Identity...`, error: null, progress: 0, startTime: Date.now(), estimatedDuration: 5000 });

    try {
      // Mint the model on export - this assigns the agencyId and locks the identity
      const mintResult = await mintMutation.mutateAsync({ modelId: currentModelId });
      const exportId = mintResult.agencyId;
      
      if (!exportId) {
        throw new Error('Failed to mint model - no agencyId returned');
      }

      setGenState({ isGenerating: true, currentStep: `Processing Export Pack (${exportRes})...`, error: null, progress: 30, startTime: genState.startTime, estimatedDuration: 20000 });

      const safeName = characterName ? characterName.trim().toUpperCase() : `MODEL ID ${exportId}`;
      const cleanId = exportId.replace(/[^a-zA-Z0-9]/g, '_');
      const zipFilename = `CASTING_PACK_${safeName.replace(/[^a-zA-Z0-9]/g, '_')}_${exportRes}.zip`;
      const pdfFilename = `LEGAL_IDENTITY_${cleanId}.pdf`;

      const zip = new JSZip();
      // Collect all view URLs
      const viewFileMap: Record<string, string> = {
        frontClose: '01_Headshot_Primary.png',
        frontFull: '02_Full_Body_Standing.png',
        sideClose: '03_Profile_Head.png',
        sideFull: '04_Full_Body_Walk.png',
        backFull: '05_Full_Body_Rear.png'
      };

      // Process images - upscale if needed, then add to ZIP
      for (const asset of currentAssets) {
        const filename = viewFileMap[asset.viewType] || `${asset.viewType}.png`;
        
        try {
          let imageUrl = asset.storageUrl;
          
          // Upscale if resolution is 2K or 4K
          if (exportRes !== '1K') {
            setGenState(prev => ({ ...prev, currentStep: `Upscaling ${asset.viewType} to ${exportRes}...` }));
            const upscaleResult = await upscaleMutation.mutateAsync({
              imageUrl: asset.storageUrl,
              resolution: exportRes,
            });
            if (upscaleResult.success && upscaleResult.imageUrl) {
              imageUrl = upscaleResult.imageUrl;
            }
          } else {
            setGenState(prev => ({ ...prev, currentStep: `Adding ${asset.viewType}...` }));
          }
          
          // Fetch the image and add to ZIP
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          zip.file(filename, blob);
        } catch (e) {
          console.error(`Failed to process ${asset.viewType}:`, e);
          // Fall back to original image if upscale fails
          try {
            const response = await fetch(asset.storageUrl);
            const blob = await response.blob();
            zip.file(filename, blob);
          } catch (fallbackError) {
            console.error(`Failed to fetch fallback ${asset.viewType}:`, fallbackError);
          }
        }
      }

      // Generate PDF Identity Document
      setGenState(prev => ({ ...prev, currentStep: 'Compiling Identity Document...' }));
      
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let cursorY = margin;

      // Header
      doc.setFont('courier', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(0, 0, 0);
      doc.text(safeName, margin, cursorY + 10);

      doc.setFontSize(9);
      doc.setFont('courier', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text('FORMASTUDIO™ • DIGITAL COMPOSITE', margin, cursorY + 15);
      doc.text('PRIMARY IDENTITY', pageWidth - margin, cursorY + 15, { align: 'right' });

      cursorY += 19;
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 10;

      // Add headshot image if available
      const headshotAsset = currentAssets.find(a => a.viewType === 'frontClose');
      if (headshotAsset) {
        try {
          const response = await fetch(headshotAsset.storageUrl);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          
          const imgProps = doc.getImageProperties(base64);
          const imgRatio = imgProps.width / imgProps.height;
          const maxH = 80;
          let imgW = contentWidth * 0.6;
          let imgH = imgW / imgRatio;
          if (imgH > maxH) {
            imgH = maxH;
            imgW = imgH * imgRatio;
          }
          const imgX = margin + (contentWidth - imgW) / 2;
          doc.addImage(base64, 'PNG', imgX, cursorY, imgW, imgH);
          cursorY += imgH + 10;
        } catch (e) {
          console.error('Failed to add image to PDF:', e);
          cursorY += 10;
        }
      }

      // Stats Block
      const statsHeight = 25;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.rect(margin, cursorY, contentWidth, statsHeight);

      const drawField = (label: string, value: string, x: number, y: number) => {
        doc.setFont('courier', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`${label}: `, x, y);
        const labelW = doc.getTextWidth(`${label}: `);
        doc.setFont('courier', 'normal');
        doc.text((value || '-').toUpperCase(), x + labelW, y);
      };

      const colWidth = (contentWidth - 10) / 3;
      const col1X = margin + 5;
      const col2X = col1X + colWidth;
      const col3X = col2X + colWidth;
      const row1Y = cursorY + 10;
      const row2Y = cursorY + 18;

      drawField('ID', exportId, col1X, row1Y);
      drawField('AGE', prefs.age || '-', col2X, row1Y);
      drawField('ETHNICITY', prefs.ethnicity || '-', col3X, row1Y);
      drawField('HAIR', prefs.hairColor || '-', col1X, row2Y);
      drawField('EYES', prefs.eyeColor || '-', col2X, row2Y);
      drawField('DATE', new Date().toLocaleDateString().toUpperCase(), col3X, row2Y);

      cursorY += statsHeight + 10;

      // Master Prompt
      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text("DIRECTOR'S NOTES / MASTER PROMPT", margin, cursorY);
      cursorY += 5;

      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);

      const promptLines = doc.splitTextToSize(currentMasterPrompt || 'No master prompt available', contentWidth);
      const maxPromptLines = 14;
      const displayedLines = promptLines.slice(0, maxPromptLines);
      doc.text(displayedLines, margin, cursorY);
      cursorY += (displayedLines.length * 3.5) + 8;

      // Legal Section
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 6;

      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text('DIGITAL IDENTITY — OWNERSHIP & USAGE', margin, cursorY);
      cursorY += 5;

      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(60, 60, 60);
      const legalText = 'Exclusive, perpetual, worldwide commercial rights to use this Generated Model and its exported renders are granted to the Exporting Party upon export. This identity is a procedurally generated digital composite and is uniquely bound to the casting session and cryptographic signature below.';
      const legalLines = doc.splitTextToSize(legalText, contentWidth);
      doc.text(legalLines, margin, cursorY);
      cursorY += (legalLines.length * 3.5) + 6;

      // Metadata
      const simpleHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
      };
      const timestamp = Date.now();
      const secureHash = simpleHash(exportId + timestamp + 'FORMA');

      doc.setFont('courier', 'bold');
      doc.text('Issued by:', margin, cursorY);
      doc.setFont('courier', 'normal');
      doc.text('FORMASTUDIO™', margin + doc.getTextWidth('Issued by: '), cursorY);
      
      doc.setFont('courier', 'bold');
      doc.text('Model ID:', margin + contentWidth / 2, cursorY);
      doc.setFont('courier', 'normal');
      doc.text(exportId, margin + contentWidth / 2 + doc.getTextWidth('Model ID: '), cursorY);
      cursorY += 4;

      doc.setFont('courier', 'bold');
      doc.text('Secure Hash:', margin, cursorY);
      doc.setFont('courier', 'normal');
      doc.text(secureHash, margin + doc.getTextWidth('Secure Hash: '), cursorY);

      doc.setFont('courier', 'bold');
      doc.text('Timestamp:', margin + contentWidth / 2, cursorY);
      doc.setFont('courier', 'normal');
      doc.text(new Date().toUTCString(), margin + contentWidth / 2 + doc.getTextWidth('Timestamp: '), cursorY);

      // Add PDF to ZIP
      zip.file(pdfFilename, doc.output('arraybuffer'));

      // Generate and download ZIP
      setGenState(prev => ({ ...prev, currentStep: 'Compressing Pack...' }));
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setGenState({ isGenerating: false, currentStep: '', error: null });
      toast.success(`Export complete! ID: ${exportId}`);

    } catch (e: any) {
      console.error('Export failed:', e);
      setGenState({ isGenerating: false, currentStep: '', error: e.message || 'Export Failed' });
      toast.error('Export failed: ' + (e.message || 'Unknown error'));
    }
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
        total: 5,
      };
    }
    
    // After full body, trigger auto-generation of all remaining views
    if (!currentAssets.some(a => a.viewType === 'sideClose')) {
      return { 
        label: 'Generate All Views', 
        action: handleAutoGenerateAllViews,
        step: 3,
        total: 5,
        isAutoGen: true,
      };
    }
    
    // Show progress during auto-generation
    if (isAutoGenerating) {
      if (!currentAssets.some(a => a.viewType === 'sideFull')) {
        return { 
          label: 'Generating Walking View...', 
          action: () => {},
          step: 4,
          total: 5,
          isProgress: true,
        };
      }
      if (!currentAssets.some(a => a.viewType === 'backFull')) {
        return { 
          label: 'Generating Back View...', 
          action: () => {},
          step: 5,
          total: 5,
          isProgress: true,
        };
      }
    }
    
    // Manual fallback if auto-gen was cancelled
    if (!currentAssets.some(a => a.viewType === 'sideFull')) {
      return { 
        label: 'Generate Walking View', 
        action: () => handleGenerateMultiView('walk'),
        step: 4,
        total: 5,
      };
    }
    
    if (!currentAssets.some(a => a.viewType === 'backFull')) {
      return { 
        label: 'Generate Back View', 
        action: () => handleGenerateMultiView('back'),
        step: 5,
        total: 5,
      };
    }

    return {
      label: 'Export Character Pack',
      action: () => setShowExportModal(true),
      step: 6, 
      total: 5,
    };
  }, [currentAssets, genState.isGenerating, isAutoGenerating]);

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
            data-debug-generate
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
          
          {/* Debug Utility Button - Development Only */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-3 pt-3 border-t border-studio-800/50">
              <div className="flex gap-2">
                <button
                  onClick={() => handleDebugFill(false)}
                  disabled={genState.isGenerating}
                  className="flex-1 py-2 px-3 bg-amber-600/20 hover:bg-amber-600/30 disabled:opacity-50 text-amber-500 font-mono text-[9px] uppercase tracking-wider rounded border border-amber-600/30 transition-colors"
                  title="Ctrl+Shift+D"
                >
                  🎲 Random Fill
                </button>
                <button
                  onClick={() => {
                    const randomPrefs = generateRandomPreferences();
                    setPrefs(prev => ({ ...prev, ...randomPrefs }));
                    toast.success('Debug: Auto-generating model...');
                    setTimeout(() => {
                      const generateBtn = document.querySelector('[data-debug-generate]') as HTMLButtonElement;
                      if (generateBtn && !generateBtn.disabled) {
                        generateBtn.click();
                      }
                    }, 200);
                  }}
                  disabled={genState.isGenerating}
                  className="flex-1 py-2 px-3 bg-green-600/20 hover:bg-green-600/30 disabled:opacity-50 text-green-500 font-mono text-[9px] uppercase tracking-wider rounded border border-green-600/30 transition-colors"
                  title="Ctrl+Shift+G"
                >
                  ⚡ Auto Generate
                </button>
              </div>
              <p className="text-[8px] text-studio-600 text-center mt-1.5 font-mono">
                Debug: Ctrl+Shift+D (fill) | Ctrl+Shift+G (generate)
              </p>
            </div>
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
          <div className="absolute top-20 right-8 z-40 hidden lg:block">
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

        {/* Left Vertical Thumbnails Strip */}
        {currentAssets.length > 0 && (
          <div className="absolute left-4 top-16 bottom-10 z-30 flex flex-col gap-3 w-20 overflow-y-auto no-scrollbar py-2 pointer-events-none">
            <div className="contents pointer-events-auto">
              {/* HEAD Thumbnail */}
              {currentAssets.find(a => a.viewType === 'frontClose') && (
                <button 
                  onClick={() => setActiveView('frontClose')}
                  className={`relative group w-full aspect-[3/4] rounded-sm transition-all duration-300 overflow-hidden ${
                    activeView === 'frontClose' 
                    ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.3)] z-10 scale-[1.03]' 
                    : 'ring-1 ring-studio-700 opacity-70 hover:opacity-100 hover:ring-studio-500 hover:scale-[1.02] hover:shadow-lg'
                  }`}
                >
                  <img src={currentAssets.find(a => a.viewType === 'frontClose')?.storageUrl} alt="Head" className="w-full h-full object-cover" />
                  {currentAssets.some(a => a.viewType === 'frontFull') && (
                    <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/20 z-20">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent py-1.5 px-1">
                    <span className="text-[9px] font-mono uppercase text-white block text-center tracking-widest font-medium">Head</span>
                  </div>
                </button>
              )}

              {/* ADD BODY / Full Body Thumbnail */}
              {currentAssets.find(a => a.viewType === 'frontFull') ? (
                <button 
                  onClick={() => setActiveView('frontFull')}
                  className={`relative group w-full aspect-[3/4] rounded-sm transition-all duration-300 overflow-hidden ${
                    activeView === 'frontFull' 
                    ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.3)] z-10 scale-[1.03]' 
                    : 'ring-1 ring-studio-700 opacity-70 hover:opacity-100 hover:ring-studio-500 hover:scale-[1.02] hover:shadow-lg'
                  }`}
                >
                  <img src={currentAssets.find(a => a.viewType === 'frontFull')?.storageUrl} alt="Full" className="w-full h-full object-cover" />
                  {currentAssets.some(a => a.viewType === 'sideClose') && (
                    <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/20 z-20">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent py-1.5 px-1">
                    <span className="text-[9px] font-mono uppercase text-white block text-center tracking-widest font-medium">Full</span>
                  </div>
                </button>
              ) : (
                <button 
                  onClick={() => nextStage?.step === 2 && nextStage.action()}
                  className="w-full aspect-[3/4] bg-studio-950/60 backdrop-blur-sm rounded-sm border border-dashed border-studio-700 hover:border-white hover:bg-studio-900/50 transition-all flex flex-col items-center justify-center space-y-2 group"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-studio-600 flex items-center justify-center text-studio-500 group-hover:text-white group-hover:border-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </div>
                  <span className="text-[8px] font-mono uppercase text-studio-500 group-hover:text-white tracking-widest text-center px-1 font-medium">Body</span>
                </button>
              )}

              {/* Side/Walk/Back Views or Locked Placeholders */}
              {currentAssets.find(a => a.viewType === 'frontFull') ? (
                currentAssets.find(a => a.viewType === 'sideClose') ? (
                  <>
                    <button 
                      onClick={() => setActiveView('sideClose')}
                      className={`relative group w-full aspect-[3/4] rounded-sm transition-all duration-300 overflow-hidden ${
                        activeView === 'sideClose' 
                        ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.3)] z-10 scale-[1.03]' 
                        : 'ring-1 ring-studio-700 opacity-70 hover:opacity-100 hover:ring-studio-500 hover:scale-[1.02] hover:shadow-lg'
                      }`}
                    >
                      <img src={currentAssets.find(a => a.viewType === 'sideClose')?.storageUrl} alt="Side" className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent py-1.5 px-1">
                        <span className="text-[9px] font-mono uppercase text-white block text-center tracking-widest font-medium">Side</span>
                      </div>
                    </button>
                    {currentAssets.find(a => a.viewType === 'sideFull') && (
                      <button 
                        onClick={() => setActiveView('sideFull')}
                        className={`relative group w-full aspect-[3/4] rounded-sm transition-all duration-300 overflow-hidden ${
                          activeView === 'sideFull' 
                          ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.3)] z-10 scale-[1.03]' 
                          : 'ring-1 ring-studio-700 opacity-70 hover:opacity-100 hover:ring-studio-500 hover:scale-[1.02] hover:shadow-lg'
                        }`}
                      >
                        <img src={currentAssets.find(a => a.viewType === 'sideFull')?.storageUrl} alt="Walk" className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent py-1.5 px-1">
                          <span className="text-[9px] font-mono uppercase text-white block text-center tracking-widest font-medium">Walk</span>
                        </div>
                      </button>
                    )}
                    {currentAssets.find(a => a.viewType === 'backFull') && (
                      <button 
                        onClick={() => setActiveView('backFull')}
                        className={`relative group w-full aspect-[3/4] rounded-sm transition-all duration-300 overflow-hidden ${
                          activeView === 'backFull' 
                          ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.3)] z-10 scale-[1.03]' 
                          : 'ring-1 ring-studio-700 opacity-70 hover:opacity-100 hover:ring-studio-500 hover:scale-[1.02] hover:shadow-lg'
                        }`}
                      >
                        <img src={currentAssets.find(a => a.viewType === 'backFull')?.storageUrl} alt="Back" className="w-full h-full object-cover" />
                        <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/20 z-20">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent py-1.5 px-1">
                          <span className="text-[9px] font-mono uppercase text-white block text-center tracking-widest font-medium">Back</span>
                        </div>
                      </button>
                    )}
                  </>
                ) : (
                  <button 
                    onClick={() => nextStage?.step === 3 && nextStage.action()}
                    className="w-full aspect-[3/4] bg-studio-950/60 backdrop-blur-sm rounded-sm border border-dashed border-studio-700 hover:border-white hover:bg-studio-900/50 transition-all flex flex-col items-center justify-center space-y-2 group"
                  >
                    <div className="w-8 h-8 rounded-full border-2 border-studio-600 flex items-center justify-center text-studio-500 group-hover:text-white group-hover:border-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                    <span className="text-[8px] font-mono uppercase text-studio-500 group-hover:text-white tracking-widest text-center px-1 font-medium">Angles</span>
                  </button>
                )
              ) : (
                <>
                  {/* Locked placeholders with labels */}
                  <div className="w-full aspect-[3/4] bg-studio-950/40 backdrop-blur-[1px] rounded-sm border border-studio-800/40 flex flex-col items-center justify-center space-y-1">
                    <svg className="w-5 h-5 text-studio-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <span className="text-[7px] font-mono uppercase text-studio-700 tracking-wider">Side</span>
                  </div>
                  <div className="w-full aspect-[3/4] bg-studio-950/40 backdrop-blur-[1px] rounded-sm border border-studio-800/40 flex flex-col items-center justify-center space-y-1">
                    <svg className="w-5 h-5 text-studio-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <span className="text-[7px] font-mono uppercase text-studio-700 tracking-wider">Walk</span>
                  </div>
                  <div className="w-full aspect-[3/4] bg-studio-950/40 backdrop-blur-[1px] rounded-sm border border-studio-800/40 flex flex-col items-center justify-center space-y-1">
                    <svg className="w-5 h-5 text-studio-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <span className="text-[7px] font-mono uppercase text-studio-700 tracking-wider">Back</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        {currentAssets.length > 0 ? (
          <div className="w-full h-full flex flex-col relative z-10">
            {/* Loading Overlay */}
            {genState.isGenerating && (
              <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-200">
                {/* Animated spinner with progress ring */}
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    {/* Background ring */}
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgb(38,38,38)" strokeWidth="2" />
                    {/* Progress ring */}
                    <circle 
                      cx="50" cy="50" r="45" fill="none" 
                      stroke="white" strokeWidth="2" 
                      strokeLinecap="round"
                      strokeDasharray={`${(genState.progress || 0) * 2.83} 283`}
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>
                  {/* Inner spinner for activity indication */}
                  <div className="absolute inset-4 border-t-2 border-white/30 rounded-full animate-spin" style={{animationDuration: '1.5s'}}></div>
                  {/* Percentage display */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-mono text-white font-bold">
                      {genState.progress ? `${Math.round(genState.progress)}%` : ''}
                    </span>
                  </div>
                </div>
                <div className="text-center space-y-3">
                  <h3 className="text-sm font-mono text-white uppercase tracking-[0.2em]">
                    {genState.currentStep || 'Processing...'}
                  </h3>
                  {/* Elapsed time indicator */}
                  {genState.startTime && (
                    <ElapsedTimeDisplay startTime={genState.startTime} estimatedDuration={genState.estimatedDuration} />
                  )}
                  {/* Pulsing dots for activity */}
                  <div className="flex justify-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '0ms'}}></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '150ms'}}></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            )}

            {/* Image Display Area */}
            <div className="flex-1 relative min-h-0 flex items-center justify-center p-2 lg:p-4 group">
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
                        {nextStage.step > nextStage.total ? 'Workflow Complete' : isAutoGenerating ? 'Auto-Generating' : 'Next Stage'}
                      </h4>
                    </div>
                    <p className="text-xs font-mono font-bold text-white uppercase tracking-wider">{nextStage.label}</p>
                  </div>
                  {!isAutoGenerating ? (
                    <button
                      onClick={nextStage.action}
                      className="group relative w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                    >
                      <div className="absolute inset-0 rounded-full border border-white opacity-50 group-hover:animate-ping"></div>
                      <svg className="w-6 h-6 text-black relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => setAutoGenCancelled(true)}
                      className="group relative px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center justify-center hover:bg-red-500/30 transition-all duration-300"
                    >
                      <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider">Cancel</span>
                    </button>
                  )}
                </div>
              )}

              {/* Main Image */}
              <div className="relative h-full max-w-full flex items-center justify-center select-none pb-16">
                {currentImageUrl && (
                  <>
                    <img 
                      ref={imageRef}
                      src={currentImageUrl} 
                      alt="Active View" 
                      className="max-h-[calc(100vh-200px)] lg:max-h-[calc(100vh-180px)] max-w-full object-contain shadow-2xl border border-studio-800/50 bg-black" style={{marginTop: '70px'}}
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

                {/* Tools Bar - positioned at right edge of image */}
                {!genState.isGenerating && currentAssets.length > 0 && (
                  <div className="absolute top-1/2 -translate-y-1/2 -right-2 flex flex-col gap-2 z-30 animate-in fade-in slide-in-from-right-4 duration-500" style={{marginRight: '15px'}}>
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

                {/* Tool Mode Overlay Badge */}
                {isMasking && (
                  <div className="absolute top-4 right-4 z-50 pointer-events-none select-none animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 flex items-center space-x-2 shadow-lg">
                      {activeTool === 'eraser' ? (
                        <svg className="w-3 h-3 text-purple-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>
                      ) : (
                        <svg className="w-3 h-3 text-red-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
                      )}
                      <span className={`text-[10px] font-mono uppercase tracking-wider ${activeTool === 'eraser' ? 'text-purple-300' : 'text-red-300'}`}>
                        {activeTool === 'eraser' ? 'Magic Eraser' : 'Surgical Edit'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Locked Source Badge */}
                {isViewLocked && !isMasking && (
                  <div className="absolute top-4 left-4 z-20 animate-in fade-in duration-300">
                    <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 flex items-center space-x-2 shadow-lg">
                      <svg className="w-3 h-3 text-studio-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      <span className="text-[10px] font-mono uppercase text-studio-300 tracking-wider">
                        {activeView === 'backFull' ? "Consistency Lock" : "Locked Source"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Download Button */}
                <button
                  onClick={async () => {
                    if (!currentImageUrl) return;
                    try {
                      // Fetch the image as blob to handle cross-origin
                      const response = await fetch(currentImageUrl);
                      const blob = await response.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = `FORMASTUDIO_${activeView}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(blobUrl);
                      toast.success('Image downloaded!');
                    } catch (error) {
                      console.error('Download failed:', error);
                      toast.error('Download failed');
                    }
                  }}
                  className="absolute bottom-2 right-2 z-30 p-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-studio-400 hover:text-white hover:border-white/30 transition-all"
                  title="Download Image" style={{marginBottom: '10px'}}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>

                {/* View Label */}
                <div className="absolute bottom-2 left-2 z-30 px-2 py-0.5 bg-black/60 backdrop-blur-md border border-white/10 rounded" style={{marginBottom: '10px'}}>
                  <span className="text-[9px] font-mono uppercase text-white tracking-widest">
                    {activeView === 'frontClose' ? 'FRONT CLOSE' : 
                     activeView === 'frontFull' ? 'FRONT FULL' :
                     activeView === 'sideClose' ? 'SIDE CLOSE' :
                     activeView === 'sideFull' ? 'SIDE FULL' :
                     activeView === 'backFull' ? 'BACK FULL' : activeView.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Overlaying Chat Input - positioned at bottom of image container */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-full max-w-xl z-30 px-2" onClick={e => e.stopPropagation()} style={{marginBottom: '60px', marginLeft: '10px'}}>
                {/* Inline Helper Text for Masking */}
                {isMasking && (
                  <div className="mb-2 flex justify-center animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-md rounded border border-white/10 shadow-lg">
                      <span className={`text-[9px] font-mono font-bold ${activeTool === 'eraser' ? 'text-purple-400' : 'text-red-400'}`}>
                        {maskPaths.length === 0 ? "STEP 01" : "STEP 02"}
                      </span>
                      <span className="w-px h-2 bg-white/20"></span>
                      <span className="text-[9px] font-mono text-studio-300 uppercase tracking-wide">
                        {maskPaths.length === 0 
                          ? "Paint Target Area" 
                          : (activeTool === 'eraser' ? "Click Erase Button" : "Describe Edit & Generate")
                        }
                      </span>
                    </div>
                  </div>
                )}

                <div className={`mx-1 bg-black/80 backdrop-blur-md border rounded-full shadow-xl flex items-center p-1 transition-all focus-within:ring-1 focus-within:ring-white/20 ${isViewLocked && !unlockMode && activeTool !== 'eraser' ? 'border-studio-700 opacity-90' : 'border-white/10'}`}>
                  {/* Regenerate Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={(isViewLocked && !unlockMode) || !isIterationAllowed}
                    className={`flex-shrink-0 p-1.5 transition-colors ${isViewLocked && !unlockMode ? 'text-studio-600 cursor-not-allowed' : 'text-studio-400 hover:text-white'}`}
                    title="Regenerate with Current Settings"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
                  </button>

                  <div className="w-px h-4 bg-white/10 mx-1"></div>

                  {/* Input Area */}
                  {activeTool === 'eraser' ? (
                    <div className="flex-1 px-2 py-1.5 min-h-[28px] flex items-center">
                      <span className="text-xs font-mono text-purple-300/50 uppercase tracking-widest">
                        {maskPaths.length === 0 ? "Paint Area to Erase" : "Ready to Erase"}
                      </span>
                    </div>
                  ) : isViewLocked && !unlockMode ? (
                    <div className="flex-1 flex items-center justify-between px-2 py-1">
                      <div className="flex items-center space-x-2 text-studio-400 select-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <span className="text-xs font-mono uppercase tracking-widest">Locked</span>
                        <Tooltip content={
                          activeView === 'backFull' 
                          ? "Editing this finalized view may break visual consistency with the rest of the character pack."
                          : "This view is the source for downstream assets (Full Body, Angles). Editing it will reset them."
                        } />
                      </div>
                      <button 
                        onClick={() => setUnlockMode(true)}
                        className="text-[9px] font-mono uppercase tracking-widest text-studio-500 hover:text-white transition-colors border-b border-dashed border-studio-700 hover:border-white pb-0.5"
                      >
                        Unlock to Edit
                      </button>
                    </div>
                  ) : !isIterationAllowed ? (
                    <div className="flex-1 px-2 py-1 flex items-center space-x-2 text-studio-600 select-none">
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
                        isViewLocked 
                        ? (activeView === 'backFull' ? "WARNING: MAKING CHANGES TO THIS IMAGE COULD RUIN CHARACTER CONSISTENCY..." : "Editing will reset downstream assets...")
                        : activeTool === 'surgical' 
                          ? `Describe change for masked area (e.g. 'Add scar')...` 
                          : `Iterate on ${activeView.replace(/([A-Z])/g, ' $1').toLowerCase()}...`
                      }
                      rows={1}
                      className={`flex-1 bg-transparent border-none text-xs placeholder:text-studio-500 focus:outline-none focus:ring-0 px-2 py-1.5 font-mono resize-none custom-scrollbar min-h-[28px] max-h-[200px] ${isViewLocked ? 'text-amber-100 placeholder:text-amber-500/50' : isEnhancing ? 'text-studio-500 animate-pulse' : 'text-white'}`}
                    />
                  )}
                  
                  {/* Enhance button */}
                  {((!isViewLocked || unlockMode) && isIterationAllowed && activeTool !== 'eraser') && (
                    <button
                      onClick={handleEnhance}
                      disabled={!refineInput.trim() || isEnhancing}
                      className="flex-shrink-0 p-1.5 text-studio-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${maskPaths.length > 0 ? 'bg-purple-500 text-white hover:bg-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-studio-800 text-studio-600 cursor-not-allowed'}`}
                    >
                      Erase
                    </button>
                  ) : activeTool === 'surgical' ? (
                    <button 
                      onClick={handleRefineSubmit}
                      disabled={maskPaths.length === 0 || !refineInput.trim() || (isViewLocked && !unlockMode)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${(maskPaths.length > 0 && refineInput.trim()) ? 'bg-red-500 text-white hover:bg-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-studio-800 text-studio-600 cursor-not-allowed'}`}
                    >
                      Apply
                    </button>
                  ) : (
                    <button 
                      onClick={handleRefineSubmit}
                      disabled={!refineInput.trim() || (isViewLocked && !unlockMode) || !isIterationAllowed}
                      className={`flex-shrink-0 p-1.5 rounded-full transition-colors ${(isViewLocked && !unlockMode) || !isIterationAllowed ? 'bg-studio-800 text-studio-600 cursor-not-allowed' : 'bg-white text-black hover:bg-studio-200 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Panel - Director's Note */}
            <div className="w-full bg-studio-950 border-t border-studio-800 flex-shrink-0 z-20">
              <div className="w-full max-w-[1400px] mx-auto p-3 lg:p-4">
                <div className="flex flex-col md:flex-row gap-3 items-start">
                  <div className="flex-1 space-y-2 group">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] uppercase font-bold text-studio-500 tracking-widest">
                        {showSchema ? "Technical Schema" : "Director's Note"}
                      </h3>
                      <div className="flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                          onClick={() => setShowSchema(!showSchema)}
                          className="text-[9px] uppercase font-mono text-studio-400 hover:text-white transition-colors"
                        >
                          {showSchema ? "View Description" : "View Technical Schema"}
                        </button>
                        <button 
                          onClick={() => {
                            const content = showSchema 
                              ? JSON.stringify(currentTechnicalSchema, null, 2) 
                              : currentMasterPrompt;
                            navigator.clipboard.writeText(content);
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                          }}
                          className={`text-[9px] uppercase font-mono transition-colors ${isCopied ? 'text-green-500' : 'text-studio-400 hover:text-white'}`}
                        >
                          {isCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                    {showSchema ? (
                      <pre className="text-[10px] font-mono text-studio-400 leading-relaxed max-h-32 overflow-y-auto custom-scrollbar select-text bg-black/30 p-3 rounded border border-studio-800">
                        {currentTechnicalSchema 
                          ? JSON.stringify(currentTechnicalSchema, null, 2) 
                          : "Technical schema will appear here after generation..."}
                      </pre>
                    ) : (
                      <p className="text-[10px] font-mono text-studio-400 leading-relaxed max-h-16 overflow-y-auto custom-scrollbar select-text">
                        {currentMasterPrompt || "Master prompt will appear here after generation..."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : genState.isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-200">
            {/* Progress ring with percentage */}
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgb(38,38,38)" strokeWidth="2" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" 
                  stroke="white" strokeWidth="2" 
                  strokeLinecap="round"
                  strokeDasharray={`${(genState.progress || 0) * 2.83} 283`}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-4 border-t-2 border-white/30 rounded-full animate-spin" style={{animationDuration: '1.5s'}}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-mono text-white font-bold">
                  {genState.progress ? `${Math.round(genState.progress)}%` : ''}
                </span>
              </div>
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-sm font-mono text-white uppercase tracking-[0.2em]">
                {genState.currentStep || 'Processing...'}
              </h3>
              {genState.startTime && (
                <ElapsedTimeDisplay startTime={genState.startTime} estimatedDuration={genState.estimatedDuration} />
              )}
              <div className="flex justify-center space-x-1">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '0ms'}}></div>
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '150ms'}}></div>
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{animationDelay: '300ms'}}></div>
              </div>
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
