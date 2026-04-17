import { App, PluginSettingTab, Setting } from "obsidian";
import type NoteometryPlugin from "./main";

export class NoteometrySettingTab extends PluginSettingTab {
  plugin: NoteometryPlugin;

  constructor(app: App, plugin: NoteometryPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Noteometry" });

    /* ── AI Provider ──────────────────────────────────── */
    new Setting(containerEl)
      .setName("AI provider")
      .setDesc("Perplexity (cloud, routed models), Claude (cloud), or LM Studio (local)")
      .addDropdown((dd) =>
        dd
          .addOption("perplexity", "Perplexity (routed)")
          .addOption("claude", "Anthropic Claude")
          .addOption("lmstudio", "LM Studio (local)")
          .setValue(this.plugin.settings.aiProvider)
          .onChange(async (value) => {
            this.plugin.settings.aiProvider = value as "claude" | "lmstudio" | "perplexity";
            await this.plugin.saveSettings();
            this.display();
          })
      );

    /* ── Perplexity settings ─────────────────────────── */
    if (this.plugin.settings.aiProvider === "perplexity") {
      new Setting(containerEl)
        .setName("Perplexity API key")
        .setDesc("Get yours at perplexity.ai/settings/api")
        .addText((text) =>
          text
            .setPlaceholder("pplx-...")
            .setValue(this.plugin.settings.perplexityApiKey)
            .onChange(async (value) => {
              this.plugin.settings.perplexityApiKey = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Perplexity model")
        .setDesc("Perplexity routes any /v1/agent request to the backing model you specify. Examples: openai/gpt-5.4, anthropic/claude-4.5-sonnet, xai/grok-4-1")
        .addText((text) =>
          text
            .setPlaceholder("openai/gpt-5.4")
            .setValue(this.plugin.settings.perplexityModel)
            .onChange(async (value) => {
              this.plugin.settings.perplexityModel = value;
              await this.plugin.saveSettings();
            })
        );
    }

    /* ── Claude settings ─────────────────────────────── */
    if (this.plugin.settings.aiProvider === "claude") {
      new Setting(containerEl)
        .setName("Claude API key")
        .setDesc("Get yours at console.anthropic.com")
        .addText((text) =>
          text
            .setPlaceholder("sk-ant-...")
            .setValue(this.plugin.settings.claudeApiKey)
            .onChange(async (value) => {
              this.plugin.settings.claudeApiKey = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Claude model")
        .addText((text) =>
          text
            .setValue(this.plugin.settings.claudeModel)
            .onChange(async (value) => {
              this.plugin.settings.claudeModel = value;
              await this.plugin.saveSettings();
            })
        );
    }

    /* ── LM Studio settings ──────────────────────────── */
    if (this.plugin.settings.aiProvider === "lmstudio") {
      new Setting(containerEl)
        .setName("LM Studio URL")
        .setDesc("Usually http://localhost:1234")
        .addText((text) =>
          text
            .setValue(this.plugin.settings.lmStudioUrl)
            .onChange(async (value) => {
              this.plugin.settings.lmStudioUrl = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Text model")
        .setDesc("Model for SOLVE and Chat")
        .addText((text) =>
          text
            .setValue(this.plugin.settings.lmStudioTextModel)
            .onChange(async (value) => {
              this.plugin.settings.lmStudioTextModel = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Vision model")
        .setDesc("Model for READ INK (image → LaTeX)")
        .addText((text) =>
          text
            .setValue(this.plugin.settings.lmStudioVisionModel)
            .onChange(async (value) => {
              this.plugin.settings.lmStudioVisionModel = value;
              await this.plugin.saveSettings();
            })
        );
    }

    /* ── Storage ──────────────────────────────────────── */
    new Setting(containerEl)
      .setName("Vault folder")
      .setDesc("Root folder for Noteometry pages (relative to vault root)")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.vaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.vaultFolder = value;
            await this.plugin.saveSettings();
          })
      );

    /* ── Auto-save ───────────────────────────────────── */
    new Setting(containerEl)
      .setName("Auto-save")
      .setDesc("Persist canvas and panel state automatically")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoSave)
          .onChange(async (value) => {
            this.plugin.settings.autoSave = value;
            await this.plugin.saveSettings();
          })
      );

    /* ── Finger drawing ──────────────────────────────── */
    new Setting(containerEl)
      .setName("Finger drawing")
      .setDesc("Draw with a single finger on touch devices. Leave off on iPad with Apple Pencil (keeps palm-rejection pan). Turn on for Android / finger-only phones. Two-finger pan/pinch always works.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.fingerDrawing)
          .onChange(async (value) => {
            this.plugin.settings.fingerDrawing = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
