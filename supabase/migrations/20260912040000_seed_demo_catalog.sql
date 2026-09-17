insert into public.categories (name, slug, description, is_active)
values
  ('Rice & Grains', 'rice-grains', 'Everyday grains and pantry staples.', true),
  ('African Foods', 'african-foods', 'Authentic African pantry favorites.', true),
  ('Fresh Produce', 'fresh-produce', 'Fresh kitchen staples.', true),
  ('Oils & Cooking', 'oils-cooking', 'Cooking oils and essentials.', true),
  ('Spices & Seasoning', 'spices-seasoning', 'Flavorful spices for every meal.', true),
  ('Drinks', 'drinks', 'Refreshing drinks and beverages.', true),
  ('Snacks', 'snacks', 'Everyday snacks and treats.', true)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true;