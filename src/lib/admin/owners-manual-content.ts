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
  awaiting_config: "Awaiting configuration — not verified operational on Steel",
  locked: "Locked until founder approval",
};

export const OWNERS_MANUAL_PAGES: ManualPage[] = [
  {
    id: "cover",
    kind: "cover",
    chapter: "Cover",
    title: "Ivoire Shop Owner's Playbook",
    kicker: "BADGER GHOST",
    body: [
      "Primary client brand: Ivoire Shop.",
      "Production: https://ivoireshop-steel.vercel.app",
      "Creator credit: BADGER GHOST. Never BUBBA.",
      "This playbook matches the live Admin navigation and customer storefront on Steel.",
    ],
  },
  {
    id: "credits",
    kind: "credits",
    chapter: "Credits",
    title: "Created by BADGER GHOST",
    kicker: "Creator credit",
    body: [
      "Ivoire Shop is the storefront brand customers see.",
      "BADGER GHOST built and documents the operating system behind Admin, checkout, shipping, and recovery.",
      "Support contact for production incidents: jittabadger.business@gmail.com",
      "Never contact or brand this work as BUBBA.",
    ],
    figure: {
      src: "/brand/badger-ghost-logo.jpg",
      alt: "BADGER GHOST logo",
      caption: "Approved BADGER GHOST mark used on cover and credits.",
    },
  },
  {
    id: "toc",
    kind: "toc",
    chapter: "Contents",
    title: "Table of contents",
    body: ["Jump to any chapter. Use search above the book to filter topics."],
  },
  {
    id: "daily-open",
    chapter: "01",
    title: "Daily open checklist",
    body: [
      "Open Admin on Steel while signed in as an admin profile.",
      "Confirm the sidebar badge reads Realtime live (green). Gray Realtime off means re-login — the database can still be healthy.",
      "Confirm Store status is Open on the Dashboard before accepting orders.",
      "Scan Needs Acceptance, Ready for Pickup, and Out for Delivery before starting new work.",
    ],
    steps: [
      "Admin → Dashboard",
      "Check Realtime live + Store open",
      "Open Fulfillment cards that are non-zero",
      "Spot-check Payments readiness before advertising card checkout",
    ],
    links: [{ label: "Open Dashboard", href: "/admin" }],
  },
  {
    id: "dashboard",
    chapter: "02",
    title: "Dashboard",
    body: [
      "The Dashboard is the morning brief: catalog readiness, fulfillment buckets, tax status, store open/close, sales overview, quick actions, recent orders, and best sellers.",
      "Close store from Store status when you must stop new paid checkouts immediately.",
      "Cards deep-link into Products, Orders, Delivery, Payments, and Categories.",
    ],
    links: [
      { label: "Dashboard", href: "/admin" },
      { label: "Fulfillment queue", href: "/admin/fulfillment" },
    ],
    figure: {
      src: "/manual/fig-admin-nav.svg",
      alt: "Admin navigation map",
      caption: "Admin left rail matches the live Steel navigation.",
    },
  },
  {
    id: "products",
    chapter: "03",
    title: "Products",
    body: [
      "Admin → Products lists the catalog with price, stock, featured, category, and readiness chips (Price / Inventory / Image / Category).",
      "Edit a row or open a product detail page to change pricing, images, embeds, and publish state.",
      "Featured products feed the launch preview under Settings → Launch catalog.",
    ],
    steps: [
      "Set a sellable price greater than zero",
      "Attach at least one product image",
      "Assign a category",
      "If track inventory is on, keep stock accurate",
      "Toggle Featured only for founder-approved launch items",
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
      "Bulk tools for activate/unlist, category moves, pricing, and reset/restore workflows live under Catalog Controls.",
      "Treat destructive resets as emergency-only. Prefer snapshots and founder confirmation before mass changes.",
    ],
    links: [{ label: "Catalog Controls", href: "/admin/products/catalog-controls" }],
  },
  {
    id: "categories",
    chapter: "05",
    title: "Categories & subcategories",
    body: [
      "Admin → Categories manages top-level departments (Foods, Cosmetics, Ivoire Market) and nested subcategories.",
      "A subcategory must have exactly one top-level parent. Inactive categories should stay off shop filters.",
      "Category images appear on merchandising surfaces when configured.",
    ],
    links: [{ label: "Categories", href: "/admin/categories" }],
  },
  {
    id: "inventory",
    chapter: "06",
    title: "Inventory",
    body: [
      "Admin → Inventory focuses on stock health: tracked quantities, low stock, and out-of-stock signals.",
      "Checkout decrements sellable stock when unpaid Stripe reservations or paid orders are created according to payment rules.",
      "Failed cards keep the reservation for retry; cancelled unpaid orders restore stock.",
    ],
    links: [{ label: "Inventory", href: "/admin/inventory" }],
  },
  {
    id: "orders",
    chapter: "07",
    title: "Orders & fulfillment",
    body: [
      "Admin → Orders is the source of truth for customer purchases.",
      "Move orders through accept → prepare → ready for pickup/delivery → shipped/delivered.",
      "Add tracking when the fulfillment method requires it. Internal notes and pick checklists stay on the order detail page.",
      "DEMO orders are labeled and are not real revenue.",
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
      "The bell and Admin → Notifications show admin_notifications in realtime when the badge is Realtime live.",
      "Admin → Messages holds contact form submissions from the storefront.",
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
      "Admin → Printing and print routes produce packing slips / catalog documents for warehouse use.",
      "Packing slip watermark text and logo URL are configured under Delivery → Shippo settings (Ivoire packing slips only).",
    ],
    links: [{ label: "Printing", href: "/admin/printing" }],
  },
  {
    id: "delivery",
    chapter: "10",
    title: "Delivery, Shippo, UPS & USPS",
    status: "awaiting_config",
    body: [
      "Admin → Delivery is the fulfillment center: origin address, pickup, local delivery visibility, UPS/USPS rate modes, and Shippo.",
      "Steel is configured for live_api UPS/USPS with Store Pickup on, Ivoire Shop shipping off, and postage purchases off.",
      "Shippo Production token is still missing on Vercel. Until installed and verified, carrier quotes will fail — do not substitute manual/fake carrier rates.",
    ],
    steps: [
      "Confirm origin: 1210 Rockbridge Rd NW Unit L, Norcross GA 30093",
      "Keep UPS/USPS on Live Carrier API (Shippo)",
      "Keep Enable live postage purchases OFF",
      "Add SHIPPO_API_TOKEN to Vercel Production, redeploy Steel, then re-test quotes",
    ],
    links: [{ label: "Delivery Center", href: "/admin/delivery" }],
  },
  {
    id: "payments",
    chapter: "11",
    title: "Payments, Stripe & tax",
    status: "awaiting_config",
    body: [
      "Admin → Payments shows Stripe readiness, demo payment toggle, tax controls, and order email status.",
      "Steel currently waits for NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. Secret/webhook names exist; card checkout is not operational until the publishable TEST key matches and a TEST payment is verified end-to-end.",
      "STRIPE_LIVE_PAYMENTS_ENABLED must stay false until written founder approval.",
      "Tax 1 / Tax 2 are client-owned. Steel uses Tax 1 at 4% (manual rate) applied to shipping when enabled.",
    ],
    steps: [
      "Add matching pk_test publishable key on Vercel Production",
      "Redeploy Steel",
      "Run a Stripe TEST card checkout",
      "Confirm webhook success + Admin Orders + inventory movement",
      "Only then consider LIVE keys with founder approval",
    ],
    links: [{ label: "Payments & Tax", href: "/admin/payments" }],
  },
  {
    id: "customers-reviews",
    chapter: "12",
    title: "Customers & reviews",
    body: [
      "Admin → Customers lists profiles and opens customer detail for order history and account status.",
      "Admin → Reviews moderates product reviews submitted from the storefront.",
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
      "Storefront / Promotions controls promotional content surfaces.",
      "Settings → Store details is editable: Store name, Storefront URL, Default currency, Support email, and Warehouse phone.",
      "How to edit Store details: open Admin → Settings → Edit → change fields → Save Changes (or Cancel to discard). Nothing autosaves on blur.",
      "Saved values persist in Supabase store_settings and update the footer, Contact page, checkout pickup label, order emails, print/receipts, and related admin copy when those fields are set.",
      "Leave Support email and Warehouse phone blank until they are real — the site will not invent placeholder contact details.",
      "Storefront URL saves store copy only. It does not change Vercel domains or Supabase Auth redirect allowlists. After save, follow the on-screen steps if you use a custom domain.",
      "Default currency: only USD is supported. Choosing another currency is blocked so Stripe, PayPal, Square, and historical order totals stay intact.",
      "Store name and warehouse phone also sync with Delivery → Store origin (same database fields).",
      "Settings also holds handover tools: Owner's Manual, Launch catalog preview (10 featured), and Handover cleanup (backup-first, no deletes).",
      "Account/Security is where admins change passwords. Password changes revoke other sessions.",
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
      "Customers browse Home, Shop, Categories, and product detail pages; add to cart; optionally wishlist; then Checkout.",
      "Checkout steps: Account → Shipping → Payment → Review.",
      "Store Pickup remains available even when carrier APIs are down.",
      "Signed-in customers use Account, Orders, and Notifications. Guests can track via confirmation links when issued.",
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
      caption: "Customer checkout flow on Steel.",
    },
  },
  {
    id: "troubleshooting",
    chapter: "15",
    title: "Troubleshooting",
    body: [
      "Realtime off in Admin: sign out/in as admin; confirm NEXT_PUBLIC_SUPABASE_URL points at lidq… Steel project.",
      "Card payment unavailable: Admin → Payments missing list. Usually NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.",
      "UPS/USPS unavailable: Delivery monitor will say Shippo token not configured, or live quotes returned none for the parcel/address.",
      "Products missing on shop: check is_active, price, category, and images.",
      "Email not sending: order still succeeds; configure RESEND_API_KEY / ORDER_EMAIL_FROM later.",
    ],
  },
  {
    id: "emergencies",
    chapter: "16",
    title: "Emergencies & outages",
    body: [
      "Payment outage: Close store from Dashboard. Do not enable LIVE to 'fix' TEST. Keep Demo Payment off unless founder wants presentation-only orders.",
      "Shipping failure: Keep Store Pickup on. Do not invent manual UPS/USPS prices. Pause carrier methods in Delivery if needed.",
      "Suspected key leak: rotate Stripe, Shippo, and Supabase keys in their dashboards, update Vercel Production, redeploy Steel, revoke admin sessions.",
      "Database problems: do not reset Production. Contact BADGER GHOST. Use Supabase backups / point-in-time recovery with founder approval.",
    ],
    tips: [
      "Never modify the Five deployment.",
      "Never delete customers/orders without an explicit named approval list.",
    ],
  },
  {
    id: "backups",
    chapter: "17",
    title: "Backups & recovery",
    body: [
      "Before cleanup or risky catalog operations: Supabase Dashboard → Database → Backups (or approved dump).",
      "Settings → Handover cleanup lists demo orders and counts — it never deletes.",
      "After restore testing, verify Admin login, product counts, and a single TEST checkout path (when Stripe is configured).",
    ],
    links: [{ label: "Handover cleanup", href: "/admin/settings/handover" }],
  },
  {
    id: "security",
    chapter: "18",
    title: "Security basics",
    body: [
      "Only admin-role profiles reach /admin.",
      "Change passwords under Account/Security; other sessions are revoked.",
      "Never paste secret keys into chat or commit them to Git.",
      "LIVE Stripe and postage purchases stay locked until written founder approval.",
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
