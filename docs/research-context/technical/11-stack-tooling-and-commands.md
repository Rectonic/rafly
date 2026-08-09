# Stack, Tooling, And Commands

## Core Stack

- Runtime: Expo SDK 55.
- UI framework: React Native 0.83.6, React 19.2.0.
- Routing: Expo Router 55 file-based navigation.
- Language: TypeScript 5.9 strict mode.
- Maps: `react-native-maps` using native Apple Maps/MapKit behavior on iOS.
- Backend client: `@supabase/supabase-js` for app runtime.
- Local storage: `@react-native-async-storage/async-storage`.
- Secrets/session/local private values: `expo-secure-store`.
- Notifications: `expo-notifications`.
- Location: `expo-location`.
- Camera/photo/OCR: `expo-camera`, `expo-image-picker`, `@react-native-ml-kit/text-recognition`.
- Icons: `@expo/vector-icons`.
- Gestures/safe area/screens: `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens`.

## Project Configuration

- `app.json`: Expo app config, bundle id `com.lastbite.app`, portrait orientation, iOS deployment target 15.5 via `expo-build-properties`, typed routes enabled, notification channel color.
- `tsconfig.json`: strict TypeScript, `@/*` path alias to repo root.
- `jest.config.js`: `jest-expo`, roots in `__tests__`, ignores native/generated/web output, maps `@/*`.
- `metro.config.js`: Expo/Metro config.
- `babel.config.js`: Expo Babel preset.

## NPM Scripts

- `npm run start`: Expo dev server.
- `npm run ios`: Expo iOS run.
- `npm run ios:sim`: iOS simulator run with `LASTBITE_DISABLE_IOS_MLKIT=1`.
- `npm run pods:ios:device`: install pods with device OCR/ML Kit enabled.
- `npm run pods:ios:sim`: install pods with simulator ML Kit disabled.
- `npm run test`: Jest.
- `npm run typecheck`: TypeScript.
- `npm run lint`: ESLint over mobile source/tests.
- `npm run backend:auth-smoke`: read-only Supabase auth/schema smoke check.
- `npm run backend:e2e`: Supabase reservation lifecycle E2E harness.

## Important Machine Constraints

The Desktop workspace path contains spaces and is iCloud-backed. Some Node/native tools have previously hung in this path. Use a clean `/tmp` copy for heavy simulator/Xcode work when needed.

Known stable approach:

- Keep the source workspace as the source of truth.
- Mirror changed files into `/tmp/lastbite-device-work` or `/tmp/lastbite-mobile-clean`.
- Run native builds/tests from the `/tmp` copy.

## Simulator Build Notes

The OCR dependency ships a device-only framework slice. Simulator builds intentionally disable iOS ML Kit autolinking:

```sh
LASTBITE_DISABLE_IOS_MLKIT=1 npm run pods:ios:sim
LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild -workspace ios/LastBite.xcworkspace -scheme LastBite -configuration Release -sdk iphonesimulator ...
```

Debug simulator builds require Metro. Release simulator builds embed `main.jsbundle` and can launch standalone without Metro.

## Physical iPhone Notes

Device builds keep ML Kit linked:

```sh
npm run pods:ios:device
```

The committed bundle id `com.lastbite.app` is not necessarily provisioned for the current Apple team. Local physical builds have used a team-owned override:

```sh
PRODUCT_BUNDLE_IDENTIFIER=com.boiskhonkattakhodjaev.lastbite.dev
DEVELOPMENT_TEAM=NU65C8BNDH
```

Recent device context:

- Device name: Rectonic.
- App installs have succeeded with the local development bundle id.
- Remote launch can fail if SpringBoard/CoreDevice reports the phone locked.
- Manual app launch from the device is the practical fallback after install.

## Backend Smoke Commands

Read-only auth/schema smoke:

```sh
npm run backend:auth-smoke -- --require --timeout-ms=10000
```

Expected statuses:

- `passed`: auth works and the seller has a profile.
- `auth_ok_profile_missing`: auth and schema work; seller must complete onboarding/profile.
- `schema_missing`: SQL schema has not been applied or schema cache is stale.
- `auth_failed`: seller credentials are wrong or blocked.
- `request_failed`: network/DNS/timeout failure.

Reservation lifecycle E2E:

```sh
npm run backend:e2e -- --require
```

The lifecycle E2E intentionally blocks remote/prod targets and non-test seller accounts unless explicit allow flags are set.
