#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import digestFormatter from "../lib/domain/digest-format.cjs";

const { formatDigestRu } = digestFormatter;
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost"]);

function enabled(value) {
  return String(value ?? "").trim() === "1";
}

function valueOf(env, name) {
  const value = env[name];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function isLocalDigestUrl(value) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === "" &&
      LOCAL_HOSTNAMES.has(url.hostname)
    );
  } catch {
    return false;
  }
}

export function buildDigestConfig(env = process.env) {
  const supabaseUrl = valueOf(env, "LASTBITE_TEST_SUPABASE_URL");
  const anonKey = valueOf(env, "LASTBITE_TEST_SUPABASE_ANON_KEY");
  const storeId = valueOf(env, "STORE_ID");

  const missing = [];
  if (!supabaseUrl) missing.push("LASTBITE_TEST_SUPABASE_URL");
  if (!anonKey) missing.push("LASTBITE_TEST_SUPABASE_ANON_KEY");
  if (!storeId) missing.push("STORE_ID");
  if (missing.length > 0) {
    throw new Error(`не заданы переменные: ${missing.join(", ")}`);
  }

  if (
    !isLocalDigestUrl(supabaseUrl) &&
    !enabled(env.LASTBITE_ALLOW_REMOTE_DIGEST)
  ) {
    throw new Error(
      "удалённый Supabase запрещён, установите LASTBITE_ALLOW_REMOTE_DIGEST=1 для явного разрешения"
    );
  }

  const accessToken = valueOf(env, "LASTBITE_TEST_SUPABASE_ACCESS_TOKEN");
  const email = valueOf(env, "LASTBITE_TEST_SUPABASE_EMAIL");
  const password = valueOf(env, "LASTBITE_TEST_SUPABASE_PASSWORD");
  if (!accessToken && (!email || !password)) {
    throw new Error(
      "задайте LASTBITE_TEST_SUPABASE_ACCESS_TOKEN или пару LASTBITE_TEST_SUPABASE_EMAIL и LASTBITE_TEST_SUPABASE_PASSWORD"
    );
  }

  const telegramBotToken = valueOf(env, "TELEGRAM_BOT_TOKEN");
  const telegramChatId = valueOf(env, "TELEGRAM_CHAT_ID");
  if (Boolean(telegramBotToken) !== Boolean(telegramChatId)) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID должны быть заданы вместе"
    );
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    anonKey,
    storeId,
    accessToken,
    email,
    password,
    telegramBotToken,
    telegramChatId,
  };
}

async function responseMessage(response) {
  try {
    const body = await response.text();
    return body || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function signIn(config, fetchImpl) {
  if (config.accessToken) return config.accessToken;

  const response = await fetchImpl(
    `${config.supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: config.email,
        password: config.password,
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`вход в Supabase не выполнен: ${await responseMessage(response)}`);
  }
  const body = await response.json();
  if (!body?.access_token) {
    throw new Error("вход в Supabase не вернул access token");
  }
  return body.access_token;
}

async function composeDigest(config, accessToken, fetchImpl) {
  const response = await fetchImpl(
    `${config.supabaseUrl}/rest/v1/rpc/compose_owner_digest_v2`,
    {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_store_id: config.storeId }),
    }
  );
  if (!response.ok) {
    throw new Error(`сводка не сформирована: ${await responseMessage(response)}`);
  }
  return response.json();
}

async function sendTelegram(config, message, fetchImpl) {
  if (!config.telegramBotToken || !config.telegramChatId) return;

  const response = await fetchImpl(
    `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: message,
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Telegram не принял сводку: ${await responseMessage(response)}`);
  }
}

export async function runOwnerDigest({
  env = process.env,
  fetchImpl = globalThis.fetch,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    if (typeof fetchImpl !== "function") {
      throw new Error("в этой версии Node нет встроенного fetch");
    }
    const config = buildDigestConfig(env);
    const accessToken = await signIn(config, fetchImpl);
    const digest = await composeDigest(config, accessToken, fetchImpl);
    const message = formatDigestRu(digest);
    stdout.write(`${message}\n`);
    await sendTelegram(config, message, fetchImpl);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`Не удалось отправить сводку: ${message}\n`);
    return 1;
  }
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  process.exitCode = await runOwnerDigest();
}
