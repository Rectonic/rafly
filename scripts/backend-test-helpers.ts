/**
 * Shared helpers for the backend integration suite.
 *
 * Lives in scripts/, not __tests__/backend/, on purpose. jest-expo's
 * universal preset does not narrow Jest's default testMatch, so
 * '**\/__tests__/**\/*.[jt]s?(x)' turns every .ts file under __tests__ into
 * its own suite regardless of name or content. A helpers-only module placed
 * there fails immediately with "Your test suite must contain at least one
 * test". lib/ is not an option either, it imports @supabase/supabase-js
 * directly, which the architecture boundary test only allows inside
 * lib/api. scripts/ already holds the other backend test entry points
 * (supabase-auth-smoke.cjs, supabase-reservation-lifecycle-e2e.cjs) and is
 * scanned by neither Jest nor the boundary test.
 *
 * Every suite under __tests__/backend talks to a real local Supabase stack,
 * never a mock. The three LASTBITE_TEST_SUPABASE_* variables come from
 * scripts/backend-test-env.sh, which reads them out of
 * 'supabase status -o env'. When they are absent, backendEnvPresent()
 * returns false and callers fall back to describe.skip, the pattern used in
 * every *.integration.test.ts file:
 *
 *   const d = backendEnvPresent() ? describe : describe.skip
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ENV_URL = "LASTBITE_TEST_SUPABASE_URL";
const ENV_ANON_KEY = "LASTBITE_TEST_SUPABASE_ANON_KEY";
const ENV_SERVICE_ROLE_KEY = "LASTBITE_TEST_SUPABASE_SERVICE_ROLE_KEY";

// Mirrors the guard in scripts/backend-test-env.sh. This suite signs in an
// admin client and writes real rows, so a non-local URL must never pass,
// even if someone hand sets the env var and skips that script entirely.
const LOCAL_URL_PATTERN = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/;

function isLocalUrl(url: string): boolean {
  return LOCAL_URL_PATTERN.test(url);
}

// Fixed on purpose, every test user is created or reused with this same
// password so signInTestUser stays idempotent across reruns.
const TEST_USER_PASSWORD = "lastbite-backend-test-000!";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} is not set. ${backendSkipReason()}`);
  }
  return value;
}

export function backendEnvPresent(): boolean {
  const url = readEnv(ENV_URL);
  const anonKey = readEnv(ENV_ANON_KEY);
  const serviceRoleKey = readEnv(ENV_SERVICE_ROLE_KEY);

  if (!url || !anonKey || !serviceRoleKey) {
    return false;
  }

  if (!isLocalUrl(url)) {
    console.warn(
      `backendEnvPresent: refusing non-local ${ENV_URL} '${url}', this harness only targets a local Supabase stack, treating the backend env as absent`
    );
    return false;
  }

  return true;
}

export function backendSkipReason(): string {
  return (
    "backend integration suite not run, set LASTBITE_TEST_SUPABASE_URL, " +
    "LASTBITE_TEST_SUPABASE_ANON_KEY, and LASTBITE_TEST_SUPABASE_SERVICE_ROLE_KEY " +
    "(source scripts/backend-test-env.sh with the local stack running, or run npm run test:backend)"
  );
}

export function getServiceClient(): SupabaseClient {
  const url = requireEnv(ENV_URL);
  const serviceRoleKey = requireEnv(ENV_SERVICE_ROLE_KEY);
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export function getAnonClient(): SupabaseClient {
  const url = requireEnv(ENV_URL);
  const anonKey = requireEnv(ENV_ANON_KEY);
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

/**
 * Creates a confirmed test user through the service admin API, or reuses one
 * left over from a previous run, then signs in with the anon client. Callers
 * get back an authed client whose requests carry that user's JWT, so RLS
 * policies apply exactly as they would for a real signed in user.
 */
export async function signInTestUser(email: string): Promise<SupabaseClient> {
  const serviceClient = getServiceClient();
  const { error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  });

  const anonClient = getAnonClient();
  const { error: signInError } = await anonClient.auth.signInWithPassword({
    email,
    password: TEST_USER_PASSWORD,
  });

  if (signInError) {
    const createNote = createError
      ? ` The create attempt also failed: ${createError.message}.`
      : " The user already existed from a previous run.";
    throw new Error(
      `signInTestUser could not sign in ${email}.${createNote} Sign in error: ${signInError.message}`
    );
  }

  return anonClient;
}
