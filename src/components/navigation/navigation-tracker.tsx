"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { rememberNavigation } from "@/src/lib/navigation/smart-navigation";

export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    rememberNavigation(`${pathname}${query ? `?${query}` : ""}`);
  }, [pathname, query]);

  return null;
}
