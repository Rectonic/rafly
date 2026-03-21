# Security Review - 2026-03-15

## Project Understanding

LastBite is currently a front-end-first Next.js marketplace prototype with two primary surfaces:

1. Buyer marketplace at `/`
2. Seller CRM at `/seller`

The buyer side renders local offer data plus seller-published packages from a client-side `localStorage` store. The seller side now supports barcode-assisted inventory intake for shop goods, OCR-based expiry capture, and restaurant meal-package publishing.

## Concrete Findings

### 1. Dependency vulnerabilities

- `npm audit` initially reported 4 high-severity transitive vulnerabilities.
- Root causes were transitive dependencies under local tooling, especially `shadcn` and lint cache packages.
- `npm audit fix` was run and the project now reports `0 vulnerabilities`.

### 2. Runtime app exposure

Current runtime risk remains low because the project does not yet expose:

- authenticated seller accounts
- server-side mutations
- database writes
- public file uploads
- backend APIs that process untrusted input

This means the present attack surface is mostly static asset delivery plus client-side browser capabilities.

## Residual Risks To Address Before Production

### 1. No authentication or authorization

The seller CRM is currently local-only. Any real deployment needs seller authentication and server-side authorization checks before exposing inventory or publishing flows.

### 2. No server-side validation or persistence

Seller data is stored in browser `localStorage`. This is acceptable for prototyping only. Real offer publication, inventory, and expiry data must move to validated server-side writes.

### 3. Third-party asset and service reliance

The app currently depends on third-party resources such as:

- remote images
- map tiles
- QR generation service
- OCR worker/runtime assets

Before production, define an explicit CSP, allowed image domains, and privacy posture for third-party services.

### 4. Camera and OCR permissions

Barcode and OCR are client-side browser workflows. Production hardening should include:

- explicit permission/error handling UX
- rate limits and upload bounds if OCR moves server-side
- retention policy for captured images

## Recommendation

For MVP hardening, the next security step should be:

1. add seller auth
2. move CRM state to server actions plus validated schema checks
3. add CSP and domain restrictions
4. replace prototype third-party QR/OCR defaults with production-managed services or pinned assets
