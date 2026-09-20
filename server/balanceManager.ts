/**
 * Server-Side UID-Isolated Balance & Quota Manager
 *
 * Rules:
 * - Every Google user gets an independent 10,000-character allowance.
 * - Balance is strictly keyed by Firebase Google UID.
 * - The site owner's balance is never used for another user.
 * - Gemini provider choice does NOT change the user's internal character balance.
 * - Every successful TTS generation consumes characters from that user's own balance.
 * - Balance is stored server-side and synchronized with Firestore.
 * - The allowance renews every 30 days.
 * - Concurrent requests for the same UID are serialized with a per-UID lock.
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

const INITIAL_CHARACTER_ALLOWANCE = 10000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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

// One independent lock per Google Firebase UID.
// This prevents two simultaneous requests from modifying
// the same user's balance at the same time.
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

      if (content.trim()) {
        const parsed = JSON.parse(content);

        return {
          balances: parsed?.balances || {},
          idempotency: parsed?.idempotency || {},
        };
      }
    }
  } catch (err) {
    console.error('[BalanceStore] Error loading balances file:', err);
  }

  return {
    balances: {},
    idempotency: {},
  };
}

function saveStore(store: StoreSchema): void {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(store, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('[BalanceStore] Error saving balances file:', err);
  }
}

/**
 * Applies the 30-day renewal cycle.
 *
 * Every completed 30-day period gives the same user
 * a fresh 10,000-character allowance.
 *
 * The UID remains unchanged, so the balance never moves
 * between users.
 */
function apply30DayRenewal(
  rec: StoredRecord
): { rec: StoredRecord; renewed: boolean } {
  const now = new Date();

  const cycleStart = new Date(
    rec.cycleStartDate ||
    rec.createdAt ||
    now.toISOString()
  );

  const cycleStartMs = cycleStart.getTime();

  if (!Number.isFinite(cycleStartMs)) {
    rec.cycleStartDate = now.toISOString();
    rec.freeCharacters = INITIAL_CHARACTER_ALLOWANCE;
    rec.usedCharacters = 0;
    rec.updatedAt = now.toISOString();

    return {
      rec,
      renewed: true,
    };
  }

  const elapsed = now.getTime() - cycleStartMs;

  if (elapsed < THIRTY_DAYS_MS) {
    return {
      rec,
      renewed: false,
    };
  }

  const cyclesPassed = Math.max(
    1,
    Math.floor(elapsed / THIRTY_DAYS_MS)
  );

  const newCycleStartMs =
    cycleStartMs + cyclesPassed * THIRTY_DAYS_MS;

  rec.usedCharacters = 0;
  rec.freeCharacters = INITIAL_CHARACTER_ALLOWANCE;
  rec.cycleStartDate = new Date(newCycleStartMs).toISOString();
  rec.updatedAt = now.toISOString();

  console.log(
    `[BalanceRenewal] UID ${rec.uid} received a fresh ` +
    `${INITIAL_CHARACTER_ALLOWANCE}-character allowance.`
  );

  return {
    rec,
    renewed: true,
  };
}

/**
 * Background renewal watchdog.
 *
 * This is only an additional safety mechanism.
 * getUserBalance() and deductUserBalance() also check renewal
 * whenever that user accesses their balance.
 */
setInterval(() => {
  try {
    const store = loadStore();
    let hasRenewals = false;

    for (const uid of Object.keys(store.balances)) {
      const rec = store.balances[uid];

      if (!rec) continue;

      const result = apply30DayRenewal(rec);

      if (result.renewed) {
        hasRenewals = true;
      }
    }

    if (hasRenewals) {
      saveStore(store);

      console.log(
        '[BalanceRenewal] Background renewal check completed.'
      );
    }
  } catch (err) {
    console.error(
      '[BalanceRenewal] Background renewal error:',
      err
    );
  }
}, 10 * 60 * 1000);

/**
 * Converts the internal record into the public balance object.
 */
function formatBalance(rec: StoredRecord): UserBalance {
  const now = Date.now();

  const cycleStart = new Date(
    rec.cycleStartDate || rec.createdAt
  ).getTime();

  const safeCycleStart = Number.isFinite(cycleStart)
    ? cycleStart
    : now;

  const nextRenewalMs =
    safeCycleStart + THIRTY_DAYS_MS;

  const daysUntilRenewal = Math.max(
    0,
    Math.ceil(
      (nextRenewalMs - now) /
      (1000 * 60 * 60 * 24)
    )
  );

  const nextRenewalDate =
    new Date(nextRenewalMs).toISOString();

  const remainingCharacters = Math.max(
    0,
    rec.freeCharacters - rec.usedCharacters
  );

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
 * Retrieves the balance for ONE specific Firebase Google UID.
 *
 * IMPORTANT:
 * There is no global/shared user balance here.
 * Every UID has its own independent record.
 */
export async function getUserBalance(
  uid: string,
  idToken?: string,
  email?: string
): Promise<UserBalance> {
  if (!uid) {
    throw new Error(
      'Google UID is required to fetch balance'
    );
  }

  const release = await acquireLock(uid);

  try {
    const store = loadStore();

    let rec = store.balances[uid];

    /**
     * If the local persistent store does not have the user,
     * try Firestore using THIS user's UID.
     */
    if (!rec && idToken) {
      const fsData = await getFirestoreDoc(
        `users/${uid}/usage/balance`,
        idToken
      );

      if (
        fsData &&
        fsData.freeCharacters !== undefined
      ) {
        rec = {
          uid,

          email:
            fsData.email ||
            email ||
            '',

          freeCharacters:
            Number(fsData.freeCharacters) ||
            INITIAL_CHARACTER_ALLOWANCE,

          usedCharacters:
            Number(fsData.usedCharacters) ||
            0,

          cycleStartDate:
            fsData.cycleStartDate ||
            new Date().toISOString(),

          createdAt:
            fsData.createdAt ||
            new Date().toISOString(),

          updatedAt:
            fsData.updatedAt ||
            new Date().toISOString(),
        };

        store.balances[uid] = rec;

        saveStore(store);
      }
    }

    /**
     * Completely new Google UID.
     *
     * This creates a NEW independent 10,000-character balance.
     */
    if (!rec) {
      const now = new Date().toISOString();

      rec = {
        uid,
        email: email || '',
        freeCharacters: INITIAL_CHARACTER_ALLOWANCE,
        usedCharacters: 0,
        cycleStartDate: now,
        createdAt: now,
        updatedAt: now,
      };

      store.balances[uid] = rec;

      saveStore(store);

      if (idToken) {
        setFirestoreDoc(
          `users/${uid}/usage/balance`,
          formatBalance(rec),
          idToken
        ).catch((err) => {
          console.warn(
            '[BalanceStore] Initial Firestore sync warning:',
            err
          );
        });
      }
    } else {
      if (email && !rec.email) {
        rec.email = email;
      }

      const result = apply30DayRenewal(rec);

      if (result.renewed) {
        saveStore(store);

        if (idToken) {
          setFirestoreDoc(
            `users/${uid}/usage/balance`,
            formatBalance(rec),
            idToken
          ).catch((err) => {
            console.warn(
              '[BalanceStore] Renewal Firestore sync warning:',
              err
            );
          });
        }
      }
    }

    return formatBalance(rec);
  } finally {
    release();
  }
}

/**
 * Deducts characters from ONE specific user's internal balance.
 *
 * IMPORTANT:
 * This deduction is independent of Gemini provider mode.
 *
 * Whether the user uses:
 * - their own Gemini API key,
 * - another supported user Gemini credential,
 *
 * the application's own 10,000-character balance is still consumed.
 *
 * The site owner's character balance is NEVER touched here.
 *
 * This function should be called only after successful TTS synthesis.
 */
export async function deductUserBalance(
  uid: string,
  charCount: number,
  idToken?: string
): Promise<{
  success: boolean;
  balance: UserBalance;
  error?: string;
}> {
  if (!uid) {
    throw new Error(
      'Google UID is required for deduction'
    );
  }

  if (!Number.isFinite(charCount) || charCount <= 0) {
    const balance = await getUserBalance(
      uid,
      idToken
    );

    return {
      success: true,
      balance,
    };
  }

  const normalizedCharCount = Math.floor(charCount);

  const release = await acquireLock(uid);

  try {
    const store = loadStore();

    let rec = store.balances[uid];

    /**
     * Safety initialization.
     *
     * Even if deduction is called before getUserBalance(),
     * the balance is still created under THIS UID only.
     */
    if (!rec) {
      const now = new Date().toISOString();

      rec = {
        uid,
        freeCharacters: INITIAL_CHARACTER_ALLOWANCE,
        usedCharacters: 0,
        cycleStartDate: now,
        createdAt: now,
        updatedAt: now,
      };

      store.balances[uid] = rec;
    }

    /**
     * Apply renewal before calculating available characters.
     */
    const renewal = apply30DayRenewal(rec);

    if (renewal.renewed) {
      saveStore(store);

      if (idToken) {
        setFirestoreDoc(
          `users/${uid}/usage/balance`,
          formatBalance(rec),
          idToken
        ).catch((err) => {
          console.warn(
            '[BalanceStore] Renewal sync warning:',
            err
          );
        });
      }
    }

    const remaining =
      rec.freeCharacters -
      rec.usedCharacters;

    /**
     * Do not allow the user to exceed THEIR OWN
     * remaining character allowance.
     */
    if (remaining < normalizedCharCount) {
      const formatted = formatBalance(rec);

      return {
        success: false,

        error:
          `رصيد الأحرف غير كافٍ. ` +
          `المتبقي: ${remaining} حرف، ` +
          `المطلوب: ${normalizedCharCount} حرف. ` +
          `سيتجدد رصيدك تلقائيًا بعد ` +
          `${formatted.daysUntilRenewal} يوم.`,

        balance: formatted,
      };
    }

    /**
     * Deduct ONLY from this UID's record.
     */
    rec.usedCharacters += normalizedCharCount;
    rec.updatedAt = new Date().toISOString();

    saveStore(store);

    const formatted = formatBalance(rec);

    /**
     * Synchronize the same user's balance to Firestore.
     */
    if (idToken) {
      setFirestoreDoc(
        `users/${uid}/usage/balance`,
        formatted,
        idToken
      ).catch((err) => {
        console.warn(
          '[BalanceStore] Firestore balance sync warning:',
          err
        );
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
 * Checks idempotency state for:
 * Google UID + idempotency key.
 *
 * This means the same idempotency key belonging to User A
 * can never collide with User B.
 */
export function checkIdempotency(
  uid: string,
  idempotencyKey: string
): IdempotencyRecord | null {
  if (!uid || !idempotencyKey) {
    return null;
  }

  const store = loadStore();

  const compositeKey =
    `${uid}:${idempotencyKey}`;

  return (
    store.idempotency[compositeKey] ||
    null
  );
}

/**
 * Saves an idempotency record under:
 * Google UID + idempotency key.
 */
export function recordIdempotency(
  uid: string,
  idempotencyKey: string,
  status:
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED',
  textLength: number,
  responsePayload?: any
): void {
  if (!uid || !idempotencyKey) {
    return;
  }

  const store = loadStore();

  const compositeKey =
    `${uid}:${idempotencyKey}`;

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
