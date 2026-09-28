import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

export function createRouteHandlerClient(request: NextRequest) {
  const pending: CookieToSet[] = [];
  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          pending.push({ name, value, options });
        });
      },
    },
  });

  return {
    supabase,
    redirect(url: URL) {
      const response = NextResponse.redirect(url);
      pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    },
  };
}
