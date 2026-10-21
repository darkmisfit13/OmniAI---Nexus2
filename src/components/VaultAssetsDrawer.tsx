import React, { useState, useEffect, useMemo } from 'react';
import { 
  FolderLock, 
  X, 
  Music, 
  Video, 
  Image as ImageIcon, 
  FileCode, 
  Download, 
  ExternalLink, 
  Sparkles, 
  Trash2, 
  Check, 
  Layers,
  Play,
  Pause,
  Plus,
  Copy,
  Clock,
  Film,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Cloud,
  CloudOff,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  LogIn
} from 'lucide-react';
import { db, auth, signInWithGoogleWorkspace } from '../lib/firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { User, onAuthStateChanged } from 'firebase/auth';

export interface VaultAsset {
  id: string;
  name: string;
  type: 'audio' | 'video' | 'image' | 'code' | 'text';
  studioSource?: string;
  duration?: string;
  resolution?: string;
  lyrics?: string;
  bpm?: number;
  thumbnailUrl?: string;
  audioUrl?: string;
  codeSnippet?: string;
  text?: string;
  tags?: string[];
  createdAt: string;
}

export const initialVaultAssets: VaultAsset[] = [
  {
    id: 'vault-1',
    name: 'Midnight Cyber City Theme.mp3',
    type: 'audio',
    studioSource: 'OmniWave',
    duration: '2:45',
    bpm: 128,
    tags: ['synthwave', 'instrumental', 'master'],
    createdAt: '10 mins ago',
  },
  {
    id: 'vault-2',
    name: 'CapCut Glitch Reel v1.mp4',
    type: 'video',
    studioSource: 'OmniMotion',
    duration: '0:15',
    resolution: '1080x1920 (9:16)',
    tags: ['tiktok', 'reels', 'glitch-fx'],
    createdAt: '22 mins ago',
  },
  {
    id: 'vault-3',
    name: 'Omni Neon Hologram Portrait.png',
    type: 'image',
    studioSource: 'OmniImagine',
    resolution: '1024x1024',
    tags: ['cyberpunk', 'volumetric', 'avatar'],
    createdAt: '1 hour ago',
  },
  {
    id: 'vault-4',
    name: 'arbitrage_orderbook_engine.rs',
    type: 'code',
    studioSource: 'OmniCode',
    tags: ['rust', 'crypto', 'sub-millisecond'],
    codeSnippet: 'pub async fn execute_arb_flash_loan(pool: &Pool) -> Result<TxHash, ArbError> { ... }',
    createdAt: '2 hours ago',
  },
];

interface VaultAssetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assets?: VaultAsset[];
  onDeleteAsset?: (id: string) => void;
  onAddCustomAsset?: (asset: VaultAsset) => void;
  onInsertToKeyboard?: (text: string) => void;
}

export const VaultAssetsDrawer: React.FC<VaultAssetsDrawerProps> = ({
  isOpen,
  onClose,
  assets = initialVaultAssets,
  onDeleteAsset,
  onAddCustomAsset,
  onInsertToKeyboard,
}) => {
  const [internalAssets, setInternalAssets] = useState<VaultAsset[]>(assets);
  const [activeTab, setActiveTab] = useState<'all' | 'audio' | 'video' | 'image' | 'code'>('all');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<'date' | 'type' | 'label'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // User Authentication Identity (Firebase Auth currentUser)
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Cloud Sync to Firestore State
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('omni_vault_cloud_sync_enabled') === 'true';
    }
    return false;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setCloudSyncEnabled(false);
      }
    });
    return () => unsub();
  }, []);

  const pushToFirestore = async (itemsToPush: VaultAsset[]) => {
    if (!currentUser) {
      setSyncStatusText('Unavailable: Sign in to sync your vault');
      return;
    }
    if (!itemsToPush || itemsToPush.length === 0) return;
    setIsSyncing(true);
    setSyncStatusText(`Syncing ${itemsToPush.length} item${itemsToPush.length !== 1 ? 's' : ''} to users/${currentUser.uid.slice(0, 6)}.../vault`);
    try {
      for (const asset of itemsToPush) {
        const cleanId = (asset.id || `vault_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const payload = {
          ...asset,
          syncedAt: new Date().toISOString(),
          ownerId: currentUser.uid,
          ownerEmail: currentUser.email || '',
        };

        // EXCLUSIVELY write to the authenticated user's private subcollection in Firestore:
        // /users/{userId}/vault/{assetId} matches firestore.rules isOwner(userId)
        // No writes to globalVault (which firestore.rules denies)
        const userDocRef = doc(db, 'users', currentUser.uid, 'vault', cleanId);
        await setDoc(userDocRef, payload, { merge: true });
      }

      setSyncStatusText(`Synced to users/${currentUser.uid.slice(0, 6)}.../vault`);
      setTimeout(() => setSyncStatusText(null), 3500);
    } catch (err: any) {
      console.warn('Firestore Vault Cloud Sync notice:', err);
      setSyncStatusText(err?.message?.includes('permission') ? 'Firestore permission denied' : 'Sync error (offline cache)');
      setTimeout(() => setSyncStatusText(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleCloudSync = async () => {
    if (!currentUser) {
      setSyncStatusText('Sign-in required to enable cloud sync');
      setTimeout(() => setSyncStatusText(null), 3000);
      return;
    }

    const nextState = !cloudSyncEnabled;
    setCloudSyncEnabled(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('omni_vault_cloud_sync_enabled', String(nextState));
    }

    if (nextState) {
      await pushToFirestore(internalAssets);
    } else {
      setSyncStatusText('User cloud sync paused');
      setTimeout(() => setSyncStatusText(null), 2000);
    }
  };

  const handleManualSync = async () => {
    if (!currentUser) {
      setSyncStatusText('Sign-in required to sync');
      setTimeout(() => setSyncStatusText(null), 3000);
      return;
    }
    await pushToFirestore(internalAssets);
  };

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    try {
      await signInWithGoogleWorkspace();
    } catch (err) {
      console.error('Sign-in error from vault drawer:', err);
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    if (assets) setInternalAssets(assets);
  }, [assets]);

  if (!isOpen) return null;

  const currentList = internalAssets;
  const filteredAssets = useMemo(() => {
    const list = currentList.filter((asset) => {
      if (activeTab === 'all') return true;
      return asset.type === activeTab;
    });

    return [...list].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = (a.createdAt || '').localeCompare(b.createdAt || '');
      } else if (sortBy === 'type') {
        comparison = (a.type || '').localeCompare(b.type || '');
      } else if (sortBy === 'label') {
        comparison = (a.name || '').localeCompare(b.name || '');
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [currentList, activeTab, sortBy, sortOrder]);

  const togglePlayAudio = (id: string) => {
    setPlayingAudioId((prev) => (prev === id ? null : id));
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (asset: VaultAsset) => {
    const element = document.createElement('a');
    let content = '';
    let mimeType = 'text/plain';

    if (asset.type === 'code' && asset.codeSnippet) {
      content = asset.codeSnippet;
      mimeType = 'text/javascript';
    } else if (asset.type === 'audio' && asset.lyrics) {
      content = `Title: ${asset.name}\nBPM: ${asset.bpm || 140}\n\nLyrics:\n${asset.lyrics}`;
    } else {
      content = asset.text || JSON.stringify(asset, null, 2);
    }

    const file = new Blob([content], { type: mimeType });
    element.href = URL.createObjectURL(file);
    element.download = asset.name.toLowerCase().replace(/\s+/g, '_') + (asset.type === 'code' ? '.tsx' : '.txt');
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end font-sans">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in"
      />

      {/* Slide-over Drawer */}
      <div className="relative w-full max-w-md bg-[#0a0d16] border-l border-slate-800 h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#080b12]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <FolderLock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Omni Global Vault</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {assets.length} Assets
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Shared media & project store across all 14 studios
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Cloud Vault (Firestore users/{userId}/vault) Toolbar */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-purple-950/30 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border transition ${
              currentUser && cloudSyncEnabled 
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(0,242,254,0.2)]' 
                : 'bg-slate-800/80 border-slate-700 text-slate-500'
            }`}>
              {currentUser ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-[11px]">User Cloud Vault</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  currentUser
                    ? cloudSyncEnabled
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_8px_rgba(0,242,254,0.2)]'
                      : 'bg-slate-800 text-slate-400'
                    : 'bg-amber-950/50 text-amber-400 border border-amber-600/40'
                }`}>
                  {currentUser ? (cloudSyncEnabled ? 'ACTIVE' : 'PAUSED') : 'SIGN-IN REQUIRED'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {syncStatusText || (
                  currentUser
                    ? (cloudSyncEnabled ? `Syncing to users/${currentUser.uid.slice(0, 6)}.../vault` : `Destination: users/${currentUser.uid.slice(0, 6)}.../vault`)
                    : 'Sync unavailable: Sign in to enable private user vault'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!currentUser ? (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 text-[10px] font-mono font-bold transition shadow-sm"
                title="Sign in with Google Workspace to enable Firestore vault sync"
              >
                <LogIn className="w-3 h-3" />
                <span>{isAuthenticating ? 'Signing in...' : 'Sign In'}</span>
              </button>
            ) : (
              <>
                {cloudSyncEnabled && (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="p-1 rounded-md text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 transition"
                    title="Trigger Immediate Cloud Push"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleCloudSync}
                  className={`transition ${cloudSyncEnabled ? 'text-cyan-400 hover:text-cyan-300' : 'text-slate-600 hover:text-slate-400'}`}
                  title={cloudSyncEnabled ? 'Disable User Cloud Sync' : 'Enable User Cloud Sync & Push Assets'}
                >
                  {cloudSyncEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1 text-xs">
          {(['all', 'audio', 'video', 'image', 'code'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-lg text-center capitalize font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sorting Dropdown Toolbar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'type' | 'label')}
              className="bg-slate-900 border border-slate-750 text-cyan-300 text-xs font-mono rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="date">Date Created</option>
              <option value="type">Asset Type</option>
              <option value="label">Label / Name</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500">
              {filteredAssets.length} item{filteredAssets.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-mono text-[11px] transition"
              title={sortOrder === 'asc' ? 'Sorted Ascending (Click to switch to Descending)' : 'Sorted Descending (Click to switch to Ascending)'}
            >
              <span>{sortOrder === 'desc' ? 'Newest / Z-A' : 'Oldest / A-Z'}</span>
              {sortOrder === 'desc' ? (
                <ArrowDown className="w-3 h-3 text-cyan-400" />
              ) : (
                <ArrowUp className="w-3 h-3 text-cyan-400" />
              )}
            </button>
          </div>
        </div>

        {/* Asset Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredAssets.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
              <FolderLock className="w-10 h-10 text-slate-700" />
              <p className="text-xs font-semibold">No assets found in this filter.</p>
              <p className="text-[11px] text-slate-600">
                Use OmniMotion, OmniBeat, OmniWave, or OmniImagine and click "Save to Vault" to populate your media vault.
              </p>
            </div>
          ) : (
            filteredAssets.map((asset) => {
              const isPlaying = playingAudioId === asset.id;

              return (
                <div
                  key={asset.id}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5 shadow-md"
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail / Icon */}
                    <div className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                      {asset.thumbnailUrl ? (
                        <img
                          src={asset.thumbnailUrl}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : asset.type === 'audio' ? (
                        <Music className="w-5 h-5 text-emerald-400" />
                      ) : asset.type === 'video' ? (
                        <Film className="w-5 h-5 text-cyan-400" />
                      ) : asset.type === 'code' ? (
                        <FileCode className="w-5 h-5 text-purple-400" />
                      ) : (
                        <FileText className="w-5 h-5 text-blue-400" />
                      )}

                      {/* Mini Play Icon for Audio */}
                      {asset.type === 'audio' && (
                        <button
                          onClick={() => togglePlayAudio(asset.id)}
                          className="absolute inset-0 bg-black/50 hover:bg-black/30 flex items-center justify-center text-white"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 fill-current text-cyan-400" />
                          ) : (
                            <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-xs text-white truncate">{asset.name}</h4>
                        <button
                          onClick={() => {
                            if (onDeleteAsset) {
                              onDeleteAsset(asset.id);
                            } else {
                              setInternalAssets((prev) => prev.filter((a) => a.id !== asset.id));
                            }
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1"
                          title="Delete from Vault"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {asset.type}
                        </span>
                        {asset.duration && (
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {asset.duration}
                          </span>
                        )}
                        {asset.bpm && (
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {asset.bpm} BPM
                          </span>
                        )}
                        {asset.resolution && (
                          <span className="text-[10px] text-cyan-400 font-mono">
                            {asset.resolution}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lyrics / Snippet Preview */}
                  {asset.lyrics && (
                    <div className="p-2 rounded bg-slate-950 border border-slate-800/80 text-[11px] text-slate-300 italic max-h-16 overflow-y-auto">
                      "{asset.lyrics.slice(0, 160)}..."
                    </div>
                  )}

                  {asset.codeSnippet && (
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-300 max-h-16 overflow-y-auto">
                      {asset.codeSnippet.slice(0, 140)}...
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'Recent'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {asset.codeSnippet && (
                        <button
                          onClick={() => copyCode(asset.codeSnippet!, asset.id)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1"
                        >
                          {copiedId === asset.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>Copy</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDownload(asset)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Add Custom Asset Footer */}
        <div className="p-3 border-t border-slate-800 bg-[#080b12] flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Vault Encrypted & Synced</span>
          <button
            onClick={() => {
              if (onAddCustomAsset) {
                onAddCustomAsset({
                  id: `asset-${Date.now()}`,
                  name: `Quick Note Asset ${new Date().toLocaleTimeString()}`,
                  type: 'text',
                  text: 'Omni quick note saved to vault.',
                  createdAt: new Date().toISOString(),
                });
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 font-semibold text-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Asset</span>
          </button>
        </div>

      </div>
    </div>
  );
};
