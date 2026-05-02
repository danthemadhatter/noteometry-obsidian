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
  /** When on, the right-click hub also lists experimental / legacy drop-ins
   * (Animation Canvas, Study Gantt, Multimeter). Off by default — those
   * tools were sources of confusion in manual testing: users didn't know
   * what they did or how they fit. Keep them shippable but out of the way
   * until either their purpose is reworked or the user opts in. */
  showExperimentalTools: boolean;
  /** v1.8.5 — "Combat Mode." When on, the v1.8.x Death-Stranding chrome
   * intensifies: glows ramp from --ds-glow-cyan to --ds-glow-cyan-strong,
   * the active-row scanline animates faster + brighter, course bands
   * saturate, and the AI overlay flashes its corner brackets harder.
   * Default off so the baseline skin reads as a serious tool; flip on
   * when you want the canvas to feel alive. */
  combatMode: boolean;
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
  showExperimentalTools: false,
  combatMode: false,
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
