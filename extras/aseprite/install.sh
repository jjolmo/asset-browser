#!/bin/sh
# Installs aseprite-open and the open-in-running extension for this user.
# Aseprite windows already open load the extension only after a restart.
set -e

here=$(cd "$(dirname "$0")" && pwd)
config="${XDG_CONFIG_HOME:-$HOME/.config}/aseprite"

mkdir -p "$config/extensions" "$HOME/.local/bin"
rm -rf "$config/extensions/open-in-running"
cp -r "$here/open-in-running" "$config/extensions/open-in-running"
install -m 755 "$here/aseprite-open" "$HOME/.local/bin/aseprite-open"

echo "Installed. Use this as the Asset Browser action command:"
echo "  $HOME/.local/bin/aseprite-open {file}"
