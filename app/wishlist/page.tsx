import { pageMetadata } from "@/src/lib/page-metadata";
import { Footer } from "@/src/components/layout/footer";
import { SiteHeader } from "@/src/components/layout/site-header";
import { PageHero } from "@/src/components/storefront/page-hero";
import { WishlistExperience } from "@/src/components/customer/wishlist-experience";

export const metadata = pageMetadata("Wishlist", "Your saved products.", "/wishlist", false);

export default function WishlistPage() {
  return <><SiteHeader /><main className="flex-1"><PageHero eyebrow="Saved for later" title="Your Wishlist" description="Keep the products you love close by, saved to your account." fallbackHref="/shop" fallbackLabel="Continue Shopping" /><WishlistExperience /></main><Footer /></>;
}
