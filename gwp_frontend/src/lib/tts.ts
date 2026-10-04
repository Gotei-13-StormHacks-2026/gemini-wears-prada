const DEFAULT_VOICE_ID = 'wnsEGFCGVwRbd7xPIDmb'
const DEFAULT_MODEL_ID = 'eleven_flash_v2_5'

type SpeakOptions = {
  voiceId?: string
  modelId?: string
}

// Reads text aloud with ElevenLabs. Resolves once playback starts and returns
// the audio element so callers can pause it or listen for 'ended'.
export async function speak(
  text: string,
  { voiceId = DEFAULT_VOICE_ID, modelId = DEFAULT_MODEL_ID }: SpeakOptions = {},
): Promise<HTMLAudioElement> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': import.meta.env.VITE_ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model_id: modelId }),
    },
  )
  if (!res.ok) throw new Error(`TTS failed: ${res.status}`)

  const url = URL.createObjectURL(await res.blob())
  const audio = new Audio(url)
  audio.addEventListener('ended', () => URL.revokeObjectURL(url))
  await audio.play()
  return audio
}
