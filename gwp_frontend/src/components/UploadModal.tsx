import { useRef, useState } from 'react'
import LiveCapture from './LiveCapture'

type Props = {
  onClose: () => void
  onFile: (file: File) => void
}

export default function UploadModal({ onClose, onFile }: Props) {
  const [mode, setMode] = useState<'choose' | 'live'>('choose')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file && file.type.startsWith('image/')) onFile(file)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        {mode === 'choose' ? (
          <>
            <h2 className="modal-title">Fit Check</h2>

            <div
              className={`dropzone ${dragging ? 'dragging' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                handleFiles(e.dataTransfer.files)
              }}
            >
              <p>Drag a photo here</p>
              <span>or click to upload</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            <div className="or-divider"><span>or</span></div>

            <button className="live-btn" onClick={() => setMode('live')}>
              Take a Live Photo
            </button>
          </>
        ) : (
          <LiveCapture onCapture={onFile} onBack={() => setMode('choose')} />
        )}
      </div>
      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 10, 10, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    position: relative;
    width: min(460px, 92vw);
    background: #fafafa;
    border: 5px solid #0a0a0a;
    border-radius: 12px;
    padding: 28px;
    text-align: center;
  }

  .modal-title {
    margin: 0 0 18px;
    font-size: 36px;
    font-weight: 900;
  }

  .modal-close {
    position: absolute;
    top: 8px;
    right: 14px;
    background: none;
    border: none;
    font-size: 28px;
    cursor: pointer;
    color: #0a0a0a;
  }

  .dropzone {
    border: 3px dashed #0a0a0a;
    border-radius: 10px;
    padding: 40px 16px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .dropzone p { margin: 0; font-size: 22px; font-weight: 700; }
  .dropzone span { font-style: italic; }

  .dropzone:hover, .dropzone.dragging {
    background: #eef5fb;
    border-color: #1f78b4;
  }

  .or-divider {
    margin: 16px 0;
    font-style: italic;
  }

  .live-btn {
    background: #0a0a0a;
    color: #c8102e;
    border: 4px solid #c8102e;
    border-radius: 10px;
    padding: 10px 22px;
    font-family: inherit;
    font-size: 18px;
    cursor: pointer;
  }

  .live-btn:hover {
    background: linear-gradient(to left, #c8102e, #1f78b4);
    color: white;
  }
`