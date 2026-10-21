import React, { useState } from 'react';
import { HoloOrb, OrbPhase } from './HoloOrb';
import { 
  Sparkles, 
  Wand2, 
  Send, 
  Copy, 
  Check, 
  Mic, 
  RotateCcw, 
  Flame, 
  Briefcase, 
  Smile, 
  Shield, 
  Activity, 
  Database,
  Layers,
  ChevronRight,
  Info,
  Zap,
  Volume2,
  VolumeX,
  Mail,
  FileText,
  CheckCircle2,
  List,
  Maximize2,
  X,
  ChevronDown
} from 'lucide-react';
import { omniVoice } from '../lib/omniVoice';
import { onDeviceAI } from '../lib/onDeviceAI';

interface SuggestionTrio {
  witty: string;
  rawHonest: string;
  directAction: string;
}

export type PersonaTone = 'rawHonest' | 'witty' | 'directAction';

export const personaToneMeta: Record<PersonaTone, { label: string; shortLabel: string; desc: string; icon: any; color: string; badge: string }> = {
  directAction: {
    label: 'Direct Action',
    shortLabel: 'Action',
    desc: 'Clear, decisive, milestone-driven responses with zero fluff and immediate next steps.',
    icon: Zap,
    color: 'text-[#00f2fe]',
    badge: 'border-[#00f2fe]/40 bg-[#00f2fe]/10 text-[#00f2fe]',
  },
  rawHonest: {
    label: 'Raw & Honest',
    shortLabel: 'Raw',
    desc: 'Unvarnished truth and authentic transparency. Speaks reality without corporate spin.',
    icon: Flame,
    color: 'text-[#c084fc]',
    badge: 'border-[#7f00ff]/40 bg-[#7f00ff]/15 text-[#c084fc]',
  },
  witty: {
    label: 'Witty & Fast',
    shortLabel: 'Witty',
    desc: 'Playful confidence, sharp nocturnal banter, and effortless magnetism.',
    icon: Smile,
    color: 'text-amber-300',
    badge: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  },
};

interface AIKeyboardBarProps {
  currentText: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  suggestedReplies: string[];
  suggestionTrio?: SuggestionTrio;
  liveAdvice: string[];
  onSelectSuggestion: (text: string) => void;
  onRewrite: (style: string) => void;
  onRequestInstantAdvice: () => void;
  isAnalyzing: boolean;
  orbPhase: OrbPhase;
  screenName: string;
  isOnDeviceMode?: boolean;
  onToggleOnDeviceMode?: () => void;
  localLatencyMs?: number;
  onOpenTelemetryHUD: () => void;
  telemetryNotesCount: number;
  isAutoMode?: boolean;
  onToggleAutoMode?: () => void;
  autoPilotTone?: 'rawHonest' | 'witty' | 'directAction';
  onChangeAutoPilotTone?: (tone: 'rawHonest' | 'witty' | 'directAction') => void;
  autoCountdown?: number | null;
  onCancelAutoDispatch?: () => void;
  onInstantAutoDispatch?: () => void;
  autoDispatchTarget?: string;
  autoDispatchPreviewText?: string;
  onQuickAction?: (actionId: string, resultText: string) => void;
}

export const AIKeyboardBar: React.FC<AIKeyboardBarProps> = ({
  currentText,
  onChangeText,
  onSend,
  suggestedReplies,
  suggestionTrio,
  liveAdvice,
  onSelectSuggestion,
  onRewrite,
  onRequestInstantAdvice,
  isAnalyzing,
  orbPhase,
  screenName,
  isOnDeviceMode = true,
  onToggleOnDeviceMode,
  localLatencyMs = 6.8,
  onOpenTelemetryHUD,
  telemetryNotesCount = 3,
  isAutoMode = false,
  onToggleAutoMode,
  autoPilotTone = 'directAction',
  onChangeAutoPilotTone,
  autoCountdown = null,
  onCancelAutoDispatch,
  onInstantAutoDispatch,
  autoDispatchTarget = '',
  autoDispatchPreviewText = '',
  onQuickAction,
}) => {
  const [copied, setCopied] = useState(false);
  const [showToneMenu, setShowToneMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
  const [quickActionFeedback, setQuickActionFeedback] = useState<string | null>(null);

  // Tactile physical confirmation via Navigator Vibrate API (Subtle and user-configurable)
  const triggerHaptic = (overrideDuration?: number | number[]) => {
    try {
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        const isEnabled = localStorage.getItem('omni_haptic_enabled') !== 'false';
        if (!isEnabled) return;

        if (overrideDuration !== undefined) {
          navigator.vibrate(overrideDuration);
          return;
        }

        const strength = localStorage.getItem('omni_haptic_strength') || 'subtle';
        const ms = strength === 'firm' ? 24 : strength === 'balanced' ? 14 : 8;
        navigator.vibrate(ms);
      }
    } catch {
      // Vibrate suppressed or unsupported
    }
  };

  const quickActions = [
    {
      id: 'draft-email',
      label: 'Draft Email',
      icon: Mail,
      desc: 'Format draft into a structured professional email',
      color: 'hover:border-cyan-400 hover:text-cyan-300 text-slate-300',
    },
    {
      id: 'summarize',
      label: 'Summarize',
      icon: FileText,
      desc: 'Distill draft into concise summary or key takeaways',
      color: 'hover:border-purple-400 hover:text-purple-300 text-slate-300',
    },
    {
      id: 'fix-grammar',
      label: 'Fix Grammar',
      icon: CheckCircle2,
      desc: 'Auto-correct punctuation, apostrophes, and capitalization',
      color: 'hover:border-emerald-400 hover:text-emerald-300 text-slate-300',
    },
    {
      id: 'bulletize',
      label: 'Bulletize',
      icon: List,
      desc: 'Convert clauses or thoughts into clean bullet points',
      color: 'hover:border-blue-400 hover:text-blue-300 text-slate-300',
    },
    {
      id: 'expand',
      label: 'Expand',
      icon: Maximize2,
      desc: 'Elaborate draft with deeper clarity and action items',
      color: 'hover:border-amber-400 hover:text-amber-300 text-slate-300',
    },
  ];

  const handleTriggerQuickAction = async (actionId: string) => {
    triggerHaptic([15, 30, 15]);
    setActiveQuickAction(actionId);
    try {
      const { result } = await onDeviceAI.processQuickAction(actionId, currentText);
      onChangeText(result);
      onQuickAction?.(actionId, result);
      setQuickActionFeedback(actionId);
      setTimeout(() => setQuickActionFeedback(null), 1600);
    } finally {
      setActiveQuickAction(null);
    }
  };

  const handleCopy = () => {
    if (!currentText) return;
    triggerHaptic(12);
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMicDictate = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setIsListening(true);
      setTimeout(() => {
        onChangeText(currentText ? `${currentText} (voice thought captured)` : 'Addressing the issue right now.');
        setIsListening(false);
      }, 1400);
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onChangeText(currentText ? `${currentText} ${transcript}` : transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <div className="flex flex-col bg-[#000000] border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] relative z-20">
      {/* 1. TOP INTELLIGENCE STATUS STRIP */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0B0B0C] border-b border-white/10 text-xs">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          {/* OmniCore Telemetry HUD Trigger Button */}
          <button
            onClick={onOpenTelemetryHUD}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00f2fe]/10 border border-[#00f2fe]/40 text-[#00f2fe] hover:bg-[#00f2fe]/20 text-[10px] font-mono font-bold transition shadow-[0_0_10px_rgba(0,242,254,0.15)] shrink-0"
            title="OmniCore Telemetry"
            aria-label="OmniCore Telemetry"
          >
            <Activity className="w-3 h-3 text-[#00f2fe] animate-pulse" />
            <span>OmniCore ({telemetryNotesCount})</span>
          </button>

          {/* Real-time Advice Pill */}
          <div 
            onClick={onOpenTelemetryHUD}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/80 border border-white/10 text-[11px] text-slate-300 hover:text-white cursor-pointer truncate transition max-w-[65%]"
            title="Click to inspect real-time notes"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f2fe] animate-ping shrink-0" />
            <span className="truncate font-mono text-[10px]">
              {liveAdvice[0] || 'Omni watching screen... tap for live coaching.'}
            </span>
          </div>

          {/* Autonomous Auto-Pilot Mode Toggle */}
          {onToggleAutoMode && (
            <button
              onClick={onToggleAutoMode}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition shrink-0 ${
                isAutoMode
                  ? 'bg-gradient-to-r from-[#00f2fe]/20 to-[#7f00ff]/30 text-[#00f2fe] border border-[#00f2fe] shadow-[0_0_12px_rgba(0,242,254,0.4)] animate-pulse'
                  : 'bg-black/90 text-slate-500 border border-white/10 hover:text-slate-300'
              }`}
              title="Toggle Autonomous Auto-Pilot Mode (Omni Key answers for you)"
            >
              <Zap className={`w-3 h-3 ${isAutoMode ? 'text-[#00f2fe] animate-bounce' : 'text-slate-500'}`} />
              <span>{isAutoMode ? 'AUTO: ON' : 'AUTO: OFF'}</span>
            </button>
          )}

          {/* On-Device NPU Status Badge */}
          {onToggleOnDeviceMode && (
            <button
              onClick={onToggleOnDeviceMode}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold transition shrink-0 ${
                isOnDeviceMode
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'bg-[#7f00ff]/15 text-[#a855f7] border border-[#7f00ff]/40'
              }`}
              title="Toggle On-Device Local Processing vs Cloud Gemini"
            >
              <span>{isOnDeviceMode ? `⚡ ${localLatencyMs}ms NPU` : '☁️ Cloud'}</span>
            </button>
          )}
        </div>

        {/* Persistent Persona Tone Toggle Button */}
        <div className="flex items-center gap-1 ml-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setShowToneMenu((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all border shadow-sm ${
              showToneMenu
                ? 'bg-gradient-to-r from-[#00f2fe]/20 to-[#7f00ff]/30 text-white border-[#00f2fe] shadow-[0_0_12px_rgba(0,242,254,0.4)]'
                : 'bg-black/85 text-cyan-300 border-cyan-500/40 hover:border-cyan-300 hover:text-white'
            }`}
            title={`Active Persona Tone: ${personaToneMeta[autoPilotTone]?.label || 'Direct Action'}. Click to switch.`}
          >
            <Wand2 className="w-3.5 h-3.5 text-[#00f2fe]" />
            <span className="text-[10px] uppercase tracking-wider text-slate-400 hidden xs:inline">Tone:</span>
            <span className="text-[10.5px] font-bold text-white">
              {personaToneMeta[autoPilotTone]?.label || 'Direct Action'}
            </span>
            <ChevronDown className={`w-3 h-3 text-cyan-400 transition-transform ${showToneMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* AUTONOMOUS AUTO-DISPATCH ACTIVE BANNER */}
      {isAutoMode && autoCountdown !== null && (
        <div className="px-3 py-2 bg-gradient-to-r from-[#0B0B0C] via-[#05141c] to-[#0B0B0C] border-b border-[#00f2fe]/60 shadow-[0_0_25px_rgba(0,242,254,0.3)] animate-in slide-in-from-top-2 duration-150 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00f2fe] animate-ping" />
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#00f2fe]">
                <Zap className="w-3.5 h-3.5 text-[#00f2fe]" />
                <span>AUTO-ANSWERING IN {autoCountdown}s...</span>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-[#7f00ff]/20 text-[#c084fc] border border-[#7f00ff]/40 uppercase font-bold">
                {autoPilotTone}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  triggerHaptic(20);
                  onInstantAutoDispatch?.();
                }}
                className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-[#00f2fe] to-[#0575e6] text-black text-[10px] font-mono font-bold hover:brightness-110 active:scale-95 shadow-[0_0_12px_rgba(0,242,254,0.4)] transition"
              >
                Send Now ⚡
              </button>
              <button
                onClick={onCancelAutoDispatch}
                className="px-2 py-0.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/40 text-[10px] font-mono hover:bg-red-500/25 transition"
              >
                Override
              </button>
            </div>
          </div>

          {/* Countdown timer bar */}
          <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-[#00f2fe] via-[#7f00ff] to-[#0575e6] transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${Math.max(10, ((autoCountdown || 1) / 3) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-200">
            <span className="truncate italic pr-2">
              "{autoDispatchPreviewText || currentText || 'Generating optimal response...'}"
            </span>
            {autoDispatchTarget && (
              <span className="text-[9px] text-slate-400 shrink-0">
                To: {autoDispatchTarget}
              </span>
            )}
          </div>
        </div>
      )}

      {/* AUTONOMOUS AUTO-PILOT COCKPIT STRIP (When Auto Mode is ON but idle) */}
      {isAutoMode && autoCountdown === null && (
        <div className="px-3 py-1.5 bg-[#05141c]/60 border-b border-[#00f2fe]/30 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[10px] text-[#00f2fe]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f2fe] animate-pulse" />
            <span className="font-bold">AUTO-PILOT ACTIVE:</span>
            <span className="text-slate-300">Omni Key will autonomously answer incoming messages.</span>
          </div>

          {onChangeAutoPilotTone && (
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500">Tone:</span>
              <select
                value={autoPilotTone}
                onChange={(e) => onChangeAutoPilotTone(e.target.value as any)}
                className="bg-black text-[10px] text-[#00f2fe] border border-white/10 rounded px-1.5 py-0.5 focus:outline-none font-mono"
              >
                <option value="directAction">Direct Action</option>
                <option value="rawHonest">Raw & Honest</option>
                <option value="witty">Witty & Magnetic</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* PERSISTENT PERSONA TONE SELECTION MODAL / DROPDOWN */}
      {showToneMenu && (
        <div className="p-3 bg-[#080b12] border-b border-cyan-500/30 animate-in slide-in-from-top-2 duration-150 space-y-2.5 shadow-2xl relative z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-[#00f2fe]" />
              <span className="font-bold text-xs text-white font-mono">Persona Tone Selector</span>
              <span className="text-[10px] text-slate-400 font-mono">• Switch AI Response Style</span>
            </div>
            <button
              type="button"
              onClick={() => setShowToneMenu(false)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10"
              title="Close tone selector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['directAction', 'rawHonest', 'witty'] as const).map((toneKey) => {
              const meta = personaToneMeta[toneKey];
              const Icon = meta.icon;
              const isSelected = autoPilotTone === toneKey;

              return (
                <button
                  key={toneKey}
                  type="button"
                  onClick={() => {
                    triggerHaptic([12, 24, 12]);
                    onChangeAutoPilotTone?.(toneKey);
                    setShowToneMenu(false);
                  }}
                  className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-950/50 border-[#00f2fe] shadow-[0_0_15px_rgba(0,242,254,0.3)]'
                      : 'bg-black/80 border-white/10 hover:border-white/25 hover:bg-black/95'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      <span className="font-bold text-xs text-white font-mono">{meta.label}</span>
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-[#00f2fe]/20 text-[#00f2fe] border border-[#00f2fe]/40 font-bold">
                        <Check className="w-2.5 h-2.5" /> ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-snug font-sans">
                    {meta.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. CONTEXTUAL QUICK ACTIONS ROW */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#07080e] border-b border-white/10 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 text-[9.5px] font-mono text-[#00f2fe] shrink-0 font-bold uppercase tracking-wider pr-1.5 border-r border-white/10">
          <Sparkles className="w-3 h-3 text-[#00f2fe]" />
          <span>Quick:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const isProcessing = activeQuickAction === action.id;
            const isDone = quickActionFeedback === action.id;
            return (
              <button
                key={action.id}
                onClick={() => handleTriggerQuickAction(action.id)}
                disabled={isProcessing}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 border border-white/10 text-[10.5px] font-mono font-medium transition-all shrink-0 active:scale-95 shadow-sm ${action.color} ${
                  isDone ? 'border-[#00f2fe] bg-[#00f2fe]/15 text-[#00f2fe] shadow-[0_0_10px_rgba(0,242,254,0.3)]' : ''
                }`}
                title={action.desc}
              >
                <Icon className={`w-3 h-3 ${isProcessing ? 'animate-spin text-[#00f2fe]' : isDone ? 'text-[#00f2fe]' : ''}`} />
                <span>{action.label}</span>
                {isDone && <Check className="w-2.5 h-2.5 text-[#00f2fe]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE TYPING DOCK */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0B0B0C] border-t border-white/10">
        <button
          onClick={handleMicDictate}
          className={`p-2 rounded-xl border transition ${
            isListening
              ? 'bg-[#7f00ff]/20 text-[#00f2fe] border-[#00f2fe] animate-pulse shadow-[0_0_12px_rgba(0,242,254,0.5)]'
              : 'bg-black text-slate-400 border-white/10 hover:text-white'
          }`}
          title="Dictate raw thoughts"
        >
          <Mic className="w-4 h-4" />
        </button>

        {/* OmniVoice Speak Button */}
        <button
          onClick={() => {
            if (currentText) {
              omniVoice.speak(currentText);
            } else {
              omniVoice.speak('OmniAI shadow companion active. Standing by for screen cognition.');
            }
          }}
          className="p-2 rounded-xl border bg-black text-slate-400 border-white/10 hover:text-[#00f2fe] hover:border-[#00f2fe]/40 transition"
          title="Listen to OmniVoice"
        >
          <Volume2 className="w-4 h-4" />
        </button>

        {/* Input buffer */}
        <div className="relative flex-1">
          <input
            type="text"
            value={currentText}
            onChange={(e) => onChangeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSend(currentText);
              }
            }}
            placeholder="Type with Omni AI • Dark Misfit Studios..."
            className="w-full rounded-xl bg-[#000000] border border-white/15 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe]/80 focus:ring-1 focus:ring-[#00f2fe]/40 font-mono transition pr-8 shadow-inner"
          />
          {currentText && (
            <button
              onClick={() => onChangeText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 font-bold"
              title="Clear text"
            >
              ×
            </button>
          )}
        </div>

        {/* Copy to system clipboard */}
        <button
          onClick={handleCopy}
          disabled={!currentText}
          className={`p-2 rounded-xl border transition disabled:opacity-30 ${
            copied
              ? 'bg-[#00f2fe]/20 text-[#00f2fe] border-[#00f2fe]/50 shadow-[0_0_10px_rgba(0,242,254,0.3)]'
              : 'bg-black text-slate-300 border-white/10 hover:bg-[#18181b]'
          }`}
          title="Copy text to phone clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-[#00f2fe]" /> : <Copy className="w-4 h-4" />}
        </button>

        {/* Send / Commit into input stream */}
        <button
          onClick={() => onSend(currentText)}
          disabled={!currentText}
          className="p-2 rounded-xl bg-gradient-to-r from-[#00f2fe] via-[#7f00ff] to-[#0575e6] text-black font-bold shadow-[0_0_15px_rgba(0,242,254,0.3)] hover:brightness-110 active:scale-95 transition disabled:opacity-40"
          title="Send into conversation"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
