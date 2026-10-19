import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { createClient } from "@/src/lib/supabase/server";

type FeaturedRow = {
  id: string;
  name: string;
  slug: string;
  price: number | string | null;
  stock_quantity: number | string | null;
  is_active: boolean | null;
  categories: { name: string | null; slug: string | null } | { name: string | null; slug: string | null }[] | null;
  product_images: { image_url: string | null; position: number | null }[] | null;
};

export default async function LaunchCatalogPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, slug, price, stock_quantity, is_active, categories:categories!products_category_id_fkey(name, slug), product_images(image_url, position)",
    )
    .eq("is_featured", true)
    .order("name");

  const rows = (data ?? []) as FeaturedRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Founder preview</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Launch catalog</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b6b6b]">
            These {rows.length} featured products are marked for go-live review. All other active products remain on the
            storefront until you explicitly approve hiding them.
          </p>
        </div>
        <Link className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white" href="/#featured-products">
          View featured on home
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((product) => {
          const category = Array.isArray(product.categories) ? product.categories[0] : product.categories;
          const image =
            [...(product.product_images ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]?.image_url ||
            "/brand/badger.svg";
          return (
            <article className="overflow-hidden rounded-[24px] border border-[#173f35]/10 bg-white" key={product.id}>
              <div className="relative aspect-[4/3] bg-[#eadfce]">
                <Image alt={product.name} className="object-cover" fill sizes="(max-width:768px) 100vw, 33vw" src={image} />
              </div>
              <div className="space-y-2 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#b8964c]">
                  {category?.name ?? "Uncategorized"}
                </p>
                <h2 className="text-lg font-semibold text-[#173f35]">{product.name}</h2>
                <p className="text-sm text-[#6b6b6b]">
                  ${Number(product.price ?? 0).toFixed(2)} · stock {Number(product.stock_quantity ?? 0)} ·{" "}
                  {product.is_active ? "Active" : "Inactive"}
                </p>
                <Link className="inline-flex text-sm font-semibold text-[#173f35] underline underline-offset-4" href={`/product/${product.slug}`}>
                  Open product
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {!rows.length ? (
        <p className="rounded-2xl border border-[#7c5d1a]/20 bg-[#f3efe9] p-4 text-sm text-[#7c5d1a]">
          No featured products yet. Mark products as Featured in Admin → Products.
        </p>
      ) : null}
    </div>
  );
}
