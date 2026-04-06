import { requestUrl } from "obsidian";
import type { NoteometrySettings, ChatMessage, Attachment } from "../types";

export interface AIResult {
  ok: boolean;
  text: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Anthropic Claude API                                               */
/* ------------------------------------------------------------------ */

async function callClaude(
  settings: NoteometrySettings,
  system: string,
  messages: Array<{ role: string; content: unknown }>,
  temperature = 0,
  maxTokens = 4096
): Promise<AIResult> {
  if (!settings.claudeApiKey) {
    return { ok: false, text: "", error: "No Claude API key — set it in Settings → Noteometry" };
  }

  try {
    const res = await requestUrl({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": settings.claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: settings.claudeModel,
        max_tokens: maxTokens,
        system,
        messages,
        temperature,
      }),
    });

    if (res.status !== 200) {
      return { ok: false, text: "", error: `Claude HTTP ${res.status}: ${res.text.slice(0, 200)}` };
    }

    const data = res.json;
    const text = data?.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      return { ok: false, text: "", error: "Empty response from Claude" };
    }
    return { ok: true, text };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, text: "", error: msg };
  }
}

/* ------------------------------------------------------------------ */
/*  LM Studio (OpenAI-compatible)                                      */
/* ------------------------------------------------------------------ */

async function callLMStudio(
  settings: NoteometrySettings,
  model: string,
  system: string,
  messages: Array<{ role: string; content: unknown }>,
  temperature = 0
): Promise<AIResult> {
  const url = settings.lmStudioUrl.replace(/\/$/, "");

  try {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
      temperature,
      max_tokens: 4096,
    };

    const res = await requestUrl({
      url: `${url}/v1/chat/completions`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status !== 200) {
      return { ok: false, text: "", error: `LM Studio HTTP ${res.status}: ${res.text.slice(0, 200)}` };
    }

    const data = res.json;
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, text: "", error: "Empty response from LM Studio" };
    }
    return { ok: true, text };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, text: "", error: `LM Studio: ${msg}` };
  }
}

/* ------------------------------------------------------------------ */
/*  READ INK — canvas image → LaTeX                                    */
/* ------------------------------------------------------------------ */

const VISION_SYSTEM = `You are a strict math and electrical engineering OCR engine.
Your only job is to look at the provided image of handwritten equations and convert it to clean LaTeX.
Return ONLY the raw LaTeX string. No explanation. No markdown code blocks. No preamble. Just LaTeX.`;

export async function readInk(
  base64Png: string,
  settings: NoteometrySettings
): Promise<AIResult> {
  const data = base64Png.replace(/^data:image\/\w+;base64,/, "");

  if (settings.aiProvider === "lmstudio") {
    return callLMStudio(settings, settings.lmStudioVisionModel, VISION_SYSTEM, [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${data}` } },
          { type: "text", text: "Extract the math from this image into LaTeX." },
        ],
      },
    ]);
  }

  // Claude
  return callClaude(settings, VISION_SYSTEM, [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data } },
        { type: "text", text: "Extract the math from this image into LaTeX." },
      ],
    },
  ]);
}

/* ------------------------------------------------------------------ */
/*  SOLVE — LaTeX problem → DLP v12 step-by-step solution              */
/* ------------------------------------------------------------------ */

const DLP_SYSTEM = `You are an electrical engineering homework solver. Follow the Deterministic Linear Protocol v12 exactly.

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
  settings: NoteometrySettings
): Promise<AIResult> {
  const messages = [{ role: "user", content: problem }];

  if (settings.aiProvider === "lmstudio") {
    return callLMStudio(settings, settings.lmStudioTextModel, DLP_SYSTEM, messages);
  }
  return callClaude(settings, DLP_SYSTEM, messages);
}

/* ------------------------------------------------------------------ */
/*  CHAT — multi-turn conversation with attachments                    */
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
  settings: NoteometrySettings
): Promise<AIResult> {
  if (settings.aiProvider === "lmstudio") {
    // Build OpenAI-format messages
    const formatted = messages.map((m, i) => {
      const isLastUser = m.role === "user" && i === messages.length - 1;
      if (isLastUser && attachments.length) {
        const content: unknown[] = [];
        for (const att of attachments) {
          const d = att.data.replace(/^data:[^;]+;base64,/, "");
          content.push({
            type: "image_url",
            image_url: { url: `data:${att.mimeType};base64,${d}` },
          });
        }
        if (m.text?.trim()) content.push({ type: "text", text: m.text.trim() });
        return { role: m.role, content };
      }
      return { role: m.role, content: m.text ?? "" };
    });

    return callLMStudio(
      settings,
      attachments.length ? settings.lmStudioVisionModel : settings.lmStudioTextModel,
      CHAT_SYSTEM,
      formatted,
      0.3
    );
  }

  // Claude format
  const formatted = messages.map((m, i) => {
    const isLastUser = m.role === "user" && i === messages.length - 1;
    if (isLastUser && attachments.length) {
      const content: unknown[] = [];
      for (const att of attachments) {
        const d = att.data.replace(/^data:[^;]+;base64,/, "");
        content.push({
          type: "image",
          source: { type: "base64", media_type: att.mimeType, data: d },
        });
      }
      if (m.text?.trim()) content.push({ type: "text", text: m.text.trim() });
      return { role: m.role, content };
    }
    return { role: m.role, content: m.text ?? "" };
  });

  return callClaude(settings, CHAT_SYSTEM, formatted, 0.3);
}
