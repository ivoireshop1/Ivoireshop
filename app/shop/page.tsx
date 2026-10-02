import { SiteHeader } from "@/src/components/layout/site-header";
import { Footer } from "@/src/components/layout/footer";
import { pageMetadata } from "@/src/lib/page-metadata";
import { ShopExperience } from "@/src/components/product/shop-experience";
import { getComingSoonProducts, getNewArrivalProducts, getCategories } from "@/src/lib/catalog/catalog";

export const metadata = pageMetadata("Shop", "Browse food products by category or search the Ivoire Shop catalog.", "/shop");

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; search?: string }> }) {
  const params = await searchParams;
  const [newArrivals, comingSoon, shopCategories] = await Promise.all([getNewArrivalProducts(4), getComingSoonProducts(4), getCategories()]);
  return (
    <>
      <SiteHeader />
      <ShopExperience comingSoon={comingSoon} initialCategory={params.category || "All"} initialSearch={params.search || ""} newArrivals={newArrivals} shopCategories={shopCategories.map((category) => ({ name: category.name, slug: category.slug }))} />
      <Footer />
    </>
  );
}
