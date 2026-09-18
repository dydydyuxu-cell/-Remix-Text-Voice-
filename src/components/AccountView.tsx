import React, { useState } from 'react';
import {
  User as UserIcon,
  ShieldCheck,
  Copy,
  Check,
  CreditCard,
  Sparkles,
  LogOut,
  RefreshCw,
  Database,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../firebase/authContext';
import { UserBalance, UserSettings } from '../types/tts';

interface AccountViewProps {
  balance: UserBalance | null;
  settings: UserSettings | null;
  onRefreshBalance: () => void;
  onOpenAuth: () => void;
  onNavigateToByok: () => void;
  onNavigateToPlans: () => void;
}

export function AccountView({
  balance,
  settings,
  onRefreshBalance,
  onOpenAuth,
  onNavigateToByok,
  onNavigateToPlans,
}: AccountViewProps) {
  const { user, signOut } = useAuth();
  const [copiedUid, setCopiedUid] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshBalance();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const remaining = balance?.remainingCharacters ?? 10000;
  const used = balance?.usedCharacters ?? 0;
  const total = balance?.freeCharacters ?? 10000;
  const percentUsed = Math.min(100, Math.round((used / total) * 100));

  const isByokActive = settings?.providerMode === 'byok' && settings?.hasCustomApiKey;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600/15 text-indigo-400 border border-indigo-500/20">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">إدارة حساب Google والرصيد الشهري</h1>
            <p className="text-xs text-slate-400 mt-1">
              الرصيد الشهري (10,000 حرف)، موعد التجديد التلقائي (كل 30 يوماً)، وعزل البيانات الكامل بحسب Google UID.
            </p>
          </div>
        </div>
      </div>

      {!user ? (
        /* Not logged in card */
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-indigo-600/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
            <UserIcon className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">لم تقم بتسجيل الدخول بعد</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1.5 leading-relaxed">
              قم بتسجيل الدخول بحساب Google الخاص بك لتفعيل حصتك الشهرية البالغة 10,000 حرف مجاناً والوصول إلى قاعدة بياناتك المعزولة.
            </p>
          </div>
          <button
            onClick={onOpenAuth}
            className="px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs inline-flex items-center gap-2.5 shadow-lg shadow-white/5 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            <span>تسجيل الدخول عبر Google</span>
          </button>
        </div>
      ) : (
        <>
          {/* Identity Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold text-white">هوية حساب Google المعزول</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Google UID مستقل
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-400 block">معرف المستخدم الفريد (Google UID):</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-indigo-300 truncate" title={user.uid}>
                    {user.uid}
                  </span>
                  <button
                    id="copy-account-uid-btn"
                    onClick={() => handleCopy(user.uid)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="نسخ Google UID"
                  >
                    {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  * هذا المعرف هو المفتاح الوحيد لبياناتك في قاعدة بيانات Firestore على الخادم.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-400 block">حساب Google المرتبط:</span>
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Google User'}
                      className="w-8 h-8 rounded-full border border-indigo-500/30 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center">
                      {user.email?.charAt(0).toUpperCase() || 'G'}
                    </div>
                  )}
                  <div className="truncate">
                    <span className="text-xs text-slate-100 font-semibold block truncate">
                      {user.displayName || 'مستخدم Google'}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {user.email || 'بدون بريد معلن'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 block pt-1">
                  ● موثق عبر Google Firebase Auth
                </span>
              </div>
            </div>
          </div>

          {/* Quota & Balance Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <h2 className="text-sm font-bold text-white">الرصيد الشهري ودورة الـ 30 يوماً</h2>
              </div>
              <button
                id="refresh-balance-btn"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                title="تحديث الرصيد من الخادم"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                <span>تحديث</span>
              </button>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">الحصة الشهرية الأساسية:</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono text-white">
                    {total.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400">حرف</span>
                </div>
                <span className="text-[10px] text-indigo-400 mt-1 block">تلقائياً لكل حساب Google</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">الأحرف المستهلكة هذا الشهر:</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono text-rose-400">
                    {used.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400">حرف</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">تُخصم بعد نجاح التوليد فقط</span>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30">
                <span className="text-xs text-indigo-300 block mb-1 font-medium">الرصيد المتبقي المتاح:</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono text-indigo-400">
                    {remaining.toLocaleString()}
                  </span>
                  <span className="text-xs text-indigo-300">حرف</span>
                </div>
                <span className="text-[10px] text-emerald-400 mt-1 block font-medium">
                  {remaining > 0 ? 'جاهز للاستخدام الفوري' : 'تم استنفاد الحصة الشهرية'}
                </span>
              </div>
            </div>

            {/* Consumption Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">نسبة استهلاك الحصة الشهرية:</span>
                <span className="font-mono font-bold text-slate-200">{percentUsed}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentUsed > 85 ? 'bg-rose-500' : percentUsed > 50 ? 'bg-amber-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
            </div>

            {/* BYOK Note */}
            {isByokActive && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>
                    وضع المفتاح الخاص (BYOK) نشط حالياً. جميع عمليات التوليد غير محدودة ولا تخصم أي حرف من رصيدك المجاني.
                  </span>
                </div>
                <button
                  onClick={onNavigateToByok}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/30 text-emerald-200 hover:bg-emerald-600/50 text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer"
                >
                  إدارة BYOK
                </button>
              </div>
            )}
          </div>

          {/* Database Persistence & Security Details */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <span>ضمانات الخصوصية وقاعدة البيانات</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                  <Lock className="w-3.5 h-3.5" />
                  <span>تخزين على الخادم (Firestore)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  الرصيد محفوظ في قاعدة البيانات على الخادم وليس في المتصفح. لا نستخدم Cookies أو Local Storage أو عنوان IP لتحديد الحساب أو الرصيد.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>حسابات Google معزولة كلياً</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  تسجيل الدخول بحساب Google جديد لا يعرض إطلاقاً أي بيانات أو رصيد أو سجلات لحساب Google سابق، ولا يمكن تكرار الحصة لنفس الحساب.
                </p>
              </div>
            </div>
          </div>

          {/* Account Actions Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400 text-center sm:text-right">
              <span className="text-slate-200 font-semibold block">تبديل حساب Google أو الخروج</span>
              <span className="text-[11px]">يمكنك تسجيل الخروج والدخول بحساب Google آخر في أي وقت بأمان تام.</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={signOut}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
