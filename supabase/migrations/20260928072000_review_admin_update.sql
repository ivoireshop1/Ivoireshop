-- Admin publish/hide uses a normal update. RLS still allows that only for is_admin().
-- Customers have no update policy, so this grant does not let them edit reviews.
grant update on table public.product_reviews to authenticated;
