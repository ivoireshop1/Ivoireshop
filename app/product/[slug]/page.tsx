import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/src/components/product/add-to-cart";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { RelatedProducts } from "@/src/components/product/related-products";
import { createClient } from "@/src/lib/supabase/server";
import { buildProductPath } from "@/src/lib/navigation/smart-navigation";
import { WishlistButton } from "@/src/components/wishlist/wishlist-button";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { slug } = await params;
  const { returnTo } = await searchParams;
  const supabase = await createClient();
  const { data: productRow } = await supabase
    .from("products")
    .select("id, name, slug, description, short_description, price, compare_at_price, stock_quantity, is_active, is_featured, category_id, categories(name), product_images(image_url, position)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!productRow) notFound();

  const product = {
    id: productRow.id,
    slug: productRow.slug,
    name: productRow.name,
    description: productRow.description,
    shortDescription: productRow.short_description ?? productRow.description,
    price: Number(productRow.price),
    compareAtPrice: productRow.compare_at_price === null ? undefined : Number(productRow.compare_at_price),
    category: productRow.categories?.[0]?.name ?? "African Foods",
    image: productRow.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url ?? "/demo-products/premium-jasmine-rice.jpg",
    weight: productRow.stock_quantity !== null ? `${productRow.stock_quantity} in stock` : "",
    isFeatured: Boolean(productRow.is_featured),
    isNew: false,
    isPopular: false,
  };

  const { data: relatedRows } = await supabase
    .from("products")
    .select("id, name, slug, price, compare_at_price, description, short_description, is_featured, stock_quantity, categories(name), product_images(image_url, position)")
    .eq("is_active", true)
    .neq("id", product.id)
    .eq("category_id", productRow.category_id)
    .order("created_at", { ascending: false })
    .limit(4);

  const related = (relatedRows ?? []).map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    shortDescription: item.short_description ?? item.description,
    price: Number(item.price),
    compareAtPrice: item.compare_at_price === null ? undefined : Number(item.compare_at_price),
    category: item.categories?.[0]?.name ?? "African Foods",
    image: item.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url ?? "/demo-products/premium-jasmine-rice.jpg",
    weight: item.stock_quantity !== null ? `${item.stock_quantity} in stock` : "",
    isFeatured: Boolean(item.is_featured),
    isNew: false,
    isPopular: false,
  }));

  const currentProductPath = buildProductPath(product.slug);
  return <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><SmartBackButton /><nav aria-label="Breadcrumb" className="mt-2 text-sm text-muted"><Link href="/">Home</Link> <span className="mx-2">/</span> <Link href="/shop">Shop</Link> <span className="mx-2">/</span> <span>{product.name}</span></nav>
    <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start"><div className="relative aspect-square overflow-hidden rounded-3xl bg-[#eadfce]"><Image alt={product.name} className="object-cover" fill loading="eager" priority sizes="(max-width: 1024px) 100vw, 50vw" src={product.image} /></div><div className="lg:py-8"><p className="text-sm text-muted">{product.category}</p><div className="flex items-start justify-between gap-4"><h1 className="mt-3 text-4xl font-semibold text-forest-green">{product.name}</h1><WishlistButton productId={product.id} productName={product.name} /></div><p className="mt-4 text-2xl font-semibold text-forest-green">${product.price.toFixed(2)}</p><p className="mt-2 text-sm text-muted">{product.weight}</p><p className="mt-8 max-w-lg leading-7 text-muted">{product.description}</p><div className="mt-10"><AddToCart product={product} /></div></div></div>
    <RelatedProducts products={related.length ? related : []} returnTo={returnTo ?? currentProductPath} />
  </main>;
}
