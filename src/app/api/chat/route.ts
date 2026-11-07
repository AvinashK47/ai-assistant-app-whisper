import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}

// Convert raw 16-bit PCM (Little Endian) to standard WAV format
function pcmToWav(pcmBase64: string, sampleRate = 24000): string {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF Chunk Descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);

  // "fmt " sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // "data" sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const wavBuffer = Buffer.concat([header, pcmBuffer]);
  return `data:audio/wav;base64,${wavBuffer.toString('base64')}`;
}

const TTS_MODELS = [
  "gemini-3.8-flash-lite-tts",
  "gemini-3.8-flash-tts",
  "gemini-2.5-flash-preview-tts",
];

async function synthesizeSpeech(
  text: string,
  apiKey: string,
  voiceName: string = "Aoede"
): Promise<string | null> {
  // Strip markdown symbols, asterisks, brackets so speech sounds natural
  const cleanedText = text
    .replace(/[*_#`~[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanedText) return null;

  for (const modelName of TTS_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: cleanedText }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName,
                },
              },
            },
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`TTS model ${modelName} returned status: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData?.data) {
        continue;
      }

      const base64Data = inlineData.data;
      const mimeType = inlineData.mimeType || 'audio/wav';

      // Check if it already has RIFF magic bytes
      const testBuffer = Buffer.from(base64Data.slice(0, 8), 'base64');
      if (testBuffer.toString('utf-8', 0, 4) === 'RIFF') {
        return `data:${mimeType};base64,${base64Data}`;
      }

      // Otherwise convert raw PCM to WAV
      return pcmToWav(base64Data, 24000);
    } catch (err) {
      console.warn(`TTS synthesis attempt with ${modelName} failed:`, err);
    }
  }

  return null;
}

// Low-latency LLM candidate models for generation
const CANDIDATE_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body.prompt;
    const voiceName = body.voice || "Aoede";

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY or GOOGLE_API_KEY in environment variables." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError: Error | null = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction:
            "You are a helpful, conversational AI voice assistant. Keep all responses direct, pleasant, conversational, and under 2 sentences (strictly maximum 30 words) so they are fast and crisp to hear spoken aloud. Never use markdown asterisks or bullet lists.",
        });

        const result = await model.generateContent(prompt.trim());
        const response = await result.response;
        const responseText = response.text().trim();

        // Synthesize neural voice with Gemini 3.8 Flash TTS
        const audioDataUrl = await synthesizeSpeech(responseText, apiKey, voiceName);

        return NextResponse.json({
          response: responseText,
          audio: audioDataUrl,
          model: modelName,
          voice: voiceName,
        });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`Model ${modelName} failed, trying next candidate...`, lastError.message);
      }
    }

    return NextResponse.json(
      { error: lastError?.message || "Failed to generate content with available Gemini models." },
      { status: 500 }
    );
  } catch (error: unknown) {
    console.error("Error in /api/chat:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to get response from Gemini.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
