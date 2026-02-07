import { useCastingGenerationStore } from '@/features/casting/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/useCastingUIStore';

// ============ Types ============

export type ViewType = 'frontClose' | 'frontFull' | 'sideClose' | 'sideFull' | 'backFull';

export interface GeneratedAsset {
  id: number;
  viewType: ViewType | string;
  storageUrl: string;
}

interface NextStage {
  label: string;
  action: () => void;
  step: number;
  total: number;
}

interface ViewTabsProps {
  nextStage: NextStage | null;
}

// ============ Lock Icon Component ============

const LockIcon = () => (
  <div className="absolute top-1.5 right-1.5 bg-white/80 backdrop-blur-md rounded-full p-1 border border-gray-300 z-20">
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-obsidian/80">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  </div>
);

// ============ Thumbnail Button Component ============

interface ThumbnailButtonProps {
  asset: GeneratedAsset | undefined;
  viewType: ViewType;
  label: string;
  isActive: boolean;
  onClick: () => void;
  showLock?: boolean;
}

const ThumbnailButton = ({ asset, viewType, label, isActive, onClick, showLock }: ThumbnailButtonProps) => {
  if (!asset) return null;
  
  return (
    <button 
      onClick={onClick}
      className={`relative group w-full aspect-[3/4] rounded-sm transition-all duration-300 overflow-hidden ${
        isActive 
        ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.3)] z-10 scale-[1.03]' 
        : 'ring-1 ring-gray-300 opacity-70 hover:opacity-100 hover:ring-slate-accent hover:scale-[1.02] hover:shadow-lg'
      }`}
    >
      <img src={asset.storageUrl} alt={label} className="w-full h-full object-cover" />
      {showLock && <LockIcon />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-900/80 via-gray-900/50 to-transparent py-1.5 px-1">
        <span className="text-[10px] font-medium text-white block text-center">{label}</span>
      </div>
    </button>
  );
};

// ============ Add Button Component ============

interface AddButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const AddButton = ({ label, onClick, disabled }: AddButtonProps) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className="w-full aspect-[3/4] bg-studio-950/60 backdrop-blur-sm rounded-sm border border-dashed border-gray-300 hover:border-white hover:bg-gray-50/50 transition-all flex flex-col items-center justify-center space-y-2 group disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <div className="w-8 h-8 rounded-full border-2 border-slate-accent flex items-center justify-center text-subtle group-hover:text-obsidian group-hover:border-white transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </div>
    <span className="text-[10px] font-medium text-subtle group-hover:text-obsidian text-center px-1">{label}</span>
  </button>
);

// ============ Locked Placeholder Component ============

interface LockedPlaceholderProps {
  label: string;
}

const LockedPlaceholder = ({ label }: LockedPlaceholderProps) => (
  <div className="w-full aspect-[3/4] bg-studio-950/40 backdrop-blur-[1px] rounded-sm border border-gray-200/40 flex flex-col items-center justify-center space-y-1">
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
    <span className="text-[10px] font-medium text-gray-400">{label}</span>
  </div>
);

// ============ Main Component ============

export function ViewTabs({ nextStage }: ViewTabsProps) {
  // Get state from Zustand stores
  const currentAssets = useCastingGenerationStore((state) => state.currentAssets);
  const { activeView, setActiveView } = useCastingUIStore();

  const getAsset = (viewType: ViewType) => currentAssets.find(a => a.viewType === viewType);
  const hasAsset = (viewType: ViewType) => currentAssets.some(a => a.viewType === viewType);

  if (currentAssets.length === 0) return null;

  return (
    <div className="absolute left-4 top-16 bottom-10 z-30 flex flex-col gap-3 w-20 overflow-y-auto no-scrollbar py-2 pointer-events-none">
      <div className="contents pointer-events-auto">
        {/* HEAD Thumbnail */}
        <ThumbnailButton
          asset={getAsset('frontClose')}
          viewType="frontClose"
          label="Head"
          isActive={activeView === 'frontClose'}
          onClick={() => setActiveView('frontClose')}
          showLock={hasAsset('frontFull')}
        />

        {/* ADD BODY / Full Body Thumbnail */}
        {hasAsset('frontFull') ? (
          <ThumbnailButton
            asset={getAsset('frontFull')}
            viewType="frontFull"
            label="Full"
            isActive={activeView === 'frontFull'}
            onClick={() => setActiveView('frontFull')}
            showLock={hasAsset('sideClose')}
          />
        ) : (
          <AddButton 
            label="Body" 
            onClick={() => nextStage?.step === 2 && nextStage.action()}
            disabled={!nextStage || nextStage.step !== 2}
          />
        )}

        {/* Side/Walk/Back Views or Locked Placeholders */}
        {hasAsset('frontFull') ? (
          hasAsset('sideClose') ? (
            <>
              <ThumbnailButton
                asset={getAsset('sideClose')}
                viewType="sideClose"
                label="Side"
                isActive={activeView === 'sideClose'}
                onClick={() => setActiveView('sideClose')}
              />
              {hasAsset('sideFull') && (
                <ThumbnailButton
                  asset={getAsset('sideFull')}
                  viewType="sideFull"
                  label="Walk"
                  isActive={activeView === 'sideFull'}
                  onClick={() => setActiveView('sideFull')}
                />
              )}
              {hasAsset('backFull') && (
                <ThumbnailButton
                  asset={getAsset('backFull')}
                  viewType="backFull"
                  label="Back"
                  isActive={activeView === 'backFull'}
                  onClick={() => setActiveView('backFull')}
                  showLock={true}
                />
              )}
            </>
          ) : (
            <AddButton 
              label="Angles" 
              onClick={() => nextStage?.step === 3 && nextStage.action()}
              disabled={!nextStage || nextStage.step !== 3}
            />
          )
        ) : (
          <>
            {/* Locked placeholders with labels */}
            <LockedPlaceholder label="Side" />
            <LockedPlaceholder label="Walk" />
            <LockedPlaceholder label="Back" />
          </>
        )}
      </div>
    </div>
  );
}

export default ViewTabs;
