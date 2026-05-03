import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type NoteometryPlugin from "./main";
import { NOTEOMETRY_VERSION } from "./lib/version";

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

    /* ── About / version badge ────────────────────────────
     * v1.6.13: surface the running build so the user can confirm
     * Obsidian didn't restore a stale cached main.js after an
     * install from GitHub Releases. Previously only findable by
     * digging into manifest.json inside the plugin folder. */
    const aboutEl = containerEl.createDiv({ cls: "nm-about-row" });
    aboutEl.createSpan({ text: "Version " });
    aboutEl.createEl("strong", { text: NOTEOMETRY_VERSION });
    aboutEl.createSpan({
      text: " — if this doesn't match the release you installed, restart Obsidian (⌘Q) to clear cached plugin code.",
      cls: "nm-about-note",
    });

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

    /* ── v1.11.1: Launch behavior ────────────────────── */
    new Setting(containerEl)
      .setName("Show home view on launch")
      .setDesc(
        "When ON, opening Obsidian shows the Noteometry home (Resume / New page / Recents). When OFF (default), opens the most-recent page directly.",
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.homeViewOnLaunch).onChange(async (v) => {
          this.plugin.settings.homeViewOnLaunch = v;
          await this.plugin.saveSettings();
        }),
      );

    /* ── v1.11.1: Custom pages panel ──────────────────── */
    /* v1.12.0: 'Show pages panel' setting removed. The pages panel is
       gone — navigation lives in the canvas right-click hub now (📚
       Pages submenu). No setting required. */

    /* ── v1.11.1: Global theme ───────────────────────── */
    new Setting(containerEl)
      .setName("Apply Noteometry theme to all of Obsidian")
      .setDesc(
        "Re-skins Obsidian's sidebar, tab bar, ribbon, command palette, and modals to match Noteometry. Respects your light/dark mode choice. Removed cleanly when off.",
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.globalThemeEnabled).onChange(async (v) => {
          this.plugin.settings.globalThemeEnabled = v;
          await this.plugin.saveSettings();
          // Apply/remove immediately — no reload needed.
          // We import lazily to avoid cycles in the settings module.
          const { applyGlobalTheme, removeGlobalTheme } = await import(
            "./lib/globalTheme"
          );
          if (v) applyGlobalTheme();
          else removeGlobalTheme();
        }),
      );

    /* ── Reset gesture tutorial ───────────────────────── */
    /* v1.11.0 phase-4 sub-PR 4.2: design doc §6b mitigation for the
     * "gesture recall + object-permanence crash" failure mode. Always
     * one tap away. Flipping this back to false re-arms the first-run
     * cheatsheet on the next canvas open. */
    new Setting(containerEl)
      .setName("Reset gesture tutorial")
      .setDesc(
        "Replay the first-run gesture cheatsheet next time you open a Noteometry page. Useful if you forget the 3-finger / 4-finger gestures.",
      )
      .addButton((btn) =>
        btn
          .setButtonText(
            this.plugin.settings.gestureTutorialSeen
              ? "Reset"
              : "Already armed",
          )
          .setDisabled(!this.plugin.settings.gestureTutorialSeen)
          .onClick(async () => {
            this.plugin.settings.gestureTutorialSeen = false;
            await this.plugin.saveSettings();
            new Notice(
              "Gesture tutorial will replay next time you open a Noteometry page.",
              5000,
            );
            this.display();
          }),
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
