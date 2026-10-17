-- Rename canonical Ivoire Market and attach a few example subcategories
-- to existing live products. Does not change prices, stock, or active flags.

update public.categories
set name = 'Ivoire Market'
where slug = 'ivoire-market'
  and parent_id is null
  and name is distinct from 'Ivoire Market';

insert into public.categories (name, slug, parent_id, is_active, sort_order)
select v.name, v.slug, parent.id, true, v.sort_order
from (
  values
    ('Creams & Lotions', 'cosmetics-creams-lotions', 'cosmetics', 1),
    ('Body Oils', 'cosmetics-body-oils', 'cosmetics', 2),
    ('Fufu & Flours', 'foods-fufu-flours', 'foods', 1),
    ('Rice & Grains', 'foods-rice-grains', 'foods', 2),
    ('Seasonings', 'foods-seasonings', 'foods', 3),
    ('Frozen & Fresh', 'ivoire-market-frozen-fresh', 'ivoire-market', 1),
    ('Dairy', 'ivoire-market-dairy', 'ivoire-market', 2)
) as v(name, slug, parent_slug, sort_order)
join public.categories as parent
  on parent.slug = v.parent_slug
 and parent.parent_id is null
where not exists (
  select 1 from public.categories existing where existing.slug = v.slug
);

update public.products as product
set subcategory_id = child.id
from public.categories as child
join public.categories as parent on parent.id = child.parent_id
where product.category_id = parent.id
  and product.is_active = true
  and product.subcategory_id is null
  and (
    (child.slug = 'cosmetics-creams-lotions' and product.name in (
      'Francoise Bedon Royal Cream',
      'Francoise Bedon Royal Lait Eclaircissant 500ML'
    ))
    or (child.slug = 'cosmetics-body-oils' and product.name in (
      'Haloderm Body Oil'
    ))
    or (child.slug = 'foods-fufu-flours' and product.name in (
      'Golden Tropics Cocoyam Fufu 680G',
      'Golden Tropics Plantain Fufu 680G',
      'Oloye Oat Fufu',
      'Tropiway Plantain Fufu 700G',
      'Jube S Corn Flour',
      'Graceco Foods Guinea Corn Powder 500G'
    ))
    or (child.slug = 'foods-rice-grains' and product.name in (
      'Member S Jasmine Rice 50LB',
      'Par Excellence Premium Long Grain Rice',
      'Ziyad Medhm Couscous',
      'Ziyad Prmium Vermicelli'
    ))
    or (child.slug = 'foods-seasonings' and product.name in (
      'Binc Food Suya Powser',
      'Valido Fried Rice Seasoning 312G',
      'Valido Moi Moi Seasoning',
      'Valido Smoked Sweet Paprika 184G',
      'Ocho Rios Ground Cinnamon 3 25OZ',
      'Nayass Africa Locust Beans'
    ))
    or (child.slug = 'ivoire-market-frozen-fresh' and product.name in (
      'Frozen Cassava Leaves',
      E'Cow Feet\u2019s'
    ))
    or (child.slug = 'ivoire-market-dairy' and product.name in (
      'Peak milk'
    ))
  );
