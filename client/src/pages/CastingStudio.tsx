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
  { label: "Ice", hex: "#c4d6e0" },
  { label: "Sky", hex: "#8fb6cd" },
  { label: "Azure", hex: "#4e7bb5" },
  { label: "Navy", hex: "#283655" },
  { label: "Grey", hex: "#9baec2" },
  { label: "Steel", hex: "#687684" },
  { label: "Mint", hex: "#8caea0" },
  { label: "Green", hex: "#4f6f46" },
  { label: "Olive", hex: "#6e7039" },
  { label: "Hazel", hex: "#947846" },
  { label: "Amber", hex: "#c49647" },
  { label: "Honey", hex: "#b89650" },
  { label: "Brown", hex: "#634e34" },
  { label: "Dark", hex: "#3b2b22" },
  { label: "Black", hex: "#1c1c1c" },
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
  options: { label: string; hex: string }[];
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
            <div
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 35% 35%, ${opt.hex} 0%, #151515 80%)` }}
            />
            <div className="absolute top-[25%] left-[25%] w-[15%] h-[15%] bg-white rounded-full blur-[1px] opacity-50" />
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
    </div>
  );
}

// ============ Main Component ============

export default function CastingStudio() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // Form state
  const [prefs, setPrefs] = useState<ModelPreferences>({
    castingBrand: 'Gucci',
    castingVibe: { editorial: 0.8, commercial: 0.1, runway: 0.1 },
    gender: 'Female',
    age: '23',
    ethnicity: '',
    bodyType: 'Slim',
    faceShape: 'Random',
    skinTone: '',
    skinTexture: 'Raw / Standard',
    skinFinish: 'Natural',
    eyeColor: '',
    hairColor: '',
    hairStyle: '',
    hairLength: '',
    hairTexture: '',
    hairFringe: '',
    hairParting: '',
    hairVolume: '',
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
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Points data
  const { data: pointsData } = trpc.points.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Mutations
  const createModelMutation = trpc.models.create.useMutation();
  const generateCastingMutation = trpc.generation.castingImage.useMutation();
  const generateFullBodyMutation = trpc.generation.fullBody.useMutation();
  const generateMultiViewMutation = trpc.generation.multiView.useMutation();

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
      // Convert prefs to backend format
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

  // Handle generate full body
  const handleGenerateFullBody = async () => {
    if (!currentModelId) return;

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
      }

      setGenState({ isGenerating: false, currentStep: "", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      setGenState({ isGenerating: false, currentStep: "", error: message });
      toast.error(message);
    }
  };

  // Handle generate multi-view
  const handleGenerateMultiView = async (viewType: "side" | "back") => {
    if (!currentModelId) return;

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
      }

      setGenState({ isGenerating: false, currentStep: "", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      setGenState({ isGenerating: false, currentStep: "", error: message });
      toast.error(message);
    }
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
        ${showMobilePanel ? 'fixed inset-0 z-50 pt-16' : 'hidden'}
        lg:relative lg:block lg:w-[400px] lg:pt-0
        bg-[#080808] border-r border-studio-800 flex flex-col h-screen overflow-hidden flex-shrink-0
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
        <div className="flex-1 overflow-y-auto p-5 space-y-2 custom-scrollbar">
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

              {/* Advanced Features Toggle */}
              <button
                onClick={() => setShowAdvancedFace(!showAdvancedFace)}
                className="w-full flex items-center justify-between py-2 text-[9px] font-mono text-studio-500 hover:text-white uppercase tracking-wider border-t border-studio-800 mt-4"
              >
                <span>Advanced Features</span>
                <span className="text-lg leading-none">{showAdvancedFace ? '−' : '+'}</span>
              </button>

              {showAdvancedFace && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <SelectControl label="Jawline" options={CHAR_OPTIONS.jawline} value={prefs.jawline || ""} onChange={v => updatePref('jawline', v)} />
                  <SelectControl label="Cheekbones" options={CHAR_OPTIONS.cheekbones} value={prefs.cheekbones || ""} onChange={v => updatePref('cheekbones', v)} />
                  <SelectControl label="Cheek Shape" options={CHAR_OPTIONS.cheeks} value={prefs.cheeks || ""} onChange={v => updatePref('cheeks', v)} />
                  <SelectControl label="Eye Shape" options={CHAR_OPTIONS.eyeShape} value={prefs.eyeShape || ""} onChange={v => updatePref('eyeShape', v)} />
                  <SelectControl label="Nose Shape" options={CHAR_OPTIONS.noseShape} value={prefs.noseShape || ""} onChange={v => updatePref('noseShape', v)} />
                  <SelectControl label="Lip Shape" options={CHAR_OPTIONS.lipShape} value={prefs.lipShape || ""} onChange={v => updatePref('lipShape', v)} />
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* 4. SKIN & COMPLEXION */}
          <CollapsibleSection title="Skin & Complexion">
            <div className="space-y-5 pt-1">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider block">Skin Tone</label>
                <div className="grid grid-cols-6 gap-2">
                  {SKIN_TONES.map(tone => (
                    <button
                      key={tone.label}
                      onClick={() => updatePref('skinTone', tone.value)}
                      title={tone.label}
                      className={`group relative h-8 rounded border transition-all overflow-hidden ${prefs.skinTone === tone.value
                        ? 'border-white ring-1 ring-white'
                        : 'border-studio-800 hover:border-studio-500'
                        }`}
                    >
                      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${tone.base} 0%, ${tone.shadow} 100%)` }} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider">Texture</label>
                    <Tooltip content="Defines surface realism. 'Raw' shows pores/fuzz. 'Glass' is hyper-smooth. 'Textured' adds acne/scars." />
                  </div>
                  <div className="relative group">
                    <select
                      value={prefs.skinTexture || 'Raw / Standard'}
                      onChange={(e) => updatePref('skinTexture', e.target.value)}
                      className="w-full bg-studio-900 border border-studio-800 text-studio-300 text-[10px] font-mono py-2 pl-2 pr-6 rounded-sm focus:border-white focus:outline-none appearance-none cursor-pointer hover:border-studio-600 transition-colors"
                    >
                      {SKIN_TEXTURES.map(tex => (
                        <option key={tex} value={tex} className="bg-studio-900 text-studio-300">{tex}</option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-studio-500 group-hover:text-studio-300 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center">
                    <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider">Finish</label>
                    <Tooltip content="Defines light reflection. 'Matte' is powdered. 'Dewy' is wet/hydrated. 'Oily' is unretouched shine." />
                  </div>
                  <div className="relative group">
                    <select
                      value={prefs.skinFinish || 'Natural'}
                      onChange={(e) => updatePref('skinFinish', e.target.value)}
                      className="w-full bg-studio-900 border border-studio-800 text-studio-300 text-[10px] font-mono py-2 pl-2 pr-6 rounded-sm focus:border-white focus:outline-none appearance-none cursor-pointer hover:border-studio-600 transition-colors"
                    >
                      {SKIN_FINISHES.map(fin => (
                        <option key={fin} value={fin} className="bg-studio-900 text-studio-300">{fin}</option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-studio-500 group-hover:text-studio-300 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* 5. EYES & HAIR */}
          <CollapsibleSection title="Eyes & Hair">
            <div className="space-y-5 pt-1">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider block">Iris Color</label>
                <VisualEyeGrid
                  options={EYE_PRESETS}
                  selected={prefs.eyeColor}
                  onSelect={(val) => updatePref('eyeColor', val)}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-studio-800">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider block">Hair Color</label>
                  <span className="text-[9px] font-mono text-white tracking-wide">{prefs.hairColor || "Natural"}</span>
                </div>

                <div className="bg-studio-900/30 rounded-lg border border-studio-800/50 p-4">
                  <HairColorWheel
                    currentColor={prefs.hairColor || "Natural"}
                    onColorSelect={(color) => updatePref('hairColor', color)}
                  />
                </div>
              </div>

              {/* Hair Builder */}
              <div className="space-y-4 pt-2 border-t border-studio-800">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <label className="text-[9px] uppercase font-mono text-studio-500 tracking-wider">Style Family</label>
                    <Tooltip content="Base architectural cut. Select 'Buzz', 'Bob', 'Layers', etc." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {currentHairFamilies.map(style => (
                      <button
                        key={style}
                        onClick={() => updatePref('hairStyle', style)}
                        className={`
                          px-2 py-2.5 rounded-sm text-[9px] font-mono uppercase tracking-wide border transition-all
                          ${prefs.hairStyle === style
                            ? 'bg-studio-800 border-white text-white'
                            : 'bg-transparent border-studio-800 text-studio-500 hover:border-studio-600 hover:text-studio-300'
                          }
                        `}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Core Modifiers */}
                <div className="grid grid-cols-2 gap-4">
                  <SelectControl label="Length" options={HAIR_LENGTHS} value={prefs.hairLength || ""} onChange={v => updatePref('hairLength', v)} />
                  <SelectControl label="Texture" options={HAIR_TEXTURES} value={prefs.hairTexture || ""} onChange={v => updatePref('hairTexture', v)} />
                  <SelectControl label="Fringe / Bangs" options={HAIR_FRINGES} value={prefs.hairFringe || ""} onChange={v => updatePref('hairFringe', v)} />
                  <SelectControl label="Parting" options={HAIR_PARTINGS} value={prefs.hairParting || ""} onChange={v => updatePref('hairParting', v)} />
                </div>

                {/* Volume & Facial Hair */}
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
      <main className="flex-1 flex flex-col h-[calc(100vh-64px)] lg:h-screen overflow-hidden relative">
        {/* Top Bar */}
        <div className="p-4 border-b border-studio-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0A0A0A]">
          {/* View Tabs */}
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            {[
              { key: "frontClose", label: "Headshot" },
              { key: "frontFull", label: "Full Body" },
              { key: "sideClose", label: "Side" },
              { key: "backFull", label: "Back" },
            ].map((view) => {
              const hasAsset = currentAssets.some((a) => a.viewType === view.key);
              return (
                <button
                  key={view.key}
                  onClick={() => hasAsset && setActiveView(view.key)}
                  disabled={!hasAsset}
                  className={`px-4 py-2 rounded-sm text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap ${activeView === view.key
                    ? "bg-white text-black"
                    : hasAsset
                      ? "bg-studio-900 border border-studio-800 text-white hover:bg-studio-800"
                      : "bg-studio-900/50 border border-studio-800/50 text-studio-700 cursor-not-allowed"
                    }`}
                >
                  {view.label}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={`p-2 rounded-sm border transition-all ${canUndo ? "border-studio-800 text-white hover:bg-studio-800" : "border-studio-800/50 text-studio-700"
                }`}
              title="Undo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className={`p-2 rounded-sm border transition-all ${canRedo ? "border-studio-800 text-white hover:bg-studio-800" : "border-studio-800/50 text-studio-700"
                }`}
              title="Redo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></svg>
            </button>
            {currentImageUrl && (
              <a
                href={currentImageUrl}
                download={`CASTING_${Date.now()}_${activeView}.png`}
                className="p-2 rounded-sm border border-studio-800 text-white hover:bg-studio-800 transition-all"
                title="Download"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              </a>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex items-center justify-center p-8 bg-[#050505] relative">
          {/* Reference Node - Positioned in corner */}
          <div className="absolute top-8 right-8 z-40 hidden xl:block">
            <ReferenceNode
              image={prefs.referenceImage}
              onSet={(img) => updatePref('referenceImage', img)}
              disabled={genState.isGenerating}
            />
          </div>

          {genState.isGenerating ? (
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border border-studio-800 rounded-full" />
                <div className="absolute inset-0 border-t border-white rounded-full animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-sm font-mono text-white uppercase tracking-[0.2em] animate-pulse">Processing</h3>
                <p className="text-[10px] font-mono text-studio-500 uppercase tracking-widest">
                  {genState.currentStep || 'Initializing...'}
                </p>
              </div>
            </div>
          ) : currentImageUrl ? (
            <div className="relative max-w-2xl max-h-full">
              <img
                src={currentImageUrl}
                alt="Generated model"
                className="max-w-full max-h-[70vh] object-contain shadow-2xl"
              />
            </div>
          ) : (
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
          )}
        </div>

        {/* Bottom Actions */}
        {currentAssets.length > 0 && !genState.isGenerating && (
          <div className="p-4 border-t border-studio-800 bg-[#0A0A0A]">
            {/* Refinement Input */}
            <div className="mb-4">
              <div className="flex gap-2">
                <textarea
                  ref={textAreaRef}
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  placeholder="Describe refinements... (e.g., 'add more dramatic lighting', 'softer expression')"
                  className="flex-1 bg-studio-900 border border-studio-800 text-white text-sm py-3 px-4 rounded-sm focus:border-white focus:outline-none resize-none font-mono placeholder:text-studio-600"
                  rows={1}
                />
                <button
                  onClick={() => {
                    if (refineInput.trim()) {
                      toast.info("Iteration feature coming soon!");
                    }
                  }}
                  disabled={!refineInput.trim()}
                  className="px-4 py-2 bg-white text-black font-mono text-xs uppercase tracking-widest hover:bg-studio-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Refine
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {canGenerateFullBody && !currentAssets.some((a) => a.viewType === "frontFull") && (
                <button
                  onClick={handleGenerateFullBody}
                  className="px-4 py-2 rounded-sm bg-studio-900 border border-studio-800 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-studio-800 hover:border-studio-600 transition-all flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  Full Body ({POINT_COSTS.fullBody} pts)
                </button>
              )}
              {canGenerateMultiView && !currentAssets.some((a) => a.viewType === "sideClose") && (
                <button
                  onClick={() => handleGenerateMultiView("side")}
                  className="px-4 py-2 rounded-sm bg-studio-900 border border-studio-800 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-studio-800 hover:border-studio-600 transition-all flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  Side View ({POINT_COSTS.multiView} pts)
                </button>
              )}
              {canGenerateMultiView && !currentAssets.some((a) => a.viewType === "backFull") && (
                <button
                  onClick={() => handleGenerateMultiView("back")}
                  className="px-4 py-2 rounded-sm bg-studio-900 border border-studio-800 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-studio-800 hover:border-studio-600 transition-all flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  Back View ({POINT_COSTS.multiView} pts)
                </button>
              )}
              <button
                onClick={handleGenerate}
                className="px-4 py-2 rounded-sm bg-white/10 border border-white/30 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" /></svg>
                Recast
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {genState.error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-sm text-red-400 text-sm font-mono flex items-center gap-2">
            <X className="w-4 h-4" />
            {genState.error}
          </div>
        )}
      </main>
    </div>
  );
}
