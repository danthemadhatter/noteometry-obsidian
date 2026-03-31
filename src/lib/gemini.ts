export interface GeminiResult {
  ok: boolean;
  text: string;
  error?: string;
}

function apiUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

async function callGemini(
  apiKey: string,
  model: string,
  parts: Record<string, unknown>[]
): Promise<GeminiResult> {
  if (!apiKey) {
    return { ok: false, text: "", error: "No API key — set it in Settings → Noteometry" };
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(model, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, text: "", error: msg };
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.text();
      detail += `: ${body.slice(0, 200)}`;
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

const READ_INK_PROMPT = `You are a handwriting recognition engine for STEM content.
Convert the handwritten content in this image to clean LaTeX.

Rules:
- Return ONLY the LaTeX code, no markdown fences, no explanations
- Use standard LaTeX math notation
- Wrap all math in $ (inline) or $$ (display) delimiters
- If you see circuit diagrams, describe topology as structured text
- If you see plain text mixed with math, return both`;

export async function readInk(
  base64Png: string,
  apiKey: string,
  model: string
): Promise<GeminiResult> {
  return callGemini(apiKey, model, [
    { text: READ_INK_PROMPT },
    { inlineData: { mimeType: "image/png", data: base64Png } },
  ]);
}

/* ------------------------------------------------------------------ */
/*  SOLVE — LaTeX problem → DLP v12 step-by-step solution             */
/* ------------------------------------------------------------------ */

const DLP_SYSTEM = `You are a deterministic STEM problem solver using the Deterministic Linear Protocol (DLP v12).

Output these exact sections in order:

**Problem**
(Restate the problem clearly)

**Given**
(List every known value with units, one per line)

**Equations**
(List every equation you will use)

**Where**
(Define every variable)

**Solution**
(Step-by-step algebra. Use → for transformations: 2x = 10 → x = 5)
(Show intermediate numeric results with units)
(NO bold text in the solution body)

**Answer**
(Final result using \\boxed{} — box ONLY the final answer(s))

Rules:
- Left-justify everything
- Inline LaTeX with $ delimiters for math
- Use → (arrow) between algebraic steps
- Show all units throughout
- Be precise with significant figures
- If multiple unknowns, box each one separately`;

export async function solve(
  problem: string,
  apiKey: string,
  model: string
): Promise<GeminiResult> {
  return callGemini(apiKey, model, [
    { text: `${DLP_SYSTEM}\n\n---\n\nSolve this:\n\n${problem}` },
  ]);
}
