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

  // draft copy so Cancel can throw changes away
  const [draft, setDraft] = useState({
    name: item.name,
    category: item.category,
    notes: item.notes ?? '',
  })

  const startEdit = () => {
    setDraft({ name: item.name, category: item.category, notes: item.notes ?? '' })
    setEditing(true)
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
    <div className="w-item">
      <img src={item.imageUrl} alt={item.name} />

      {editing ? (
        <div className="w-item-body">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Name"
          />
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Notes (brand, fit, where it works...)"
            rows={3}
          />
          <div className="w-item-actions">
            <button onClick={save} disabled={!draft.name.trim()}>Save</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="w-item-body">
          <strong>{item.name}</strong>
          <span className="w-item-category">{item.category}</span>
          {item.notes && <p className="w-item-notes">{item.notes}</p>}

          {(onUpdate || onRemove) && (
            <div className="w-item-actions">
              {onUpdate && <button onClick={startEdit}>Edit</button>}
              {onRemove &&
                (confirmingDelete ? (
                  <>
                    <button className="danger" onClick={() => onRemove(item.id)}>Confirm</button>
                    <button onClick={() => setConfirmingDelete(false)}>Keep</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmingDelete(true)}>Delete</button>
                ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .w-item {
          border: 3px solid #0a0a0a;
          border-radius: 10px;
          overflow: hidden;
          background: #fff;
          display: flex;
          flex-direction: column;
        }
        .w-item img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; display: block; }
        .w-item-body { display: flex; flex-direction: column; gap: 6px; padding: 10px; }
        .w-item-category { font-style: italic; font-size: 14px; }
        .w-item-notes { margin: 0; font-size: 14px; white-space: pre-wrap; }
        .w-item-body input, .w-item-body select, .w-item-body textarea {
          font-family: inherit;
          font-size: 14px;
          padding: 5px 7px;
          border: 2px solid #0a0a0a;
          border-radius: 6px;
          resize: vertical;
        }
        .w-item-actions { display: flex; gap: 8px; margin-top: 4px; }
        .w-item-actions button {
          flex: 1;
          font-family: inherit;
          font-size: 14px;
          padding: 4px 8px;
          border: 2px solid #1f78b4;
          border-radius: 8px;
          background: #0a0a0a;
          color: #1f78b4;
          cursor: pointer;
        }
        .w-item-actions button.danger { border-color: #c8102e; color: #c8102e; }
        .w-item-actions button:disabled { opacity: 0.4; cursor: not-allowed; }
        .w-item-actions button:hover:not(:disabled) { background: #1f78b4; color: #fff; }
        .w-item-actions button.danger:hover { background: #c8102e; }
      `}</style>
    </div>
  )
}