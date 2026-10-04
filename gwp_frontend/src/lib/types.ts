export const CATEGORIES = ['Top', 'Bottom', 'Outerwear', 'Shoes', 'Accessory'] as const
export type Category = (typeof CATEGORIES)[number]

export type WardrobeItemData = {
	id: string
	name: string
	category: Category
	imageUrl: string
	notes?: string
}

export type ItemCategory = 'top' | 'bottom' | 'outerwear' | 'shoes' | 'accessory'

export type ItemCreate = {
	image_ref: string
	name?: string | null
	notes?: string | null
}

export type ItemMetadata = {
	category: ItemCategory
	primary_color: string
	secondary_color: string | null
	description: string
}

export type ItemRecord = ItemMetadata & {
	item_id: string
	image_ref: string
	image_url: string | null
	name: string | null
	notes: string | null
	is_favorite: boolean
	created_at: string
}

export type OutfitCreate = {
	name?: string | null
	item_ids?: string[]
}

export type OutfitRecord = {
	outfit_id: string
	name: string | null
	items: ItemRecord[]
	overall_rating: number | null
	is_favorite: boolean
	created_at: string
}
