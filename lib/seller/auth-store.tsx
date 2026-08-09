import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { buildFallbackSellerProfile } from "@/lib/seller/defaults";
import {
  createMissingSupabaseConfigurationError,
  createSellerBackendError,
} from "@/lib/seller/auth-flow";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  LocalizedSellerProfileContent,
  SellerBusinessType,
  SellerProfile,
} from "@/types/seller";

type SellerProfileRow = {
  id: string;
  email: string;
  business_name: string;
  business_type: SellerBusinessType;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviews: number;
  created_at: string;
  updated_at: string;
  translations?: LocalizedSellerProfileContent | null;
};

type AuthContextValue = {
  error: string | null;
  isLoading: boolean;
  sellerProfile: SellerProfile | null;
  session: Session | null;
  completeBusinessTypeSelection: (
    businessType: SellerBusinessType
  ) => Promise<void>;
  refreshSellerProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SellerProfile | null>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isLocalSellerE2EEnabled() {
  return process.env.EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER === "1";
}

function getLocalSellerE2EBusinessType(): SellerBusinessType {
  return process.env.EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE === "shop"
    ? "shop"
    : "restaurant";
}

function buildLocalSellerE2EProfile() {
  const businessType = getLocalSellerE2EBusinessType();

  return buildFallbackSellerProfile({
    businessType,
    category: businessType === "shop" ? "Groceries" : "Bakery",
  });
}

function createLocalSellerSession(profile: SellerProfile): Session {
  const now = new Date().toISOString();

  return {
    access_token: "local-e2e-access-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    refresh_token: "local-e2e-refresh-token",
    token_type: "bearer",
    user: {
      app_metadata: {},
      aud: "authenticated",
      created_at: now,
      email: profile.email,
      id: profile.id,
      role: "authenticated",
      updated_at: now,
      user_metadata: {},
    },
  } as Session;
}

function mapSellerProfile(row: SellerProfileRow): SellerProfile {
  return {
    id: row.id,
    email: row.email,
    businessName: row.business_name,
    businessType: row.business_type,
    category: row.category,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    rating: Number(row.rating),
    reviews: row.reviews,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    translations: row.translations ?? undefined,
  };
}

async function fetchSellerProfileForSession(nextSession: Session | null) {
  if (!isSupabaseConfigured() || !supabase || !nextSession?.user) {
    return null;
  }

  const { data, error: profileError } = await supabase
    .from("seller_profiles")
    .select("*")
    .eq("id", nextSession.user.id)
    .maybeSingle();

  if (profileError) {
    throw createSellerBackendError(
      profileError,
      "Unable to load seller profile."
    );
  }

  return data ? mapSellerProfile(data as SellerProfileRow) : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSellerProfile = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase || !session?.user) {
      if (isLocalSellerE2EEnabled()) {
        setSellerProfile(buildLocalSellerE2EProfile());
        return;
      }

      setSellerProfile(null);
      return;
    }

    try {
      setSellerProfile(await fetchSellerProfileForSession(session));
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Unable to load seller profile."
      );
      setSellerProfile(null);
    }
  }, [session]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      if (isLocalSellerE2EEnabled()) {
        const localProfile = buildLocalSellerE2EProfile();
        setSession(createLocalSellerSession(localProfile));
        setSellerProfile(localProfile);
        setIsLoading(false);
        return;
      }

      setSession(null);
      setSellerProfile(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const hydrateSession = async (nextSession: Session | null) => {
      if (!isMounted) {
        return;
      }

      if (!nextSession?.user) {
        setSession(null);
        setSellerProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const profile = await fetchSellerProfileForSession(nextSession);

        if (!isMounted) {
          return;
        }

        setSession(nextSession);
        setSellerProfile(profile);
      } catch (profileError) {
        if (!isMounted) {
          return;
        }

        setError(
          profileError instanceof Error
            ? profileError.message
            : "Unable to load seller profile."
        );
        setSession(nextSession);
        setSellerProfile(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
      }

      void hydrateSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setIsLoading(true);
      void hydrateSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setSellerProfile(null);
      return;
    }

    void refreshSellerProfile();
  }, [refreshSellerProfile, session?.user]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      const missingConfigurationError = createMissingSupabaseConfigurationError();
      setError(missingConfigurationError.message);
      throw missingConfigurationError;
    }

    setError(null);
    setIsLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      throw signInError;
    }

    try {
      const profile = await fetchSellerProfileForSession(data.session);
      setSession(data.session);
      setSellerProfile(profile);
      return profile;
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Unable to load seller profile."
      );
      throw profileError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      const missingConfigurationError = createMissingSupabaseConfigurationError();
      setError(missingConfigurationError.message);
      throw missingConfigurationError;
    }

    setError(null);
    setIsLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      throw signUpError;
    }

    if (!data.session) {
      const missingSessionError = new Error(
        "Sign-up succeeded, but no session was returned. Confirm the account and sign in again."
      );
      setError(missingSessionError.message);
      setIsLoading(false);
      throw missingSessionError;
    }

    setSession(data.session);
    setSellerProfile(null);
    setIsLoading(false);
  }, []);

  const completeBusinessTypeSelection = useCallback(
    async (businessType: SellerBusinessType) => {
      if (!isSupabaseConfigured() || !supabase) {
        const missingConfigurationError = createMissingSupabaseConfigurationError();
        setError(missingConfigurationError.message);
        throw missingConfigurationError;
      }

      if (!session?.user) {
        const missingSessionError = new Error(
          "Sign in before selecting a business type."
        );
        setError(missingSessionError.message);
        throw missingSessionError;
      }

      setError(null);

      const fallbackProfile = buildFallbackSellerProfile({
        businessType,
        email: session.user.email ?? buildFallbackSellerProfile().email,
        id: session.user.id,
      });

      const { data, error: profileError } = await supabase
        .from("seller_profiles")
        .upsert({
          id: fallbackProfile.id,
          email: fallbackProfile.email,
          business_name: fallbackProfile.businessName,
          business_type: fallbackProfile.businessType,
          category: fallbackProfile.category,
          address: fallbackProfile.address,
          latitude: fallbackProfile.latitude,
          longitude: fallbackProfile.longitude,
          rating: fallbackProfile.rating,
          reviews: fallbackProfile.reviews,
          translations: fallbackProfile.translations ?? {},
        })
        .select("*")
        .single();

      if (profileError) {
        const sellerBackendError = createSellerBackendError(
          profileError,
          "Unable to save seller profile."
        );
        setError(sellerBackendError.message);
        throw sellerBackendError;
      }

      setSellerProfile(mapSellerProfile(data as SellerProfileRow));
    },
    [session?.user]
  );

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setSession(null);
      setSellerProfile(null);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }

    setSession(null);
    setSellerProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      error,
      isLoading,
      sellerProfile,
      session,
      completeBusinessTypeSelection,
      refreshSellerProfile,
      signIn,
      signOut,
      signUp,
    }),
    [
      completeBusinessTypeSelection,
      error,
      isLoading,
      refreshSellerProfile,
      sellerProfile,
      session,
      signIn,
      signOut,
      signUp,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("AuthProvider is missing.");
  }

  return value;
}
