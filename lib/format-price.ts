import type { Locale } from "@/i18n/types";

export function formatPrice(value: number, locale: Locale) {
  const fixed = value.toFixed(2);

  if (locale === "ru") {
    return `${fixed.replace(".", ",")} $`;
  }

  return `$${fixed}`;
}
