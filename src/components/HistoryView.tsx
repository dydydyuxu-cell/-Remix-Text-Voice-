import React, { useState } from 'react';
import {
  History,
  Trash2,
  Download,
  Play,
  Volume2,
  Calendar,
  Sparkles,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  KeyRound,
} from 'lucide-react';
import { TTSGeneration } from '../types/tts';
import { ALL_30_GEMINI_VOICES } from '../data/voices';
import { useAuth } from '../firebase/authContext';
import { deleteGeneration } from '../services/apiClient';
import { AudioPlayer } from './AudioPlayer';

interface HistoryViewProps {
  generations: TTSGeneration[];
  onRefresh: () => void;
  onNavigateToStudio: () => void;
  onOpenAuth?: () => void;
}

export function HistoryView({
  generations,
  onRefresh,
  onNavigateToStudio,
  onOpenAuth,
}: HistoryViewProps) {
  const { getIdToken, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVoice, setFilterVoice] = useState('ALL');
  const [expandedTextId, setExpandedTextId] = useState<string | null>(null);
  const [activePlayId, setActivePlayId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (genId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا التسجيل؟')) return;
    try {
      setDeletingId(genId);
      const token = await getIdToken();
      await deleteGeneration(token, genId);
      onRefresh();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = generations.filter((gen) => {
    const matchesSearch =
      searchTerm === '' ||
      gen.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gen.voice.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVoice = filterVoice === 'ALL' || gen.voice === filterVoice;
    return matchesSearch && matchesVoice;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/15 text-indigo-400 border border-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white">سجل التحويلات الصوتية</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              سجل معزول كلياً تحت UID: <span className="font-mono text-slate-300">{user?.uid}</span>
            </span>
          </p>
        </div>

        <button
          id="history-start-new-btn"
          onClick={onNavigateToStudio}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>تحويل نص جديد</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="history-search-input"
            type="text"
            placeholder="بحث في النصوص الصوتية السابقة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            id="history-voice-filter"
            value={filterVoice}
            onChange={(e) => setFilterVoice(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">جميع الأصوات (30 صوتاً)</option>
            {ALL_30_GEMINI_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.arabicTitle} - {v.badge}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Generations List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
            <Volume2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-200">لا توجد تسجيلات حتى الآن</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              سجلك فارغ لهذا الحساب. ابدأ بكتابة أي نص في الاستوديو لتحويله بصوت واقعي من Gemini.
            </p>
          </div>
          <button
            id="history-empty-cta-btn"
            onClick={onNavigateToStudio}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            الانتقال للاستوديو الصوتي
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((gen) => {
            const isPlayingThis = activePlayId === gen.generationId;
            const isTextExpanded = expandedTextId === gen.generationId;

            return (
              <div
                key={gen.generationId}
                id={`gen-card-${gen.generationId}`}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 transition-all hover:border-slate-700/80"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {(() => {
                      const voiceObj = ALL_30_GEMINI_VOICES.find((v) => v.id === gen.voice);
                      return (
                        <>
                          {voiceObj && (
                            <div className="relative w-7 h-7 rounded-lg overflow-hidden shrink-0 ring-1 ring-slate-700 shadow-sm bg-slate-950">
                              <img
                                src={voiceObj.avatarUrl}
                                alt={voiceObj.arabicTitle}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span>{voiceObj ? voiceObj.arabicTitle : gen.voice}</span>
                          </span>
                        </>
                      );
                    })()}

                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                      {gen.language}
                    </span>

                    {gen.style && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {gen.style}
                      </span>
                    )}

                    <span className="font-mono text-slate-400 text-[11px]">
                      {gen.textLength} حرف
                    </span>

                    {gen.usedByok && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <KeyRound className="w-3 h-3" />
                        <span>BYOK</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(gen.createdAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>

                    <button
                      id={`delete-gen-btn-${gen.generationId}`}
                      disabled={deletingId === gen.generationId}
                      onClick={() => handleDelete(gen.generationId)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="حذف هذا السجل"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Text excerpt */}
                <div className="bg-slate-950/60 rounded-xl p-3 text-xs text-slate-200 leading-relaxed font-sans border border-slate-800/60">
                  <p className={isTextExpanded ? '' : 'line-clamp-2'}>
                    {gen.text}
                  </p>
                  {gen.text.length > 140 && (
                    <button
                      onClick={() => setExpandedTextId(isTextExpanded ? null : gen.generationId)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold mt-1"
                    >
                      {isTextExpanded ? 'عرض أقل' : 'عرض النص كاملاً...'}
                    </button>
                  )}
                </div>

                {/* Embedded Audio Player if available */}
                {gen.audioUrl && (
                  <div className="pt-1">
                    <AudioPlayer
                      audioUrl={gen.audioUrl}
                      voiceName={gen.voice}
                      generationId={gen.generationId}
                      text={gen.text}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
