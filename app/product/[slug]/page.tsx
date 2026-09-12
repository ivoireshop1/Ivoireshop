import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/src/components/product/add-to-cart";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { RelatedProducts } from "@/src/components/product/related-products";
import { demoProducts, getDemoProduct } from "@/src/lib/catalog/demo-products";
import { buildProductPath } from "@/src/lib/navigation/smart-navigation";
import { WishlistButton } from "@/src/components/wishlist/wishlist-button";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { slug } = await params;
  const { returnTo } = await searchParams;
  const product = getDemoProduct(slug);
  if (!product) notFound();
  const related = demoProducts.filter((item) => item.category === product.category && item.id !== product.id);
  const currentProductPath = buildProductPath(product.slug);
  return <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><SmartBackButton /><nav aria-label="Breadcrumb" className="mt-2 text-sm text-muted"><Link href="/">Home</Link> <span className="mx-2">/</span> <Link href="/shop">Shop</Link> <span className="mx-2">/</span> <span>{product.name}</span></nav>
    <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start"><div className="relative aspect-square overflow-hidden rounded-3xl bg-[#eadfce]"><Image alt={product.name} className="object-cover" fill loading="eager" priority sizes="(max-width: 1024px) 100vw, 50vw" src={product.image} /></div><div className="lg:py-8"><p className="text-sm text-muted">{product.category}</p><div className="flex items-start justify-between gap-4"><h1 className="mt-3 text-4xl font-semibold text-forest-green">{product.name}</h1><WishlistButton productId={product.id} productName={product.name} /></div><p className="mt-4 text-2xl font-semibold text-forest-green">${product.price.toFixed(2)}</p><p className="mt-2 text-sm text-muted">{product.weight}</p><p className="mt-8 max-w-lg leading-7 text-muted">{product.description}</p><div className="mt-10"><AddToCart product={product} /></div></div></div>
    <RelatedProducts products={related.length ? related : demoProducts.filter((item) => item.id !== product.id)} returnTo={returnTo ?? currentProductPath} />
  </main>;
}
