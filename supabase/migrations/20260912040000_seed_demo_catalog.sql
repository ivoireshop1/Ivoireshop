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

with demo_products (name, slug, description, short_description, price, compare_at_price, category_name, stock_quantity, is_featured, image_url) as (
  values
    ('Premium Jasmine Rice', 'premium-jasmine-rice', 'Fragrant, long-grain jasmine rice with a soft texture and delicate aroma for everyday family meals.', 'Fragrant long-grain rice.', 18.99::numeric, 22.99::numeric, 'Rice & Grains', 40, true, '/demo-products/premium-jasmine-rice.jpg'),
    ('Fresh Plantains', 'fresh-plantains', 'A versatile kitchen staple, perfect for frying, baking, boiling, or serving alongside your favorite dishes.', 'A versatile everyday staple.', 4.99::numeric, null::numeric, 'Fresh Produce', 30, true, '/demo-products/plantain.svg'),
    ('Red Palm Oil', 'red-palm-oil', 'Rich, aromatic red palm oil that adds depth and color to soups, stews, and traditional recipes.', 'Rich and aromatic cooking oil.', 12.99::numeric, null::numeric, 'Oils & Cooking', 25, true, '/demo-products/oil.svg'),
    ('Cassava Flour', 'cassava-flour', 'Smooth, naturally gluten-free cassava flour for baking, thickening sauces, and classic African recipes.', 'Smooth, naturally gluten-free flour.', 8.99::numeric, null::numeric, 'African Foods', 20, false, '/demo-products/flour.svg'),
    ('Suya Spice Blend', 'suya-spice-blend', 'A warm, balanced blend of roasted peanuts and aromatic spices for grilled meats, vegetables, and more.', 'Warm spices for grilling.', 6.99::numeric, null::numeric, 'Spices & Seasoning', 35, true, '/demo-products/spices.svg'),
    ('Hibiscus Drink', 'hibiscus-drink', 'Bright, refreshing hibiscus drink with a gently tart finish, ready to enjoy chilled.', 'Bright and refreshing.', 3.99::numeric, null::numeric, 'Drinks', 48, false, '/demo-products/drink.svg'),
    ('Plantain Chips', 'plantain-chips', 'Lightly salted, crisp plantain chips with a satisfying crunch for snacking anytime.', 'Crisp, lightly salted crunch.', 3.49::numeric, null::numeric, 'Snacks', 50, false, '/demo-products/chips.svg')
),
upserted_products as (
  insert into public.products (name, slug, description, short_description, price, compare_at_price, category_id, stock_quantity, is_active, is_featured)
  select demo.name, demo.slug, demo.description, demo.short_description, demo.price, demo.compare_at_price, categories.id, demo.stock_quantity, true, demo.is_featured
  from demo_products demo
  join public.categories on categories.name = demo.category_name
  on conflict (slug) do update
  set
    name = excluded.name,
    description = excluded.description,
    short_description = excluded.short_description,
    price = excluded.price,
    compare_at_price = excluded.compare_at_price,
    category_id = excluded.category_id,
    stock_quantity = excluded.stock_quantity,
    is_active = true,
    is_featured = excluded.is_featured
  returning id, slug
)
insert into public.product_images (product_id, image_url, alt_text, position)
select products.id, demo.image_url, demo.name, 0
from demo_products demo
join upserted_products products on products.slug = demo.slug
where not exists (
  select 1
  from public.product_images images
  where images.product_id = products.id
    and images.image_url = demo.image_url
);