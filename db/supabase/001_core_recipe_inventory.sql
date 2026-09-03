-- Mise & Meal: initial Supabase schema for recipes and inventory.
--
-- Assumptions:
--   * Supabase Auth is the source of users; no public.users table is needed.
--   * The browser must have an authenticated session before user-owned data is
--     readable or writable. Signed-out requests intentionally receive no rows.
--   * Ingredients form a shared reference catalogue. Authenticated users may
--     read and add names, but may not update or delete shared ingredient rows.
--   * The current UI models one inventory row per ingredient per user.
--   * Quantities are stored in their entered unit; unit conversion is deferred.

create extension if not exists pgcrypto;

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  image_url text,
  cuisine text,
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  total_minutes integer check (total_minutes is null or total_minutes >= 0),
  prep_minutes integer check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes integer check (cook_minutes is null or cook_minutes >= 0),
  difficulty text,
  servings numeric not null default 1 check (servings > 0),
  instructions jsonb not null default '[]'::jsonb check (jsonb_typeof(instructions) = 'array'),
  rating numeric check (rating is null or rating between 0 and 5),
  notes text,
  source text,
  source_url text,
  emoji text not null default '🍽️',
  background_color text not null default '#dce8df',
  last_cooked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (length(trim(canonical_name)) > 0),
  category text not null default 'Other',
  aliases jsonb not null default '[]'::jsonb check (jsonb_typeof(aliases) = 'array'),
  created_at timestamptz not null default now()
);

-- Ingredient names are shared and case-insensitively unique.
create unique index ingredients_canonical_name_unique
  on public.ingredients (lower(trim(canonical_name)));

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null check (length(trim(unit)) > 0),
  preparation_note text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (recipe_id, ingredient_id),
  unique (recipe_id, sort_order)
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null check (length(trim(unit)) > 0),
  storage_location text not null check (length(trim(storage_location)) > 0),
  low_stock_threshold numeric not null default 0 check (low_stock_threshold >= 0),
  expires_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ingredient_id)
);

create index recipes_user_id_idx on public.recipes(user_id);
create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients(recipe_id);
create index recipe_ingredients_ingredient_id_idx on public.recipe_ingredients(ingredient_id);
create index inventory_user_id_idx on public.inventory(user_id);
create index inventory_ingredient_id_idx on public.inventory(ingredient_id);

alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.inventory enable row level security;

-- Revoke broad defaults, then grant only the operations used by the browser.
revoke all on table public.recipes from anon, authenticated;
revoke all on table public.ingredients from anon, authenticated;
revoke all on table public.recipe_ingredients from anon, authenticated;
revoke all on table public.inventory from anon, authenticated;

grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert on public.ingredients to authenticated;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;
grant select, insert, update, delete on public.inventory to authenticated;

create policy "Users can read their own recipes"
  on public.recipes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own recipes"
  on public.recipes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own recipes"
  on public.recipes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own recipes"
  on public.recipes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Authenticated users can read ingredients"
  on public.ingredients for select
  to authenticated
  using (true);

create policy "Authenticated users can add ingredients"
  on public.ingredients for insert
  to authenticated
  with check ((select auth.uid()) is not null);

create policy "Users can read ingredients on their own recipes"
  on public.recipe_ingredients for select
  to authenticated
  using (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and recipes.user_id = (select auth.uid())
    )
  );

create policy "Users can add ingredients to their own recipes"
  on public.recipe_ingredients for insert
  to authenticated
  with check (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and recipes.user_id = (select auth.uid())
    )
  );

create policy "Users can update ingredients on their own recipes"
  on public.recipe_ingredients for update
  to authenticated
  using (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and recipes.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and recipes.user_id = (select auth.uid())
    )
  );

create policy "Users can delete ingredients from their own recipes"
  on public.recipe_ingredients for delete
  to authenticated
  using (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and recipes.user_id = (select auth.uid())
    )
  );

create policy "Users can read their own inventory"
  on public.inventory for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own inventory"
  on public.inventory for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own inventory"
  on public.inventory for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own inventory"
  on public.inventory for delete
  to authenticated
  using ((select auth.uid()) = user_id);
