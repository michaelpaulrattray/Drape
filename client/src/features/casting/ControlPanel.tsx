import { useState, useMemo } from "react";
import { Loader2, Palette, Dumbbell, ScanFace, Droplets, Scissors, Sparkles, Dices, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import TriBlendSelector from "./components/TriBlendSelector";
import HairColorWheel from "./components/HairColorWheel";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";
import { generateRandomPreferences } from "./castingHelpers";
import { type GenerationState, type GeneratedAsset, BRAND_OPTIONS, SKIN_TEXTURES, SKIN_FINISHES, CHAR_OPTIONS } from "@/features/casting/constants";
import { HAIR_STYLE_CONFIG, HAIR_TUCKS, HAIR_FADES } from "./hairStyleConfig";
import {
  FieldLabel, ChipRow, OptionGrid, WarmSelectControl, EyeGrid,
  EthnicityBlender, CollapsibleSection, SummaryStrip, SkinToneGrid,
} from "./components/WarmPrimitives";

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
          stroke={pct === 100 ? '#1a1a1a' : '#c4c0b8'}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s' }}
        />
      </svg>
      <span
        className="absolute"
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: pct === 100 ? '#1a1a1a' : '#b8b3a8',
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
  const { showMobilePanel } = useCastingUIStore();

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
    <div className={`
      ${showMobilePanel ? 'fixed inset-0 z-50 pt-11' : 'hidden'}
      lg:relative lg:flex lg:flex-col lg:pt-0
      h-full flex flex-col
    `}
      style={{ background: '#faf8f5' }}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>
              {isReadOnly ? (modelName || 'Cast Model') : 'Casting'}
            </div>
            <div style={{ fontSize: 10, color: '#b8b3a8' }}>
              {isReadOnly ? 'Identity locked' : 'Build your model from scratch'}
            </div>
          </div>
          {isReadOnly ? (
            <div className="flex items-center justify-center" style={{ width: 40, height: 40 }}>
              <Lock size={16} strokeWidth={1.5} style={{ color: '#c4c0b8' }} />
            </div>
          ) : (
            <CastingProgressRing completions={completions} />
          )}
        </div>
      </div>

      <SummaryStrip prefs={prefs as unknown as Record<string, unknown>} ethnicityBlend={ethnicityBlend} />

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="mx-4 mb-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(26,26,26,0.04)', border: '1px solid rgba(26,26,26,0.06)' }}>
          <p style={{ fontSize: 10, fontWeight: 500, color: '#999', lineHeight: 1.5 }}>
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
        <CollapsibleSection id="physique" title="Physique" icon={<Dumbbell size={12} strokeWidth={1.8} />} isOpen={openSections.physique} onToggle={toggleSection} completionRatio={completions.physique}>
          <OptionGrid cols={2} options={["Ultra Thin", "Slim", "Athletic", "Muscular", "Curvy", "Petite"]}
            selected={prefs.bodyType || "Slim"} onSelect={(val) => updatePref('bodyType', val)} />
        </CollapsibleSection>

        {/* ═══ FACE STRUCTURE ═══ */}
        <CollapsibleSection id="face" title="Face Structure" icon={<ScanFace size={12} strokeWidth={1.8} />} isOpen={openSections.face} onToggle={toggleSection} completionRatio={completions.face}>
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
        <CollapsibleSection id="skin" title="Skin & Complexion" icon={<Droplets size={12} strokeWidth={1.8} />} isOpen={openSections.skin} onToggle={toggleSection} completionRatio={completions.skin}>
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
        <CollapsibleSection id="hair" title="Eyes & Hair" icon={<Scissors size={12} strokeWidth={1.8} />} isOpen={openSections.hair} onToggle={toggleSection} completionRatio={completions.hair}>
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
        {isReadOnly ? (
          <button
            onClick={onNewModel}
            className="w-full py-3.5 rounded-xl transition-all duration-300"
            style={{
              background: '#1a1a1a',
              color: '#f0ede8',
              fontSize: 13, fontWeight: 600,
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
              <div className="mb-3 px-3 py-2 rounded-lg" style={{ background: '#f9f8f5', fontSize: 10, color: '#b8b3a8', lineHeight: 1.5 }}>
                Reference will be used for feature transfer on next iteration. Press F to toggle visibility.
              </div>
            )}

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
                  <Sparkles size={14} strokeWidth={2} />
                  <span>{isFormValid ? (currentAssets.length > 0 ? 'Recast Model' : 'Cast Model') : 'Fill Required Fields'}</span>
                  {isFormValid && (
                    <span style={{ fontSize: 8, fontWeight: 500, color: 'rgba(240,237,232,0.45)', marginLeft: 4, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' }}>
                      {navigator.platform?.includes('Mac') ? '⌘G' : 'Ctrl+G'}
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 500, color: '#c4c0b8', letterSpacing: '0.02em' }}
            >
              <Dices size={10} strokeWidth={1.8} style={{ opacity: 0.6 }} />
              Randomize
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
          </>
        )}
      </div>
    </div>
  );
}
