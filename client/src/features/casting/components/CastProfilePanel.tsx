import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, LockKeyhole, Pencil, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { resolvedEngineChoices, type RequiredCastField } from '@/features/casting/engineChoicePersistence';
import { castingIdentityLabel, honestModelName } from '@/features/casting/modelDisplayTruth';

interface CastProfilePanelProps {
  onFork?: () => void;
  onCompleteCard?: () => void;
  onClose?: () => void;
  mobileSheet?: boolean;
}

interface ProfileSection {
  label: string;
  items: Array<{ key: string; value: string; note?: string }>;
}

export function CastProfilePanel({
  onFork,
  onCompleteCard,
  onClose,
  mobileSheet = false,
}: CastProfilePanelProps) {
  const [, navigate] = useLocation();
  const prefs = useCastingFormStore((state) => state.prefs);
  const engineChoice = useCastingFormStore((state) => state.engineChoice);
  const modelName = useCastingFormStore((state) => state.modelName);
  const setModelName = useCastingFormStore((state) => state.setModelName);
  const currentModelId = useCastingGenerationStore((state) => state.currentModelId);
  const currentAssets = useCastingGenerationStore((state) => state.currentAssets);
  const currentMasterPrompt = useCastingGenerationStore((state) => state.currentMasterPrompt);
  const currentTechnicalSchema = useCastingGenerationStore((state) => state.currentTechnicalSchema);
  const utils = trpc.useUtils();

  const modelQuery = trpc.models.get.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: currentModelId !== null, staleTime: 0 },
  );
  const packageQuery = trpc.generation.packageState.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: currentModelId !== null, staleTime: 15_000 },
  );
  const planQuery = trpc.generation.mintPackagePlan.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: currentModelId !== null, staleTime: 15_000 },
  );
  const updateName = trpc.models.update.useMutation();

  const [activeTab, setActiveTab] = useState<'identity' | 'spec'>('identity');
  const [specMode, setSpecMode] = useState<'natural' | 'json'>('natural');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const serverName = honestModelName(modelQuery.data?.name, modelName);
  useEffect(() => {
    if (!editingName) setNameDraft(serverName);
  }, [editingName, serverName]);

  const resolvedByField = useMemo(
    () => new Map(
      resolvedEngineChoices(currentTechnicalSchema, engineChoice)
        .map((item) => [item.field, item] as const),
    ),
    [currentTechnicalSchema, engineChoice],
  );

  const profileSections = useMemo<ProfileSection[]>(() => {
    const item = (key: string, value: string | undefined, field?: RequiredCastField) => {
      if (value) return { key, value };
      const resolved = field ? resolvedByField.get(field) : undefined;
      return resolved ? { key, value: resolved.value, note: 'Resolved at casting' } : { key, value: '' };
    };
    return [
      {
        label: 'Identity',
        items: [
          item('Brand', prefs.castingBrand, 'castingBrand'),
          item('Gender', prefs.gender, 'gender'),
          item('Age', prefs.age, 'age'),
          item('Ethnicity', prefs.ethnicity, 'ethnicity'),
          { key: 'Body', value: prefs.bodyType },
        ].filter((row) => row.value),
      },
      {
        label: 'Features',
        items: [
          { key: 'Face', value: prefs.faceShape },
          { key: 'Eyes', value: prefs.eyeShape },
          item('Eye color', prefs.eyeColor, 'eyeColor'),
          { key: 'Brows', value: prefs.eyebrowStyle },
        ].filter((row) => row.value),
      },
      {
        label: 'Skin',
        items: [
          item('Tone', prefs.skinTone, 'skinTone'),
          { key: 'Texture', value: prefs.skinTexture },
          { key: 'Finish', value: prefs.skinFinish },
        ].filter((row) => row.value),
      },
      {
        label: 'Hair',
        items: [
          item('Color', prefs.hairColor, 'hairColor'),
          item('Style', prefs.hairStyle, 'hairStyle'),
          { key: 'Length', value: prefs.hairLength },
          { key: 'Texture', value: prefs.hairTexture },
          ...(prefs.facialHair ? [{ key: 'Facial hair', value: prefs.facialHair }] : []),
        ].filter((row) => row.value),
      },
    ].filter((section) => section.items.length > 0) as ProfileSection[];
  }, [prefs, resolvedByField]);

  const slots = packageQuery.data?.slots ?? [];
  const filledCount = slots.filter((slot) => slot.filled).length || new Set(currentAssets.map((asset) => asset.viewType)).size;
  const missingCount = Math.max(0, 6 - filledCount);
  const issueCount = slots.filter((slot) => slot.stale || Boolean(slot.failed)).length;
  const completeCardCost = planQuery.data?.tiers.production.cost ?? null;
  const headshot = currentAssets.find((asset) => asset.viewType === 'frontClose');
  const identityLabel = castingIdentityLabel({
    status: modelQuery.data?.status,
    agencyId: modelQuery.data?.agencyId,
    pending: modelQuery.isLoading,
  });

  const saveName = async () => {
    const nextName = nameDraft.trim();
    if (!currentModelId || !nextName || nextName === serverName) {
      setNameDraft(serverName);
      setEditingName(false);
      return;
    }
    try {
      await updateName.mutateAsync({ modelId: currentModelId, name: nextName });
      setModelName(nextName);
      setEditingName(false);
      void Promise.all([
        utils.models.get.invalidate({ modelId: currentModelId }),
        utils.boardOps.listCastableModels.invalidate(),
        utils.boards.getItems.invalidate(),
      ]).catch(() => undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the name");
    }
  };

  const specText = specMode === 'natural'
    ? currentMasterPrompt
    : currentTechnicalSchema
      ? JSON.stringify(currentTechnicalSchema, null, 2)
      : '';

  const copySpec = async () => {
    await navigator.clipboard.writeText(specText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <aside className="h-full flex flex-col overflow-hidden bg-canvas-surface" data-cast-profile>
      <header className="px-4 pt-4 border-b-hairline border-canvas-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-canvas-xs font-medium text-canvas-ink-faint">
              <LockKeyhole size={12} strokeWidth={1.8} /> Cast profile
            </div>
            <div className="mt-2 flex items-center gap-3">
              {headshot && (
                <img src={headshot.storageUrl} alt="" className="h-11 w-11 flex-shrink-0 rounded-canvas-md object-cover border-hairline border-canvas-border" />
              )}
              <div className="min-w-0">
                {editingName ? (
                  <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); void saveName(); }}>
                    <input
                      autoFocus
                      value={nameDraft}
                      maxLength={128}
                      onChange={(event) => setNameDraft(event.target.value)}
                      className="min-w-0 w-full border-b border-canvas-ink bg-transparent py-0.5 text-canvas-lg font-medium text-canvas-ink outline-none"
                      aria-label="Cast name"
                    />
                    <button type="submit" disabled={updateName.isPending} aria-label="Save name" className="p-1 text-canvas-ink-soft hover:text-canvas-ink disabled:opacity-40">
                      <Check size={14} />
                    </button>
                    <button type="button" onClick={() => { setNameDraft(serverName); setEditingName(false); }} aria-label="Cancel rename" className="p-1 text-canvas-ink-faint hover:text-canvas-ink">
                      <X size={14} />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="truncate text-canvas-lg font-medium text-canvas-ink">{serverName || 'Unnamed cast'}</div>
                    <button type="button" onClick={() => setEditingName(true)} aria-label="Rename cast" className="p-1 text-canvas-ink-faint hover:text-canvas-ink">
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
                <div className="mt-0.5 truncate text-canvas-sm text-canvas-ink-soft">{identityLabel}</div>
              </div>
            </div>
          </div>
          {mobileSheet && (
            <button type="button" onClick={onClose} aria-label="Close Cast profile" className="p-1 text-canvas-ink-soft hover:text-canvas-ink">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-5">
          {(['identity', 'spec'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-2 text-canvas-sm border-b transition-colors',
                activeTab === tab
                  ? 'border-canvas-ink font-medium text-canvas-ink'
                  : 'border-transparent text-canvas-ink-soft hover:text-canvas-ink',
              )}
            >
              {tab === 'identity' ? 'Identity' : 'Spec'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {activeTab === 'identity' ? (
          <div className="p-4 space-y-4">
            <section className="rounded-canvas-md bg-canvas-surface-inset px-3 py-2.5">
              <div className="flex items-center justify-between text-canvas-md">
                <span className="text-canvas-ink-soft">Package</span>
                <span className="font-medium text-canvas-ink">{filledCount} of 6 views</span>
              </div>
              <div className="mt-1 text-canvas-sm text-canvas-ink-faint">
                {issueCount > 0 ? `${issueCount} view${issueCount === 1 ? '' : 's'} need attention` : missingCount > 0 ? `${missingCount} view${missingCount === 1 ? '' : 's'} not added` : 'Complete and in sync'}
              </div>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('casting-open-details'))} className="mt-2 text-canvas-sm font-medium text-canvas-ink-soft hover:text-canvas-ink">
                Versions & package details
              </button>
            </section>

            {profileSections.map((section) => (
              <section key={section.label}>
                <div className="mb-1.5 text-canvas-xs font-medium text-canvas-ink-faint">{section.label}</div>
                <div className="space-y-1">
                  {section.items.map((row) => (
                    <div key={row.key} className="flex items-start justify-between gap-4 rounded-canvas-sm bg-canvas-surface-inset px-2.5 py-2 text-canvas-sm">
                      <span className="text-canvas-ink-soft">{row.key}</span>
                      <span className="text-right font-medium text-canvas-ink">
                        {row.value}
                        {row.note && <span className="block text-canvas-xs font-normal text-canvas-ink-faint">{row.note}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex rounded-canvas-md bg-canvas-surface-inset p-0.5">
                {(['natural', 'json'] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setSpecMode(mode)} className={cn('rounded-canvas-sm px-2 py-1 text-canvas-xs', specMode === mode ? 'bg-canvas-surface font-medium text-canvas-ink' : 'text-canvas-ink-soft')}>
                    {mode === 'natural' ? 'Text' : 'JSON'}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void copySpec()} className="flex items-center gap-1 text-canvas-sm font-medium text-canvas-ink-soft hover:text-canvas-ink">
                <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-canvas-sm leading-relaxed text-canvas-ink-soft">{specText || 'No saved casting spec.'}</pre>
          </div>
        )}
      </div>

      <footer className="flex-shrink-0 border-t-hairline border-canvas-border p-4 space-y-2.5">
        {missingCount > 0 && onCompleteCard && (
          <button type="button" onClick={onCompleteCard} className="w-full rounded-canvas-md border-hairline border-canvas-border-strong px-3 py-2.5 text-canvas-md font-medium text-canvas-ink hover:bg-canvas-surface-inset">
            Complete card{completeCardCost !== null ? ` · ${completeCardCost.toLocaleString()} credits` : ''}
          </button>
        )}
        {onFork ? (
          <button type="button" onClick={onFork} className="w-full rounded-canvas-md bg-canvas-ink px-3 py-2.5 text-canvas-md font-medium" style={{ color: 'var(--color-canvas-surface)' }}>
            Fork as new model
          </button>
        ) : (
          <button type="button" onClick={() => navigate('/app/boards')} className="w-full rounded-canvas-md border-hairline border-canvas-border-strong px-3 py-2.5 text-canvas-md font-medium text-canvas-ink hover:bg-canvas-surface-inset">
            Fork from Canvas <ExternalLink size={12} className="ml-1 inline" />
          </button>
        )}
        <p className="text-center text-canvas-xs leading-relaxed text-canvas-ink-faint">
          This identity is locked. Forking starts a separate draft; this cast stays unchanged.
        </p>
        <button type="button" onClick={() => navigate('/app/models')} className="w-full text-center text-canvas-sm font-medium text-canvas-ink-soft hover:text-canvas-ink">
          Export from Model Library
        </button>
      </footer>
    </aside>
  );
}
