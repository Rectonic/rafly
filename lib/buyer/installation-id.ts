import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

import { generateOpaqueId } from "./id";

/**
 * Persistent opaque buyer installation id. Not a device fingerprint and not
 * tied to any account, a fresh install gets a fresh id. The reservation
 * contract uses this to scope idempotency and to let a buyer recover their
 * own held reservations after a restart.
 *
 * It is a bearer secret. Anybody holding one can list that installation's
 * reservations and cancel them, so SecureStore is the only place it is
 * written. The unencrypted AsyncStorage copy is not a general fallback, it
 * exists only for entitlement-less simulator and e2e builds and only when
 * EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE is set to "1", the same
 * escape hatch lib/buyer/secure-pickup-code.ts uses.
 *
 * Builds before this change kept the id in AsyncStorage under
 * INSTALLATION_ID_LEGACY_STORAGE_KEY. The first read after upgrading moves
 * that value into SecureStore and deletes the plaintext copy, so an existing
 * buyer keeps their reservations instead of being handed a new identity. The
 * legacy key is only deleted once the secure write has actually succeeded,
 * losing the id would strand every reservation attached to it.
 */
export const INSTALLATION_ID_LEGACY_STORAGE_KEY = "lastbite-buyer-installation-id";
export const INSTALLATION_ID_SECURE_KEY = "lastbite-buyer-installation-id";

let pendingRead: Promise<string> | null = null;
/**
 * The id resolved for this session. A build where SecureStore is unavailable
 * and the escape hatch is off cannot persist anything, and without this cache
 * every caller would mint a different id inside a single session.
 */
let sessionId: string | null = null;

function insecureStoreAllowed(): boolean {
  return process.env.EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE === "1";
}

async function readSecure(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(INSTALLATION_ID_SECURE_KEY);
  } catch {
    // SecureStore can be unavailable in entitlement-less simulator builds.
    return null;
  }
}

async function writeSecure(value: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(INSTALLATION_ID_SECURE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * The legacy plaintext copy, read regardless of the escape hatch flag. This
 * read is the one time migration, not a fallback. A build without the flag
 * that refused to look would silently orphan every reservation an existing
 * buyer already holds, and the value moves into SecureStore immediately.
 */
async function readLegacy(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(INSTALLATION_ID_LEGACY_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function clearLegacy(): Promise<void> {
  try {
    await AsyncStorage.removeItem(INSTALLATION_ID_LEGACY_STORAGE_KEY);
  } catch {
    // Best effort. A leftover plaintext copy is read again next launch and
    // migrated again, which is harmless, the secure copy already wins.
  }
}

async function resolveInstallationId(): Promise<string> {
  if (sessionId) {
    return sessionId;
  }

  const secure = await readSecure();
  if (secure) {
    sessionId = secure;
    return secure;
  }

  const legacy = await readLegacy();
  if (legacy) {
    if (await writeSecure(legacy)) {
      await clearLegacy();
    }
    // If the secure write failed the plaintext copy stays exactly where it
    // was. It is the only copy of an id that real reservations are attached
    // to, and deleting it to satisfy a storage rule would cost the buyer
    // every one of them.
    sessionId = legacy;
    return legacy;
  }

  const created = generateOpaqueId("install");
  if (await writeSecure(created)) {
    sessionId = created;
    return created;
  }

  if (insecureStoreAllowed()) {
    try {
      await AsyncStorage.setItem(INSTALLATION_ID_LEGACY_STORAGE_KEY, created);
    } catch {
      // Falls through to the session only id below.
    }
  }

  // Nothing could be written anywhere. The id is real for this session, so
  // reserving still works, but it will not survive a restart and the buyer
  // cannot recover a hold after one. Nothing is fabricated to hide that.
  sessionId = created;
  return created;
}

export async function getInstallationId(): Promise<string> {
  if (pendingRead) {
    return pendingRead;
  }

  pendingRead = (async () => {
    try {
      return await resolveInstallationId();
    } finally {
      pendingRead = null;
    }
  })();

  return pendingRead;
}

export function useInstallationId(): string | null {
  const [installationId, setInstallationId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void getInstallationId().then((id) => {
      if (isMounted) {
        setInstallationId(id);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return installationId;
}

/** Test seam. Drops the cached session id so a suite can start clean. */
export function resetInstallationIdCacheForTests(): void {
  sessionId = null;
  pendingRead = null;
}
