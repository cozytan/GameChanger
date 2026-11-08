import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize Google Gen AI client using your server-side environment variable
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { message, role } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Call the Gemini model securely from the server backend
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: `You are GameBot, an AI assistant for HR-GameChanger tailored for the user's role as ${role || 'Member'}. Provide concise, professional help regarding HR Calabarzon sessions, attendance, and career paths.`
      }
    });

    return NextResponse.json({ reply: response.text });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chatbot request via Gemini API' },
      { status: 500 }
    );
  }
}