/* global describe, expect, it */

const { readFileSync } = require("fs");
const { join } = require("path");

describe("Supabase reservation lifecycle schema", () => {
  const schema = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8");

  it("defines server-owned reservation and cancellation RPCs", () => {
    expect(schema).toContain("create or replace function public.reserve_seller_offer");
    expect(schema).toContain("create or replace function public.cancel_seller_reservation");
    expect(schema).toContain("security definer");
    expect(schema).toMatch(/quantity_available\s*=\s*so\.quantity_available - 1/);
    expect(schema).toMatch(/quantity_available\s*=\s*so\.quantity_available \+ 1/);
    expect(schema).toContain("status = 'sold_out'");
  });

  it("removes public direct pickup order insertion in favor of RPC execution", () => {
    expect(schema).toContain(
      'drop policy if exists "pickup_orders_insert_public_reservations"'
    );
    expect(schema).toContain(
      "grant execute on function public.reserve_seller_offer"
    );
    expect(schema).toContain(
      "grant execute on function public.cancel_seller_reservation"
    );
  });

  it("can be rerun safely from the Supabase SQL editor", () => {
    [
      "seller_profiles_select_own",
      "seller_profiles_insert_own",
      "seller_profiles_update_own",
      "inventory_items_manage_own",
      "seller_offers_manage_own",
      "seller_offers_select_published",
      "pickup_orders_manage_own",
    ].forEach((policyName) => {
      expect(schema).toContain(`drop policy if exists "${policyName}"`);
    });

    expect(schema).toContain("notify pgrst, 'reload schema'");
  });
});
