import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { generateOpaqueId } from "./id";

/**
 * Persistent opaque buyer installation id. Not a device fingerprint and not
 * tied to any account, a fresh install gets a fresh id. The reservation
 * contract uses this to scope idempotency and to let a buyer recover their
 * own held reservations after a restart, it is never treated as personally
 * identifying.
 */
export const INSTALLATION_ID_STORAGE_KEY = "lastbite-buyer-installation-id";

let pendingRead: Promise<string> | null = null;

export async function getInstallationId(): Promise<string> {
  if (pendingRead) {
    return pendingRead;
  }

  pendingRead = (async () => {
    try {
      const stored = await AsyncStorage.getItem(INSTALLATION_ID_STORAGE_KEY);
      if (stored) {
        return stored;
      }

      const created = generateOpaqueId("install");
      await AsyncStorage.setItem(INSTALLATION_ID_STORAGE_KEY, created);
      return created;
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
