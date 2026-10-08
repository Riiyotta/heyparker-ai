#!/bin/bash
# Open this template's cloned site locally (with animations) in your browser.
export PYTHONDONTWRITEBYTECODE=1
cd "$(dirname "$0")" || exit 1
command -v python3 >/dev/null 2>&1 || { echo "Install python3 once: xcode-select --install"; read -p "Press Return."; exit 1; }
python3 "_serve.py"
read -p "Press Return to close."
