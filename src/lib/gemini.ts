import type { ChatMessage, Attachment } from "../types";

export interface GeminiResult {
  ok: boolean;
  text: string;
  error?: string;
}

function apiUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

async function callGeminiRaw(
  apiKey: string,
  model: string,
  body: Record<string, unknown>
): Promise<GeminiResult> {
  if (!apiKey) {
    return { ok: false, text: "", error: "No API key — set it in Settings → Noteometry" };
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(model, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, text: "", error: msg };
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const t = await response.text();
      detail += `: ${t.slice(0, 200)}`;
    } catch { /* ignore */ }
    return { ok: false, text: "", error: detail };
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    return { ok: false, text: "", error: "Invalid JSON from Gemini" };
  }

  const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
  const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
  const resParts = content?.parts as Array<Record<string, unknown>> | undefined;
  const text = resParts?.[0]?.text as string | undefined;

  if (!text) {
    return { ok: false, text: "", error: "Empty response from Gemini" };
  }
  return { ok: true, text: text.trim() };
}

/* ------------------------------------------------------------------ */
/*  READ INK — canvas image → LaTeX                                   */
/* ------------------------------------------------------------------ */

const VISION_SYSTEM_PROMPT = `You are a strict math and electrical engineering OCR engine.
Your only job is to look at the provided image of handwritten equations and convert it to clean LaTeX.
Return ONLY the raw LaTeX string. No explanation. No markdown code blocks. No preamble. Just LaTeX.`;

export async function readInk(
  base64Png: string,
  apiKey: string,
  model: string
): Promise<GeminiResult> {
  // Strip dataURL prefix if present
  const data = base64Png.replace(/^data:image\/\w+;base64,/, "");
  return callGeminiRaw(apiKey, model, {
    system_instruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [
      { inline_data: { mime_type: "image/png", data } },
      { text: "Extract the math from this image into LaTeX." },
    ] }],
    generationConfig: { temperature: 0 },
  });
}

/* ------------------------------------------------------------------ */
/*  SOLVE — LaTeX problem → DLP v12 step-by-step solution             */
/* ------------------------------------------------------------------ */

const DLP_SYSTEM_PROMPT = `You are an electrical engineering homework solver. Follow the Deterministic Linear Protocol v12 exactly.

GLOBAL RULES:
- All content left-justified
- Equations inline with text using $...$. Never use display block $$...$$
- Arrow = algebraic transformation. Equals sign = equality only.
- Simplification uses rightarrow: $7I_1+6(I_1-I_2)=13 \\rightarrow 13I_1-6I_2=13$
- Only final requested quantities wrapped in \\boxed{}
- Significant figures must match the least precise given value

DOCUMENT STRUCTURE (exact order, no additions, no removals):
Problem
Given
Equations
Where
Solution
Answer`;

export async function solve(
  problem: string,
  apiKey: string,
  model: string
): Promise<GeminiResult> {
  return callGeminiRaw(apiKey, model, {
    system_instruction: { parts: [{ text: DLP_SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: problem }] }],
    generationConfig: { temperature: 0 },
  });
}

/* ------------------------------------------------------------------ */
/*  CHAT — multi-turn conversation with attachments                   */
/* ------------------------------------------------------------------ */

const CHAT_SYSTEM = `You are Noteometry AI — an expert mathematics and electrical engineering assistant.
FORMAT RULES:
- Never use markdown (no **, no *, no #, no dashes).
- Use $...$ for inline math, $$...$$ for display math.
- Plain left-justified text only.
- Be direct and precise.
- When solving, use DLP format: Problem, Given, Equations, Where, Solution, Answer (boxed).`;

export async function chat(
  messages: ChatMessage[],
  attachments: Attachment[],
  apiKey: string,
  model: string
): Promise<GeminiResult> {
  const contents = messages.map((m, i) => {
    const isLastUser = m.role === "user" && i === messages.length - 1;
    const parts: Record<string, unknown>[] = [];
    if (isLastUser && attachments.length) {
      for (const att of attachments) {
        const data = att.data.replace(/^data:[^;]+;base64,/, "");
        parts.push({ inline_data: { mime_type: att.mimeType, data } });
      }
    }
    if (m.text?.trim()) parts.push({ text: m.text.trim() });
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });

  return callGeminiRaw(apiKey, model, {
    system_instruction: { parts: [{ text: CHAT_SYSTEM }] },
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
  });
}
