import { useState } from "react";
import LiveCapture from "./LiveCapture";

type AddPieceProps = {
  isSaving: boolean;
  onAdd: (data: {
    file: File;
    name?: string;
    notes?: string;
    category: string;
  }) => Promise<void>;
};

const CATEGORIES = [
  "top",
  "bottom",
  "shorts",
  "shoes",
  "outerwear",
  "accessory",
];

export default function AddPiece({
  isSaving,
  onAdd,
}: AddPieceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("shirt");
  const [preview, setPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      setPreview(null);
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      return;
    }

    setFile(selectedFile);

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);
  };

  const handleCapture = (capturedFile: File) => {
    handleFileChange(capturedFile);
    setShowCamera(false);
  };

  const handleSubmit = async () => {
    if (!file || isSaving || !name) return; // for now, require a name for the piece

    await onAdd({
      file,
      name: name.trim() || undefined,
      notes: notes.trim() || undefined,
      category,
    });

    setFile(null);
    setName("");
    setNotes("");
    setCategory("shirt");
    setPreview(null);
  };

  if (showCamera) {
    return (
      <section className="panel add-panel">
        <LiveCapture
          onCapture={handleCapture}
          onBack={() => setShowCamera(false)}
        />
      </section>
    );
  }

  return (
    <section className="panel add-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">New addition</span>
          <h2>Add a piece</h2>
        </div>

        <p>
          Upload a photo or take one with your camera.
        </p>
      </div>

      <div className="add-piece-layout">
        <div className="photo-options">
          <label className="upload-box">
            {preview ? (
              <div className="upload-preview">
                <img
                  src={preview}
                  alt="Selected clothing item"
                />

                <div className="upload-overlay">
                  <span>Change photo</span>
                </div>
              </div>
            ) : (
              <div className="upload-empty">
                <span className="upload-icon">+</span>

                <strong>Upload a photo</strong>

                <span className="upload-hint">
                  PNG, JPG, JPEG or WEBP
                </span>
              </div>
            )}

            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) =>
                handleFileChange(
                  e.target.files?.[0] ?? null
                )
              }
              hidden
            />
          </label>

          <div className="camera-option">
            <span className="camera-option-label">
              Prefer to use your camera?
            </span>

            <button
              type="button"
              className="camera-button"
              onClick={() => setShowCamera(true)}
            >
              <span className="camera-icon">📷</span>
              Take a photo
            </button>
          </div>
        </div>

        <div className="add-fields">
          <label className="field">
            <span>Name</span>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blue Oxford Shirt"
            />
          </label>

          <label className="field">
            <span>Category</span>

            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value)
              }
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0).toUpperCase() +
                    item.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="field field-full">
            <span>Notes</span>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you'd like to remember about this piece..."
              rows={4}
            />
          </label>
        </div>
      </div>

      <div className="add-panel-footer">
        <span className="required-note">
          * Only the photo is required
        </span>

        <button
          className="primary-button add-wardrobe-button"
          onClick={handleSubmit}
          disabled={!file || isSaving}
        >
          {isSaving ? (
            "Adding..."
          ) : (
            <>
              <span>+</span>
              Add to wardrobe
            </>
          )}
        </button>
      </div>

      <style>{`
        .add-panel {
          width: min(850px, calc(100% - 32px));
          margin: 0 auto;
          box-sizing: border-box;
        }
          
        .photo-options {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .upload-box {
          width: 100%;
          min-height: 260px;
          box-sizing: border-box;
        }

        .upload-empty {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .upload-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px;
          border: 1px solid #d8d8d8;
          border-radius: 50%;
          color: #555;
          font-size: 25px;
          font-weight: 300;
        }

        .upload-empty strong {
          font-size: 15px;
          font-weight: 600;
          color: #222;
        }

        .upload-hint {
          color: #999;
          font-size: 12px;
        }

        .camera-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px 10px 14px;
          border: 1px solid #e5e5e5;
          border-radius: 10px;
          background: #fafafa;
        }

        .camera-option-label {
          color: #777;
          font-size: 12px;
        }

        .camera-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 12px;
          border: 1px solid #d5d5d5;
          border-radius: 7px;
          background: #fff;
          color: #222;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background 0.15s ease,
            border-color 0.15s ease;
        }

        .camera-button:hover {
          background: #f3f3f3;
          border-color: #c5c5c5;
        }

        .camera-icon {
          font-size: 14px;
        }

        .upload-preview {
          position: relative;
          width: 100%;
          height: 260px;
          overflow: hidden;
          border-radius: inherit;
        }

        .upload-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .upload-overlay {
          position: absolute;
          inset: auto 0 0;
          padding: 12px;
          text-align: center;
          background: linear-gradient(
            transparent,
            rgba(0, 0, 0, 0.65)
          );
          color: #fff;
          font-size: 13px;
        }

        .add-panel-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #ededed;
        }

        .required-note {
          color: #999;
          font-size: 12px;
        }

        .add-wardrobe-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 170px;
          padding: 12px 18px;
          border: 0;
          border-radius: 8px;
          background: #111;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.15s ease,
            transform 0.15s ease,
            opacity 0.15s ease;
        }

        .add-wardrobe-button:hover:not(:disabled) {
          background: #2a2a2a;
          transform: translateY(-1px);
        }

        .add-wardrobe-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .add-wardrobe-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .add-wardrobe-button span {
          font-size: 18px;
          font-weight: 400;
          line-height: 1;
        }
      `}</style>
    </section>
  );
}