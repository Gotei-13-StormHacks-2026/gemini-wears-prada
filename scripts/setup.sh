#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Setting up backend..."

cd "$ROOT_DIR/gwp_backend"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if [ ! -f ".env.local" ]; then
  cp env.example .env.local
  echo ""
  echo "Created gwp_backend/.env.local"
  echo "Fill in your Supabase and Gemini values before running the app."
fi

deactivate

cd "$ROOT_DIR/gwp_frontend"

echo "==> Installing frontend dependencies..."
npm install

cd ..

echo ""
echo "Setup complete."
echo ""
echo "Next:"
echo "  1. Fill in gwp_backend/.env.local"
echo "  2. Run ./dev.sh"