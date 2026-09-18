import React from 'react';

export function IslamicHeader() {
  return (
    <div className="w-full py-5 px-4 text-center select-none bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950 border-b border-slate-900/60">
      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center space-y-2">
        {/* Decorative Top Accent Line */}
        <div className="flex items-center justify-center gap-3 w-full max-w-xs opacity-60">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-emerald-500/40 to-emerald-400/80" />
          <span className="text-emerald-400 text-xs">❖</span>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-emerald-500/40 to-emerald-400/80" />
        </div>

        {/* Bismillah in GREEN font */}
        <h2 className="text-lg sm:text-xl md:text-2xl font-black text-emerald-400 tracking-wide drop-shadow-[0_2px_12px_rgba(52,211,153,0.35)] font-serif">
          بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ
        </h2>

        {/* Warning Reminder in WHITE font */}
        <p className="text-xs sm:text-sm font-semibold text-white tracking-normal drop-shadow-sm">
          لا تستخدمه فما يغضب الله
        </p>

        {/* Decorative Bottom Accent Line */}
        <div className="flex items-center justify-center gap-3 w-full max-w-xs opacity-60 pt-0.5">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-emerald-500/30 to-emerald-400/60" />
          <span className="text-emerald-400/70 text-[10px]">♦</span>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-emerald-500/30 to-emerald-400/60" />
        </div>
      </div>
    </div>
  );
}
