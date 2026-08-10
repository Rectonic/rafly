import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { FAIL_CLOSED_FLAGS, type FeatureFlagsV2 } from "@/lib/contracts/flags";

export type FlagSourceV2 = () => Promise<FeatureFlagsV2>;

type FeatureFlagsStatusV2 = "loading" | "ready" | "failed";

type FeatureFlagsContextValue = {
  flags: FeatureFlagsV2;
  status: FeatureFlagsStatusV2;
  reload: () => void;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(
  null
);

type FeatureFlagsProviderProps = PropsWithChildren<{
  source: FlagSourceV2;
}>;

export function FeatureFlagsProvider({
  source,
  children,
}: FeatureFlagsProviderProps) {
  const [flags, setFlags] = useState<FeatureFlagsV2>(FAIL_CLOSED_FLAGS);
  const [status, setStatus] = useState<FeatureFlagsStatusV2>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

    setStatus("loading");
    setFlags(FAIL_CLOSED_FLAGS);

    source()
      .then((resolvedFlags) => {
        if (!isMounted) {
          return;
        }

        setFlags(resolvedFlags);
        setStatus("ready");
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setFlags(FAIL_CLOSED_FLAGS);
        setStatus("failed");
      });

    return () => {
      isMounted = false;
    };
  }, [source, attempt]);

  const reload = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const value = useMemo(
    () => ({
      flags,
      status,
      reload,
    }),
    [flags, status, reload]
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const value = useContext(FeatureFlagsContext);

  if (!value) {
    throw new Error("FeatureFlagsProvider missing");
  }

  return value;
}
