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

const GOOGLE_ICON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68l3.88 3.05c2.27-2.09 3.66-5.17 3.66-9.17z"
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
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15C6.23 6.85 8.88 4.75 12 4.75z"
    />
  </svg>
);

function getVoiceValue(voice: unknown): string {
  if (!voice || typeof voice !== 'object') return '';

  const item = voice as Record<string, unknown>;

  return String(
    item.name ??
      item.voiceName ??
      item.id ??
      item.value ??
      '',
  );
}

function getVoiceLabel(voice: unknown): string {
  if (!voice || typeof voice !== 'object') return '';

  const item = voice as Record<string, unknown>;

  return String(
    item.label ??
      item.displayName ??
      item.name ??
      item.voiceName ??
      item.id ??
      '',
  );
}

function getVoiceDescription(voice: unknown): string {
  if (!voice || typeof voice !== 'object') return '';

  const item = voice as Record<string, unknown>;

  return String(
    item.description ??
      item.desc ??
      '',
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

  const [status, setStatus] = useState<GenerationStatus>('IDLE');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [audioUrl, setAudioUrl] = useState('');
  const [audioMimeType, setAudioMimeType] = useState('audio/wav
