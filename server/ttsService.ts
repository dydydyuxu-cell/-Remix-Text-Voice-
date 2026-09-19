/**
 * Server-side Gemini TTS Integration
 * Directly calls official Gemini TTS models with chosen voice, tone, and language.
 * Converts raw PCM audio output to standard playable WAV format.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

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
 * Converts 24kHz 16-bit Mono PCM buffer to a valid WAV file Buffer.
 */
export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);

  // 'fmt ' sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  header.writeUInt16LE(1, 20); // audio format (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // 'data' sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Tests whether a given Gemini API key is valid by making a lightweight request.
 */
export async function testGeminiApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!apiKey || apiKey.trim().length < 10) {
      return { valid: false, error: 'مفتاح API غير صالح أو فارغ' };
    }
    const ai = new GoogleGenerativeAI(apiKey.trim());
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const testRes = await model.generateContent('Test connection');
    if (testRes && testRes.response) {
      return { valid: true };
    }
    return { valid: false, error: 'لم يتم استلام رد من النموذج' };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('API_KEY_INVALID') || msg.includes('400') || msg.includes('403')) {
      return { valid: false, error: 'مفتاح API غير صالح أو لا يملك الأذونات اللازمة.' };
    }
    return { valid: false, error: msg };
  }
}

/**
 * Synthesizes text to speech using Gemini TTS model.
 */
export async function generateGeminiTTS(
  apiKey: string,
  options: TTSOptions
): Promise<TTSResult> {
  if (!apiKey) {
    throw new Error('No API key provided for TTS synthesis');
  }

  const ai = new GoogleGenerativeAI(apiKey);

  const voice = options.voiceName || 'Puck';
  const language = options.language || 'العربية';
  const style = options.style || 'طبيعي';
  const rate = options.speakingRate || 1.0;

  let promptText = options.text.trim();
  
  const styleInstructions: Record<string, string> = {
    'طبيعي': 'natural and balanced tone',
    'سردي وقصصي': 'expressive narrative storytelling tone with immersive pacing',
    'إخباري ورسمي': 'authoritative, clear, and formal broadcast tone',
    'بودكاست وحواري': 'warm, engaging, and conversational podcast tone',
    'تحفيزي وإعلاني': 'energetic, inspiring, and commercial broadcast tone',
  };

  const selectedInstruction = styleInstructions[style] || 'clear, natural tone';
  const rateDesc = rate > 1.1 ? 'at a brisk pace' : rate < 0.9 ? 'at a measured, deliberate pace' : 'at standard pace';

  const systemPrompt = `You are a professional Text-to-Speech synthesis system.
Read the user text aloud exactly as provided without adding commentary, prefixes, or concluding words.
Target language: ${language}.
Delivery style: ${selectedInstruction}, ${rateDesc}.

User Text:
${promptText}`;

  const modelsToTry = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const model = ai.getGenerativeModel({ model: modelName });
      const response = await model.generateContent(systemPrompt);
      const result = await response.response;

      const candidates = result.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            const rawMime = part.inlineData.mimeType || '';
            const rawBase64 = part.inlineData.data;
            const rawBuffer = Buffer.from(rawBase64, 'base64');

            let wavBuffer: Buffer;
            let sampleRate = 24000;
            if (rawMime.includes('rate=')) {
              const match = rawMime.match(/rate=(\d+)/);
              if (match) sampleRate = parseInt(match[1], 10);
            }

            if (rawMime.includes('pcm') || rawMime.includes('L16') || rawMime.includes('l16')) {
              wavBuffer = pcmToWav(rawBuffer, sampleRate, 1, 16);
            } else if (rawBuffer.slice(0, 4).toString() === 'RIFF') {
              wavBuffer = rawBuffer;
            } else {
              wavBuffer = pcmToWav(rawBuffer, sampleRate, 1, 16);
            }

            const wavBase64 = wavBuffer.toString('base64');
            const audioUrl = `data:audio/wav;base64,${wavBase64}`;
            const durationEstimate = Math.max(1, Math.round(promptText.length / 15));

            return {
              audioBase64: wavBase64,
              mimeType: 'audio/wav',
              audioUrl,
              durationEstimateSeconds: durationEstimate,
            };
          }
        }
      }

      throw new Error(`Model ${modelName} returned response without audio inlineData`);
    } catch (err: any) {
      lastError = err;
      console.warn(`TTS attempt with model ${modelName} failed:`, err?.message || err);
      continue;
    }
  }

  throw new Error(`Failed to synthesize speech with Gemini TTS: ${lastError?.message || 'Unknown error'}`);
}
