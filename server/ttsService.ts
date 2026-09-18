/**
 * Server-side Gemini TTS Integration
 * Directly calls official Gemini TTS models with chosen voice, tone, and language.
 * Converts raw PCM audio output to standard playable WAV format.
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
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    // Quick test with countTokens or lightweight model
    const testRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: 'Test connection',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Puck',
            },
          },
        },
      },
    });
    if (testRes.candidates && testRes.candidates.length > 0) {
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

  const ai = new GoogleGenAI({ apiKey });

  const voice = options.voiceName || 'Puck';
  const language = options.language || 'العربية';
  const style = options.style || 'طبيعي';
  const rate = options.speakingRate || 1.0;

  // Construct a directive that guides speech delivery while keeping the exact words intact
  let promptText = options.text.trim();
  
  // Style and pacing prompt instruction
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

  // Use primary TTS model with fallback
  const modelsToTry = [
    'gemini-2.5-flash-preview-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-pro-preview-tts',
  ];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: systemPrompt,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const rawMime = part.inlineData.mimeType || '';
          const rawBase64 = part.inlineData.data;
          const rawBuffer = Buffer.from(rawBase64, 'base64');

          let wavBuffer: Buffer;
          // Determine sample rate from mimeType (e.g. rate=24000)
          let sampleRate = 24000;
          if (rawMime.includes('rate=')) {
            const match = rawMime.match(/rate=(\d+)/);
            if (match) sampleRate = parseInt(match[1], 10);
          }

          if (rawMime.includes('pcm') || rawMime.includes('L16') || rawMime.includes('l16')) {
            wavBuffer = pcmToWav(rawBuffer, sampleRate, 1, 16);
          } else if (rawBuffer.slice(0, 4).toString() === 'RIFF') {
            // Already WAV
            wavBuffer = rawBuffer;
          } else {
            // Default wrap as 24kHz PCM WAV
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

      throw new Error(`Model ${modelName} returned response without audio inlineData`);
    } catch (err: any) {
      lastError = err;
      console.warn(`TTS attempt with model ${modelName} failed:`, err?.message || err);
      // If error is 404 or model unavailable, try next model in list
      continue;
    }
  }

  throw new Error(`Failed to synthesize speech with Gemini TTS: ${lastError?.message || 'Unknown error'}`);
}
