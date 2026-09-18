/**
 * Server-side Secure Vault for BYOK API Keys
 * Uses AES-256-GCM encryption with SHA-256 derived keys.
 * Raw API keys are NEVER sent to the frontend or exposed to public Firestore.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Storage path for encrypted user vault on server
const VAULT_FILE = path.resolve(process.cwd(), 'server-vault.json');

function getMasterKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || 'gemini_tts_secure_vault_master_key_2026';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptApiKey(plainKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
  let encrypted = cipher.update(plainKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptApiKey(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return 'AIza••••••••';
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}${'•'.repeat(8)}${suffix}`;
}

interface VaultData {
  keys: Record<string, {
    encryptedKey: string;
    maskedKey: string;
    updatedAt: string;
  }>;
}

function loadVault(): VaultData {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const content = fs.readFileSync(VAULT_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading vault:', err);
  }
  return { keys: {} };
}

function saveVault(vault: VaultData): void {
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving vault:', err);
  }
}

/**
 * Stores encrypted BYOK key strictly associated with this UID.
 */
export function storeUserApiKey(uid: string, rawApiKey: string): { maskedKey: string } {
  if (!uid) throw new Error('UID is required');
  const cleanKey = rawApiKey.trim();
  if (!cleanKey) throw new Error('API Key cannot be empty');

  const encryptedKey = encryptApiKey(cleanKey);
  const maskedKey = maskApiKey(cleanKey);

  const vault = loadVault();
  vault.keys[uid] = {
    encryptedKey,
    maskedKey,
    updatedAt: new Date().toISOString(),
  };
  saveVault(vault);

  return { maskedKey };
}

/**
 * Retrieves decrypted API key for UID. Never returns this to frontend.
 */
export function getUserDecryptedApiKey(uid: string): string | null {
  if (!uid) return null;
  const vault = loadVault();
  const entry = vault.keys[uid];
  if (!entry || !entry.encryptedKey) return null;
  try {
    return decryptApiKey(entry.encryptedKey);
  } catch (err) {
    console.error(`Failed to decrypt API key for UID: ${uid}`, err);
    return null;
  }
}

/**
 * Returns masked key for UI display (e.g. AIza••••••••1234).
 */
export function getUserMaskedApiKey(uid: string): string | null {
  if (!uid) return null;
  const vault = loadVault();
  return vault.keys[uid]?.maskedKey || null;
}

/**
 * Removes BYOK key for this UID.
 */
export function deleteUserApiKey(uid: string): boolean {
  if (!uid) return false;
  const vault = loadVault();
  if (vault.keys[uid]) {
    delete vault.keys[uid];
    saveVault(vault);
    return true;
  }
  return false;
}
