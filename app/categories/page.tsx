import { pageMetadata } from "@/src/lib/page-metadata";
import { Footer } from "@/src/components/layout/footer";
import { SiteHeader } from "@/src/components/layout/site-header";
import { PageHero } from "@/src/components/storefront/page-hero";
import { CanonicalCategoryCards } from "@/src/components/storefront/canonical-category-cards";
import { getCategories, getProducts } from "@/src/lib/catalog/catalog";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata("Categories", "Shop Cosmetics, Foods, and Ivoire Market.", "/categories");

export default async function CategoriesPage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const liveNames = new Set(products.map((product) => product.category));
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero eyebrow="The Ivoire collection" title="Explore Our Categories" description="Shop Cosmetics, Foods, and Ivoire Market." />
        <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <CanonicalCategoryCards categories={categories} liveNames={liveNames} />
        </section>
      </main>
      <Footer />
    </>
  );
}
