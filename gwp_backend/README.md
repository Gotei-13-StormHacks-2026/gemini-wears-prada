# GWP Backend

FastAPI server for the closet app.

## Setup

Run these from this folder (the one that contains `app`).

```powershell
cd gwp_backend  
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your keys:

```
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_STORAGE_BUCKET=
GEMINI_API_KEY=
```

Run `sql/schema.sql` in your Supabase project once, and create a private storage bucket with the name you set above.

## Run the server

```powershell
python -m uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs to see and try the endpoints. Stop the server with `Ctrl+C`.

The first image upload is slow because the background-removal model downloads once.

## Run the tests

```powershell
python -m pytest
```