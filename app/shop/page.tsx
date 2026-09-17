import { ShopExperience } from "@/src/components/product/shop-experience";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; search?: string }> }) {
  const params = await searchParams;
  return <ShopExperience initialCategory={params.category || "All"} initialSearch={params.search || ""} />;
}
