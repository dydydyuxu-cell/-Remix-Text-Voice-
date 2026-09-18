export type ProviderMode = 'byok' | 'site';

export type GenerationStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface TTSVoice {
  id: string;
  name: string;
  gender: 'female' | 'male';
  arabicTitle: string;
  description: string;
  badge: string;
  avatarColor: string;
  avatarUrl: string;
  tone?: string;
  tags?: string[];
}

export interface TTSGeneration {
  generationId: string;
  uid: string;
  text: string;
  textLength: number;
  provider: 'Gemini';
  voice: string;
  language: string;
  speakingRate: number;
  style: string;
  status: GenerationStatus;
  audioUrl?: string;
  errorMessage?: string;
  usedByok: boolean;
  createdAt: string;
}

export interface UserBalance {
  uid: string;
  email?: string;
  freeCharacters: number;
  usedCharacters: number;
  remainingCharacters: number;
  cycleStartDate: string;
  nextRenewalDate: string;
  daysUntilRenewal: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSettings {
  uid: string;
  providerMode: ProviderMode;
  hasCustomApiKey: boolean;
  maskedApiKey: string;
  preferredVoice: string;
  preferredLanguage: string;
  speakingRate: number;
  style: string;
  updatedAt?: string;
}

export interface IsolationStepLog {
  step: string;
  status: 'PASSED' | 'FAILED';
  details: string;
}

export interface IsolationTestResult {
  success: boolean;
  runId: number;
  overallStatus: string;
  summary: string;
  logs: IsolationStepLog[];
  metrics: {
    userA_remaining: number;
    userA_used: number;
    userB_remaining: number;
    userB_used: number;
  };
}
