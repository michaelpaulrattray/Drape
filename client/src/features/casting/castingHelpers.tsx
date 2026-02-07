import React, { useState } from "react";
import { X } from "lucide-react";
import Tooltip from "@/components/Tooltip";
import {
  BRAND_OPTIONS,
  ETHNICITIES,
  SKIN_TONES,
  SKIN_TEXTURES,
  SKIN_FINISHES,
  EYE_PRESETS,
  CHAR_OPTIONS,
  HAIR_FAMILIES_FEMALE,
  HAIR_FAMILIES_MALE,
  HAIR_LENGTHS,
  HAIR_TEXTURES,
  HAIR_FRINGES,
  HAIR_PARTINGS,
  HAIR_VOLUMES,
  HAIR_TUCKS,
  HAIR_FADES,
  BODY_TYPES,
  FACE_SHAPES,
  ImageResolution,
  type ModelPreferences,
} from "@/features/casting/constants";

// ============ Utility Functions ============

export const generateExportId = () => {
  const chars = '0123456789ABCDEF';
  let hash = '';
  for (let i = 0; i < 6; i++) {
    hash += chars[Math.floor(Math.random() * 16)];
  }
  return `MOD-${new Date().getFullYear().toString().slice(-2)}-${hash}`;
};

export const generateRandomPreferences = (): Partial<ModelPreferences> => {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const pickValue = (arr: { value: string }[]): string => pick(arr).value;
  const pickLabel = (arr: { label: string; value: string }[]): string => pick(arr).value;
  
  const gender = pick(['Male', 'Female']);
  const hairFamilies = gender === 'Male' ? HAIR_FAMILIES_MALE : HAIR_FAMILIES_FEMALE;
  
  const editorial = Math.random();
  const commercial = Math.random() * (1 - editorial);
  const runway = 1 - editorial - commercial;
  
  return {
    castingBrand: pickValue(BRAND_OPTIONS),
    castingVibe: { editorial, commercial, runway },
    gender,
    age: String(Math.floor(Math.random() * 20) + 18),
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

// ============ SVG Icon Maps ============

export const BODY_ICONS: Record<string, React.ReactNode> = {
  "Ultra Thin": <path d="M12 2C10 2 9 4 9 5C9 7 8 10 9 13C10 16 9 19 9 22H15C15 19 14 16 15 13C16 10 15 7 15 5C15 4 14 2 12 2Z" />,
  "Athletic": <path d="M12 2C9 2 7 4 7 6C7 8 8 11 10 13C11 14 11 16 11 22H13C13 16 13 14 14 13C16 11 17 8 17 6C17 4 15 2 12 2Z" />,
  "Slim": <path d="M12 2C10.5 2 9 4 9 5.5C9 7.5 9.5 10 10 12.5C10.5 15 10.5 18 10.5 22H13.5C13.5 18 13.5 15 14 12.5C14.5 10 15 7.5 15 5.5C15 4 13.5 2 12 2Z" />,
  "Curvy": <path d="M12 2C9 2 8 4 8 6C8 9 7 12 8 15C9 18 8 20 8 22H16C16 20 15 18 16 15C17 12 16 9 16 6C16 4 15 2 12 2Z" />,
  "Muscular": <path d="M12 2C8 2 6 4 6 6C6 8 8 9 9 11C10 13 10 16 10 22H14C14 16 14 13 15 11C16 9 18 8 18 6C18 4 16 2 12 2Z" />,
  "Petite": <path d="M12 3C10.5 3 9.5 4.5 9.5 6C9.5 7.5 10 9.5 10.5 11.5C11 13.5 11 16 11 22H13C13 16 13 13.5 13.5 11.5C14 9.5 14.5 7.5 14.5 6C14.5 4.5 13.5 3 12 3Z" />,
};

export const FACE_ICONS: Record<string, React.ReactNode> = {
  "Oval": <path d="M12 2C7 2 5 6 5 11C5 16 8 22 12 22C16 22 19 16 19 11C19 6 17 2 12 2Z" />,
  "Round": <circle cx="12" cy="12" r="10" />,
  "Square": <rect x="4" y="4" width="16" height="16" rx="2" />,
  "Heart": <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" transform="scale(0.8) translate(3, 2)" />,
  "Diamond": <polygon points="12 2 4 10 12 22 20 10" />,
  "Random": <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l-5 5M4 4l5 5" />,
};

// ============ Loading Tips ============

export const LOADING_TIPS = [
  "Analyzing facial structure parameters...",
  "Rendering skin texture details...",
  "Calibrating lighting conditions...",
  "Processing hair strand dynamics...",
  "Optimizing eye reflections...",
  "Generating micro-expressions...",
  "Applying photorealistic shading...",
  "Fine-tuning color gradients...",
  "Synthesizing natural imperfections...",
  "Compositing final render layers...",
  "Pro tip: Use the eraser tool to remove unwanted elements",
  "Pro tip: Surgical edit lets you modify specific areas",
  "Pro tip: Director's Note refines the entire image",
  "Pro tip: Export includes all views in a ZIP file",
  "Pro tip: Higher resolution = more detail, more credits",
];

// ============ Small UI Components ============

export const ConnectorLine = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;
  
  return (
    <div className="absolute top-0 right-0 w-full h-full z-5 pointer-events-none overflow-visible">
      <svg 
        className="absolute overflow-visible"
        style={{
          top: '180px',
          right: '224px',
          width: '120px',
          height: '80px'
        }}
        viewBox="0 0 120 80"
        fill="none"
      >
        <defs>
          <linearGradient id="connector-gradient" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
          <filter id="connector-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path 
          d="M 120 40 C 80 40, 40 40, 0 40"
          stroke="url(#connector-gradient)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          filter="url(#connector-glow)"
          strokeDasharray="4 6"
        />
        <circle cx="120" cy="40" r="5" fill="rgba(255,255,255,0.9)" filter="url(#connector-glow)" />
        <circle cx="120" cy="40" r="2.5" fill="white" />
        <circle cx="0" cy="40" r="4" fill="rgba(255,255,255,0.6)" filter="url(#connector-glow)" />
        <circle cx="0" cy="40" r="2" fill="white" />
        <circle r="2" fill="white" filter="url(#connector-glow)">
          <animateMotion dur="2.5s" repeatCount="indefinite" path="M 120 40 C 80 40, 40 40, 0 40" />
        </circle>
      </svg>
    </div>
  );
};

export function CollapsibleSection({
  title,
  required = false,
  children,
  defaultOpen = true,
  id,
}: {
  title: string;
  required?: boolean;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div id={id} className="border-b border-gray-200/50 last:border-0 group/section scroll-mt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 group focus:outline-none select-none hover-scale"
      >
        <div className="flex items-center space-x-3">
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isOpen ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'bg-slate-accent group-hover:bg-slate-accent'}`} />
          <h3 className={`text-xs font-semibold tracking-tight transition-colors duration-300 ${isOpen ? 'text-obsidian' : 'text-subtle group-hover:text-charcoal'}`}>
            {title}
          </h3>
          {required && <span className="text-red-500/70 text-xs group-hover:text-red-400 transition-colors">*</span>}
        </div>
        <div className={`transform transition-transform duration-300 text-gray-400 group-hover:text-subtle ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[3000px] opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-4 pl-4 border-l border-gray-200/30 ml-0.5">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SelectControl({
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
        <label className="text-xs font-medium text-subtle">{label}</label>
        {tooltip && <Tooltip content={tooltip} />}
      </div>
      <div className="relative group">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm py-2.5 pl-3 pr-8 rounded-lg focus:border-slate-accent focus:outline-none appearance-none cursor-pointer hover:border-slate-accent transition-colors"
        >
          <option value="" className="bg-gray-50 text-subtle">Auto / Random</option>
          {options.map(opt => (
            <option key={opt} value={opt} className="bg-gray-50 text-gray-700">{opt}</option>
          ))}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-subtle group-hover:text-gray-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
    </div>
  );
}

export function VisualOptionGrid({
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
                ? 'bg-slate-accent border-white text-obsidian'
                : 'bg-transparent border-gray-200 text-subtle hover:border-slate-accent hover:bg-gray-50 hover:text-gray-700'
              }
            `}
          >
            <div className={`mb-1.5 transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-90 group-hover:scale-100'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isSelected ? "0" : "1.5"}>
                {icons?.[opt] || <circle cx="12" cy="12" r="8" />}
              </svg>
            </div>
            <span className="text-[10px] font-medium leading-none text-center">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}
