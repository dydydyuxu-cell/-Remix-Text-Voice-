/**
 * Server-Side UID-Isolated Balance & Quota Manager
 *
 * Security rules:
 * - Every Firebase user gets an independent 10,000-character allowance.
 * - Balance is strictly keyed by verified Firebase UID.
 * - The site owner's balance is NEVER used for another user.
 * - BYOK does NOT bypass the internal character allowance.
 * - Every successful TTS generation consumes characters from that user's balance.
 * - Balance is stored server-side and synchronized with Firestore.
 * - The allowance renews every 30 days.
 * - Concurrent operations for the same UID are serialized.
 * - Idempotency records are isolated by UID + idempotency key.
 * - Firestore values are validated before being accepted locally.
 *
 * IMPORTANT:
 * This module NEVER accepts a UID from a client request body.
 * The UID must come from the authenticated Firebase token flow
 * handled by apiRouter.ts.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  getFirestoreDoc,
  setFirestoreDoc,
} from './firestoreDb.ts';

// ----------------------------------------------------
// Constants
// ----------------------------------------------------

export const INITIAL_CHARACTER_ALLOWANCE = 10000;

const THIRTY_DAYS_MS =
  30 * 24 * 60 * 60 * 1000;

const DATA_FILE =
  path.resolve(
    process.cwd(),
    'server-balances.json'
  );

// ----------------------------------------------------
// Public types
// ----------------------------------------------------

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

  status:
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED';

  textLength: number;

  responsePayload?: any;

  createdAt: string;
}

// ----------------------------------------------------
// Internal persistent types
// ----------------------------------------------------

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
  balances: Record<
    string,
    StoredRecord
  >;

  idempotency: Record<
    string,
    IdempotencyRecord
  >;
}

// ----------------------------------------------------
// UID locks
// ----------------------------------------------------

/**
 * One queue/lock per Firebase UID.
 *
 * This prevents:
 * - double deductions
 * - renewal races
 * - concurrent balance initialization
 * - concurrent idempotency writes for the same user
 *
 * Different users do NOT block each other.
 */
const uidLocks:
  Map<string, Promise<void>> =
  new Map();

async function acquireLock(
  uid: string
): Promise<() => void> {
  if (!uid) {
    throw new Error(
      'UID is required for lock acquisition'
    );
  }

  /*
   * Wait for the previous operation belonging
   * to the same UID.
   */
  while (uidLocks.has(uid)) {
    const previous =
      uidLocks.get(uid);

    if (previous) {
      await previous;
    }
  }

  let release:
    () => void = () => {};

  const lockPromise =
    new Promise<void>(
      (resolve) => {
        release = () => {
          /*
           * Only remove our own lock if it is
           * still the active lock.
           */
          const active =
            uidLocks.get(uid);

          if (
            active ===
            lockPromise
          ) {
            uidLocks.delete(uid);
          }

          resolve();
        };
      }
    );

  uidLocks.set(
    uid,
    lockPromise
  );

  return release;
}

// ----------------------------------------------------
// Input validation helpers
// ----------------------------------------------------

function isValidUid(
  uid: string
): boolean {
  return (
    typeof uid === 'string' &&
    uid.trim().length > 0 &&
    uid.length <= 256
  );
}

function isFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value)
  );
}

function safeNonNegativeInteger(
  value: unknown,
  fallback: number
): number {
  const n =
    typeof value === 'number'
      ? value
      : Number
