/**
 * Integration coverage for stores, memberships, roles, and app flags.
 *
 * Talks to a real local Supabase stack through scripts/backend-test-helpers.
 * Every it block exercises Postgres RLS directly, not application code, so a
 * passing suite here is proof the policies in
 * supabase/migrations/20260810100000_v2_stores_roles_flags.sql behave as
 * documented in the migration A content spec.
 *
 * Isolation: every run creates a fresh store named with a uuid suffix and
 * leaves it in place, shared tables are never truncated. Test user emails
 * stay fixed across runs on purpose, so signInTestUser reuses the same four
 * auth.users rows instead of growing that table on every run.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  backendEnvPresent,
  backendSkipReason,
  getAnonClient,
  getServiceClient,
  signInTestUser,
} from "../../scripts/backend-test-helpers";

if (!backendEnvPresent()) {
  console.log(`stores-roles.integration.test.ts: ${backendSkipReason()}`);
}

const d = backendEnvPresent() ? describe : describe.skip;

d("stores, memberships, roles, and app flags", () => {
  const runId = randomUUID();

  // Fixed across runs on purpose, unlike runId, so signInTestUser reuses the
  // same four users instead of creating new ones on every run.
  const ownerEmail = "backend-test-owner@lastbite.test";
  const managerEmail = "backend-test-manager@lastbite.test";
  const staffEmail = "backend-test-staff@lastbite.test";
  const nonMemberEmail = "backend-test-nonmember@lastbite.test";

  let storeId: string;
  let ownerUserId: string;
  let managerUserId: string;
  let staffUserId: string;

  let ownerClient: SupabaseClient;
  let managerClient: SupabaseClient;
  let staffClient: SupabaseClient;
  let nonMemberClient: SupabaseClient;

  beforeAll(async () => {
    const serviceClient = getServiceClient();

    [ownerClient, managerClient, staffClient, nonMemberClient] = await Promise.all([
      signInTestUser(ownerEmail),
      signInTestUser(managerEmail),
      signInTestUser(staffEmail),
      signInTestUser(nonMemberEmail),
    ]);

    const [{ data: ownerUser }, { data: managerUser }, { data: staffUser }] = await Promise.all([
      ownerClient.auth.getUser(),
      managerClient.auth.getUser(),
      staffClient.auth.getUser(),
    ]);

    if (!ownerUser.user || !managerUser.user || !staffUser.user) {
      throw new Error("could not resolve auth.getUser() for one of the seeded test users");
    }

    ownerUserId = ownerUser.user.id;
    managerUserId = managerUser.user.id;
    staffUserId = staffUser.user.id;

    const { data: store, error: storeError } = await serviceClient
      .from("stores")
      .insert({
        name: `Backend Test Store ${runId}`,
        address: "1 Test Way",
        latitude: 41.3,
        longitude: 69.2,
      })
      .select()
      .single();

    if (storeError || !store) {
      throw new Error(`failed to create the test store: ${storeError?.message}`);
    }

    storeId = store.id;

    const { error: membershipError } = await serviceClient.from("store_memberships").insert([
      { store_id: storeId, user_id: ownerUserId, role: "owner" },
      { store_id: storeId, user_id: managerUserId, role: "manager" },
      { store_id: storeId, user_id: staffUserId, role: "staff" },
    ]);

    if (membershipError) {
      throw new Error(`failed to create the test memberships: ${membershipError.message}`);
    }
  });

  it("lets a member select their own store row", async () => {
    const { data, error } = await ownerClient
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.id).toBe(storeId);
  });

  it("lets a member select their own membership row", async () => {
    const { data, error } = await staffClient
      .from("store_memberships")
      .select("store_id, user_id, role")
      .eq("store_id", storeId)
      .eq("user_id", staffUserId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.role).toBe("staff");
  });

  it("does not let a member select another member's membership row", async () => {
    const { data, error } = await staffClient
      .from("store_memberships")
      .select("id")
      .eq("store_id", storeId)
      .eq("user_id", ownerUserId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("hides the store from a non member", async () => {
    const { data, error } = await nonMemberClient
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("does not let anon select stores directly", async () => {
    const { data, error } = await getAnonClient().from("stores").select("id").eq("id", storeId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("lets anon read the marketplace_mode app flag", async () => {
    const { data, error } = await getAnonClient()
      .from("app_flags")
      .select("id, value")
      .eq("id", "marketplace_mode")
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.value).toEqual({ mode: "demo" });
  });

  it("does not let anon change the marketplace_mode app flag", async () => {
    await getAnonClient()
      .from("app_flags")
      .update({ value: { mode: "pilot" } })
      .eq("id", "marketplace_mode");

    const { data, error } = await getServiceClient()
      .from("app_flags")
      .select("value")
      .eq("id", "marketplace_mode")
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.value).toEqual({ mode: "demo" });
  });

  it("returns the right role per user through fn_current_store_role", async () => {
    const [owner, manager, staff, nonMember] = await Promise.all([
      ownerClient.rpc("fn_current_store_role", { p_store_id: storeId }),
      managerClient.rpc("fn_current_store_role", { p_store_id: storeId }),
      staffClient.rpc("fn_current_store_role", { p_store_id: storeId }),
      nonMemberClient.rpc("fn_current_store_role", { p_store_id: storeId }),
    ]);

    expect(owner.error).toBeNull();
    expect(owner.data).toBe("owner");
    expect(manager.data).toBe("manager");
    expect(staff.data).toBe("staff");
    expect(nonMember.data).toBeNull();
  });
});
