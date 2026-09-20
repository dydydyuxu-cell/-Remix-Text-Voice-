/**
 * Per-user character balance manager
 *
 * Rules:
 * - Every Firebase UID gets its own independent 10,000-character balance.
 * - BYOK does NOT bypass the internal balance.
 * - Balance is deducted before TTS generation.
 * - If TTS fails, the deducted characters are refunded.
 * - All balance operations are isolated by UID.
 * - File writes are protected by per-UID locks.
 */

import fs from 'node:fs';
import path from 'node:path';

export const INITIAL_CHARACTER_ALLOWANCE = 10000;

const THIRTY_DAYS_MS =
  30 * 24 * 60 * 60 * 1000;

const BALANCES_FILE =
  path.resolve(
    process.cwd(),
    'server-balances.json'
  );

export interface UserBalance {
  userId: string;
  freeCharacters: number;
  usedCharacters: number;
  remainingCharacters: number;
  totalCharacters: number;
  lastResetAt: string;
  nextResetAt: string;
  updatedAt: string;
}

interface StoredBalanceRecord {
  userId: string;
  freeCharacters: number;
  usedCharacters: number;
  remainingCharacters: number;
  totalCharacters: number;
  lastResetAt: string;
  nextResetAt: string;
  updatedAt: string;
}

interface IdempotencyRecord {
  uid: string;
  idempotencyKey: string;
  status:
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED';
  textLength: number;
  responsePayload?: any;
  createdAt: string;
  updatedAt: string;
}

const locks = new Map<
  string,
  Promise<void>
>();

const idempotencyStore = new Map<
  string,
  IdempotencyRecord
>();

// ----------------------------------------------------
// File helpers
// ----------------------------------------------------

function loadBalances(): Record<
  string,
  StoredBalanceRecord
> {
  try {
    if (
      fs.existsSync(
        BALANCES_FILE
      )
    ) {
      const raw =
        fs.readFileSync(
          BALANCES_FILE,
          'utf8'
        );

      if (!raw.trim()) {
        return {};
      }

      return JSON.parse(raw);
    }
  } catch (error) {
    console.error(
      '[Balance] Failed to load balances:',
      error
    );
  }

  return {};
}

function saveBalances(
  balances: Record<
    string,
    StoredBalanceRecord
  >
): void {
  const tempFile =
    `${BALANCES_FILE}.tmp`;

  try {
    fs.writeFileSync(
      tempFile,
      JSON.stringify(
        balances,
        null,
        2
      ),
      'utf8'
    );

    fs.renameSync(
      tempFile,
      BALANCES_FILE
    );
  } catch (error) {
    console.error(
      '[Balance] Failed to save balances:',
      error
    );

    try {
      if (
        fs.existsSync(
          tempFile
        )
      ) {
        fs.unlinkSync(
          tempFile
        );
      }
    } catch {
      // Ignore cleanup error.
    }

    throw error;
  }
}

// ----------------------------------------------------
// UID validation
// ----------------------------------------------------

function validateUid(
  uid: string
): void {
  if (
    !uid ||
    typeof uid !== 'string' ||
    uid.trim().length === 0
  ) {
    throw new Error(
      'Invalid user UID'
    );
  }
}

// ----------------------------------------------------
// Date helpers
// ----------------------------------------------------

function createResetDate(
  from: Date
): string {
  return new Date(
    from.getTime() +
      THIRTY_DAYS_MS
  ).toISOString();
}

// ----------------------------------------------------
// Create new balance
// ----------------------------------------------------

function createInitialBalance(
  uid
