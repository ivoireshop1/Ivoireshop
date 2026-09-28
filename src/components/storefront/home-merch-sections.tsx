import { MerchProductRail } from "@/src/components/storefront/merch-product-rail";
import { getComingSoonProducts, getNewArrivalProducts } from "@/src/lib/catalog/catalog";

export async function NewArrivalsHome() {
  const products = await getNewArrivalProducts(4);
  return (
    <MerchProductRail
      description="Fresh additions to Ivoire Shop."
      eyebrow="New arrivals"
      products={products}
      title="New Arrivals"
      viewAllHref="/shop?arrival=new"
    />
  );
}

export async function ComingSoonHome() {
  const products = await getComingSoonProducts(4);
  return (
    <MerchProductRail
      comingSoon
      description="A first look at products being prepared for the shop."
      eyebrow="Coming soon"
      products={products}
      title="Coming Soon"
    />
  );
}
