import { NextResponse } from "next/server";
import { evaluate } from "mathjs";

export async function POST(req) {
  const { message } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API key not set." }, { status: 500 });
  }

  // --- Calculation Intercept ---
  // Regex to check if message is a pure calculation (numbers, operators, parens, decimals, spaces)
  const calcPattern = /^[0-9+\-*/().%^\s]+$/;
  if (calcPattern.test(message.trim())) {
    try {
      // Evaluate and return result
      const result = evaluate(message);
      return NextResponse.json({ answer: `Result: ${result}` });
    } catch (err) {
      return NextResponse.json({ answer: "Sorry, I couldn't compute that expression." });
    }
  }
  // --- End Calculation Intercept ---

  // Prepare payload for Gemini API
  const prompt = `You are FinanceBot, an expert in finance and financial calculations. Only answer questions related to finance, money, investments, interest, budgeting, and financial math. If a question is not related to finance or calculations, politely refuse.\n\nUser question: ${message}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 800
    }
  };

  try {
    // Use the Gemini API endpoint and format
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const text = await geminiRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      return NextResponse.json({ error: `Gemini API returned non-JSON: ${text}` }, { status: 500 });
    }

    if (!geminiRes.ok) {
      return NextResponse.json({ error: data.error?.message || text }, { status: 500 });
    }
    
    // Extract the response text from Gemini API response format
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      return NextResponse.json({ error: "Invalid response from Gemini API" }, { status: 500 });
    }
    
    // Get text from all parts that have text
    const responseText = data.candidates[0].content.parts
      .filter(part => part.text)
      .map(part => part.text)
      .join("\n");
      
    return NextResponse.json({ answer: responseText });
  } catch (err) {
    return NextResponse.json({ error: "Failed to contact Gemini API: " + err.message }, { status: 500 });
  }
}
