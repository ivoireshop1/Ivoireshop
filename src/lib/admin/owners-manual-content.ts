export type ManualStatus = "ready" | "awaiting_config" | "locked";

export type ManualPage = {
  id: string;
  chapter: string;
  title: string;
  kicker?: string;
  status?: ManualStatus;
  body: string[];
  steps?: string[];
  tips?: string[];
  links?: { label: string; href: string }[];
  figure?: { src: string; alt: string; caption: string };
  kind?: "cover" | "credits" | "toc" | "chapter";
};

export const MANUAL_STATUS_LABEL: Record<ManualStatus, string> = {
  ready: "Operational guidance",
  awaiting_config: "Needs setup before full use",
  locked: "Locked until you approve activation",
};

export const OWNERS_MANUAL_PAGES: ManualPage[] = [
  {
    id: "cover",
    kind: "cover",
    chapter: "Cover",
    title: "Ivoire Shop Owner's Playbook",
    kicker: "BADGER GHOST",
    body: [
      "Your guide to running Ivoire Shop day to day.",
      "Storefront: https://ivoireshop-steel.vercel.app",
      "Built and supported by BADGER GHOST.",
      "Chapters follow the same Admin menu and storefront your customers use.",
    ],
  },
  {
    id: "credits",
    kind: "credits",
    chapter: "Credits",
    title: "Created by BADGER GHOST",
    kicker: "Creator credit",
    body: [
      "Ivoire Shop is the brand your customers see.",
      "BADGER GHOST designed and maintains the Admin tools, checkout, shipping, and recovery workflows behind the store.",
      "For production incidents, contact jittabadger.business@gmail.com.",
    ],
    figure: {
      src: "/brand/badger-ghost-logo.jpg",
      alt: "BADGER GHOST logo",
      caption: "BADGER GHOST — developer credit for Ivoire Shop.",
    },
  },
  {
    id: "toc",
    kind: "toc",
    chapter: "Contents",
    title: "Table of contents",
    body: ["Jump to any chapter. Use search above the book to find a topic quickly."],
  },
  {
    id: "daily-open",
    chapter: "01",
    title: "Daily open checklist",
    body: [
      "Sign in to Admin at the start of each selling day.",
      "Confirm the sidebar shows Realtime live (green). If it shows Realtime off, sign out and sign back in — your catalog can still be fine.",
      "Confirm Store status is Open on the Dashboard before taking orders.",
      "Review Needs Acceptance, Ready for Pickup, and Out for Delivery before starting new work.",
    ],
    steps: [
      "Open Admin → Dashboard",
      "Check Realtime live and Store open",
      "Open any Fulfillment cards that need attention",
      "Spot-check Payments readiness before promoting card checkout",
    ],
    links: [{ label: "Open Dashboard", href: "/admin" }],
  },
  {
    id: "dashboard",
    chapter: "02",
    title: "Dashboard",
    body: [
      "The Dashboard is your morning brief: catalog readiness, fulfillment queues, tax status, store open/close, sales overview, quick actions, recent orders, and best sellers.",
      "Use Store status → Close when you need to stop new paid checkouts immediately.",
      "Dashboard cards link into Products, Orders, Delivery, Payments, and Categories.",
    ],
    links: [
      { label: "Dashboard", href: "/admin" },
      { label: "Fulfillment queue", href: "/admin/fulfillment" },
    ],
    figure: {
      src: "/manual/fig-admin-nav.svg",
      alt: "Admin navigation map",
      caption: "Admin navigation matches the live Admin left menu.",
    },
  },
  {
    id: "products",
    chapter: "03",
    title: "Products",
    body: [
      "Admin → Products lists your catalog with price, stock, featured flag, category, and readiness chips (Price / Inventory / Image / Category).",
      "Open a product to edit pricing, images, descriptions, and publish state.",
      "Featured products appear in Settings → Launch catalog for launch review.",
    ],
    steps: [
      "Set a sellable price greater than zero",
      "Attach at least one product image",
      "Assign a category",
      "If inventory tracking is on, keep stock accurate",
      "Mark Featured only for items you are ready to highlight at launch",
    ],
    links: [
      { label: "Products", href: "/admin/products" },
      { label: "Add Product", href: "/admin/products/new" },
    ],
  },
  {
    id: "catalog-controls",
    chapter: "04",
    title: "Catalog Controls",
    body: [
      "Catalog Controls offers bulk tools for activate/unlist, category moves, pricing, and carefully guarded reset/restore workflows.",
      "Treat mass resets as emergency-only. Prefer a backup and a clear plan before large changes.",
    ],
    links: [{ label: "Catalog Controls", href: "/admin/products/catalog-controls" }],
  },
  {
    id: "categories",
    chapter: "05",
    title: "Categories & subcategories",
    body: [
      "Admin → Categories manages departments such as Foods, Cosmetics, and Ivoire Market, plus nested subcategories.",
      "Each subcategory belongs to one top-level parent. Keep inactive categories off shop filters.",
      "Category images appear on merchandising surfaces when you add them.",
    ],
    links: [{ label: "Categories", href: "/admin/categories" }],
  },
  {
    id: "inventory",
    chapter: "06",
    title: "Inventory",
    body: [
      "Admin → Inventory focuses on stock health: tracked quantities, low stock, and out-of-stock signals.",
      "Checkout reserves or reduces sellable stock according to your payment rules when an order is placed.",
      "Failed card attempts keep the reservation for retry; cancelled unpaid orders restore stock.",
    ],
    links: [{ label: "Inventory", href: "/admin/inventory" }],
  },
  {
    id: "orders",
    chapter: "07",
    title: "Orders & fulfillment",
    body: [
      "Admin → Orders is the source of truth for customer purchases.",
      "Move orders through accept → prepare → ready for pickup or delivery → shipped or delivered.",
      "Add tracking when the fulfillment method requires it. Packing notes and pick checklists live on the order detail page.",
      "Demo orders are labeled clearly and are not real revenue.",
    ],
    links: [
      { label: "Orders", href: "/admin/orders" },
      { label: "Printing", href: "/admin/printing" },
    ],
  },
  {
    id: "notifications",
    chapter: "08",
    title: "Notifications & messages",
    body: [
      "The bell and Admin → Notifications show store alerts in realtime when the badge reads Realtime live.",
      "Admin → Messages holds contact-form submissions from the storefront.",
      "Customer announcements are managed under Announcements and can appear in the customer inbox when published.",
    ],
    links: [
      { label: "Notifications", href: "/admin/notifications" },
      { label: "Messages", href: "/admin/messages" },
      { label: "Announcements", href: "/admin/announcements" },
    ],
  },
  {
    id: "printing",
    chapter: "09",
    title: "Printing",
    body: [
      "Admin → Printing and the print routes produce packing slips and catalog documents for warehouse use.",
      "Packing-slip watermark text and logo are configured under Delivery (Shippo / packing slip settings).",
    ],
    links: [{ label: "Printing", href: "/admin/printing" }],
  },
  {
    id: "delivery",
    chapter: "10",
    title: "Delivery, Shippo, UPS & USPS",
    status: "awaiting_config",
    body: [
      "Admin → Delivery is your fulfillment center: store origin address, pickup, local delivery, UPS/USPS rate modes, and Shippo.",
      "Store Pickup stays available for customers even when carrier quotes are unavailable.",
      "Keep live postage purchases turned off until you are ready to buy labels in production.",
      "When carrier quotes are unavailable, use Store Pickup or contact BADGER GHOST — do not invent UPS or USPS prices.",
    ],
    steps: [
      "Confirm your store origin address under Delivery",
      "Keep UPS and USPS on Live Carrier API when Shippo is connected",
      "Keep Enable live postage purchases OFF until you approve label buying",
      "Ask BADGER GHOST to connect Shippo, then re-test quotes from Checkout",
    ],
    links: [{ label: "Delivery Center", href: "/admin/delivery" }],
  },
  {
    id: "payments",
    chapter: "11",
    title: "Payments, Stripe & tax",
    status: "awaiting_config",
    body: [
      "Admin → Payments shows Stripe readiness, the demo payment toggle, tax controls, and order email status.",
      "Card checkout works only after matching Stripe TEST keys and a successful test payment are confirmed.",
      "Live card charges stay locked until you give written approval to turn them on.",
      "Tax 1 and Tax 2 are yours to configure. Current guidance uses Tax 1 at 4% (manual rate), including shipping when that option is enabled.",
    ],
    steps: [
      "Ask BADGER GHOST to install matching Stripe TEST keys",
      "Run one Stripe TEST card checkout",
      "Confirm the order appears in Admin → Orders and inventory updates correctly",
      "Only then consider live keys with your written approval",
    ],
    links: [{ label: "Payments & Tax", href: "/admin/payments" }],
  },
  {
    id: "customers-reviews",
    chapter: "12",
    title: "Customers & reviews",
    body: [
      "Admin → Customers lists customer profiles and opens order history and account status.",
      "Admin → Reviews is where you moderate product reviews from the storefront.",
    ],
    links: [
      { label: "Customers", href: "/admin/customers" },
      { label: "Reviews", href: "/admin/reviews" },
    ],
  },
  {
    id: "content-settings",
    chapter: "13",
    title: "Storefront, settings & handover",
    body: [
      "Storefront / Promotions controls promotional content on the site.",
      "Settings → Store details lets you edit store name, storefront URL, default currency, support email, and warehouse phone.",
      "To update Store details: open Admin → Settings → Edit → change the fields → Save Changes. Use Cancel to discard. Changes save only when you confirm.",
      "Saved details appear on the footer, Contact page, checkout pickup label, order emails, receipts, and related Admin surfaces.",
      "Leave support email and warehouse phone blank until you have verified contact details ready to publish.",
      "Changing the storefront URL updates store copy only. Custom domains and sign-in redirect settings are separate — follow the on-screen checklist after save if you use a custom domain.",
      "Default currency is USD. Other currencies are blocked so payments and past orders stay consistent.",
      "Store name and warehouse phone also appear under Delivery → Store origin.",
      "Settings also includes the Owner's Manual, Launch catalog preview, and Handover cleanup (lists demo records; does not delete).",
      "Account / Security is where admins change passwords. A password change signs out other sessions for safety.",
    ],
    links: [
      { label: "Storefront / Promotions", href: "/admin/content" },
      { label: "Settings", href: "/admin/settings" },
      { label: "Launch catalog", href: "/admin/settings/launch-catalog" },
      { label: "Handover cleanup", href: "/admin/settings/handover" },
      { label: "Account/Security", href: "/admin/account" },
    ],
  },
  {
    id: "customer-journey",
    chapter: "14",
    title: "Customer storefront operations",
    body: [
      "Customers browse Home, Shop, Categories, and product pages; add items to the cart; optionally save a wishlist; then check out.",
      "Checkout steps: Account → Shipping → Payment → Review.",
      "Store Pickup remains available even when carrier rates are temporarily unavailable.",
      "Signed-in customers use Account, Orders, and Notifications. Guests can track orders through confirmation links when those are issued.",
    ],
    links: [
      { label: "Shop", href: "/shop" },
      { label: "Cart", href: "/cart" },
      { label: "Checkout", href: "/checkout" },
      { label: "Account", href: "/account" },
    ],
    figure: {
      src: "/manual/fig-checkout.svg",
      alt: "Checkout steps diagram",
      caption: "Customer checkout flow.",
    },
  },
  {
    id: "troubleshooting",
    chapter: "15",
    title: "Troubleshooting",
    body: [
      "Realtime off in Admin: sign out and sign back in as an admin.",
      "Card payment unavailable: open Admin → Payments and review the readiness message. Contact BADGER GHOST if keys still look incomplete.",
      "UPS or USPS unavailable: check Delivery for Shippo status, confirm product shipping weight and dimensions, and retry with a complete destination address.",
      "Products missing from the shop: confirm the product is active, priced, categorized, and has an image.",
      "Order email not sending: the order can still succeed. Contact BADGER GHOST to finish email provider setup.",
    ],
  },
  {
    id: "emergencies",
    chapter: "16",
    title: "Emergencies & outages",
    body: [
      "Payment outage: Close the store from the Dashboard. Do not switch to live payments to “test.” Keep Demo Payment off unless you need a presentation-only order.",
      "Shipping failure: Keep Store Pickup on. Do not invent carrier prices. Pause UPS or USPS in Delivery if needed.",
      "Suspected key leak: contact BADGER GHOST immediately so Stripe, Shippo, and database credentials can be rotated and admin sessions revoked.",
      "Database concerns: do not reset production data. Contact BADGER GHOST. Restores use approved backups only.",
    ],
    tips: [
      "Work only in this Ivoire Shop production Admin — do not use other project deployments for store operations.",
      "Never delete customers or orders without a written, named approval list.",
    ],
  },
  {
    id: "backups",
    chapter: "17",
    title: "Backups & recovery",
    body: [
      "Before cleanup or risky catalog work, create or confirm a database backup.",
      "Settings → Handover cleanup lists demo orders and counts for review — it never deletes records by itself.",
      "After any restore, verify Admin sign-in, product counts, and one careful TEST checkout once payments are ready.",
    ],
    links: [{ label: "Handover cleanup", href: "/admin/settings/handover" }],
  },
  {
    id: "security",
    chapter: "18",
    title: "Security basics",
    body: [
      "Only admin accounts can open /admin.",
      "Change passwords under Account / Security; other sessions are signed out.",
      "Never share secret API keys in chat, email, or screenshots.",
      "Live Stripe charges and postage purchases stay locked until you approve activation in writing.",
    ],
    links: [{ label: "Account/Security", href: "/admin/account" }],
  },
];

export function manualTocEntries() {
  return OWNERS_MANUAL_PAGES.filter((page) => page.kind !== "toc").map((page) => ({
    id: page.id,
    label: page.kind === "cover" || page.kind === "credits" ? page.title : `${page.chapter}. ${page.title}`,
  }));
}
