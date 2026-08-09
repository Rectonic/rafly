#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REQUIRED_ENV = [
  "LASTBITE_BACKEND_E2E_SELLER_EMAIL",
  "LASTBITE_BACKEND_E2E_SELLER_PASSWORD",
];
const DEFAULT_TIMEOUT_MS = 15000;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((env, rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        return env;
      }

      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) {
        return env;
      }

      const [, key, rawValue] = match;
      env[key] = rawValue.trim().replace(/^['"]|['"]$/g, "");
      return env;
    }, {});
}

function readSupabaseErrorField(error, field) {
  if (!error || typeof error !== "object" || !(field in error)) {
    return null;
  }

  const value = error[field];
  return typeof value === "string" ? value : null;
}

function isMissingSchemaError(error) {
  const code = readSupabaseErrorField(error, "code");
  const message = readSupabaseErrorField(error, "message") || "";

  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("public.seller_profiles")
  );
}

function blockedConfig(reason, requireMode) {
  return {
    shouldRun: false,
    exitCode: requireMode ? 1 : 0,
    reason,
  };
}

function readTimeoutMs(argv = [], env = process.env) {
  const timeoutArg = argv.find((arg) => arg.startsWith("--timeout-ms="));
  const rawValue = timeoutArg
    ? timeoutArg.slice("--timeout-ms=".length)
    : env.LASTBITE_BACKEND_AUTH_SMOKE_TIMEOUT_MS;
  const parsedValue = Number(rawValue);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_TIMEOUT_MS;
}

function buildRuntimeConfig(argv = [], env = process.env) {
  const requireMode = argv.includes("--require");
  const supabaseUrl =
    env.LASTBITE_BACKEND_E2E_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    env.LASTBITE_BACKEND_E2E_SUPABASE_ANON_KEY ||
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const missing = [
    ...REQUIRED_ENV.filter((key) => !env[key]),
    ...(!supabaseUrl ? ["EXPO_PUBLIC_SUPABASE_URL"] : []),
    ...(!supabaseAnonKey ? ["EXPO_PUBLIC_SUPABASE_ANON_KEY"] : []),
  ];

  if (missing.length > 0) {
    return blockedConfig(
      `missing backend auth smoke env: ${missing.join(", ")}`,
      requireMode
    );
  }

  try {
    new URL(supabaseUrl);
  } catch {
    return {
      shouldRun: false,
      exitCode: 1,
      reason: "invalid Supabase URL for backend auth smoke",
    };
  }

  return {
    shouldRun: true,
    exitCode: 0,
    supabaseUrl,
    supabaseAnonKey,
    sellerEmail: env.LASTBITE_BACKEND_E2E_SELLER_EMAIL,
    sellerPassword: env.LASTBITE_BACKEND_E2E_SELLER_PASSWORD,
    timeoutMs: readTimeoutMs(argv, env),
  };
}

function createRequestFailure(stage, error, authOk = false) {
  return {
    status: "request_failed",
    exitCode: 5,
    configured: true,
    authOk,
    stage,
    message: error instanceof Error ? error.message : String(error),
    profileQueryOk: false,
    hasProfile: false,
  };
}

function readHttpErrorMessage(body, fallbackMessage) {
  if (body && typeof body === "object") {
    return (
      body.error_description ||
      body.msg ||
      body.error ||
      body.message ||
      fallbackMessage
    );
  }

  return fallbackMessage;
}

function createTimeoutError(timeoutMs) {
  return new Error(`Request timed out after ${timeoutMs}ms`);
}

async function fetchJsonWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = typeof AbortController !== "undefined"
    ? new AbortController()
    : null;
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (controller) {
        controller.abort();
      }
      reject(createTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  const requestPromise = Promise.resolve()
    .then(() =>
      fetchImpl(url, {
        ...options,
        signal: controller?.signal ?? options?.signal,
      })
    )
    .then(async (response) => {
      let body = null;

      try {
        body = await response.json();
      } catch {
        body = null;
      }

      return { body, response };
    });

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function createHttpSmokeClient({ config, fetchImpl = fetch }) {
  const baseUrl = config.supabaseUrl.replace(/\/+$/, "");
  let accessToken = null;

  return {
    auth: {
      async signInWithPassword({ email, password }) {
        const { body, response } = await fetchJsonWithTimeout(
          fetchImpl,
          `${baseUrl}/auth/v1/token?grant_type=password`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.supabaseAnonKey}`,
              apikey: config.supabaseAnonKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
          },
          config.timeoutMs
        );

        if (!response.ok) {
          return {
            data: { session: null },
            error: {
              status: response.status,
              message: readHttpErrorMessage(
                body,
                `Auth request failed with HTTP ${response.status}.`
              ),
            },
          };
        }

        accessToken = body?.access_token ?? null;

        return {
          data: {
            session: {
              access_token: accessToken,
              expires_in: body?.expires_in,
              refresh_token: body?.refresh_token,
              token_type: body?.token_type,
              user: body?.user ?? null,
            },
          },
          error: null,
        };
      },
    },
    from(tableName) {
      return {
        select(columns) {
          return {
            eq(field, value) {
              return {
                async maybeSingle() {
                  const url = new URL(`${baseUrl}/rest/v1/${tableName}`);
                  url.searchParams.set("select", columns);
                  url.searchParams.set(field, `eq.${value}`);

                  const { body, response } = await fetchJsonWithTimeout(
                    fetchImpl,
                    url.toString(),
                    {
                      headers: {
                        Authorization: `Bearer ${
                          accessToken ?? config.supabaseAnonKey
                        }`,
                        apikey: config.supabaseAnonKey,
                      },
                    },
                    config.timeoutMs
                  );

                  if (!response.ok) {
                    return {
                      data: null,
                      error: {
                        code: body?.code ?? null,
                        status: response.status,
                        message: readHttpErrorMessage(
                          body,
                          `${tableName} query failed with HTTP ${response.status}.`
                        ),
                      },
                    };
                  }

                  return {
                    data: Array.isArray(body) ? body[0] ?? null : body ?? null,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

async function runAuthSmoke({ client, config }) {
  let auth;

  try {
    auth = await client.auth.signInWithPassword({
      email: config.sellerEmail,
      password: config.sellerPassword,
    });
  } catch (error) {
    return createRequestFailure("auth", error);
  }

  if (auth.error || !auth.data?.session?.user?.id) {
    return {
      status: "auth_failed",
      exitCode: 2,
      configured: true,
      authOk: false,
      authStatus: auth.error?.status ?? null,
      authMessage: auth.error?.message ?? "Sign-in did not return a user.",
      profileQueryOk: false,
      hasProfile: false,
    };
  }

  let profile;

  try {
    profile = await client
      .from("seller_profiles")
      .select("id,business_type")
      .eq("id", auth.data.session.user.id)
      .maybeSingle();
  } catch (error) {
    return createRequestFailure("profile", error, true);
  }

  if (profile.error) {
    const schemaMissing = isMissingSchemaError(profile.error);
    return {
      status: schemaMissing ? "schema_missing" : "profile_query_failed",
      exitCode: schemaMissing ? 3 : 4,
      configured: true,
      authOk: true,
      profileQueryOk: false,
      hasProfile: false,
      profileCode: profile.error.code ?? null,
      profileMessage: profile.error.message ?? "Seller profile query failed.",
    };
  }

  return {
    status: profile.data ? "passed" : "auth_ok_profile_missing",
    exitCode: 0,
    configured: true,
    authOk: true,
    profileQueryOk: true,
    hasProfile: Boolean(profile.data),
  };
}

async function main() {
  const fileEnv = {
    ...loadEnvFile(path.join(process.cwd(), ".env")),
    ...loadEnvFile(path.join(process.cwd(), ".env.local")),
    ...loadEnvFile(path.join(process.cwd(), ".env.backend-e2e")),
  };
  const config = buildRuntimeConfig(process.argv.slice(2), {
    ...fileEnv,
    ...process.env,
  });

  if (!config.shouldRun) {
    const prefix = config.exitCode === 0 ? "[skip]" : "[blocked]";
    console.log(`${prefix} ${config.reason}`);
    process.exit(config.exitCode);
  }

  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable. Run this smoke check with Node 18+.");
  }

  const client = createHttpSmokeClient({ config });
  const result = await runAuthSmoke({ client, config });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.exitCode);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[fail] ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildRuntimeConfig,
  createHttpSmokeClient,
  isMissingSchemaError,
  loadEnvFile,
  runAuthSmoke,
};
