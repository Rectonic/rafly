const LOCAL_SITE_URL = "http://localhost:3000";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return {
    url,
    publishableKey,
  };
}

export function sanitizeNextPath(value: FormDataEntryValue | string | null | undefined) {
  const nextPath = typeof value === "string" ? value : "";

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/seller";
  }

  return nextPath;
}

export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_URL;

  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  return LOCAL_SITE_URL;
}
