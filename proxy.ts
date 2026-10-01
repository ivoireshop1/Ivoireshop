import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/src/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
