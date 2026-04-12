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
/*  Perplexity Agent API                                               */
/* ------------------------------------------------------------------ */

/* Perplexity routes through a single /v1/agent endpoint that accepts
 * any backing model via the `model` field (e.g. "openai/gpt-5.4",
 * "anthropic/claude-4.5-sonnet", "xai/grok-4-1"). The input format is
 * their own — an array of "message" items whose `content` is either a
 * plain string or an array of typed content parts (input_text /
 * input_image). We translate Claude-style messages into that format. */

type ClaudeContentPart =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

type ClaudeMessage = { role: string; content: string | ClaudeContentPart[] };

interface PerplexityInputItem {
  type: "message";
  role: string;
  content: string | Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string }
  >;
}

function claudeToPerplexityInput(messages: ClaudeMessage[]): PerplexityInputItem[] {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { type: "message", role: m.role, content: m.content };
    }
    const parts = m.content.map((p) => {
      if (p.type === "text") return { type: "input_text" as const, text: p.text };
      return {
        type: "input_image" as const,
        image_url: `data:${p.source.media_type};base64,${p.source.data}`,
      };
    });
    return { type: "message", role: m.role, content: parts };
  });
}

function extractPerplexityText(data: unknown): string {
  // Response shape: { output: [ { type: "message", content: [ { type: "output_text", text: "..." } ] } ] }
  // Concatenate every output_text across every message item.
  if (!data || typeof data !== "object") return "";
  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object") {
        const p = part as { type?: string; text?: string };
        if (p.type === "output_text" && typeof p.text === "string") {
          chunks.push(p.text);
        }
      }
    }
  }
  return chunks.join("\n").trim();
}

async function callPerplexity(
  settings: NoteometrySettings,
  system: string,
  messages: ClaudeMessage[],
  temperature = 0,
  maxTokens = 4096
): Promise<AIResult> {
  if (!settings.perplexityApiKey) {
    return { ok: false, text: "", error: "No Perplexity API key — set it in Settings → Noteometry" };
  }

  try {
    const body: Record<string, unknown> = {
      model: settings.perplexityModel || "openai/gpt-5.4",
      instructions: system,
      input: claudeToPerplexityInput(messages),
      max_output_tokens: maxTokens,
      stream: false,
    };
    // Only pass temperature if the caller cared — some routed models
    // (reasoning ones) reject non-default temperature values.
    if (temperature !== 0) body.temperature = temperature;

    const res = await requestUrl({
      url: "https://api.perplexity.ai/v1/agent",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${settings.perplexityApiKey}`,
      },
      body: JSON.stringify(body),
      throw: false,
    });

    if (res.status !== 200) {
      return {
        ok: false,
        text: "",
        error: `Perplexity HTTP ${res.status}: ${res.text.slice(0, 300)}`,
      };
    }

    const text = extractPerplexityText(res.json);
    if (!text) {
      return { ok: false, text: "", error: "Empty response from Perplexity" };
    }
    return { ok: true, text };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, text: "", error: `Perplexity: ${msg}` };
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

const VISION_SYSTEM = `You are a visual content analyzer for a note-taking canvas.

ANALYZE the image and produce the most useful textual representation:

1. If it contains handwritten or printed MATH: output LaTeX wrapped in $$...$$ delimiters. Use proper LaTeX commands (\\int, \\sum, \\sqrt, etc.). Capture EVERY term, coefficient, variable.

2. If it contains a CIRCUIT DIAGRAM: list components with values, describe the topology, identify nodes.

3. If it contains PRINTED TEXT (from a textbook, slide, document): transcribe the text verbatim.

4. If it contains an IMAGE, PHOTO, or DIAGRAM: describe what you see in 1-2 sentences.

5. If it contains MIXED content: handle each part according to its type.

RULES:
- Be literal. Transcribe what you SEE, don't interpret or solve.
- For math: 3 is 3, not \\infty. When ambiguous between numeral and symbol, choose the numeral.
- If truly illegible, write [?].
- NO commentary beyond the transcription/description itself.`;

export async function readInk(
  base64Png: string,
  settings: NoteometrySettings
): Promise<AIResult> {
  const data = base64Png.replace(/^data:image\/\w+;base64,/, "");
  const prompt = "Analyze this image. Output only the transcription or description, no explanation.";

  if (settings.aiProvider === "lmstudio") {
    return callLMStudio(settings, settings.lmStudioVisionModel, VISION_SYSTEM, [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${data}` } },
          { type: "text", text: prompt },
        ],
      },
    ]);
  }

  // Claude-style message shape — both callClaude and callPerplexity
  // consume this. callPerplexity translates it into input_text/input_image.
  const visionMsg = [
    {
      role: "user",
      content: [
        { type: "image" as const, source: { type: "base64" as const, media_type: "image/png", data } },
        { type: "text" as const, text: prompt },
      ],
    },
  ];

  if (settings.aiProvider === "perplexity") {
    return callPerplexity(settings, VISION_SYSTEM, visionMsg);
  }
  return callClaude(settings, VISION_SYSTEM, visionMsg);
}

/* ------------------------------------------------------------------ */
/*  SOLVE — LaTeX problem → DLP v12 step-by-step solution              */
/* ------------------------------------------------------------------ */

// This is the short-form system prompt used by the bare solve() function.
// The authoritative Math v12 / DLP protocol lives in presets.ts under the
// "solve" preset — chat() calls get the full long-form spec via the
// preset's system field, which is what the user actually hits from the
// toolbar. Keep both in sync when you touch the protocol wording.
const DLP_SYSTEM = `You are a strict EE/math problem solver following Math v12 (Deterministic Linear Protocol).

HARD RULES:
- Output LaTeX only — no MathML, no plain-text math.
- Use inline math $...$ only. NEVER display math $$...$$, NEVER center equations.
- All content left-justified. No bullet lists. One blank line between sections.
- Arrow \\rightarrow = algebraic transformation. Equals sign = equality only.
  Example: $7I_1+6(I_1-I_2)=13 \\rightarrow 13I_1-6I_2=13$
- Given / Equations / Where sections: ONE ITEM PER LINE. No horizontal chaining.
- Significant figures must match the least precise given value.
- Only final requested quantities wrapped in \\boxed{}. Nothing after the boxed answers.
- Copy the Problem text verbatim. Do not summarize or paraphrase.

DOCUMENT STRUCTURE (exact order, nothing added, nothing removed):
Problem [number] Week [number]

Problem

Given

Equations

Where

Solution

Answer

Structure is part of the solution. If the structure fails, the solution fails.`;

export async function solve(
  problem: string,
  settings: NoteometrySettings
): Promise<AIResult> {
  const messages = [{ role: "user", content: problem }];

  if (settings.aiProvider === "lmstudio") {
    return callLMStudio(settings, settings.lmStudioTextModel, DLP_SYSTEM, messages);
  }
  if (settings.aiProvider === "perplexity") {
    return callPerplexity(settings, DLP_SYSTEM, messages);
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
  settings: NoteometrySettings,
  systemOverride?: string,
): Promise<AIResult> {
  const systemPrompt = systemOverride ?? CHAT_SYSTEM;
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
      systemPrompt,
      formatted,
      0.3
    );
  }

  // Claude-shaped message format — shared by callClaude and callPerplexity.
  // callPerplexity translates it into Perplexity's input_text/input_image
  // shape at the last moment.
  const formatted = messages.map((m, i) => {
    const isLastUser = m.role === "user" && i === messages.length - 1;
    if (isLastUser && attachments.length) {
      const content: ClaudeContentPart[] = [];
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

  if (settings.aiProvider === "perplexity") {
    return callPerplexity(settings, systemPrompt, formatted, 0.3);
  }
  return callClaude(settings, systemPrompt, formatted, 0.3);
}
