import React, { useState, useMemo } from 'react';
import {
  Mic,
  Play,
  Sparkles,
  RotateCcw,
  Volume2,
  Globe,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  Search,
  User,
  Users,
  Filter,
  Activity,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../firebase/authContext';
import { generateTTS, updateUserSettings } from '../services/apiClient';
import { TTSVoice, UserBalance, UserSettings, TTSGeneration, GenerationStatus } from '../types/tts';
import { ALL_30_GEMINI_VOICES } from '../data/voices';
import { AudioPlayer } from './AudioPlayer';

const SAMPLE_TEXTS = [
  {
    title: 'قصيدة عربية فصحى',
    text: 'وَما نَيلُ المَطالِبِ بِالتَمَنّي\nوَلَكِن تُؤخَذُ الدُنيا غِلابا\nوَما اِستَعصى عَلى قَومٍ مَنالٌ\nإِذا كانَ الإِقدامُ لَهُم رِكابا',
    voice: 'Charon',
    style: 'سردي وقصصي',
  },
  {
    title: 'نشرة تقنية وإخبارية',
    text: 'أعلنت شركة جوجل عن أحدث نماذج الذكاء الاصطناعي لتحويل النص إلى كلام، مع تمكين المطورين من بناء حلول صوتية فائقة الواقعية تدعم اللغة العربية بدقة استثنائية ونبرات صوتية طبيعية.',
    voice: 'Puck',
    style: 'إخباري ورسمي',
  },
  {
    title: 'مقدمة بودكاست ثقافي',
    text: 'أهلاً بكم في حلقة جديدة من بودكاست آفاق المعرفة. سنتحدث اليوم عن رحلة الإنسان مع اللغة والصوت، وكيف شكّلت الكلمة المنطوقة جسور التواصل عبر آلاف السنين.',
    voice: 'Aoede',
    style: 'بودكاست وحواري',
  },
  {
    title: 'إعلان تسويقي تحفيزي',
    text: 'انطلق بأفكارك إلى مستوى جديد كلياً. صمم منصتك اليوم بقوة تقنيات الذكاء الاصطناعي الأكثر تطوراً واستمتع بسرعة وأداء لا يضاهى.',
    voice: 'Fenrir',
    style: 'تحفيزي وإعلاني',
  },
];

const PERFORMANCE_STYLES = [
  'طبيعي',
  'سردي وقصصي',
  'إخباري ورسمي',
  'بودكاست وحواري',
  'تحفيزي وإعلاني',
];

const LANGUAGES = [
  'العربية',
  'English (US)',
  'English (UK)',
  'Français',
  'Español',
  'Deutsch',
  'Türkçe',
];

interface TTSStudioProps {
  balance: UserBalance | null;
  settings: UserSettings | null;
  onRefreshBalance: () => void;
  onOpenAuth: () => void;
  onNavigateToByok: () => void;
  onGenerationComplete: (gen: TTSGeneration) => void;
}

export function TTSStudio({
  balance,
  settings,
  onRefreshBalance,
  onOpenAuth,
  onNavigateToByok,
  onGenerationComplete,
}: TTSStudioProps) {
  const { getIdToken, user } = useAuth();

  const [text, setText] = useState<string>('مرحباً بك في منصة تحويل النص إلى كلام الاحترافية عبر نماذج Google Gemini. اكتب أي نص وسأقوم بتحويله إلى نطق صوتي فائق النقاء فوراً.');
  const [selectedVoice, setSelectedVoice] = useState<string>(settings?.preferredVoice || 'Puck');
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'ALL' | 'male' | 'female'>('ALL');
  const [voiceSearch, setVoiceSearch] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(settings?.preferredLanguage || 'العربية');
  const [selectedStyle, setSelectedStyle] = useState<string>(settings?.style || 'طبيعي');
  const [speakingRate, setSpeakingRate] = useState<number>(settings?.speakingRate || 1.0);

  const currentVoiceObj = useMemo(() => {
    return ALL_30_GEMINI_VOICES.find((v) => v.id === selectedVoice) || ALL_30_GEMINI_VOICES[0];
  }, [selectedVoice]);

  const filteredVoices = useMemo(() => {
    return ALL_30_GEMINI_VOICES.filter((voice) => {
      const matchesGender =
        voiceGenderFilter === 'ALL' ? true : voice.gender === voiceGenderFilter;
      const q = voiceSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        voice.name.toLowerCase().includes(q) ||
        voice.arabicTitle.toLowerCase().includes(q) ||
        voice.description.toLowerCase().includes(q) ||
        voice.badge.toLowerCase().includes(q) ||
        (voice.tone && voice.tone.toLowerCase().includes(q)) ||
        (voice.tags && voice.tags.some((t) => t.toLowerCase().includes(q)));
      return matchesGender && matchesSearch;
    });
  }, [voiceGenderFilter, voiceSearch]);

  const [status, setStatus] = useState<GenerationStatus | 'IDLE'>('IDLE');
  const [currentResult, setCurrentResult] = useState<{
    audioUrl: string;
    generationId: string;
    textLength: number;
    voice: string;
    usedByok: boolean;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isByokActive = settings?.providerMode === 'byok' && settings?.hasCustomApiKey;
  const charCount = text.trim().length;
  const remainingChars = balance?.remainingCharacters ?? 10000;
  const hasEnoughBalance = isByokActive || remainingChars >= charCount;

  const daysUntilRenewal = balance?.daysUntilRenewal ?? 30;

  const handleSwitchToSite = async () => {
    try {
      const token = await getIdToken();
      await updateUserSettings(token, { providerMode: 'site' });
      onRefreshBalance();
      setErrorMessage(null);
    } catch (err) {
      console.error('Failed to switch mode:', err);
    }
  };

  const handleGenerate = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    if (!text.trim()) {
      setErrorMessage('يرجى كتابة نص لتوليد الصوت.');
      return;
    }

    if (!isByokActive && remainingChars < charCount) {
      setErrorMessage(
        `رصيد الأحرف غير كافٍ. المتبقي لديك: ${remainingChars.toLocaleString()} حرف، والمطلوب: ${charCount.toLocaleString()} حرف. يتجدد الرصيد تلقائياً كل 30 يوماً (بعد ${daysUntilRenewal} يوم)، أو يمكنك إضافة مفتاح Gemini الخاص بك (BYOK) للمتابعة بلا حدود.`
      );
      return;
    }

    setErrorMessage(null);
    setStatus('QUEUED');

    try {
      const token = await getIdToken();
      setStatus('PROCESSING');

      const result = await generateTTS(token, {
        text: text.trim(),
        voice: selectedVoice,
        language: selectedLanguage,
        speakingRate,
        style: selectedStyle,
        providerMode: isByokActive ? 'byok' : 'site',
      });

      setStatus('COMPLETED');
      setCurrentResult({
        audioUrl: result.audioUrl,
        generationId: result.generationId,
        textLength: result.textLength,
        voice: result.voice,
        usedByok: result.usedByok,
      });

      onRefreshBalance();

      // Notify parent of new generation
      onGenerationComplete({
        generationId: result.generationId,
        uid: user?.uid || '',
        text: text.trim(),
        textLength: result.textLength,
        provider: 'Gemini',
        voice: result.voice,
        language: selectedLanguage,
        speakingRate,
        style: selectedStyle,
        status: 'COMPLETED',
        audioUrl: result.audioUrl,
        usedByok: result.usedByok,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Generation failure:', err);
      setStatus('FAILED');
      setErrorMessage(err?.message || 'حدث خطأ أثناء توليد الصوت. يرجى المحاولة لاحقاً.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* قسم الحصة والرصيد المنظم باحترافية */}
      <div className="space-y-4">
        {/* شبكة البطاقات الأربع (مخفية بناءً على طلبك مع الحفاظ على الكود وجميع البيانات والوظائف بالكامل دون حذف أي شيء) */}
        <div className="hidden" aria-hidden="true">
          
          {/* البطاقة 1: الوضع النشط */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg transition-all space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                <span>الوضع النشط</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug">
                {!user ? (
                  <span className="text-slate-300">تسجيل الدخول مطلوب</span>
                ) : isByokActive ? (
                  <span className="text-emerald-400">مفتاح خاص (BYOK)</span>
                ) : (
                  <span>حصة Google الشهرية (10,000 حرف)</span>
                )}
              </h3>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800/90 text-slate-200 border border-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Google UID معزول</span>
                </span>
              </div>
            </div>

            {!user ? (
              <button
                onClick={onOpenAuth}
                className="mt-2 w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>دخول بحساب Google</span>
              </button>
            ) : (
              <p className="text-[11px] text-slate-500">
                حساب Google الخاص بك معزول وآمن تماماً.
              </p>
            )}
          </div>

          {/* البطاقة 2: المتبقي */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg transition-all space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>المتبقي</span>
              </span>
              <span className="text-[11px] font-mono font-semibold text-cyan-400/90 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                الحصة الشهرية
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                  {remainingChars.toLocaleString()}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-300">
                  حرف من الحصة الشهرية
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>يتجدد الرصيد تلقائيًا بعد {daysUntilRenewal} يوم.</span>
              </p>
            </div>

            {/* شريط تقدم بياني خفيف وواضح */}
            <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, (remainingChars / 10000) * 100))}%` }}
              />
            </div>
          </div>

          {/* البطاقة 3: حصة Google */}
          <div className={`rounded-2xl p-5 flex flex-col justify-between shadow-lg transition-all space-y-3 border ${
            !isByokActive
              ? 'bg-slate-900/90 border-indigo-500/40 shadow-indigo-500/5 ring-1 ring-indigo-500/20'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700/80'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>حصة Google</span>
              </span>
              {!isByokActive ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  نشط الآن
                </span>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-indigo-300 font-mono tracking-tight">
                {remainingChars.toLocaleString()} <span className="text-xs font-sans text-slate-400 font-medium">حرف</span>
              </div>
              <p className="text-xs text-slate-400">
                10,000 حرف مجانًا في الشهر لكل حساب مستقل.
              </p>
            </div>

            {user && isByokActive ? (
              <button
                onClick={handleSwitchToSite}
                className="w-full py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all cursor-pointer"
              >
                تفعيل حصة Google
              </button>
            ) : (
              <div className="text-[11px] text-slate-500">
                الرصيد الأساسي المتاح للاستخدام
              </div>
            )}
          </div>

          {/* البطاقة 4: مفتاح خاص (BYOK) */}
          <div className={`rounded-2xl p-5 flex flex-col justify-between shadow-lg transition-all space-y-3 border ${
            isByokActive
              ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-500/5 ring-1 ring-emerald-500/20'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700/80'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                <span>مفتاح خاص (BYOK)</span>
              </span>
              {isByokActive && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  نشط الآن
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-200">
                {settings?.hasCustomApiKey ? (
                  <span className="font-mono text-xs text-emerald-400">{settings?.maskedApiKey}</span>
                ) : (
                  <span>توليد غير محدود</span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                استخدم مفتاح Gemini API الخاص بك بدون أي قيود على الرصيد.
              </p>
            </div>

            {settings?.hasCustomApiKey ? (
              <div className="flex items-center gap-2">
                {!isByokActive ? (
                  <button
                    onClick={() => {
                      getIdToken()
                        .then((token) => updateUserSettings(token, { providerMode: 'byok' }))
                        .then(() => onRefreshBalance());
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    تفعيل المفتاح
                  </button>
                ) : null}
                <button
                  onClick={onNavigateToByok}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all cursor-pointer"
                >
                  إدارة المفتاح
                </button>
              </div>
            ) : (
              <button
                id="activate-byok-banner-btn"
                onClick={onNavigateToByok}
                className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>إضافة مفتاحك</span>
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Text Input & Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Editor Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-200">النص المراد تحويله</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  id="clear-text-btn"
                  onClick={() => setText('')}
                  className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                >
                  مسح النص
                </button>
                <div className="flex items-center gap-1 font-mono text-xs">
                  <span className={`font-bold ${charCount > 10000 ? 'text-amber-400' : 'text-indigo-400'}`}>
                    {charCount.toLocaleString()}
                  </span>
                  <span className="text-slate-500">/ 15,000</span>
                </div>
              </div>
            </div>

            {/* Big Textarea */}
            <div className="relative">
              <textarea
                id="tts-input-textarea"
                rows={7}
                dir="auto"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="اكتب أو الصق النص هنا ليتم تحويله إلى صوت بواسطة Gemini TTS..."
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-2xl p-4 text-slate-100 placeholder-slate-500 text-sm sm:text-base leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
              />
            </div>

            {/* Quick Sample Presets */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-400">أمثلة نصوص جاهزة للتجربة السريعة:</span>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_TEXTS.map((sample, idx) => (
                  <button
                    key={idx}
                    id={`sample-preset-${idx}`}
                    onClick={() => {
                      setText(sample.text);
                      setSelectedVoice(sample.voice);
                      setSelectedStyle(sample.style);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs transition-colors"
                  >
                    {sample.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Synthesis Settings Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>إعدادات النطق والأداء الصوتي</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Language Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>اللغة المستهدفة</span>
                </label>
                <select
                  id="tts-language-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* Performance Tone / Style */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                  <span>نبرة الأداء الصوتي</span>
                </label>
                <select
                  id="tts-style-select"
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {PERFORMANCE_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Speaking Rate Slider */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">سرعة الإلقاء (Speaking Rate):</span>
                <span className="font-mono font-bold text-indigo-400">{speakingRate}x</span>
              </div>
              <input
                id="tts-speed-slider"
                type="range"
                min={0.5}
                max={2.0}
                step={0.25}
                value={speakingRate}
                onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.5x (بطيء)</span>
                <span>1.0x (عادي)</span>
                <span>1.5x (سريع)</span>
                <span>2.0x (مضاعف)</span>
              </div>
            </div>
          </div>

          {/* Action Row & Error Alerts */}
          {errorMessage && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-300 flex flex-col sm:flex-row items-start justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-200">تنبيه أثناء المعالجة:</p>
                  <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
                </div>
              </div>

              {(errorMessage.includes('BYOK') || errorMessage.includes('المفتاح الخاص') || errorMessage.includes('مفتاح API')) && (
                <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 shrink-0">
                  <button
                    onClick={handleSwitchToSite}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
                  >
                    التبديل إلى API الموقع والمتابعة
                  </button>
                  <button
                    onClick={onNavigateToByok}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all cursor-pointer"
                  >
                    إضافة مفتاحي الخاص
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Status Pipeline Display during processing */}
          {status !== 'IDLE' && status !== 'COMPLETED' && (
            <div className="rounded-2xl bg-indigo-950/40 border border-indigo-800/40 p-4 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                <div>
                  <span className="font-bold text-indigo-200">
                    {status === 'QUEUED' ? 'في طابور المعالجة (QUEUED)...' : 'جاري توليد الصوت بـ Gemini TTS (PROCESSING)...'}
                  </span>
                  <p className="text-[11px] text-indigo-300/80 mt-0.5">
                    حماية التكرار Idempotency-Key مفعلة لمنع أي تكرار أو خصم مزدوج.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full font-mono text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {status}
              </span>
            </div>
          )}

          {/* Generate Button */}
          {!user ? (
            <button
              id="tts-generate-submit-btn"
              onClick={onOpenAuth}
              className="w-full py-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl bg-white hover:bg-slate-100 text-slate-900 transition-all active:scale-[0.99] cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>تسجيل الدخول عبر Google للبدء (10,000 حرف مجاناً)</span>
            </button>
          ) : !isByokActive && remainingChars < charCount ? (
            <button
              id="tts-generate-submit-btn"
              disabled
              className="w-full py-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-3 bg-slate-800/80 text-rose-300 border border-rose-500/30 cursor-not-allowed shadow-lg"
            >
              <AlertCircle className="w-5 h-5 text-rose-400" />
              <span>نفد الرصيد الشهري ({remainingChars.toLocaleString()} حرف متبقٍ • يتجدد بعد {daysUntilRenewal} يوم)</span>
            </button>
          ) : (
            <button
              id="tts-generate-submit-btn"
              disabled={status === 'QUEUED' || status === 'PROCESSING' || !text.trim()}
              onClick={handleGenerate}
              className={`w-full py-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.99] ${
                status === 'QUEUED' || status === 'PROCESSING' || !text.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-indigo-600/25 cursor-pointer'
              }`}
            >
              {status === 'QUEUED' || status === 'PROCESSING' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري معالجة الصوت بأمان...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>توليد الصوت الآن ({charCount.toLocaleString()} حرف)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right Column: Voice Selection & Audio Player (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Audio Player if generated */}
          {currentResult && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تم التوليد بنجاح! جاهز للاستماع والتنزيل</span>
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {currentResult.usedByok ? 'BYOK Key' : 'Site API'}
                </span>
              </div>
              <AudioPlayer
                audioUrl={currentResult.audioUrl}
                voiceName={currentResult.voice}
                generationId={currentResult.generationId}
                text={text}
              />
            </div>
          )}

          {/* Voice Selector Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            {/* Header with Total Count & AI Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>أصوات Gemini المتاحة</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      30 صوتاً واقعياً
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    شخصيات رقمية واقعية مولدة بالذكاء الاصطناعي (1x Aspect Ratio)
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-semibold text-emerald-400 self-start sm:self-auto bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                AI Personas 1x
              </span>
            </div>

            {/* Currently Selected Voice - Featured Spotlight */}
            {currentVoiceObj && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 shadow-lg space-y-3">
                <div className="flex items-start gap-4">
                  {/* 1:1 AI Face Avatar */}
                  <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 ring-2 ring-indigo-500/50 shadow-xl bg-slate-950">
                    <img
                      src={currentVoiceObj.avatarUrl}
                      alt={currentVoiceObj.arabicTitle}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80';
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent py-1 text-center">
                      <span className="text-[9px] font-mono text-cyan-300 font-bold tracking-tight">
                        ذكاء اصطناعي 1x
                      </span>
                    </div>
                  </div>

                  {/* Voice Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{currentVoiceObj.arabicTitle}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/25 text-indigo-200 border border-indigo-500/30">
                          {currentVoiceObj.badge}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300">
                          {currentVoiceObj.gender === 'male' ? 'صوت رجالي' : 'صوت نسائي'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md">
                        محدد حالياً
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mt-1">
                      {currentVoiceObj.description}
                    </p>

                    {currentVoiceObj.tags && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {currentVoiceObj.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800/80 text-slate-400 border border-slate-700/50"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Search & Gender Filters */}
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={voiceSearch}
                  onChange={(e) => setVoiceSearch(e.target.value)}
                  placeholder="ابحث بين 30 صوتاً بالاسم، النبرة، أو المجال..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                {voiceSearch && (
                  <button
                    onClick={() => setVoiceSearch('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white"
                  >
                    مسح
                  </button>
                )}
              </div>

              {/* Gender Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  onClick={() => setVoiceGenderFilter('ALL')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    voiceGenderFilter === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  الكل ({ALL_30_GEMINI_VOICES.length})
                </button>
                <button
                  onClick={() => setVoiceGenderFilter('male')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    voiceGenderFilter === 'male'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  رجالي (15)
                </button>
                <button
                  onClick={() => setVoiceGenderFilter('female')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    voiceGenderFilter === 'female'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  نسائي (15)
                </button>
              </div>
            </div>

            {/* Scrollable Voice Grid List */}
            <div className="space-y-2 max-h-[460px] overflow-y-auto pl-1 pr-0.5 custom-scrollbar">
              {filteredVoices.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  لا توجد نتائج تطابق بحثك. جرب كتابة اسم آخر أو مسح البحث.
                </div>
              ) : (
                filteredVoices.map((voice) => {
                  const isSelected = selectedVoice === voice.id;
                  return (
                    <div
                      key={voice.id}
                      id={`voice-card-${voice.id}`}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-600/15 border-indigo-500/60 shadow-md shadow-indigo-600/15'
                          : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* 1:1 Aspect Ratio AI Face Avatar */}
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-slate-700/80 shadow-md bg-slate-950">
                            <img
                              src={voice.avatarUrl}
                              alt={voice.arabicTitle}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80';
                              }}
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-[1px] py-0.5 text-center">
                              <span className="text-[8px] font-mono text-cyan-300 leading-none block">
                                AI 1x
                              </span>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-100">{voice.arabicTitle}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                                  isSelected
                                    ? 'bg-indigo-500/30 text-indigo-200'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {voice.badge}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {voice.gender === 'male' ? '• ذكر' : '• أنثى'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 leading-relaxed">
                              {voice.description}
                            </p>
                          </div>
                        </div>

                        {/* Radio Check Circle */}
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-700'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Security & Quota Isolation Assurance Card */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>ضمانات العزل والأمان</span>
            </div>
            <ul className="space-y-1.5 text-slate-400 text-[11px] list-disc list-inside leading-relaxed">
              <li>المعرف الأساسي لكل العمليات هو <strong className="text-slate-300">Firebase UID</strong> الحصري.</li>
              <li>لا يتم تخزين أي مفتاح API على المتصفح أو في شفرة الـ Frontend.</li>
              <li>حماية Race Condition عبر معاملات المعالجة والـ Idempotency Keys.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
