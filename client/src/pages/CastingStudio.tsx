import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronLeft,
  Sparkles,
  Loader2,
  Undo2,
  Redo2,
  Download,
  Upload,
  X,
  Zap,
  User,
  Palette,
  Eye,
  Scissors,
  Smile,
} from "lucide-react";

// ============ Types ============

interface ModelPreferences {
  gender: "male" | "female" | "non-binary";
  ageRange: "18-25" | "25-35" | "35-45" | "45-55" | "55+";
  ethnicity: string;
  bodyType: "slim" | "athletic" | "average" | "curvy" | "plus-size";
  height: "petite" | "average" | "tall";
  hairColor: string;
  hairLength: "bald" | "buzz" | "short" | "medium" | "long";
  hairStyle: string;
  skinTone: string;
  eyeColor: string;
  facialFeatures?: string;
  brandTone: "luxury" | "streetwear" | "minimalist" | "editorial" | "commercial" | "avant-garde";
  mood: "confident" | "serene" | "edgy" | "playful" | "mysterious" | "natural";
  referenceDescription?: string;
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
  { value: "luxury", label: "Luxury", desc: "High Fashion / Editorial" },
  { value: "streetwear", label: "Streetwear", desc: "Urban / Edgy" },
  { value: "minimalist", label: "Minimalist", desc: "Clean / Modern" },
  { value: "editorial", label: "Editorial", desc: "Magazine / Artistic" },
  { value: "commercial", label: "Commercial", desc: "Mainstream / Approachable" },
  { value: "avant-garde", label: "Avant-Garde", desc: "Experimental / Bold" },
];

const ETHNICITIES = [
  "Caucasian", "African", "East Asian", "South Asian",
  "Latino/Hispanic", "Middle Eastern", "Mixed", "Pacific Islander"
];

const SKIN_TONES = [
  { label: "Porcelain", value: "porcelain", color: "#ffe0d6" },
  { label: "Fair", value: "fair", color: "#f5cbb6" },
  { label: "Medium", value: "medium", color: "#d9ae88" },
  { label: "Olive", value: "olive", color: "#c08a65" },
  { label: "Tan", value: "tan", color: "#a07050" },
  { label: "Brown", value: "brown", color: "#8d5e42" },
  { label: "Dark", value: "dark", color: "#593b2b" },
];

const EYE_COLORS = [
  { label: "Blue", value: "blue", color: "#4e7bb5" },
  { label: "Green", value: "green", color: "#4f6f46" },
  { label: "Hazel", value: "hazel", color: "#947846" },
  { label: "Brown", value: "brown", color: "#634e34" },
  { label: "Amber", value: "amber", color: "#c49647" },
  { label: "Gray", value: "gray", color: "#9baec2" },
  { label: "Black", value: "black", color: "#1c1c1c" },
];

const HAIR_COLORS = [
  { label: "Black", value: "black", color: "#1a1a1a" },
  { label: "Dark Brown", value: "dark brown", color: "#3b2314" },
  { label: "Brown", value: "brown", color: "#6b4423" },
  { label: "Light Brown", value: "light brown", color: "#a67c52" },
  { label: "Blonde", value: "blonde", color: "#d4a76a" },
  { label: "Platinum", value: "platinum blonde", color: "#e8dcc8" },
  { label: "Red", value: "red", color: "#8b3a3a" },
  { label: "Auburn", value: "auburn", color: "#6b3a2a" },
  { label: "Gray", value: "gray", color: "#9a9a9a" },
  { label: "White", value: "white", color: "#f0f0f0" },
];

const HAIR_STYLES_FEMALE = [
  "Straight", "Wavy", "Curly", "Coily", "Pixie Cut", "Bob", "Long Layers",
  "Braids", "Updo", "Ponytail", "Natural Afro", "Sleek"
];

const HAIR_STYLES_MALE = [
  "Buzz Cut", "Crew Cut", "Fade", "Undercut", "Slicked Back", "Textured",
  "Curly Top", "Afro", "Man Bun", "Long", "Bald", "Short Sides Long Top"
];

const MOODS = [
  { value: "confident", label: "Confident", desc: "Strong, assured presence" },
  { value: "serene", label: "Serene", desc: "Calm, peaceful expression" },
  { value: "edgy", label: "Edgy", desc: "Bold, unconventional attitude" },
  { value: "playful", label: "Playful", desc: "Fun, lighthearted energy" },
  { value: "mysterious", label: "Mysterious", desc: "Enigmatic, intriguing" },
  { value: "natural", label: "Natural", desc: "Authentic, effortless" },
];

const POINT_COSTS = {
  masterPrompt: 2,
  castingImage: 10,
  fullBody: 8,
  multiView: 15,
  iteration: 5,
};

// ============ Helper Components ============

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 group focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 transition-colors ${isOpen ? "text-orange-500" : "text-neutral-500"}`} />
          <span className={`text-xs font-mono uppercase tracking-wider transition-colors ${isOpen ? "text-white" : "text-neutral-500"}`}>
            {title}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? "max-h-[2000px] opacity-100 pb-4" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function VisualSelector({
  options,
  value,
  onChange,
  columns = 4,
}: {
  options: { label: string; value: string; color: string }[];
  value: string;
  onChange: (val: string) => void;
  columns?: number;
}) {
  return (
    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`relative aspect-square rounded-lg border-2 transition-all overflow-hidden group ${
            value === opt.value
              ? "border-orange-500 ring-2 ring-orange-500/30 scale-105"
              : "border-white/10 hover:border-white/30"
          }`}
          title={opt.label}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundColor: opt.color }}
          />
          <div className={`absolute inset-0 flex items-end justify-center pb-1 ${
            value === opt.value ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}>
            <span className="text-[8px] font-mono uppercase text-white drop-shadow-lg bg-black/50 px-1 rounded">
              {opt.label}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[] | { value: string; label: string; desc?: string }[];
  onChange: (val: string) => void;
}) {
  const normalizedOptions = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg focus:border-orange-500 focus:outline-none appearance-none cursor-pointer"
      >
        <option value="" className="bg-neutral-900">Select...</option>
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-neutral-900">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChipSelector({
  options,
  selected,
  onChange,
  multiSelect = false,
}: {
  options: string[];
  selected: string | string[];
  onChange: (val: string | string[]) => void;
  multiSelect?: boolean;
}) {
  const selectedArray = Array.isArray(selected) ? selected : [selected];

  const handleClick = (opt: string) => {
    if (multiSelect) {
      const newSelected = selectedArray.includes(opt)
        ? selectedArray.filter((s) => s !== opt)
        : [...selectedArray, opt];
      onChange(newSelected);
    } else {
      onChange(opt);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => handleClick(opt)}
          className={`px-3 py-1.5 text-xs font-mono rounded-full border transition-all ${
            selectedArray.includes(opt)
              ? "bg-orange-500/20 border-orange-500 text-orange-400"
              : "bg-white/5 border-white/10 text-neutral-400 hover:border-white/30"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ============ Main Component ============

export default function CastingStudio() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // Form state
  const [prefs, setPrefs] = useState<ModelPreferences>({
    gender: "female",
    ageRange: "18-25",
    ethnicity: "",
    bodyType: "slim",
    height: "average",
    hairColor: "brown",
    hairLength: "medium",
    hairStyle: "",
    skinTone: "medium",
    eyeColor: "brown",
    facialFeatures: "",
    brandTone: "editorial",
    mood: "confident",
    referenceDescription: "",
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

  // Mobile panel state
  const [showMobilePanel, setShowMobilePanel] = useState(false);

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

  // Get hair styles based on gender
  const hairStyles = useMemo(() => {
    return prefs.gender === "male" ? HAIR_STYLES_MALE : HAIR_STYLES_FEMALE;
  }, [prefs.gender]);

  // Form validation
  const isFormValid = useMemo(() => {
    return (
      prefs.gender &&
      prefs.ethnicity &&
      prefs.skinTone &&
      prefs.eyeColor &&
      prefs.hairColor &&
      prefs.hairStyle
    );
  }, [prefs]);

  // Update preference helper
  const updatePref = <K extends keyof ModelPreferences>(key: K, value: ModelPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
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

    setGenState({ isGenerating: true, currentStep: "Creating model specification...", error: null });

    try {
      // Step 1: Create model with master prompt
      setGenState((prev) => ({ ...prev, currentStep: "Generating casting specification..." }));
      const modelResult = await createModelMutation.mutateAsync({
        preferences: prefs,
        name: modelName || undefined,
      });

      setCurrentModelId(modelResult.modelId ?? null);

      // Step 2: Generate casting image
      setGenState((prev) => ({ ...prev, currentStep: "Generating headshot..." }));
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

  // Handle generate full body
  const handleGenerateFullBody = async () => {
    if (!currentModelId) return;

    if (!pointsData || pointsData.balance < POINT_COSTS.fullBody) {
      toast.error(`Insufficient points. Need ${POINT_COSTS.fullBody} points.`);
      return;
    }

    setGenState({ isGenerating: true, currentStep: "Generating full body view...", error: null });

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
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/10 bg-[#080808]">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs font-mono uppercase">Back</span>
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-mono text-white">{pointsData?.balance || 0}</span>
          </div>
          <button
            onClick={() => setShowMobilePanel(!showMobilePanel)}
            className="p-2 rounded-lg bg-white/10 text-white"
          >
            {showMobilePanel ? <X className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Left Panel - Control Panel */}
      <aside className={`
        ${showMobilePanel ? 'fixed inset-0 z-50 pt-16' : 'hidden'}
        lg:relative lg:block lg:w-[400px] lg:pt-0
        bg-[#080808] border-r border-white/10 flex flex-col h-screen overflow-hidden
      `}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs font-mono uppercase">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-mono text-white">{pointsData?.balance || 0}</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ scrollbarWidth: "thin" }}>
          {/* Model Name */}
          <div className="pb-4 border-b border-white/10">
            <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider mb-2 block">
              Model Name (Optional)
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g., Summer Campaign Model"
              className="w-full bg-white/5 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Brand & Style */}
          <CollapsibleSection title="Brand & Style" icon={Sparkles}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  Brand Tone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BRAND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updatePref("brandTone", opt.value as ModelPreferences["brandTone"])}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        prefs.brandTone === opt.value
                          ? "bg-orange-500/20 border-orange-500 text-white"
                          : "bg-white/5 border-white/10 text-neutral-400 hover:border-white/30"
                      }`}
                    >
                      <div className="text-xs font-mono uppercase font-bold">{opt.label}</div>
                      <div className="text-[9px] text-neutral-500 mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  Mood
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {MOODS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updatePref("mood", opt.value as ModelPreferences["mood"])}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        prefs.mood === opt.value
                          ? "bg-orange-500/20 border-orange-500 text-white"
                          : "bg-white/5 border-white/10 text-neutral-400 hover:border-white/30"
                      }`}
                    >
                      <div className="text-[10px] font-mono uppercase">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Demographics */}
          <CollapsibleSection title="Demographics" icon={User}>
            <div className="space-y-4">
              {/* Gender */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  Gender
                </label>
                <div className="flex gap-2">
                  {(["female", "male", "non-binary"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => updatePref("gender", g)}
                      className={`flex-1 py-2.5 rounded-lg border text-xs font-mono uppercase transition-all ${
                        prefs.gender === g
                          ? "bg-orange-500/20 border-orange-500 text-white"
                          : "bg-white/5 border-white/10 text-neutral-400 hover:border-white/30"
                      }`}
                    >
                      {g === "non-binary" ? "NB" : g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age Range */}
              <SelectControl
                label="Age Range"
                value={prefs.ageRange}
                options={[
                  { value: "18-25", label: "18-25 years" },
                  { value: "25-35", label: "25-35 years" },
                  { value: "35-45", label: "35-45 years" },
                  { value: "45-55", label: "45-55 years" },
                  { value: "55+", label: "55+ years" },
                ]}
                onChange={(val) => updatePref("ageRange", val as ModelPreferences["ageRange"])}
              />

              {/* Ethnicity */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  Ethnicity *
                </label>
                <ChipSelector
                  options={ETHNICITIES}
                  selected={prefs.ethnicity}
                  onChange={(val) => updatePref("ethnicity", val as string)}
                />
              </div>

              {/* Body Type */}
              <SelectControl
                label="Body Type"
                value={prefs.bodyType}
                options={[
                  { value: "slim", label: "Slim" },
                  { value: "athletic", label: "Athletic" },
                  { value: "average", label: "Average" },
                  { value: "curvy", label: "Curvy" },
                  { value: "plus-size", label: "Plus Size" },
                ]}
                onChange={(val) => updatePref("bodyType", val as ModelPreferences["bodyType"])}
              />

              {/* Height */}
              <SelectControl
                label="Height"
                value={prefs.height}
                options={[
                  { value: "petite", label: "Petite" },
                  { value: "average", label: "Average" },
                  { value: "tall", label: "Tall" },
                ]}
                onChange={(val) => updatePref("height", val as ModelPreferences["height"])}
              />
            </div>
          </CollapsibleSection>

          {/* Skin */}
          <CollapsibleSection title="Skin" icon={Palette}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  Skin Tone *
                </label>
                <VisualSelector
                  options={SKIN_TONES}
                  value={prefs.skinTone}
                  onChange={(val) => updatePref("skinTone", val)}
                  columns={7}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Eyes */}
          <CollapsibleSection title="Eyes" icon={Eye}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  Eye Color *
                </label>
                <VisualSelector
                  options={EYE_COLORS}
                  value={prefs.eyeColor}
                  onChange={(val) => updatePref("eyeColor", val)}
                  columns={7}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Hair */}
          <CollapsibleSection title="Hair" icon={Scissors}>
            <div className="space-y-4">
              {/* Hair Color */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  Hair Color *
                </label>
                <VisualSelector
                  options={HAIR_COLORS}
                  value={prefs.hairColor}
                  onChange={(val) => updatePref("hairColor", val)}
                  columns={5}
                />
              </div>

              {/* Hair Length */}
              <SelectControl
                label="Hair Length"
                value={prefs.hairLength}
                options={[
                  { value: "bald", label: "Bald" },
                  { value: "buzz", label: "Buzz Cut" },
                  { value: "short", label: "Short" },
                  { value: "medium", label: "Medium" },
                  { value: "long", label: "Long" },
                ]}
                onChange={(val) => updatePref("hairLength", val as ModelPreferences["hairLength"])}
              />

              {/* Hair Style */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  Hair Style *
                </label>
                <ChipSelector
                  options={hairStyles}
                  selected={prefs.hairStyle}
                  onChange={(val) => updatePref("hairStyle", val as string)}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Face Details */}
          <CollapsibleSection title="Face Details" icon={Smile} defaultOpen={false}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  Additional Features
                </label>
                <textarea
                  value={prefs.facialFeatures || ""}
                  onChange={(e) => updatePref("facialFeatures", e.target.value)}
                  placeholder="e.g., High cheekbones, full lips, strong jawline..."
                  className="w-full bg-white/5 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg focus:border-orange-500 focus:outline-none resize-none h-20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  Reference Description
                </label>
                <textarea
                  value={prefs.referenceDescription || ""}
                  onChange={(e) => updatePref("referenceDescription", e.target.value)}
                  placeholder="Describe any reference or inspiration..."
                  className="w-full bg-white/5 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg focus:border-orange-500 focus:outline-none resize-none h-20"
                />
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Generate Button */}
        <div className="p-4 border-t border-white/10 bg-[#080808]">
          <button
            onClick={handleGenerate}
            disabled={!isFormValid || genState.isGenerating}
            className={`w-full py-3 rounded-lg font-mono text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              isFormValid && !genState.isGenerating
                ? "bg-white text-black hover:bg-neutral-200"
                : "bg-white/10 text-neutral-500 cursor-not-allowed"
            }`}
          >
            {genState.isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {genState.currentStep}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Model ({POINT_COSTS.masterPrompt + POINT_COSTS.castingImage} pts)
              </>
            )}
          </button>
          {!isFormValid && (
            <p className="text-[10px] text-neutral-500 text-center mt-2 font-mono">
              Fill in required fields (*)
            </p>
          )}
        </div>
      </aside>

      {/* Right Panel - Image Viewer */}
      <main className="flex-1 flex flex-col h-[calc(100vh-64px)] lg:h-screen overflow-hidden">
        {/* Top Bar */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0A0A0A]">
          {/* View Tabs */}
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            {[
              { key: "frontClose", label: "Front" },
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
                  className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase transition-all whitespace-nowrap ${
                    activeView === view.key
                      ? "bg-white text-black"
                      : hasAsset
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-white/5 text-neutral-600 cursor-not-allowed"
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
              className={`p-2 rounded-lg transition-all ${
                canUndo ? "bg-white/10 text-white hover:bg-white/20" : "bg-white/5 text-neutral-600"
              }`}
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className={`p-2 rounded-lg transition-all ${
                canRedo ? "bg-white/10 text-white hover:bg-white/20" : "bg-white/5 text-neutral-600"
              }`}
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            {currentImageUrl && (
              <a
                href={currentImageUrl}
                download
                className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Image Display */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-[#050505]">
          {genState.isGenerating ? (
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
              <p className="text-sm font-mono text-neutral-400">{genState.currentStep}</p>
            </div>
          ) : currentImageUrl ? (
            <div className="relative max-w-2xl max-h-full">
              <img
                src={currentImageUrl}
                alt="Generated model"
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          ) : (
            <div className="text-center max-w-md">
              <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-neutral-600" />
              </div>
              <h3 className="text-lg font-mono text-white mb-2">No Model Generated</h3>
              <p className="text-sm text-neutral-500 mb-6">
                Configure your model preferences in the left panel and click Generate to create your AI fashion model.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-[10px] font-mono text-neutral-600">
                <span className="px-2 py-1 bg-white/5 rounded">Headshot: {POINT_COSTS.castingImage} pts</span>
                <span className="px-2 py-1 bg-white/5 rounded">Full Body: {POINT_COSTS.fullBody} pts</span>
                <span className="px-2 py-1 bg-white/5 rounded">Multi-View: {POINT_COSTS.multiView} pts</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        {currentAssets.length > 0 && !genState.isGenerating && (
          <div className="p-4 border-t border-white/10 bg-[#0A0A0A] flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            {canGenerateFullBody && !currentAssets.some((a) => a.viewType === "frontFull") && (
              <button
                onClick={handleGenerateFullBody}
                className="px-3 sm:px-4 py-2 rounded-lg bg-white/10 text-white text-[10px] sm:text-xs font-mono uppercase hover:bg-white/20 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-3 h-3" />
                <span className="hidden sm:inline">Generate</span> Full Body ({POINT_COSTS.fullBody})
              </button>
            )}
            {canGenerateMultiView && !currentAssets.some((a) => a.viewType === "sideClose") && (
              <button
                onClick={() => handleGenerateMultiView("side")}
                className="px-3 sm:px-4 py-2 rounded-lg bg-white/10 text-white text-[10px] sm:text-xs font-mono uppercase hover:bg-white/20 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-3 h-3" />
                <span className="hidden sm:inline">Generate</span> Side ({POINT_COSTS.multiView})
              </button>
            )}
            {canGenerateMultiView && !currentAssets.some((a) => a.viewType === "backFull") && (
              <button
                onClick={() => handleGenerateMultiView("back")}
                className="px-3 sm:px-4 py-2 rounded-lg bg-white/10 text-white text-[10px] sm:text-xs font-mono uppercase hover:bg-white/20 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-3 h-3" />
                <span className="hidden sm:inline">Generate</span> Back ({POINT_COSTS.multiView})
              </button>
            )}
            <button
              onClick={handleGenerate}
              className="px-3 sm:px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-500/50 text-orange-400 text-[10px] sm:text-xs font-mono uppercase hover:bg-orange-500/30 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-3 h-3" />
              Recast
            </button>
          </div>
        )}

        {/* Error Display */}
        {genState.error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm font-mono flex items-center gap-2">
            <X className="w-4 h-4" />
            {genState.error}
          </div>
        )}
      </main>
    </div>
  );
}
