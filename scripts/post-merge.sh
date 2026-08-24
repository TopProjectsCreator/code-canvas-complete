#!/usr/bin/env bash
set -euo pipefail

export CI=1

npm install --no-audit --no-fund
npm run build