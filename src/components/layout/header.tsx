"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/src/lib/cart/cart-context";
import { createClient } from "@/src/lib/supabase/browser";
function SearchIcon() {
  return <span aria-hidden="true" className="text-lg">⌕</span>;
}

export function Header() {
  const { totalItems, isLoaded } = useCart();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const client = createClient();
    client.auth.getUser().then(({ data }) => setIsAuthenticated(Boolean(data.user)));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setIsAuthenticated(Boolean(session?.user)));
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <header className="border-b border-black/10 bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5 lg:px-8">
        <Link className="shrink-0 text-lg font-semibold tracking-[0.18em] text-forest-green" href="/">
          IVOIRE <span className="font-normal">SHOP</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm font-medium text-foreground/75 md:flex">
          <Link className="hover:text-forest-green" href="/">Home</Link>
          <Link className="hover:text-forest-green" href="/shop">Shop</Link>
          <Link className="hover:text-forest-green" href="/categories">Categories</Link>
          <Link className="hover:text-forest-green" href="/about">About Us</Link>
          <Link className="hover:text-forest-green" href="/blog">Blog</Link>
          <Link className="hover:text-forest-green" href="/contact">Contact</Link>
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <Link aria-label="Search products" className="hidden text-forest-green sm:inline-flex" href="/shop"><SearchIcon /></Link>
          <Link aria-label="Wishlist" className="hidden text-forest-green sm:inline-flex" href="/wishlist">Wishlist</Link>
          {isAuthenticated ? <Link aria-label="Account" className="text-forest-green" href="/account">Account</Link> : <><Link aria-label="Sign in" className="text-forest-green" href="/login">Sign in</Link><Link aria-label="Create account" className="hidden text-forest-green sm:inline-flex" href="/signup">Create account</Link></>}
          <Link aria-label={`Shopping cart${isLoaded ? `, ${totalItems} items` : ""}`} className="rounded-full border border-forest-green/20 px-3 py-1.5 text-forest-green" href="/cart">Cart {isLoaded && totalItems > 0 && <span className="ml-1 rounded-full bg-gold px-1.5 py-0.5 text-xs text-forest-green">{totalItems > 99 ? "99+" : totalItems}</span>}</Link>
          <button aria-controls="mobile-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"} className="text-forest-green md:hidden" onClick={() => setMenuOpen((open) => !open)} type="button">{menuOpen ? "Close" : "Menu"}</button>
        </div>
      </div>
      {menuOpen && <nav aria-label="Mobile navigation" className="border-t border-black/10 px-5 py-4 md:hidden" id="mobile-navigation">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm font-medium text-forest-green">
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/shop" onClick={() => setMenuOpen(false)}>Shop</Link>
          <Link href="/categories" onClick={() => setMenuOpen(false)}>Categories</Link>
          <Link href="/about" onClick={() => setMenuOpen(false)}>About Us</Link>
          <Link href="/blog" onClick={() => setMenuOpen(false)}>Blog</Link>
          <Link href="/contact" onClick={() => setMenuOpen(false)}>Contact</Link>
          {!isAuthenticated && <Link href="/signup" onClick={() => setMenuOpen(false)}>Create account</Link>}
          <Link href="/wishlist" onClick={() => setMenuOpen(false)}>Wishlist</Link>
        </div>
      </nav>}
    </header>
  );
}
