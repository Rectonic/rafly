import type { SellerProfile } from "@/types/seller";

export const MISSING_SUPABASE_CONFIGURATION_MESSAGE =
  "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.";

export const MISSING_SUPABASE_SCHEMA_MESSAGE =
  "Supabase database schema is not installed for LastBite. Run supabase/schema.sql in the Supabase SQL editor, then retry.";

export function createMissingSupabaseConfigurationError() {
  return new Error(MISSING_SUPABASE_CONFIGURATION_MESSAGE);
}

function readSupabaseErrorField(error: unknown, field: "code" | "message") {
  if (!error || typeof error !== "object" || !(field in error)) {
    return null;
  }

  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

export function getSellerBackendErrorMessage(
  error: unknown,
  fallbackMessage: string
) {
  const code = readSupabaseErrorField(error, "code");
  const message =
    error instanceof Error
      ? error.message
      : readSupabaseErrorField(error, "message");

  if (
    code === "PGRST205" ||
    code === "42P01" ||
    message?.includes("schema cache") ||
    message?.includes("public.seller_profiles")
  ) {
    return MISSING_SUPABASE_SCHEMA_MESSAGE;
  }

  return message ?? fallbackMessage;
}

export function createSellerBackendError(
  error: unknown,
  fallbackMessage: string
) {
  return new Error(getSellerBackendErrorMessage(error, fallbackMessage));
}

export function getPostSignInRoute(sellerProfile: SellerProfile | null) {
  return sellerProfile ? "/(seller-tabs)" : "/auth/business-type";
}
