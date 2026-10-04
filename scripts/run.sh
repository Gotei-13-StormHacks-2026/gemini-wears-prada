#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Starting backend..."

cd "$ROOT_DIR/gwp_backend"

if [ ! -d ".venv" ]; then
  echo "Backend virtual environment not found."
  echo "Run ./setup.sh first."
  exit 1
fi

source .venv/bin/activate

uvicorn app.main:app \
  --reload \
  --env-file .env.local &

BACKEND_PID=$!

echo "==> Starting frontend..."

cd "$ROOT_DIR/gwp_frontend"

npm run dev &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "==> Stopping development servers..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo ""
echo "Backend:  http://127.0.0.1:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

wait