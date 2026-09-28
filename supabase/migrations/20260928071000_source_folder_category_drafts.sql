-- Source-folder category integrity.
-- Foods / Cosmetics / Ivoire Market are assigned from the image folder, not guessed from the product name.
-- Existing products are remapped by image URL. Missing Ivoire Market images become drafts.
-- Does not invent price or quantity, does not activate products, does not overwrite approved live prices.

update public.products p
set
  category_id = c.id,
  needs_category_review = false
from public.product_images i
join public.categories c on c.slug = 'cosmetics'
where i.product_id = p.id
  and (
    i.image_url ilike '%Comestics%'
    or i.image_url ilike '%/Cosmetics%'
    or i.image_url ilike '%Cosmetics%2012-22-25%'
  );

update public.products p
set
  category_id = c.id,
  needs_category_review = false
from public.product_images i
join public.categories c on c.slug = 'ivoire-market'
where i.product_id = p.id
  and i.image_url ilike '%Ivoire%Market%';

update public.products p
set
  category_id = c.id,
  needs_category_review = false
from public.product_images i
join public.categories c on c.slug = 'foods'
where i.product_id = p.id
  and i.image_url ilike '%Foods%2012-22-25%'
  and i.image_url not ilike '%Comestics%'
  and i.image_url not ilike '%/Cosmetics%'
  and i.image_url not ilike '%Ivoire%Market%';

with source_products (name, slug, image_url) as (
  values
    ('My project (3)', 'src-458af398e928-my-project-3', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-(3).jpg'),
    ('My project 1 2022 12 18T161113.782', 'src-da544b4f3506-my-project-1-2022-12-18t161113-782', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T161113.782.jpg'),
    ('My project 1 2022 12 18T161307.971', 'src-a722aee86c5c-my-project-1-2022-12-18t161307-971', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T161307.971.jpg'),
    ('My project 1 2022 12 18T162703.245', 'src-d00aa11d7161-my-project-1-2022-12-18t162703-245', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T162703.245.jpg'),
    ('My project 1 2022 12 18T163838.779', 'src-165a54f018d9-my-project-1-2022-12-18t163838-779', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T163838.779.jpg'),
    ('My project 1 2022 12 18T164242.160', 'src-f27dcb7caf58-my-project-1-2022-12-18t164242-160', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T164242.160.jpg'),
    ('My project 1 2022 12 18T164435.095', 'src-2dab5d84eca7-my-project-1-2022-12-18t164435-095', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T164435.095.jpg'),
    ('My project 1 2022 12 18T164553.800', 'src-392d41120db9-my-project-1-2022-12-18t164553-800', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T164553.800.jpg'),
    ('My project 1 2022 12 18T164702.534', 'src-54db2d2c6d3d-my-project-1-2022-12-18t164702-534', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T164702.534.jpg'),
    ('My project 1 2022 12 18T164902.663', 'src-64650acef6cb-my-project-1-2022-12-18t164902-663', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T164902.663.jpg'),
    ('My project 1 2022 12 18T165033.216', 'src-a5b917e87548-my-project-1-2022-12-18t165033-216', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T165033.216.jpg'),
    ('My project 1 2022 12 18T165417.296', 'src-309dc46f45e0-my-project-1-2022-12-18t165417-296', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20-%202022-12-18T165417.296.jpg'),
    ('My project 1 (1)', 'src-95c8df0bb376-my-project-1-1', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(1).jpg'),
    ('My project 1 (10)', 'src-4a4b598f8a27-my-project-1-10', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(10).jpg'),
    ('My project 1 (100)', 'src-a8da394560be-my-project-1-100', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(100).jpg'),
    ('My project 1 (101)', 'src-39fa5d1f3dea-my-project-1-101', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(101).jpg'),
    ('My project 1 (102)', 'src-53ab61ebd438-my-project-1-102', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(102).jpg'),
    ('My project 1 (103)', 'src-ab16447ab086-my-project-1-103', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(103).jpg'),
    ('My project 1 (104)', 'src-aebc21961fb3-my-project-1-104', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(104).jpg'),
    ('My project 1 (105)', 'src-cf10c41223b4-my-project-1-105', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(105).jpg'),
    ('My project 1 (106)', 'src-d9ed51d8fa23-my-project-1-106', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(106).jpg'),
    ('My project 1 (107)', 'src-c1c699e18cfa-my-project-1-107', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(107).jpg'),
    ('My project 1 (108)', 'src-d0e72383d0de-my-project-1-108', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(108).jpg'),
    ('My project 1 (109)', 'src-b20e47d8f01c-my-project-1-109', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(109).jpg'),
    ('My project 1 (11)', 'src-80ccc703ba89-my-project-1-11', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(11).jpg'),
    ('My project 1 (110)', 'src-70ba0fd5419d-my-project-1-110', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(110).jpg'),
    ('My project 1 (111)', 'src-ae8ffe856b2e-my-project-1-111', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(111).jpg'),
    ('My project 1 (112)', 'src-2a032c0810ba-my-project-1-112', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(112).jpg'),
    ('My project 1 (113)', 'src-73cd04d17036-my-project-1-113', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(113).jpg'),
    ('My project 1 (114)', 'src-93674b73b6e6-my-project-1-114', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(114).jpg'),
    ('My project 1 (115)', 'src-e810fe0772c4-my-project-1-115', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(115).jpg'),
    ('My project 1 (116)', 'src-7c61117c7946-my-project-1-116', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(116).jpg'),
    ('My project 1 (117)', 'src-52a4b9047c27-my-project-1-117', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(117).jpg'),
    ('My project 1 (118)', 'src-48cfec363884-my-project-1-118', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(118).jpg'),
    ('My project 1 (119)', 'src-dc293a94fe90-my-project-1-119', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(119).jpg'),
    ('My project 1 (12)', 'src-f661039de163-my-project-1-12', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(12).jpg'),
    ('My project 1 (120)', 'src-2e4f4008629d-my-project-1-120', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(120).jpg'),
    ('My project 1 (121)', 'src-707c120c12e6-my-project-1-121', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(121).jpg'),
    ('My project 1 (122)', 'src-c0b0f14345e6-my-project-1-122', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(122).jpg'),
    ('My project 1 (123)', 'src-baba85335c3e-my-project-1-123', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(123).jpg'),
    ('My project 1 (124)', 'src-883ec892e151-my-project-1-124', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(124).jpg'),
    ('My project 1 (125)', 'src-110503c37768-my-project-1-125', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(125).jpg'),
    ('My project 1 (126)', 'src-409ca602a11f-my-project-1-126', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(126).jpg'),
    ('My project 1 (127)', 'src-11633c9600d4-my-project-1-127', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(127).jpg'),
    ('My project 1 (128)', 'src-51eb68fa716d-my-project-1-128', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(128).jpg'),
    ('My project 1 (129)', 'src-3a667e69d1c1-my-project-1-129', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(129).jpg'),
    ('My project 1 (13)', 'src-92c73820ac00-my-project-1-13', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(13).jpg'),
    ('My project 1 (130)', 'src-dca5eff7fb61-my-project-1-130', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(130).jpg'),
    ('My project 1 (131)', 'src-796ae6667d11-my-project-1-131', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(131).jpg'),
    ('My project 1 (132)', 'src-ff9538fb79fe-my-project-1-132', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(132).jpg'),
    ('My project 1 (133)', 'src-15ea070b86c5-my-project-1-133', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(133).jpg'),
    ('My project 1 (134)', 'src-7ec472cdd6a4-my-project-1-134', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(134).jpg'),
    ('My project 1 (135)', 'src-478cae8633b5-my-project-1-135', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(135).jpg'),
    ('My project 1 (136)', 'src-6162ccfffd3d-my-project-1-136', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(136).jpg'),
    ('My project 1 (137)', 'src-522b6a25b422-my-project-1-137', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(137).jpg'),
    ('My project 1 (138)', 'src-1ad062e56f4a-my-project-1-138', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(138).jpg'),
    ('My project 1 (139)', 'src-4fd01ddb731d-my-project-1-139', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(139).jpg'),
    ('My project 1 (14)', 'src-ac377cfa96c8-my-project-1-14', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(14).jpg'),
    ('My project 1 (140)', 'src-07b48edba674-my-project-1-140', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(140).jpg'),
    ('My project 1 (141)', 'src-53efa0fe5bfb-my-project-1-141', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(141).jpg'),
    ('My project 1 (142)', 'src-5727e4c5433a-my-project-1-142', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(142).jpg'),
    ('My project 1 (143)', 'src-80bf16e4d871-my-project-1-143', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(143).jpg'),
    ('My project 1 (144)', 'src-54f2dd0a1748-my-project-1-144', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(144).jpg'),
    ('My project 1 (145)', 'src-e062a96ceb1d-my-project-1-145', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(145).jpg'),
    ('My project 1 (146)', 'src-ddf210c5f985-my-project-1-146', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(146).jpg'),
    ('My project 1 (147)', 'src-88c1cc3c3f17-my-project-1-147', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(147).jpg'),
    ('My project 1 (148)', 'src-25d05f1e9c88-my-project-1-148', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(148).jpg'),
    ('My project 1 (149)', 'src-345ae7aa6776-my-project-1-149', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(149).jpg'),
    ('My project 1 (15)', 'src-6aa52d1aad81-my-project-1-15', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(15).jpg'),
    ('My project 1 (150)', 'src-bce461ab0e3a-my-project-1-150', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(150).jpg'),
    ('My project 1 (151)', 'src-a96ca6e98e98-my-project-1-151', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(151).jpg'),
    ('My project 1 (152)', 'src-693143e67d00-my-project-1-152', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(152).jpg'),
    ('My project 1 (153)', 'src-4e98eb07b00a-my-project-1-153', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(153).jpg'),
    ('My project 1 (154)', 'src-77f75b67cfd3-my-project-1-154', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(154).jpg'),
    ('My project 1 (16)', 'src-65b003321853-my-project-1-16', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(16).jpg'),
    ('My project 1 (17)', 'src-b9751bbbc294-my-project-1-17', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(17).jpg'),
    ('My project 1 (18)', 'src-2979858f837e-my-project-1-18', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(18).jpg'),
    ('My project 1 (19)', 'src-644e1e1d3358-my-project-1-19', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(19).jpg'),
    ('My project 1 (2)', 'src-f7ab1d890739-my-project-1-2', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(2).jpg'),
    ('My project 1 (20)', 'src-3660db5461d5-my-project-1-20', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(20).jpg'),
    ('My project 1 (21)', 'src-285a9deb36f4-my-project-1-21', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(21).jpg'),
    ('My project 1 (22)', 'src-09f45e713d09-my-project-1-22', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(22).jpg'),
    ('My project 1 (23)', 'src-87b9b8449dd5-my-project-1-23', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(23).jpg'),
    ('My project 1 (24)', 'src-fab0d21648bc-my-project-1-24', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(24).jpg'),
    ('My project 1 (25)', 'src-679d82afa525-my-project-1-25', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(25).jpg'),
    ('My project 1 (26)', 'src-8564ffe9cdfb-my-project-1-26', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(26).jpg'),
    ('My project 1 (27)', 'src-315f68c25ef2-my-project-1-27', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(27).jpg'),
    ('My project 1 (28)', 'src-65c7b3071e80-my-project-1-28', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(28).jpg'),
    ('My project 1 (29)', 'src-6833498b1147-my-project-1-29', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(29).jpg'),
    ('My project 1 (3)', 'src-3a026adbbb32-my-project-1-3', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(3).jpg'),
    ('My project 1 (30)', 'src-081f9b0e8b04-my-project-1-30', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(30).jpg'),
    ('My project 1 (31)', 'src-1fda1bd30690-my-project-1-31', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(31).jpg'),
    ('My project 1 (32)', 'src-cc5ea5c719a5-my-project-1-32', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(32).jpg'),
    ('My project 1 (33)', 'src-766d695f06cf-my-project-1-33', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(33).jpg'),
    ('My project 1 (34)', 'src-3867f0d56431-my-project-1-34', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(34).jpg'),
    ('My project 1 (35)', 'src-89ba3931f00f-my-project-1-35', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(35).jpg'),
    ('My project 1 (36)', 'src-892afbd0a72f-my-project-1-36', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(36).jpg'),
    ('My project 1 (37)', 'src-0009a4518377-my-project-1-37', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(37).jpg'),
    ('My project 1 (38)', 'src-3128ab0b7520-my-project-1-38', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(38).jpg'),
    ('My project 1 (39)', 'src-6118b95e5e15-my-project-1-39', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(39).jpg'),
    ('My project 1 (4)', 'src-02857b3aa75c-my-project-1-4', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(4).jpg'),
    ('My project 1 (40)', 'src-1ee56e43a1bb-my-project-1-40', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(40).jpg'),
    ('My project 1 (41)', 'src-1dea0ced84b7-my-project-1-41', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(41).jpg'),
    ('My project 1 (42)', 'src-636a77447499-my-project-1-42', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(42).jpg'),
    ('My project 1 (43)', 'src-16f3f5aa39ba-my-project-1-43', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(43).jpg'),
    ('My project 1 (44)', 'src-a89882e01e42-my-project-1-44', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(44).jpg'),
    ('My project 1 (45)', 'src-429f28d50352-my-project-1-45', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(45).jpg'),
    ('My project 1 (46)', 'src-85c3b633e3bb-my-project-1-46', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(46).jpg'),
    ('My project 1 (47)', 'src-81b1c12971b0-my-project-1-47', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(47).jpg'),
    ('My project 1 (48)', 'src-fe3bcacd1351-my-project-1-48', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(48).jpg'),
    ('My project 1 (49)', 'src-d77a7b0e8d3f-my-project-1-49', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(49).jpg'),
    ('My project 1 (5)', 'src-adad792a5420-my-project-1-5', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(5).jpg'),
    ('My project 1 (50)', 'src-443ceb25ae00-my-project-1-50', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(50).jpg'),
    ('My project 1 (51)', 'src-81d13e82ef9f-my-project-1-51', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(51).jpg'),
    ('My project 1 (52)', 'src-4ad33a626766-my-project-1-52', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(52).jpg'),
    ('My project 1 (53)', 'src-75f5f3f82e95-my-project-1-53', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(53).jpg'),
    ('My project 1 (54)', 'src-5d113248cf11-my-project-1-54', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(54).jpg'),
    ('My project 1 (55)', 'src-1ec5df77b906-my-project-1-55', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(55).jpg'),
    ('My project 1 (56)', 'src-8baf2583da54-my-project-1-56', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(56).jpg'),
    ('My project 1 (57)', 'src-744e7d8c1d72-my-project-1-57', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(57).jpg'),
    ('My project 1 (58)', 'src-d2ec9027c16e-my-project-1-58', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(58).jpg'),
    ('My project 1 (59)', 'src-7ad7d46246de-my-project-1-59', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(59).jpg'),
    ('My project 1 (6)', 'src-c363cb37f4c3-my-project-1-6', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(6).jpg'),
    ('My project 1 (60)', 'src-1cd4b9ae11a5-my-project-1-60', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(60).jpg'),
    ('My project 1 (61)', 'src-1a376bad9b38-my-project-1-61', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(61).jpg'),
    ('My project 1 (62)', 'src-a21f002d2e72-my-project-1-62', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(62).jpg'),
    ('My project 1 (63)', 'src-50691a1ffe44-my-project-1-63', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(63).jpg'),
    ('My project 1 (64)', 'src-f45ec860f805-my-project-1-64', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(64).jpg'),
    ('My project 1 (65)', 'src-17b0b35fcf84-my-project-1-65', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(65).jpg'),
    ('My project 1 (66)', 'src-125b6c6a60bf-my-project-1-66', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(66).jpg'),
    ('My project 1 (67)', 'src-ed6309569da7-my-project-1-67', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(67).jpg'),
    ('My project 1 (68)', 'src-1fff74947810-my-project-1-68', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(68).jpg'),
    ('My project 1 (69)', 'src-4b8522e6933c-my-project-1-69', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(69).jpg'),
    ('My project 1 (7)', 'src-55c5cde60099-my-project-1-7', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(7).jpg'),
    ('My project 1 (70)', 'src-4f3e4687bc75-my-project-1-70', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(70).jpg'),
    ('My project 1 (71)', 'src-158fe3a2d097-my-project-1-71', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(71).jpg'),
    ('My project 1 (72)', 'src-3dc2f4378f1d-my-project-1-72', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(72).jpg'),
    ('My project 1 (73)', 'src-f1b390102fd6-my-project-1-73', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(73).jpg'),
    ('My project 1 (74)', 'src-e22bd186f936-my-project-1-74', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(74).jpg'),
    ('My project 1 (75)', 'src-1cd3aa1eda5d-my-project-1-75', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(75).jpg'),
    ('My project 1 (76)', 'src-4a3f2d6582d8-my-project-1-76', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(76).jpg'),
    ('My project 1 (77)', 'src-ecef3afafefc-my-project-1-77', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(77).jpg'),
    ('My project 1 (78)', 'src-fe52d14bdf09-my-project-1-78', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(78).jpg'),
    ('My project 1 (8)', 'src-9a28dee356e9-my-project-1-8', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(8).jpg'),
    ('My project 1 (80)', 'src-8aaaae95fc89-my-project-1-80', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(80).jpg'),
    ('My project 1 (81)', 'src-95ac7a1bfb77-my-project-1-81', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(81).jpg'),
    ('My project 1 (82)', 'src-1fc33ba8a743-my-project-1-82', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(82).jpg'),
    ('My project 1 (83)', 'src-e8aae0c3daec-my-project-1-83', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(83).jpg'),
    ('My project 1 (84)', 'src-96ff1790eef3-my-project-1-84', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(84).jpg'),
    ('My project 1 (85)', 'src-297b68dcb772-my-project-1-85', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(85).jpg'),
    ('My project 1 (86)', 'src-5877a89310c2-my-project-1-86', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(86).jpg'),
    ('My project 1 (87)', 'src-1c89994c0aad-my-project-1-87', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(87).jpg'),
    ('My project 1 (88)', 'src-1c3816b69d24-my-project-1-88', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(88).jpg'),
    ('My project 1 (89)', 'src-01e78f3f6310-my-project-1-89', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(89).jpg'),
    ('My project 1 (9)', 'src-d6e1d5ec273b-my-project-1-9', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(9).jpg'),
    ('My project 1 (90)', 'src-c5f62254ba31-my-project-1-90', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(90).jpg'),
    ('My project 1 (91)', 'src-88b69f53c961-my-project-1-91', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(91).jpg'),
    ('My project 1 (92)', 'src-c63c1de09709-my-project-1-92', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(92).jpg'),
    ('My project 1 (93)', 'src-9b073dfca75f-my-project-1-93', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(93).jpg'),
    ('My project 1 (94)', 'src-9fa7f5307b3e-my-project-1-94', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(94).jpg'),
    ('My project 1 (95)', 'src-a796ed332e7b-my-project-1-95', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(95).jpg'),
    ('My project 1 (96)', 'src-c54bd0412f3b-my-project-1-96', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(96).jpg'),
    ('My project 1 (97)', 'src-cbf8d1cda6d9-my-project-1-97', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(97).jpg'),
    ('My project 1 (98)', 'src-040f5529f0f0-my-project-1-98', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(98).jpg'),
    ('My project 1 (99)', 'src-abfe2961759f-my-project-1-99', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(99).jpg'),
    ('My project 1', 'src-e32a0b083c12-my-project-1', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20.jpg'),
    ('My project 1', 'src-d8310b33a217-my-project-1', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1.jpg'),
    ('My project 10)', 'src-616b010cd282-my-project-10', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-10).jpg'),
    ('P1034773', 'src-e3d797ae81e3-p1034773', '/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/P1034773.JPG')
),
inserted as (
  insert into public.products (
    name,
    slug,
    description,
    price,
    stock_quantity,
    category_id,
    sku,
    is_active,
    is_featured,
    needs_pricing,
    track_inventory,
    needs_category_review
  )
  select
    source_products.name,
    source_products.slug,
    null,
    null,
    null,
    categories.id,
    null,
    false,
    false,
    true,
    false,
    false
  from source_products
  join public.categories on categories.slug = 'ivoire-market'
  where not exists (
    select 1 from public.product_images where product_images.image_url = source_products.image_url
  )
  and not exists (
    select 1 from public.products where products.slug = source_products.slug
  )
  on conflict (slug) do nothing
  returning id, slug
)
insert into public.product_images (product_id, image_url, alt_text, position)
select inserted.id, source_products.image_url, source_products.name, 0
from inserted
join source_products on source_products.slug = inserted.slug
where not exists (
  select 1 from public.product_images where product_images.product_id = inserted.id
);
