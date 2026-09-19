/**
 * Server-side Gemini TTS Integration
 * Uses Google's Gemini TTS models and converts raw PCM audio to WAV.
 */

import { GoogleGenAI } from '@google/genai';

export interface TTSOptions {
  text: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede' | string;
  language?: string;
  speakingRate?: number;
  style?: string;
}

export interface TTSResult {
  audioBase64: string;
  mimeType: string;
  audioUrl: string;
  durationEstimateSeconds: number;
}

/**
 * Converts raw PCM audio to a standard WAV file.
 */
export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate =
    (sampleRate * numChannels * bitsPerSample) / 8;

  const blockAlign =
    (numChannels * bitsPerSample) / 8;

  const dataSize = pcmBuffer.length;

  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);

  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Tests whether the Gemini API key works.
 */
export async function testGeminiApiKey(
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!apiKey || apiKey.trim().length < 10) {
      return {
        valid: false,
        error: 'مفتاح API غير صالح أو فارغ'
      };
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey.trim()
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: 'Test connection',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Puck'
            }
          }
        }
      }
    });

    if (
      response.candidates &&
      response.candidates.length > 0
    ) {
      return { valid: true };
    }

    return {
      valid: false,
      error: 'لم يتم استلام رد من Gemini'
    };
  } catch (err: any) {
    const message =
      err?.message || String(err);

    if (
      message.includes('API_KEY_INVALID') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      return {
        valid: false,
        error:
          'مفتاح API غير صالح أو لا يملك الأذونات اللازمة.'
      };
    }

    return {
      valid: false,
      error: message
    };
  }
}

/**
 * Generates speech using Gemini TTS.
 */
export async function generateGeminiTTS(
  apiKey: string,
  options: TTSOptions
): Promise<TTSResult> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'No API key provided for TTS synthesis'
    );
  }

  const text = options.text?.trim();

  if (!text) {
    throw new Error(
      'No text provided for TTS synthesis'
    );
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey.trim()
  });

  const voice = options.voiceName || 'Puck';
  const language = options.language || 'Arabic';
  const style = options.style || 'طبيعي';
  const rate = options.speakingRate ?? 1.0;

  const styleInstructions: Record<string, string> = {
    'طبيعي':
      'natural, clear and balanced tone',

    'سردي وقصصي':
      'expressive storytelling tone with immersive pacing',

    'إخباري ورسمي':
      'clear, authoritative and formal broadcast tone',

    'بودكاست وحواري':
      'warm, friendly and conversational podcast tone',

    'تحفيزي وإعلاني':
      'energetic, enthusiastic and engaging commercial tone'
  };

  const selectedStyle =
    styleInstructions[style] ||
    'clear and natural tone';

  const rateInstruction =
    rate > 1.1
      ? 'Speak at a brisk pace.'
      : rate < 0.9
        ? 'Speak at a slower, measured pace.'
        : 'Speak at a natural standard pace.';

  const prompt = `
Read the following text aloud exactly as written.

Do not add any introduction.
Do not add any explanation.
Do not add any conclusion.
Do not change the words.

Target language: ${language}.
Speaking style: ${selectedStyle}.
${rateInstruction}

Text:
${text}
`;

  try {
    const response =
      await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',

        contents: prompt,

        config: {
          responseModalities: ['AUDIO'],

          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice
              }
            }
          }
        }
      });

    const parts =
      response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      const inlineData = part.inlineData;

      if (!inlineData?.data) {
        continue;
      }

      const rawBase64 = inlineData.data;

      const rawMime =
        inlineData.mimeType ||
        'audio/pcm;rate=24000';

      const rawBuffer =
        Buffer.from(rawBase64, 'base64');

      let sampleRate = 24000;

      const rateMatch =
        rawMime.match(/rate=(\d+)/);

      if (rateMatch) {
        sampleRate =
          parseInt(rateMatch[1], 10);
      }

      let wavBuffer: Buffer;

      const mimeLower =
        rawMime.toLowerCase();

      if (
        mimeLower.includes('pcm') ||
        mimeLower.includes('l16')
      ) {
        wavBuffer = pcmToWav(
          rawBuffer,
          sampleRate,
          1,
          16
        );
      } else if (
        rawBuffer
          .slice(0, 4)
          .toString() === 'RIFF'
      ) {
        wavBuffer = rawBuffer;
      } else {
        wavBuffer = pcmToWav(
          rawBuffer,
          sampleRate,
          1,
          16
        );
      }

      const wavBase64 =
        wavBuffer.toString('base64');

      const audioUrl =
        `data:audio/wav;base64,${wavBase64}`;

      const durationEstimateSeconds =
        Math.max(
          1,
          Math.round(text.length / 15)
        );

      return {
        audioBase64: wavBase64,
        mimeType: 'audio/wav',
        audioUrl,
        durationEstimateSeconds
      };
    }

    throw new Error(
      'Gemini TTS returned no audio data'
    );
  } catch (err: any) {
    const message =
      err?.message || String(err);

    console.error(
      'Gemini TTS error:',
      message
    );

    throw new Error(
      `Gemini TTS failed: ${message}`
    );
  }
}
