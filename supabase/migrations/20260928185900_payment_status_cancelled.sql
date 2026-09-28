-- Add cancelled to the existing payment lifecycle without altering historical totals.
alter type public.payment_status add value if not exists 'cancelled';
