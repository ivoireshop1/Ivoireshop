import { pageMetadata } from "@/src/lib/page-metadata";
import { redirect } from "next/navigation";
import { AnnouncementBar } from "@/src/components/layout/announcement-bar";
import { Footer } from "@/src/components/layout/footer";
import { SiteHeader } from "@/src/components/layout/site-header";
import { BenefitsSection } from "@/src/components/storefront/benefits-section";
import { CategorySection } from "@/src/components/storefront/category-section";
import { CtaSection } from "@/src/components/storefront/cta-section";
import { Hero } from "@/src/components/storefront/hero";
import { StorefrontBillboard } from "@/src/components/storefront/storefront-billboard";
import { GuestShoppingSection } from "@/src/components/storefront/guest-shopping-section";
import { ProductSection } from "@/src/components/storefront/product-section";
import { ComingSoonHome, NewArrivalsHome } from "@/src/components/storefront/home-merch-sections";
import { getNavRole } from "@/src/lib/auth/session";
import { CUSTOMER_HOME } from "@/src/lib/auth/post-login";

export const metadata = pageMetadata("African & International Food", "Discover African and international food products and pantry staples.", "/");

export default async function Home() {
  const role = await getNavRole();
  if (role === "customer") redirect(CUSTOMER_HOME);

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <SiteHeader />
      <main>
        <Hero />
        <StorefrontBillboard />
        <CategorySection />
        <NewArrivalsHome />
        <ComingSoonHome />
        <ProductSection />
        <BenefitsSection />
        <GuestShoppingSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
