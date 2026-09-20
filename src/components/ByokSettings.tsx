import React, { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Trash2,
  ExternalLink,
  Server,
  Lock,
  Cpu,
  Activity,
} from 'lucide-react';

import { useAuth } from '../firebase/authContext';
import { UserSettings } from '../types/tts';
import {
  saveByokKey,
  deleteByokKey,
} from '../services/apiClient';

interface ByokSettingsProps {
  settings: UserSettings | null;
  onRefreshSettings: () => void;
  onOpenAuth?: () => void;
}

export function ByokSettings({
  settings,
  onRefreshSettings,
}: ByokSettingsProps) {
  const { getIdToken, user } = useAuth();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const isByokActive = Boolean(
    settings?.providerMode === 'byok' &&
    settings?.hasCustomApiKey
  );

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setStatusMessage({
        type: 'error',
        message: 'يرجى تسجيل الدخول بحساب Google أولاً.',
      });
      return;
    }

    const cleanKey = apiKeyInput.trim();

    if (!cleanKey) {
      setStatusMessage({
        type: 'error',
        message: 'يرجى إدخال مفتاح Gemini API صحيح.',
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const token = await getIdToken();

      const res = await saveByokKey(
        token,
        cleanKey
      );

      setApiKeyInput('');

      setStatusMessage({
        type: 'success',
        message: res.maskedApiKey
          ? `تم التحقق من المفتاح وحفظه بشكل مشفر بنجاح. المفتاح المحفوظ: ${res.maskedApiKey}`
          : 'تم التحقق من المفتاح وحفظه بشكل مشفر بنجاح.',
      });

      await onRefreshSettings();
    } catch (err: any) {
      console.error('Save key error:', err);

      setStatusMessage({
        type: 'error',
        message:
          err?.message ||
          'فشل التحقق من المفتاح أو حفظه. تأكد من صحة Gemini API Key.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!user) {
      setStatusMessage({
        type: 'error',
        message: 'يرجى تسجيل الدخول بحساب Google أولاً.',
      });
      return;
    }

    const confirmed = window.confirm(
      'هل أنت متأكد من حذف Gemini API Key الخاص بك؟ بعد الحذف لن يتم إنشاء الصوت حتى تضيف مفتاحًا جديدًا.'
    );

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const token = await getIdToken();

      await deleteByokKey(token);

      setStatusMessage({
        type: 'success',
        message:
          'تم حذف Gemini API Key الخاص بك بنجاح. لن يتم استخدام أي مفتاح تابع للموقع.',
      });

      await onRefreshSettings();
    } catch (err: any) {
      console.error('Delete key error:', err);

      setStatusMessage({
        type: 'error',
        message:
          err?.message ||
          'فشل حذف مفتاح Gemini.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
    >
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600/15 text-indigo-400 border border-indigo-500/20">
            <KeyRound className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">
              إعدادات مفتاح Gemini
            </h1>

            <p className="text-xs text-slate-400 mt-1">
              أضف مفتاح Gemini الخاص بك. يتم ربط المفتاح بحساب Google
              الخاص بك وتخزينه مشفرًا على الخادم.
            </p>
          </div>
        </div>
      </div>

      {/* Account / Status */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />

              <h2 className="text-sm font-bold text-white">
                حالة مفتاح Gemini
              </h2>
            </div>

            <p className="mt-2 text-xs text-slate-400 leading-6">
              كل حساب Google يستخدم مفتاح Gemini المرتبط به فقط.
              لا يوجد مفتاح موقع احتياطي.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${
              isByokActive
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isByokActive
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />

            {isByokActive
              ? 'المفتاح متصل'
              : 'لا يوجد مفتاح متصل'}
          </div>
        </div>
      </div>

      {/* Internal Balance Notice */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>

          <div>
            <h2 className="text-sm font-bold text-white">
              الرصيد الداخلي للحساب
            </h2>

            <p className="mt-2 text-xs text-slate-400 leading-6">
              لديك رصيد داخلي مستقل قدره
              <span className="font-bold text-white mx-1">
                10,000 حرف
              </span>
              لحساب Google الخاص بك. استخدام مفتاح Gemini الخاص بك
              لا يلغي هذا الرصيد؛ كل عملية TTS ناجحة تخصم عدد الأحرف
              المستخدمة من رصيد حسابك.
            </p>
          </div>
        </div>
      </div>

      {/* Saved Key */}
      {settings?.hasCustomApiKey ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />

              <h2 className="text-sm font-bold text-white">
                مفتاح Gemini المحفوظ
              </h2>
            </div>

            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              AES-256-GCM
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 font-mono">
            <div>
              <span className="text-xs text-slate-500 block mb-1">
                النسخة المقنعة للمفتاح:
              </span>

              <span className="text-sm font-bold text-indigo-300 tracking-wider">
                {settings.maskedApiKey || '••••••••'}
              </span>
            </div>

            <button
              id="revoke-byok-key-btn"
              type="button"
              disabled={isSubmitting}
              onClick={handleDeleteKey}
              className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-50 disabled:cursor-not-allowed text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف المفتاح</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            المفتاح الأصلي لا يتم إرساله إلى المتصفح بعد حفظه.
            يتم الاحتفاظ به داخل الخادم بشكل مشفر، ويُستخدم فقط
            عندما يرسل حسابك طلب TTS مصادقًا عليه.
          </p>
        </div>
      ) : null}

      {/* Add / Update Key */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-400" />

            <h2 className="text-sm font-bold text-white">
              {settings?.hasCustomApiKey
                ? 'تحديث مفتاح Gemini'
                : 'إضافة مفتاح Gemini API'}
            </h2>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
          >
            <span>الحصول على مفتاح من Google</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {statusMessage && (
          <div
            className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}

            <p className="leading-relaxed">
              {statusMessage.message}
            </p>
          </div>
        )}

        {!user ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-6">
            يجب تسجيل الدخول بحساب Google قبل إضافة مفتاح Gemini.
          </div>
        ) : null}

        <form
          onSubmit={handleSaveKey}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="byok-api-key-input"
              className="text-xs font-semibold text-slate-300"
            >
              أدخل Gemini API Key:
            </label>

            <div className="relative">
              <input
                id="byok-api-key-input"
                type={showKey ? 'text' : 'password'}
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                value={apiKeyInput}
                onChange={(e) =>
                  setApiKeyInput(e.target.value)
                }
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pr-4 pl-11 py-3 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <button
                type="button"
                aria-label={
                  showKey
                    ? 'إخفاء المفتاح'
                    : 'إظهار المفتاح'
                }
                onClick={() =>
                  setShowKey((current) => !current)
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-5">
              سيتم التحقق من المفتاح على الخادم أولاً، ثم تخزينه
              مشفرًا. لا ترسل المفتاح في المحادثة أو لأي شخص.
            </p>
          </div>

          <button
            id="save-byok-key-btn"
            type="submit"
            disabled={
              isSubmitting ||
              !user ||
              !apiKeyInput.trim()
            }
            className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
              isSubmitting ||
              !user ||
              !apiKeyInput.trim()
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25 cursor-pointer'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />

                <span>
                  جاري التحقق والتشفير والحفظ...
                </span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />

                <span>
                  فحص وتشفير وحفظ المفتاح
                </span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Security Architecture */}
      <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
        <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />

          <span>
            حماية وعزل مفتاح Gemini
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
              <KeyRound className="w-4 h-4" />
            </div>

            <span className="text-xs font-bold text-slate-200 block">
              Firebase UID
            </span>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              كل مستخدم لديه هوية Firebase مستقلة تُستخدم
              للوصول إلى بياناته ومفتاحه.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <Server className="w-4 h-4" />
            </div>

            <span className="text-xs font-bold text-slate-200 block">
              Server Vault
            </span>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              يتم تخزين المفتاح في الخادم بشكل مشفر باستخدام
              AES-256-GCM.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
              <Cpu className="w-4 h-4" />
            </div>

            <span className="text-xs font-bold text-slate-200 block">
              Gemini TTS
            </span>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              طلب TTS يستخدم مفتاح Gemini المرتبط بحساب المستخدم
              المصادق عليه.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
