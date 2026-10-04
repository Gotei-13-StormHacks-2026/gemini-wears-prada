create table if not exists public.items (
    item_id uuid primary key default gen_random_uuid(),
    image_ref text not null unique,
    name text,
    category text not null check (category in ('top', 'bottom', 'outerwear', 'shoes', 'accessory')),
    primary_color text not null,
    secondary_color text,
    description text not null,
    notes text,
    is_favorite boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists public.outfits (
    outfit_id uuid primary key default gen_random_uuid(),
    name text,
    overall_rating smallint check (overall_rating between 0 and 10),
    is_favorite boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists public.outfit_items (
    outfit_id uuid not null references public.outfits(outfit_id) on delete cascade,
    item_id uuid not null references public.items(item_id) on delete cascade,
    primary key (outfit_id, item_id)
);

create index if not exists outfit_items_item_id_idx
    on public.outfit_items(item_id);

alter table public.items enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;

insert into storage.buckets (id, name, public)
values ('closet-items', 'closet-items', false)
on conflict (id) do update set public = false;