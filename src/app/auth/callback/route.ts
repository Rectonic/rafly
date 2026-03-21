import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { sanitizeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  }

  if (tokenHash && type) {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(`/auth/login?message=${encodeURIComponent("Authentication link is invalid or expired.")}`, requestUrl.origin));
}
