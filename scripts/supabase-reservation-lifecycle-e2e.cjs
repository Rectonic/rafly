#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REQUIRED_ENV = [
  "LASTBITE_BACKEND_E2E_SUPABASE_URL",
  "LASTBITE_BACKEND_E2E_SUPABASE_ANON_KEY",
  "LASTBITE_BACKEND_E2E_SELLER_EMAIL",
  "LASTBITE_BACKEND_E2E_SELLER_PASSWORD",
];

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function buildRunId(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, "").slice(0, 15);
}

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
      const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
      env[key] = value;
      return env;
    }, {});
}

function isLocalSupabaseUrl(urlString) {
  try {
    const url = new URL(urlString);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1" ||
      url.hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

function blockedConfig(reason, requireMode, forceFailure = false) {
  return {
    shouldRun: false,
    exitCode: forceFailure || requireMode ? 1 : 0,
    reason,
  };
}

function buildRuntimeConfig(argv = [], env = process.env) {
  const requireMode = argv.includes("--require");
  const missing = REQUIRED_ENV.filter((key) => !env[key]);

  if (missing.length > 0) {
    return blockedConfig(
      `missing backend E2E env: ${missing.join(", ")}`,
      requireMode
    );
  }

  const supabaseUrl = env.LASTBITE_BACKEND_E2E_SUPABASE_URL;
  const target = env.LASTBITE_BACKEND_E2E_TARGET || "local";
  const allowRemote = isEnabled(env.LASTBITE_BACKEND_E2E_ALLOW_REMOTE);
  const allowProduction = isEnabled(env.LASTBITE_BACKEND_E2E_ALLOW_PRODUCTION);
  const allowNonE2ESeller = isEnabled(
    env.LASTBITE_BACKEND_E2E_ALLOW_NON_E2E_SELLER
  );
  const sellerEmail = env.LASTBITE_BACKEND_E2E_SELLER_EMAIL;
  const sellerEmailLower = sellerEmail.toLowerCase();

  try {
    new URL(supabaseUrl);
  } catch {
    return blockedConfig("invalid Supabase URL for backend E2E", requireMode, true);
  }

  if (!isLocalSupabaseUrl(supabaseUrl) && !allowRemote) {
    return blockedConfig(
      "remote Supabase backend E2E is blocked unless LASTBITE_BACKEND_E2E_ALLOW_REMOTE=1",
      requireMode,
      true
    );
  }

  if (target.toLowerCase() === "production" && !allowProduction) {
    return blockedConfig(
      "production backend E2E is blocked unless LASTBITE_BACKEND_E2E_ALLOW_PRODUCTION=1",
      requireMode,
      true
    );
  }

  if (
    !allowNonE2ESeller &&
    !sellerEmailLower.includes("e2e") &&
    !sellerEmailLower.includes("test")
  ) {
    return blockedConfig(
      "seller email must be clearly marked as e2e/test or explicitly allowed",
      requireMode,
      true
    );
  }

  return {
    shouldRun: true,
    exitCode: 0,
    requireMode,
    supabaseUrl,
    supabaseAnonKey: env.LASTBITE_BACKEND_E2E_SUPABASE_ANON_KEY,
    sellerEmail,
    sellerPassword: env.LASTBITE_BACKEND_E2E_SELLER_PASSWORD,
    target,
    runId: env.LASTBITE_BACKEND_E2E_RUN_ID || buildRunId(),
  };
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeRpcRow(data, label) {
  const row = Array.isArray(data) ? data[0] : data;
  assertCondition(row, `${label} did not return a row`);
  return row;
}

function assertNoSupabaseError(result, label) {
  if (result.error) {
    throw new Error(`${label} failed: ${result.error.message}`);
  }
  return result;
}

async function expectFailure(operation, messagePattern, label) {
  try {
    await operation();
  } catch (error) {
    if (messagePattern && !messagePattern.test(String(error.message))) {
      throw new Error(`${label} failed with an unexpected error: ${error.message}`);
    }
    return;
  }

  throw new Error(`${label} unexpectedly succeeded`);
}

function buildOfferPayload({ sellerId, markerBase, marker, quantity_available }) {
  return {
    seller_id: sellerId,
    title: `${markerBase} ${marker} package`,
    business_name: `${markerBase} Kitchen`,
    category: "E2E",
    old_price: 12,
    new_price: 5,
    discount: 58,
    distance_text: "0.1 km",
    pickup_start: "18:00",
    pickup_end: "21:00",
    quantity_available,
    contents: [`${markerBase} item`],
    allergens: [],
    cancellation_policy: `${markerBase} cancellation policy`,
    dietary_badges: ["vegetarian"],
    pickup_instructions: `${markerBase} pickup counter`,
    source: "seller",
    business_type: "restaurant",
    latitude: 41.2995,
    longitude: 69.2401,
    address: `${markerBase} Test Address`,
    rating: 0,
    reviews: 0,
    status: "published",
    translations: {},
  };
}

function createSupabaseHarnessAdapter({ sellerClient, buyerClient, config, logger }) {
  return {
    async signInSeller() {
      const result = await sellerClient.auth.signInWithPassword({
        email: config.sellerEmail,
        password: config.sellerPassword,
      });
      assertNoSupabaseError(result, "seller sign-in");
      assertCondition(result.data?.user?.id, "seller sign-in did not return a user");
      return {
        id: result.data.user.id,
        email: result.data.user.email || config.sellerEmail,
      };
    },

    async ensureSellerProfile({ seller, markerBase }) {
      const existing = await sellerClient
        .from("seller_profiles")
        .select("id")
        .eq("id", seller.id)
        .maybeSingle();
      assertNoSupabaseError(existing, "seller profile lookup");

      if (existing.data?.id) {
        return { created: false };
      }

      const insert = await sellerClient.from("seller_profiles").insert({
        id: seller.id,
        email: seller.email,
        business_name: `${markerBase} Seller`,
        business_type: "restaurant",
        category: "E2E",
        address: `${markerBase} Seller Address`,
        latitude: 41.2995,
        longitude: 69.2401,
        rating: 0,
        reviews: 0,
        translations: {},
      });
      assertNoSupabaseError(insert, "seller profile creation");
      return { created: true };
    },

    async assertAnonDirectWritesBlocked({ sellerId, offerId, reservationCode, markerBase }) {
      const pickupAttempt = await buyerClient.from("pickup_orders").insert({
        seller_id: sellerId,
        offer_id: offerId,
        customer_name: `${markerBase} Direct Buyer`,
        reservation_code: reservationCode,
        pickup_window: "18:00-21:00",
        total: 5,
        status: "pending",
      });

      assertCondition(
        pickupAttempt.error,
        "anon direct pickup_orders insert unexpectedly succeeded"
      );

      const offerAttempt = await buyerClient.from("seller_offers").insert(
        buildOfferPayload({
          sellerId,
          markerBase,
          marker: "blocked-anon-offer",
          quantity_available: 1,
        })
      );

      assertCondition(
        offerAttempt.error,
        "anon direct seller_offers insert unexpectedly succeeded"
      );
    },

    async createOffer(payload) {
      const result = await sellerClient
        .from("seller_offers")
        .insert(payload)
        .select("id")
        .single();
      assertNoSupabaseError(result, `create offer ${payload.title}`);
      assertCondition(result.data?.id, "created offer did not return an id");
      return result.data.id;
    },

    async readOffer(offerId) {
      const result = await sellerClient
        .from("seller_offers")
        .select("id,status,quantity_available")
        .eq("id", offerId)
        .single();
      assertNoSupabaseError(result, `read offer ${offerId}`);
      return result.data;
    },

    async countPickupOrders(offerId) {
      const result = await sellerClient
        .from("pickup_orders")
        .select("id", { count: "exact", head: true })
        .eq("offer_id", offerId);
      assertNoSupabaseError(result, `count pickup orders for ${offerId}`);
      return result.count;
    },

    async reserveOffer({ offerId, reservationCode, pickupWindow, customerName }) {
      const result = await buyerClient.rpc("reserve_seller_offer", {
        p_offer_id: offerId,
        p_reservation_code: reservationCode,
        p_pickup_window: pickupWindow,
        p_customer_name: customerName,
      });
      assertNoSupabaseError(result, `reserve ${offerId}`);
      return normalizeRpcRow(result.data, "reserve_seller_offer");
    },

    async cancelReservation({ offerId, reservationCode }) {
      const result = await buyerClient.rpc("cancel_seller_reservation", {
        p_offer_id: offerId,
        p_reservation_code: reservationCode,
      });
      assertNoSupabaseError(result, `cancel ${offerId}`);
      return normalizeRpcRow(result.data, "cancel_seller_reservation");
    },

    async cleanup({ sellerId, offerIds, reservationPrefix, profileCreated }) {
      const cleanupErrors = [];
      const collect = async (label, operation) => {
        const result = await operation();
        if (result.error) {
          cleanupErrors.push(`${label}: ${result.error.message}`);
        }
      };

      if (sellerId) {
        await collect("delete pickup_orders", () =>
          sellerClient
            .from("pickup_orders")
            .delete()
            .eq("seller_id", sellerId)
            .like("reservation_code", `${reservationPrefix}%`)
        );
      }

      for (const offerId of offerIds) {
        await collect(`delete seller_offer ${offerId}`, () =>
          sellerClient.from("seller_offers").delete().eq("id", offerId)
        );
      }

      if (profileCreated && sellerId) {
        await collect("delete created seller_profile", () =>
          sellerClient.from("seller_profiles").delete().eq("id", sellerId)
        );
      }

      if (cleanupErrors.length > 0) {
        const message = cleanupErrors.join("; ");
        logger.warn(`[cleanup-warning] ${message}`);
        throw new Error(`backend E2E cleanup failed: ${message}`);
      }
    },

    async signOut() {
      await sellerClient.auth.signOut();
    },
  };
}

async function assertOfferState(adapter, offerId, expected, label) {
  const offer = await adapter.readOffer(offerId);
  assertCondition(
    offer.quantity_available === expected.quantity_available,
    `${label} expected quantity ${expected.quantity_available}, got ${offer.quantity_available}`
  );
  assertCondition(
    offer.status === expected.status,
    `${label} expected status ${expected.status}, got ${offer.status}`
  );
  return offer;
}

async function runReservationLifecycleE2E({ adapter, config, logger = console }) {
  const runId = config.runId || buildRunId();
  const markerBase = `LB_E2E_${runId}`;
  const reservationPrefix = `LB-E2E-${runId}`;
  const offerIds = [];
  let sellerId;
  let profileCreated = false;
  let primaryPickupOrderId;
  let primaryOfferId;
  let raceOfferId;
  let racePickupOrderId;
  let workflowError;

  try {
    logger.log(`[backend-e2e] starting reservation lifecycle run ${runId}`);
    const seller = await adapter.signInSeller();
    sellerId = seller.id;
    const profileResult = await adapter.ensureSellerProfile({
      seller,
      markerBase,
    });
    profileCreated = Boolean(profileResult.created);

    primaryOfferId = await adapter.createOffer(
      buildOfferPayload({
        sellerId,
        markerBase,
        marker: "primary",
        quantity_available: 1,
      })
    );
    offerIds.push(primaryOfferId);

    await adapter.assertAnonDirectWritesBlocked({
      sellerId,
      offerId: primaryOfferId,
      reservationCode: `${reservationPrefix}-DIRECT`,
      markerBase,
    });

    const primaryCode = `${reservationPrefix}-PRIMARY`;
    const secondCode = `${reservationPrefix}-SECOND`;
    const pickupWindow = "18:00-21:00";
    const customerName = `${markerBase} Buyer`;

    const firstReservation = await adapter.reserveOffer({
      offerId: primaryOfferId,
      reservationCode: primaryCode,
      pickupWindow,
      customerName,
    });
    primaryPickupOrderId = firstReservation.pickup_order_id;
    assertCondition(primaryPickupOrderId, "primary reservation did not return an id");
    assertCondition(
      firstReservation.status === "pending",
      `primary reservation returned status ${firstReservation.status}`
    );
    assertCondition(
      firstReservation.quantity_available === 0,
      `primary reservation expected quantity 0, got ${firstReservation.quantity_available}`
    );
    await assertOfferState(adapter, primaryOfferId, {
      quantity_available: 0,
      status: "sold_out",
    }, "primary offer after reservation");

    const retryReservation = await adapter.reserveOffer({
      offerId: primaryOfferId,
      reservationCode: primaryCode,
      pickupWindow,
      customerName,
    });
    assertCondition(
      retryReservation.pickup_order_id === primaryPickupOrderId,
      "retry reservation returned a different pickup order"
    );
    assertCondition(
      retryReservation.quantity_available === 0,
      `retry reservation expected quantity 0, got ${retryReservation.quantity_available}`
    );
    await assertOfferState(adapter, primaryOfferId, {
      quantity_available: 0,
      status: "sold_out",
    }, "primary offer after retry");
    const primaryOrderCount = await adapter.countPickupOrders(primaryOfferId);
    assertCondition(
      primaryOrderCount === 1,
      `primary offer expected 1 pickup order, got ${primaryOrderCount}`
    );

    await expectFailure(
      () =>
        adapter.reserveOffer({
          offerId: primaryOfferId,
          reservationCode: secondCode,
          pickupWindow,
          customerName,
        }),
      /available|sold_out|no longer/i,
      "second reservation on sold-out offer"
    );

    const cancelResult = await adapter.cancelReservation({
      offerId: primaryOfferId,
      reservationCode: primaryCode,
    });
    assertCondition(
      cancelResult.pickup_order_id === primaryPickupOrderId,
      "cancel returned a different pickup order"
    );
    assertCondition(
      cancelResult.status === "cancelled",
      `cancel returned status ${cancelResult.status}`
    );
    assertCondition(
      cancelResult.quantity_available === 1,
      `cancel expected quantity 1, got ${cancelResult.quantity_available}`
    );
    await assertOfferState(adapter, primaryOfferId, {
      quantity_available: 1,
      status: "published",
    }, "primary offer after cancel");

    const cancelRetry = await adapter.cancelReservation({
      offerId: primaryOfferId,
      reservationCode: primaryCode,
    });
    assertCondition(
      cancelRetry.pickup_order_id === primaryPickupOrderId,
      "cancel retry returned a different pickup order"
    );
    assertCondition(
      cancelRetry.quantity_available === 1,
      `cancel retry expected quantity 1, got ${cancelRetry.quantity_available}`
    );
    await assertOfferState(adapter, primaryOfferId, {
      quantity_available: 1,
      status: "published",
    }, "primary offer after cancel retry");

    raceOfferId = await adapter.createOffer(
      buildOfferPayload({
        sellerId,
        markerBase,
        marker: "race",
        quantity_available: 1,
      })
    );
    offerIds.push(raceOfferId);

    const raceResults = await Promise.allSettled(
      [0, 1, 2].map((index) =>
        adapter.reserveOffer({
          offerId: raceOfferId,
          reservationCode: `${reservationPrefix}-RACE-${index}`,
          pickupWindow,
          customerName: `${markerBase} Race Buyer ${index}`,
        })
      )
    );
    const successfulRaceReservations = raceResults.filter(
      (result) => result.status === "fulfilled"
    );
    assertCondition(
      successfulRaceReservations.length === 1,
      `concurrency test expected 1 successful reservation, got ${successfulRaceReservations.length}`
    );
    racePickupOrderId = successfulRaceReservations[0].value.pickup_order_id;
    assertCondition(racePickupOrderId, "race reservation did not return an id");
    await assertOfferState(adapter, raceOfferId, {
      quantity_available: 0,
      status: "sold_out",
    }, "race offer after parallel reservations");
    const raceOrderCount = await adapter.countPickupOrders(raceOfferId);
    assertCondition(
      raceOrderCount === 1,
      `race offer expected 1 pickup order, got ${raceOrderCount}`
    );

    return {
      status: "passed",
      runId,
      primaryOfferId,
      primaryPickupOrderId,
      raceOfferId,
      racePickupOrderId,
    };
  } catch (error) {
    workflowError = error;
    throw error;
  } finally {
    let cleanupError;
    try {
      await adapter.cleanup({
        sellerId,
        offerIds,
        reservationPrefix,
        profileCreated,
      });
    } catch (error) {
      cleanupError = error;
    }

    try {
      await adapter.signOut();
    } catch (error) {
      logger.warn(`[cleanup-warning] seller sign-out failed: ${error.message}`);
    }

    if (!workflowError && cleanupError) {
      throw cleanupError;
    }
  }
}

async function main() {
  const fileEnv = loadEnvFile(path.join(process.cwd(), ".env.backend-e2e"));
  const config = buildRuntimeConfig(process.argv.slice(2), {
    ...fileEnv,
    ...process.env,
  });

  if (!config.shouldRun) {
    const prefix = config.exitCode === 0 ? "[skip]" : "[blocked]";
    console.log(`${prefix} ${config.reason}`);
    process.exit(config.exitCode);
  }

  const { createClient } = require("@supabase/supabase-js");
  const clientOptions = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  };
  const sellerClient = createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    clientOptions
  );
  const buyerClient = createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    clientOptions
  );
  const adapter = createSupabaseHarnessAdapter({
    sellerClient,
    buyerClient,
    config,
    logger: console,
  });

  try {
    const result = await runReservationLifecycleE2E({
      adapter,
      config,
      logger: console,
    });
    console.log(
      `[pass] backend reservation lifecycle E2E passed for run ${result.runId}`
    );
    process.exit(0);
  } catch (error) {
    console.error(`[fail] ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildRuntimeConfig,
  buildRunId,
  createSupabaseHarnessAdapter,
  loadEnvFile,
  runReservationLifecycleE2E,
};
