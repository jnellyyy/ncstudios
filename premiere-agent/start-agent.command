#!/bin/zsh

set -e

SCRIPT_DIR="${0:A:h}"
NODE_BIN="$(command -v node 2>/dev/null || true)"

if [[ -z "$NODE_BIN" && -x "/Applications/Codex.app/Contents/Resources/cua_node/bin/node" ]]; then
  NODE_BIN="/Applications/Codex.app/Contents/Resources/cua_node/bin/node"
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js 20 or newer is required. Install it from https://nodejs.org and run this file again."
  read "?Press Return to close..."
  exit 1
fi

cd "$SCRIPT_DIR"

if [[ ! -d "node_modules/openai" ]]; then
  NPM_BIN="$(dirname "$NODE_BIN")/npm"
  if [[ ! -x "$NPM_BIN" ]]; then
    echo "The helper dependencies are missing. Run npm install in: $SCRIPT_DIR"
    read "?Press Return to close..."
    exit 1
  fi
  echo "Installing the helper the first time..."
  PATH="$(dirname "$NODE_BIN"):$PATH" "$NPM_BIN" install
fi

if [[ -z "$OPENAI_API_KEY" ]]; then
  if command -v osascript >/dev/null 2>&1; then
    set +e
    OPENAI_API_KEY="$(
      osascript <<'APPLESCRIPT'
tell application "System Events"
  set keyDialog to display dialog "Paste a NEW OpenAI API key below. The key stays in this session and is not saved." default answer "" with title "NC Premiere Edit Agent" with hidden answer buttons {"Use Offline Mode", "Start Agent"} default button "Start Agent"
  if button returned of keyDialog is "Use Offline Mode" then
    return ""
  end if
  return text returned of keyDialog
end tell
APPLESCRIPT
    )"
    DIALOG_STATUS=$?
    set -e
    if [[ $DIALOG_STATUS -ne 0 ]]; then
      echo "Setup cancelled."
      exit 0
    fi
  else
    echo "Paste your OpenAI API key and press Return. Typed or pasted characters are hidden."
    read -s "OPENAI_API_KEY?API key (leave blank for offline demo mode): "
    echo
  fi
  export OPENAI_API_KEY
fi

echo "Starting NC Premiere Edit Agent..."
echo "Keep this window open while using the Premiere panel."
"$NODE_BIN" server/index.mjs
