"use client";

import { useState } from "react";
import { ShoppingCart, UtensilsCrossed } from "lucide-react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { SellerBusinessType } from "@/types/seller";

export function BusinessTypePicker({
  defaultValue = "restaurant",
}: {
  defaultValue?: SellerBusinessType;
}) {
  const t = useT();
  const [selected, setSelected] = useState<SellerBusinessType>(defaultValue);

  const OPTIONS: Array<{
    type: SellerBusinessType;
    label: string;
    subtitle: string;
    icon: typeof UtensilsCrossed;
    activeColor: string;
    activeBg: string;
  }> = [
    {
      type: "restaurant",
      label: t.auth.restaurantLabel,
      subtitle: t.auth.restaurantSubtitle,
      icon: UtensilsCrossed,
      activeColor: "border-secondary text-secondary",
      activeBg: "bg-secondary/5",
    },
    {
      type: "shop",
      label: t.auth.shopLabel,
      subtitle: t.auth.shopSubtitle,
      icon: ShoppingCart,
      activeColor: "border-primary text-primary",
      activeBg: "bg-primary/5",
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t.auth.businessType}</p>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(({ type, label, subtitle, icon: Icon, activeColor, activeBg }) => {
          const isActive = selected === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setSelected(type)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all",
                isActive
                  ? cn("shadow-sm", activeColor, activeBg)
                  : "border-border text-muted-foreground hover:bg-muted/30"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  isActive ? activeBg : "bg-muted/50"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold leading-tight">{label}</span>
              <span className="text-[11px] leading-snug opacity-70">{subtitle}</span>
            </button>
          );
        })}
      </div>
      <input type="hidden" name="businessType" value={selected} />
    </div>
  );
}
