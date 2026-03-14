#!/bin/bash
# Source common node version manager paths
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Try Volta
[ -s "$HOME/.volta/bin" ] && export PATH="$HOME/.volta/bin:$PATH"

# Try Homebrew
[ -d "/opt/homebrew/bin" ] && export PATH="/opt/homebrew/bin:$PATH"
[ -d "/usr/local/bin" ] && export PATH="/usr/local/bin:$PATH"

# Try fnm
[ -s "$HOME/.local/share/fnm" ] && eval "$(fnm env 2>/dev/null)"

cd "$(dirname "$0")"
exec npm run dev
