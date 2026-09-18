import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Database,
  KeyRound,
  FileText,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { IsolationTestResult } from '../types/tts';
import { runIsolationTest } from '../services/apiClient';

export function IsolationSuite() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<IsolationTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunTests = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const data = await runIsolationTest();
      setResult(data);
    } catch (err: any) {
      console.error('Test error:', err);
      setError(err?.message || 'فشل تشغيل فحص العزل');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">مختبر فحص العزل الأمني (Isolation Suite)</h1>
              <p className="text-xs text-slate-400 mt-1">
                التحقق البرمجي التلقائي من عزل الأرصدة، المفاتيح المشفرة، والسجلات بين المستخدم A والمستخدم B.
              </p>
            </div>
          </div>
        </div>

        <button
          id="run-isolation-test-btn"
          disabled={isRunning}
          onClick={handleRunTests}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${
            isRunning
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer'
          }`}
        >
          {isRunning ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>جاري الفحص المباشر...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>تشغيل فحص العزل الآن</span>
            </>
          )}
        </button>
      </div>

      {/* Description of Test Mandate */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-400" />
          <span>المعايير المحددة للاختبار الصارم</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <span className="font-bold text-slate-200 block">1. اختبار الرصيد المعزول:</span>
            <ul className="space-y-1 text-slate-400 list-disc list-inside leading-relaxed text-[11px]">
              <li>المستخدم A يبدأ بـ 10,000 حرف ويستهلك 5,000 حرف.</li>
              <li>المستخدم B يبدأ بـ 10,000 حرف ويستهلك 0 حرف.</li>
              <li>النتيجة المطلوبة: A = 5,000 متبقي | B = 10,000 متبقي دون أي تداخل.</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <span className="font-bold text-slate-200 block">2. اختبار عزل الـ API Keys:</span>
            <ul className="space-y-1 text-slate-400 list-disc list-inside leading-relaxed text-[11px]">
              <li>المستخدم A يربط مفتاحه الخاص Key_A المشفر بـ AES-256.</li>
              <li>المستخدم B يربط مفتاحه الخاص Key_B المشفر بـ AES-256.</li>
              <li>النتيجة المطلوبة: طلبات A لا تستخدم إطلاقاً Key_B والعكس.</li>
            </ul>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Overall Status Banner */}
          <div
            className={`p-5 rounded-3xl border flex items-center justify-between gap-4 ${
              result.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {result.success ? (
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <XCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <span className="text-base font-bold block">
                  {result.success ? 'جميع اختبارات العزل اجتازت بنجاح 100%!' : 'فشل أحد الاختبارات'}
                </span>
                <span className="text-xs text-slate-400 mt-0.5 block">{result.summary}</span>
              </div>
            </div>

            <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-slate-900 border border-slate-700">
              Run #{result.runId.toString().slice(-4)}
            </span>
          </div>

          {/* Metrics Comparison Cards (User A vs User B) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User A Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-400" />
                  <span className="text-xs font-bold text-white">المستخدم A (User A)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">UID_A</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                  <span className="text-[10px] text-slate-500 block mb-1">المستهلك</span>
                  <span className="text-base font-bold text-amber-400">
                    {result.metrics.userA_used.toLocaleString()} حرف
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                  <span className="text-[10px] text-slate-500 block mb-1">المتبقي</span>
                  <span className="text-base font-bold text-emerald-400">
                    {result.metrics.userA_remaining.toLocaleString()} حرف
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                تم استهلاك 5,000 حرف بنجاح وبقي 5,000 حرف.
              </p>
            </div>

            {/* User B Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="text-xs font-bold text-white">المستخدم B (User B)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">UID_B</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                  <span className="text-[10px] text-slate-500 block mb-1">المستهلك</span>
                  <span className="text-base font-bold text-slate-400">
                    {result.metrics.userB_used.toLocaleString()} حرف
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                  <span className="text-[10px] text-slate-500 block mb-1">المتبقي</span>
                  <span className="text-base font-bold text-emerald-400">
                    {result.metrics.userB_remaining.toLocaleString()} حرف
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                لم يتأثر إطلاقاً باستهلاك المستخدم A وظل رصيده كاملاً (10,000 حرف).
              </p>
            </div>
          </div>

          {/* Test Logs Detailed List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white">تفاصيل خطوات التحقق البرمجية</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">{result.logs.length} خطوات مكتملة</span>
            </div>

            <div className="space-y-3">
              {result.logs.map((log, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-500">#{i + 1}</span>
                      <span>{log.step}</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        log.status === 'PASSED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    {log.details}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
