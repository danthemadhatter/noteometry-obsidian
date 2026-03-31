const GEMINI_MODEL = "gemini-3.1-pro-preview";

export async function readInkFromImage(base64Image: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Convert this handwritten math equation to clean LaTeX code. Return ONLY the LaTeX, no explanations." },
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Image
              }
            }
          ]
        }]
      })
    }
  );

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Error reading ink";
}

export async function solveWithDLP(latex: string, apiKey: string): Promise<string> {
  // DLP v12 stub – replace with your real solver logic later
  console.log("DLP v12 would solve:", latex);
  return "Step-by-step solution from DLP v12 would appear here";
}
