import Link from "next/link";
import { ShieldPlus } from "lucide-react";

import { signUpAction } from "@/app/auth/actions";
import { BusinessTypePicker } from "@/components/auth/BusinessTypePicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured, sanitizeNextPath } from "@/lib/auth";

export default async function SignUpPage({
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
          <div className="space-y-1">
            <CardTitle className="text-2xl">Join LastBite as a seller</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose your business type — it determines which tools you get in the seller CRM.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!isSupabaseConfigured() && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Supabase is not configured yet. Create a <code>.env.local</code> from <code>.env.example</code> before expecting auth to work.
            </div>
          )}

          {params.message && (
            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              {params.message}
            </div>
          )}

          <form action={signUpAction} className="space-y-5">
            <input type="hidden" name="next" value={nextPath} />

            <BusinessTypePicker />

            <div className="space-y-4 pt-1">
              <label className="block space-y-2 text-sm font-medium">
                Email
                <Input name="email" type="email" placeholder="hello@yourbusiness.com" required />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Password
                <Input name="password" type="password" minLength={8} placeholder="At least 8 characters" required />
              </label>
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <ShieldPlus className="mr-2 h-4 w-4" />
              Create seller account
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
