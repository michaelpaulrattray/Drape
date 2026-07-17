import { useState, useEffect, useMemo, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { castingIdentityLabel, honestModelName } from './modelDisplayTruth';
import {
  resolvedEngineChoices,
  type RequiredCastField,
} from './engineChoicePersistence';
import { captureCastingSession } from './castingSessionToken';

// ============ Types ============

interface ProfileSection {
  label: string;
  items: { key: string; value: string; note?: string }[];
}

// Section heading — sentence case, no letter-spacing (§13.9)
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-canvas-xs font-medium text-canvas-ink-soft mb-1.5">{children}</div>
);

// ============ Main Component ============

export function MasterPromptPanel() {
  const prefs = useCastingFormStore((s) => s.prefs);
  const engineChoice = useCastingFormStore((s) => s.engineChoice);
  const updatePref = useCastingFormStore((s) => s.updatePref);
  const currentAssets = useCastingGenerationStore((s) => s.currentAssets);
  const currentModelId = useCastingGenerationStore((s) => s.currentModelId);
  const modelName = useCastingFormStore((s) => s.modelName);
  const currentMasterPrompt = useCastingGenerationStore((s) => s.currentMasterPrompt);
  const currentTechnicalSchema = useCastingGenerationStore((s) => s.currentTechnicalSchema);


  const [activeTab, setActiveTab] = useState<'profile' | 'spec'>('profile');
  const [specMode, setSpecMode] = useState<'natural' | 'json'>('natural');
  const [isCopied, setIsCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelQuery = trpc.models.get.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: currentModelId != null, staleTime: 0 },
  );
  const resolvedByField = useMemo(
    () => new Map(
      resolvedEngineChoices(currentTechnicalSchema, engineChoice)
        .map((item) => [item.field, item] as const),
    ),
    [currentTechnicalSchema, engineChoice],
  );

  useEffect(() => { setIsCopied(false); }, [specMode, currentMasterPrompt]);

  // Trigger reference analysis immediately when a reference image is uploaded
  const analyzeReferenceMutation = trpc.generation.analyzeReference.useMutation();
  const setSuggestions = useCastingGenerationStore((s) => s.setSuggestions);
  const setIsLoadingSuggestions = useCastingGenerationStore((s) => s.setIsLoadingSuggestions);
  const prevRefImage = useRef<string | undefined>(undefined);
  useEffect(() => {
    const refImage = prefs.referenceImage;
    if (refImage && refImage !== prevRefImage.current && currentAssets.length > 0) {
      const session = captureCastingSession(
        () => useCastingGenerationStore.getState().sessionToken,
      );
      const currentImageUrl = currentAssets.find((a) => a.viewType === 'frontClose')?.storageUrl;
      setIsLoadingSuggestions(true);
      analyzeReferenceMutation.mutateAsync({
        referenceImageBase64: refImage,
        currentModelImageBase64: currentImageUrl || undefined,
        masterPrompt: currentMasterPrompt || undefined,
      }).then((result) => {
        if (session.isCurrent() && result.attributes?.length) setSuggestions(result.attributes);
      }).catch(() => {
        // Silent fail — reference analysis is non-critical
      }).finally(() => {
        if (session.isCurrent()) setIsLoadingSuggestions(false);
      });
    }
    prevRefImage.current = refImage;
  }, [prefs.referenceImage, currentAssets.length]);

  // Don't render until there are assets
  if (currentAssets.length === 0) return null;

  const contentToCopy = specMode === 'natural'
    ? currentMasterPrompt
    : currentTechnicalSchema
      ? JSON.stringify(currentTechnicalSchema, null, 2)
      : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contentToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Reference upload handlers
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) updatePref('referenceImage', e.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const profileItem = (key: string, value: string | undefined, field?: RequiredCastField) => {
    if (value) return { key, value };
    const resolved = field ? resolvedByField.get(field) : undefined;
    return resolved
      ? { key, value: resolved.value, note: 'Resolved at casting' }
      : { key, value: '' };
  };

  // Build profile sections from prefs
  const profileSections: ProfileSection[] = [
    {
      label: 'Identity',
      items: [
        profileItem('Brand', prefs.castingBrand, 'castingBrand'),
        profileItem('Gender', prefs.gender, 'gender'),
        profileItem('Age', prefs.age, 'age'),
        profileItem('Ethnicity', prefs.ethnicity, 'ethnicity'),
        { key: 'Body', value: prefs.bodyType },
      ].filter((i) => i.value),
    },
    {
      label: 'Features',
      items: [
        { key: 'Face', value: prefs.faceShape },
        { key: 'Jawline', value: prefs.jawline },
        { key: 'Cheekbones', value: prefs.cheekbones },
        { key: 'Nose', value: prefs.noseShape },
        { key: 'Lips', value: prefs.lipShape },
        { key: 'Eyes', value: prefs.eyeShape },
        profileItem('Eye color', prefs.eyeColor, 'eyeColor'),
        { key: 'Brows', value: prefs.eyebrowStyle },
      ].filter((i) => i.value),
    },
    {
      label: 'Skin',
      items: [
        profileItem('Tone', prefs.skinTone, 'skinTone'),
        { key: 'Texture', value: prefs.skinTexture },
        { key: 'Finish', value: prefs.skinFinish },
      ].filter((i) => i.value),
    },
    {
      label: 'Hair',
      items: [
        profileItem('Color', prefs.hairColor, 'hairColor'),
        profileItem('Style', prefs.hairStyle, 'hairStyle'),
        { key: 'Length', value: prefs.hairLength },
        { key: 'Texture', value: prefs.hairTexture },
        { key: 'Volume', value: prefs.hairVolume },
        { key: 'Parting', value: prefs.hairParting },
        { key: 'Fringe', value: prefs.hairFringe },
        ...(prefs.facialHair ? [{ key: 'Facial hair', value: prefs.facialHair }] : []),
      ].filter((i) => i.value),
    },
    {
      label: 'Vibe',
      items: prefs.castingVibe
        ? (() => {
            const edgeVal = Math.round((1 - prefs.castingVibe.commercial) * 1000);
            const nonCom = prefs.castingVibe.editorial + prefs.castingVibe.runway;
            const heatVal = nonCom > 0.001 ? Math.round((prefs.castingVibe.runway / nonCom) * 1000) : 500;
            return [
              { key: 'Edge', value: String(edgeVal) },
              { key: 'Heat', value: String(heatVal) },
            ];
          })()
        : [],
    },
  ].filter((s) => s.items.length > 0);

  const headAsset = currentAssets.find((a) => a.viewType === 'frontClose');
  const viewCount = new Set(currentAssets.map((a) => a.viewType)).size;
  const honestName = honestModelName(modelName, modelQuery.data?.name);
  const identityLabel = castingIdentityLabel({
    status: modelQuery.data?.status,
    agencyId: modelQuery.data?.agencyId,
    pending: modelQuery.isLoading,
  });

  return (
    <div
      className="h-full flex flex-col overflow-hidden bg-canvas-surface"
      style={{ transition: 'width 0.22s ease' }}
    >
      {!isCollapsed ? (
        <>
          {/* Header + Tabs */}
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between mb-3">
              <div className="text-canvas-lg font-medium text-canvas-ink">
                {activeTab === 'profile' ? 'Profile' : 'Spec'}
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'spec' && (
                  <button
                    onClick={copyToClipboard}
                    className={cn('text-canvas-sm font-medium transition-colors', isCopied ? 'text-canvas-ink' : 'text-canvas-ink-faint hover:text-canvas-ink-soft')}
                  >
                    {isCopied ? 'Copied' : 'Copy'}
                  </button>
                )}
                <button
                  onClick={() => setIsCollapsed(true)}
                  title="Collapse panel"
                  className="flex items-center p-0.5 text-canvas-ink-soft hover:text-canvas-ink transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Profile/Spec — underline tabs (studio pattern, §6) */}
            <div className="flex gap-5 mb-0">
              {(['profile', 'spec'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'pb-2 text-canvas-sm transition-colors -mb-px border-b',
                    activeTab === tab
                      ? 'text-canvas-ink font-medium border-canvas-ink'
                      : 'text-canvas-ink-soft border-transparent hover:text-canvas-ink',
                  )}
                >
                  {tab === 'profile' ? 'Profile' : 'Spec'}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b-hairline border-canvas-border" />

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {activeTab === 'profile' ? (
              <div className="p-4 space-y-4">
                {/* Identity Card Header */}
                {headAsset && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-canvas-md overflow-hidden flex-shrink-0 border-hairline border-canvas-border">
                      <img src={headAsset.storageUrl} alt="Model" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-canvas-lg font-medium text-canvas-ink">
                        {honestName || identityLabel}
                      </div>
                      <div className="flex items-center gap-1.5 text-canvas-sm text-canvas-ink-soft">
                        {honestName && (
                          <>
                            <span>{identityLabel}</span>
                            <div className="w-[5px] h-[5px] rounded-full bg-canvas-ink" />
                          </>
                        )}
                        <span>
                          {viewCount} view{viewCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )}



                {/* Reference Image Section */}
                <div>
                  <SectionLabel>Reference</SectionLabel>
                  {prefs.referenceImage ? (
                    <div
                      className="relative group"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                    >
                      <div className={cn(
                        'relative rounded-canvas-md overflow-hidden border-hairline transition-colors',
                        isDragging ? 'border-canvas-ink' : 'border-canvas-border',
                      )}>
                        <img src={prefs.referenceImage} alt="Reference" className="w-full object-cover" style={{ maxHeight: 120 }} />
                        {isDragging && (
                          <div className="absolute inset-0 z-10 pointer-events-none bg-canvas-surface/90 flex items-center justify-center text-canvas-md font-medium text-canvas-ink">
                            Drop to replace
                          </div>
                        )}
                      </div>
                      <div className="mt-2 px-2.5 py-2 rounded-canvas-md bg-canvas-surface-inset text-canvas-sm text-canvas-ink-soft leading-normal">
                        <span className="font-medium">How to use:</span> name exactly what to take in the refine bar — e.g. "use the hairstyle from the reference" or "use the eye shape from the reference"
                        <div className="mt-1 text-canvas-ink-faint">
                          Press <span className="font-mono font-medium bg-canvas-border/40 px-[3px] rounded-sm">F</span> to toggle on canvas · Drag to reposition · Corner to resize
                        </div>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-[3px] rounded-canvas-sm bg-canvas-surface border-hairline border-canvas-border text-canvas-sm font-medium text-canvas-ink-soft"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => updatePref('referenceImage', undefined)}
                        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-[3px] rounded-canvas-sm bg-canvas-surface border-hairline border-canvas-border text-canvas-sm font-medium text-canvas-ink-soft"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={cn(
                          'cursor-pointer transition-colors text-center px-3 py-3.5 rounded-canvas-md',
                          isDragging
                            ? 'bg-canvas-surface-inset'
                            : 'bg-canvas-surface-inset/60 hover:bg-canvas-surface-inset',
                        )}
                        style={{
                          border: isDragging
                            ? '1px dashed var(--color-canvas-ink)'
                            : '1px dashed var(--color-canvas-border-strong)',
                        }}
                      >
                        <div className="w-7 h-7 rounded-canvas-sm mx-auto mb-1.5 bg-canvas-surface border-hairline border-canvas-border flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-canvas-ink-faint)" strokeWidth="1.5" strokeLinecap="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M3 15l6-6 4 4 4-4 4 4" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                          </svg>
                        </div>
                        <div className="text-canvas-md font-medium text-canvas-ink-soft">{isDragging ? 'Drop image' : 'Add reference'}</div>
                        <div className="text-canvas-sm text-canvas-ink-faint mt-0.5">Drop or click to browse</div>
                      </div>
                      <div className="mt-2 px-2.5 py-2 rounded-canvas-md bg-canvas-surface-inset text-canvas-sm text-canvas-ink-soft leading-normal">
                        Upload a photo of a hairstyle or facial feature you want to carry over. Then name exactly what to take in the refine bar — styling, accessories, and whole looks live on Canvas and Wardrobe.
                      </div>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
                </div>

                {/* Parameter Sections */}
                {profileSections.map((section) => (
                  <div key={section.label}>
                    <SectionLabel>{section.label}</SectionLabel>
                    <div className="space-y-0.5">
                      {section.items.map((item) => (
                        <div key={item.key} className="flex items-center justify-between py-1.5 px-2.5 rounded-canvas-sm bg-canvas-surface-inset">
                          <span className="text-canvas-md text-canvas-ink-soft">{item.key}</span>
                          <div className="text-right min-w-0 ml-3">
                            <div className="text-canvas-md font-medium text-canvas-ink-soft truncate">{item.value}</div>
                            {item.note && <div className="text-canvas-xs text-canvas-ink-faint">{item.note}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Casting Notes */}
                {prefs.features && (
                  <div>
                    <SectionLabel>Notes</SectionLabel>
                    <div className="px-2.5 py-2 rounded-canvas-sm bg-canvas-surface-inset text-canvas-md text-canvas-ink-soft leading-normal">
                      {prefs.features}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Spec Tab */
              <div className="p-4">
                <div className="flex gap-1.5 mb-3">
                  {(['natural', 'json'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSpecMode(mode)}
                      className={cn(
                        'flex-1 py-1 rounded-canvas-sm transition-colors text-center text-canvas-xs',
                        specMode === mode
                          ? 'bg-canvas-surface border-hairline border-canvas-border font-medium text-canvas-ink-soft'
                          : 'border border-transparent text-canvas-ink-faint hover:text-canvas-ink-soft',
                      )}
                    >
                      {mode === 'natural' ? 'Description' : 'JSON'}
                    </button>
                  ))}
                </div>

                {specMode === 'natural' ? (
                  <div className="whitespace-pre-wrap select-text text-canvas-ink-soft" style={{ fontSize: 13, lineHeight: 1.6 }}>
                    {currentMasterPrompt}
                  </div>
                ) : currentTechnicalSchema ? (
                  <pre className="whitespace-pre-wrap select-text font-mono text-canvas-md text-canvas-ink-soft" style={{ lineHeight: 1.5 }}>
                    {JSON.stringify(currentTechnicalSchema, null, 2)}
                  </pre>
                ) : (
                  /* Never render the literal "null" (VC-R4 fix 3) — a model
                     minted before schemas existed simply has none */
                  <div className="text-canvas-md text-canvas-ink-faint">
                    No JSON spec recorded for this cast.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 flex-shrink-0 border-t-hairline border-canvas-border">
            <div className="flex items-center justify-between">
              <span className="text-canvas-sm text-canvas-ink-faint">
                {activeTab === 'profile'
                  ? `${profileSections.reduce((n, s) => n + s.items.length, 0)} parameters set`
                  : 'Reproducible casting spec'}
              </span>
              {activeTab === 'profile' && (
                <button onClick={() => setActiveTab('spec')} className="text-canvas-sm font-medium text-canvas-ink-soft hover:text-canvas-ink transition-colors">
                  View spec →
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Collapsed: narrow 40px icon rail */
        <div className="flex flex-col items-center pt-3 gap-3">
          <button
            onClick={() => setIsCollapsed(false)}
            title="Expand panel"
            className="flex items-center p-1 text-canvas-ink-soft hover:text-canvas-ink transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="w-5 border-b-hairline border-canvas-border" />
          <button
            onClick={() => { setIsCollapsed(false); setActiveTab('profile'); setTimeout(() => fileInputRef.current?.click(), 240); }}
            title="Add reference image"
            className="flex items-center p-1 text-canvas-ink-soft hover:text-canvas-ink transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 15l6-6 4 4 4-4 4 4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
