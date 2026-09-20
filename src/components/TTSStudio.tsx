import React, { useMemo, useState } from 'react';
import {
  Mic,
  Sparkles,
  Volume2,
  Globe,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  Activity,
  Calendar,
} from 'lucide-react';

import { useAuth } from '../firebase/authContext';
import { generateTTS } from '../services/apiClient';
import type { BalanceInfo, UserSettings } from '../types';
import { VOICES } from '../data/voices';

interface TTSStudioProps {
  balance: BalanceInfo | null;
  settings: UserSettings | null;
  onNavigate: (page: string) => void;
  onBalanceRefresh: () => Promise<void> | void;
}

type GenerationStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

const MAX_TEXT_LENGTH = 15000;

function voiceValue(voice: unknown): string {
  if (!voice || typeof voice !== 'object') return '';

  const item = voice as Record<string, unknown>;

  return String(
    item.name ??
      item.voiceName ??
      item.id ??
      item.value ??
      ''
  );
}

function voiceLabel(voice: unknown): string {
  if (!voice || typeof voice !== 'object') return '';

  const item = voice as Record<string, unknown>;

  return String(
    item.label ??
      item.displayName ??
      item.name ??
      item.voiceName ??
      item.id ??
      ''
  );
}

export default function TTSStudio({
  balance,
  settings,
  onNavigate,
  onBalanceRefresh,
}: TTSStudioProps) {
  const { user, getIdToken } = useAuth();

  const [text, setText] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [language, setLanguage] = useState('ar');
  const [style, setStyle] = useState('طبيعي وواضح');
  const [speakingRate, setSpeakingRate] = useState(1);

  const [status, setStatus] =
    useState<GenerationStatus>('IDLE');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [audioUrl, setAudioUrl] = useState('');

  const voices = useMemo(
    () => (Array.isArray(VOICES) ? VOICES : []),
    []
  );

  const selectedVoice = useMemo(() => {
    if (voiceName) {
      return (
        voices.find(
          (voice) => voiceValue(voice) === voiceName
        ) ?? voices[0]
      );
    }

    return voices[0];
  }, [voices, voiceName]);

  const selectedVoiceName =
    voiceName || voiceValue(selectedVoice);

  const characterCount = text.length;

  const remainingCharacters =
    typeof balance?.remainingCharacters === 'number'
      ? balance.remainingCharacters
      : 0;

  const hasGeminiKey =
    settings?.provider === 'gemini' ||
    settings?.provider === 'byok' ||
    Boolean(settings?.geminiApiKeyMasked) ||
    Boolean(settings?.apiKeyMasked);

  const isBusy =
    status === 'QUEUED' ||
    status === 'PROCESSING';

  const canGenerate =
    Boolean(user) &&
    Boolean(text.trim()) &&
    characterCount <= MAX_TEXT_LENGTH &&
    characterCount <= remainingCharacters &&
    Boolean(selectedVoiceName) &&
    Boolean(hasGeminiKey) &&
    !isBusy;

  const handleGenerate = async () => {
    setError('');
    setSuccess('');
    setAudioUrl('');

    if (!user) {
      setError(
        'يرجى تسجيل الدخول بحساب Google أولاً.'
      );
      return;
    }

    const cleanText = text.trim();

    if (!cleanText) {
      setError('اكتب النص الذي تريد تحويله إلى صوت.');
      return;
    }

    if (cleanText.length > MAX_TEXT_LENGTH) {
      setError(
        `الحد الأقصى هو ${MAX_TEXT_LENGTH.toLocaleString()} حرف.`
      );
      return;
    }

    if (cleanText.length > remainingCharacters) {
      setError(
        `الرصيد غير كافٍ. المتاح لديك ${remainingCharacters.toLocaleString()} حرف.`
      );
      return;
    }

    if (!hasGeminiKey) {
      setError(
        'أضف Gemini API Key الخاص بك من إعدادات Gemini أولاً.'
      );
      return;
    }

    if (!selectedVoiceName) {
      setError('اختر الصوت أولاً.');
      return;
    }

    try {
      setStatus('QUEUED');

      const idToken = await getIdToken();

      setStatus('PROCESSING');

      const result = await generateTTS(
        {
          text: cleanText,
          voiceName: selectedVoiceName,
          language,
          style,
          speakingRate,
        },
        idToken
      );

      const generatedUrl =
        result?.audioUrl ??
        (result?.audioBase64
          ? `data:${result.mimeType ?? 'audio/wav'};base64,${result.audioBase64}`
          : '');

      if (!generatedUrl) {
        throw new Error(
          'لم يتم استلام ملف الصوت من الخادم.'
        );
      }

      setAudioUrl(generatedUrl);
      setStatus('COMPLETED');
      setSuccess(
        'تم إنشاء الصوت بنجاح وتم تحديث رصيدك.'
      );

      await onBalanceRefresh();
    } catch (err) {
      setStatus('FAILED');

      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء إنشاء الصوت.'
      );
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;

    const link = document.createElement('a');

    link.href = audioUrl;
    link.download = `tts-${Date.now()}.wav`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main
      dir="rtl"
      className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8"
    >
      {/* Header */}
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <Sparkles size={16} />
          <span>استوديو تحويل النص إلى صوت</span>
          <ChevronRight size={15} />
          <span>Gemini TTS</span>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              أنشئ صوتك بالذكاء الاصطناعي
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              اكتب النص واختر الصوت والإعدادات ثم أنشئ الملف
              الصوتي.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Calendar
                size={16}
                className="ml-2 inline"
              />
              السجل
            </button>

            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <KeyRound
                size={16}
                className="ml-2 inline"
              />
              إعدادات Gemini
            </button>
          </div>
        </div>
      </header>

      {/* Cards */}
      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Activity
            size={21}
            className="mb-3 text-slate-700"
          />

          <p className="text-xs text-slate-500">
            الرصيد المتبقي
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {remainingCharacters.toLocaleString()}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            حرف
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <KeyRound
            size={21}
            className="mb-3 text-slate-700"
          />

          <p className="text-xs text-slate-500">
            حالة Gemini
          </p>

          <p className="mt-1 text-lg font-bold text-slate-900">
            {hasGeminiKey ? 'متصل' : 'غير متصل'}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            مفتاحك الشخصي
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldCheck
            size={21}
            className="mb-3 text-slate-700"
          />

          <p className="text-xs text-slate-500">
            حساب Google
          </p>

          <p className="mt-1 truncate text-sm font-bold text-slate-900">
            {user?.email ?? 'غير مسجل الدخول'}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            رصيد مستقل لهذا الحساب
          </p>
        </div>
      </section>

      {/* Studio */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Text */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-slate-900">
                <Mic size={19} />
                النص
              </h2>

              <span
                className={
                  characterCount > remainingCharacters
                    ? 'text-xs font-medium text-red-600'
                    : 'text-xs text-slate-500'
                }
              >
                {characterCount.toLocaleString()} /{' '}
                {MAX_TEXT_LENGTH.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-5">
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setError('');
                setSuccess('');

                if (status !== 'IDLE') {
                  setStatus('IDLE');
                }
              }}
              maxLength={MAX_TEXT_LENGTH}
              dir="auto"
              placeholder="اكتب النص هنا..."
              className="min-h-[360px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-5 text-base leading-8 text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <ShieldCheck size={15} />
                الخصم من رصيد حسابك فقط.
              </span>

              <span>
                المتاح:{' '}
                <strong>
                  {remainingCharacters.toLocaleString()}
                </strong>
              </span>
            </
