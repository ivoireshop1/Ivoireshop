export const siteConfig = {
  name: "Ivoire Shop",
  description:
    "A modern online shop for African food, groceries, beauty, and household products.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;
