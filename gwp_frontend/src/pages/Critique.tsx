import { useState } from "react";

const VOICE_ID = "wnsEGFCGVwRbd7xPIDmb"; 

function Critique() {
  const [loading, setLoading] = useState(false);

  async function speak(text: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": import.meta.env.VITE_ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
        }
      );
      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button disabled={loading} onClick={() => speak("Your outfit is... a choice.")}>
      {loading ? "Loading…" : "Read critique"}
    </button>
  );
}

export default Critique;
