/**
 * Express API Router for Gemini TTS Platform
 *
 * User isolation rules:
 * - Every user is isolated by Firebase Google UID.
 * - TTS is ONLY allowed with the user's own Gemini API key.
 * - The site's GEMINI_API_KEY is NEVER used for user TTS.
 * - There is NO fallback to the site API.
 * - Every user has an independent 10,000-character balance.
 * - Characters are RESERVED/DEDUCTED before TTS generation.
 * - If Gemini generation fails, the reserved characters are refunded.
 * - BYOK users are NOT exempt from the internal character balance.
 * - API keys are encrypted and stored per UID.
 * - Generation history is isolated per UID.
 * - Idempotency protection is preserved.
 */

import {
  Router,
  Request,
  Response,
  NextFunction,
} from 'express';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  getUserBalance,
  deductUserBalance,
  refundUserBalance,
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

export const apiRouter =
  Router();

// ----------------------------------------------------
// Storage files
// ----------------------------------------------------

const SETTINGS_FILE =
  path.resolve(
    process.cwd(),
    'server-settings.json'
  );

const GENERATIONS_FILE =
  path.resolve(
    process.cwd(),
    'server-generations.json'
  );

// ----------------------------------------------------
// Firebase configuration
// ----------------------------------------------------

let firebaseApiKey = '';

try {
  const cfgPath =
    path.resolve(
      process.cwd(),
      'firebase-applet-config.json'
    );

  if (
    fs.existsSync(
      cfgPath
    )
  ) {
    const raw =
      JSON.parse(
        fs.readFileSync(
          cfgPath,
          'utf8'
        )
      );

    firebaseApiKey =
      raw.apiKey || '';
  }
} catch (error) {
  console.warn(
    'Could not read firebase-applet-config.json:',
    error
  );
}

// ----------------------------------------------------
// User settings store
// ----------------------------------------------------

function loadSettings(): Record<
  string,
  any
> {
  try {
    if (
      fs.existsSync(
        SETTINGS_FILE
      )
    ) {
      return JSON.parse(
        fs.readFileSync(
          SETTINGS_FILE,
          'utf8'
        )
      );
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
  data: Record<
    string,
    any
  >
): void {
  fs.writeFileSync(
    SETTINGS_FILE,
    JSON.stringify(
      data,
      null,
      2
    ),
    'utf8'
  );
}

// ----------------------------------------------------
// Generations store
// ----------------------------------------------------

function loadGenerations(): Record<
  string,
  any[]
> {
  try {
    if (
      fs.existsSync(
        GENERATIONS_FILE
      )
    ) {
      return JSON.parse(
        fs.readFileSync(
          GENERATIONS_FILE,
          'utf8'
        )
      );
    }
  } catch (error) {
    console.error(
      'Error reading generations file:',
      error
    );
  }

  return {};
}

function saveGenerations(
  data: Record<
    string,
    any[]
  >
): void {
  fs.writeFileSync(
    GENERATIONS_FILE,
    JSON.stringify(
      data,
      null,
      2
    ),
    'utf8'
  );
}

// ----------------------------------------------------
// Authenticated request
// ----------------------------------------------------

interface AuthenticatedRequest
  extends Request {
  userUid?: string;
  userEmail?: string;
  idToken?: string;
}

// ----------------------------------------------------
// Firebase authentication
// ----------------------------------------------------

async function authenticateFirebaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader =
    req.headers.authorization ||
    '';

  if (
    !authHeader.startsWith(
      'Bearer '
    )
  ) {
    res.status(401).json({
      error:
        'غير مصرح: يرجى تسجيل الدخول بحساب Google أولاً.',
    });

    return;
  }

  const token =
    authHeader
      .substring(7)
      .trim();

  if (!token) {
    res.status(401).json({
      error:
        'Token فارغ',
    });

    return;
  }

  req.idToken =
    token;

  // --------------------------------------------------
  // IMPORTANT:
  // No test/demo tokens are accepted.
  // --------------------------------------------------

  // --------------------------------------------------
  // Verify with Firebase Identity Toolkit.
  // --------------------------------------------------

  if (!firebaseApiKey) {
    res.status(500).json({
      error:
        'إعداد Firebase API غير موجود على الخادم.',
    });

    return;
  }

  try {
    const response =
      await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              idToken:
                token,
            }),
        }
      );

    if (
      response.ok
    ) {
      const data =
        await response.json();

      const user =
        data.users?.[0];

      if (
        user &&
        user.localId
      ) {
        req.userUid =
          user.localId;

        req.userEmail =
          user.email ||
          '';

        next();

        return;
      }
    }
  } catch (error) {
    console.error(
      'Firebase token verification error:',
      error
    );
  }

  res.status(401).json({
    error:
      'تعذر التحقق من صحة جلسة Google، يرجى إعادة تسجيل الدخول.',
  });
}

// ----------------------------------------------------
// POST /api/tts
// ----------------------------------------------------

apiRouter.post(
  '/tts',
  authenticateFirebaseUser,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const uid =
      req.userUid!;

    const idempotencyKey =
      (
        req.headers[
          'idempotency-key'
        ] as string
      ) ||
      req.body.idempotencyKey ||
      '';

    const text =
      (
        req.body.text ||
        ''
      ).trim();

    const voiceName =
      req.body.voice ||
      'Puck';

    const language =
      req.body.language ||
      'العربية';

    const parsedRate =
      parseFloat(
        req.body.speakingRate
      );

    const speakingRate =
      Number.isFinite(
        parsedRate
      )
        ? parsedRate
        : 1.0;

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

    if (
      textLength > 15000
    ) {
      res.status(400).json({
        error:
          'الحد الأقصى للنص في الطلب الواحد هو 15,000 حرف.',
      });

      return;
    }

    if (
      speakingRate < 0.5 ||
      speakingRate > 2
    ) {
      res.status(400).json({
        error:
          'سرعة النطق يجب أن تكون بين 0.5 و 2.',
      });

      return;
    }

    // --------------------------------------------------
    // Idempotency
    // --------------------------------------------------

    if (
      idempotencyKey
    ) {
      const existing =
        checkIdempotency(
          uid,
          idempotencyKey
        );

      if (
        existing
      ) {
        if (
          existing.status ===
            'COMPLETED' &&
          existing.responsePayload
        ) {
          res.json({
            ...existing.responsePayload,
            fromCache:
              true,
            idempotencyKey,
          });

          return;
        }

        if (
          existing.status ===
          'PROCESSING'
        ) {
          res.status(409).json({
            error:
              'هذا الطلب قيد المعالجة بالفعل.',
            code:
              'REQUEST_PROCESSING',
            idempotencyKey,
          });

          return;
        }

        if (
          existing.status ===
          'FAILED'
        ) {
          // Allow a new request with the same
          // idempotency key after a failed request.
          recordIdempotency(
            uid,
            idempotencyKey,
            'PROCESSING',
            textLength
          );
        }
      } else {
        recordIdempotency(
          uid,
          idempotencyKey,
          'PROCESSING',
          textLength
        );
      }
    }

    // --------------------------------------------------
    // User's own Gemini key ONLY.
    // --------------------------------------------------

    const userKey =
      getUserDecryptedApiKey(
        uid
      );

    if (!userKey) {
      if (
        idempotencyKey
      ) {
        recordIdempotency(
          uid,
          idempotencyKey,
          'FAILED',
          textLength
        );
      }

      res.status(403).json({
        error:
          'يرجى ربط مفتاح Gemini الخاص بك أولاً. لا يمكن استخدام مفتاح الموقع نيابةً عنك.',
        code:
          'USER_GEMINI_KEY_REQUIRED',
      });

      return;
    }

    // --------------------------------------------------
    // IMPORTANT:
    //
    // Reserve/deduct BEFORE Gemini.
    //
    // This prevents the dangerous situation where
    // Gemini generates audio but the balance deduction
    // fails afterward.
    // --------------------------------------------------

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
      if (
        idempotencyKey
      ) {
        recordIdempotency(
          uid,
          idempotencyKey,
          'FAILED',
          textLength
        );
      }

      res.status(403).json({
        error:
          `رصيد الأحرف غير كافٍ. المتبقي: ${deduction?.balance?.remainingCharacters?.toLocaleString() || '0'} حرف، المطلوب: ${textLength.toLocaleString()} حرف.`,
        balance:
          deduction?.balance,
        code:
          'INSUFFICIENT_CHARACTER_BALANCE',
      });

      return;
    }

    // --------------------------------------------------
    // At this point the characters are reserved.
    // --------------------------------------------------

    const reservedBalance =
      deduction.balance;

    const generationId =
      `gen_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const now =
      new Date().toISOString();

    try {
      // ------------------------------------------------
      // Generate ONLY using this user's Gemini key.
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
      // Generation succeeded.
      //
      // The characters remain deducted.
      // ------------------------------------------------

      const currentBalance =
        reservedBalance;

      const generationRecord = {
        generationId,
        uid,
        text,
        textLength,
        provider:
          'Gemini',
        voice:
          voiceName,
        language,
        speakingRate,
        style,
        status:
          'COMPLETED',
        audioUrl:
          ttsResult.audioUrl,
        usedByok:
          true,
        createdAt:
          now,
      };

      const allGens =
        loadGenerations();

      if (
        !allGens[uid]
      ) {
        allGens[uid] =
          [];
      }

      allGens[uid].unshift(
        generationRecord
      );

      if (
        allGens[uid].length >
        50
      ) {
        allGens[uid] =
          allGens[uid].slice(
            0,
            50
          );
      }

      saveGenerations(
        allGens
      );

      const responsePayload = {
        success:
          true,

        generationId,

        status:
          'COMPLETED',

        audioUrl:
          ttsResult.audioUrl,

        textLength,

        voice:
          voiceName,

        language,

        usedByok:
          true,

        balance:
          currentBalance,

        createdAt:
          now,
      };

      if (
        idempotencyKey
      ) {
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
    } catch (
      ttsErr: any
    ) {
      // ------------------------------------------------
      // Gemini failed.
      //
      // Refund exactly the characters that were
      // reserved for this request.
      // ------------------------------------------------

      try {
        await refundUserBalance(
          uid,
          textLength,
          req.idToken
        );
      } catch (
        refundErr
      ) {
        console.error(
          `[TTS] CRITICAL: Gemini failed and refund failed for UID ${uid}`,
          refundErr
        );
      }

      if (
        idempotencyKey
      ) {
        recordIdempotency(
          uid,
          idempotencyKey,
          'FAILED',
          textLength
        );
      }

      // ------------------------------------------------
      // Save failed generation.
      // ------------------------------------------------

      const failedRecord = {
        generationId,
        uid,
        text,
        textLength,
        provider:
          'Gemini',
        voice:
          voiceName,
        language,
        speakingRate,
        style,
        status:
          'FAILED',
        errorMessage:
          ttsErr?.message ||
          'خطأ في توليد الصوت من Gemini TTS',
        usedByok:
          true,
        createdAt:
          now,
      };

      const allGens =
        loadGenerations();

      if (
        !allGens[uid]
      ) {
        allGens[uid] =
          [];
      }

      allGens[uid].unshift(
        failedRecord
      );

      if (
        allGens[uid].length >
        50
      ) {
        allGens[uid] =
          allGens[uid].slice(
            0,
            50
          );
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

        status:
          'FAILED',

        code:
          'TTS_GENERATION_FAILED',
      });
    }
  }
);

// ----------------------------------------------------
// GET /api/user/balance
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

    res.json(
      balance
    );
  }
);

// ----------------------------------------------------
// GET /api/user/settings
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
      allSettings[uid] ||
      {};

    const maskedKey =
      getUserMaskedApiKey(
        uid
      );

    const effectiveMode =
      maskedKey
        ? 'byok'
        : 'not_connected';

    res.json({
      uid,

      providerMode:
        effectiveMode,

      hasCustomApiKey:
        Boolean(
          maskedKey
        ),

      maskedApiKey:
        maskedKey ||
        '',

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
// POST /api/user/settings
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
      allSettings[uid] ||
      {};

    const maskedKey =
      getUserMaskedApiKey(
        uid
      );

    allSettings[uid] = {
      ...current,

      uid,

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
      success:
        true,

      settings: {
        ...allSettings[uid],

        hasCustomApiKey:
          Boolean(
            maskedKey
          ),

        maskedApiKey:
          maskedKey ||
          '',
      },
    });
  }
);

// ----------------------------------------------------
// POST /api/user/byok-key
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
      (
        req.body.apiKey ||
        ''
      ).trim();

    const testBeforeSave =
      req.body.testBeforeSave !==
      false;

    if (!rawKey) {
      res.status(400).json({
        error:
          'مفتاح Gemini API الخاص بك مطلوب.',
      });

      return;
    }

    if (
      rawKey.length <
      15
    ) {
      res.status(400).json({
        error:
          'صيغة مفتاح Gemini API غير صحيحة.',
      });

      return;
    }

    if (
      testBeforeSave
    ) {
      const testResult =
        await testGeminiApiKey(
          rawKey
        );

      if (
        !testResult.valid
      ) {
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

    const {
      maskedKey,
    } =
      storeUserApiKey(
        uid,
        rawKey
      );

    const allSettings =
      loadSettings();

    allSettings[uid] = {
      ...(allSettings[uid] ||
        {}),

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
      success:
        true,

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
// DELETE /api/user/byok-key
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

    if (
      allSettings[uid]
    ) {
      allSettings[uid] = {
        ...allSettings[uid],

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
      success:
        true,

      message:
        'تم حذف مفتاح Gemini الخاص بك. يجب ربط مفتاح Gemini الخاص بك مرة أخرى قبل إنشاء أي صوت.',
    });
  }
);

// ----------------------------------------------------
// GET /api/user/generations
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

    res.json(
      allGens[uid] ||
        []
    );
  }
);

// ----------------------------------------------------
// DELETE /api/user/generations/:id
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

    if (
      allGens[uid]
    ) {
      allGens[uid] =
        allGens[uid].filter(
          (generation) =>
            generation.generationId !==
            genId
        );

      saveGenerations(
        allGens
      );
    }

    res.json({
      success:
        true,

      deletedId:
        genId,
    });
  }
);

// ----------------------------------------------------
// POST /api/test/isolation
//
// This endpoint now REQUIRES the logged-in user's
// Firebase token.
// ----------------------------------------------------

apiRouter.post(
  '/test/isolation',
  authenticateFirebaseUser,
  async (
    req: AuthenticatedRequest,
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
      // Step 1
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
          'تهيئة المستخدمين الجدد',

        status:
          step1Pass
            ? 'PASSED'
            : 'FAILED',

        details:
          `المستخدم A: ${balanceAInit.remainingCharacters} | المستخدم B: ${balanceBInit.remainingCharacters}`,
      });

      // ------------------------------------------------
      // Step 2
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
          'اختبار عزل الرصيد',

        status:
          step2Pass
            ? 'PASSED'
            : 'FAILED',

        details:
          `A = ${balanceAAfter.remainingCharacters} متبقي | B = ${balanceBAfter.remainingCharacters} متبقي`,
      });

      // ------------------------------------------------
      // Step 3
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
          'اختبار عزل مفاتيح Gemini',

        status:
          keyIsolationPass
            ? 'PASSED'
            : 'FAILED',

        details:
          'كل UID يسترجع مفتاحه فقط.',
      });

      // ------------------------------------------------
      // Step 4
      // ------------------------------------------------

      const allGens =
        loadGenerations();

      allGens[uidA] = [
        {
          generationId:
            `gen_A_${testRunId}`,

          uid:
            uidA,

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
        userBGens.length ===
        0;

      logs.push({
        step:
          'اختبار عزل سجل التوليد',

        status:
          crossAccessPass
            ? 'PASSED'
            : 'FAILED',

        details:
          `المستخدم B لديه ${userBGens.length} سجلات من A.`,
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
          (log) =>
            log.status ===
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
    } catch (
      error: any
    ) {
      res.status(500).json({
        success:
          false,

        error:
          error?.message ||
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
  result: {
    success: boolean;
  }
): boolean {
  return (
    Boolean(result) &&
    result.success ===
      true
  );
}
