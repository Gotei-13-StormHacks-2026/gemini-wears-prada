import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadModal from '../components/UploadModal'
import Waveform from '../components/Waveform'
import { supabase } from '../lib/supabase'
import { speak } from '../lib/tts'
import type { ItemUploadRequest, ItemUploadResponse, RoastImageResponse } from '../lib/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
const STORAGE_BUCKET = 'closet-items'
const SUPPORTED_IMAGE_TYPES: ItemUploadRequest['content_type'][] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

export default function Critique() {
  const navigate = useNavigate()

  // Prompt for a photo as soon as the page opens
  const [showUpload, setShowUpload] = useState(true)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [roastText, setRoastText] = useState<string | null>(null)

  // Audio playback + waveform
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      audioRef.current?.pause()
      void audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!photoUrl) return
    return () => URL.revokeObjectURL(photoUrl)
  }, [photoUrl])

  const stopAudio = () => {
    audioRef.current?.pause()
    audioRef.current = null
    // Keep the analyser so the waveform eases down instead of snapping flat
    setIsSpeaking(false)
  }

  const readAloud = async (text: string) => {
    const audio = await speak(text)
    if (!mountedRef.current) {
      audio.pause()
      return
    }
    audioRef.current = audio

    // Route the audio through an analyser so the waveform follows the voice.
    // If the browser kept the AudioContext suspended, skip it — routing through
    // a suspended context would mute the audio.
    const audioContext = audioContextRef.current
    if (audioContext?.state === 'running') {
      const node = audioContext.createAnalyser()
      node.fftSize = 1024
      audioContext.createMediaElementSource(audio).connect(node)
      node.connect(audioContext.destination)
      setAnalyser(node)
    }

    setIsSpeaking(true)
    const done = () => {
      if (audioRef.current === audio) stopAudio()
    }
    audio.addEventListener('ended', done)
    audio.addEventListener('pause', done)
  }

  const handleFile = async (file: File) => {
    setShowUpload(false)
    stopAudio()
    setError(null)
    setRoastText(null)
    setPhotoUrl(URL.createObjectURL(file))

    // Start the AudioContext while we're still inside the user's gesture
    audioContextRef.current ??= new AudioContext()
    void audioContextRef.current.resume()

    try {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type as ItemUploadRequest['content_type'])) {
        throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
      }
      if (!supabase) {
        throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the frontend environment.')
      }

      setStatus('Preparing secure image upload...')
      const ticketResponse = await fetch(`${API_BASE_URL}/api/closet/items/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: file.type }),
      })
      if (!ticketResponse.ok) {
        const body = await ticketResponse.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Could not prepare the image upload.')
      }

      const ticket = (await ticketResponse.json()) as ItemUploadResponse
      setStatus('Uploading your fit check...')
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(ticket.image_ref, ticket.token, file, { contentType: file.type })
      if (uploadError) throw uploadError

      setStatus('Getting your critique...')
      const roastResponse = await fetch(`${API_BASE_URL}/api/vision/roast-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_ref: ticket.image_ref }),
      })
      if (!roastResponse.ok) {
        if (roastResponse.status === 503 || roastResponse.status === 502) {
          throw new Error('The AI model is currently experiencing high demand. Please try again later.')
        }
        const body = await roastResponse.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Could not analyze this fit check.')
      }

      const result = (await roastResponse.json()) as RoastImageResponse
      if (!mountedRef.current) return
      setRoastText(result.roast_text)
      // Don't fail the critique over audio playback
      readAloud(result.roast_text).catch((error) => console.error('Could not read critique aloud', error))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not complete this fit check.')
    } finally {
      setStatus(null)
    }
  }

  return (
    <div className="critique-page">
      <header className="critique-header">
        <button className="header-button" onClick={() => navigate('/')}>
          ← Back
        </button>

        <div className="header-title">
          <span className="eyebrow">FIT CHECK</span>
          <h1>Critique</h1>
        </div>

        {photoUrl && (
          <button
            className="header-button new-button"
            onClick={() => setShowUpload(true)}
            disabled={Boolean(status)}
          >
            + New Photo
          </button>
        )}
      </header>

      {!photoUrl ? (
        <div className="empty-state">
          <div className="empty-icon">+</div>
          <h3>Show us the fit</h3>
          <p>Upload a photo of your outfit to get the verdict.</p>
          <button className="primary-button" onClick={() => setShowUpload(true)}>
            Upload Photo
          </button>
        </div>
      ) : (
        <main className="critique-layout">
          <section className="panel photo-panel">
            <img src={photoUrl} alt="Your outfit" />
          </section>

          <section className="panel verdict-panel" aria-live="polite">
            <span className="panel-eyebrow">THE VERDICT</span>
            <h2>Fit Check</h2>

            {status && <p className="status" role="status">{status}</p>}
            {error && <div className="error-message" role="alert">{error}</div>}
            {roastText && <p className="roast-text">{roastText}</p>}
            <Waveform analyser={analyser} playing={isSpeaking} />
          </section>
        </main>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onFile={handleFile} />}

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,500;0,700;0,900;1,400&family=Inter:wght@400;500;600;700&display=swap');

  .critique-page {
    --black: #111111;
    --red: #c8102e;
    --blue: #1f78b4;
    --gray-100: #f3f4f6;
    --gray-200: #e5e7eb;
    --gray-400: #9ca3af;
    --gray-500: #6b7280;
    --gray-700: #374151;

    min-height: 100vh;
    box-sizing: border-box;
    padding: 24px 4vw 70px;
    background: #fafafa;
    color: var(--black);
    font-family: Inter, Arial, sans-serif;
  }

  /* HEADER */

  .critique-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 20px;
    padding-bottom: 18px;
    margin-bottom: 28px;
    border-bottom: 3px double var(--black);
  }

  .critique-page .header-title {
    text-align: center;
  }

  .critique-page .header-title h1 {
    margin: 2px 0 0;
    font-family: 'Bodoni Moda', Didot, 'Times New Roman', serif;
    font-size: clamp(42px, 5vw, 64px);
    line-height: 0.95;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .critique-page .eyebrow,
  .critique-page .panel-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    color: var(--gray-500);
  }

  .critique-page .header-button {
    justify-self: start;
    padding: 9px 15px;
    border: 2px solid var(--black);
    border-radius: 9px;
    background: white;
    color: var(--black);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: 0.15s ease;
  }

  .critique-page .header-button:hover:not(:disabled) {
    background: var(--black);
    color: white;
  }

  .critique-page .header-button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .critique-page .new-button {
    justify-self: end;
  }

  /* LAYOUT: photo in the left third, verdict in the right third */

  .critique-layout {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 28px;
    align-items: start;
  }

  .critique-page .panel {
    padding: 22px;
    border: 1px solid var(--gray-200);
    border-radius: 18px;
    background: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .photo-panel {
    grid-column: 1;
    padding: 12px !important;
  }

  .photo-panel img {
    display: block;
    width: 100%;
    max-height: 72vh;
    object-fit: contain;
    border-radius: 12px;
  }

  .verdict-panel {
    grid-column: 3;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 72vh;
    overflow: auto;
  }

  .verdict-panel h2 {
    margin: -10px 0 0;
    font-family: 'Bodoni Moda', Didot, 'Times New Roman', serif;
    font-size: 27px;
    line-height: 1.1;
  }

  .verdict-panel .status {
    margin: 0;
    color: var(--gray-500);
    font-size: 13px;
    font-style: italic;
  }

  .roast-text {
    margin: 0;
    font-family: 'Bodoni Moda', Didot, 'Times New Roman', serif;
    font-size: 17px;
    line-height: 1.55;
    white-space: pre-wrap;
  }

  /* BUTTONS */

  .critique-page .primary-button {
    border: 2px solid var(--black);
    border-radius: 9px;
    padding: 9px 15px;
    background: var(--black);
    color: white;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: 0.15s ease;
  }

  .critique-page .primary-button:hover {
    background: var(--blue);
    border-color: var(--blue);
  }

  /* EMPTY STATE */

  .critique-page .empty-state {
    padding: 55px 20px;
    border: 1px dashed #d1d5db;
    border-radius: 16px;
    background: white;
    text-align: center;
  }

  .critique-page .empty-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 12px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--gray-100);
    color: var(--gray-500);
    font-size: 24px;
  }

  .critique-page .empty-state h3 {
    margin: 0;
    font-family: 'Bodoni Moda', Didot, serif;
    font-size: 22px;
  }

  .critique-page .empty-state p {
    margin: 5px 0 18px;
    color: var(--gray-500);
    font-size: 13px;
  }

  /* ERRORS */

  .critique-page .error-message {
    padding: 10px 13px;
    border-radius: 9px;
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
    font-size: 12px;
  }

  /* RESPONSIVE */

  @media (max-width: 800px) {
    .critique-header {
      grid-template-columns: 1fr 1fr;
    }

    .critique-page .header-title {
      grid-column: 1 / -1;
      grid-row: 1;
    }

    .critique-page .header-button {
      grid-row: 2;
    }

    .critique-layout {
      grid-template-columns: 1fr;
    }

    .photo-panel,
    .verdict-panel {
      grid-column: auto;
      max-height: none;
    }
  }

  @media (max-width: 560px) {
    .critique-page {
      padding: 16px 14px 50px;
    }
  }
`
