import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import TriBlendSelector from "./components/TriBlendSelector";
import HairColorWheel from "./components/HairColorWheel";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";
import { generateRandomPreferences } from "./castingHelpers";
import { ImageResolution, type GenerationState, type GeneratedAsset } from "@/features/casting/constants";
import { HAIR_STYLE_CONFIG, HAIR_TUCKS, HAIR_FADES } from "./hairStyleConfig";
import {
  FieldLabel, ChipRow, OptionGrid, WarmSelectControl, EyeGrid,
  EthnicityBlender, CollapsibleSection, SummaryStrip, SkinToneGrid,
} from "./components/WarmPrimitives";

// ── Data ──────────────────────────────────────

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

const SKIN_TEXTURES = ["Raw / Standard", "Glass / Perfect", "Freckled", "Textured / Acneic", "Mature"];
const SKIN_FINISHES = ["Natural", "Matte / Powdered", "Dewy / Sweat", "Oily"];

const CHAR_OPTIONS = {
  jawline: ["Sharp / Chiseled", "Soft / Rounded", "Strong / Pronounced", "Receding / Weak", "Snatched"],
  cheekbones: ["High", "Defined", "Soft"],
  cheeks: ["Slightly Hollow", "Full", "Balanced"],
  eyeShape: ["Thin Almond", "Monolids", "Wide-Set", "Round", "Hooded"],
  noseShape: ["Thin", "Straight Bridge", "Rounded", "Prominent", "Button"],
  lipShape: ["Full", "Subtle", "Lip Lift", "Wide", "Cupid's Bow"],
  eyebrows: ["Brushed Up", "Straight", "Arched", "Bold", "Bleached", "Auto"],
  facialHair: ["Clean Shaven", "Stubble", "Short Beard", "Full Beard"],
};

// ── Props ─────────────────────────────────────

interface ControlPanelProps {
  user: { role?: string } | null;
  isFormValid: boolean;
  genState: GenerationState;
  currentAssets: GeneratedAsset[];
  handleGenerate: () => void;
}

// ── Main Component ────────────────────────────

export function ControlPanel({
  user, isFormValid, genState, currentAssets, handleGenerate,
}: ControlPanelProps) {
  // Use store's functional updaters — no stale closure risk
  const prefs = useCastingFormStore((s) => s.prefs);
  const updatePref = useCastingFormStore((s) => s.updatePref);
  const updatePrefs = useCastingFormStore((s) => s.updatePrefs);
  const setPrefs = useCastingFormStore((s) => s.setPrefs);
  const { showMobilePanel, resolution, setResolution } = useCastingUIStore();

  const [showAdvancedFace, setShowAdvancedFace] = useState(false);
  const [showAdvancedHair, setShowAdvancedHair] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basics: true, physique: false, face: false, skin: false, hair: false,
  });
  const toggleSection = (id: string) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

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

  const completions = {
    basics: [prefs.castingBrand, prefs.gender, prefs.age, ethnicityBlend.length > 0].filter(Boolean).length / 4,
    physique: prefs.bodyType ? 1 : 0,
    face: [prefs.faceShape, prefs.eyebrowStyle].filter(Boolean).length / 2,
    skin: prefs.skinTone ? 1 : 0,
    hair: [prefs.eyeColor, prefs.hairColor, prefs.hairStyle].filter(Boolean).length / 3,
  };

  const handleDebugFill = () => {
    const randomPrefs = generateRandomPreferences();
    updatePrefs(randomPrefs);
    toast.success('Debug: Form populated with random preferences');
  };

  return (
    <aside className={`
      ${showMobilePanel ? 'fixed inset-0 z-50 pt-11 flex flex-col' : 'hidden'}
      lg:relative lg:flex lg:flex-col lg:pt-0
      h-full flex-shrink-0 z-20
    `}
      style={{
        width: 300, background: '#fff',
        borderRadius: '0 18px 18px 0',
        boxShadow: '8px 0 40px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)',
      }}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>Casting</div>
        <div style={{ fontSize: 10, color: '#b8b3a8' }}>Build your model from scratch</div>
      </div>

      <SummaryStrip prefs={prefs as unknown as Record<string, unknown>} ethnicityBlend={ethnicityBlend} />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">

        {/* ═══ CASTING BASICS ═══ */}
        <CollapsibleSection id="basics" title="Casting Basics" isOpen={openSections.basics} onToggle={toggleSection} completionRatio={completions.basics}>
          <div className="space-y-4">
            <div>
              <FieldLabel>Brand Direction</FieldLabel>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {BRAND_OPTIONS.map(b => {
                  const sel = prefs.castingBrand === b.value;
                  return (
                    <button key={b.value} onClick={() => updatePref('castingBrand', b.value)}
                      className="rounded-xl text-center transition-all"
                      style={{ padding: '8px 4px 7px', background: sel ? '#1a1a1a' : '#f5f3ef', color: sel ? '#fff' : '#888', fontSize: 10, fontWeight: sel ? 600 : 400 }}>
                      <div>{b.value}</div>
                      <div style={{ fontSize: 8, fontWeight: 400, marginTop: 1, color: sel ? 'rgba(255,255,255,0.5)' : '#c4c0b8' }}>{b.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <TriBlendSelector
                value={prefs.castingVibe || { commercial: 0.34, editorial: 0.33, runway: 0.33 }}
                onChange={(val) => updatePref('castingVibe', val)}
              />
            </div>

            <div className="pt-4 space-y-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <OptionGrid cols={3} options={["Female", "Male", "Non-Binary"]} selected={prefs.gender || 'Female'}
                onSelect={(val) => {
                  if (val !== (prefs.gender || 'Female')) {
                    updatePrefs({ gender: val, hairStyle: '', hairFade: '', facialHair: '' });
                  } else updatePref('gender', val);
                }}
              />
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#999' }}>Age</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>{prefs.age || 23}</span>
                </div>
                <input type="range" min="18" max="85" step="1" value={prefs.age || "23"}
                  onChange={(e) => updatePref('age', e.target.value)}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ background: '#e8e5df', accentColor: '#1a1a1a' }}
                />
              </div>
            </div>

            <div className="pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <FieldLabel filled={ethnicityBlend.length > 0}>Ethnicity</FieldLabel>
              <EthnicityBlender selected={ethnicityBlend} onChange={setEthnicityBlend} />
            </div>
          </div>
        </CollapsibleSection>

        {/* ═══ PHYSIQUE ═══ */}
        <CollapsibleSection id="physique" title="Physique" isOpen={openSections.physique} onToggle={toggleSection} completionRatio={completions.physique}>
          <OptionGrid cols={2} options={["Ultra Thin", "Slim", "Athletic", "Muscular", "Curvy", "Petite"]}
            selected={prefs.bodyType || "Slim"} onSelect={(val) => updatePref('bodyType', val)} />
        </CollapsibleSection>

        {/* ═══ FACE STRUCTURE ═══ */}
        <CollapsibleSection id="face" title="Face Structure" isOpen={openSections.face} onToggle={toggleSection} completionRatio={completions.face}>
          <div className="space-y-5">
            <div className="space-y-2">
              <FieldLabel>Face Shape</FieldLabel>
              <OptionGrid options={["Oval", "Round", "Square", "Heart", "Diamond", "Auto"]}
                selected={prefs.faceShape || "Auto"} onSelect={(val) => updatePref('faceShape', val)} showAutoReset />
            </div>
            <div className="space-y-2">
              <FieldLabel>Eyebrow Style</FieldLabel>
              <OptionGrid options={CHAR_OPTIONS.eyebrows} selected={prefs.eyebrowStyle || "Auto"}
                onSelect={(val) => updatePref('eyebrowStyle', val)} cols={2} showAutoReset />
            </div>
            <button onClick={() => setShowAdvancedFace(!showAdvancedFace)}
              className="flex items-center gap-1.5 transition-colors"
              style={{ fontSize: 9, fontWeight: 600, color: '#bbb', letterSpacing: '0.04em', background: 'none', border: 'none', cursor: 'pointer' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                style={{ transform: showAdvancedFace ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {showAdvancedFace ? 'LESS' : 'ADVANCED'}
            </button>
            {showAdvancedFace && (
              <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
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
        <CollapsibleSection id="skin" title="Skin & Complexion" isOpen={openSections.skin} onToggle={toggleSection} completionRatio={completions.skin}>
          <div className="space-y-5">
            <div className="space-y-2">
              <FieldLabel filled={!!prefs.skinTone}>Skin Tone</FieldLabel>
              <SkinToneGrid selected={prefs.skinTone || ''} onSelect={(v) => updatePref('skinTone', v)} />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <WarmSelectControl label="Texture" options={SKIN_TEXTURES} value={prefs.skinTexture || 'Raw / Standard'} onChange={v => updatePref('skinTexture', v)} />
              <WarmSelectControl label="Finish" options={SKIN_FINISHES} value={prefs.skinFinish || 'Natural'} onChange={v => updatePref('skinFinish', v)} />
            </div>
          </div>
        </CollapsibleSection>

        {/* ═══ EYES & HAIR ═══ */}
        <CollapsibleSection id="hair" title="Eyes & Hair" isOpen={openSections.hair} onToggle={toggleSection} completionRatio={completions.hair}>
          <div className="space-y-5">
            <div className="space-y-2">
              <FieldLabel filled={!!prefs.eyeColor}>Iris Color</FieldLabel>
              <EyeGrid selected={prefs.eyeColor} onSelect={(val) => updatePref('eyeColor', val)} />
            </div>

            <div className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="flex justify-between items-center mb-2">
                <FieldLabel filled={!!prefs.hairColor}>Hair Color</FieldLabel>
                <span style={{ fontSize: 9, fontWeight: 500, color: '#555' }}>{prefs.hairColor || ""}</span>
              </div>
              <HairColorWheel currentColor={prefs.hairColor || "Natural"} onColorSelect={(c) => updatePref('hairColor', c)} />
            </div>

            <div className="space-y-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="space-y-2">
                <FieldLabel filled={!!prefs.hairStyle}>Style</FieldLabel>
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
                      <div style={{ fontSize: 9, fontWeight: 500, color: '#999', marginBottom: 5 }}>Length</div>
                      <ChipRow options={activeHairConfig.lengths} selected={prefs.hairLength || ''} onSelect={v => updatePref('hairLength', v)} />
                    </div>
                  )}
                  {activeHairConfig.textures && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 500, color: '#999', marginBottom: 5 }}>Texture</div>
                      <ChipRow options={activeHairConfig.textures} selected={prefs.hairTexture || ''} onSelect={v => updatePref('hairTexture', v)} />
                    </div>
                  )}
                  {activeHairConfig.fringes && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 500, color: '#999', marginBottom: 5 }}>Bangs</div>
                      <ChipRow options={activeHairConfig.fringes} selected={prefs.hairFringe || ''} onSelect={v => updatePref('hairFringe', v)} />
                    </div>
                  )}

                  {(activeHairConfig.partings || activeHairConfig.volumes || prefs.gender === 'Male') && (
                    <>
                      <button onClick={() => setShowAdvancedHair(!showAdvancedHair)}
                        className="flex items-center gap-1.5 transition-colors"
                        style={{ fontSize: 9, fontWeight: 600, color: '#bbb', letterSpacing: '0.04em', background: 'none', border: 'none', cursor: 'pointer' }}>
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
                              <div style={{ fontSize: 9, fontWeight: 500, color: '#999', marginBottom: 5 }}>Parting</div>
                              <ChipRow options={activeHairConfig.partings} selected={prefs.hairParting || ''} onSelect={v => updatePref('hairParting', v)} />
                            </div>
                          )}
                          {activeHairConfig.volumes && (
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 500, color: '#999', marginBottom: 5 }}>Volume</div>
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
      <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        {prefs.referenceImage && (
          <div className="mb-3 px-3 py-2 rounded-lg" style={{ background: '#f9f8f5', fontSize: 10, color: '#b8b3a8', lineHeight: 1.5 }}>
            Reference will be used for feature transfer on next iteration. Press F to toggle visibility.
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 9, fontWeight: 500, color: '#999' }}>Quality</span>
          <div className="flex p-0.5 rounded-lg" style={{ background: '#f5f3ef', border: '1px solid rgba(0,0,0,0.04)' }}>
            {[ImageResolution.STD, ImageResolution.HIGH].map(r => (
              <button key={r} onClick={() => setResolution(r)}
                className="px-3 py-1 rounded-md transition-all"
                style={{ fontSize: 9, fontWeight: 600, background: resolution === r ? '#1a1a1a' : 'transparent', color: resolution === r ? '#fff' : '#999' }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <button
          data-debug-generate
          onClick={handleGenerate}
          disabled={genState.isGenerating || !isFormValid}
          className="w-full py-3.5 rounded-xl transition-all duration-300"
          style={{
            background: !genState.isGenerating && isFormValid ? '#1a1a1a' : '#e8e5df',
            color: !genState.isGenerating && isFormValid ? '#f0ede8' : '#aaa',
            fontSize: 13, fontWeight: 600,
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" /></svg>
              <span>{isFormValid ? (currentAssets.length > 0 ? 'Recast Model' : 'Cast Model') : 'Fill Required Fields'}</span>
            </>
          )}
        </button>

        {user?.role === 'admin' && (
          <details className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.05)] group">
            <summary className="text-[9px] text-[#b8b3a8] cursor-pointer hover:text-[#1a1a1a] transition-colors flex items-center gap-1.5 select-none">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                className="transition-transform group-open:rotate-90"><polyline points="9 18 15 12 9 6" /></svg>
              Admin Tools
            </summary>
            <div className="mt-2 flex gap-2">
              <button onClick={handleDebugFill} disabled={genState.isGenerating}
                className="flex-1 py-1.5 rounded-xl transition-all disabled:opacity-50"
                style={{ background: '#f5f3ef', fontSize: 9, fontWeight: 500, color: '#999', cursor: 'pointer', border: 'none' }}>
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
                style={{ background: '#f5f3ef', fontSize: 9, fontWeight: 500, color: '#999', cursor: 'pointer', border: 'none' }}>
                Auto Generate
              </button>
            </div>
          </details>
        )}
      </div>
    </aside>
  );
}
