import {
  TTSGeneration,
  UserBalance,
  UserSettings,
  IsolationTestResult,
} from '../types/tts';

export async function fetchApi<T>(
  endpoint: string,
  idToken: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  headers.set('Authorization', `Bearer ${idToken}`);

  if (
    !headers.has('Content-Type') &&
    options.method &&
    options.method !== 'GET'
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`;

    const err: any = new Error(errorMsg);

    err.status = response.status;
    err.data = data;
    err.code = data?.code;

    throw err;
  }

  return data as T;
}

/**
 * Generate TTS using the Gemini API key belonging to
 * the currently authenticated user.
 *
 * IMPORTANT:
 * There is intentionally NO providerMode here.
 * The server is responsible for loading the user's
 * encrypted Gemini key from their UID.
 *
 * There is also NO site-key fallback.
 */
export async function generateTTS(
  idToken: string,
  params: {
    text: string;
    voice: string;
    language: string;
    speakingRate: number;
    style: string;
    idempotencyKey?: string;
  }
): Promise<{
  success: boolean;
  generationId: string;
  audioUrl: string;
  audioBase64?: string;
  mimeType?: string;
  textLength: number;
  voice: string;
  language: string;
  usedByok: boolean;
  balance: UserBalance;
}> {
  const idempotencyKey =
    params.idempotencyKey ||
    `idem_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

  const {
    text,
    voice,
    language,
    speakingRate,
    style,
  } = params;

  return fetchApi('/api/tts', idToken, {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      text,
      voice,
      language,
      speakingRate,
      style,
      idempotencyKey,
    }),
  });
}

/**
 * Get the current user's internal character balance.
 */
export async function getUserBalance(
  idToken: string
): Promise<UserBalance> {
  return fetchApi<UserBalance>(
    '/api/user/balance',
    idToken
  );
}

/**
 * Get settings belonging only to the current user.
 */
export async function getUserSettings(
  idToken: string
): Promise<UserSettings> {
  return fetchApi<UserSettings>(
    '/api/user/settings',
    idToken
  );
}

/**
 * Update settings belonging only to the current user.
 */
export async function updateUserSettings(
  idToken: string,
  settings: Partial<UserSettings>
): Promise<{
  success: boolean;
  settings: UserSettings;
}> {
  return fetchApi('/api/user/settings', idToken, {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

/**
 * Save the user's own Gemini API key.
 *
 * The actual key is sent only to the authenticated backend.
 * It is not stored in frontend state or localStorage.
 */
export async function saveByokKey(
  idToken: string,
  apiKey: string
): Promise<{
  success: boolean;
  maskedApiKey: string;
  message: string;
}> {
  return fetchApi('/api/user/byok-key', idToken, {
    method: 'POST',
    body: JSON.stringify({
      apiKey,
      testBeforeSave: true,
    }),
  });
}

/**
 * Delete the current user's Gemini API key.
 */
export async function deleteByokKey(
  idToken: string
): Promise<{
  success: boolean;
  message: string;
}> {
  return fetchApi('/api/user/byok-key', idToken, {
    method: 'DELETE',
  });
}

/**
 * Get generations belonging only to the current user.
 */
export async function getUserGenerations(
  idToken: string
): Promise<TTSGeneration[]> {
  return fetchApi<TTSGeneration[]>(
    '/api/user/generations',
    idToken
  );
}

/**
 * Delete one generation
 */
export async function deleteGeneration(
  idToken: string,
  generationId: string
): Promise<{
  success: boolean;
  message: string;
}> {
  return fetchApi(`/api/user/generations/${generationId}`, idToken, {
    method: 'DELETE',
  });
}
