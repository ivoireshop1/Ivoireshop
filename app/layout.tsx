import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { siteConfig } from "@/src/lib/site";
import { CartProvider } from "@/src/lib/cart/cart-context";
import { CartFeedback } from "@/src/components/cart/cart-feedback";
import { WishlistProvider } from "@/src/lib/wishlist/wishlist-context";
import { NavigationTracker } from "@/src/components/navigation/navigation-tracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><CartProvider><WishlistProvider><Suspense fallback={null}><NavigationTracker /></Suspense>{children}<CartFeedback /></WishlistProvider></CartProvider></body>
    </html>
  );
}
