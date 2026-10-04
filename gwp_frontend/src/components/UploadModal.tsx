import { useRef, useState } from "react";
import LiveCapture from "./LiveCapture";

type Props = {
  onClose: () => void;
  onFile: (file: File) => void;
};

export default function UploadModal({ onClose, onFile }: Props) {
  const [mode, setMode] = useState<"choose" | "live">("choose");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];

    if (file && file.type.startsWith("image/")) {
      onFile(file);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        {mode === "choose" ? (
          <>
            <div className="modal-header">
              <span className="modal-eyebrow">
                FIT CHECK
              </span>

              <h2 className="modal-title">
                What are you wearing?
              </h2>

              <p className="modal-subtitle">
                Upload a photo or take one right now.
              </p>
            </div>

            <div
              className={`dropzone ${
                dragging ? "dragging" : ""
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
            >
              <div className="upload-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 16V4" />
                  <path d="m7 9 5-5 5 5" />
                  <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                </svg>
              </div>

              <strong className="dropzone-title">
                Drop your photo here
              </strong>

              <span className="dropzone-description">
                or click to browse your device
              </span>

              <span className="dropzone-formats">
                JPG, PNG, WEBP
              </span>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) =>
                  handleFiles(e.target.files)
                }
              />
            </div>

            <div className="or-divider">
              <span>OR</span>
            </div>

            <button
              className="live-btn"
              onClick={() => setMode("live")}
            >
              <span className="camera-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-1.5-2Z" />
                  <circle cx="12" cy="12.5" r="3.5" />
                </svg>
              </span>

              <span>Take a live photo</span>

              <span className="button-arrow">→</span>
            </button>
          </>
        ) : (
          <LiveCapture
            onCapture={onFile}
            onBack={() => setMode("choose")}
          />
        )}
      </div>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 15, 15, 0.72);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: backdrop-in 0.2s ease-out;
  }

  .modal {
    position: relative;
    width: min(500px, 100%);
    box-sizing: border-box;
    padding: 42px;
    overflow: hidden;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 20px;
    box-shadow:
      0 30px 80px rgba(0, 0, 0, 0.22),
      0 8px 24px rgba(0, 0, 0, 0.08);
    animation: modal-in 0.25s ease-out;
  }

  .modal-close {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #f4f4f4;
    color: #555;
    font-family: inherit;
    font-size: 22px;
    font-weight: 300;
    line-height: 1;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      transform 0.15s ease;
  }

  .modal-close:hover {
    background: #eaeaea;
    color: #111;
    transform: rotate(90deg);
  }

  .modal-header {
    text-align: center;
    margin-bottom: 28px;
  }

  .modal-eyebrow {
    display: inline-block;
    margin-bottom: 10px;
    color: #888;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
  }

  .modal-title {
    margin: 0;
    color: #111;
    font-size: clamp(28px, 5vw, 36px);
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.05;
  }

  .modal-subtitle {
    margin: 10px 0 0;
    color: #777;
    font-size: 14px;
    line-height: 1.5;
  }

  .dropzone {
    min-height: 220px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 28px;
    border: 1.5px dashed #d2d2d2;
    border-radius: 14px;
    background: #fafafa;
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      transform 0.2s ease;
  }

  .dropzone:hover {
    border-color: #999;
    background: #f7f7f7;
  }

  .dropzone.dragging {
    border-color: #111;
    background: #f1f1f1;
    transform: scale(1.01);
  }

  .upload-icon {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    border-radius: 50%;
    background: #111;
    color: #fff;
  }

  .upload-icon svg {
    width: 23px;
    height: 23px;
  }

  .dropzone-title {
    margin-bottom: 5px;
    color: #222;
    font-size: 15px;
    font-weight: 650;
  }

  .dropzone-description {
    color: #777;
    font-size: 13px;
  }

  .dropzone-formats {
    margin-top: 14px;
    color: #aaa;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .or-divider {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 20px 0;
    color: #aaa;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
  }

  .or-divider::before,
  .or-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #e7e7e7;
  }

  .live-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 18px;
    border: 1px solid #111;
    border-radius: 10px;
    background: #111;
    color: #fff;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s ease,
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }

  .live-btn:hover {
    background: #292929;
    transform: translateY(-1px);
    box-shadow: 0 5px 14px rgba(0, 0, 0, 0.12);
  }

  .live-btn:active {
    transform: translateY(0);
  }

  .camera-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .camera-icon svg {
    width: 19px;
    height: 19px;
  }

  .button-arrow {
    margin-left: auto;
    font-size: 18px;
    font-weight: 400;
    transition: transform 0.15s ease;
  }

  .live-btn:hover .button-arrow {
    transform: translateX(3px);
  }

  @keyframes backdrop-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 520px) {
    .modal {
      padding: 32px 20px 24px;
      border-radius: 16px;
    }

    .dropzone {
      min-height: 200px;
    }
  }
`;
