#!/usr/bin/env bash
set -euo pipefail
python -m pip install -r backend/requirements.txt
npm --prefix frontend ci --no-audit --no-fund
VITE_API_URL="" npm --prefix frontend run build
