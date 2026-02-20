import { useState, useEffect, useRef } from 'react';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';

// ============ Types ============

interface ProfileSection {
  label: string;
  items: { key: string; value: string }[];
}

// ============ Main Component ============

export function MasterPromptPanel() {
  const prefs = useCastingFormStore((s) => s.prefs);
  const updatePref = useCastingFormStore((s) => s.updatePref);
  const currentAssets = useCastingGenerationStore((s) => s.currentAssets);
  const currentMasterPrompt = useCastingGenerationStore((s) => s.currentMasterPrompt);
  const currentTechnicalSchema = useCastingGenerationStore((s) => s.currentTechnicalSchema);
  const amendments = useCastingGenerationStore((s) => s.amendments);

  const [activeTab, setActiveTab] = useState<'profile' | 'spec'>('profile');
  const [specMode, setSpecMode] = useState<'natural' | 'json'>('natural');
  const [isCopied, setIsCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsCopied(false); }, [specMode, currentMasterPrompt]);

  // Don't render until there are assets
  if (currentAssets.length === 0) return null;

  const contentToCopy = specMode === 'natural'
    ? currentMasterPrompt
    : JSON.stringify(currentTechnicalSchema, null, 2);

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

  // Build profile sections from prefs
  const profileSections: ProfileSection[] = [
    {
      label: 'IDENTITY',
      items: [
        { key: 'Brand', value: prefs.castingBrand },
        { key: 'Gender', value: prefs.gender },
        { key: 'Age', value: prefs.age },
        { key: 'Ethnicity', value: prefs.ethnicity },
        { key: 'Body', value: prefs.bodyType },
      ].filter((i) => i.value),
    },
    {
      label: 'FEATURES',
      items: [
        { key: 'Face', value: prefs.faceShape },
        { key: 'Jawline', value: prefs.jawline },
        { key: 'Cheekbones', value: prefs.cheekbones },
        { key: 'Nose', value: prefs.noseShape },
        { key: 'Lips', value: prefs.lipShape },
        { key: 'Eyes', value: prefs.eyeShape },
        { key: 'Eye Color', value: prefs.eyeColor },
        { key: 'Brows', value: prefs.eyebrowStyle },
      ].filter((i) => i.value),
    },
    {
      label: 'SKIN',
      items: [
        { key: 'Tone', value: prefs.skinTone },
        { key: 'Texture', value: prefs.skinTexture },
        { key: 'Finish', value: prefs.skinFinish },
      ].filter((i) => i.value),
    },
    {
      label: 'HAIR',
      items: [
        { key: 'Color', value: prefs.hairColor },
        { key: 'Style', value: prefs.hairStyle },
        { key: 'Length', value: prefs.hairLength },
        { key: 'Texture', value: prefs.hairTexture },
        { key: 'Volume', value: prefs.hairVolume },
        { key: 'Parting', value: prefs.hairParting },
        { key: 'Fringe', value: prefs.hairFringe },
        ...(prefs.facialHair ? [{ key: 'Facial Hair', value: prefs.facialHair }] : []),
      ].filter((i) => i.value),
    },
    {
      label: 'VIBE',
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
  const viewCount = currentAssets.length;

  return (
    <aside
      className="h-full flex flex-col overflow-hidden flex-shrink-0 z-20 hidden lg:flex"
      style={{
        width: isCollapsed ? 40 : 280,
        background: '#fff',
        borderRadius: '18px 0 0 18px',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)',
        transition: 'width 0.22s ease',
      }}
    >
      {!isCollapsed ? (
        <>
          {/* Header + Tabs */}
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between mb-3">
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                {activeTab === 'profile' ? 'Profile' : 'Spec'}
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'spec' && (
                  <button onClick={copyToClipboard} style={{ fontSize: 9, fontWeight: 600, color: isCopied ? '#5cad5c' : '#bbb' }}>
                    {isCopied ? '✓ Copied' : 'Copy'}
                  </button>
                )}
                <button
                  onClick={() => setIsCollapsed(true)}
                  title="Collapse panel"
                  className="hover:text-black transition-colors"
                  style={{ color: '#ccc', display: 'flex', alignItems: 'center', padding: 2 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-1.5 mb-3">
              {(['profile', 'spec'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-1.5 rounded-lg transition-all text-center"
                  style={{
                    fontSize: 9,
                    fontWeight: activeTab === tab ? 600 : 400,
                    background: activeTab === tab ? '#1a1a1a' : '#f5f3ef',
                    color: activeTab === tab ? '#fff' : '#999',
                  }}
                >
                  {tab === 'profile' ? 'Profile' : 'Spec'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(0,0,0,0.05)' }} />

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {activeTab === 'profile' ? (
              <div className="p-4 space-y-4">
                {/* Identity Card Header */}
                {headAsset && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1.5px solid rgba(0,0,0,0.06)' }}>
                      <img src={headAsset.storageUrl} alt="Model" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>
                        MOD-{headAsset.id}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#5cad5c' }} />
                        <span style={{ fontSize: 9, color: '#999' }}>
                          {viewCount} view{viewCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amendment Log */}
                {amendments.length > 0 && (
                  <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(92,173,92,0.06)', border: '1px solid rgba(92,173,92,0.12)' }}>
                    <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(92,173,92,0.08)' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#999', letterSpacing: '0.05em' }}>EDIT LOG</span>
                      <span style={{ fontSize: 9, color: '#bbb' }}>{amendments.length} edit{amendments.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="custom-scrollbar" style={{ maxHeight: 140, overflowY: 'auto', padding: '4px 0' }}>
                      {[...amendments].reverse().map((a, i) => (
                        <div key={i} className="flex items-start gap-2 px-2.5 py-1.5" style={{ fontSize: 10, lineHeight: 1.4 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#5cad5c', fontFamily: 'ui-monospace, monospace', flexShrink: 0, minWidth: 20 }}>
                            v{a.version}
                          </span>
                          <span style={{ color: '#666', flex: 1 }}>{a.text}</span>
                          {a.view !== 'frontClose' && (
                            <span style={{ fontSize: 8, fontWeight: 600, color: '#bbb', padding: '1px 4px', borderRadius: 3, background: 'rgba(0,0,0,0.04)', flexShrink: 0 }}>
                              {a.view === 'frontFull' ? 'BODY' : a.view === 'sideClose' ? 'SIDE' : a.view.toUpperCase()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reference Image Section */}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#bbb', letterSpacing: '0.06em', marginBottom: 6 }}>REFERENCE</div>
                  {prefs.referenceImage ? (
                    <div className="relative group">
                      <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(0,0,0,0.06)' }}>
                        <img src={prefs.referenceImage} alt="Reference" className="w-full object-cover" style={{ maxHeight: 120 }} />
                      </div>
                      <div className="mt-2 px-2.5 py-2 rounded-lg" style={{ background: '#f9f8f5', fontSize: 9, color: '#b8b3a8', lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 600, color: '#999' }}>How to use:</span> describe what to transfer in the refine bar — e.g. "use hairstyle from reference" or "apply eye makeup from reference image"
                        <div style={{ marginTop: 4, color: '#ccc' }}>
                          Press <span style={{ fontFamily: 'monospace', fontWeight: 700, background: 'rgba(0,0,0,0.04)', padding: '0 3px', borderRadius: 2 }}>F</span> to toggle on canvas · Drag to reposition · Corner to resize
                        </div>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', fontSize: 9, fontWeight: 600, color: '#777', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => updatePref('referenceImage', undefined)}
                        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', fontSize: 9, fontWeight: 600, color: '#c33', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
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
                        className="cursor-pointer transition-all"
                        style={{
                          padding: '14px 12px',
                          borderRadius: 12,
                          border: isDragging ? '1.5px dashed #1a1a1a' : '1.5px dashed rgba(0,0,0,0.1)',
                          background: isDragging ? 'rgba(26,26,26,0.03)' : '#f9f8f5',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 8, margin: '0 auto 6px', background: 'rgba(255,255,255,0.8)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M3 15l6-6 4 4 4-4 4 4" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                          </svg>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 500, color: '#999' }}>{isDragging ? 'Drop image' : 'Add Reference'}</div>
                        <div style={{ fontSize: 9, color: '#ccc', marginTop: 2 }}>Drop or click to browse</div>
                      </div>
                      <div className="mt-2 px-2.5 py-2 rounded-lg" style={{ background: '#f9f8f5', fontSize: 9, color: '#b8b3a8', lineHeight: 1.5 }}>
                        Upload a photo of a hairstyle, tattoo, accessory, or look you want to transfer to your model. Then describe what to use in the refine bar — the AI will visually reference this image during iteration.
                      </div>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
                </div>

                {/* Parameter Sections */}
                {profileSections.map((section) => (
                  <div key={section.label}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#bbb', letterSpacing: '0.06em', marginBottom: 6 }}>{section.label}</div>
                    <div className="space-y-0.5">
                      {section.items.map((item) => (
                        <div key={item.key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg" style={{ background: '#f9f8f5' }}>
                          <span style={{ fontSize: 10, color: '#999' }}>{item.key}</span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#555' }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Casting Notes */}
                {prefs.features && (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#bbb', letterSpacing: '0.06em', marginBottom: 6 }}>NOTES</div>
                    <div className="px-2.5 py-2 rounded-lg" style={{ background: '#f9f8f5', fontSize: 10, color: '#777', lineHeight: 1.5 }}>
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
                      className="flex-1 py-1 rounded-md transition-all text-center"
                      style={{
                        fontSize: 8,
                        fontWeight: specMode === mode ? 600 : 400,
                        background: specMode === mode ? '#f5f3ef' : 'transparent',
                        color: specMode === mode ? '#555' : '#ccc',
                      }}
                    >
                      {mode === 'natural' ? 'Description' : 'JSON'}
                    </button>
                  ))}
                </div>

                {specMode === 'natural' ? (
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: '#777' }} className="whitespace-pre-wrap select-text">
                    {currentMasterPrompt}
                  </div>
                ) : (
                  <pre style={{ fontSize: 10, lineHeight: 1.5, color: '#5cad5c' }} className="whitespace-pre-wrap select-text font-mono">
                    {JSON.stringify(currentTechnicalSchema, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 9, color: '#ccc' }}>
                {activeTab === 'profile'
                  ? `${profileSections.reduce((n, s) => n + s.items.length, 0)} parameters set`
                  : 'Reproducible casting spec'}
              </span>
              {activeTab === 'profile' && (
                <button onClick={() => setActiveTab('spec')} style={{ fontSize: 9, fontWeight: 500, color: '#bbb' }}>
                  View Spec →
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
            className="hover:text-black transition-colors"
            style={{ color: '#ccc', display: 'flex', alignItems: 'center', padding: 4 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ width: 20, height: 1, background: 'rgba(0,0,0,0.06)' }} />
          <button
            onClick={() => { setIsCollapsed(false); setActiveTab('profile'); setTimeout(() => fileInputRef.current?.click(), 240); }}
            title="Add reference image"
            className="hover:text-black transition-colors"
            style={{ color: '#ccc', display: 'flex', alignItems: 'center', padding: 4 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 15l6-6 4 4 4-4 4 4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}
