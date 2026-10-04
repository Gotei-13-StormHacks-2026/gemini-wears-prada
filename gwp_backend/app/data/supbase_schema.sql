create table if not exists items (
  item_id         uuid primary key,
  image_ref       text not null,
  name            text,
  notes           text,
  category        text not null check (category in ('top','bottom','outerwear','shoes','accessory')),
  primary_color   text not null,
  secondary_color text,
  description     text not null,
  is_favorite     boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists outfits (
  outfit_id      uuid primary key default gen_random_uuid(),
  name           text,
  overall_rating smallint check (overall_rating between 0 and 10),
  is_favorite    boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists outfit_items (
  outfit_id uuid not null references outfits(outfit_id) on delete cascade,
  item_id   uuid not null references items(item_id)     on delete cascade,
  position  smallint not null,
  primary key (outfit_id, item_id)
);

create index if not exists outfit_items_item_idx on outfit_items(item_id);

-- Storage: create a public bucket named to match SUPABASE_STORAGE_BUCKET