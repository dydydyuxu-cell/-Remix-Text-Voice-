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
  if (!voice || typeof voice !== 'object') {
    return '';
  }

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
  if (!voice || typeof voice !== 'object') {
    return '';
  }

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
          (voice) =>
            voiceValue(voice) === voiceName
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
      setError('يجب تسجيل الدخول أولًا.');
      return;
    }

    if (!text.trim()) {
      setError('اكتب النص الذي تريد تحويله إلى صوت.');
      return;
    }

    if (characterCount > MAX_TEXT_LENGTH) {
      setError(
        `النص طويل جدًا. الحد الأقصى هو ${MAX_TEXT_LENGTH} حرف.`
      );
      return;
    }

    if (characterCount > remainingCharacters) {
      setError(
        'عدد الأحرف المطلوبة أكبر من الرصيد المتاح في حسابك.'
      );
      return;
    }

    if (!selectedVoiceName) {
      setError('اختر صوتًا أولًا.');
      return;
    }

    if (!hasGeminiKey) {
      setError(
        'أضف Gemini API Key الخاص بك من صفحة الإعدادات.'
      );
      return;
    }

    try {
      setStatus('QUEUED');

      const token = await getIdToken();

      if (!token) {
        throw new Error(
          'تعذر الحصول على رمز تسجيل الدخول.'
        );
      }

      setStatus('PROCESSING');

      /*
       * نحاول دعم أكثر من شكل محتمل لدالة generateTTS
       * حتى لا يتعطل هذا المكوّن بسبب اختلاف توقيعها.
       */
      const generate = generateTTS as unknown as (
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
      } catch {
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

      const generatedAudioUrl =
        result?.audioUrl ??
        result?.url ??
        result?.audio?.url ??
        '';

      const generatedBase64 =
        result?.audioBase64 ??
        result?.base64 ??
        result?.audio?.base64 ??
        '';

      let finalAudioUrl =
        generatedAudioUrl;

      if (
        !finalAudioUrl &&
        generatedBase64
      ) {
        finalAudioUrl =
          generatedBase64.startsWith('data:')
            ? generatedBase64
            : `data:audio/wav;base64,${generatedBase64}`;
      }

      if (!finalAudioUrl) {
        throw new Error(
          'تم إنشاء الطلب ولكن لم يتم استلام ملف صوتي.'
        );
      }

      setAudioUrl(finalAudioUrl);
      setStatus('COMPLETED');
      setSuccess(
        'تم إنشاء الصوت بنجاح.'
      );

      await onBalanceRefresh();
    } catch (err: any) {
      console.error(
        'TTS generation error:',
        err
      );

      setStatus('FAILED');

      const message =
        err?.message ||
        'حدث خطأ أثناء إنشاء الصوت.';

      setError(message);
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
      `tts-${Date.now()}.wav`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main
      dir="rtl"
      className="mx-auto w-full max-w-6xl p-4 sm:p-6"
    >
      <section className="mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Sparkles size={22} />
                استوديو تحويل النص إلى صوت
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                حوّل النص إلى صوت باستخدام مفتاح Gemini الخاص بك.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <div className="text-xs text-slate-500">
                الأحرف المتبقية
              </div>

              <div className="mt-1 font-bold text-slate-900">
                {remainingCharacters.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <Volume2 size={19} />
              النص
            </h2>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                النص المراد تحويله
              </label>

              <textarea
                value={text}
                onChange={(event) =>
                  setText(event.target.value)
                }
                maxLength={MAX_TEXT_LENGTH}
                rows={14}
                placeholder="اكتب النص الذي تريد تحويله إلى صوت..."
                className="w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800 outline-none focus:border-slate-400"
              />

              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  الحد الأقصى:{' '}
                  {MAX_TEXT_LENGTH.toLocaleString()} حرف
                </span>

                <span
                  className={
                    characterCount > MAX_TEXT_LENGTH
                      ? 'font-bold text-red-600'
                      : 'text-slate-500'
                  }
                >
                  {characterCount.toLocaleString()} /{' '}
                  {MAX_TEXT_LENGTH.toLocaleString()}
                </span>
              </div>
            </div>

            {!hasGeminiKey && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <KeyRound
                  size={18}
                  className="mb-2"
                />

                <p className="font-bold">
                  Gemini غير متصل
                </p>

                <p className="mt-1 text-xs leading-5">
                  أضف Gemini API Key الخاص بك من صفحة الإعدادات.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    onNavigate('settings')
                  }
                  className="mt-3 text-xs font-bold underline"
                >
                  فتح إعدادات Gemini
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isBusy ? (
                <>
                  <Clock
                    size={18}
                    className="ml-2 inline animate-spin"
                  />
                  جاري إنشاء الصوت...
                </>
              ) : (
                <>
                  <Sparkles
                    size={18}
                    className="ml-2 inline"
                  />
                  إنشاء الصوت
                </>
              )}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <Sliders size={19} />
              إعدادات الصوت
            </h2>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                الصوت
              </label>

              <select
                value={selectedVoiceName}
                onChange={(event) =>
                  setVoiceName(event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              >
                <option value="">
                  اختر صوتًا
                </option>

                {voices.map(
                  (voice, index) => {
                    const value =
                      voiceValue(voice);

                    const label =
                      voiceLabel(voice) ||
                      `Voice ${index + 1}`;

                    return (
                      <option
                        key={`${value}-${index}`}
                        value={value}
                      >
                        {label}
                      </option>
                    );
                  }
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                اللغة
              </label>

              <div className="relative">
                <Globe
                  size={17}
                  className="pointer-events-none absolute right-3 top-3 text-slate-400"
                />

                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 pr-10 text-sm text-slate-800 outline-none focus:border-slate-400"
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
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                أسلوب الإلقاء
              </label>

              <select
                value={style}
                onChange={(event) =>
                  setStyle(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              >
                <option value="طبيعي وواضح">
                  طبيعي وواضح
                </option>

                <option value="هادئ وودود">
                  هادئ وودود
                </option>

                <option value="احترافي">
                  احترافي
                </option>

                <option value="حماسي">
                  حماسي
                </option>

                <option value="قصصي">
                  قصصي
                </option>

                <option value="إخباري">
                  إخباري
                </option>
              </select>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  سرعة الكلام
                </label>

                <span className="text-xs font-bold text-slate-600">
                  {speakingRate.toFixed(1)}x
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
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={20}
                  className="mt-0.5 shrink-0 text-slate-700"
                />

                <div>
                  <p className="text-sm font-bold text-slate-800">
                    مفتاح Gemini الخاص بك
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    يتم استخدام مفتاح Gemini المرتبط بحسابك
                    وفق إعدادات التطبيق.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isBusy ? (
                <>
                  <Clock
                    size={18}
                    className="ml-2 inline animate-spin"
                  />
                  جاري إنشاء الصوت...
                </>
              ) : (
                <>
                  <Sparkles
                    size={18}
                    className="ml-2 inline"
                  />
                  إنشاء الصوت
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle
            size={18}
            className="ml-2 inline"
          />

          <span className="text-sm">
            {error}
          </span>
        </div>
      )}

      {success && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2
            size={18}
            className="ml-2 inline"
          />

          <span className="text-sm">
            {success}
          </span>
        </div>
      )}

      {audioUrl && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
            <Volume2 size={19} />
            الصوت الناتج
          </h2>

          <audio
            controls
            preload="metadata"
            src={audioUrl}
            className="w-full"
          >
            متصفحك لا يدعم تشغيل الصوت.
          </audio>

          <button
            type="button"
            onClick={handleDownload}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            تنزيل الصوت
          </button>
        </section>
      )}

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ShieldCheck
            size={20}
            className="mb-3 text-slate-700"
          />

          <h3 className="font-bold text-slate-900">
            رصيد مستقل
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            لكل حساب Google رصيد داخلي مستقل.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <KeyRound
            size={20}
            className="mb-3 text-slate-700"
          />

          <h3 className="font-bold text-slate-900">
            مفتاح Gemini الخاص بك
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            لا يتم استخدام مفتاح الموقع كبديل لطلبك.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Activity
            size={20}
            className="mb-3 text-slate-700"
          />

          <h3 className="font-bold text-slate-900">
            خصم الأحرف
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            يتم خصم عدد الأحرف المستخدمة من رصيد حسابك.
          </p>
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() =>
            onNavigate('history')
          }
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          عرض سجل التوليدات
        </button>

        <button
          type="button"
          onClick={() =>
            onNavigate('settings')
          }
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          إدارة مفتاح Gemini
        </button>
      </div>
    </main>
  );
}
