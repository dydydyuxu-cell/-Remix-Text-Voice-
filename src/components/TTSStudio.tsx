import React, { useMemo, useState } from 'react';
import {
  Mic,
  Sparkles,
  Volume2,
  Globe,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  Activity,
  Calendar,
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
  if (!voice || typeof voice !== 'object') return '';

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
  if (!voice || typeof voice !== 'object') return '';

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
          (voice) => voiceValue(voice) === voiceName
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
  
              <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                أسلوب الإلقاء
              </label>

              <select
                value={style}
                onChange={(event) => setStyle(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              >
                <option value="طبيعي وواضح">طبيعي وواضح</option>
                <option value="هادئ وودود">هادئ وودود</option>
                <option value="احترافي">احترافي</option>
                <option value="حماسي">حماسي</option>
                <option value="قصصي">قصصي</option>
                <option value="إخباري">إخباري</option>
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
                  setSpeakingRate(Number(event.target.value))
                }
                className="w-full"
              />
            </div>

            {!hasGeminiKey && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <KeyRound size={18} className="mb-2" />

                <p className="font-bold">
                  Gemini غير متصل
                </p>

                <p className="mt-1 text-xs leading-5">
                  أضف Gemini API Key الخاص بك من صفحة الإعدادات.
                </p>

                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
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
        <div className="mt
