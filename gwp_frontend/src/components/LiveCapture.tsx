import { useEffect, useRef, useState } from 'react'

type Props = {
  onCapture: (file: File) => void
  onBack: () => void
}

export default function LiveCapture({ onCapture, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setError('Camera access was denied or unavailable.'))

    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `fit-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="live-capture">
      <h2 className="modal-title">Live Photo</h2>

      {error ? (
        <p>{error}</p>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="live-video" />
      )}

      <div className="live-actions">
        <button className="live-btn" onClick={onBack}>Back</button>
        {!error && <button className="live-btn" onClick={capture}>Capture</button>}
      </div>

      <style>{`
        .live-video {
          width: 100%;
          border: 3px solid #0a0a0a;
          border-radius: 10px;
          transform: scaleX(-1); /* mirror preview */
          background: #0a0a0a;
        }
        .live-actions {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 16px;
        }
      `}</style>
    </div>
  )
}