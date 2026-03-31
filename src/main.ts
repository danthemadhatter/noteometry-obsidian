import { Plugin, WorkspaceLeaf, PluginSettingTab, Setting } from "obsidian";
import { NoteometryView } from "./NoteometryView";

interface NoteometrySettings {
  geminiApiKey: string;
}

export default class NoteometryPlugin extends Plugin {
  settings: NoteometrySettings = { geminiApiKey: "" };

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new NoteometrySettingTab(this.app, this));

    this.registerView(
      "noteometry-view",
      (leaf: WorkspaceLeaf) => new NoteometryView(leaf, this)
    );

    this.addRibbonIcon("pencil", "Open Noteometry", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-noteometry",
      name: "Open Noteometry canvas",
      callback: () => this.activateView(),
    });
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType("noteometry-view")[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: "noteometry-view" });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class NoteometrySettingTab extends PluginSettingTab {
  plugin: NoteometryPlugin;

  constructor(app: any, plugin: NoteometryPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Gemini API Key")
      .setDesc("Get from https://aistudio.google.com/app/apikey (Gemini 3.1 Pro Preview)")
      .addText((text) =>
        text
          .setPlaceholder("AIza...")
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
