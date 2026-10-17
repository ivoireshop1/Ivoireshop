import { type NextRequest, NextResponse } from "next/server";
import { CANONICAL_PRODUCTION_ORIGIN, isProtectedInfrastructureOrigin, isTrustedPublicSiteOrigin } from "@/src/lib/site";
import { updateSession } from "@/src/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const requestOrigin = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  if (
    (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") &&
    isProtectedInfrastructureOrigin(requestOrigin) &&
    !isTrustedPublicSiteOrigin(requestOrigin)
  ) {
    const canonical = new URL(pathname + request.nextUrl.search, CANONICAL_PRODUCTION_ORIGIN);
    return NextResponse.redirect(canonical, 307);
  }
  if (
    pathname !== "/auth/callback" &&
    (searchParams.has("code") || searchParams.has("token_hash"))
  ) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/auth/callback";
    return NextResponse.redirect(dest);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|audio/|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wav|mp3|m4a|ogg)$).*)",
  ],
};
