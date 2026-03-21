import Link from "next/link";
import { LockKeyhole, ShoppingBag } from "lucide-react";

import { signInAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured, sanitizeNextPath } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-muted/20 px-4 py-10">
      <Card className="w-full max-w-md border-none shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">Seller sign in</CardTitle>
            <p className="text-sm text-muted-foreground">
              Authenticate before accessing the seller CRM and future synced inventory data.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!isSupabaseConfigured() && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Supabase is not configured yet. Create a `.env.local` from `.env.example` before expecting auth to work.
            </div>
          )}

          {params.message && (
            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              {params.message}
            </div>
          )}

          <form action={signInAction} className="space-y-4">
            <input type="hidden" name="next" value={nextPath} />
            <label className="block space-y-2 text-sm font-medium">
              Email
              <Input name="email" type="email" placeholder="seller@lastbite.app" required />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Password
              <Input name="password" type="password" placeholder="••••••••" required />
            </label>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <LockKeyhole className="mr-2 h-4 w-4" />
              Sign in
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            New seller?{" "}
            <Link href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`} className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
