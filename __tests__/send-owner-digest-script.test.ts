import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const scriptUrl = pathToFileURL(
  join(process.cwd(), "scripts", "send-owner-digest.mjs")
).href;

function runModule(source: string) {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", source],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

describe("send-owner-digest.mjs", () => {
  it("refuses a non-local Supabase URL before fetch unless explicitly allowed", () => {
    const result = runModule(`
      import { runOwnerDigest } from ${JSON.stringify(scriptUrl)};
      let calls = 0;
      let errorText = "";
      const exitCode = await runOwnerDigest({
        env: {
          LASTBITE_TEST_SUPABASE_URL: "https://localhost:5432@evil.example",
          LASTBITE_TEST_SUPABASE_ANON_KEY: "anon-key",
          LASTBITE_TEST_SUPABASE_ACCESS_TOKEN: "access-token",
          STORE_ID: "store-1"
        },
        fetchImpl: async () => { calls += 1; throw new Error("must not fetch"); },
        stdout: { write() {} },
        stderr: { write(value) { errorText += value; } }
      });
      process.stdout.write(JSON.stringify({ exitCode, calls, errorText }));
    `);

    expect(result).toMatchObject({ exitCode: 1, calls: 0 });
    expect(String(result.errorText)).toContain(
      "LASTBITE_ALLOW_REMOTE_DIGEST=1"
    );
  });

  it("prints the shared Russian formatter output and optionally posts it to Telegram", () => {
    const result = runModule(`
      import { runOwnerDigest } from ${JSON.stringify(scriptUrl)};
      const calls = [];
      let output = "";
      let errorText = "";
      const digest = {
        storeName: "Тестовый магазин",
        generatedAt: "2026-08-11T08:05:00.000Z",
        staleVerification: [{ productName: "Хлеб", onHand: 12, lastVerifiedAt: null }],
        expiryRisk: [],
        openExceptions: [],
        pausedOffers: [],
        countActivity7d: { daysWithCountSession: 0, days: 7 },
        offers7d: {
          published: 0,
          fulfilled: 0,
          cancelledBySeller: 0,
          expiredNoShow: 0,
          failedStockMismatch: 0
        }
      };
      const fetchImpl = async (url, options) => {
        calls.push({ url: String(url), options });
        return {
          ok: true,
          status: 200,
          json: async () => String(url).includes("api.telegram.org")
            ? { ok: true }
            : digest,
          text: async () => ""
        };
      };
      const exitCode = await runOwnerDigest({
        env: {
          LASTBITE_TEST_SUPABASE_URL: "http://127.0.0.1:54321",
          LASTBITE_TEST_SUPABASE_ANON_KEY: "anon-key",
          LASTBITE_TEST_SUPABASE_ACCESS_TOKEN: "access-token",
          STORE_ID: "store-1",
          TELEGRAM_BOT_TOKEN: "bot-token",
          TELEGRAM_CHAT_ID: "chat-1"
        },
        fetchImpl,
        stdout: { write(value) { output += value; } },
        stderr: { write(value) { errorText += value; } }
      });
      process.stdout.write(JSON.stringify({ exitCode, calls, output, errorText }));
    `);

    expect(result).toMatchObject({ exitCode: 0, errorText: "" });
    expect(String(result.output)).toBe(
      [
        "Сводка дня: Тестовый магазин",
        "Сформировано: 11.08.2026 08:05 UTC",
        "",
        "Давно не проверялось",
        "01. Хлеб | остаток 12 | не проверялось",
        "",
        "итого: 1 задач на сегодня",
        "",
      ].join("\n")
    );
    const calls = result.calls as { url: string; options: { body: string } }[];
    expect(calls[0].url).toBe(
      "http://127.0.0.1:54321/rest/v1/rpc/compose_owner_digest_v2"
    );
    expect(JSON.parse(calls[0].options.body)).toEqual({
      p_store_id: "store-1",
    });
    expect(calls[1].url).toBe(
      "https://api.telegram.org/botbot-token/sendMessage"
    );
    expect(JSON.parse(calls[1].options.body)).toMatchObject({
      chat_id: "chat-1",
      text: expect.stringContaining("итого: 1 задач на сегодня"),
    });
  });
});
