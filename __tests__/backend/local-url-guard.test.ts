/**
 * The locality guard that stands between this harness and a real
 * environment. Every other file in this folder is gated behind
 * backendEnvPresent and skips itself without a running local stack. This one
 * is not gated, because it needs no database at all, it only checks that the
 * guard classifies URLs correctly. Running everywhere is the point: the guard
 * is what stops a service role key from being pointed at production, so it
 * should be verified on every plain test run too, not only when someone has
 * a stack up.
 */

import { backendEnvPresent, isLocalUrl } from "../../scripts/backend-test-helpers";

const ENV_URL = "LASTBITE_TEST_SUPABASE_URL";
const ENV_ANON_KEY = "LASTBITE_TEST_SUPABASE_ANON_KEY";
const ENV_SERVICE_ROLE_KEY = "LASTBITE_TEST_SUPABASE_SERVICE_ROLE_KEY";

describe("backend harness locality guard", () => {
  it("accepts the loopback and localhost URLs a local Supabase stack reports", () => {
    expect(isLocalUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalUrl("http://localhost:54321")).toBe(true);
    expect(isLocalUrl("http://127.0.0.1:54321/rest/v1")).toBe(true);
    expect(isLocalUrl("https://localhost")).toBe(true);
  });

  it("rejects a URL whose localhost looking prefix is only userinfo", () => {
    // Every one of these begins with a string that looks local and sends
    // every request somewhere else. A prefix match on the URL text passes
    // them, parsing does not: the real hostname is after the '@'.
    expect(isLocalUrl("https://localhost:5432@evil.example")).toBe(false);
    expect(isLocalUrl("https://127.0.0.1@evil.example/rest/v1")).toBe(false);
    expect(isLocalUrl("http://localhost:54321@10.0.0.9:54321")).toBe(false);
  });

  it("rejects remote hosts, host suffix tricks, non http schemes, and unparseable values", () => {
    expect(isLocalUrl("https://lastbite.supabase.co")).toBe(false);
    expect(isLocalUrl("http://localhost.evil.example")).toBe(false);
    expect(isLocalUrl("http://127.0.0.1.evil.example")).toBe(false);
    expect(isLocalUrl("file:///localhost")).toBe(false);
    expect(isLocalUrl("localhost:54321")).toBe(false);
    expect(isLocalUrl("")).toBe(false);
  });

  it("treats a non local env URL as an absent backend env rather than a usable one", () => {
    const saved = {
      url: process.env[ENV_URL],
      anonKey: process.env[ENV_ANON_KEY],
      serviceRoleKey: process.env[ENV_SERVICE_ROLE_KEY],
    };
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      process.env[ENV_URL] = "https://localhost:5432@evil.example";
      process.env[ENV_ANON_KEY] = "anon-key";
      process.env[ENV_SERVICE_ROLE_KEY] = "service-role-key";

      // Reporting "absent" is what makes every gated suite skip instead of
      // signing an admin client in against whatever that URL really is.
      expect(backendEnvPresent()).toBe(false);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      for (const [name, value] of [
        [ENV_URL, saved.url],
        [ENV_ANON_KEY, saved.anonKey],
        [ENV_SERVICE_ROLE_KEY, saved.serviceRoleKey],
      ] as const) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    }
  });
});
