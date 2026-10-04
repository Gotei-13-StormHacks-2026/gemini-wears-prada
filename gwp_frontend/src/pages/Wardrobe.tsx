
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WardrobeItem from '../components/WardrobeItem'
import AddPiece from '../components/AddPiece'
import { supabase } from '../lib/supabase'
import {
  // CATEGORIES,
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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

const STORAGE_BUCKET = 'closet-items'

const SUPPORTED_IMAGE_TYPES: ItemUploadRequest['content_type'][] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

const pickRandom = <T,>(arr: T[]) =>
  arr[Math.floor(Math.random() * arr.length)]

const toWardrobeItem = (item: ItemRecord): WardrobeItemData => ({
  id: item.item_id,
  name: item.name,
  category: (
    item.category.charAt(0).toUpperCase() + item.category.slice(1)
  ) as Category,
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

  // Add-piece form
  const [isSaving, setIsSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [itemsError, setItemsError] = useState<string | null>(null)

  // Outfit generator
  const [season, setSeason] = useState(SEASONS[0])
  const [dressCode, setDressCode] = useState(DRESS_CODES[0])
  const [outfit, setOutfit] = useState<WardrobeItemData[] | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadItems = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/closet/items`)

        if (!response.ok) {
          throw new Error('Could not load closet items.')
        }

        const result = (await response.json()) as {
          data: ItemRecord[]
        }

        if (!cancelled) {
          setItems(result.data.map(toWardrobeItem))
        }
      } catch (error) {
        if (!cancelled) {
          setItemsError(
            error instanceof Error
              ? error.message
              : 'Could not load closet items.',
          )
        }
      }
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [])

  const addPiece = async (data: {
    file: File
    name?: string
    notes?: string
    category?: string
  }) => {
    if (isSaving) return

    setIsSaving(true)
    setUploadError(null)

    try {
      const { file, name, notes, category } = data

      if (
        !SUPPORTED_IMAGE_TYPES.includes(
          file.type as ItemUploadRequest['content_type'],
        )
      ) {
        throw new Error(
          'Choose a JPEG, PNG, WebP, or GIF image.',
        )
      }

      if (!supabase) {
        throw new Error(
          'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the frontend environment.',
        )
      }

      // 1. Ask the backend for a signed upload URL.
      const uploadRequest: ItemUploadRequest = {
        content_type:
          file.type as ItemUploadRequest['content_type'],
      }

      const uploadUrlResponse = await fetch(
        `${API_BASE_URL}/api/closet/items/upload-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(uploadRequest),
        },
      )

      if (!uploadUrlResponse.ok) {
        const body = await uploadUrlResponse
          .json()
          .catch(() => null)

        throw new Error(
          typeof body?.detail === 'string'
            ? body.detail
            : 'Could not prepare the image upload.',
        )
      }

      const upload =
        (await uploadUrlResponse.json()) as ItemUploadResponse

      // 2. Upload the actual image to Supabase Storage.
      const { error: storageError } =
        await supabase.storage
          .from(STORAGE_BUCKET)
          .uploadToSignedUrl(
            upload.image_ref,
            upload.token,
            file,
            {
              contentType: file.type,
            },
          )

      if (storageError) {
        throw storageError
      }

      // 3. Tell the backend to create the wardrobe item.
      const itemResponse = await fetch(
        `${API_BASE_URL}/api/closet/items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_ref: upload.image_ref,
            name: name || undefined,
            notes: notes || undefined,
            category: category ? category.toLowerCase() as ItemCategory : undefined,
          } satisfies ItemCreate),
        },
      )

      if (!itemResponse.ok) {
        const body = await itemResponse
          .json()
          .catch(() => null)

        if (itemResponse.status === 502 || itemResponse.status === 503) {
          throw new Error(
            'The AI model is currently experiencing high demand. Please try again later.',
          )
        }

        throw new Error(
          typeof body?.detail === 'string'
            ? body.detail
            : 'The image uploaded, but the item could not be created.',
        )
      }

      // 4. Add the newly-created item to the UI.
      const createdItem =
        (await itemResponse.json()) as ItemRecord

      const wardrobeItem = toWardrobeItem(createdItem)

      if (!wardrobeItem.imageUrl) {
        wardrobeItem.imageUrl =
          URL.createObjectURL(file)
      }

      setItems((previous) => [
        wardrobeItem,
        ...previous,
      ])

      setShowAdd(false)
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Could not add this item.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const updatePiece = (updated: WardrobeItemData) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    )

    setOutfit(
      (prev) =>
        prev &&
        prev.map((item) =>
          item.id === updated.id ? updated : item,
        ),
    )
  }

  const removePiece = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    setOutfit(
      (prev) => prev && prev.filter((item) => item.id !== id),
    )
  }

  // Placeholder outfit logic.
  const generateOutfit = () => {
    const wanted: Category[] = ['Top', 'Bottom', 'Shoes']

    if (season === 'Fall' || season === 'Winter') {
      wanted.push('Outerwear')
    }

    const result = wanted
      .map((cat) => {
        const pool = items.filter((item) => item.category === cat)
        return pool.length ? pickRandom(pool) : null
      })
      .filter(
        (item): item is WardrobeItemData => item !== null,
      )

    setOutfit(result)
  }

  return (
    <div className="wardrobe-page">
      <header className="wardrobe-header">
        <button
          className="header-button"
          onClick={() => navigate('/')}
        >
          ← Back
        </button>

        <div className="header-title">
          <span className="eyebrow">MY CLOSET</span>
          <h1>Wardrobe</h1>
        </div>

        <button
          className={`header-button add-button ${showAdd ? 'active' : ''
            }`}
          onClick={() => setShowAdd((value) => !value)}
        >
          {showAdd ? 'Cancel' : '+ Add Piece'}
        </button>
      </header>

      {itemsError && (
        <div className="error-banner" role="alert">
          {itemsError}
        </div>
      )}

      {/* Add item */}
      {showAdd && (
        <>
          <AddPiece isSaving={isSaving} onAdd={addPiece}/>

          {uploadError && (
            <div className="error-message" role="alert">
              {uploadError}
            </div>
          )}
        </>
      )}

      {/* Outfit generator */}
      <section className="panel generator-panel">
        <div className="generator-copy">
          <span className="panel-eyebrow">OUTFIT BUILDER</span>
          <h2>What are we wearing?</h2>
          <p>
            Pick a season and dress code to generate a look
            from your wardrobe.
          </p>
        </div>

        <div className="generator-controls">
          <label className="field">
            <span>Season</span>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            >
              {SEASONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Dress code</span>
            <select
              value={dressCode}
              onChange={(e) => setDressCode(e.target.value)}
            >
              {DRESS_CODES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>

          <button
            className="primary-button generate-button"
            onClick={generateOutfit}
            disabled={items.length === 0}
          >
            Generate Outfit →
          </button>
        </div>
      </section>

      {/* Generated outfit */}
      {outfit && (
        <section className="wardrobe-section">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">YOUR LOOK</span>
              <h2>
                {season}
                <span> · </span>
                {dressCode}
              </h2>
            </div>
          </div>

          {outfit.length === 0 ? (
            <p className="empty">
              Add a few more pieces to build an outfit.
            </p>
          ) : (
            <div className="grid">
              {outfit.map((item) => (
                <WardrobeItem
                  key={item.id}
                  item={item}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* All wardrobe pieces */}
      <section className="wardrobe-section">
        <div className="section-heading">
          <div>
            <span className="section-eyebrow">COLLECTION</span>
            <h2>Your Wardrobe</h2>
          </div>

          <span className="item-count">
            {items.length} {items.length === 1 ? 'piece' : 'pieces'}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">+</div>
            <h3>Your wardrobe is empty</h3>
            <p>Add your first piece to get started.</p>
            <button
              className="primary-button"
              onClick={() => setShowAdd(true)}
            >
              Add First Piece
            </button>
          </div>
        ) : (
          <div className="grid">
            {items.map((item) => (
              <WardrobeItem
                key={item.id}
                item={item}
                onUpdate={updatePiece}
                onRemove={removePiece}
              />
            ))}
          </div>
        )}
      </section>

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,500;0,700;0,900;1,400&family=Inter:wght@400;500;600;700&display=swap');

  .wardrobe-page {
    --black: #111111;
    --red: #c8102e;
    --blue: #1f78b4;
    --gray-50: #fafafa;
    --gray-100: #f3f4f6;
    --gray-200: #e5e7eb;
    --gray-400: #9ca3af;
    --gray-500: #6b7280;
    --gray-700: #374151;

    min-height: 100vh;
    padding: 24px 4vw 70px;
    background: #fafafa;
    color: var(--black);
    font-family: Inter, Arial, sans-serif;
  }

  /* HEADER */

  .wardrobe-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 20px;
    padding-bottom: 18px;
    margin-bottom: 28px;
    border-bottom: 3px double var(--black);
  }

  .header-title {
    text-align: center;
  }

  .header-title h1 {
    margin: 2px 0 0;
    font-family: 'Bodoni Moda', Didot, 'Times New Roman', serif;
    font-size: clamp(42px, 5vw, 64px);
    line-height: 0.95;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .eyebrow,
  .panel-eyebrow,
  .section-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    color: var(--gray-500);
  }

  .header-button {
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

  .header-button:hover {
    background: var(--black);
    color: white;
  }

  .add-button {
    justify-self: end;
  }

  .add-button.active {
    background: var(--black);
    color: white;
  }

  /* PANELS */

  .panel {
    margin-bottom: 30px;
    padding: 22px;
    border: 1px solid var(--gray-200);
    border-radius: 18px;
    background: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .panel-heading h2,
  .generator-copy h2 {
    margin: 4px 0 5px;
    font-family: 'Bodoni Moda', Didot, 'Times New Roman', serif;
    font-size: 27px;
    line-height: 1.1;
  }

  .panel-heading p,
  .generator-copy p {
    margin: 0;
    color: var(--gray-500);
    font-size: 13px;
    line-height: 1.5;
  }

  /* ADD FORM */

  .add-form {
    display: grid;
    grid-template-columns: minmax(180px, 0.75fr) 1.25fr;
    gap: 18px;
    margin-top: 20px;
  }

  .upload-box {
    min-height: 210px;
    padding: 24px;
    border: 2px dashed #cfd3d8;
    border-radius: 14px;
    background: #fafafa;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    cursor: pointer;
    transition: 0.15s ease;
  }

  .upload-box:hover {
    border-color: var(--blue);
    background: #f7fbfe;
  }

  .upload-box input {
    display: none;
  }

  .upload-icon {
    width: 44px;
    height: 44px;
    margin-bottom: 10px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--black);
    color: white;
    font-size: 24px;
    font-weight: 300;
  }

  .upload-title {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 14px;
    font-weight: 700;
  }

  .upload-subtitle {
    margin-top: 5px;
    color: var(--gray-400);
    font-size: 11px;
  }

  .optional-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 13px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field span {
    font-size: 11px;
    font-weight: 700;
    color: var(--gray-700);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .field em {
    color: var(--gray-400);
    font-size: 9px;
    font-style: normal;
    font-weight: 500;
    text-transform: lowercase;
  }

  .field input,
  .field select,
  .field textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 11px;
    border: 1px solid #d1d5db;
    border-radius: 9px;
    background: white;
    color: var(--black);
    font: inherit;
    font-size: 13px;
    outline: none;
    transition: 0.15s ease;
  }

  .field textarea {
    resize: vertical;
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: var(--blue);
    box-shadow: 0 0 0 3px rgba(31, 120, 180, 0.1);
  }

  .field-full {
    grid-column: 1 / -1;
  }

  .panel-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--gray-200);
  }

  .required-note {
    color: var(--gray-400);
    font-size: 11px;
  }

  /* BUTTONS */

  .primary-button {
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

  .primary-button:hover:not(:disabled) {
    background: var(--blue);
    border-color: var(--blue);
  }

  .primary-button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* GENERATOR */

  .generator-panel {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 30px;
  }

  .generator-controls {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }

  .generator-controls .field {
    min-width: 145px;
  }

  .generate-button {
    white-space: nowrap;
  }

  /* SECTIONS */

  .wardrobe-section {
    margin-top: 42px;
  }

  .section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--gray-200);
  }

  .section-heading h2 {
    margin: 3px 0 0;
    font-family: 'Bodoni Moda', Didot, 'Times New Roman', serif;
    font-size: 30px;
    line-height: 1;
  }

  .section-heading h2 span {
    color: var(--gray-400);
  }

  .item-count {
    color: var(--gray-500);
    font-size: 12px;
    font-weight: 600;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(
      auto-fill,
      minmax(210px, 1fr)
    );
    gap: 18px;
    align-items: start;
  }

  /* EMPTY STATE */

  .empty-state {
    padding: 55px 20px;
    border: 1px dashed #d1d5db;
    border-radius: 16px;
    background: white;
    text-align: center;
  }

  .empty-icon {
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

  .empty-state h3 {
    margin: 0;
    font-family: 'Bodoni Moda', Didot, serif;
    font-size: 22px;
  }

  .empty-state p {
    margin: 5px 0 18px;
    color: var(--gray-500);
    font-size: 13px;
  }

  .empty {
    color: var(--gray-500);
    font-size: 13px;
    font-style: italic;
  }

  /* ERRORS */

  .error-banner,
  .error-message {
    padding: 10px 13px;
    border-radius: 9px;
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
    font-size: 12px;
  }

  .error-banner {
    margin-bottom: 20px;
  }

  .error-message {
    margin-top: 12px;
  }

  /* RESPONSIVE */

  @media (max-width: 800px) {
    .wardrobe-header {
      grid-template-columns: 1fr 1fr;
    }

    .header-title {
      grid-column: 1 / -1;
      grid-row: 1;
    }

    .header-button {
      grid-row: 2;
    }

    .add-button {
      justify-self: end;
    }

    .add-form,
    .generator-panel {
      grid-template-columns: 1fr;
    }

    .generator-controls {
      flex-wrap: wrap;
    }
  }

  @media (max-width: 560px) {
    .wardrobe-page {
      padding: 16px 14px 50px;
    }

    .add-form {
      grid-template-columns: 1fr;
    }

    .optional-fields {
      grid-template-columns: 1fr;
    }

    .field-full {
      grid-column: auto;
    }

    .panel-footer {
      align-items: stretch;
      flex-direction: column;
    }

    .generator-controls {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .generate-button {
      grid-column: 1 / -1;
    }

    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
  }

  @media (max-width: 380px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
`

