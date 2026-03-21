"use server";

import { redirect } from "next/navigation";

import {
  getSiteUrl,
  isSupabaseConfigured,
  sanitizeNextPath,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function buildRedirect(pathname: string, params: Record<string, string | undefined>) {
  const url = new URL(pathname, getSiteUrl());

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return `${url.pathname}${url.search}`;
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeNextPath(formData.get("next"));

  if (!isSupabaseConfigured()) {
    redirect(
      buildRedirect("/auth/login", {
        next: nextPath,
        message:
          "Supabase auth is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first.",
      })
    );
  }

  if (!email || !password) {
    redirect(
      buildRedirect("/auth/login", {
        next: nextPath,
        message: "Email and password are required.",
      })
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      buildRedirect("/auth/login", {
        next: nextPath,
        message: error.message,
      })
    );
  }

  redirect(nextPath);
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeNextPath(formData.get("next"));
  const businessType =
    formData.get("businessType") === "shop" ? "shop" : "restaurant";

  if (!isSupabaseConfigured()) {
    redirect(
      buildRedirect("/auth/sign-up", {
        next: nextPath,
        message:
          "Supabase auth is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first.",
      })
    );
  }

  if (!email || !password) {
    redirect(
      buildRedirect("/auth/sign-up", {
        next: nextPath,
        message: "Email and password are required.",
      })
    );
  }

  const callbackUrl = new URL("/auth/callback", getSiteUrl());
  callbackUrl.searchParams.set("next", nextPath);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      data: { businessType },
    },
  });

  if (error) {
    redirect(
      buildRedirect("/auth/sign-up", {
        next: nextPath,
        message: error.message,
      })
    );
  }

  if (data.session) {
    redirect(nextPath);
  }

  redirect(
    buildRedirect("/auth/login", {
      next: nextPath,
      message:
        "Account created. Confirm the email address if your Supabase project requires email verification, then sign in.",
    })
  );
}
