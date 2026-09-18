import React, { useState } from 'react';
import {
  KeyRound,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Trash2,
  ExternalLink,
  Sparkles,
  Server,
  Lock,
  Cpu,
  ArrowDown,
} from 'lucide-react';
import { useAuth } from '../firebase/authContext';
import { UserSettings } from '../types/tts';
import { saveByokKey, deleteByokKey, updateUserSettings } from '../services/apiClient';

interface ByokSettingsProps {
  settings: UserSettings | null;
  onRefreshSettings: () => void;
  onOpenAuth?: () => void;
}

export function ByokSettings({
  settings,
  onRefreshSettings,
  onOpenAuth,
}: ByokSettingsProps) {
  const { getIdToken, user } = useAuth();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isByokActive = settings?.providerMode === 'byok' && settings?.hasCustomApiKey;

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      setStatusMessage({ type: 'error', message: 'يرجى إدخال مفتاح API صحيح' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const token = await getIdToken();
      const res = await saveByokKey(token, apiKeyInput.trim());
      setApiKeyInput('');
      setStatusMessage({
        type: 'success',
        message: `تم التحقق من صلاحية المفتاح وحفظه مشفراً بنجاح! المفتاح المقنع: ${res.maskedApiKey}`,
      });
      onRefreshSettings();
    } catch (err: any) {
      console.error('Save key error:', err);
      setStatusMessage({
        type: 'error',
        message: err?.message || 'فشل حفظ أو التحقق من المفتاح. تأكد من صحة مفتاح Gemini API.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!confirm('هل أنت متأكد من حذف مفتاحك الخاص؟ سيعود الحساب لاستخدام API الموقع والرصيد المتاح.')) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const token = await getIdToken();
      await deleteByokKey(token);
      setStatusMessage({
        type: 'success',
        message: 'تم حذف المفتاح بنجاح وتفعيل وضع API الموقع.',
      });
      onRefreshSettings();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        message: err?.message || 'فشل حذف المفتاح',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMode = async (newMode: 'byok' | 'site') => {
    if (newMode === 'byok' && !settings?.hasCustomApiKey) {
      setStatusMessage({
        type: 'error',
        message: 'لتفعيل وضع المفتاح الخاص (BYOK)، يرجى إدخال مفتاح Gemini API الخاص بك وحفظه أدناه أولاً.',
      });
      const inputEl = document.getElementById('byok-api-key-input');
      if (inputEl) inputEl.focus();
      return;
    }

    try {
      const token = await getIdToken();
      await updateUserSettings(token, { providerMode: newMode });
      setStatusMessage({
        type: 'success',
        message: newMode === 'byok' ? 'تم تفعيل وضع المفتاح الخاص (BYOK) بنجاح.' : 'تم تفعيل وضع API الموقع.',
      });
      onRefreshSettings();
    } catch (err: any) {
      console.error('Mode toggle error:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600/15 text-indigo-400 border border-indigo-500/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">إعدادات مفتاح Gemini (BYOK)</h1>
            <p className="text-xs text-slate-400 mt-1">
              نظام جلب المفتاح الخاص (Bring Your Own Key) مع تشفير كامل وعزل صارم لكل UID.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Selector Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <h2 className="text-sm font-bold text-slate-200">اختر وضع توليد الصوت</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode 1: BYOK */}
          <div
            id="mode-card-byok"
            onClick={() => handleToggleMode('byok')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              settings?.providerMode === 'byok'
                ? 'bg-indigo-600/15 border-indigo-500/50 shadow-md shadow-indigo-600/10'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">مفتاح خاص بي (BYOK)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    غير محدود
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  توليد غير محدود باستخدام Gemini API Key الخاص بمشروعك في Google Cloud. لا استهلاك من رصيد الموقع.
                </p>
              </div>

              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                  settings?.providerMode === 'byok' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-700'
                }`}
              >
                {settings?.providerMode === 'byok' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
          </div>

          {/* Mode 2: Site API */}
          <div
            id="mode-card-site"
            onClick={() => handleToggleMode('site')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              settings?.providerMode === 'site'
                ? 'bg-indigo-600/15 border-indigo-500/50 shadow-md shadow-indigo-600/10'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">API الموقع (الحصة المجانية)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    10,000 حرف
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  استخدام مفتاح الموقع المباشر وفق الرصيد المجاني الأولي المخصص لهذا الـ UID فقط.
                </p>
              </div>

              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                  settings?.providerMode === 'site' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-700'
                }`}
              >
                {settings?.providerMode === 'site' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Saved Key Info */}
      {settings?.hasCustomApiKey ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">المفتاح المشفر المحفوظ</h2>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              AES-256-GCM مُشفّر
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 font-mono">
            <div>
              <span className="text-xs text-slate-500 block mb-1">النسخة المقنعة للمفتاح:</span>
              <span className="text-sm font-bold text-indigo-300 tracking-wider">
                {settings.maskedApiKey}
              </span>
            </div>

            <button
              id="revoke-byok-key-btn"
              disabled={isSubmitting}
              onClick={handleDeleteKey}
              className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف المفتاح وإلغاؤه</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            * تنبيه أمني: المفتاح الأصلي مشفر داخل الـ Backend ولا يتم إرساله إطلاقاً للمتصفح. فقط طلبات الـ TTS الصادرة من هذا الـ UID تستطيع فك تشفيره لحظياً لمعالجة الصوت.
          </p>
        </div>
      ) : null}

      {/* Add / Update Key Form */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">
              {settings?.hasCustomApiKey ? 'تحديث المفتاح الخاص' : 'إضافة مفتاح Gemini API جديد'}
            </h2>
          </div>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
          >
            <span>الحصول على مفتاح مجاني من Google</span>
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
            <p className="leading-relaxed">{statusMessage.message}</p>
          </div>
        )}

        <form onSubmit={handleSaveKey} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              أدخل مفتاح Gemini API:
            </label>
            <div className="relative">
              <input
                id="byok-api-key-input"
                type={showKey ? 'text' : 'password'}
                dir="ltr"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pr-4 pl-11 py-3 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              سيقوم النظام باختبار صلاحية المفتاح فوراً مع خوادم Gemini قبل تشفيره وحفظه.
            </p>
          </div>

          <button
            id="save-byok-key-btn"
            type="submit"
            disabled={isSubmitting || !apiKeyInput.trim()}
            className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
              isSubmitting || !apiKeyInput.trim()
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25 cursor-pointer'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جاري التحقق والتشفير بـ AES-256...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>فحص وتشفير وحفظ المفتاح</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Security Architecture Visualization */}
      <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
        <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>مخطط العزل الأمني للمفاتيح (Zero Leakage Architecture)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
              <KeyRound className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 block">Firebase UID</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              المعرف الوحيد المعتمد لكل مستخدم. لا بريد ولا IP ولا بصمة جهاز.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <Server className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 block">Server Vault</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              تشفير AES-256-GCM. المفاتيح لا تغادر السيرفر ولا تُعرض في المتصفح.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 block">Gemini TTS</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              يُرسل الطلب مباشرة لمشروع المستخدم، وحصته الخاصة فقط هي التي تُحتسب.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
