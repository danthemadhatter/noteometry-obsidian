export type AIProvider = "claude" | "lmstudio" | "perplexity";

export interface NoteometrySettings {
  aiProvider: AIProvider;
  claudeApiKey: string;
  claudeModel: string;
  perplexityApiKey: string;
  perplexityModel: string;
  lmStudioUrl: string;
  lmStudioTextModel: string;
  lmStudioVisionModel: string;
  vaultFolder: string;
  autoSave: boolean;
  autoSaveDelay: number;
  /** Draw with a single finger on touch devices. Off by default so iPad
   * with Apple Pencil still gets palm rejection via touch-to-pan. Turn
   * on for Android / finger-only devices. Two-finger gestures always
   * pan/pinch regardless. */
  fingerDrawing: boolean;
  /** v1.11.0: false until the user has completed the first-run gesture
   * cheatsheet onboarding. Settings → "Reset gesture tutorial" flips
   * this back to false so the user can re-trigger the modal during a
   * day-30 re-learning episode (per design doc §6b: gesture recall +
   * object-permanence crash mitigation). */
  gestureTutorialSeen: boolean;
}

export const DEFAULT_SETTINGS: NoteometrySettings = {
  aiProvider: "perplexity",
  claudeApiKey: "",
  claudeModel: "claude-opus-4-6",
  perplexityApiKey: "",
  perplexityModel: "openai/gpt-5.4",
  lmStudioUrl: "http://localhost:1234",
  lmStudioTextModel: "qwen3-235b",
  lmStudioVisionModel: "qwen2-vl-72b",
  vaultFolder: "Noteometry",
  autoSave: true,
  autoSaveDelay: 2000,
  fingerDrawing: false,
  gestureTutorialSeen: false,
};

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string;
}
