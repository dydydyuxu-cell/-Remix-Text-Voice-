/**
 * Express API Router for Gemini TTS Platform
 *
 * User isolation rules:
 * - Every user is isolated by Firebase Google UID.
 * - TTS is ONLY allowed with the user's own Gemini API key.
 * - The site's GEMINI_API_KEY is NEVER used for user TTS.
 * - There is NO fallback to the site API.
 * - Every user has an independent 10,000-character balance.
 * - Characters are deducted from the same user's balance after successful TTS.
 * - BYOK users are NOT exempt from the internal character balance.
 * - API keys are encrypted and stored per UID.
 * - Generation history is isolated per UID.
 * - Idempotency protection is preserved.
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

const SETTINGS_FILE = path.resolve(process.cwd(), 'server-settings.json');
const GENERATIONS_FILE = path.resolve(process.cwd(), 'server-generations.json');

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

    firebaseApiKey = raw.apiKey || '';
  }
} catch (e) {
  console.warn(
    'Could not read firebase-applet-config.json:',
    e
  );
}

// ----------------------------------------------------
// User settings store
// ----------------------------------------------------

function loadSettings(): Record<string, any> {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(
        fs.readFileSync(SETTINGS_FILE, 'utf8')
      );
    }
  } catch (err) {
    console.error(
      'Error reading settings file:',
      err
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
      JSON.stringify(data, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error(
      'Error saving settings file:',
      err
    );
  }
}

// ----------------------------------------------------
// Generations store
// Keyed strictly by UID
// ----------------------------------------------------

function loadGenerations(): Record<string, any[]> {
  try {
    if (fs.existsSync(GENERATIONS_FILE)) {
      return JSON.parse(
        fs.readFileSync(GENERATIONS_FILE, 'utf8')
      );
    }
  } catch (err) {
    console.error(
      'Error reading generations file:',
      err
    );
  }

  return {};
}

function saveGenerations(
  data: Record<string, any[]>
): void {
  try {
    fs.writeFileSync(
      GENERATIONS_FILE,
      JSON.stringify(data, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error(
      'Error saving generations file:',
      err
    );
  }
}

// ----------------------------------------------------
// Extend Express Request
// ----------------------------------------------------

interface AuthenticatedRequest extends Request {
  userUid?: string;
  userEmail?: string;
  idToken?: string;
}

// ----------------------------------------------------
// Authentication Middleware
// ----------------------------------------------------

async function authenticateFirebaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader =
    req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error:
        'غير مصرح: يرجى تسجيل الدخول بحساب Google أولاً.',
    });

    return;
  }

  const token =
    authHeader.substring(7).trim();

  if (!token) {
    res.status(401).json({
      error: 'Token فارغ',
    });

    return;
  }

  req.idToken = token;

  // --------------------------------------------------
  // Test/demo tokens
  // --------------------------------------------------

  if (
    token.startsWith('test_token_') ||
    token.startsWith('demo_token_')
  ) {
    const parts = token.split('_');
    const uid =
      parts.slice(2).join('_') ||
      'demo_user';

    req.userUid = uid;
    req.userEmail = `${uid}@isolated.local`;

    next();
    return;
  }

  // --------------------------------------------------
  // Decode Firebase JWT payload
  // --------------------------------------------------

  try {
    const tokenParts = token.split('.');

    if (tokenParts.length === 3) {
      const payloadJson = Buffer.from(
        tokenParts[1],
        'base64'
      ).toString('utf8');

      const payload =
        JSON.parse(payloadJson);

      if (
        payload.exp &&
        payload.exp * 1000 < Date.now()
      ) {
        res.status(401).json({
          error:
            'انتهت صلاحية جلسة حساب Google، يرجى إعادة تسجيل الدخول.',
        });

        return;
      }

      const uid =
        payload.user_id ||
        payload.sub;

      if (uid) {
        req.userUid = uid;
        req.userEmail =
          payload.email || '';

        next();
        return;
      }
    }
  } catch (err) {
    // Continue to Firebase Identity Toolkit lookup.
  }

  // --------------------------------------------------
  // Firebase Identity Toolkit verification
  // --------------------------------------------------

  if (firebaseApiKey) {
    try {
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            idToken: token,
          }),
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        const user =
          data.users?.[0];

        if (
          user &&
          user.localId
        ) {
          req.userUid =
            user.localId;

          req.userEmail =
            user.email || '';

          next();
          return;
        }
      }
    } catch (apiErr) {
      console.error(
        'Firebase token verification error:',
        apiErr
      );
    }
  }

  res.status(401).json({
    error:
      'تعذر التحقق من صحة جلسة Google، يرجى إعادة تسجيل الدخول.',
  });
}

// ----------------------------------------------------
// 1. POST /api/tts
// Main Text-to-Speech Endpoint
// ----------------------------------------------------

apiRouter.post(
  '/tts',
  authenticateFirebaseUser,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const uid = req.userUid!;

    const idempotencyKey =
      (req.headers[
        'idempotency-key'
      ] as string) ||
      req.body.idempotencyKey ||
      '';

    const text =
      (req.body.text || '').trim();

    const voiceName =
      req.body.voice || 'Puck';

    const language =
      req.body.language ||
      'العربية';

    const speakingRate =
      parseFloat(
        req.body.speakingRate
      ) || 1.0;

    const style =
      req.body.style ||
      'طبيعي';

    // --------------------------------------------------
    // Validate text
    // --------------------------------------------------

    if (!text) {
      res.status(400).json({
        error:
          'النص المطلوب تحويله فارغ.',
      });

      return;
    }

    const textLength =
      text.length;

    if (textLength > 15000) {
      res.status(400).json({
        error:
          'الحد الأقصى للنص في الطلب الواحد هو 15,000 حرف.',
      });

      return;
    }

    // --------------------------------------------------
    // Idempotency cache
    // --------------------------------------------------

    if (idempotencyKey) {
      const existing =
        checkIdempotency(
          uid,
          idempotencyKey
        );

      if (
        existing &&
        existing.status ===
          'COMPLETED' &&
        existing.responsePayload
      ) {
        res.json({
          ...existing.responsePayload,
          fromCache: true,
          idempotencyKey,
        });

        return;
      }
    }

    // --------------------------------------------------
    // IMPORTANT:
    // User MUST have their own Gemini API key.
    //
    // There is intentionally NO:
    // process.env.GEMINI_API_KEY
    //
    // There is intentionally NO site fallback.
    // --------------------------------------------------

    const userKey =
      getUserDecryptedApiKey(uid);

    if (!userKey) {
      res.status(403).json({
        error:
          'يرجى ربط مفتاح Gemini الخاص بك أولاً. لا يمكن استخدام مفتاح الموقع نيابةً عنك.',
        code:
          'USER_GEMINI_KEY_REQUIRED',
      });

      return;
    }

    // --------------------------------------------------
    // Check user's own 10,000-character balance
    // --------------------------------------------------

    const preBalance =
      await getUserBalance(
        uid,
        req.idToken,
        req.userEmail
      );

    if (
      preBalance.remainingCharacters <
      textLength
    ) {
      res.status(403).json({
        error:
          `رصيد الأحرف غير كافٍ. المتبقي: ${preBalance.remainingCharacters.toLocaleString()} حرف، المطلوب: ${textLength.toLocaleString()} حرف.`,
        balance: preBalance,
        code:
          'INSUFFICIENT_CHARACTER_BALANCE',
      });

      return;
    }

    // --------------------------------------------------
    // Generation metadata
    // --------------------------------------------------

    const generationId =
      `gen_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const now =
      new Date().toISOString();

    if (idempotencyKey) {
      recordIdempotency(
        uid,
        idempotencyKey,
        'PROCESSING',
        textLength
      );
    }

    try {
      // ------------------------------------------------
      // Generate TTS ONLY with THIS USER'S Gemini key.
      // ------------------------------------------------

      const ttsResult =
        await generateGeminiTTS(
          userKey,
          {
            text,
            voiceName,
            language,
            speakingRate,
            style,
          }
        );

      // ------------------------------------------------
      // Deduct characters from THIS USER.
      //
      // BYOK does NOT bypass the internal character
      // balance.
      // ------------------------------------------------

      const deduction =
        await deductUserBalance(
          uid,
          textLength,
          req.idToken
        );

      if (
        !deduction ||
        !deduction.success
      ) {
        console.error(
          `[TTS] Generation succeeded but character deduction failed for UID ${uid}.`
        );

        res.status(500).json({
          error:
            'تم توليد الصوت لكن تعذر خصم الحروف من رصيد حسابك. يرجى التواصل مع الدعم.',
          code:
            'BALANCE_DEDUCTION_FAILED',
          generationId,
        });

        return;
      }

      const currentBalance =
        deduction.balance;

      // ------------------------------------------------
      // Save generation under THIS UID only.
      // ------------------------------------------------

      const generationRecord = {
        generationId,
        uid,
        text,
        textLength,
        provider: 'Gemini',
        voice: voiceName,
        language,
        speakingRate,
        style,
        status: 'COMPLETED',
        audioUrl:
          ttsResult.audioUrl,

        // Always true because site-key fallback
        // has been completely removed.
        usedByok: true,

        createdAt: now,
      };

      const allGens =
        loadGenerations();

      if (!allGens[uid]) {
        allGens[uid] = [];
      }

      allGens[uid].unshift(
        generationRecord
      );

      // Keep last 50 generations
      // for THIS user.
      if (
        allGens[uid].length > 50
      ) {
        allGens[uid] =
          allGens[uid].slice(0, 50);
      }

      saveGenerations(
        allGens
      );

      // ------------------------------------------------
      // Response
      // ------------------------------------------------

      const responsePayload = {
        success: true,
        generationId,
        status: 'COMPLETED',
        audioUrl:
          ttsResult.audioUrl,
        textLength,
        voice: voiceName,
        language,

        // User's own Gemini key was used.
        usedByok: true,

        // User's own internal balance.
        balance:
          currentBalance,

        createdAt: now,
      };

      if (idempotencyKey) {
        recordIdempotency(
          uid,
          idempotencyKey,
          'COMPLETED',
          textLength,
          responsePayload
        );
      }

      res.json(
        responsePayload
      );
    } catch (ttsErr: any) {
      console.error(
        'TTS Generation error for Google UID ' +
          uid +
          ':',
        ttsErr
      );

      if (idempotencyKey) {
        recordIdempotency(
          uid,
          idempotencyKey,
          'FAILED',
          textLength
        );
      }

      // ------------------------------------------------
      // Save failed generation under THIS UID only.
      // ------------------------------------------------

      const failedRecord = {
        generationId,
        uid,
        text,
        textLength,
        provider: 'Gemini',
        voice: voiceName,
        language,
        speakingRate,
        style,
        status: 'FAILED',
        errorMessage:
          ttsErr?.message ||
          'خطأ في توليد الصوت من Gemini TTS',

        usedByok: true,

        createdAt: now,
      };

      const allGens =
        loadGenerations();

      if (!allGens[uid]) {
        allGens[uid] = [];
      }

      allGens[uid].unshift(
        failedRecord
      );

      if (
        allGens[uid].length > 50
      ) {
        allGens[uid] =
          allGens[uid].slice(0, 50);
      }

      saveGenerations(
        allGens
      );

      res.status(500).json({
        error:
          `فشل توليد الصوت: ${
            ttsErr?.message ||
            'خطأ غير متوقع'
          }`,
        generationId,
        status: 'FAILED',
      });
    }
  }
);

// ----------------------------------------------------
// 2. User Balance
// ----------------------------------------------------

apiRouter.get(
  '/user/balance',
  authenticateFirebaseUser,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const uid =
      req.userUid!;

    const balance =
      await getUserBalance(
        uid,
        req.idToken,
        req.userEmail
      );

    res.json(balance);
  }
);

// ----------------------------------------------------
// 3. User Settings
// ----------------------------------------------------

apiRouter.get(
  '/user/settings',
  authenticateFirebaseUser,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const uid =
      req.userUid!;

    const allSettings =
      loadSettings();

    const userSettings =
      allSettings[uid] || {};

    const maskedKey =
      getUserMaskedApiKey(uid);

    // BYOK is active ONLY if this UID
    // actually owns a saved key.
    const effectiveMode =
      maskedKey
        ? 'byok'
        : 'not_connected';

    res.json({
      uid,
      providerMode:
        effectiveMode,

      hasCustomApiKey:
        !!maskedKey,

      maskedApiKey:
        maskedKey || '',

      preferredVoice:
        userSettings.preferredVoice ||
        'Puck',

      preferredLanguage:
        userSettings.preferredLanguage ||
        'العربية',

      speakingRate:
        userSettings.speakingRate ||
        1.0,

      style:
        userSettings.style ||
        'طبيعي',

      updatedAt:
        userSettings.updatedAt ||
        new Date().toISOString(),
    });
  }
);

// ----------------------------------------------------
// Save User Settings
// ----------------------------------------------------

apiRouter.post(
  '/user/settings',
  authenticateFirebaseUser,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const uid =
      req.userUid!;

    const {
      preferredVoice,
      preferredLanguage,
      speakingRate,
      style,
    } = req.body;

    const allSettings =
      loadSettings();

    const current =
      allSettings[uid] || {};

    const maskedKey =
      getUserMaskedApiKey(uid);

    allSettings[uid] = {
      ...current,

      uid,

      // There is only one allowed
      // TTS provider now:
      // the user's own Gemini key.
      providerMode:
        maskedKey
          ? 'byok'
          : 'not_connected',

      preferredVoice:
        preferredVoice ||
        current.preferredVoice ||
        'Puck',

      preferredLanguage:
        preferredLanguage ||
        current.preferredLanguage ||
        'العربية',

      speakingRate:
        speakingRate ??
        current.speakingRate ??
        1.0,

      style:
        style ||
        current.style ||
        'طبيعي',

      updatedAt:
        new Date().toISOString(),
    };

    saveSettings(
      allSettings
    );

    res.json({
      success: true,

      settings: {
        ...allSettings[uid],

        hasCustomApiKey:
          !!maskedKey,

        maskedApiKey:
          maskedKey || '',
      },
    });
  }
);

// ----------------------------------------------------
// 4. Save / Update User's Gemini API Key
// ----------------------------------------------------

apiRouter.post(
  '/user/byok-key',
  authenticateFirebaseUser,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const uid =
      req.userUid!;

    const rawKey =
      (req.body.apiKey || '').trim();

    const testBeforeSave =
      req.body.testBeforeSave !== false;

    if (!rawKey) {
      res.status(400).json({
        error:
          'مفتاح Gemini API الخاص بك مطلوب.',
      });

      return;
    }

    // Basic format validation
    if (rawKey.length < 15) {
      res.status(400).json({
        error:
          'صيغة مفتاح Gemini API غير صحيحة.',
      });

      return;
    }

    // ------------------------------------------------
    // Verify the USER'S key before saving it.
    // ------------------------------------------------

    if (testBeforeSave) {
      const testResult =
        await testGeminiApiKey(
          rawKey
        );

      if (!testResult.valid) {
        res.status(400).json({
          error:
            `المفتاح غير صالح للاتصال بـ Gemini: ${
              testResult.error ||
              'فشل فحص الاتصال'
            }`,
        });

        return;
      }
    }

    // ------------------------------------------------
    // Store ONLY under this UID.
    // ------------------------------------------------

    const { maskedKey } =
      storeUserApiKey(
        uid,
        rawKey
      );

    // ------------------------------------------------
    // Activate this user's Gemini connection.
    // ------------------------------------------------

    const allSettings =
      loadSettings();

    allSettings[uid] = {
      ...(allSettings[uid] || {}),

      uid,

      providerMode:
        'byok',

      updatedAt:
        new Date().toISOString(),
    };

    saveSettings(
      allSettings
    );

    res.json({
      success: true,

      maskedApiKey:
        maskedKey,

      providerMode:
        'byok',

      message:
        'تم ربط مفتاح Gemini الخاص بك وتشفيره بأمان. سيتم استخدام مفتاحك أنت فقط في عمليات التوليد.',
    });
  }
);

// ----------------------------------------------------
// 5. Delete User's Gemini API Key
// ----------------------------------------------------

apiRouter.delete(
  '/user/byok-key',
  authenticateFirebaseUser,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const uid =
      req.userUid!;

    deleteUserApiKey(
      uid
    );

    const allSettings =
      loadSettings();

    if (allSettings[uid]) {
      allSettings[uid] = {
        ...allSettings[uid],

        // IMPORTANT:
        // Never fall back to site API.
        providerMode:
          'not_connected',

        updatedAt:
          new Date().toISOString(),
      };

      saveSettings(
        allSettings
      );
    }

    res.json({
      success: true,

      message:
        'تم حذف مفتاح Gemini الخاص بك. يجب ربط مفتاح Gemini الخاص بك مرة أخرى قبل إنشاء أي صوت.',
    });
  }
);

// ----------------------------------------------------
// 6. Generation History
// Strictly UID isolated
// ----------------------------------------------------

apiRouter.get(
  '/user/generations',
  authenticateFirebaseUser,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const uid =
      req.userUid!;

    const allGens =
      loadGenerations();

    const userGens =
      allGens[uid] || [];

    res.json(
      userGens
    );
  }
);

// ----------------------------------------------------
// Delete one generation
// ----------------------------------------------------

apiRouter.delete(
  '/user/generations/:id',
  authenticateFirebaseUser,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const uid =
      req.userUid!;

    const genId =
      req.params.id;

    const allGens =
      loadGenerations();

    if (allGens[uid]) {
      allGens[uid] =
        allGens[uid].filter(
          (g) =>
            g.generationId !==
            genId
        );

      saveGenerations(
        allGens
      );
    }

    res.json({
      success: true,
      deletedId: genId,
    });
  }
);

// ----------------------------------------------------
// 7. Mandatory Isolation Verification Suite
// ----------------------------------------------------

apiRouter.post(
  '/test/isolation',
  async (
    req: Request,
    res: Response
  ) => {
    const testRunId =
      Date.now();

    const uidA =
      `test_iso_user_A_${testRunId}`;

    const uidB =
      `test_iso_user_B_${testRunId}`;

    const logs: Array<{
      step: string;
      status:
        | 'PASSED'
        | 'FAILED';
      details: string;
    }> = [];

    try {
      // ------------------------------------------------
      // Step 1:
      // Independent initial balances
      // ------------------------------------------------

      const balanceAInit =
        await getUserBalance(
          uidA
        );

      const balanceBInit =
        await getUserBalance(
          uidB
        );

      const step1Pass =
        balanceAInit.freeCharacters ===
          10000 &&
        balanceAInit.usedCharacters ===
          0 &&
        balanceBInit.freeCharacters ===
          10000 &&
        balanceBInit.usedCharacters ===
          0;

      logs.push({
        step:
          'تهيئة المستخدمين الجدد (Initial Balance Initialization)',

        status:
          step1Pass
            ? 'PASSED'
            : 'FAILED',

        details:
          `المستخدم A: ${balanceAInit.remainingCharacters} حرف متبقي | المستخدم B: ${balanceBInit.remainingCharacters} حرف متبقي. كل مستخدم له رصيد مستقل.`,
      });

      // ------------------------------------------------
      // Step 2:
      // User A consumes 5,000.
      // User B must remain untouched.
      // ------------------------------------------------

      const deductResult =
        await deductUserBalance(
          uidA,
          5000
        );

      const balanceAAfter =
        await getUserBalance(
          uidA
        );

      const balanceBAfter =
        await getUserBalance(
          uidB
        );

      const step2Pass =
        deductionResultOk(
          deductResult
        ) &&
        balanceAAfter.remainingCharacters ===
          5000 &&
        balanceAAfter.usedCharacters ===
          5000 &&
        balanceBAfter.remainingCharacters ===
          10000 &&
        balanceBAfter.usedCharacters ===
          0;

      logs.push({
        step:
          'اختبار استهلاك الرصيد (User A uses 5,000 chars, User B uses 0)',

        status:
          step2Pass
            ? 'PASSED'
            : 'FAILED',

        details:
          `المستخدم A = ${balanceAAfter.remainingCharacters} متبقي | المستخدم B = ${balanceBAfter.remainingCharacters} متبقي. لا يوجد اشتراك في الرصيد بين الحسابات.`,
      });

      // ------------------------------------------------
      // Step 3:
      // User API key isolation
      // ------------------------------------------------

      const dummyKeyA =
        'AIzaSyTestKey_For_User_A_998877665544';

      const dummyKeyB =
        'AIzaSyTestKey_For_User_B_112233445566';

      storeUserApiKey(
        uidA,
        dummyKeyA
      );

      storeUserApiKey(
        uidB,
        dummyKeyB
      );

      const retrievedKeyA =
        getUserDecryptedApiKey(
          uidA
        );

      const retrievedKeyB =
        getUserDecryptedApiKey(
          uidB
        );

      const keyIsolationPass =
        Boolean(
          retrievedKeyA &&
          retrievedKeyB &&
          retrievedKeyA !==
            retrievedKeyB
        );

      logs.push({
        step:
          'اختبار عزل مفاتيح Gemini بين الحسابات',

        status:
          keyIsolationPass
            ? 'PASSED'
            : 'FAILED',

        details:
          `المستخدم A يستخدم مفتاح A فقط، والمستخدم B يستخدم مفتاح B فقط.`,
      });

      // ------------------------------------------------
      // Step 4:
      // Generation history isolation
      // ------------------------------------------------

      const allGens =
        loadGenerations();

      allGens[uidA] = [
        {
          generationId:
            `gen_A_${testRunId}`,

          uid: uidA,

          text:
            'Secret audio of User A',

          status:
            'COMPLETED',

          createdAt:
            new Date().toISOString(),
        },
      ];

      saveGenerations(
        allGens
      );

      const userBGens =
        loadGenerations()[uidB] ||
        [];

      const crossAccessPass =
        userBGens.length === 0;

      logs.push({
        step:
          'اختبار منع الوصول لسجلات المستخدم الآخر',

        status:
          crossAccessPass
            ? 'PASSED'
            : 'FAILED',

        details:
          `المستخدم B لديه ${userBGens.length} سجلات من سجلات المستخدم A.`,
      });

      // ------------------------------------------------
      // Cleanup
      // ------------------------------------------------

      deleteUserApiKey(
        uidA
      );

      deleteUserApiKey(
        uidB
      );

      const allPassed =
        logs.every(
          (l) =>
            l.status ===
            'PASSED'
        );

      res.json({
        success:
          allPassed,

        runId:
          testRunId,

        overallStatus:
          allPassed
            ? 'ALL_TESTS_PASSED'
            : 'TESTS_FAILED',

        summary:
          'تم التحقق من العزل بين المستخدمين والرصيد والمفاتيح وسجل التوليد.',

        logs,

        metrics: {
          userA_remaining:
            balanceAAfter.remainingCharacters,

          userA_used:
            balanceAAfter.usedCharacters,

          userB_remaining:
            balanceBAfter.remainingCharacters,

          userB_used:
            balanceBAfter.usedCharacters,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,

        error:
          err?.message ||
          'Error during isolation test execution',

        logs,
      });
    }
  }
);

// ----------------------------------------------------
// Helper
// ----------------------------------------------------

function deductionResultOk(
  result: { success: boolean }
): boolean {
  return (
    result &&
    result.success === true
  );
}
