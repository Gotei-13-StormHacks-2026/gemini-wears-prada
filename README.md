# Gemini Wears Prada 👠

> Because sometimes your outfit deserves more than a wardrobe, it needs a second opinion, and she has opinions.

Gemini Wears Prada is an AI fashion assistant inspired by *Miranda Priestly* from *The Devil Wears Prada*. It combines multimodal vision, generative AI, and voice synthesis to critique your outfits like a brutally honest fashion editor, and to build new looks from the clothes you already own. Built for StormHacks 2026.

## What it does

**AI Fashion Critic**
Upload a photo of your outfit or take one in the app. Gemini analyzes the image, and a Miranda Priestly-inspired character delivers spoken, unfiltered feedback on your styling and overall look.

**AI Wardrobe**
Photograph your clothing items and the app isolates each one into a sticker-style cutout in your digital wardrobe. From there you can:

- Mix and match pieces to build outfits manually
- Generate a random outfit from your own closet
- Request looks by dress code and season
- Let the fashion algorithm put an outfit together for you

## How it works

1. **Capture:** the React client uploads an outfit photo or a single clothing item to the FastAPI backend.
2. **Vision:** Gemini (via `google-genai`) identifies garments and analyzes styling, fit, and overall look.
3. **Critique:** the response is written in the Miranda Priestly persona, then converted to speech with ElevenLabs.
4. **Wardrobe processing:** rembg strips the background from clothing photos, producing transparent, sticker-style assets.
5. **Outfit generation:** Gemini and a custom fashion algorithm select pieces from your wardrobe based on dress code, season, and your prompt.
6. **Persistence:** wardrobe data is stored in Supabase.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| AI / Vision | Google Gemini API (`google-genai`) |
| Voice | ElevenLabs |
| Image processing | rembg, Hugging Face |
| Database | Supabase |

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

[Tioluwani Akinloye](https://github.com/t1oluwani), [Charles Aina](https://github.com/charles01a1), and [Kadeem Austin](https://github.com/austinagii)

[Devpost](https://devpost.com/software/orbitcare)
