/* global describe, expect, it */

const {
  buildRuntimeConfig,
  createHttpSmokeClient,
  runAuthSmoke,
} = require("../scripts/supabase-auth-smoke.cjs");

describe("Supabase auth smoke script", () => {
  const env = {
    EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    LASTBITE_BACKEND_E2E_SELLER_EMAIL: "seller@example.com",
    LASTBITE_BACKEND_E2E_SELLER_PASSWORD: "password",
  };

  it("skips safely without credentials unless required", () => {
    expect(buildRuntimeConfig([], {})).toEqual(
      expect.objectContaining({
        shouldRun: false,
        exitCode: 0,
      })
    );

    expect(buildRuntimeConfig(["--require"], {})).toEqual(
      expect.objectContaining({
        shouldRun: false,
        exitCode: 1,
      })
    );
  });

  it("detects a missing seller_profiles schema after successful auth", async () => {
    const result = await runAuthSmoke({
      client: {
        auth: {
          signInWithPassword: async () => ({
            data: { session: { user: { id: "seller-1" } } },
            error: null,
          }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: {
                  code: "PGRST205",
                  message:
                    "Could not find the table 'public.seller_profiles' in the schema cache",
                },
              }),
            }),
          }),
        }),
      },
      config: buildRuntimeConfig(["--require"], env),
    });

    expect(result).toEqual(
      expect.objectContaining({
        authOk: true,
        exitCode: 3,
        profileQueryOk: false,
        status: "schema_missing",
      })
    );
  });

  it("distinguishes invalid credentials from profile readiness", async () => {
    const authFailed = await runAuthSmoke({
      client: {
        auth: {
          signInWithPassword: async () => ({
            data: { session: null },
            error: { status: 400, message: "Invalid login credentials" },
          }),
        },
      },
      config: buildRuntimeConfig(["--require"], env),
    });

    expect(authFailed).toEqual(
      expect.objectContaining({
        authOk: false,
        exitCode: 2,
        status: "auth_failed",
      })
    );

    const missingProfile = await runAuthSmoke({
      client: {
        auth: {
          signInWithPassword: async () => ({
            data: { session: { user: { id: "seller-1" } } },
            error: null,
          }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      },
      config: buildRuntimeConfig(["--require"], env),
    });

    expect(missingProfile).toEqual(
      expect.objectContaining({
        authOk: true,
        exitCode: 0,
        hasProfile: false,
        status: "auth_ok_profile_missing",
      })
    );
  });

  it("reports request failures instead of hanging", async () => {
    const result = await runAuthSmoke({
      client: {
        auth: {
          signInWithPassword: async () => {
            throw new Error("Request timed out after 5ms");
          },
        },
      },
      config: buildRuntimeConfig(["--require"], env),
    });

    expect(result).toEqual(
      expect.objectContaining({
        authOk: false,
        exitCode: 5,
        stage: "auth",
        status: "request_failed",
      })
    );
  });

  it("can run through the HTTP adapter without loading supabase-js", async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url: String(url), options });

      if (String(url).includes("/auth/v1/token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "access-token",
            expires_in: 3600,
            refresh_token: "refresh-token",
            token_type: "bearer",
            user: { id: "seller-1" },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => [{ id: "seller-1", business_type: "restaurant" }],
      };
    };
    const config = {
      ...buildRuntimeConfig(["--require"], env),
      timeoutMs: 100,
    };
    const client = createHttpSmokeClient({ config, fetchImpl });

    await expect(runAuthSmoke({ client, config })).resolves.toEqual(
      expect.objectContaining({
        authOk: true,
        hasProfile: true,
        status: "passed",
      })
    );
    expect(calls[0].url).toContain("/auth/v1/token?grant_type=password");
    expect(calls[1].url).toContain("/rest/v1/seller_profiles");
    expect(calls[1].options.headers.Authorization).toBe("Bearer access-token");
  });
});
