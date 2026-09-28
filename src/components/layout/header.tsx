"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CANONICAL_CATEGORIES } from "@/src/lib/catalog/canonical-categories";
import { useCart } from "@/src/lib/cart/cart-context";
import { useWishlist } from "@/src/lib/wishlist/wishlist-context";
import { CUSTOMER_HOME } from "@/src/lib/auth/post-login";
import { createClient } from "@/src/lib/supabase/browser";
function SearchIcon() {
  return <span aria-hidden="true" className="text-lg">⌕</span>;
}

export function Header() {
  const { totalItems, isLoaded, addEventId } = useCart();
  const { items: wishlistItems } = useWishlist();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const client = createClient();
    client.auth.getUser().then(({ data }) => setIsAuthenticated(Boolean(data.user)));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setIsAuthenticated(Boolean(session?.user)));
    return () => listener.subscription.unsubscribe();
  }, []);

  const homeHref = isAuthenticated ? CUSTOMER_HOME : "/";
  const wishlistLabel = wishlistItems.length > 0 ? `Wishlist (${wishlistItems.length})` : "Wishlist";

  return (
    <header className="border-b border-black/10 bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 overflow-x-hidden px-4 py-4 sm:gap-4 sm:px-5 lg:px-8">
        <Link className="min-w-0 shrink-0 text-base font-semibold tracking-[0.18em] text-forest-green sm:text-lg" href="/">
          IVOIRE <span className="font-normal">SHOP</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden min-w-0 items-center gap-5 text-sm font-medium text-foreground/75 xl:flex">
          <Link className="hover:text-forest-green" href={homeHref}>Home</Link>
          <Link className="hover:text-forest-green" href="/shop">Shop</Link>
          {CANONICAL_CATEGORIES.map((category) => (
            <Link className="hover:text-forest-green" href={`/shop?category=${encodeURIComponent(category.name)}`} key={category.slug}>{category.name}</Link>
          ))}
          {isAuthenticated ? (
            <>
              <Link className="hover:text-forest-green" href="/wishlist">{wishlistLabel}</Link>
              <Link className="hover:text-forest-green" href="/account">Account</Link>
            </>
          ) : (
            <Link className="hover:text-forest-green" href="/categories">Categories</Link>
          )}
        </nav>
        <div className="flex items-center gap-2 text-sm sm:gap-4">
          <Link aria-label="Search products" className="hidden text-forest-green sm:inline-flex" href="/shop"><SearchIcon /></Link>
          {isAuthenticated ? (
            <>
              <Link aria-label="Wishlist" className="hidden text-forest-green sm:inline-flex" href="/wishlist">{wishlistLabel}</Link>
              <SignOutLink />
            </>
          ) : (
            <><Link aria-label="Sign in" className="hidden text-forest-green sm:inline-flex" href="/login">Sign in</Link><Link aria-label="Create account" className="hidden text-forest-green sm:inline-flex" href="/signup">Create account</Link></>
          )}
          <Link aria-label={`Shopping cart${isLoaded ? `, ${totalItems} items` : ""}`} className="rounded-full border border-forest-green/20 px-3 py-1.5 text-forest-green" href="/cart"><span className={addEventId ? "cart-icon-pulse inline-flex" : ""} key={addEventId}>Cart {isLoaded && totalItems > 0 && <span className="ml-1 rounded-full bg-gold px-1.5 py-0.5 text-xs text-forest-green">{totalItems > 99 ? "99+" : totalItems}</span>}</span></Link>
          <button aria-controls="mobile-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"} className="min-h-11 min-w-11 px-1 text-forest-green xl:hidden" onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }} onClick={() => setMenuOpen((open) => !open)} type="button">{menuOpen ? "Close" : "Menu"}</button>
        </div>
      </div>
      {menuOpen && <nav aria-label="Mobile navigation" className="border-t border-black/10 px-5 py-4 xl:hidden" id="mobile-navigation">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 text-sm [&_a]:min-h-11 [&_a]:py-3 [&_button]:min-h-11 [&_button]:py-3 font-medium text-forest-green">
          <Link href={homeHref} onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/shop" onClick={() => setMenuOpen(false)}>Shop</Link>
          {CANONICAL_CATEGORIES.map((category) => (
            <Link href={`/shop?category=${encodeURIComponent(category.name)}`} key={category.slug} onClick={() => setMenuOpen(false)}>{category.name}</Link>
          ))}
          <Link href="/categories" onClick={() => setMenuOpen(false)}>All categories</Link>
          {isAuthenticated ? (
            <>
              <Link href="/wishlist" onClick={() => setMenuOpen(false)}>{wishlistLabel}</Link>
              <Link href="/account#recent-orders" onClick={() => setMenuOpen(false)}>Orders</Link>
              <Link href="/account" onClick={() => setMenuOpen(false)}>Account</Link>
              <MobileSignOutLink onSignOut={() => setMenuOpen(false)} />
            </>
          ) : (
            <>
              <Link href="/categories" onClick={() => setMenuOpen(false)}>Categories</Link>
              <Link href="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)}>Create account</Link>
            </>
          )}
        </div>
      </nav>}
    </header>
  );
}

function SignOutLink() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  return (
    <button
      className="hidden text-forest-green sm:inline-flex"
      disabled={isSigningOut}
      onClick={async () => {
        setIsSigningOut(true);
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
      }}
      type="button"
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}

function MobileSignOutLink({ onSignOut }: { onSignOut: () => void }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  return (
    <button
      className="text-left"
      disabled={isSigningOut}
      onClick={async () => {
        setIsSigningOut(true);
        await createClient().auth.signOut();
        onSignOut();
        router.push("/");
        router.refresh();
      }}
      type="button"
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
