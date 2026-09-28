import { Header } from "@/src/components/layout/header";
import { Footer } from "@/src/components/layout/footer";
import { pageMetadata } from "@/src/lib/page-metadata";
import { ShopExperience } from "@/src/components/product/shop-experience";

export const metadata = pageMetadata("Shop", "Browse food products by category or search the Ivoire Shop catalog.", "/shop");

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; search?: string }> }) {
  const params = await searchParams;
  return <><Header /><ShopExperience initialCategory={params.category || "All"} initialSearch={params.search || ""} /><Footer /></>;
}
