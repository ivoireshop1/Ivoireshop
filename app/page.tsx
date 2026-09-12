import { AnnouncementBar } from "@/src/components/layout/announcement-bar";
import { Footer } from "@/src/components/layout/footer";
import { Header } from "@/src/components/layout/header";
import { BenefitsSection } from "@/src/components/storefront/benefits-section";
import { CategorySection } from "@/src/components/storefront/category-section";
import { CtaSection } from "@/src/components/storefront/cta-section";
import { Hero } from "@/src/components/storefront/hero";
import { GuestShoppingSection } from "@/src/components/storefront/guest-shopping-section";
import { ProductSection } from "@/src/components/storefront/product-section";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <Header />
      <main>
        <Hero />
        <CategorySection />
        <ProductSection />
        <BenefitsSection />
        <GuestShoppingSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
