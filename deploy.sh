#!/bin/bash
# Deploy built plugin files to Obsidian vault for Obsidian Sync
DEST="$HOME/Documents/Noteometry/.obsidian/plugins/noteometry"
mkdir -p "$DEST"
cp main.js styles.css manifest.json "$DEST/"
cp data.json "$DEST/" 2>/dev/null
echo "Deployed to $DEST"
