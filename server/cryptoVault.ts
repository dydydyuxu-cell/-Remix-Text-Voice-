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
