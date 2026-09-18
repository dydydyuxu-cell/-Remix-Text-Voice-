import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Calendar,
  Database,
  Lock,
} from 'lucide-react';
import { useAuth } from '../firebase/authContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error('Google sign in error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.');
      } else if (err?.code === 'auth/popup-blocked') {
        setError('قام المتصفح بحظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لموقع Google.');
      } else {
        setError(err?.message || 'فشل تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl space-y-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-right space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">تسجيل الدخول عبر Google</h2>
              <span className="text-[11px] text-emerald-400 font-medium">
                10,000 حرف شهرياً لكل حساب مستقل
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed pt-1">
            تسجيل الدخول السريع والآمن حصرياً بحساب Google. يتم ربط بياناتك ومعرفك الفريد (Google UID) في قاعدة البيانات على الخادم.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Highlighted Benefits Card */}
        <div className="rounded-2xl bg-slate-950/70 border border-slate-800/80 p-4 space-y-3 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-slate-200 block">10,000 حرف شهرياً مجاناً:</span>
              <span className="text-[11px] text-slate-400">
                يحصل كل حساب Google تلقائياً على 10,000 حرف عند التسجيل للتحويل الصوتي.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-slate-200 block">تجدد تلقائي كل 30 يوماً:</span>
              <span className="text-[11px] text-slate-400">
                يعاد ضبط الحصة الشهرية بالكامل إلى 10,000 حرف تلقائياً بعد انقضاء كل 30 يوماً.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-slate-200 block">عزل تام بحسب Google UID:</span>
              <span className="text-[11px] text-slate-400">
                حسابك مستقل 100%. لا يتم حفظ الرصيد في المتصفح أو Cookies أو ربطه بالـ IP.
              </span>
            </div>
          </div>
        </div>

        {/* Primary Google Login Button */}
        <div className="space-y-3 pt-1">
          <button
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg ${
              loading
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-900 shadow-white/10 cursor-pointer active:scale-[0.99]'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-900 rounded-full animate-spin" />
                <span>جاري تسجيل الدخول عبر Google...</span>
              </>
            ) : (
              <>
                {/* Official Google 'G' Icon */}
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
                <span>المتابعة باستخدام Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5 pt-1">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>تسجيل دخول مشفر ومحمي بواسطة Google Firebase Auth</span>
          </p>
        </div>
      </div>
    </div>
  );
}
