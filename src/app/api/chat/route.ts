import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("Missing Environment Variable: GOOGLE_API_KEY");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body.prompt;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    return NextResponse.json({ response: responseText });

  } catch (error) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json({ error: "Failed to get response from Google Gemini." }, { status: 500 });
  }
}