#!/usr/bin/env sh
# Start LiScout locally: http://localhost:8000 (landing) and /map.html (map).
set -e
cd "$(dirname "$0")/backend"
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r requirements.txt
exec uvicorn liscout.main:app --host 127.0.0.1 --port "${PORT:-8000}"
