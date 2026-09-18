import React, { useState } from 'react';
import {
  Mic,
  History,
  KeyRound,
  User as UserIcon,
  CreditCard,
  ShieldCheck,
  LogOut,
  Sparkles,
  Copy,
  Check,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../firebase/authContext';
import { UserBalance, UserSettings } from '../types/tts';

interface NavbarProps {
  activeTab: 'studio' | 'history' | 'byok' | 'account' | 'plans' | 'isolation';
  onSelectTab: (tab: 'studio' | 'history' | 'byok' | 'account' | 'plans' | 'isolation') => void;
  balance: UserBalance | null;
  settings: UserSettings | null;
  onOpenAuth: () => void;
}

export function Navbar({
  activeTab,
  onSelectTab,
  balance,
  settings,
  onOpenAuth,
}: NavbarProps) {
  const { user, signOut } = useAuth();
  const [copiedUid, setCopiedUid] = useState(false);

  const handleCopyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const isByokActive = settings?.providerMode === 'byok' && settings?.hasCustomApiKey;
  const remaining = balance?.remainingCharacters ?? 10000;
  const daysUntilRenewal = balance?.daysUntilRenewal ?? 30;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none"
            onClick={() => onSelectTab('studio')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-600/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Mic className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Brand Name: Arabic on Right, English on Left */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-black tracking-tight" dir="rtl">
                  {/* Arabic (Right) */}
                  <span className="flex items-center gap-1 text-slate-100">
                    <span className="text-white">النص</span>
                    <span className="text-cyan-400 text-base sm:text-lg animate-pulse inline-block">☜</span>
                    <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">صوت</span>
                  </span>

                  {/* Separator */}
                  <span className="text-slate-600 font-light select-none">|</span>

                  {/* English (Left) */}
                  <span className="flex items-center gap-1 font-bold text-xs sm:text-sm font-sans" dir="ltr">
                    <span className="text-slate-200">Text</span>
                    <span className="text-indigo-400 text-sm sm:text-base inline-block">☞</span>
                    <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">Voice</span>
                  </span>
                </div>

                <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Google Auth
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">10,000 حرف شهرياً لكل حساب مستقل</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              id="nav-tab-studio"
              onClick={() => onSelectTab('studio')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'studio'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>الاستوديو الصوتي</span>
            </button>

            <button
              id="nav-tab-history"
              onClick={() => onSelectTab('history')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>سجل التحويلات</span>
            </button>

            <button
              id="nav-tab-byok"
              onClick={() => onSelectTab('byok')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'byok'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>مفتاح Gemini (BYOK)</span>
              {isByokActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              )}
            </button>

            <button
              id="nav-tab-account"
              onClick={() => onSelectTab('account')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'account'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>الحساب والرصيد</span>
            </button>

            <button
              id="nav-tab-plans"
              onClick={() => onSelectTab('plans')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'plans'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>الباقات</span>
            </button>

            <button
              id="nav-tab-isolation"
              onClick={() => onSelectTab('isolation')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'isolation'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                  : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>فحص العزل</span>
            </button>
          </nav>

          {/* User Controls & Balance Bar */}
          <div className="flex items-center gap-2.5">
            {user ? (
              <>
                {/* Balance Status Badge */}
                <div
                  id="user-balance-badge"
                  onClick={() => onSelectTab('account')}
                  className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center gap-2 text-xs transition-colors"
                  title={`رصيدك المتبقي: ${remaining.toLocaleString()} حرف. يتجدد تلقائياً بعد ${daysUntilRenewal} يوم`}
                >
                  {isByokActive ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>BYOK غير محدود</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">الرصيد:</span>
                      <span className="font-mono font-bold text-indigo-400">
                        {remaining.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500">حرف</span>
                      <span className="text-[10px] text-emerald-400/80 hidden sm:inline flex items-center gap-1 mr-1">
                        <Calendar className="w-2.5 h-2.5" />
                        <span>({daysUntilRenewal} يوم)</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Google User Avatar / Pill with Copy UID */}
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Google User'}
                      className="w-5 h-5 rounded-full object-cover border border-indigo-500/40"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 font-bold text-[10px] flex items-center justify-center">
                      {user.email ? user.email.charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                  <span className="font-mono text-slate-300 text-[11px] max-w-[80px] sm:max-w-[120px] truncate hidden md:inline" title={user.email || user.uid}>
                    {user.email || `${user.uid.slice(0, 8)}...`}
                  </span>
                  <button
                    onClick={handleCopyUid}
                    className="p-1 hover:text-white text-slate-400 transition-colors cursor-pointer"
                    title="نسخ Google UID"
                  >
                    {copiedUid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>

                {/* Sign Out Button */}
                <button
                  id="signout-header-btn"
                  onClick={signOut}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors cursor-pointer"
                  title="تسجيل الخروج من حساب Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                id="signin-header-btn"
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow-md shadow-white/5 flex items-center gap-2 transition-all cursor-pointer"
              >
                {/* Google G icon */}
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
            )}
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden items-center justify-around py-2.5 border-t border-slate-800/60 overflow-x-auto gap-1">
          <button
            onClick={() => onSelectTab('studio')}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium ${
              activeTab === 'studio' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            الاستوديو
          </button>
          <button
            onClick={() => onSelectTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium ${
              activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            السجل
          </button>
          <button
            onClick={() => onSelectTab('byok')}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium ${
              activeTab === 'byok' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            BYOK
          </button>
          <button
            onClick={() => onSelectTab('account')}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium ${
              activeTab === 'account' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            الحساب
          </button>
          <button
            onClick={() => onSelectTab('isolation')}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium ${
              activeTab === 'isolation' ? 'bg-emerald-600 text-white' : 'text-emerald-400'
            }`}
          >
            فحص العزل
          </button>
        </div>
      </div>
    </header>
  );
}
