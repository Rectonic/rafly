import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { isSupabaseConfigured } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LastBite | Save Food, Save Money",
  description: "A marketplace where restaurants sell surplus food at a discount.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authEnabled = isSupabaseConfigured();
  let viewer: { email: string | null } | null = null;

  if (authEnabled) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    viewer = user ? { email: user.email ?? null } : null;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <Navbar authEnabled={authEnabled} viewer={viewer} />
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
