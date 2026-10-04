import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WardrobeItem from '../components/WardrobeItem'
import { supabase } from '../lib/supabase'
import {
  CATEGORIES,
  type Category,
  type ItemCategory,
  type ItemCreate,
  type ItemRecord,
  type ItemUploadRequest,
  type ItemUploadResponse,
  type WardrobeItemData,
} from '../lib/types'

const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter']
const DRESS_CODES = ['Casual', 'Smart Casual', 'Business', 'Formal', 'Athletic']
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
const STORAGE_BUCKET = 'closet-items'
const SUPPORTED_IMAGE_TYPES: ItemUploadRequest['content_type'][] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

const pickRandom = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

const toWardrobeItem = (item: ItemRecord): WardrobeItemData => ({
  id: item.item_id,
  name: item.name ?? item.description,
  category: (item.category.charAt(0).toUpperCase() + item.category.slice(1)) as Category,
  imageUrl: item.image_url ?? '',
  description: item.description,
  primaryColor: item.primary_color,
  secondaryColor: item.secondary_color,
  notes: item.notes ?? '',
})

export default function Wardrobe() {
  const navigate = useNavigate()
  const [items, setItems] = useState<WardrobeItemData[]>([])
  const [showAdd, setShowAdd] = useState(false)

  // add-piece form state
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('Top')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [itemsError, setItemsError] = useState<string | null>(null)

  // outfit generator state
  const [season, setSeason] = useState(SEASONS[0])
  const [dressCode, setDressCode] = useState(DRESS_CODES[0])
  const [outfit, setOutfit] = useState<WardrobeItemData[] | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadItems = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/closet/items`)
        if (!response.ok) throw new Error('Could not load closet items.')
        const result = (await response.json()) as { data: ItemRecord[] }
        if (!cancelled) setItems(result.data.map(toWardrobeItem))
      } catch (error) {
        if (!cancelled) {
          setItemsError(error instanceof Error ? error.message : 'Could not load closet items.')
        }
      }
    }

    void loadItems()
    return () => {
      cancelled = true
    }
  }, [])

  const addPiece = async () => {
    if (!file || !name.trim() || isSaving) return

    setIsSaving(true)
    setUploadError(null)

    try {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type as ItemUploadRequest['content_type'])) {
        throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
      }
      if (!supabase) {
        throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the frontend environment.')
      }

      const uploadRequest: ItemUploadRequest = {
        content_type: file.type as ItemUploadRequest['content_type'],
      }
      const uploadUrlResponse = await fetch(`${API_BASE_URL}/api/closet/items/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadRequest),
      })
      if (!uploadUrlResponse.ok) {
        const body = await uploadUrlResponse.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Could not prepare the image upload.')
      }

      const upload = (await uploadUrlResponse.json()) as ItemUploadResponse
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(upload.image_ref, upload.token, file, { contentType: file.type })
      if (storageError) throw storageError

      const itemResponse = await fetch(`${API_BASE_URL}/api/closet/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_ref: upload.image_ref,
          name: name.trim(),
          notes: notes.trim(),
          category: category.toLowerCase() as ItemCategory,
        } satisfies ItemCreate),
      })
      if (!itemResponse.ok) {
        const body = await itemResponse.json().catch(() => null)
        throw new Error(
          typeof body?.detail === 'string'
            ? body.detail
            : 'The image uploaded, but the item could not be created.',
        )
      }

      const createdItem = (await itemResponse.json()) as ItemRecord
      const wardrobeItem = toWardrobeItem(createdItem)
      if (!wardrobeItem.imageUrl) wardrobeItem.imageUrl = URL.createObjectURL(file)
      setItems((previous) => [wardrobeItem, ...previous])
      setName('')
      setNotes('')
      setFile(null)
      setShowAdd(false)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not add this item.')
    } finally {
      setIsSaving(false)
    }
  }

  const updatePiece = (updated: WardrobeItemData) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    setOutfit((prev) => prev && prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  const removePiece = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setOutfit((prev) => prev && prev.filter((i) => i.id !== id))
  }

  // Placeholder logic: one random piece per category, outerwear only for Fall/Winter.
  const generateOutfit = () => {
    const wanted: Category[] = ['Top', 'Bottom', 'Shoes']
    if (season === 'Fall' || season === 'Winter') wanted.push('Outerwear')

    const result = wanted
      .map((cat) => {
        const pool = items.filter((i) => i.category === cat)
        return pool.length ? pickRandom(pool) : null
      })
      .filter((i): i is WardrobeItemData => i !== null)

    setOutfit(result)
  }

  return (
    <div className="wardrobe-page">
      <header className="w-header">
        <button className="w-btn" onClick={() => navigate('/')}>← Back</button>
        <h1>Wardrobe</h1>
        <button className="w-btn" onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? 'Cancel' : '+ Add Piece'}
        </button>
      </header>

      {itemsError && <p role="alert">{itemsError}</p>}

      {showAdd && (
        <div className="add-panel">
          <input
            placeholder="Name (e.g. Cerulean sweater)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="w-btn" onClick={addPiece} disabled={!file || !name.trim() || isSaving}>
            {isSaving ? 'Uploading...' : 'Save'}
          </button>
          {uploadError && <p role="alert">{uploadError}</p>}
        </div>
      )}

      <section className="generator">
        <label>
          Season
          <select value={season} onChange={(e) => setSeason(e.target.value)}>
            {SEASONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Dress code
          <select value={dressCode} onChange={(e) => setDressCode(e.target.value)}>
            {DRESS_CODES.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <button className="w-btn primary" onClick={generateOutfit} disabled={items.length === 0}>
          Generate Outfit
        </button>
      </section>

      {outfit && (
        <section>
          <h2>{season} · {dressCode}</h2>
          {outfit.length === 0 ? (
            <p className="empty">Add a few more pieces to build an outfit.</p>
          ) : (
            // read-only: no onUpdate / onRemove
            <div className="grid">{outfit.map((i) => <WardrobeItem key={i.id} item={i} />)}</div>
          )}
        </section>
      )}

      <section>
        <h2>All Pieces ({items.length})</h2>
        {items.length === 0 ? (
          <p className="empty">Your wardrobe is empty. Add your first piece.</p>
        ) : (
          <div className="grid">
            {items.map((i) => (
              <WardrobeItem key={i.id} item={i} onUpdate={updatePiece} onRemove={removePiece} />
            ))}
          </div>
        )}
      </section>

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,500;0,700;0,900;1,400&display=swap');

  .wardrobe-page {
    --runway-black: #0a0a0a;
    --runway-red: #c8102e;
    --cerulean: #1f78b4;
    min-height: 100vh;
    padding: 20px 4vw 60px;
    background: #fafafa;
    color: var(--runway-black);
    font-family: 'Bodoni Moda', Didot, 'Times New Roman', serif;
  }

  .w-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px double var(--runway-black);
    padding-bottom: 10px;
    margin-bottom: 20px;
  }
  .w-header h1 { margin: 0; font-size: 56px; font-weight: 900; }

  .w-btn {
    background: var(--runway-black);
    color: var(--cerulean);
    border: 4px solid var(--cerulean);
    border-radius: 10px;
    padding: 8px 18px;
    font-family: inherit;
    font-size: 18px;
    cursor: pointer;
  }
  .w-btn.primary { color: var(--runway-red); border-color: var(--runway-red); }
  .w-btn:hover:not(:disabled) { background: linear-gradient(to left, var(--runway-red), var(--cerulean)); color: white; }
  .w-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .add-panel, .generator {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 14px;
    padding: 16px;
    margin-bottom: 24px;
    border: 3px solid var(--runway-black);
    border-radius: 10px;
  }
  .generator label { display: flex; flex-direction: column; font-style: italic; gap: 4px; }

  .wardrobe-page input, .wardrobe-page select {
    font-family: inherit;
    font-size: 16px;
    padding: 6px 8px;
    border: 2px solid var(--runway-black);
    border-radius: 6px;
    background: white;
  }

  .wardrobe-page h2 { font-size: 28px; font-weight: 900; margin: 24px 0 12px; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 16px;
    align-items: start;
  }

  .empty { font-style: italic; }
`