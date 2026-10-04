import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ItemUploadRequest, ItemUploadResponse, RoastImageResponse } from '../lib/types'
import { getCurrentMonth } from '../lib/utils'

import logo from '../assets/gwp_logo_best.png'
import UploadModal from '../components/UploadModal'

const month = getCurrentMonth()
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
const STORAGE_BUCKET = 'closet-items'
const SUPPORTED_IMAGE_TYPES: ItemUploadRequest['content_type'][] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

function Homepage() {
  const navigate = useNavigate()
  const [showUpload, setShowUpload] = useState(false)
  const [fitCheckStatus, setFitCheckStatus] = useState<string | null>(null)
  const [fitCheckError, setFitCheckError] = useState<string | null>(null)
  const [roastText, setRoastText] = useState<string | null>(null)

  const handleFitCheckFile = async (file: File) => {
    setShowUpload(false)
    setFitCheckError(null)
    setRoastText(null)

    try {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type as ItemUploadRequest['content_type'])) {
        throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
      }
      if (!supabase) {
        throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the frontend environment.')
      }

      setFitCheckStatus('Preparing secure image upload...')
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
      setFitCheckStatus('Uploading your fit check...')
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(ticket.image_ref, ticket.token, file, { contentType: file.type })
      if (uploadError) throw uploadError

      setFitCheckStatus('Getting your fit check...')
      const roastResponse = await fetch(`${API_BASE_URL}/api/vision/roast-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_ref: ticket.image_ref }),
      })
      if (!roastResponse.ok) {
        const body = await roastResponse.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Could not analyze this fit check.')
      }

      const result = (await roastResponse.json()) as RoastImageResponse
      setRoastText(result.roast_text)
    } catch (error) {
      setFitCheckError(error instanceof Error ? error.message : 'Could not complete this fit check.')
    } finally {
      setFitCheckStatus(null)
    }
  }

  return (
    <>
      <div className="homepage">
        <header className="masthead">
          <div className="issue-line">
            <span>The {month} Issue</span>
            <span>Fashion's Definitive Voice</span>
          </div>
          <h1 className="title">Runway</h1>
        </header>

        <p className="coverline left">
          Florals? For spring?
          <em>Groundbreaking.</em>
        </p>
        <p className="coverline right">
          Cerulean, actually.
          <em>It's not just blue.</em>
        </p>

        <div className="cta">
          <div className="btn-row">
            <button className="fit-check" onClick={() => setShowUpload(true)} disabled={Boolean(fitCheckStatus)}>Fit Check</button>
            <button className="wardrobe" onClick={() => navigate('/wardrobe')}>Wardrobe</button>
          </div>
          <p className="dismissal">That's all.</p>
        </div>

        {showUpload && (<UploadModal onClose={() => setShowUpload(false)} onFile={handleFitCheckFile} />)}
        {fitCheckStatus && <p className="fit-check-status" role="status">{fitCheckStatus}</p>}
        {(fitCheckError || roastText) && (
          <section className="fit-check-result" aria-live="polite">
            <button
              className="fit-check-result-close"
              onClick={() => { setFitCheckError(null); setRoastText(null) }}
              aria-label="Dismiss fit check result"
            >×</button>
            {fitCheckError ? (
              <p role="alert">{fitCheckError}</p>
            ) : (
              <>
                <h2>Fit Check</h2>
                <p>{roastText}</p>
              </>
            )}
          </section>
        )}
      </div>
      <style>{styles}</style>
    </>
  )
}

export default Homepage

const serif = `'Bodoni Moda', Didot, 'Bodoni 72', 'Times New Roman', serif`
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,500;0,700;0,900;1,400&display=swap');

  .homepage {
    --runway-black: #0a0a0a;
    --runway-white: #f9dede;
    --runway-red: #c8102e;
    --cerulean: #1f78b4;

    position: relative;
    background-color: var(--runway-white);
    background-image: url(${logo});
    background-size: 52%;
    background-position: center 62%;
    background-repeat: no-repeat;
    min-height: 100vh;
    overflow: hidden;
    font-family: ${serif};
    color: var(--runway-black);
  }

  .masthead {
    text-align: center;
    padding: 20px 24px 0;
  }

  .issue-line {
    display: flex;
    justify-content: space-between;
    font-size: 18px;
    font-style: italic;
    padding-bottom: 6px;
    border-bottom: 3px double var(--runway-black);
  }

  .homepage .title {
    margin: 0;
    font-family: ${serif};
    font-weight: 900;
    font-size: 100px;
    line-height: 0.95;
    letter-spacing: -0.02em;
    color: var(--runway-black);
    text-shadow: none;
    animation: reveal 4.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }

  .coverline {
    position: absolute;
    top: 42%;
    width: 190px;
    margin: 0;
    font-size: 20px;
    font-weight: 500;
    line-height: 1.25;
    opacity: 0;
  }

  .coverline em {
    display: block;
    font-weight: 700;
    font-size: 28px;
  }

  .coverline.left em { color: var(--runway-red); }
  .coverline.right em { color: var(--cerulean); }

  .coverline.left {
    left: 4vw;
    text-align: left;
    animation: slideFromRight 2.6s cubic-bezier(0.22, 0.61, 0.36, 1) 1.5s forwards;
  }
  .coverline.right {
    right: 4vw;
    text-align: right;
    animation: slideFromLeft 2.6s cubic-bezier(0.22, 0.61, 0.36, 1) 1.7s forwards;
  }

  .homepage .cta {
    position: absolute;
    bottom: 7vh;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }

  .btn-row {
    display: flex;
    gap: 100px;
    opacity: 0;
    animation: fadeUp 1.2s ease-out 2.5s forwards;
  }

  .fit-check, .wardrobe {
    background: var(--runway-black);
    padding: 10px 22px;
    border-radius: 10px;
    cursor: pointer;
    font-family: ${serif};
    font-size: 20px;
  }

  .fit-check {
    color: var(--runway-red);
    border: var(--runway-red) 4px solid;
  }

  .wardrobe {
    color: var(--cerulean);
    border: var(--cerulean) 4px solid;
  }

  .fit-check:hover, .wardrobe:hover {
    color: var(--runway-white);
    background: linear-gradient(to right, var(--runway-red), var(--cerulean));
  }

  .main-btn:focus-visible {
    outline: 3px solid var(--cerulean);
    outline-offset: 3px;
  }

  .dismissal {
    margin: 0;
    font-style: italic;
    font-size: 30px;
    font-weight: 900;
    opacity: 0;
    animation: dismiss 1s cubic-bezier(0.34, 1.56, 0.64, 1) 3.0s forwards;
  }

  .fit-check-status, .fit-check-result {
    position: fixed;
    z-index: 90;
    left: 50%;
    bottom: 19vh;
    transform: translateX(-50%);
    width: min(520px, calc(100vw - 32px));
    box-sizing: border-box;
    margin: 0;
    padding: 14px 18px;
    border: 3px solid var(--runway-black);
    background: #fff;
    text-align: center;
  }

  .fit-check-result { max-height: 40vh; overflow: auto; }
  .fit-check-result h2 { margin: 0 28px 8px; font-size: 24px; }
  .fit-check-result p { margin: 0; white-space: pre-wrap; }
  .fit-check-result-close {
    position: absolute;
    top: 4px;
    right: 8px;
    border: 0;
    background: transparent;
    color: var(--runway-black);
    font-size: 24px;
    cursor: pointer;
  }

  /* Animation Stuff */
  @keyframes reveal {
    0%   { opacity: 0; letter-spacing: 0.15em; filter: blur(8px); }
    60%  { opacity: 1; filter: blur(0); }
    100% { opacity: 1; letter-spacing: -0.02em; filter: blur(0); }
  }

  @keyframes slideFromRight {
    from { opacity: 0; transform: translateX(calc(92vw - 190px)); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes slideFromLeft {
    from { opacity: 0; transform: translateX(calc(-92vw + 190px)); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes dismiss {
    from { opacity: 0; transform: translateY(-24px) scale(1.15); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
`;
