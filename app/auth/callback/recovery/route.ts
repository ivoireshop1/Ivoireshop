import { NextResponse, type NextRequest } from "next/server";
import { recoveryContinueHtml, recoveryCredential } from "@/src/lib/auth/recovery-link";
import { RECOVERY_INVALID_PATH, RECOVERY_REQUEST_PATH, RECOVERY_SET_PASSWORD_PATH } from "@/src/lib/auth/recovery";
import { createRouteHandlerClient } from "@/src/lib/supabase/route-handler";

function sitePath(request: NextRequest, path: string) {
  return new URL(path, `${request.nextUrl.protocol}//${request.nextUrl.host}/`);
}

function continuePage(tokenHash: string, code: string) {
  return new NextResponse(recoveryContinueHtml({ tokenHash, code }), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

function isBrowserPrefetch(request: NextRequest) {
  const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""}`.toLowerCase();
  return (
    purpose.includes("prefetch") ||
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-segment-prefetch")
  );
}

/**
 * Password-recovery callback.
 * A token_hash link waits for the person to continue, so a mail app opening
 * the link does not use it up. An older PKCE code is still exchanged here.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = recoveryCredential(searchParams.get("code"));
  const tokenHash = recoveryCredential(searchParams.get("token_hash"));
  const type = searchParams.get("type");
  const authError = searchParams.get("error") || searchParams.get("error_code");

  if (authError) {
    return NextResponse.redirect(sitePath(request, RECOVERY_INVALID_PATH));
  }
  if (isBrowserPrefetch(request)) {
    return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
  if (tokenHash && (type === "recovery" || !type)) {
    return continuePage(tokenHash, "");
  }
  if (code) {
    const { supabase, redirect } = createRouteHandlerClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirect(sitePath(request, RECOVERY_INVALID_PATH));
    return redirect(sitePath(request, RECOVERY_SET_PASSWORD_PATH));
  }
  return NextResponse.redirect(sitePath(request, RECOVERY_REQUEST_PATH));
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = recoveryCredential(String(form.get("token_hash") ?? ""));
  const code = recoveryCredential(String(form.get("code") ?? ""));
  const type = String(form.get("type") ?? "");
  const { supabase, redirect } = createRouteHandlerClient(request);

  if (tokenHash && (type === "recovery" || !type)) {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (error) return redirect(sitePath(request, RECOVERY_INVALID_PATH));
    return redirect(sitePath(request, RECOVERY_SET_PASSWORD_PATH));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirect(sitePath(request, RECOVERY_INVALID_PATH));
    return redirect(sitePath(request, RECOVERY_SET_PASSWORD_PATH));
  }

  return redirect(sitePath(request, RECOVERY_INVALID_PATH));
}
