import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Volume2,
  Globe,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  ShieldCheck,
  Activity,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { generateTTS } from '../services/apiClient';
import { ALL_30_GEMINI_VOICES } from '../data/voices';

type TTSStudioProps = {
  balance?: any;
  settings?: any;
  onBalanceRefresh?: () => void | Promise<void>;
};

type GenerationStatus =
  | 'idle'
  | 'generating'
  | 'success'
  | 'error';

const MAX_TEXT_LENGTH = 5000;

const voiceValue = (voice: unknown): string => {
  if (!voice || typeof voice !== 'object') {
    return '';
  }

  const item = voice as Record<string, unknown>;

  return String(
    item.id ??
      item.name ??
      item.voiceName ??
      ''
  );
};

const voiceLabel = (voice: unknown): string => {
  if (!voice || typeof voice !== 'object') {
    return 'صوت';
  }

  const item = voice as Record<string, unknown>;

  return String(
    item.arabicTitle ??
      item.name ??
      item.id ??
      'صوت'
  );
};

export default function TTSStudio({
  balance,
  settings,
  onBalanceRefresh,
}: TTSStudioProps) {
  const { user } = useAuth();

  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [language, setLanguage] = useState('ar');
  const [style, setStyle] = useState('natural');
  const [speakingRate, setSpeakingRate] = useState(1);

  const [status, setStatus] =
    useState<GenerationStatus>('idle');

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] =
    useState('');

  const [audioUrl, setAudioUrl] = useState('');

  const voices = useMemo(
    () =>
      Array.isArray(ALL_30_GEMINI_VOICES)
        ? ALL_30_GEMINI_VOICES
        : [],
    []
  );

  const selectedVoiceObject = useMemo(() => {
    return voices.find(
      (voice) => voiceValue(voice) === selectedVoice
    );
  }, [voices, selectedVoice]);

  const selectedVoiceName = useMemo(() => {
    if (!selectedVoiceObject) {
      return selectedVoice;
    }

    const item = selectedVoiceObject as Record<
      string,
      unknown
    >;

    return String(
      item.name ??
        item.id ??
        selectedVoice
    );
  }, [selectedVoiceObject, selectedVoice]);

  const characterCount = text.length;

  const remainingCharacters = useMemo(() => {
    const available =
      Number(
        balance?.remainingCharacters ??
          balance?.remaining ??
          balance?.charactersRemaining ??
          0
      ) || 0;

    return Math.max(
      0,
      available - characterCount
    );
  }, [balance, characterCount]);

  const hasGeminiKey =
    settings?.provider === 'gemini' ||
    settings?.provider === 'byok' ||
    Boolean(settings?.geminiApiKeyMasked) ||
    Boolean(settings?.apiKeyMasked);

  const isBusy = status === 'generating';

  const canGenerate =
    text.trim().length > 0 &&
    text.length <= MAX_TEXT_LENGTH &&
    Boolean(selectedVoice) &&
    !isBusy &&
    remainingCharacters >= 0;

  const handleGenerate = async () => {
    if (!canGenerate) {
      return;
    }

    setStatus('generating');
    setError('');
    setSuccessMessage('');
    setAudioUrl('');

    try {
      const currentUser =
        user as any;

      let token: string | undefined;

      if (
        currentUser &&
        typeof currentUser.getIdToken ===
          'function'
      ) {
        token =
          await currentUser.getIdToken();
      }

      const generate =
        generateTTS as unknown as (
          ...args: any[]
        ) => Promise<any>;

      let result: any;

      try {
        result = await generate({
          text: text.trim(),
          voiceName: selectedVoiceName,
          language,
          style,
          speakingRate,
          token,
          idToken: token,
        });
      } catch (firstError) {
        result = await generate(
          token,
          {
            text: text.trim(),
            voiceName: selectedVoiceName,
            language,
            style,
            speakingRate,
          }
        );
      }

      const directUrl =
        result?.audioUrl ??
        result?.url ??
        result?.data?.audioUrl ??
        result?.data?.url ??
        result?.result?.audioUrl ??
        result?.result?.url ??
        '';

      const base64 =
        result?.audioBase64 ??
        result?.base64 ??
        result?.audio ??
        result?.data?.audioBase64 ??
        result?.data?.base64 ??
        result?.result?.audioBase64 ??
        result?.result?.base64 ??
        '';

      let finalAudioUrl = '';

      if (directUrl) {
        finalAudioUrl = String(
          directUrl
        );
      } else if (base64) {
        finalAudioUrl =
          `data:audio/wav;base64,${String(
            base64
          )}`;
      }

      if (!finalAudioUrl) {
        throw new Error(
          'تم إنشاء الطلب لكن لم يتم استلام ملف الصوت.'
        );
      }

      setAudioUrl(finalAudioUrl);
      setStatus('success');
      setSuccessMessage(
        'تم إنشاء الصوت بنجاح.'
      );

      if (onBalanceRefresh) {
        await onBalanceRefresh();
      }
    } catch (err: any) {
      console.error(
        'TTS generation error:',
        err
      );

      const message =
        err?.message ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'حدث خطأ أثناء إنشاء الصوت.';

      setError(String(message));
      setStatus('error');
    }
  };

  const handleDownload = () => {
    if (!audioUrl) {
      return;
    }

    const link =
      document.createElement('a');

    link.href = audioUrl;
    link.download =
      'generated-voice.wav';

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-950 text-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
              <Volume2
                size={25}
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                استوديو تحويل النص إلى صوت
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                أنشئ صوتًا طبيعيًا باستخدام
                Gemini TTS
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          {/* Main */}
          <section className="space-y-6">
            {/* Text */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-bold">
                    النص
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    اكتب النص الذي تريد تحويله إلى
                    صوت
                  </p>
                </div>

                <span className="text-xs text-slate-400">
                  {characterCount.toLocaleString(
                    'ar-EG'
                  )}{' '}
                  /{' '}
                  {MAX_TEXT_LENGTH.toLocaleString(
                    'ar-EG'
                  )}
                </span>
              </div>

              <textarea
                value={text}
                onChange={(event) =>
                  setText(
                    event.target.value.slice(
                      0,
                      MAX_TEXT_LENGTH
                    )
                  )
                }
                placeholder="اكتب النص هنا..."
                rows={12}
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm leading-8 text-white outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-400">
                  المتبقي بعد هذه العملية:{' '}
                  <span className="font-bold text-slate-200">
                    {remainingCharacters.toLocaleString(
                      'ar-EG'
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles
                    size={18}
                  />

                  {isBusy
                    ? 'جاري إنشاء الصوت...'
                    : 'إنشاء الصوت'}
                </button>
              </div>
            </div>

            {/* Result */}
            {(status === 'error' ||
              status === 'success' ||
              audioUrl) && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                {status === 'error' &&
                  error && (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                      <AlertCircle
                        size={20}
                        className="mt-0.5 shrink-0"
                      />

                      <div>
                        <p className="font-bold">
                          حدث خطأ
                        </p>

                        <p className="mt-1 text-sm leading-6">
                          {error}
                        </p>
                      </div>
                    </div>
                  )}

                {status === 'success' &&
                  successMessage && (
                    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300">
                      <CheckCircle2
                        size={20}
                        className="mt-0.5 shrink-0"
                      />

                      <div>
                        <p className="font-bold">
                          تم بنجاح
                        </p>

                        <p className="mt-1 text-sm">
                          {successMessage}
                        </p>
                      </div>
                    </div>
                  )}

                {audioUrl && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Volume2
                        size={18}
                        className="text-indigo-400"
                      />

                      <h3 className="font-bold">
                        الصوت الناتج
                      </h3>
                    </div>

                    <audio
                      controls
                      src={audioUrl}
                      className="w-full"
                    />

                    <button
                      type="button"
                      onClick={
                        handleDownload
                      }
                      className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold transition hover:bg-white/10"
                    >
                      تحميل الصوت
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Settings */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Sliders
                    size={20}
                  />
                </div>

                <div>
                  <h2 className="font-bold">
                    إعدادات الصوت
                  </h2>

                  <p className="text-xs text-slate-400">
                    تحكم في شكل الصوت الناتج
                  </p>
                </div>
              </div>

              {/* Voice */}
              <div className="mb-5">
                <label className="mb-2 block text-sm font-bold">
                  الصوت
                </label>

                <select
                  value={selectedVoice}
                  onChange={(event) =>
                    setSelectedVoice(
                      event.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/60"
                >
                  <option value="">
                    اختر الصوت
                  </option>

                  {voices.map(
                    (voice: any) => (
                      <option
                        key={voiceValue(
                          voice
                        )}
                        value={voiceValue(
                          voice
                        )}
                      >
                        {voiceLabel(
                          voice
                        )}
                      </option>
                    )
                  )}
                </select>

                {selectedVoiceObject && (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                    <div className="flex items-center gap-3">
                      {selectedVoiceObject.avatarUrl ? (
                        <img
                          src={
                            selectedVoiceObject.avatarUrl
                          }
                          alt=""
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                          <Volume2
                            size={18}
                          />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {voiceLabel(
                            selectedVoiceObject
                          )}
                        </p>

                        {selectedVoiceObject.description && (
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {
                              selectedVoiceObject.description
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Language */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <Globe
                    size={16}
                  />
                  اللغة
                </label>

                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(
                      event.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/60"
                >
                  <option value="ar">
                    العربية
                  </option>

                  <option value="en">
                    English
                  </option>

                  <option value="fr">
                    Français
                  </option>

                  <option value="de">
                    Deutsch
                  </option>

                  <option value="es">
                    Español
                  </option>
                </select>
              </div>

              {/* Style */}
              <div className="mb-5">
                <label className="mb-2 block text-sm font-bold">
                  أسلوب الصوت
                </label>

                <select
                  value={style}
                  onChange={(event) =>
                    setStyle(
                      event.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/60"
                >
                  <option value="natural">
                    طبيعي
                  </option>

                  <option value="professional">
                    احترافي
                  </option>

                  <option value="friendly">
                    ودود
                  </option>

                  <option value="calm">
                    هادئ
                  </option>

                  <option value="energetic">
                    حماسي
                  </option>
                </select>
              </div>

              {/* Speaking rate */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-bold">
                    سرعة الكلام
                  </label>

                  <span className="text-xs text-slate-400">
                    {speakingRate.toFixed(
                      1
                    )}x
                  </span>
                </div>

                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speakingRate}
                  onChange={(event) =>
                    setSpeakingRate(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  className="w-full"
                />

                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>بطيء</span>
                  <span>طبيعي</span>
                  <span>سريع</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles
                  size={18}
                />

                {isBusy
                  ? 'جاري الإنشاء...'
                  : 'إنشاء الصوت'}
              </button>
            </div>

            {/* API status */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck
                    size={20}
                  />
                </div>

                <div>
                  <h3 className="font-bold">
                    حالة الاتصال
                  </h3>

                  <p className="text-xs text-slate-400">
                    إعدادات Gemini
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-slate-900/60 p-3">
                  <span className="text-slate-400">
                    API Key
                  </span>

                  <span
                    className={
                      hasGeminiKey
                        ? 'font-bold text-emerald-400'
                        : 'font-bold text-amber-400'
                    }
                  >
                    {hasGeminiKey
                      ? 'مُعد'
                      : 'غير مُعد'}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-900/60 p-3">
                  <span className="text-slate-400">
                    الصوت المحدد
                  </span>

                  <span className="font-bold text-slate-200">
                    {selectedVoice
                      ? 'جاهز'
                      : 'اختر صوتًا'}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-900/60 p-3">
                  <span className="text-slate-400">
                    الحالة
                  </span>

                  <span className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Activity
                      size={14}
                    />

                    {status ===
                    'generating'
                      ? 'جاري العمل'
                      : status ===
                        'success'
                      ? 'مكتمل'
                      : status ===
                        'error'
                      ? 'خطأ'
                      : 'جاهز'}
                  </span>
                </div>
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <Clock
                  size={18}
                  className="mb-3 text-indigo-400"
                />

                <p className="text-xs text-slate-400">
                  زمن المعالجة
                </p>

                <p className="mt-1 font-bold">
                  سريع
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <KeyRound
                  size={18}
                  className="mb-3 text-indigo-400"
                />

                <p className="text-xs text-slate-400">
                  المحرك
                </p>

                <p className="mt-1 font-bold">
                  Gemini TTS
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
