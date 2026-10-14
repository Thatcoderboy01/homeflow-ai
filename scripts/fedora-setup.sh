#!/usr/bin/env bash
# Installs prerequisites on Fedora. Review before running; it uses sudo.
set -euo pipefail
sudo dnf install -y git nodejs npm podman podman-compose
node -v   # needs >= 22.12 (Fedora 41+ ships Node 22). Otherwise install via nvm: https://github.com/nvm-sh/nvm
echo "Prerequisites installed. Next: cp .env.example .env && podman compose up -d && npm install"
