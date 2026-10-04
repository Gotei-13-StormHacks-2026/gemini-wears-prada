import { useState } from "react";

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
  "shirt",
  "pants",
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

  const handleSubmit = async () => {
    if (!file || isSaving) return;

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

  return (
    <section className="panel add-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">New addition</span>
          <h2>Add a piece</h2>
        </div>

        <p>
          Upload a photo and we'll take care of the rest.
        </p>
      </div>

      <div className="add-piece-layout">
        <label className="upload-box">
          {preview ? (
            <div className="upload-preview">
              <img src={preview} alt="Selected clothing item" />

              <div className="upload-overlay">
                <span>Change photo</span>
              </div>
            </div>
          ) : (
            <div className="upload-empty">
              <span className="upload-icon">+</span>
              <strong>Upload a photo</strong>
              <span>PNG, JPG, JPEG or WEBP</span>
            </div>
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={(e) =>
              handleFileChange(e.target.files?.[0] ?? null)
            }
            hidden
          />
        </label>

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
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
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
          className="primary-button"
          onClick={handleSubmit}
          disabled={!file || isSaving}
        >
          {isSaving ? "Adding..." : "Add to wardrobe"}
        </button>
      </div>
    </section>
  );
}