import { TTSGeneration, UserBalance, UserSettings, IsolationTestResult } from '../types/tts';

export async function fetchApi<T>(
  endpoint: string,
  idToken: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${idToken}`);
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export async function generateTTS(
  idToken: string,
  params: {
    text: string;
    voice: string;
    language: string;
    speakingRate: number;
    style: string;
    idempotencyKey?: string;
    providerMode?: 'byok' | 'site';
  }
): Promise<{
  success: boolean;
  generationId: string;
  audioUrl: string;
  textLength: number;
  voice: string;
  language: string;
  usedByok: boolean;
  balance: UserBalance;
}> {
  const idempotencyKey = params.idempotencyKey || `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return fetchApi('/api/tts', idToken, {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...params,
      idempotencyKey,
    }),
  });
}

export async function getUserBalance(idToken: string): Promise<UserBalance> {
  return fetchApi<UserBalance>('/api/user/balance', idToken);
}

export async function getUserSettings(idToken: string): Promise<UserSettings> {
  return fetchApi<UserSettings>('/api/user/settings', idToken);
}

export async function updateUserSettings(
  idToken: string,
  settings: Partial<UserSettings>
): Promise<{ success: boolean; settings: UserSettings }> {
  return fetchApi('/api/user/settings', idToken, {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

export async function saveByokKey(
  idToken: string,
  apiKey: string
): Promise<{ success: boolean; maskedApiKey: string; message: string }> {
  return fetchApi('/api/user/byok-key', idToken, {
    method: 'POST',
    body: JSON.stringify({ apiKey, testBeforeSave: true }),
  });
}

export async function deleteByokKey(
  idToken: string
): Promise<{ success: boolean; message: string }> {
  return fetchApi('/api/user/byok-key', idToken, {
    method: 'DELETE',
  });
}

export async function getUserGenerations(idToken: string): Promise<TTSGeneration[]> {
  return fetchApi<TTSGeneration[]>('/api/user/generations', idToken);
}

export async function deleteGeneration(
  idToken: string,
  generationId: string
): Promise<{ success: boolean; deletedId: string }> {
  return fetchApi(`/api/user/generations/${generationId}`, idToken, {
    method: 'DELETE',
  });
}

export async function runIsolationTest(): Promise<IsolationTestResult> {
  const response = await fetch('/api/test/isolation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to run isolation verification');
  }
  return response.json();
}
