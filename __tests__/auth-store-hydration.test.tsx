import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { AuthProvider, useAuth } from "@/lib/seller/auth-store";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSignInWithPassword = jest.fn();
let mockIsSupabaseConfigured = true;

jest.mock("@/lib/supabase", () => ({
  get supabase() {
    return {
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithPassword: mockSignInWithPassword,
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    };
  },
  isSupabaseConfigured: () => mockIsSupabaseConfigured,
}));

function AuthStateProbe() {
  const { isLoading, sellerProfile, session } = useAuth();

  return (
    <Text testID="auth-state">
      {isLoading
        ? "loading"
        : `${session?.user ? "session" : "no-session"}:${
            sellerProfile?.id ?? "no-profile"
          }:${sellerProfile?.businessType ?? "no-type"}`}
    </Text>
  );
}

function SignInProbe() {
  const { error, signIn } = useAuth();

  return (
    <>
      <Pressable
        onPress={() => {
          void signIn("seller@example.com", "password").catch(() => undefined);
        }}
        testID="sign-in-trigger"
      >
        <Text>Sign in</Text>
      </Pressable>
      <Text testID="auth-error">{error ?? "no-error"}</Text>
    </>
  );
}

describe("AuthProvider hydration", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER;
    delete process.env.EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE;
    mockIsSupabaseConfigured = true;
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockReset();
    mockMaybeSingle.mockReset();
    mockSignInWithPassword.mockReset();
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });
  });

  it("keeps loading until an existing seller session profile has hydrated", async () => {
    const profileDeferred = createDeferred<{
      data: Record<string, unknown>;
      error: null;
    }>();

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            email: "seller@example.com",
            id: "seller-1",
          },
        },
      },
      error: null,
    });
    mockMaybeSingle.mockReturnValue(profileDeferred.promise);

    const screen = render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("auth-state")).toHaveTextContent("loading");

    profileDeferred.resolve({
      data: {
        address: "Tashkent",
        business_name: "Seller One",
        business_type: "restaurant",
        category: "Meals",
        created_at: "2026-05-27T00:00:00.000Z",
        email: "seller@example.com",
        id: "seller-1",
        latitude: 41.31,
        longitude: 69.27,
        rating: 4.8,
        reviews: 10,
        updated_at: "2026-05-27T00:00:00.000Z",
      },
      error: null,
    });

    await waitFor(() =>
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "session:seller-1:restaurant"
      )
    );
  });

  it("hydrates a local seller only when the E2E flag is enabled and Supabase is unavailable", async () => {
    process.env.EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER = "1";
    mockIsSupabaseConfigured = false;

    const screen = render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "session:local-seller:restaurant"
      )
    );
  });

  it("can hydrate a local shop seller for guarded inventory E2E validation", async () => {
    process.env.EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER = "1";
    process.env.EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE = "shop";
    mockIsSupabaseConfigured = false;

    const screen = render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "session:local-seller:shop"
      )
    );
  });

  it("shows an actionable backend schema message when seller profile lookup fails after sign-in", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    });
    mockSignInWithPassword.mockResolvedValue({
      data: {
        session: {
          user: {
            email: "seller@example.com",
            id: "seller-1",
          },
        },
      },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST205",
        message:
          "Could not find the table 'public.seller_profiles' in the schema cache",
      },
    });

    const screen = render(
      <AuthProvider>
        <SignInProbe />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("auth-error")).toHaveTextContent("no-error")
    );

    fireEvent.press(screen.getByTestId("sign-in-trigger"));

    await waitFor(() =>
      expect(screen.getByTestId("auth-error")).toHaveTextContent(
        /Run supabase\/schema\.sql/
      )
    );
  });
});
