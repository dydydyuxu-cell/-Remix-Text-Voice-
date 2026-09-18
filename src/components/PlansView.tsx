import React from 'react';
import {
  CreditCard,
  Check,
  Sparkles,
  KeyRound,
  ShieldCheck,
  Zap,
  Building,
} from 'lucide-react';
import { UserSettings } from '../types/tts';

interface PlansViewProps {
  settings: UserSettings | null;
  onNavigateToByok: () => void;
  onNavigateToStudio: () => void;
  onOpenAuth?: () => void;
}

export function PlansView({
  settings,
  onNavigateToByok,
  onNavigateToStudio,
  onOpenAuth,
}: PlansViewProps) {
  const isByokActive = settings?.providerMode === 'byok' && settings?.hasCustomApiKey;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
          <CreditCard className="w-3.5 h-3.5" />
          <span>باقات الاشتراك والرصيد</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          اختر الخطة المناسبة لاحتياجاتك الصوتية
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          جميع الباقات معزولة بالكامل بواسطة Firebase UID. استمتع بتوليد غير محدود عبر مفتاحك الخاص أو ابدأ بالرصيد المجاني.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Plan 1: Free Starter */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white">باقة البداية المجانية</h3>
                <p className="text-xs text-slate-400 mt-0.5">تلقائية عند إنشاء أي UID جديد</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                افتراضي
              </span>
            </div>

            <div className="pt-2">
              <span className="text-3xl font-extrabold text-white">0$</span>
              <span className="text-xs text-slate-500 mr-1">/ للأبد</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-center">
              <span className="text-xs text-indigo-400 font-bold block">10,000 حرف مجاني</span>
              <span className="text-[10px] text-slate-500">حصة معزولة مخصصة للـ UID</span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>5 أصوات Gemini واقعية</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>دعم كامل للغة العربية والإنجليزية</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تنزيل ملفات WAV بنقاء 24kHz</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>سجل تحويلات خاص بالحساب</span>
              </li>
            </ul>
          </div>

          <button
            id="choose-free-plan-btn"
            onClick={onNavigateToStudio}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            البدء بالاستوديو المجاني
          </button>
        </div>

        {/* Plan 2: BYOK Unlimited (Featured) */}
        <div className="bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-900 border-2 border-indigo-500/50 rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-6 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white shadow-md shadow-indigo-500/30">
            الخيار الأكثر شعبية ومرونة
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>باقة BYOK اللامحدودة</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Bring Your Own Key</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                مجاني 100%
              </span>
            </div>

            <div className="pt-2">
              <span className="text-3xl font-extrabold text-white">0$</span>
              <span className="text-xs text-slate-500 mr-1">/ عبر مفتاحك الخاص</span>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-950/60 border border-indigo-800/60 text-center">
              <span className="text-xs text-emerald-400 font-bold block">توليد غير محدود إطلاقاً</span>
              <span className="text-[10px] text-slate-400">لا حدود من الموقع ولا استهلاك رصيد</span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تشفير AES-256-GCM لمفتاحك في الخادم</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>مفتاحك لا يراه أو يستخدمه أي حساب آخر</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>الاستفادة من حصة Google المجانية السخية</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تحكم كامل بسرعة النطق ونبرة الأداء</span>
              </li>
            </ul>
          </div>

          <button
            id="choose-byok-plan-btn"
            onClick={onNavigateToByok}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{isByokActive ? 'مفتاحك نشط حالياً — إدارته' : 'تفعيل مفتاح BYOK الآن'}</span>
          </button>
        </div>

        {/* Plan 3: Pro Enterprise */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white">باقة المحترفين والشركات</h3>
                <p className="text-xs text-slate-400 mt-0.5">للإنتاج الضخم والاستوديوهات</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                قريباً
              </span>
            </div>

            <div className="pt-2">
              <span className="text-3xl font-extrabold text-white">19$</span>
              <span className="text-xs text-slate-500 mr-1">/ شهرياً</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-center">
              <span className="text-xs text-indigo-400 font-bold block">1,000,000 حرف شهرياً</span>
              <span className="text-[10px] text-slate-500">سيرفرات فائقة السرعة مع دعم فني</span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>معالجة دفعات نصوص طويلة (Batch TTS)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>أولوية قصوى في معالجة طلبات الصوت</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تصدير ملفات MP3 و WAV عالية الدقة</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>عزل مالي ومحاسبي كامل للمؤسسة</span>
              </li>
            </ul>
          </div>

          <button
            id="choose-pro-plan-btn"
            disabled
            className="w-full py-3 rounded-xl bg-slate-800/60 text-slate-500 text-xs font-semibold cursor-not-allowed"
          >
            قيد الإطلاق التجاري
          </button>
        </div>
      </div>
    </div>
  );
}
