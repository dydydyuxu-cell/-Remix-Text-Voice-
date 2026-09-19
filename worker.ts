interface Env {
  GEMINI_API_KEY: string;
  ASSETS: Fetcher;
}

const MODEL = "gemini-2.5-flash-preview-tts";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // TTS API
    if (url.pathname === "/api/tts" && request.method === "POST") {
      return handleTTS(request, env);
    }

    // Health check
    if (url.pathname === "/api/health") {
      return json({
        success: true,
        service: "Remix Text Voice",
        tts: "ready",
      });
    }

    // Everything else goes to the static Vite site
    return env.ASSETS.fetch(request);
  },
};

async function handleTTS(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    if (!env.GEMINI_API_KEY) {
      return json(
        { error: "GEMINI_API_KEY غير موجود في Cloudflare." },
        500,
      );
    }

    const body = await request.json() as {
      text?: string;
      voice?: string;
      language?: string;
      speakingRate?: number;
      style?: string;
    };

    const text = (body.text || "").trim();

    if (!text) {
      return json(
        { error: "النص المطلوب تحويله فارغ." },
        400,
      );
    }

    if (text.length > 15000) {
      return json(
        {
          error:
            "الحد الأقصى للنص في الطلب الواحد هو 15,000 حرف.",
        },
        400,
      );
    }

    const voice = body.voice || "Puck";
    const language = body.language || "العربية";
    const style = body.style || "طبيعي";

    let speakingRate = Number(body.speakingRate || 1);

    if (!Number.isFinite(speakingRate)) {
      speakingRate = 1;
    }

    speakingRate = Math.max(
      0.5,
      Math.min(2, speakingRate),
    );

    const prompt = `
اقرأ النص التالي باللغة ${language}.

أسلوب الأداء: ${style}.
سرعة الكلام المطلوبة: ${speakingRate}x.
اجعل النطق طبيعيًا وواضحًا، مع الحفاظ على النص كما هو
دون إضافة كلمات أو حذف كلمات.

النص:
${text}
`;

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      }),
    });

    const geminiData = await geminiResponse.json() as any;

    if (!geminiResponse.ok) {
      return json(
        {
          error:
            geminiData?.error?.message ||
            "Gemini TTS رفض الطلب.",
        },
        geminiResponse.status,
      );
    }

    const parts =
      geminiData?.candidates?.[0]?.content?.parts || [];

    let audioBase64 = "";

    for (const part of parts) {
      const data = part?.inlineData?.data;

      if (data) {
        audioBase64 = data;
        break;
      }
    }

    if (!audioBase64) {
      return json(
        {
          error:
            "Gemini لم يرجع ملف صوتي.",
        },
        502,
      );
    }

    const pcm = base64ToBytes(audioBase64);
    const wav = pcmToWav(pcm, 24000, 1, 16);

    const audioUrl =
      `data:audio/wav;base64,${bytesToBase64(wav)}`;

    return json({
      success: true,
      status: "COMPLETED",
      audioUrl,
      audioBase64: bytesToBase64(wav),
      mimeType: "audio/wav",
      textLength: text.length,
      voice,
      language,
      speakingRate,
      style,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Cloudflare TTS error:", error);

    return json(
      {
        error:
          error?.message ||
          "حدث خطأ أثناء توليد الصوت.",
      },
      500,
    );
  }
}

function json(
  data: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, Idempotency-Key",
        "Access-Control-Allow-Methods":
          "GET, POST, OPTIONS",
      },
    },
  );
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(
      i,
      Math.min(i + chunkSize, bytes.length),
    );

    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function pcmToWav(
  pcm: Uint8Array,
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
): Uint8Array {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, "data");
  view.setUint32(40, pcm.length, true);

  new Uint8Array(buffer, 44).set(pcm);

  return new Uint8Array(buffer);
}

function writeString(
  view: DataView,
  offset: number,
  value: string,
): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(
      offset + i,
      value.charCodeAt(i),
    );
  }
}
