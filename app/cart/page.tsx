import { CartPage } from "@/src/components/cart/cart-page";
import { Suspense } from "react";

export default function CartRoute() { return <Suspense fallback={<main className="mx-auto w-full max-w-7xl px-5 py-16">Loading cart...</main>}><CartPage /></Suspense>; }
