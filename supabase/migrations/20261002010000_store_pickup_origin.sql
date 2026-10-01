-- Official Ivoire Shop store pickup / shipping origin.
-- Does not rewrite historical order snapshots.

update public.store_settings
set
  origin_name = 'Ivoire Shop',
  origin_address_line_1 = '1210 Rockbridge Rd NW',
  origin_address_line_2 = 'Unit L',
  origin_city = 'Norcross',
  origin_state = 'GA',
  origin_postal_code = '30093',
  origin_country = 'US',
  pickup_enabled = true,
  pickup_show_at_checkout = true,
  updated_at = timezone('utc', now())
where id = 'default';
