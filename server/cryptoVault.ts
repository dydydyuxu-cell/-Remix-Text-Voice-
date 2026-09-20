/**
 * Server-side Secure Vault for BYOK API Keys
 *
 * Rules:
 * - Gemini API keys are stored server-side only.
 * - Raw API keys are never returned to the frontend.
 * - Every encrypted key is strictly associated with one Firebase UID.
 * - AES-256-GCM provides authenticated encryption.
 * - The encryption master secret MUST come from an environment secret.
 * - There is NO hardcoded fallback encryption secret.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Storage path for encrypted user vault on server.
const VAULT_FILE = path.resolve(
  process.cwd(),
  'server-vault.json'
);

/**
 * Gets the master encryption key.
 *
 * IMPORTANT:
 * The application MUST provide API_KEY_ENCRYPTION_SECRET
 * through its server-side environment/secrets configuration.
 *
 * We intentionally do NOT keep a hardcoded fallback secret
 * in the source code.
 */
function getMasterKey(): Buffer {
  const secret =
    process.env.API_KEY_ENCRYPTION_SECRET?.trim();

  if (!secret) {
    throw new Error(
      'API_KEY_ENCRYPTION_SECRET is not configured. ' +
      'Server-side API key vault is unavailable until the ' +
      'encryption secret is configured.'
    );
  }

  return crypto
    .createHash('sha256')
    .update(secret, 'utf8')
    .digest();
}

/**
 * Encrypts a user's Gemini API key.
 *
 * Format:
 * iv:authTag:ciphertext
 */
export function encryptApiKey(
  plainKey: string
): string {
  const cleanKey = plainKey.trim();

  if (!cleanKey) {
    throw new Error(
      'API Key cannot be empty'
    );
  }

  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    getMasterKey(),
    iv,
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  let encrypted =
    cipher.update(
      cleanKey,
      'utf8',
      'hex'
    );

  encrypted += cipher.final('hex');

  const authTag =
    cipher.getAuthTag().toString('hex');

  return [
    iv.toString('hex'),
    authTag,
    encrypted,
  ].join(':');
}

/**
 * Decrypts an encrypted Gemini API key.
 *
 * The raw key remains server-side and must never be sent
 * to the browser.
 */
export function decryptApiKey(
  payload: string
): string {
  const parts = payload.split(':');

  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted payload format'
    );
  }

  const [
    ivHex,
    authTagHex,
    encryptedHex,
  ] = parts;

  if (
    !ivHex ||
    !authTagHex ||
    !encryptedHex
  ) {
    throw new Error(
      'Invalid encrypted API key payload'
    );
  }

  const iv = Buffer.from(
    ivHex,
    'hex'
  );

  const authTag = Buffer.from(
    authTagHex,
    'hex'
  );

  if (iv.length !== IV_LENGTH) {
    throw new Error(
      'Invalid encryption IV'
    );
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      'Invalid encryption authentication tag'
    );
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getMasterKey(),
    iv,
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  decipher.setAuthTag(authTag);

  let decrypted =
    decipher.update(
      encryptedHex,
      'hex',
      'utf8'
    );

  decrypted += decipher.final('utf8');

  if (!decrypted) {
    throw new Error(
      'Decrypted API key is empty'
    );
  }

  return decrypted;
}

/**
 * Returns a masked representation for UI display.
 *
 * The real API key is never returned.
 */
export function maskApiKey(
  apiKey: string
): string {
  if (!apiKey) return '';

  const trimmed = apiKey.trim();

  if (trimmed.length <= 8) {
    return 'AIza••••••••';
  }

  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);

  return (
    `${prefix}` +
    `${'•'.repeat(8)}` +
    `${suffix}`
  );
}

interface VaultEntry {
  encryptedKey: string;
  maskedKey: string;
  updatedAt: string;
}

interface VaultData {
  keys: Record<
    string,
    VaultEntry
  >;
}

/**
 * Loads the encrypted server vault.
 *
 * The vault itself is never exposed through the frontend.
 */
function loadVault(): VaultData {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const content =
        fs.readFileSync(
          VAULT_FILE,
          'utf8'
        );

      if (content.trim()) {
        const parsed =
          JSON.parse(content);

        return {
          keys:
            parsed?.keys || {},
        };
      }
    }
  } catch (err) {
    console.error(
      '[CryptoVault] Error loading vault:',
      err
    );
  }

  return {
    keys: {},
  };
}

/**
 * Saves the encrypted server vault.
 */
function saveVault(
  vault: VaultData
): void {
  try {
    fs.writeFileSync(
      VAULT_FILE,
      JSON.stringify(
        vault,
        null,
        2
      ),
      'utf8'
    );
  } catch (err) {
    console.error(
      '[CryptoVault] Error saving vault:',
      err
    );

    throw new Error(
      'Failed to save encrypted API key vault'
    );
  }
}

/**
 * Stores a Gemini API key strictly under one Firebase UID.
 *
 * The raw key is encrypted before being written to disk.
 */
export function storeUserApiKey(
  uid: string,
  rawApiKey: string
): { maskedKey: string } {
  if (!uid) {
    throw new Error(
      'UID is required'
    );
  }

  const cleanKey =
    rawApiKey.trim();

  if (!cleanKey) {
    throw new Error(
      'API Key cannot be empty'
    );
  }

  // Encryption is performed before anything is persisted.
  const encryptedKey =
    encryptApiKey(cleanKey);

  const maskedKey =
    maskApiKey(cleanKey);

  const vault =
    loadVault();

  /**
   * CRITICAL:
   * The Firebase UID is the only ownership key.
   *
   * User A:
   * vault.keys["UID_A"]
   *
   * User B:
   * vault.keys["UID_B"]
   */
  vault.keys[uid] = {
    encryptedKey,
    maskedKey,
    updatedAt:
      new Date().toISOString(),
  };

  saveVault(vault);

  return {
    maskedKey,
  };
}

/**
 * Retrieves the decrypted Gemini API key for ONE UID.
 *
 * This function is server-side only.
 * It must NEVER be exposed directly through an API response.
 */
export function getUserDecryptedApiKey(
  uid: string
): string | null {
  if (!uid) {
    return null;
  }

  const vault =
    loadVault();

  const entry =
    vault.keys[uid];

  if (
    !entry ||
    !entry.encryptedKey
  ) {
    return null;
  }

  try {
    return decryptApiKey(
      entry.encryptedKey
    );
  } catch (err) {
    console.error(
      `[CryptoVault] Failed to decrypt API key for UID: ${uid}`,
      err
    );

    return null;
  }
}

/**
 * Returns only the masked key for UI display.
 *
 * The real Gemini API key is never returned.
 */
export function getUserMaskedApiKey(
  uid: string
): string | null {
  if (!uid) {
    return null;
  }

  const vault =
    loadVault();

  return (
    vault.keys[uid]
      ?.maskedKey ||
    null
  );
}

/**
 * Deletes the Gemini API key belonging to ONE UID.
 */
export function deleteUserApiKey(
  uid: string
): boolean {
  if (!uid) {
    return false;
  }

  const vault =
    loadVault();

  if (!vault.keys[uid]) {
    return false;
  }

  delete vault.keys[uid];

  saveVault(vault);

  return true;
}
