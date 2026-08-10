/**
 * Deterministic seed data for the in memory Store Core fake.
 *
 * makeDefaultScenario builds one pilot store with an owner, a manager and a
 * staff member, plus a second store owned by somebody else and a user with no
 * membership at all. The three products cover the offerable cases the beta
 * cares about:
 *
 * - a high confidence product that can back an offer directly
 * - a low confidence product that can only back an offer when the seller
 *   physically sets the units aside
 * - a product whose batch already expired, which can never back an offer
 *
 * Clock and ids are fixed so assertions can be exact.
 *
 * Pickup code format: the fake issues codes as the literal prefix LB followed
 * by a four digit zero padded counter, so the first reservation in a world gets
 * LB0001, the second LB0002 and so on. Codes are six characters, uppercase, and
 * the safe hint is the last two characters.
 */

import { DEFAULT_NOW, InMemoryStoreCore } from "./in-memory-store-core";

export interface DefaultScenario {
  now: string;
  storeId: string;
  storeName: string;
  ownerUserId: string;
  managerUserId: string;
  staffUserId: string;
  strangerUserId: string;
  otherStoreId: string;
  otherStoreOwnerUserId: string;
  highConfidenceProductId: string;
  lowConfidenceProductId: string;
  expiredProductId: string;
  pickupStart: string;
  pickupEnd: string;
  timezone: "Asia/Tashkent";
  installationA: string;
  installationB: string;
}

export const DEFAULT_PICKUP_START = "2026-08-10T17:00:00.000Z";
export const DEFAULT_PICKUP_END = "2026-08-10T20:00:00.000Z";

export function makeDefaultScenario(core: InMemoryStoreCore): DefaultScenario {
  const storeName = "Chorsu Corner Market";
  const storeId = core.createStore({
    name: storeName,
    pilotModeEnabled: true,
    shopSellerBetaEnabled: true,
  });
  const otherStoreId = core.createStore({
    name: "Yunusabad Mini Market",
    pilotModeEnabled: true,
    shopSellerBetaEnabled: true,
  });

  const ownerUserId = "user-owner";
  const managerUserId = "user-manager";
  const staffUserId = "user-staff";
  const strangerUserId = "user-stranger";
  const otherStoreOwnerUserId = "user-other-owner";

  core.addMembership({ storeId, userId: ownerUserId, role: "owner" });
  core.addMembership({ storeId, userId: managerUserId, role: "manager" });
  core.addMembership({ storeId, userId: staffUserId, role: "staff" });
  core.addMembership({
    storeId: otherStoreId,
    userId: otherStoreOwnerUserId,
    role: "owner",
  });

  const highConfidenceProductId = core.addProduct({
    storeId,
    productName: "Fresh bread loaf",
    barcode: "4780000000011",
    category: "bakery",
    onHandQuantity: 10,
    confidence: "high",
    lastVerifiedAt: DEFAULT_NOW,
    expiryDate: "2026-08-12",
  });
  const lowConfidenceProductId = core.addProduct({
    storeId,
    productName: "Chilled yoghurt",
    barcode: "4780000000028",
    category: "dairy",
    onHandQuantity: 6,
    confidence: "low",
    lastVerifiedAt: null,
    expiryDate: "2026-08-15",
  });
  const expiredProductId = core.addProduct({
    storeId,
    productName: "Day old pastry batch",
    barcode: "4780000000035",
    category: "bakery",
    onHandQuantity: 4,
    confidence: "high",
    lastVerifiedAt: DEFAULT_NOW,
    expiryDate: "2026-08-09",
  });

  return {
    now: DEFAULT_NOW,
    storeId,
    storeName,
    ownerUserId,
    managerUserId,
    staffUserId,
    strangerUserId,
    otherStoreId,
    otherStoreOwnerUserId,
    highConfidenceProductId,
    lowConfidenceProductId,
    expiredProductId,
    pickupStart: DEFAULT_PICKUP_START,
    pickupEnd: DEFAULT_PICKUP_END,
    timezone: "Asia/Tashkent",
    installationA: "installation-a",
    installationB: "installation-b",
  };
}
