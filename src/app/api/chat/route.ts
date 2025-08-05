// File: src/api/chat/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

// This is a safety check to ensure the API key exists.
if (!process.env.GOOGLE_API_KEY) {
  throw new Error("Missing Environment Variable: GOOGLE_API_KEY");
}

// Initialize the Google Gemini client with the API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// This function handles POST requests to http://localhost:3000/api/chat
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // The 'prompt' field is expected in the request body
    const prompt = body.prompt;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    // Get the generative model, 'gemini-1.5-flash' is a fast and versatile model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // The core call to the Google Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    return NextResponse.json({ response: responseText });

  } catch (error) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json({ error: "Failed to get response from Google Gemini." }, { status: 500 });
  }
}