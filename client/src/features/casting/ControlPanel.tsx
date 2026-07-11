import { useCallback, useState, useMemo } from "react";
import { Loader2, Palette, Dumbbell, ScanFace, Droplets, Scissors, Sparkles, Dices, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import TriBlendSelector from "./components/TriBlendSelector";
import HairColorWheel from "./components/HairColorWheel";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";
import { generateRandomPreferences } from "./castingHelpers";
import { type GenerationState, type GeneratedAsset, type ModelPreferences, SKIN_TEXTURES, SKIN_FINISHES, CHAR_OPTIONS, CREDIT_COSTS } from "@/features/casting/constants";
import { HAIR_STYLE_CONFIG, HAIR_TUCKS, HAIR_FADES } from "./hairStyleConfig";
import { BrandSelector } from "./components/BrandSelector";
import { FromPromptField, type ParsePromptResult } from "./components/FromPromptField";
import { EngineChoiceChip } from "./components/EngineChoiceChip";
import { ParseSummaryStrip, type ParseSummary, type ParsedChip } from "./components/ParseSummaryStrip";
import {
  FieldLabel, ChipRow, OptionGrid, WarmSelectControl, EyeGrid,
  EthnicityBlender, CollapsibleSection, SummaryStrip, SkinToneGrid,
} from "./components/WarmPrimitives";

// ── Parse choreography metadata (D-41) ─────────
// Pref key → summary chip + sweep target + hosting section. Keys absent here
// still apply to the form; they just don't get a chip.
const REQUIRED_FIELD_LABELS: Record<string, string> = {
  castingBrand: "Brand", gender: "Gender", age: "Age", ethnicity: "Ethnicity",
  skinTone: "Skin", eyeColor: "Eyes", hairColor: "Hair color", hairStyle: "Hair style",
};

type FieldMeta = {
  label: string;
  sweep: string;
  section: "basics" | "physique" | "face" | "skin" | "hair";
  advancedFace?: boolean;
  format?: (v: unknown, prefs: ModelPreferences) => string | null;
};

const PARSE_FIELD_META: Record<string, FieldMeta> = {
  gender: { label: "Gender", sweep: "gender", section: "basics" },
  age: { label: "Age", sweep: "age", section: "basics", format: (v) => `${v}y` },
  ethnicityBlend: {
    label: "Ethnicity", sweep: "ethnicity", section: "basics",
    format: (v) => Array.isArray(v) && v.length ? (v as Array<{ name: string }>).map((e) => e.name).join(" + ") : null,
  },
  castingBrand: { label: "Brand", sweep: "brand", section: "basics" },
  castingVibe: {
    label: "Vibe", sweep: "vibe", section: "basics",
    format: (v) => {
      const vibe = v as { editorial: number; commercial: number; runway: number } | undefined;
      if (!vibe) return null;
      const entries = [["editorial", vibe.editorial], ["commercial", vibe.commercial], ["runway", vibe.runway]] as const;
      const [name, weight] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
      return weight >= 0.45 ? name : null; // balanced default isn't "understood"
    },
  },
  bodyType: { label: "Body", sweep: "body", section: "physique" },
  faceShape: { label: "Face", sweep: "face-shape", section: "face" },
  eyebrowStyle: { label: "Brows", sweep: "brows", section: "face" },
  jawline: { label: "Jawline", sweep: "face-advanced", section: "face", advancedFace: true },
  cheekbones: { label: "Cheekbones", sweep: "face-advanced", section: "face", advancedFace: true },
  cheeks: { label: "Cheeks", sweep: "face-advanced", section: "face", advancedFace: true },
  eyeShape: { label: "Eye shape", sweep: "face-advanced", section: "face", advancedFace: true },
  noseShape: { label: "Nose", sweep: "face-advanced", section: "face", advancedFace: true },
  lipShape: { label: "Lips", sweep: "face-advanced", section: "face", advancedFace: true },
  skinTone: { label: "Skin", sweep: "skin-tone", section: "skin", format: (v) => String(v).split(" / ")[0] },
  skinTexture: { label: "Texture", sweep: "skin-texture", section: "skin" },
  skinFinish: { label: "Finish", sweep: "skin-texture", section: "skin" },
  eyeColor: { label: "Eyes", sweep: "eyes", section: "hair" },
  hairColor: { label: "Hair", sweep: "hair-color", section: "hair" },
  hairStyle: { label: "Style", sweep: "hair-style", section: "hair" },
  hairLength: { label: "Length", sweep: "hair-style", section: "hair" },
  hairTexture: { label: "Hair texture", sweep: "hair-style", section: "hair" },
  hairFringe: { label: "Bangs", sweep: "hair-style", section: "hair" },
  facialHair: { label: "Facial hair", sweep: "hair-style", section: "hair" },
  features: { label: "Details", sweep: "brand", section: "basics" },
};

function isMeaningful(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

// ── Props ─────────────────────────────────────

interface ControlPanelProps {
  user: { role?: string } | null;
  isFormValid: boolean;
  genState: GenerationState;
  currentAssets: GeneratedAsset[];
  handleGenerate: () => void;
  isReadOnly?: boolean;
  onNewModel?: () => void;
  modelName?: string;
}

// ── Progress Ring ────────────────────────────

function CastingProgressRing({ completions }: { completions: Record<string, number> }) {
  const values = Object.values(completions);
  const overall = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const pct = Math.round(overall * 100);
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (overall * circumference);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 40, height: 40 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="3" />
        <circle
          cx="20" cy="20" r={r} fill="none"
          stroke={pct === 100 ? '#1a1a1a' : '#71716A'}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s' }}
        />
      </svg>
      <span
        className="absolute"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: pct === 100 ? '#1a1a1a' : '#52524B',
          fontFamily: 'ui-monospace, monospace',
          transition: 'color 0.3s',
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────

export function ControlPanel({
  user, isFormValid, genState, currentAssets, handleGenerate,
  isReadOnly, onNewModel, modelName,
}: ControlPanelProps) {
  // Use store's functional updaters — no stale closure risk
  const prefs = useCastingFormStore((s) => s.prefs);
  const updatePref = useCastingFormStore((s) => s.updatePref);
  const updatePrefs = useCastingFormStore((s) => s.updatePrefs);
  const setPrefs = useCastingFormStore((s) => s.setPrefs);
  const engineChoice = useCastingFormStore((s) => s.engineChoice);
  const { showMobilePanel } = useCastingUIStore();

  const [showAdvancedFace, setShowAdvancedFace] = useState(false);
  const [showAdvancedHair, setShowAdvancedHair] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basics: true, physique: false, face: false, skin: false, hair: false,
  });
  const toggleSection = (id: string) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Parse choreography (D-41): the sentence is SEEN becoming the form ──
  const [parseSummary, setParseSummary] = useState<ParseSummary | null>(null);

  const jumpToField = useCallback((sweep: string) => {
    const el = document.querySelector(`[data-sweep-field="${sweep}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("parse-sweep");
    void (el as HTMLElement).offsetWidth; // restart the pulse animation
    el.classList.add("parse-sweep");
    setTimeout(() => el.classList.remove("parse-sweep"), 950);
  }, []);

  const runSweep = useCallback((targets: string[]) => {
    const unique = Array.from(new Set(targets));
    if (unique.length === 0) return;
    const stagger = Math.min(120, 600 / unique.length);
    unique.forEach((sweep, i) => {
      setTimeout(() => {
        const el = document.querySelector(`[data-sweep-field="${sweep}"]`);
        if (!el) return;
        if (i === 0) el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("parse-sweep");
        setTimeout(() => el.classList.remove("parse-sweep"), 950);
      }, i * stagger);
    });
  }, []);

  const handleParsed = useCallback(
    (result: ParsePromptResult) => {
      // 1. Apply what was heard
      updatePrefs(result.preferences as Partial<ModelPreferences>);
      // 2. Everything required and still open is the engine's (D-41)
      const engineFields = useCastingFormStore.getState().markUnsetRequiredAsEngineChoice();

      // 3. Chips + sweep targets from the meaningful parsed fields
      const chips: ParsedChip[] = [];
      const sweeps: string[] = [];
      const sections: Record<string, boolean> = {};
      let anyAdvancedFace = false;
      for (const [key, meta] of Object.entries(PARSE_FIELD_META)) {
        const value = (result.preferences as Record<string, unknown>)[key];
        if (!isMeaningful(value)) continue;
        const display = meta.format ? meta.format(value, prefs) : String(value);
        if (display === null) continue;
        chips.push({ sweep: meta.sweep, label: meta.label, value: display });
        sweeps.push(meta.sweep);
        sections[meta.section] = true;
        if (meta.advancedFace) anyAdvancedFace = true;
      }

      // 4. Panel shows the changes: affected sections open, sweep runs
      if (Object.keys(sections).length > 0) {
        setOpenSections((prev) => ({ ...prev, ...sections }));
      }
      if (anyAdvancedFace) setShowAdvancedFace(true);
      setParseSummary({
        chips,
        engineFields: engineFields.map((f) => REQUIRED_FIELD_LABELS[f] ?? f),
      });
      requestAnimationFrame(() => runSweep(sweeps));

      // 5. Two keystrokes: the armed Cast button takes focus — Enter fires it
      setTimeout(() => {
        document.querySelector<HTMLButtonElement>("[data-debug-generate]")?.focus();
      }, 750);
    },
    [prefs, runSweep, updatePrefs],
  );

  const ethnicityBlend = prefs.ethnicityBlend || [];
  const setEthnicityBlend = (blend: { name: string; pct: number }[]) => {
    const legacyStr = blend.map(e => e.name).join(', ');
    updatePrefs({ ethnicityBlend: blend, ethnicity: legacyStr });
  };

  const currentHairFamilies = useMemo(() => {
    const g = prefs.gender || 'Female';
    return Object.entries(HAIR_STYLE_CONFIG)
      .filter(([, cfg]) => cfg.gender.includes(g as 'Female' | 'Male' | 'Non-Binary'))
      .map(([name]) => name);
  }, [prefs.gender]);

  const activeHairConfig = prefs.hairStyle ? HAIR_STYLE_CONFIG[prefs.hairStyle] : null;

  // Engine's-choice delegation counts as complete (D-41)
  const ec = engineChoice;
  const completions = {
    basics: [
      prefs.castingBrand || ec.castingBrand,
      prefs.gender || ec.gender,
      prefs.age || ec.age,
      ethnicityBlend.length > 0 || ec.ethnicity,
    ].filter(Boolean).length / 4,
    physique: prefs.bodyType ? 1 : 0,
    face: [prefs.faceShape, prefs.eyebrowStyle].filter(Boolean).length / 2,
    skin: prefs.skinTone || ec.skinTone ? 1 : 0,
    hair: [
      prefs.eyeColor || ec.eyeColor,
      prefs.hairColor || ec.hairColor,
      prefs.hairStyle || ec.hairStyle,
    ].filter(Boolean).length / 3,
  };

  const handleDebugFill = () => {
    const randomPrefs = generateRandomPreferences();
    updatePrefs(randomPrefs);
    toast.success('Debug: Form populated with random preferences');
  };

  return (
    <div className={`
      ${showMobilePanel ? 'fixed inset-0 z-50 pt-11' : 'hidden'}
      lg:relative lg:flex lg:flex-col lg:pt-0
      h-full flex flex-col
    `}
      style={{ background: '#F5F3F0' }}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1a1a1a' }}>
              {isReadOnly ? (modelName || 'Cast Model') : 'Casting'}
            </div>
            <div style={{ fontSize: 12, color: '#52524B' }}>
              {isReadOnly ? 'Identity locked' : 'Build your model from scratch'}
            </div>
          </div>
          {isReadOnly ? (
            <div className="flex items-center justify-center" style={{ width: 40, height: 40 }}>
              <Lock size={16} strokeWidth={1.5} style={{ color: '#71716A' }} />
            </div>
          ) : (
            <CastingProgressRing completions={completions} />
          )}
        </div>
      </div>

      {/* Parse-sweep pulse (D-41) — one style block, canvas-language ink */}
      <style>{`
        @keyframes parseSweepPulse {
          0% { box-shadow: 0 0 0 1px rgba(10,10,10,0); }
          25% { box-shadow: 0 0 0 1px rgba(10,10,10,0.85); }
          100% { box-shadow: 0 0 0 1px rgba(10,10,10,0); }
        }
        [data-sweep-field] { border-radius: 10px; }
        [data-sweep-field].parse-sweep { animation: parseSweepPulse 900ms ease; }
      `}</style>

      {/* From prompt — the create-path parser entry (D-33/R2/D-41) */}
      {!isReadOnly && <FromPromptField onParsed={handleParsed} />}

      {/* What was heard, where the action happened (D-40) */}
      {!isReadOnly && parseSummary && (
        <ParseSummaryStrip
          summary={parseSummary}
          onJump={jumpToField}
          onDismiss={() => setParseSummary(null)}
        />
      )}

      <SummaryStrip prefs={prefs as unknown as Record<string, unknown>} ethnicityBlend={ethnicityBlend} />

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="mx-4 mb-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(26,26,26,0.04)', border: '1px solid rgba(26,26,26,0.06)' }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: '#52524B', lineHeight: 1.5 }}>
            This model has been cast and their identity is locked. You can still export or dress them.
          </p>
        </div>
      )}

      {/* Scrollable Content */}
      <div
        className="flex-1 overflow-y-auto min-h-0 custom-scrollbar"
        style={isReadOnly ? { pointerEvents: 'none', opacity: 0.4 } : undefined}
      >

        {/* ═══ CASTING BASICS ═══ */}
        <CollapsibleSection id="basics" title="Casting Basics" icon={<Palette size={12} strokeWidth={1.8} />} isOpen={openSections.basics} onToggle={toggleSection} completionRatio={completions.basics}>
          <div className="space-y-4">
            <div data-sweep-field="brand">
              <div className="flex items-center justify-between">
                <FieldLabel filled={!!prefs.castingBrand || !!ec.castingBrand}>Brand Direction</FieldLabel>
                <EngineChoiceChip field="castingBrand" />
              </div>
              <BrandSelector
                value={prefs.castingBrand}
                onChange={(v) => updatePref('castingBrand', v)}
              />
            </div>

            <div className="pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }} data-sweep-field="vibe">
              <TriBlendSelector
                value={prefs.castingVibe || { commercial: 0.34, editorial: 0.33, runway: 0.33 }}
                onChange={(val) => updatePref('castingVibe', val)}
              />
            </div>

            <div className="pt-4 space-y-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="space-y-2" data-sweep-field="gender">
                <div className="flex items-center justify-between">
                  <FieldLabel filled={!!prefs.gender || !!ec.gender}>Gender</FieldLabel>
                  <EngineChoiceChip field="gender" />
                </div>
                <OptionGrid cols={3} options={["Female", "Male", "Non-Binary"]} selected={prefs.gender}
                  onSelect={(val) => {
                    if (val !== prefs.gender) {
                      updatePrefs({ gender: val, hairStyle: '', hairFade: '', facialHair: '' });
                    } else updatePref('gender', val);
                  }}
                />
              </div>
              <div className="space-y-2" data-sweep-field="age">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#52524B' }}>Age</span>
                    <EngineChoiceChip field="age" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: prefs.age ? '#1a1a1a' : '#a1a19a' }}>
                    {prefs.age || (ec.age ? "Engine's choice" : '—')}
                  </span>
                </div>
                <input type="range" min="18" max="85" step="1" value={prefs.age || "23"}
                  onChange={(e) => updatePref('age', e.target.value)}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ background: '#E8E4DF', accentColor: '#1a1a1a' }}
                />
              </div>
            </div>

            <div className="pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }} data-sweep-field="ethnicity">
              <div className="flex items-center justify-between">
                <FieldLabel filled={ethnicityBlend.length > 0 || !!ec.ethnicity}>Ethnicity</FieldLabel>
                <EngineChoiceChip field="ethnicity" />
              </div>
              <EthnicityBlender selected={ethnicityBlend} onChange={setEthnicityBlend} />
            </div>
          </div>
        </CollapsibleSection>

        {/* ═══ PHYSIQUE ═══ */}
        <CollapsibleSection id="physique" title="Physique" icon={<Dumbbell size={12} strokeWidth={1.8} />} isOpen={openSections.physique} onToggle={toggleSection} completionRatio={completions.physique}>
          <div data-sweep-field="body">
            <OptionGrid cols={2} options={["Ultra Thin", "Slim", "Athletic", "Muscular", "Curvy", "Petite"]}
              selected={prefs.bodyType || "Slim"} onSelect={(val) => updatePref('bodyType', val)} />
          </div>
        </CollapsibleSection>

        {/* ═══ FACE STRUCTURE ═══ */}
        <CollapsibleSection id="face" title="Face Structure" icon={<ScanFace size={12} strokeWidth={1.8} />} isOpen={openSections.face} onToggle={toggleSection} completionRatio={completions.face}>
          <div className="space-y-5">
            <div className="space-y-2" data-sweep-field="face-shape">
              <FieldLabel>Face Shape</FieldLabel>
              <OptionGrid options={["Oval", "Round", "Square", "Heart", "Diamond", "Auto"]}
                selected={prefs.faceShape || "Auto"} onSelect={(val) => updatePref('faceShape', val)} showAutoReset />
            </div>
            <div className="space-y-2" data-sweep-field="brows">
              <FieldLabel>Eyebrow Style</FieldLabel>
              <OptionGrid options={CHAR_OPTIONS.eyebrows} selected={prefs.eyebrowStyle || "Auto"}
                onSelect={(val) => updatePref('eyebrowStyle', val)} cols={2} showAutoReset />
            </div>
            <button onClick={() => setShowAdvancedFace(!showAdvancedFace)}
              className="flex items-center gap-1.5 transition-colors"
              style={{ fontSize: 11, fontWeight: 600, color: '#71716A', letterSpacing: '0.04em', background: 'none', border: 'none', cursor: 'pointer' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                style={{ transform: showAdvancedFace ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {showAdvancedFace ? 'LESS' : 'ADVANCED'}
            </button>
            {showAdvancedFace && (
              <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 duration-200" data-sweep-field="face-advanced">
                <WarmSelectControl label="Jawline" options={CHAR_OPTIONS.jawline} value={prefs.jawline || ""} onChange={v => updatePref('jawline', v)} />
                <WarmSelectControl label="Cheekbones" options={CHAR_OPTIONS.cheekbones} value={prefs.cheekbones || ""} onChange={v => updatePref('cheekbones', v)} />
                <WarmSelectControl label="Cheek Shape" options={CHAR_OPTIONS.cheeks} value={prefs.cheeks || ""} onChange={v => updatePref('cheeks', v)} />
                <WarmSelectControl label="Eye Shape" options={CHAR_OPTIONS.eyeShape} value={prefs.eyeShape || ""} onChange={v => updatePref('eyeShape', v)} />
                <WarmSelectControl label="Nose Shape" options={CHAR_OPTIONS.noseShape} value={prefs.noseShape || ""} onChange={v => updatePref('noseShape', v)} />
                <WarmSelectControl label="Lip Shape" options={CHAR_OPTIONS.lipShape} value={prefs.lipShape || ""} onChange={v => updatePref('lipShape', v)} />
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* ═══ SKIN & COMPLEXION ═══ */}
        <CollapsibleSection id="skin" title="Skin & Complexion" icon={<Droplets size={12} strokeWidth={1.8} />} isOpen={openSections.skin} onToggle={toggleSection} completionRatio={completions.skin}>
          <div className="space-y-5">
            <div className="space-y-2" data-sweep-field="skin-tone">
              <div className="flex items-center justify-between">
                <FieldLabel filled={!!prefs.skinTone || !!ec.skinTone}>Skin Tone</FieldLabel>
                <EngineChoiceChip field="skinTone" />
              </div>
              <SkinToneGrid selected={prefs.skinTone || ''} onSelect={(v) => updatePref('skinTone', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3" data-sweep-field="skin-texture">
              <WarmSelectControl label="Texture" options={SKIN_TEXTURES} value={prefs.skinTexture || 'Raw / Standard'} onChange={v => updatePref('skinTexture', v)} />
              <WarmSelectControl label="Finish" options={SKIN_FINISHES} value={prefs.skinFinish || 'Natural'} onChange={v => updatePref('skinFinish', v)} />
            </div>
          </div>
        </CollapsibleSection>

        {/* ═══ EYES & HAIR ═══ */}
        <CollapsibleSection id="hair" title="Eyes & Hair" icon={<Scissors size={12} strokeWidth={1.8} />} isOpen={openSections.hair} onToggle={toggleSection} completionRatio={completions.hair}>
          <div className="space-y-5">
            <div className="space-y-2" data-sweep-field="eyes">
              <div className="flex items-center justify-between">
                <FieldLabel filled={!!prefs.eyeColor || !!ec.eyeColor}>Iris Color</FieldLabel>
                <EngineChoiceChip field="eyeColor" />
              </div>
              <EyeGrid selected={prefs.eyeColor} onSelect={(val) => updatePref('eyeColor', val)} />
            </div>

            <div className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }} data-sweep-field="hair-color">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <FieldLabel filled={!!prefs.hairColor || !!ec.hairColor}>Hair Color</FieldLabel>
                  <EngineChoiceChip field="hairColor" />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: prefs.hairColor ? '#52524B' : '#a1a19a' }}>
                  {prefs.hairColor || (ec.hairColor ? "Engine's choice" : "")}
                </span>
              </div>
              <HairColorWheel currentColor={prefs.hairColor || "Natural"} onColorSelect={(c) => updatePref('hairColor', c)} />
            </div>

            <div className="space-y-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }} data-sweep-field="hair-style">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabel filled={!!prefs.hairStyle || !!ec.hairStyle}>Style</FieldLabel>
                  <EngineChoiceChip field="hairStyle" />
                </div>
                <OptionGrid cols={2} options={currentHairFamilies} selected={prefs.hairStyle || ''}
                  onSelect={(val) => {
                    const cfg = HAIR_STYLE_CONFIG[val];
                    updatePrefs({
                      hairStyle: val,
                      hairLength: cfg?.defaultLength || '', hairTexture: cfg?.defaultTexture || '',
                      hairFringe: cfg?.defaultFringe || '', hairParting: '', hairVolume: '',
                      hairTuck: '', hairFlyaways: '', hairFade: '',
                    });
                  }}
                />
              </div>

              {activeHairConfig && (
                <div className="space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {activeHairConfig.lengths && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#52524B', marginBottom: 5 }}>Length</div>
                      <ChipRow options={activeHairConfig.lengths} selected={prefs.hairLength || ''} onSelect={v => updatePref('hairLength', v)} />
                    </div>
                  )}
                  {activeHairConfig.textures && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#52524B', marginBottom: 5 }}>Texture</div>
                      <ChipRow options={activeHairConfig.textures} selected={prefs.hairTexture || ''} onSelect={v => updatePref('hairTexture', v)} />
                    </div>
                  )}
                  {activeHairConfig.fringes && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#52524B', marginBottom: 5 }}>Bangs</div>
                      <ChipRow options={activeHairConfig.fringes} selected={prefs.hairFringe || ''} onSelect={v => updatePref('hairFringe', v)} />
                    </div>
                  )}

                  {(activeHairConfig.partings || activeHairConfig.volumes || prefs.gender === 'Male') && (
                    <>
                      <button onClick={() => setShowAdvancedHair(!showAdvancedHair)}
                        className="flex items-center gap-1.5 transition-colors"
                        style={{ fontSize: 11, fontWeight: 600, color: '#71716A', letterSpacing: '0.04em', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                          style={{ transform: showAdvancedHair ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        {showAdvancedHair ? 'LESS' : 'MORE'}
                      </button>
                      {showAdvancedHair && (
                        <div className="space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                          {activeHairConfig.partings && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 500, color: '#52524B', marginBottom: 5 }}>Parting</div>
                              <ChipRow options={activeHairConfig.partings} selected={prefs.hairParting || ''} onSelect={v => updatePref('hairParting', v)} />
                            </div>
                          )}
                          {activeHairConfig.volumes && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 500, color: '#52524B', marginBottom: 5 }}>Volume</div>
                              <ChipRow options={activeHairConfig.volumes} selected={prefs.hairVolume || ''} onSelect={v => updatePref('hairVolume', v)} />
                            </div>
                          )}
                          <WarmSelectControl label="Flyaways" options={["None", "Natural", "Intentional"]} value={prefs.hairFlyaways || ""} onChange={v => updatePref('hairFlyaways', v)} />
                          <WarmSelectControl label="Tuck" options={HAIR_TUCKS} value={prefs.hairTuck || ""} onChange={v => updatePref('hairTuck', v)} />
                          {prefs.gender === 'Male' && (
                            <WarmSelectControl label="Facial Hair" options={CHAR_OPTIONS.facialHair} value={prefs.facialHair || ""} onChange={v => updatePref('facialHair', v)} />
                          )}
                          {(prefs.gender === 'Male' || prefs.hairStyle?.includes('Fade') || prefs.hairStyle?.includes('Buzz')) && (
                            <WarmSelectControl label="Fade / Taper" options={HAIR_FADES} value={prefs.hairFade || ""} onChange={v => updatePref('hairFade', v)} />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 -4px 16px rgba(0,0,0,0.03)' }}>
        {isReadOnly ? (
          <button
            onClick={onNewModel}
            className="w-full py-3.5 rounded-xl transition-all duration-300"
            style={{
              background: '#1a1a1a',
              color: '#FAFAFA',
              fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Plus size={14} strokeWidth={2} />
            <span>New Model</span>
          </button>
        ) : (
          <>
            {prefs.referenceImage && (
              <div className="mb-3 px-3 py-2 rounded-lg" style={{ background: '#F5F3F0', fontSize: 12, color: '#52524B', lineHeight: 1.5 }}>
                Reference will be used for feature transfer on next iteration. Press F to toggle visibility.
              </div>
            )}

            <button
              data-debug-generate
              onClick={handleGenerate}
              disabled={genState.isGenerating || !isFormValid}
              className="w-full py-3.5 rounded-xl transition-all duration-300"
              style={{
                background: !genState.isGenerating && isFormValid ? '#1a1a1a' : '#E8E4DF',
                color: !genState.isGenerating && isFormValid ? '#FAFAFA' : '#aaa',
                fontSize: 15, fontWeight: 600,
                cursor: !genState.isGenerating && isFormValid ? 'pointer' : 'not-allowed',
                boxShadow: !genState.isGenerating && isFormValid ? '0 4px 24px rgba(0,0,0,0.12)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: isFormValid ? 1 : 0.5,
              }}
            >
              {genState.isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{genState.currentStep || 'Casting...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} strokeWidth={2} />
                  <span>{isFormValid ? (currentAssets.length > 0 ? 'Recast Model' : 'Cast Model') : 'Fill Required Fields'}</span>
                  {isFormValid && (
                    // Cost visible on the armed button (D-15/D-41): the
                    // confirm-glance before the second keystroke
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(240,237,232,0.6)', marginLeft: 2 }}>
                      · ~{CREDIT_COSTS.castingImage} credits
                    </span>
                  )}
                </>
              )}
            </button>

            <button
              onClick={() => {
                const randomPrefs = generateRandomPreferences();
                updatePrefs(randomPrefs);
                toast('Preferences randomized', { duration: 1500 });
              }}
              disabled={genState.isGenerating}
              className="w-full mt-2 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, color: '#71716A', letterSpacing: '0.02em' }}
            >
              <Dices size={10} strokeWidth={1.8} style={{ opacity: 0.6 }} />
              Randomize
            </button>

            {user?.role === 'admin' && (
              <details className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.05)] group">
                <summary className="text-[11px] text-[#52524B] cursor-pointer hover:text-[#1a1a1a] transition-colors flex items-center gap-1.5 select-none">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                    className="transition-transform group-open:rotate-90"><polyline points="9 18 15 12 9 6" /></svg>
                  Admin Tools
                </summary>
                <div className="mt-2 flex gap-2">
                  <button onClick={handleDebugFill} disabled={genState.isGenerating}
                    className="flex-1 py-1.5 rounded-xl transition-all disabled:opacity-50"
                    style={{ background: '#ffffff', fontSize: 11, fontWeight: 500, color: '#52524B', cursor: 'pointer', border: '1px solid #E8E4DF' }}>
                    Random Fill
                  </button>
                  <button
                    onClick={() => {
                      const randomPrefs = generateRandomPreferences();
                      updatePrefs(randomPrefs);
                      toast.success('Auto-generating model...');
                      setTimeout(() => {
                        const btn = document.querySelector('[data-debug-generate]') as HTMLButtonElement;
                        if (btn && !btn.disabled) btn.click();
                      }, 200);
                    }}
                    disabled={genState.isGenerating}
                    className="flex-1 py-1.5 rounded-xl transition-all disabled:opacity-50"
                    style={{ background: '#ffffff', fontSize: 11, fontWeight: 500, color: '#52524B', cursor: 'pointer', border: '1px solid #E8E4DF' }}>
                    Auto Generate
                  </button>
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
