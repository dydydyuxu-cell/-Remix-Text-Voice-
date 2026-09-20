import React, { useState, useMemo } from 'react';
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
  Search,
  Activity,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../firebase/authContext';
import { generateTTS } from '../services/apiClient';
import {
  TTSVoice,
  UserBalance,
  UserSettings,
  TTSGeneration,
  GenerationStatus,
} from '../types/tts';
import { ALL_30_GEMINI_VOICES } from '../data/voices';
import { AudioPlayer } from './AudioPlayer';

const SAMPLE_TEXTS = [
  {
    title: 'قصيدة عربية فصحى',
    text: 'وَما نَيلُ المَطالِبِ بِالتَمَنّي\nوَلَكِن تُؤخَذُ الدُنيا غِلابا\nوَما اِستَعصى عَلى قَومٍ مَنالٌ\إِذا كانَ الإِقدامُ لَهُم رِكابا',
    voice: 'Charon',
    style: 'سردي وقصصي',
  },
  {
    title: 'نشرة تقنية وإخبارية',
    text: 'أعلنت شركة جوجل عن أحدث نماذج الذكاء الاصطناعي لتحويل النص إلى كلام، مع تمكين المطورين من بناء حلول صوتية فائقة الواقعية تدعم اللغة العربية بدقة استثنائية ونبرات صوتية طبيعية.',
    voice: 'Puck',
    style: 'إخباري ورسمي',
  },
  {
    title: 'مقدمة بودكاست ثقافي',
    text: 'أهلاً بكم في حلقة جديدة من بودكاست آفاق المعرفة. سنتحدث اليوم عن رحلة الإنسان مع اللغة والصوت، وكيف شكّلت الكلمة المنطوقة جسور التواصل عبر آلاف السنين.',
    voice: 'Aoede',
    style: 'بودكاست وحواري',
  },
  {
    title: 'إعلان تسويقي تحفيزي',
    text: 'انطلق بأفكارك إلى مستوى جديد كلياً. صمم منصتك اليوم بقوة تقنيات الذكاء الاصطناعي الأكثر تطوراً واستمتع بسرعة وأداء لا يضاهى.',
    voice: 'Fenrir',
    style: 'تحفيزي وإعلاني',
  },
];

const PERFORMANCE_STYLES = [
  'طبيعي',
  'سردي وقصصي',
  'إخباري ورسمي',
  'بودكاست وحواري',
  'تحفيزي وإعلاني',
];

const LANGUAGES = [
  'العربية',
  'English (US)',
  'English (UK)',
  'Français',
  'Español',
  'Deutsch',
  'Türkçe',
];

interface TTSStudioProps {
  balance: UserBalance | null;
  settings: UserSettings | null;
  onRefreshBalance: () => void;
  onOpenAuth: () => void;
  onNavigateToByok: () => void;
  onGenerationComplete: (gen: TTSGeneration) => void;
}

export function TTSStudio({
  balance,
  settings,
  onRefreshBalance,
  onOpenAuth,
  onNavigateToByok,
  onGenerationComplete,
}: TTSStudioProps) {
  const { getIdToken, user } = useAuth();

  const [text, setText] = useState<string>(
    'مرحباً بك في منصة تحويل النص إلى كلام الاحترافية عبر نماذج Google Gemini. اكتب أي نص وسأقوم بتحويله إلى نطق صوتي فائق النقاء فوراً.'
  );

  const [selectedVoice, setSelectedVoice] = useState<string>(
    settings?.preferredVoice || 'Puck'
  );

  const [voiceGenderFilter, setVoiceGenderFilter] = useState<
    'ALL' | 'male' | 'female'
  >('ALL');

  const [voiceSearch, setVoiceSearch] = useState<string>('');

  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    settings?.preferredLanguage || 'العربية'
  );

  const [selectedStyle, setSelectedStyle] = useState<string>(
    settings?.style || 'طبيعي'
  );

  const [speakingRate, setSpeakingRate] = useState<number>(
    settings?.speakingRate || 1.0
  );

  const currentVoiceObj = useMemo(() => {
    return (
      ALL_30_GEMINI_VOICES.find((v) => v.id === selectedVoice) ||
      ALL_30_GEMINI_VOICES
