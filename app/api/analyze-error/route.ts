import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to .env.local to enable AI error analysis." },
      { status: 500 }
    );
  }

  let body: {
    sql?: string;
    error?: string;
    errorPosition?: number;
    errorDetail?: string;
    errorHint?: string;
    schemaContext?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sql, error, errorPosition, errorDetail, errorHint, schemaContext } = body;

  if (!sql || !error) {
    return NextResponse.json({ error: "Missing sql or error" }, { status: 400 });
  }

  // Build context for the AI
  const parts: string[] = [
    `SQL Query:\n\`\`\`sql\n${sql}\n\`\`\``,
    `\nError Message: ${error}`,
  ];

  if (errorPosition) {
    parts.push(`Error Position: character ${errorPosition}`);
  }
  if (errorDetail) {
    parts.push(`Error Detail: ${errorDetail}`);
  }
  if (errorHint) {
    parts.push(`PostgreSQL Hint: ${errorHint}`);
  }
  if (schemaContext) {
    parts.push(`\nAvailable Schema:\n${schemaContext}`);
  }

  const userMessage = parts.join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: `You are a PostgreSQL expert assistant embedded in a SQL IDE. Your job is to analyze SQL errors and provide clear, actionable suggestions to fix them.

Rules:
- Be concise and direct. No pleasantries.
- First explain what went wrong in 1-2 sentences.
- Then provide the corrected SQL if possible.
- If you can't determine the exact fix, suggest the most likely solutions.
- Use the available schema context (if provided) to suggest correct table/column names.
- Format your response as JSON with this structure:
  {
    "explanation": "Brief explanation of the error",
    "suggestion": "What the user should do to fix it",
    "fixedSql": "The corrected SQL query (or null if you can't determine the fix)"
  }
- ONLY return the JSON object, nothing else.`,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return NextResponse.json(
        { error: `AI API error (${response.status})` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      return NextResponse.json(
        { error: "Empty response from AI" },
        { status: 502 }
      );
    }

    // Parse the JSON response from Claude (strip markdown fences if present)
    try {
      const jsonStr = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const analysis = JSON.parse(jsonStr);
      return NextResponse.json({
        explanation: analysis.explanation || "",
        suggestion: analysis.suggestion || "",
        fixedSql: analysis.fixedSql || null,
      });
    } catch {
      // If Claude didn't return valid JSON, use the raw text as the suggestion
      return NextResponse.json({
        explanation: content,
        suggestion: "",
        fixedSql: null,
      });
    }
  } catch (err) {
    console.error("Error calling Anthropic API:", err);
    return NextResponse.json(
      { error: "Failed to reach AI service" },
      { status: 502 }
    );
  }
}
