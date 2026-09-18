/**
 * Server-Side UID-Isolated Balance & Quota Manager
 * Strictly keyed to Google Firebase Auth UID.
 * 
 * Rules:
 * - Every Google user gets 10,000 characters monthly automatically.
 * - Stored in the server-side database (Firestore and persistent server store), NEVER in browser cookies or localStorage.
 * - Auto-renews every 30 days: if 30 days have elapsed since cycleStartDate, usedCharacters resets to 0.
 * - Same Google UID retains existing balance; never duplicates initial quota.
 * - Strict isolation: each Google UID is a completely independent partition.
 * - Deduction occurs strictly after successful audio synthesis.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getFirestoreDoc, setFirestoreDoc } from './firestoreDb.ts';

export interface UserBalance {
  uid: string;
  email?: string;
  freeCharacters: number;
  usedCharacters: number;
  remainingCharacters: number;
  cycleStartDate: string;
  nextRenewalDate: string;
  daysUntilRenewal: number;
  createdAt: string;
  updatedAt: string;
}

export interface IdempotencyRecord {
  idempotencyKey: string;
  uid: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  textLength: number;
  responsePayload?: any;
  createdAt: string;
}

const DATA_FILE = path.resolve(process.cwd(), 'server-balances.json');

interface StoredRecord {
  uid: string;
  email?: string;
  freeCharacters: number;
  usedCharacters: number;
  cycleStartDate: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreSchema {
  balances: Record<string, StoredRecord>;
  idempotency: Record<string, IdempotencyRecord>;
}

// In-memory mutex locks per Google UID to prevent concurrent race conditions
const uidLocks: Map<string, Promise<void>> = new Map();

async function acquireLock(uid: string): Promise<() => void> {
  while (uidLocks.has(uid)) {
    await uidLocks.get(uid);
  }
  let release: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => {
    release = () => {
      uidLocks.delete(uid);
      resolve();
    };
  });
  uidLocks.set(uid, lockPromise);
  return release;
}

function loadStore(): StoreSchema {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading balances file:', err);
  }
  return { balances: {}, idempotency: {} };
}

function saveStore(store: StoreSchema): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving balances file:', err);
  }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Calculates current 30-day renewal cycle details and resets quota if 30 days have passed.
 * Resets used characters to 0 and grants a full 10,000 new characters.
 */
function apply30DayRenewal(rec: StoredRecord): { rec: StoredRecord; renewed: boolean } {
  const now = new Date();
  const cycleStart = new Date(rec.cycleStartDate || rec.createdAt || now);
  const msElapsed = now.getTime() - cycleStart.getTime();

  let renewed = false;
  if (msElapsed >= THIRTY_DAYS_MS) {
    // 30 days completed! Reset monthly character quota to a fresh 10,000 characters
    const cyclesPassed = Math.max(1, Math.floor(msElapsed / THIRTY_DAYS_MS));
    const newCycleStartMs = cycleStart.getTime() + (cyclesPassed * THIRTY_DAYS_MS);
    
    rec.usedCharacters = 0;
    rec.freeCharacters = 10000;
    rec.cycleStartDate = new Date(newCycleStartMs).toISOString();
    rec.updatedAt = now.toISOString();
    renewed = true;
    console.log(`[30-Day Auto-Renewal] Quota successfully renewed for UID: ${rec.uid}. A fresh 10,000 character allowance is now active.`);
  }

  return { rec, renewed };
}

/**
 * Background auto-renewal watchdog:
 * Periodically verifies all user quotas every 10 minutes and renews expired balances on schedule.
 */
setInterval(() => {
  try {
    const store = loadStore();
    let hasRenewals = false;
    for (const uid of Object.keys(store.balances)) {
      const rec = store.balances[uid];
      if (!rec) continue;
      const { renewed } = apply30DayRenewal(rec);
      if (renewed) {
        hasRenewals = true;
      }
    }
    if (hasRenewals) {
      saveStore(store);
      console.log('[30-Day Auto-Renewal] Background check applied pending renewals and saved to store.');
    }
  } catch (err) {
    console.error('[30-Day Auto-Renewal] Error in background renewal process:', err);
  }
}, 10 * 60 * 1000);

/**
 * Builds the comprehensive public balance representation.
 */
function formatBalance(rec: StoredRecord): UserBalance {
  const now = Date.now();
  const cycleStart = new Date(rec.cycleStartDate || rec.createdAt).getTime();
  const nextRenewalMs = cycleStart + THIRTY_DAYS_MS;
  const daysUntilRenewal = Math.max(0, Math.ceil((nextRenewalMs - now) / (1000 * 60 * 60 * 24)));
  const nextRenewalDate = new Date(nextRenewalMs).toISOString();
  const remainingCharacters = Math.max(0, rec.freeCharacters - rec.usedCharacters);

  return {
    uid: rec.uid,
    email: rec.email || '',
    freeCharacters: rec.freeCharacters,
    usedCharacters: rec.usedCharacters,
    remainingCharacters,
    cycleStartDate: rec.cycleStartDate,
    nextRenewalDate,
    daysUntilRenewal,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

/**
 * Retrieves the balance strictly for the provided Google UID.
 * Automatically initializes new users with 10,000 characters monthly.
 * Automatically checks and applies 30-day cycle renewal.
 * Synchronizes with Firestore database using user ID token if available.
 */
export async function getUserBalance(
  uid: string,
  idToken?: string,
  email?: string
): Promise<UserBalance> {
  if (!uid) throw new Error('Google UID is required to fetch balance');
  const release = await acquireLock(uid);

  try {
    const store = loadStore();
    let rec = store.balances[uid];

    // If not found in local server store, attempt reading from Firestore database
    if (!rec && idToken) {
      const fsData = await getFirestoreDoc(`users/${uid}/usage/balance`, idToken);
      if (fsData && fsData.freeCharacters !== undefined) {
        rec = {
          uid,
          email: fsData.email || email || '',
          freeCharacters: fsData.freeCharacters || 10000,
          usedCharacters: fsData.usedCharacters || 0,
          cycleStartDate: fsData.cycleStartDate || new Date().toISOString(),
          createdAt: fsData.createdAt || new Date().toISOString(),
          updatedAt: fsData.updatedAt || new Date().toISOString(),
        };
        store.balances[uid] = rec;
        saveStore(store);
      }
    }

    if (!rec) {
      // First time initialization for this Google UID
      const now = new Date().toISOString();
      rec = {
        uid,
        email: email || '',
        freeCharacters: 10000,
        usedCharacters: 0,
        cycleStartDate: now,
        createdAt: now,
        updatedAt: now,
      };
      store.balances[uid] = rec;
      saveStore(store);

      // Async persist to Firestore database
      if (idToken) {
        setFirestoreDoc(`users/${uid}/usage/balance`, formatBalance(rec), idToken).catch(() => {});
      }
    } else {
      if (email && !rec.email) {
        rec.email = email;
      }
      const { renewed } = apply30DayRenewal(rec);
      if (renewed) {
        saveStore(store);
        if (idToken) {
          setFirestoreDoc(`users/${uid}/usage/balance`, formatBalance(rec), idToken).catch(() => {});
        }
      }
    }

    return formatBalance(rec);
  } finally {
    release();
  }
}

/**
 * Transactionally deducts characters for a synthesis request on Site API.
 * Returns failure if remaining characters are insufficient.
 * Called ONLY after successful audio generation.
 */
export async function deductUserBalance(
  uid: string,
  charCount: number,
  idToken?: string
): Promise<{ success: boolean; balance: UserBalance; error?: string }> {
  if (!uid) throw new Error('Google UID is required for deduction');
  if (charCount <= 0) {
    const b = await getUserBalance(uid, idToken);
    return { success: true, balance: b };
  }

  const release = await acquireLock(uid);
  try {
    const store = loadStore();
    let rec = store.balances[uid];

    if (!rec) {
      const now = new Date().toISOString();
      rec = {
        uid,
        freeCharacters: 10000,
        usedCharacters: 0,
        cycleStartDate: now,
        createdAt: now,
        updatedAt: now,
      };
      store.balances[uid] = rec;
    }

    // Check if 30-day renewal applies
    const { renewed } = apply30DayRenewal(rec);
    if (renewed) {
      saveStore(store);
      if (idToken) {
        setFirestoreDoc(`users/${uid}/usage/balance`, formatBalance(rec), idToken).catch(() => {});
      }
    }

    const remaining = rec.freeCharacters - rec.usedCharacters;

    if (remaining < charCount) {
      const formatted = formatBalance(rec);
      return {
        success: false,
        error: `رصيد الأحرف غير كافٍ. المتبقي: ${remaining} حرف من الحصة الشهرية، المطلوب: ${charCount} حرف. سيتجدد رصيدك تلقائيًا بعد ${formatted.daysUntilRenewal} يوم، أو يمكنك استخدام مفتاح Gemini الخاص بك (BYOK).`,
        balance: formatted,
      };
    }

    // Atomic deduction
    rec.usedCharacters += charCount;
    rec.updatedAt = new Date().toISOString();
    saveStore(store);

    const formatted = formatBalance(rec);

    // Sync updated balance to Firestore database
    if (idToken) {
      setFirestoreDoc(`users/${uid}/usage/balance`, formatted, idToken).catch((err) => {
        console.warn('Firestore balance sync warning:', err);
      });
    }

    return {
      success: true,
      balance: formatted,
    };
  } finally {
    release();
  }
}

/**
 * Checks idempotency state for a given (uid + idempotencyKey) pair.
 */
export function checkIdempotency(uid: string, idempotencyKey: string): IdempotencyRecord | null {
  if (!uid || !idempotencyKey) return null;
  const store = loadStore();
  const compositeKey = `${uid}:${idempotencyKey}`;
  return store.idempotency[compositeKey] || null;
}

/**
 * Saves idempotency record to prevent duplicate deduction on retried requests.
 */
export function recordIdempotency(
  uid: string,
  idempotencyKey: string,
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
  textLength: number,
  responsePayload?: any
): void {
  if (!uid || !idempotencyKey) return;
  const store = loadStore();
  const compositeKey = `${uid}:${idempotencyKey}`;
  store.idempotency[compositeKey] = {
    idempotencyKey,
    uid,
    status,
    textLength,
    responsePayload,
    createdAt: new Date().toISOString(),
  };
  saveStore(store);
}
