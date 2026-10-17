# Stripe setup for Ivoire Shop

Live card charges stay locked until the founder explicitly approves activation. Do not set live keys or `STRIPE_LIVE_PAYMENTS_ENABLED=true` until that approval.

Production storefront: `https://ivoire-shop-five.vercel.app`

## 1. Obtain Stripe test API keys

1. Sign in at [https://dashboard.stripe.com](https://dashboard.stripe.com).
2. Complete Stripe account verification if Stripe still shows it as pending.
3. Turn **Test mode** on (toggle in the Stripe Dashboard).
4. Open **Developers → API keys**.
5. Copy the **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`).
6. Never paste these values into chat, git, or the browser console.

## 2. Exact Vercel environment variable names

Add these in Vercel → Project → Settings → Environment Variables for **Production** (and Preview if you test there). Secret values are server-only except the publishable key.

| Name | Where it is used | Example shape (do not use these values) |
| --- | --- | --- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser Payment Element | `pk_test_...` |
| `STRIPE_SECRET_KEY` | Server PaymentIntent create/update | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Server webhook signature check | `whsec_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only order payment recording | Supabase `service_role` secret |
| `STRIPE_LIVE_PAYMENTS_ENABLED` | Live lock | Leave **unset**. Only `true` after founder approval. |

Do not commit values. Do not add `sk_live_` / `pk_live_` keys until live activation is approved.

Redeploy after changing environment variables so the server process picks them up.

## 3. Configure the webhook destination

1. Stripe Dashboard → **Developers → Webhooks**.
2. Stay in **Test mode**.
3. Add an endpoint pointing at the production URL below.
4. After creating the endpoint, open it and copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET`.

## 4. Webhook URL

```
https://ivoire-shop-five.vercel.app/api/payments/stripe/webhook
```

Repository route: `app/api/payments/stripe/webhook/route.ts`

## 5. Required Stripe events

Subscribe at least:

- `payment_intent.succeeded` — only this (plus amount match) marks an order **paid**
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`

Optional (logged, does not mark paid): `charge.dispute.created`

Reaching `/order/confirm/...` does **not** mark an order paid. Only a verified webhook (or equivalent server-side Stripe confirmation) can.

## 6. How to test a payment

1. Confirm Admin → Payments shows Stripe **Test Mode readiness: Ready** and Demo Payment as you intend (disable Demo Payment if you want the card form).
2. Place a **test-mode** checkout on the storefront.
3. Use a Stripe test card such as `4242 4242 4242 4242`, any future expiry, any CVC, any US ZIP.
4. Confirm the order stays **pending** until the webhook succeeds, then becomes **paid**.
5. Do not use a real card. Do not enable live mode for this test.

If Stripe keys are missing, card checkout is hidden and this test is **not verified**.

## 7. Verify the order in Admin

1. Admin → **Orders**: the order number, payment status, and Stripe payment id.
2. Admin → **Payments**: successful / pending / failed lists, webhook last success, and **Real Stripe paid (net)** (demo orders are excluded).
3. Customer account / guest confirmation: paid status only after webhook confirmation.

## 8. What still requires the client / Stripe account

- Finish Stripe account verification (currently pending on the client account).
- Create test (then later live) API keys in the Stripe Dashboard.
- Add the three Stripe variables plus `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production.
- Create the webhook endpoint and signing secret.
- Founder approval before any live keys or `STRIPE_LIVE_PAYMENTS_ENABLED=true`.

## 9. Switch to live credentials after approval

1. Founder approval in writing.
2. Stripe Dashboard: turn **Test mode** off, copy **live** publishable and secret keys.
3. Create a **live** webhook to the same URL; copy the live signing secret.
4. In Vercel Production, replace:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET` → live `whsec_...`
5. Set `STRIPE_LIVE_PAYMENTS_ENABLED=true` **only after** keys and webhook are in place.
6. Redeploy Production.
7. Place one real $1 (or similarly small) live test only if the founder authorizes it.

Until step 5, live keys on the server still **cannot collect**. Checkout will report that live charges are locked.

## 10. Disable live payments quickly

Any one of these stops live charges:

1. In Vercel, delete or set `STRIPE_LIVE_PAYMENTS_ENABLED` to anything other than `true`, then redeploy.
2. Remove `STRIPE_SECRET_KEY` (and optionally the publishable key), then redeploy.
3. In Stripe Dashboard, disable or delete the live webhook and/or roll the secret key.

Demo Payment can be toggled independently in Admin → Payments. It never charges a card and never counts as paid revenue.
