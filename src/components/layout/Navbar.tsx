"use client";

import Link from "next/link";
import { Heart, LogIn, MapPin, Menu, Search, ShoppingBag, Store } from "lucide-react";
import { useRef } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";
import { useFavorites } from "@/lib/favorites-store";
import { useLocale, setLocale } from "@/lib/locale-store";
import { setSearchQuery, useSearchQuery } from "@/lib/search-store";

type NavbarProps = {
  authEnabled: boolean;
  viewer: {
    email: string | null;
  } | null;
};

function getInitials(email: string | null) {
  if (!email) {
    return "LB";
  }

  return email.slice(0, 2).toUpperCase();
}

export function Navbar({ authEnabled, viewer }: NavbarProps) {
  const t = useT();
  const locale = useLocale();
  const favorites = useFavorites();
  const searchQuery = useSearchQuery();
  const inputRef = useRef<HTMLInputElement>(null);
  const userInitials = getInitials(viewer?.email ?? null);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-4 md:px-6">
        {/* Mobile Menu & Logo */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block text-xl tracking-tight">
              LastBite
            </span>
          </Link>
        </div>

        {/* Desktop Location Context */}
        <div className="hidden md:flex items-center ml-8 gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          <MapPin className="h-4 w-4" />
          <span className="font-medium text-foreground">{t.nav.location}</span>
        </div>

        {/* Global Search */}
        <div className="flex-1 px-4 md:px-8 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.nav.search}
              className="w-full bg-muted/50 pl-9 md:w-[400px] lg:w-[500px] rounded-full border-transparent focus-visible:ring-primary/20"
            />
          </div>
        </div>

        {/* Actions & Profile */}
        <div className="flex items-center gap-2 md:gap-4">
          {authEnabled ? (
            viewer ? (
              <>
                <Button asChild variant="outline" className="hidden rounded-full md:inline-flex">
                  <Link href="/seller">
                    <Store className="mr-2 h-4 w-4" />
                    {t.nav.sellerCrm}
                  </Link>
                </Button>
                <form action="/auth/logout" method="post" className="hidden md:block">
                  <Button type="submit" variant="ghost" className="rounded-full">
                    {t.nav.signOut}
                  </Button>
                </form>
              </>
            ) : (
              <Button asChild variant="outline" className="hidden rounded-full md:inline-flex">
                <Link href="/auth/login?next=%2Fseller">
                  <LogIn className="mr-2 h-4 w-4" />
                  {t.nav.sellerLogin}
                </Link>
              </Button>
            )
          ) : (
            <Button asChild variant="outline" className="hidden rounded-full md:inline-flex">
              <Link href="/seller">
                <Store className="mr-2 h-4 w-4" />
                {t.nav.sellerCrm}
              </Link>
            </Button>
          )}

          {/* Language switcher */}
          <div className="hidden sm:flex items-center rounded-full border border-border bg-card p-0.5">
            {(["en", "ru"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLocale(lang)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors uppercase ${
                  locale === lang
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground hover:text-primary hidden sm:flex"
            onClick={() => setSearchQuery("")}
            title={t.nav.favorites}
          >
            <Heart className={`h-5 w-5 ${favorites.length > 0 ? "fill-red-500 text-red-500" : ""}`} />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {favorites.length}
              </span>
            )}
          </Button>
          {viewer ? (
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground border border-transparent hover:border-border rounded-full">
              <Link href="/seller" aria-label={t.nav.openSellerCrm}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80" alt={viewer.email ?? "@seller"} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground border border-transparent hover:border-border rounded-full">
              <Link href={authEnabled ? "/auth/login?next=%2Fseller" : "/seller"} aria-label={t.nav.openSellerAccess}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{authEnabled ? "IN" : "LB"}</AvatarFallback>
                </Avatar>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
