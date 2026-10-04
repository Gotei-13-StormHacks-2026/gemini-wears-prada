# Gemini Wears Prada

> Because sometimes your outfit deserves more than a wardrobe, it needs a second opinion, and she has opinions.

Gemini Wears Prada is an AI fashion assistant inspired by *Miranda Priestly* from *The Devil Wears Prada*. It critiques your outfits in the voice of a brutally honest fashion editor, and it helps you build new looks from the clothes you already own. Built for StormHacks 2026.

## What it does

**AI Fashion Critic**
Upload a photo of your outfit or take one in the app. A Miranda Priestly-inspired character gives you spoken, unfiltered feedback on your styling and overall look.

**AI Wardrobe**
Photograph your clothing items and the app isolates each one into a sticker-style piece in your digital wardrobe. From there you can:

- Mix and match pieces to build outfits manually
- Generate a random outfit from your own closet
- Request looks by dress code and season
- Let the fashion algorithm put an outfit together for you

## Built with

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **AI:** Google Gemini (`google-genai`) for outfit analysis and recommendations
- **Voice:** ElevenLabs for the critic's spoken feedback
- **Image processing:** rembg and Hugging Face for background removal and sticker-style cutouts
- **Database:** Supabase

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

## Team

[Tioluwani Akinloye](https://github.com/t1oluwani) and [Charles Aina](https://github.com/charles01a1) and [Kadeem Austin](https://github.com/austinagii)

[Devpost](https://devpost.com/software/orbitcare)
