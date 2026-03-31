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

    new Setting(containerEl)
      .setName("Gemini API key")
      .setDesc("Get yours at https://aistudio.google.com/app/apikey")
      .addText((text) =>
        text
          .setPlaceholder("AIza...")
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Gemini model")
      .setDesc("Model ID for the Gemini API (default: gemini-3.1-pro-preview)")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.geminiModel)
          .onChange(async (value) => {
            this.plugin.settings.geminiModel = value;
            await this.plugin.saveSettings();
          })
      );

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
  }
}
