# gemini-wears-prada

## Local Setup

### Backend environment

From the repository root, create a local environment file from the shared template:

```sh
cd gwp_backend
cp env.example .env.local
```

Fill in the Supabase and Gemini values in `gwp_backend/.env.local`. Get the Supabase project URL and API keys from **Project Settings → API** in the Supabase dashboard. Use the publishable key for `VITE_SUPABASE_ANON_KEY` and keep the Supabase secret key and `GEMINI_API_KEY` private. Get the Gemini key from Google AI Studio.

The `VITE_*` values are read by Vite from this same file. Only put browser-safe values behind the `VITE_` prefix; never prefix a secret key with `VITE_`.

Install and run the backend from `gwp_backend`:

```sh
python3 -m pip install -r requirements.txt
uvicorn app.main:app --reload --env-file .env.local
```

### Frontend

In another terminal, from the repository root:

```sh
cd gwp_frontend
npm install
npm run dev
```

Open the local URL printed by Vite. The backend allows both `localhost:5173` and `127.0.0.1:5173` during local development.

Never commit `gwp_backend/.env.local`; it is ignored by Git. Share `gwp_backend/env.example` with teammates, not the populated local file.

## Running the Development Scripts

### Windows PowerShell

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
./scripts/setup.ps1
./scripts/run.ps1
```

### Linux/macOS

```bash
chmod +x scripts/setup.sh scripts/dev.sh
./scripts/setup.sh
./scripts/run.sh
```