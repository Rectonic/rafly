import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("compose_owner_digest_v2 migration", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase/migrations/20260811130000_v2_owner_digest.sql"
  );

  it("defines a manager-only read RPC with explicit grants", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain(
      "create or replace function public.compose_owner_digest_v2"
    );
    expect(sql).toContain("security definer");
    expect(sql).toMatch(/not in \('manager', 'owner'\)/);
    expect(sql).toContain("revoke execute on function");
    expect(sql).toContain("grant execute on function");
    expect(sql).not.toMatch(/\b(insert|update|delete)\s+(into|public\.|from)/i);
  });

  it("returns only factual action brief fields with ten-row caps", () => {
    const sql = readFileSync(migrationPath, "utf8");

    for (const field of [
      "storeName",
      "generatedAt",
      "staleVerification",
      "expiryRisk",
      "openExceptions",
      "pausedOffers",
      "countActivity7d",
      "offers7d",
      "cancelledBySeller",
      "expiredNoShow",
      "failedStockMismatch",
    ]) {
      expect(sql).toContain(`'${field}'`);
    }
    expect(sql.match(/limit 10/g)).toHaveLength(4);
    expect(sql).not.toMatch(/mismatchRate|dead.?stock|sales/i);
  });
});
