import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

// Ultra-low-latency models ideal for real-time conversational voice responses
const CANDIDATE_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const genAI = getGenAIClient();
    if (!genAI) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY or GOOGLE_API_KEY in environment variables." },
        { status: 500 }
      );
    }

    let lastError: Error | null = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction:
            "You are a helpful, conversational voice assistant. Keep all responses brief, natural, and under 2 sentences so they are pleasant to listen to when spoken aloud.",
        });

        const result = await model.generateContent(prompt.trim());
        const response = await result.response;
        const responseText = response.text();

        return NextResponse.json({
          response: responseText,
          model: modelName,
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
