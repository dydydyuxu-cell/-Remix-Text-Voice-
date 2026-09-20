/**
 * Express API Router for Gemini TTS Platform
 *
 * User isolation rules:
 * - Every user is isolated by verified Firebase Google UID.
 * - TTS is ONLY allowed with the user's own Gemini API key.
 * - The site's GEMINI_API_KEY is NEVER used for user TTS.
 * - There is NO fallback to the site API.
 * - Every user has an independent 10,000-character balance.
 * - Characters are deducted from the same user's balance after successful TTS.
 * - BYOK users are NOT exempt from the internal character balance.
 * - API keys are encrypted and stored per UID.
 * - Generation history is isolated per UID.
 * - Idempotency protection is preserved.
 *
 * IMPORTANT:
 * Firebase ID tokens are verified through Firebase Identity Toolkit.
 * The server NEVER trusts a UID supplied by the client.
 */

import { Router, Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  getUserBalance,
  deductUserBalance,
  checkIdempotency,
  recordIdempotency,
} from './balanceManager.ts';

import {
  storeUserApiKey,
  getUserDecryptedApiKey,
  getUserMaskedApiKey,
  deleteUserApiKey,
} from './cryptoVault.ts';

import {
  generateGeminiTTS,
  testGeminiApiKey,
} from './ttsService.ts';

export const apiRouter = Router();

// ----------------------------------------------------
// Storage files
// ----------------------------------------------------

const SETTINGS_FILE = path.resolve(
  process.cwd(),
  'server-settings.json'
);

const GENERATIONS_FILE = path.resolve(
  process.cwd(),
  'server-generations.json'
);

// ----------------------------------------------------
// Firebase configuration
// ----------------------------------------------------

let firebaseApiKey = '';

try {
  const cfgPath = path.resolve(
    process.cwd(),
    'firebase-applet-config.json'
  );

  if (fs.existsSync(cfgPath)) {
    const raw = JSON.parse(
      fs.readFileSync(cfgPath, 'utf8')
    );

    firebaseApiKey =
      typeof raw.apiKey === 'string'
        ? raw.apiKey.trim()
        : '';
  }
} catch (error) {
  console.error(
    'Could not read firebase-applet-config.json:',
    error
  );
}

// ----------------------------------------------------
// User settings store
// ----------------------------------------------------

function loadSettings(): Record<string, any> {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw =
        fs.readFileSync(
          SETTINGS_FILE,
          'utf8'
        );

      const parsed =
        JSON.parse(raw);

      if (
        parsed &&
        typeof parsed === 'object'
      ) {
        return parsed;
      }
    }
  } catch (error) {
    console.error(
      'Error reading settings file:',
      error
    );
  }

  return {};
}

function saveSettings(
  data: Record<string, any>
): void {
  try {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(
        data,
        null,
        2
      ),
      'utf8'
    );
  } catch (error) {
    console.error(
      'Error saving settings file:',
      error
    );
  }
}

// ----------------------------------------------------
// Generations store
// Keyed strictly by verified UID
// ----------------------------------------------------

function loadGenerations(): Record<string, any[]> {
  try {
    if (fs.existsSync(GENERATIONS_FILE)) {
      const raw =
        fs.readFileSync(
          GENERATIONS_FILE,
          'utf8'
        );

      const parsed =
        JSON.parse
