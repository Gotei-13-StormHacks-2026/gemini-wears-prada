import { useState } from 'react'
import { CATEGORIES, type Category, type WardrobeItemData } from '../lib/types'

type Props = {
  item: WardrobeItemData
  onUpdate?: (item: WardrobeItemData) => void
  onRemove?: (id: string) => void
}

export default function WardrobeItem({ item, onUpdate, onRemove }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [draft, setDraft] = useState({
    name: item.name,
    category: item.category,
    notes: item.notes ?? '',
  })

  const startEdit = () => {
    setDraft({
      name: item.name,
      category: item.category,
      notes: item.notes ?? '',
    })
    setConfirmingDelete(false)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setConfirmingDelete(false)
  }

  const save = () => {
    if (!draft.name.trim()) return

    onUpdate?.({
      ...item,
      name: draft.name.trim(),
      category: draft.category,
      notes: draft.notes.trim(),
    })

    setEditing(false)
  }

  return (
    <article className="wardrobe-card">
      {/* Image */}
      <div className="wardrobe-image-wrap">
        <img
          src={item.imageUrl}
          alt={item.name || 'Wardrobe item'}
          className="wardrobe-image"
        />

        {/* Category tag */}
        {item.category && (
          <span className="category-badge">
            {item.category}
          </span>
        )}
      </div>

      {/* Editing */}
      {editing ? (
        <div className="wardrobe-content">
          <div className="field">
            <label htmlFor={`name-${item.id}`}>Name</label>
            <input
              id={`name-${item.id}`}
              value={draft.name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  name: e.target.value,
                })
              }
              placeholder="e.g. Blue plaid shirt"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor={`category-${item.id}`}>Category</label>
            <select
              id={`category-${item.id}`}
              value={draft.category}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  category: e.target.value as Category,
                })
              }
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor={`notes-${item.id}`}>Notes</label>
            <textarea
              id={`notes-${item.id}`}
              value={draft.notes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  notes: e.target.value,
                })
              }
              placeholder="Brand, fit, where it works..."
              rows={3}
            />
          </div>

          <div className="card-actions">
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={!draft.name.trim()}
            >
              Save changes
            </button>

            <button
              className="btn btn-secondary"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="wardrobe-content">
          <div className="item-heading">
            <h3>{item.name || 'Unnamed item'}</h3>
          </div>

          {item.description && (
            <p className="item-description">
              {item.description}
            </p>
          )}

          {(item.primaryColor || item.secondaryColor) && (
            <div className="color-row">
              <span className="label">Colors</span>

              <div className="color-list">
                {[item.primaryColor, item.secondaryColor]
                  .filter(Boolean)
                  .map((color, index) => (
                    <span
                      className="color-pill"
                      key={`${color}-${index}`}
                    >
                      {color}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {item.notes && (
            <div className="notes">
              <span className="notes-label">Notes</span>
              <p>{item.notes}</p>
            </div>
          )}

          {(onUpdate || onRemove) && (
            <div className="card-actions">
              {onUpdate && (
                <button
                  className="btn btn-secondary"
                  onClick={startEdit}
                >
                  Edit
                </button>
              )}

              {onRemove &&
                (confirmingDelete ? (
                  <>
                    <button
                      className="btn btn-danger"
                      onClick={() => onRemove(item.id)}
                    >
                      Delete
                    </button>

                    <button
                      className="btn btn-secondary"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-ghost-danger"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .wardrobe-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .wardrobe-card:hover {
          transform: translateY(-3px);
          border-color: #d1d5db;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.1);
        }

        /*
         * Image area
         *
         * The garment is contained instead of cropped so the
         * entire sticker/cut-out remains visible.
         */
        .wardrobe-image-wrap {
          position: relative;
          display: grid;
          place-items: center;
          width: 100%;
          aspect-ratio: 3 / 4;
          background: #f3f4f6;
          overflow: hidden;
        }

        .wardrobe-image {
          display: block;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          padding: 16px;
          object-fit: contain;

          /*
           * Gives transparent clothing cut-outs a subtle
           * sticker-like white edge and shadow.
           */
          filter:
            drop-shadow(2px 0 0 #ffffff)
            drop-shadow(-2px 0 0 #ffffff)
            drop-shadow(0 2px 0 #ffffff)
            drop-shadow(0 -2px 0 #ffffff)
            drop-shadow(0 6px 8px rgba(0, 0, 0, 0.18));

          transition: transform 0.35s ease;
        }

        .wardrobe-card:hover .wardrobe-image {
          transform: scale(1.025);
        }

        /*
         * Category sits directly over the image in the
         * top-left corner.
         */
        .category-badge {
          position: absolute;
          top: 12px;
          left: 12px;

          padding: 5px 10px;
          border-radius: 7px;

          background: rgba(17, 24, 39, 0.92);
          color: #ffffff;

          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: capitalize;

          backdrop-filter: blur(8px);
        }

        .wardrobe-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
        }

        .item-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .item-heading h3 {
          margin: 0;
          color: #111827;
          font-size: 18px;
          line-height: 1.25;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .item-description {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
          line-height: 1.55;

          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
          line-clamp: 3;
          overflow: hidden;
        }

        .color-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: wrap;
        }

        .label,
        .notes-label {
          color: #9ca3af;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .color-list {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .color-pill {
          padding: 4px 9px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .notes {
          padding: 10px 12px;
          border-radius: 10px;
          background: #f9fafb;
        }

        .notes p {
          margin: 4px 0 0;
          color: #4b5563;
          font-size: 13px;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field label {
          color: #374151;
          font-size: 12px;
          font-weight: 700;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 9px 11px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #ffffff;
          color: #111827;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .field textarea {
          resize: vertical;
          min-height: 76px;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }

        .card-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .btn {
          flex: 1;
          border: 1px solid transparent;
          border-radius: 9px;
          padding: 8px 12px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;

          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            transform 0.1s ease;
        }

        .btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #111827;
          color: #ffffff;
        }

        .btn-primary:hover:not(:disabled) {
          background: #000000;
        }

        .btn-secondary {
          background: #ffffff;
          color: #374151;
          border-color: #d1d5db;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .btn-ghost-danger {
          background: transparent;
          color: #dc2626;
          border-color: transparent;
        }

        .btn-ghost-danger:hover:not(:disabled) {
          background: #fef2f2;
          color: #b91c1c;
        }

        .btn-danger {
          background: #dc2626;
          color: #ffffff;
        }

        .btn-danger:hover:not(:disabled) {
          background: #b91c1c;
        }

        @media (max-width: 480px) {
          .wardrobe-content {
            padding: 14px;
          }

          .card-actions {
            flex-wrap: wrap;
          }

          .btn {
            min-width: 100px;
          }
        }
      `}</style>
    </article>
  )
}

