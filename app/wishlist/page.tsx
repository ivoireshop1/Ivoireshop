import { Footer } from "@/src/components/layout/footer";
import { Header } from "@/src/components/layout/header";
import { PageHero } from "@/src/components/storefront/page-hero";
import { WishlistExperience } from "@/src/components/customer/wishlist-experience";

export default function WishlistPage() {
  return <><Header /><main className="flex-1"><PageHero eyebrow="Saved for later" title="Your Wishlist" description="Keep the products you love close by. Your wishlist is currently stored for this browsing session." fallbackHref="/shop" fallbackLabel="Continue Shopping" /><WishlistExperience /></main><Footer /></>;
}
