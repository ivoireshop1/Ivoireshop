import Image from "next/image";
import Link from "next/link";
import { demoImages } from "@/src/lib/demo-images";

const categories = [
  ["African Groceries", "africanFoods", "African groceries", "African Foods"],
  ["Rice & Grains", "riceAndGrains", "Everyday grains", "Rice & Grains"],
  ["Spices & Seasoning", "spices", "Warm, fragrant spices", "Spices & Seasoning"],
  ["African Products", "africanFoods", "Authentic favorites", "African Foods"],
  ["Fresh Produce", "freshProduce", "Fresh kitchen staples", "Fresh Produce"],
  ["Oils & Cooking", "africanFoods", "Cooking essentials", "Oils & Cooking"],
  ["Beverages", "drinks", "Refreshing favorites", "Drinks"],
  ["Snacks & Essentials", "snacks", "Pantry treats", "Snacks"],
  ["Beauty & Skincare", "freshProduce", "Care for every day", "African Foods"],
  ["Household & More", "africanFoods", "More for your home", "African Foods"],
] as const;

export function CategorySection() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8" id="categories">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">The Ivoire collection</p>
          <h2 className="mt-2 text-3xl font-semibold text-forest-green sm:text-4xl">Shop by category</h2>
        </div>

        <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/categories">
          View all categories →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map(([name, imageKey, alt, category]) => (
          <Link
            className="group rounded-[24px] border border-black/10 bg-[#fffdf9] p-3 shadow-[0_15px_30px_rgba(23,63,53,0.04)] transition duration-200 hover:-translate-y-1 hover:border-gold/60 hover:shadow-[0_18px_30px_rgba(23,63,53,0.08)]"
            href={`/shop?category=${encodeURIComponent(category)}`}
            key={name}
          >
            <div className="relative aspect-[4/4.3] overflow-hidden rounded-[18px] bg-[#dfe8df]">
              <Image
                alt={alt}
                className="object-cover transition duration-300 group-hover:scale-105"
                fill
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
                src={demoImages.categories[imageKey as keyof typeof demoImages.categories]}
              />
              <span className="absolute bottom-3 right-3 rounded-full bg-white/80 px-2 py-1 text-sm text-forest-green transition group-hover:translate-x-1">
                ↗
              </span>
            </div>
            <p className="px-1 pt-3 text-sm font-semibold text-foreground">{name}</p>
            <p className="px-1 pb-1 pt-1 text-xs text-muted">{alt}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
